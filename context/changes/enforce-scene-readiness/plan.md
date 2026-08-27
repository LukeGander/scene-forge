# Enforce Scene Readiness Implementation Plan

## Overview

Build roadmap slice `S-03`: let the creator set a scene's status (Draft / Needs Work / Ready), add a freeform notes/corrections field, and acknowledge or clear generated design risks — with "Ready" blocked, both in the UI and on the server, unless the completeness rule (player goal + obstacle + ≥1 interaction/puzzle + required assets + character function if characters present + no unresolved design risks) holds (FR-018, FR-019, FR-020, FR-022).

## Current State Analysis

`scene_cards.status` already exists in the DB (`text` with a CHECK restricting it to `'draft' | 'needs_work' | 'ready'`), but nothing in the app reads or sets it meaningfully — the only writer, `forge.ts`, hardcodes `status: "draft"` on every upsert. `design_risks` is a flat `jsonb` array of plain strings with no acknowledged/cleared state — this was a deliberate S-01 plan-review simplification, explicitly deferred to this change. There is no notes/corrections column anywhere, no PATCH/update route in `src/pages/api/` (only `POST` create routes and `POST forge.ts`'s full-upsert), no completeness-rule logic, and no Select/RadioGroup UI primitive in the codebase. Full detail: `context/changes/enforce-scene-readiness/research.md`.

## Desired End State

On a scene with a generated card, the creator can: pick a status (Draft / Needs Work / Ready — Ready disabled with an explanatory tooltip until the completeness rule is met), write freeform notes, and check off individual design risks as acknowledged, then Save — all in one request. The server re-validates the Ready-gate rule independently of the client. Regenerating a card resets status to Draft and clears all risk acknowledgments (since the anatomy may have changed) but preserves the creator's notes.

Verify by: the manual test steps in each phase below, and `npm run test && npm run lint && npx astro check && npm run build` all passing.

### Key Discoveries:

- `scene_cards.status` (migration `20260802120000_create_scene_forge_core.sql:25`) and its GRANT (`20260813210000_grant_scene_forge_core_privileges.sql`) already permit UPDATE — no new GRANT migration needed, only a schema addition/backfill.
- `design_risks jsonb not null default '[]'::jsonb` (same migration, line 31) currently holds plain strings; `SceneCardFields.designRisks: string[]` (`src/lib/forge-scene/types.ts:12`) carries an explicit comment marking this as deferred to this change.
- `forge.ts:86-101` upserts `scene_cards` with an explicit column list that never includes `creator_notes` — Postgres/PostgREST upsert only sets columns present in the payload, so the `creator_notes` column added by this plan is automatically preserved across every future regenerate without touching `forge.ts` at all.
- The Anthropic tool schema (`anthropic.ts:24-49`) asks the model for `designRisks: string[]` — this plan does not change what's asked of the model, only wraps the validated response into `{risk, acknowledged: false}` objects before returning `SceneCardFields`.
- `SceneCard.tsx:42-45` renders a hardcoded, non-parameterized "Draft" pill with no `status` prop — this is the slot the new status control replaces.
- No file selects `status` from `scene_cards` on the read path (`scenes/[id].astro:44-49` omits it) — it's write-only today.

## What We're NOT Doing

- Character management (FR-009/010, roadmap `S-04`) — the "character function required if present" branch of the completeness rule is implemented generically but is currently untestable end-to-end since `characters` always resolves to `[]`.
- Project/scene browsing or listing (FR-005/006/013, roadmap `S-02`).
- Stale-card marking on scene-note edits (FR-021, roadmap `S-05`).
- Wiring the test suite into CI — still deferred per the standing manual-first MVP testing strategy.
- Provisioning a real `ANTHROPIC_API_KEY` in production — stays mock-only per `deploy-plan.md`. A direct consequence (see Critical Implementation Details) is that "Ready" is not reachable in production until that changes; this plan does not revisit that decision.
- A DB-level CHECK constraint validating the new `design_risks` object shape — validation lives in the new API route instead, consistent with how the rest of the schema relies on application-level checks beyond the plain status enum.
- Distinguishing "acknowledge" from "clear" as separate actions — both FR-022 verbs map to the same `acknowledged: true` state on a risk; a risk is never deleted from the array, only marked resolved.

## Implementation Approach

Three phases in dependency order: (1) the schema/type/rule foundation — migration, contract changes, and the pure completeness-rule function, unit-tested in isolation; (2) the update API route that enforces the rule server-side; (3) the editing UI, which reuses Phase 1's rule function directly on the client to drive the Ready-disable behavior rather than duplicating the logic.

## Critical Implementation Details

- **Upsert column omission preserves notes across regenerate**: `forge.ts`'s upsert payload must continue to omit `creator_notes`. Supabase's `.upsert(..., { onConflict: "scene_id" })` issues an `INSERT ... ON CONFLICT DO UPDATE SET <only the columns in the payload>` — a column left out of the payload is not touched on conflict, so `creator_notes` survives every regenerate without any code change to `forge.ts`. Do not "fix" this by adding `creator_notes` to the upsert payload; that would reintroduce the exact reset-on-regenerate bug this relies on avoiding.
- **The Anthropic tool contract is unchanged; only the post-validation shape changes**: `anthropic.ts`'s tool schema keeps asking for `designRisks: string[]` — do not change the tool's `input_schema`. The `{risk, acknowledged: false}` wrapping happens after `isSceneCardFields`-style validation of the raw tool response, immediately before returning `SceneCardFields`.
- **Ready is unreachable in production today, by design of an existing constraint, not a bug in this plan**: the mock generator (`mock.ts`) always returns `interactiveElement: NOT_ENOUGH_CONTEXT` and `requiredAssets: []`, and production has no `ANTHROPIC_API_KEY` per `deploy-plan.md`. Until a real key is provisioned, no scene can satisfy the completeness rule in production. This is an accepted consequence of the standing mock-only-production constraint from S-01, not something to work around here — verify the Ready-gate logic locally with a real key (Phase 2/3 manual verification), and expect the Ready pill to stay permanently disabled in production for now.

## Phase 1: Data Model, Type Contract & Readiness Rule

### Overview

Add the `notes` column and restructure `design_risks` into acknowledgment-aware objects, update the shared type contract and the Anthropic adapter to match, and implement the completeness rule as a pure, unit-tested function.

### Changes Required:

#### 1. Migration: notes column + design_risks backfill

**File**: `supabase/migrations/20260825120000_enforce_scene_readiness.sql`

**Intent**: Add the freeform notes column (FR-019) and convert existing `design_risks` rows from plain strings to `{risk, acknowledged}` objects so acknowledgment state (FR-022) has somewhere to live.

**Contract**: Additive `ALTER TABLE` (no RLS/GRANT changes needed — both already cover `scene_cards` UPDATE) plus a one-time data backfill:

```sql
-- named creator_notes, not notes, to avoid confusion with the pre-existing scenes.note column
alter table public.scene_cards
  add column creator_notes text not null default '';

update public.scene_cards
set design_risks = (
  select coalesce(jsonb_agg(jsonb_build_object('risk', risk_text, 'acknowledged', false)), '[]'::jsonb)
  from jsonb_array_elements_text(design_risks) as risk_text
)
where jsonb_typeof(design_risks) = 'array';
```

#### 2. Shared type contract

**File**: `src/lib/forge-scene/types.ts`

**Intent**: Introduce `SceneStatus` and `DesignRisk`, change `SceneCardFields.designRisks` to the structured shape, and add `SceneCardRecord` for the full persisted row (generation fields + `status` + `notes`) — keeping the pure generation contract (`SceneCardFields`) separate from the persisted-row shape that the update route and UI need.

**Contract**: `SceneStatus = "draft" | "needs_work" | "ready"`; `DesignRisk = { risk: string; acknowledged: boolean }`; `SceneCardFields.designRisks: DesignRisk[]`; `SceneCardRecord extends SceneCardFields { status: SceneStatus; notes: string }` — the TS field stays `notes` (scoped clearly under `SceneCardRecord`); it maps to the DB column `creator_notes`, the same snake_case↔camelCase convention already used for `player_goal`/`playerGoal` etc.

#### 3. Anthropic adapter: wrap raw risks into DesignRisk objects

**File**: `src/lib/forge-scene/anthropic.ts`

**Intent**: Keep the tool schema and prompt asking for plain risk strings (no LLM-facing change), but return `SceneCardFields` with `designRisks` as freshly-generated, unacknowledged objects.

**Contract**: Rename the current `isSceneCardFields` guard to validate the raw tool-output shape (still `designRisks: string[]`), then map to `DesignRisk[]` before returning:

```typescript
const raw = toolUse.input; // validated raw shape, designRisks: string[]
return {
  ...raw,
  designRisks: raw.designRisks.map((risk) => ({ risk, acknowledged: false })),
};
```

#### 4. Mock generator

**File**: `src/lib/forge-scene/mock.ts`

**Intent**: No behavioral change — `designRisks: []` already satisfies the new `DesignRisk[]` type trivially.

**Contract**: No code change required; confirm via `astro check` that the existing literal still type-checks against the updated `SceneCardFields`.

#### 5. Completeness rule

**File**: `src/lib/forge-scene/readiness.ts` (new)

**Intent**: The single, framework-agnostic implementation of FR-020's completeness rule, reused by both the update API route (server-side enforcement) and the editing UI (client-side Ready-disable) so the rule is defined exactly once.

**Contract**: `isReadyEligible(card: SceneCardFields): { eligible: boolean; missingReasons: string[] }`. Checks, reusing the existing `NOT_ENOUGH_CONTEXT` sentinel comparison convention from `mock.ts`/`SceneCard.tsx`: `playerGoal`, `obstacle`, and `interactiveElement` are each non-empty and not the sentinel; `requiredAssets.length > 0`; every entry in `characters` (when non-empty) has a `function` that is non-empty and not the sentinel; `designRisks` is empty or every entry has `acknowledged: true`. `missingReasons` names each unmet criterion in plain language for display in the API's error response and the UI's disabled-Ready tooltip.

#### 6. Readiness rule unit tests

**File**: `src/lib/forge-scene/readiness.test.ts` (new)

**Intent**: Cover the rule's branches directly, per the "unit-test the riskiest pure logic" convention established by `adapter.test.ts`.

**Contract**: Vitest suite covering: all criteria met → eligible; each individually-missing criterion → not eligible with the matching reason; empty `designRisks` → eligible; all risks acknowledged → eligible; one unacknowledged risk → not eligible; empty `characters` → character-function check vacuously passes; a populated `characters` entry with an empty/sentinel `function` → not eligible (exercises the branch ahead of `S-04` actually producing characters).

### Success Criteria:

#### Automated Verification:

- Migration applies cleanly: `supabase db reset`
- Unit tests pass: `npm run test`
- Linting passes: `npm run lint`
- Type/content checking passes: `npx astro check`
- Build succeeds: `npm run build`

#### Manual Verification:

- Supabase Studio (local, freshly reset) shows the new `creator_notes` column and confirms `design_risks` stores `{risk, acknowledged}` objects, not plain strings
- Forging a scene via the mock path (no `ANTHROPIC_API_KEY`) still produces `design_risks: []` and `notes` defaults to an empty string
- Set a `notes` value on an existing scene's card via Supabase Studio, then trigger a regenerate directly against the already-existing forge route (`curl -X POST http://localhost:4321/api/scenes/{id}/forge` with a valid session cookie, no UI needed since Phase 3 hasn't been built yet), and confirm in Studio that `notes` is unchanged afterward — verifies the upsert-preserves-omitted-columns assumption in Critical Implementation Details two phases before any UI is built on top of it

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before proceeding to the next phase.

