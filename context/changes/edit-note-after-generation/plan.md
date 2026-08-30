# Edit Scene Note After Generation Implementation Plan

## Overview

Implement FR-021: let a creator edit the raw scene note (`scenes.note`) after saving it — before or after Forge Scene has run. If a scene card already exists and the note changes, the card must be visibly marked stale and the creator must be blocked from setting it to "Ready" until they regenerate.

## Current State Analysis

- `scenes.note` (`supabase/migrations/20260802120000_create_scene_forge_core.sql:16`) is rendered as static, non-editable text on the scene detail page (`src/pages/scenes/[id].astro:79`). No route exists to edit it.
- `scene_cards` (same migration, lines 21-36) has `generated_at` (set on every Forge Scene run, `src/pages/api/scenes/[id]/forge.ts:99`) and `status` as a closed enum (`draft | needs_work | ready`, line 25). There is no "stale" column, flag, or concept anywhere in the schema, types, or code (confirmed empty grep for `stale`).
- `enforce-scene-readiness` (S-03, just shipped) built the card-editing surface: `PATCH /api/scenes/[id]/card.ts` (status/notes/design-risk-acknowledgment) and the shared pure function `isReadyEligible()` (`src/lib/forge-scene/readiness.ts`), consumed both server-side (`card.ts:94`) and client-side (`SceneCard.tsx:60`). Its plan-brief explicitly deferred "stale-card marking on note edits" to this change.
- `forge.ts`'s `scene_cards` upsert (`forge.ts:87-103`) omits `creator_notes` from its payload, so that column survives untouched across regenerations by Postgres/PostgREST upsert semantics. Any new column added to that same upsert must be listed explicitly or it will inherit the same "survives untouched" behavior.
- Per `context/foundation/lessons.md`, a `timestamptz ... default now()` column (e.g. `updated_at`) only auto-populates on INSERT — every `.update()`/`.upsert()` call that should bump it must set it explicitly. `card.ts:114` already does this correctly for `scene_cards.updated_at`; `scenes.updated_at` has never been explicitly written by any route because no update route for `scenes` has existed until now.

### Key Discoveries:

- No new migration is required. Staleness is derived by comparing two already-existing timestamps: `scenes.updated_at` (bumped explicitly by the new note-edit route) vs. `scene_cards.generated_at` (bumped by every Forge Scene run). A card is stale iff `scenes.updated_at > scene_cards.generated_at`.
- The scene detail page (`scenes/[id].astro`) currently selects only `id, title, note` from `scenes` (line 22) and a fixed field list from `scene_cards` that excludes `generated_at` (line 49) — both selects need one more column added.
- `ForgeSceneButton` (`src/components/scenes/ForgeSceneButton.tsx`) and the note display live in the same Astro page but are separate concerns; the note will become its own React island (`NoteEditor`), a sibling of `ForgeSceneButton`, not a merge into its existing idle/loading/success/error state machine — avoids adding regression risk to code just reviewed in S-03.
- Only the scene detail page currently renders a scene card at all (S-02 browsing doesn't exist yet), so the stale banner and Ready-block only need to be wired into `SceneCard.tsx` — no other surface currently shows scene status.

## Desired End State

A creator can edit a scene's note at any time from the scene detail page via an always-visible textarea with an explicit Save button (same pattern as `SceneCard`'s `creator_notes` field). If no card exists yet, this is the only effect. If a card already exists, saving the note immediately (without a page reload) marks the card stale in the UI: a banner appears on the card, and the "Ready" status pill becomes disabled with a tooltip explaining the note has changed. The block is also enforced server-side. Regenerating the card (existing "Regenerate" button) clears staleness, since the new `generated_at` postdates the note edit.

**Verification**: create a scene, forge a card, set it to a state that would otherwise be Ready-eligible, edit the note, confirm the card shows stale + Ready is disabled with the reason, then regenerate and confirm staleness clears and Ready becomes reachable again (subject to the existing completeness rule).

## What We're NOT Doing