---

## Phase 2: Card Update API Route

### Overview

A single PATCH route that lets the creator set status/notes/risk-acknowledgments in one request, re-validating the Ready-gate rule server-side regardless of what the client already checked.

### Changes Required:

#### 1. Card update route

**File**: `src/pages/api/scenes/[id]/card.ts` (new)

**Intent**: Authenticated, ownership-checked endpoint that persists the creator's edits and is the single source of truth for whether "Ready" is actually allowed.

**Contract**: `PATCH`, JSON body `{ status: SceneStatus; notes: string; designRisks: DesignRisk[] }`. Follows `forge.ts`'s existing conventions: `jsonResponse()` helper, `context.locals.user` check → 401, single ownership check via `.eq("scene_id", id).eq("user_id", user.id).single()` on `scene_cards` (fetching the full row, snake_case, needed both for the rule and the response: `player_goal, obstacle, characters, interactive_element, required_assets, status, creator_notes`) → 404 if missing. Maps the row to `SceneCardFields` shape (camelCase) before calling `isReadyEligible()` — same mapping already done in `scenes/[id].astro:51-59`, copy that pattern; the request body's `notes` field maps to the `creator_notes` column on write, same convention. Validates the body shape (400 on malformed `status`/`designRisks`). If `status === "ready"`, calls `isReadyEligible()` with the mapped row's generated fields plus the request body's `designRisks` (the client's just-toggled state); returns `400 { error, missing: string[] }` if not eligible. On success, `.update({ status, creator_notes: notes, design_risks: designRisks }).eq("scene_id", id).eq("user_id", user.id)` and returns `200` the full updated `SceneCardRecord` (the already-fetched generation fields merged with the just-applied `status`/`notes`/`designRisks`) — giving the client one authoritative shape to reconcile its state against, rather than an echo of just the three edited fields.

### Success Criteria:

#### Automated Verification:

- Linting passes: `npm run lint`
- Type/content checking passes: `npx astro check`
- Build succeeds: `npm run build`

#### Manual Verification:

- PATCHing status to `draft`/`needs_work` always succeeds regardless of completeness
- PATCHing status to `ready` when the completeness rule is unmet returns 400 with specific missing reasons
- PATCHing status to `ready` when the rule is met (tested with a real `ANTHROPIC_API_KEY` locally, per the mock-only-production limitation above) succeeds
- Signed-out or cross-user PATCH requests are rejected (401/404) without exposing data, matching the existing ownership-check convention

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before proceeding to the next phase.

---

## Phase 3: Card Editing UI

### Overview

Give the creator the status pills, notes textarea, and risk-acknowledgment checkboxes, wired to Phase 2's route, with the Ready pill disabled client-side using Phase 1's rule directly.

### Changes Required:

#### 1. Editable scene card

**File**: `src/components/scenes/SceneCard.tsx`

**Intent**: Replace the hardcoded "Draft" pill with a real, editable status control; render each design risk with an acknowledge checkbox instead of a plain bullet; add a notes textarea; add a single Save action that PATCHes Phase 2's route and reports the result back to the parent.

**Contract**: Props extended to `{ sceneId: string; record: SceneCardRecord; source: GenerationSource; onSaved: (record: SceneCardRecord) => void }` — `SceneCardRecord` (Phase 1) replaces the previous separate `card`/`status`/`notes` props, since it's exactly the persisted-row shape this component edits and Phase 2's route now returns. Local state holds a draft `SceneCardRecord` initialized from `record` (re-initialized when `record` changes, e.g. after a Regenerate). Three status pills (Draft/Needs Work/Ready); the Ready pill is `disabled` with a `title` tooltip listing `isReadyEligible(draftRecord).missingReasons` whenever the draft state doesn't satisfy the rule. Save button PATCHes `/api/scenes/${sceneId}/card`, calls `onSaved(updatedRecord)` with the route's response on success, shows an inline error (reusing `ServerError`) on failure.

#### 2. Forge button state threading

**File**: `src/components/scenes/ForgeSceneButton.tsx`

**Intent**: Carry `status`/`notes` alongside the existing `card`/`source` state so `SceneCard` has them to initialize from and update after a Save, and so a subsequent Regenerate call knows to reset status while keeping the last-saved notes.

**Contract**: `initialCard` prop replaced by `initialRecord?: SceneCardRecord | null`; `initialSource` prop unchanged (still separate from `SceneCardRecord`, which has no notion of generation source). The `success` state variant carries `record: SceneCardRecord` instead of separate `card`/`status`/`notes` fields, alongside the existing `source: GenerationSource`. On a successful `forge()` call (initial or Regenerate), build the new `record` by combining the fresh `card` from the forge response with `status: "draft"` (matching the existing hardcoded reset already done server-side) and the previous `record.notes` carried forward unchanged (never reset client-side, matching Phase 1's upsert-omission guarantee — the forge response itself doesn't include `notes`). `SceneCard`'s `onSaved(updatedRecord)` callback replaces this state wholesale with the route's authoritative response.

#### 3. Scene detail page

**File**: `src/pages/scenes/[id].astro`

**Intent**: Read the now-relevant `status`/`notes` columns and the restructured `design_risks`, passing them into the React island.

**Contract**: Extend the `scene_cards` select list to include `status, creator_notes`; update the local `SceneCardRow` interface's `design_risks` field type to `DesignRisk[]`; build `initialRecord: SceneCardRecord | null` by mapping the fetched row (same camelCase mapping already done for `initialCard` today) plus its `status` and `creator_notes` (mapped to the `notes` field), and pass it into `<ForgeSceneButton initialRecord={initialRecord} initialSource={initialSource} />` — `initialRecord` replaces the previous `initialCard` prop; `initialSource` is unchanged.

### Success Criteria:

#### Automated Verification:

- Unit tests still pass: `npm run test`
- Linting passes: `npm run lint`
- Type/content checking passes: `npx astro check`
- Build succeeds: `npm run build`

#### Manual Verification:

- With the mock path (no API key), the Ready pill is disabled with a tooltip explaining why — expected, per the mock-only-production limitation, not a bug
- With a real `ANTHROPIC_API_KEY` locally, once every criterion is satisfied and all design risks are acknowledged, the Ready pill becomes enabled and selectable, and saving persists it
- Acknowledging/un-acknowledging individual design risks toggles correctly and persists after Save
- The freeform notes field saves and persists across a page reload
- Regenerating a card resets status to Draft and clears all risk acknowledgments, but preserves previously saved notes
- A second test account cannot PATCH or view the first account's scene card

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful.

---

## Testing Strategy

### Unit Tests:

- `isReadyEligible()` branch coverage (see Phase 1, item 6) — the riskiest pure logic in this change, and the product's core differentiator per the roadmap.

### Integration Tests:

- None automated in this cycle — covered by the manual end-to-end steps below, per the PRD's manual-first MVP testing strategy (unchanged from S-01).

### Manual Testing Steps:

1. Reset the local DB, forge a scene via the mock path, confirm `notes` defaults empty and `design_risks` is `[]`.
2. Set `ANTHROPIC_API_KEY` locally, forge a new scene that produces at least one design risk; confirm the Ready pill is disabled with a tooltip naming the unmet criteria.
3. Acknowledge the risk(s), fill in notes, set status to Ready, Save; confirm it persists across a reload.
4. Regenerate the card; confirm status resets to Draft and the new risks are unacknowledged, but the notes text is unchanged.
5. Attempt to PATCH the card as a second test account; confirm it's rejected without exposing data.

## Performance Considerations

Single-row read + update against `scene_cards`, scoped by an indexed-by-default primary/unique key (`scene_id`); no new performance concerns beyond what Phase 1 of S-01 already established.

## Migration Notes

The backfill UPDATE in Phase 1's migration only rewrites rows where `design_risks` is still a plain-string array. Since production has never had `ANTHROPIC_API_KEY` provisioned (per `deploy-plan.md`), every existing production row's `design_risks` is already `[]` from the mock generator — the backfill is a no-op there and only matters for local/dev databases that were tested with a real key.

## References

- Research: `context/changes/enforce-scene-readiness/research.md`
- Roadmap slice: `context/foundation/roadmap.md` (S-03)
- PRD: `context/foundation/prd.md` (FR-018, FR-019, FR-020, FR-022, Business Logic section)
- Prior plan/decisions: `context/changes/first-forged-scene-card/plan.md` (schema, adapter, ownership-check conventions), `context/changes/first-forged-scene-card/reviews/plan-review.md` (F4 — why `design_risks` was left simple)
- Existing JSON-route convention: `src/pages/api/scenes/[id]/forge.ts:1-108`

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles. See `references/progress-format.md`.

### Phase 1: Data Model, Type Contract & Readiness Rule

#### Automated

- [x] 1.1 Migration applies cleanly: `supabase db reset` — 40c8564
- [x] 1.2 Unit tests pass: `npm run test` — 40c8564
- [x] 1.3 Linting passes: `npm run lint` — 40c8564
- [x] 1.4 Type/content checking passes: `npx astro check` — 40c8564
- [x] 1.5 Build succeeds: `npm run build` — 40c8564

#### Manual

- [x] 1.6 Supabase Studio shows the new `creator_notes` column and `design_risks` stored as `{risk, acknowledged}` objects — 40c8564
- [x] 1.7 Mock-path forge still produces `design_risks: []` and `notes` defaults empty — 40c8564
- [x] 1.8 A `notes` value survives a regenerate triggered directly against the existing forge route (curl), confirming the upsert-preserves-omitted-columns assumption early — 40c8564

### Phase 2: Card Update API Route

#### Automated

- [x] 2.1 Linting passes: `npm run lint`
- [x] 2.2 Type/content checking passes: `npx astro check`
- [x] 2.3 Build succeeds: `npm run build`

#### Manual

- [x] 2.4 PATCH to `draft`/`needs_work` always succeeds
- [x] 2.5 PATCH to `ready` when the rule is unmet returns 400 with missing reasons
- [x] 2.6 PATCH to `ready` when the rule is met (real API key) succeeds
- [x] 2.7 Signed-out/cross-user PATCH is rejected without exposing data

### Phase 3: Card Editing UI

#### Automated

- [ ] 3.1 Unit tests still pass: `npm run test`
- [ ] 3.2 Linting passes: `npm run lint`
- [ ] 3.3 Type/content checking passes: `npx astro check`
- [ ] 3.4 Build succeeds: `npm run build`

#### Manual

- [ ] 3.5 Mock path: Ready pill disabled with an explanatory tooltip
- [ ] 3.6 Real key + all criteria met: Ready pill enabled and savable
- [ ] 3.7 Acknowledging/un-acknowledging risks toggles and persists
- [ ] 3.8 Notes field saves and persists across reload
- [ ] 3.9 Regenerate resets status/acknowledgments but preserves notes
- [ ] 3.10 Second test account cannot PATCH or view the first account's card