- Not editing the scene title — FR-021 scopes only "the raw scene note."
- Not adding a new DB column/migration for staleness — derived from existing timestamps.
- Not locking or disabling the existing status/creator-notes/risk-acknowledgment controls while stale — only "Ready" is blocked (per FR-020's rule remaining otherwise unaffected).
- Not building any scene-list/browsing surface (S-02) or character context (S-04) — out of scope for this slice.
- Not adding autosave, debounce, or draft-recovery for the note editor — matches the app's one established editing convention (explicit Save, no autosave anywhere).
- Not wiring CI test execution or provisioning a production Anthropic key — unchanged from prior slices' scope notes.

## Implementation Approach

Two phases: first make the note editable in isolation (new route + new component, no staleness logic yet), then layer in staleness detection, server-side Ready enforcement, and the live cross-island UI sync. This keeps phase 1 independently manually verifiable (note editing works, persists, validates) before introducing the more subtle timestamp-comparison and cross-component-sync logic in phase 2.

Staleness derivation is implemented as a new shared pure function, `isCardStale()`, mirroring the `isReadyEligible()` convention: defined once in `src/lib/forge-scene/`, unit-tested, and called from both the two server-side render/enforcement points (the `.astro` page for initial display, `card.ts`'s PATCH route for the Ready block). The client never needs to call it directly — see Critical Implementation Details below for how the two React islands stay in sync without lifting timestamps between them.

## Critical Implementation Details

**Cross-island staleness sync**: `NoteEditor` and `ForgeSceneButton` are separate React islands mounted independently in `scenes/[id].astro`; there is no shared state/context between them today. Rather than lifting `scenes.updated_at`/`scene_cards.generated_at` timestamps across islands, `NoteEditor` dispatches a plain `window` `CustomEvent` (e.g. `"sceneforge:note-updated"`) on a successful save, with no payload needed. `ForgeSceneButton` adds a listener: if it is currently in `phase: "success"`, it flips its local `isStale` flag to `true`. This works because any note save necessarily happens after the card's existing `generated_at` — the card is unconditionally now stale relative to the just-saved note, so no timestamp math is needed at the point of the event. `ForgeSceneButton`'s own successful regenerate (`forge()`) resets `isStale` to `false` in the new success state, since the freshly-set `generated_at` now postdates the note. If no card exists yet (`ForgeSceneButton` is in `phase: "idle"`), the event is a no-op — there's nothing to mark stale.

**Initial-render staleness must still use real timestamps**: the live event-based sync above is a same-session shortcut (a save always postdates the currently-loaded `generated_at`), but the *initial* page render has no such guarantee — the note or card could have been touched in a previous session. `scenes/[id].astro` and `card.ts` must both call `isCardStale(sceneUpdatedAt, cardGeneratedAt)` with real timestamp strings, not assume the shortcut.

## Phase 1: Edit the Scene Note

### Overview

Adds the ability to edit and save a scene's note, independent of any staleness logic. A card, if present, is completely unaffected by this phase.

### Changes Required:

#### 1. Note update API route

**File**: `src/pages/api/scenes/[id]/note.ts` (new)

**Intent**: A `PATCH` endpoint that updates `scenes.note` for the scene owned by the authenticated user, rejecting an empty/whitespace-only note and explicitly bumping `scenes.updated_at`.

**Contract**: Mirrors `src/pages/api/scenes/[id]/card.ts`'s conventions exactly: `context.locals.user` → 401 if absent; `createClient()` → 500 if unconfigured; parse-and-validate JSON body `{ note: string }` → 400 on malformed/empty body; ownership-scoped `.eq("id", id).eq("user_id", user.id)` update, `.update({ note, updated_at: new Date().toISOString() })`; 404 if no matching row; 200 with the updated `{ note, updatedAt }` on success. Empty/whitespace-only `note` (after `.trim()`) is rejected with 400, matching `scenes.note`'s `not null` constraint and its required-at-creation status.

#### 2. Note editor component

**File**: `src/components/scenes/NoteEditor.tsx` (new)

**Intent**: An always-editable textarea (no read/edit mode toggle) with an explicit Save button, matching `SceneCard`'s `creator_notes` field pattern (`SceneCard.tsx:180-191`) and the app's no-autosave convention. Validates non-empty before submitting (client-side, mirroring `NewSceneForm.tsx:18-24`'s inline-error pattern), calls the new `PATCH` route, and on success dispatches the `"sceneforge:note-updated"` window event described in Critical Implementation Details (this dispatch is inert until Phase 2 gives `ForgeSceneButton` a listener).

**Contract**: `Props: { sceneId: string; initialNote: string }`. Internal state: `note`, `saving`, `error`. On successful save, updates local `note` state from the response and shows a brief inline confirmation (or simply clears any error) — no `onSaved` callback needed since no sibling currently needs the new note text itself, only the "something changed" signal.

#### 3. Wire into the scene detail page

**File**: `src/pages/scenes/[id].astro`

**Intent**: Replace the static note paragraph with the new editable component.

**Contract**: Replace line 79 (`<p class="whitespace-pre-wrap ...">{scene.note}</p>`) with `<NoteEditor sceneId={scene.id} initialNote={scene.note} client:load />`, importing it alongside the existing `ForgeSceneButton` import.

### Success Criteria:

#### Automated Verification:

- Type checking passes: `npm run astro check` (or `npx astro check`)
- Linting passes: `npm run lint`

#### Manual Verification:

- On a scene with no card yet, the note can be edited and saved; reloading the page shows the saved text.
- On a scene with an existing card, editing and saving the note does not error and does not disturb the card's displayed fields.
- Saving an empty or whitespace-only note is rejected with a visible inline error; the previous note text is preserved (never lost).

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before proceeding to the next phase.

---

## Phase 2: Stale Detection, Ready-Gate Enforcement, and Live Sync

### Overview

Adds the shared staleness rule, blocks "Ready" while stale (server + client), displays a stale banner on the card, and wires the live cross-island event so staleness appears immediately after a note save without a page reload.

### Changes Required:

#### 1. Shared staleness function

**File**: `src/lib/forge-scene/staleness.ts` (new)

**Intent**: A single pure function defining "is this card stale relative to this scene's note," mirroring the `isReadyEligible()` convention (`readiness.ts`) so the rule is defined exactly once and is independently testable.

**Contract**: `isCardStale(sceneUpdatedAt: string, cardGeneratedAt: string): boolean`, returning `new Date(sceneUpdatedAt).getTime() > new Date(cardGeneratedAt).getTime()`.

#### 2. Unit tests

**File**: `src/lib/forge-scene/staleness.test.ts` (new)

**Intent**: Cover the three real states a card moves through: freshly generated (not stale), note edited after generation (stale), regenerated after that edit (not stale again). Mirrors `readiness.test.ts`'s `describe`/`it` structure using `vitest`.

**Contract**: Test cases for `cardGeneratedAt` after `sceneUpdatedAt` (not stale), before it (stale), and equal (not stale — a card generated in the same instant as the note is not considered stale, `>` not `>=`).

#### 3. Initial render staleness

**File**: `src/pages/scenes/[id].astro`

**Intent**: Compute whether the existing card is stale at request time and pass it down as a prop, so the first paint is already correct without waiting on any client-side event.

**Contract**: Add `updated_at` to the `scenes` select (line 22) and `generated_at` to the `scene_cards` select (line 49). Compute `const initialIsStale = sceneCard ? isCardStale(scene.updated_at, sceneCard.generated_at) : false;` and pass `initialIsStale={initialIsStale}` to `ForgeSceneButton`.

#### 4. Server-side Ready-gate enforcement

**File**: `src/pages/api/scenes/[id]/card.ts`

**Intent**: Reject a `PATCH` requesting `status: "ready"` when the card is stale, alongside the existing `isReadyEligible()` check, so the block can't be bypassed by calling the API directly.

**Contract**: Fetch `updated_at` alongside the existing `scenes` lookup this route doesn't currently perform — add a `.from("scenes").select("updated_at").eq("id", id).eq("user_id", user.id).single()` query (the route already has `id` = scene id from its route param). When `body.status === "ready"`, additionally check `isCardStale(scene.updated_at, <card's generated_at>)` — this requires also selecting `generated_at` in the existing `scene_cards` select (line 80) — and if stale, return 400 with `missing: [...missingReasons, "Scene note has changed since this card was generated"]` (reuse the existing error-response shape at lines 103-105).

#### 5. Client-side staleness state and live sync

**File**: `src/components/scenes/ForgeSceneButton.tsx`

**Intent**: Track staleness as part of the component's own state (initialized from the server-computed prop), reset it on a successful regenerate, and flip it to `true` when notified that the note was saved.

**Contract**: Add `initialIsStale?: boolean` to `Props`. Add `isStale: boolean` to the `"success"` state variant. Initialize from `initialIsStale` in the initial `useState`. In `forge()`'s success branch, set `isStale: false` on the new success state (a regenerate always resolves staleness). Add a `useEffect` that adds a `window` listener for `"sceneforge:note-updated"`; the handler uses a functional state update that, only when `prev.phase === "success"`, returns `{ ...prev, isStale: true }` (otherwise returns `prev` unchanged). Pass `isStale={state.isStale}` down to `SceneCard`.

#### 6. Stale banner and Ready-pill block

**File**: `src/components/scenes/SceneCard.tsx`

**Intent**: Surface staleness visibly and fold it into the existing Ready-eligibility check so the pill is disabled for the same reason the server would reject it.

**Contract**: Add `isStale: boolean` to `Props`. Combine into the existing `disabled`/`title` logic for the `"ready"` status option (lines 100-108): `disabled` becomes `option.value === "ready" && (!eligible || isStale)`; the tooltip's `missingReasons` gets `"Scene note has changed since this card was generated"` appended when `isStale`. Render a banner above the status pills row (matching the card's existing amber/warning-style conventions, or a simple bordered notice consistent with `ServerError`'s visual weight) when `isStale`, with a short message pointing at the existing "Regenerate" action.

### Success Criteria:

#### Automated Verification:

- Unit tests pass: `npm run test` (includes the new `staleness.test.ts`)
- Type checking passes: `npm run astro check`
- Linting passes: `npm run lint`

#### Manual Verification:

- Forge a card on a scene, set a status, then edit and save the note without reloading the page: the card immediately shows a stale banner and the Ready pill becomes disabled with a tooltip mentioning the note change.
- Attempting the equivalent `PATCH /api/scenes/[id]/card` with `status: "ready"` directly (e.g. via curl/devtools) while stale is rejected with a 400 and the note-changed reason.
- Reloading the page after a note edit (no regenerate) still shows the card as stale — confirms the server-computed initial state matches the live-synced state.
- Clicking "Regenerate" on a stale card clears the stale banner and re-enables Ready (subject to the existing completeness rule).

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before proceeding to the next phase.

---

## Testing Strategy

### Unit Tests:

- `isCardStale()`: not-stale-when-fresh, stale-when-note-newer, not-stale-when-regenerated-after-edit, boundary case (equal timestamps → not stale).

### Integration Tests:

- None planned — matches the project's manual-first MVP testing strategy (per PRD and prior slices' precedent); the riskiest logic (`isCardStale`) is covered by unit tests instead.

### Manual Testing Steps:

1. Create a scene with no card; edit and save its note; reload and confirm persistence.
2. Forge a card; edit the note; confirm the card marks itself stale live, without reloading.
3. Try to set the stale card to "Ready" via the UI (pill disabled) and via a direct API call (400 rejected).
4. Regenerate the stale card; confirm staleness clears and Ready becomes reachable again once the completeness rule is met.
5. Save an empty note; confirm it's rejected and the prior note text is untouched.

## Performance Considerations

None beyond the existing NFR (sub-2s for save actions) — a single-row update and a same-request timestamp comparison, no new queries of consequence.

## Migration Notes

No schema migration required — staleness is derived from two pre-existing columns (`scenes.updated_at`, `scene_cards.generated_at`).

## References

- Prior deferral: `context/changes/enforce-scene-readiness/plan-brief.md` (Out of scope: "stale-card marking on note edits (S-05)")
- Prior deferral: `context/changes/first-forged-scene-card/plan.md:36` ("Editing a scene note after generation or stale-card marking (FR-021) — that's S-05")
- Shared pure-function precedent: `src/lib/forge-scene/readiness.ts`, `src/lib/forge-scene/readiness.test.ts`
- PATCH-route precedent: `src/pages/api/scenes/[id]/card.ts`
- `updated_at`-needs-explicit-write lesson: `context/foundation/lessons.md`

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles. See `references/progress-format.md`.

### Phase 1: Edit the Scene Note

#### Automated

- [x] 1.1 Type checking passes: `npm run astro check`
- [x] 1.2 Linting passes: `npm run lint`

#### Manual

- [x] 1.3 Note can be edited and saved on a scene with no card yet; persists across reload
- [x] 1.4 Editing and saving the note on a scene with an existing card doesn't error or disturb the card
- [x] 1.5 Empty/whitespace-only note is rejected with a visible error; prior note preserved

### Phase 2: Stale Detection, Ready-Gate Enforcement, and Live Sync

#### Automated

- [ ] 2.1 Unit tests pass: `npm run test`
- [ ] 2.2 Type checking passes: `npm run astro check`
- [ ] 2.3 Linting passes: `npm run lint`

#### Manual

- [ ] 2.4 Editing and saving the note on a scene with a card immediately shows a stale banner and disables Ready, live (no reload)
- [ ] 2.5 Direct `PATCH .../card` with `status: "ready"` while stale is rejected with 400 and the note-changed reason
- [ ] 2.6 Reloading after a note edit (no regenerate) still shows the card as stale
- [ ] 2.7 Regenerating a stale card clears staleness and re-enables Ready (subject to the completeness rule)
