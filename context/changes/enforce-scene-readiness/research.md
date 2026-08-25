---
date: 2026-08-25T20:38:03+02:00
researcher: Claude Sonnet 5
git_commit: d013ee008c3d6b22ca8c1c99eba51ecf5ec2953f
branch: main
repository: scene-forge
topic: "enforce-scene-readiness (S-03): scene status, freeform notes, design-risk acknowledge/clear, Ready-gate rule"
tags: [research, codebase, scene-cards, rls, forge-scene, readiness-rule]
status: complete
last_updated: 2026-08-25
last_updated_by: Claude Sonnet 5
---

# Research: enforce-scene-readiness (S-03)

**Date**: 2026-08-25T20:38:03+02:00
**Researcher**: Claude Sonnet 5
**Git Commit**: d013ee008c3d6b22ca8c1c99eba51ecf5ec2953f
**Branch**: main (1 commit ahead of `origin/main` at research time — this commit and the prior `93b2f9e`/`ac6979d` are course-material/handoff commits, not source changes)
**Repository**: scene-forge

## Research Question

What does the codebase already provide, and what is genuinely missing, to implement roadmap slice **S-03 / `enforce-scene-readiness`**: let the creator set a scene's status (Draft / Needs Work / Ready), add a freeform notes field, and acknowledge or clear generated design risks — with "Ready" blocked unless the completeness rule (player goal + obstacle + ≥1 interaction/puzzle + required assets + character function if characters present + no unresolved design risks) is satisfied? (FR-018, FR-019, FR-020, FR-022.)

## Summary

**Nothing that S-03 needs to build has been built yet — but the groundwork was deliberately shaped to make it buildable cleanly.**

- `scene_cards.status` already exists as a DB column (`text` with a CHECK constraint restricting it to `'draft' | 'needs_work' | 'ready'`), but no code reads it, no code lets a user set it, and the only writer (`forge.ts`) hardcodes it back to `"draft"` on every generate/regenerate.
- There is no freeform notes column on either `scenes` or `scene_cards` — `scenes.note` is the original scene description, already used elsewhere, and is not a substitute. A new column is required.
- `design_risks` is currently a flat `jsonb` array of plain strings (`string[]` in TS), with no id, no acknowledged flag, no cleared flag. This shape was **deliberately simplified during first-forged-scene-card's plan review** specifically so S-03 would design the acknowledge/clear structure itself, not inherit a half-built one.
- The completeness/"Ready" rule has zero implementation anywhere — no validation function, no DB trigger, no constraint beyond the plain enum CHECK on `status`. It must be written from scratch, likely as application-level validation in a new update route (a DB CHECK constraint can't easily express "no characters, or every character has a function" cross-field logic).
- No PATCH/PUT-style update route exists in `src/pages/api/` at all — only `POST` create routes and the `POST forge.ts` full-upsert route. A new update route is needed and has two established conventions to choose from (form-redirect vs. JSON-fetch), both well precedented.
- No `Select`/`RadioGroup`/dropdown UI primitive exists in the codebase (shadcn is configured but only `Button` and a generic badge have been pulled in) — a status selector will need a new shadcn primitive or a hand-rolled control.
- Ownership-check, RLS, and GRANT conventions from `first-forged-scene-card` are solid, already cover `scene_cards` UPDATE (RLS `for all` + existing GRANT), and should be followed as-is; no new GRANT migration is needed unless a new table is introduced.
- A real product/design question surfaces from this research and is **not yet resolved anywhere**: `forge.ts` unconditionally resets `status` to `"draft"` and overwrites `design_risks` wholesale on every regenerate — S-03's plan needs to decide whether regenerating a card should reset a user-set "Ready"/"Needs Work" status and clear any acknowledged risks, or preserve them.

## Detailed Findings

### Current schema — `scenes` and `scene_cards`

Both tables are defined in a single migration, `supabase/migrations/20260802120000_create_scene_forge_core.sql`, with GRANTs added later in `supabase/migrations/20260813210000_grant_scene_forge_core_privileges.sql`. No later migration touches either table.

- `scenes` (lines 11-19): `id`, `project_id`, `user_id`, `title`, `note`, `created_at`, `updated_at`. **No status column, no notes/corrections column.** `note` is the original freeform scene description supplied by the creator before generation — not available as a post-generation notes field.
- `scene_cards` (lines 21-36): `id`, `scene_id` (unique — strict 1:1 with `scenes`), `user_id`, **`status text not null default 'draft' check (status in ('draft','needs_work','ready'))`**, `player_goal`, `obstacle`, `characters jsonb`, `interactive_element`, `required_assets jsonb`, **`design_risks jsonb not null default '[]'::jsonb`**, `generation_source`, `generated_at`, `created_at`, `updated_at`.
- No trigger anywhere auto-bumps `updated_at` on UPDATE — any new update path must set it explicitly.
- RLS (migration lines 38-47): `for all using (user_id = auth.uid()) with check (user_id = auth.uid())` on all three tables — a single owner policy that already covers UPDATE, no new policy needed.
- GRANTs (second migration, all 3 lines): `select, insert, update, delete` already granted to `authenticated` on `scene_cards` (and `scenes`, `projects`) — **UPDATE is already permitted**; no new GRANT migration required unless S-03 adds a new table.
- No `Database` generated-types file exists — all call sites hand-declare row shapes via `.single<RowType>()` casts (established convention to follow, not a gap to fix).

### `SceneCardFields` TypeScript contract — `src/lib/forge-scene/types.ts`

```ts
export interface CharacterMention { name: string; function: string; }
export interface SceneCardFields {
  playerGoal: string;
  obstacle: string;
  characters: CharacterMention[]; // empty = "none / not applicable" for this slice
  interactiveElement: string;
  requiredAssets: string[]; // empty renders as "not enough context"
  designRisks: string[]; // acknowledge/clear (FR-022) is out of scope — added by S-03
}
```

- No `status` field exists on this type at all, even though the DB column exists — status is handled entirely outside the generation contract.
- `designRisks: string[]` — flat strings, **not** structured objects. The inline comment is an explicit, intentional marker that S-03 owns extending this.
- `mock.ts` always returns `designRisks: []`; the Anthropic tool schema (`anthropic.ts:45,47`) requires `designRisks` as a plain string array — any shape change here has to stay compatible with what the LLM is asked to produce (or be handled as a separate acknowledgment layer that doesn't change what the LLM outputs).

### The one existing write path and its interaction with S-03 — `src/pages/api/scenes/[id]/forge.ts`

- Line ~90: every forge/regenerate call `.upsert(..., { onConflict: "scene_id" })`s a **hardcoded `status: "draft"`**, and line ~96 overwrites `design_risks` wholesale from the fresh generation. There is no logic anywhere that preserves a previously user-set status or a previously acknowledged/cleared risk across a regenerate.
- This is a **genuine open design decision for the S-03 plan**, not something the codebase already answers: should "Regenerate" reset status to Draft and clear acknowledgments (safe default — a new generation may have changed the anatomy), or attempt to preserve them? The PRD doesn't address this directly; FR-021's "stale card" mechanism (S-05, not S-03) is the closest analogous precedent but is scoped to the *note* changing, not to regeneration with an unchanged note.
- Ownership-check pattern used here (fetch row filtered by `id` + `user_id`, 404 via `jsonResponse` if missing) is the established idiom a new update route should reuse — but forge.ts's two-hop ownership chain (scene → project) is unnecessary for S-03, which only needs a single `scene_cards`-or-`scenes` ownership check.
- `.upsert()` is used here because every NOT NULL column needs a value; a true partial update (status/notes/risk-acknowledge) should use `.update({...}).eq("scene_id", id).eq("user_id", user.id)` instead, to avoid having to resupply all the generated fields.

### Scene card UI — `src/pages/scenes/[id].astro`, `ForgeSceneButton.tsx`, `SceneCard.tsx`

- `[id].astro`'s `scene_cards` select list does **not** include `status` — it's write-only in the app today, never read back.
- `SceneCard.tsx` renders a **hardcoded, non-functional** status pill: literal text `"Draft"` inside a `rounded-full bg-purple-500/20 ... text-purple-200` span, with no `status` prop on the component at all. This is the visual slot to replace with a real, parameterized status control.
- `design_risks` is rendered via the same generic `ListValue` bullet-list helper used for "Required Assets" — no visual distinction, no checkbox, no acknowledge/dismiss affordance of any kind.
- No freeform-notes textarea or display exists anywhere in the scene-card UI. `scene.note` (rendered in `[id].astro`) is the original note, already serving a different purpose.
- `ForgeSceneButton.tsx` owns the only client-side state machine in this area (`idle | loading | success | error`) and would need direct changes (or an adjacent sibling component) to host status-setting/notes/risk UI, since it currently only renders `<SceneCard>` and a "Regenerate" button.

### API route conventions available to reuse

Two established patterns, both viable for the new update route depending on whether it's a form submit or a fetch call:

1. **Form-POST + redirect** (`projects/create.ts`, `scenes/create.ts`): read `formData()`, ownership-check the parent row explicitly (never trust a client-supplied id, even though RLS would also catch it), redirect with `?error=` on failure, redirect to the resource page on success.
2. **JSON POST** (`scenes/[id]/forge.ts`): `jsonResponse()` helper, `context.params.id`, same explicit ownership check, JSON error/success bodies.

Neither pattern currently exists as PATCH/PUT — both create/forge routes are POST. A new status/notes/risk-acknowledge update route has no existing precedent to copy verbatim, only these two adjacent shapes to adapt.

Both patterns share a recurring `no-unnecessary-condition` ESLint false-positive on Supabase's `.single()`/`.maybeSingle()` null-checks, suppressed via scoped inline `eslint-disable`/`eslint-enable` comments with a rationale — not a config-level override. Any new route hitting the same pattern should follow this convention, not add a new global override.

### UI primitives — none exist for a status selector

- `src/components/ui/` currently holds only `button.tsx` (shadcn) and `LibBadge.astro` (a generic, unrelated pill used for library-version tags on the marketing page).
- No `Select`, `RadioGroup`, or dropdown primitive exists anywhere in `src/`. `components.json` is configured for shadcn ("new-york" style, `@/components/ui` alias) and the needed radix/cva/tailwind-merge dependencies are already installed — pulling in `npx shadcn add select` (or `radio-group`) would match existing convention, but nothing has been added yet.
- All existing form inputs are plain `<input>`/`<textarea>` via `FormField.tsx` or inline — no precedent for a constrained-choice control.

### Binding conventions from `first-forged-scene-card` (must carry forward)

- **Ownership**: `user_id` denormalized onto every table; every write copies `user_id` from the authenticated session, never derived from a parent row; every route/page re-checks ownership explicitly (`.eq("user_id", user.id)`) even where RLS would also block it, and degrades cross-user access to a plain 404/"Not found" with zero data leak.
- **GRANT-alongside-RLS lesson** (`context/foundation/lessons.md`): any *new table* created with RLS must GRANT DML to `authenticated` in the same migration. Not triggered by S-03 unless a new table is introduced — the existing GRANT already covers `scene_cards` UPDATE.
- **Testing**: unit-test only the riskiest logic (there was none to unit test before beyond the LLM adapter); everything else manual-first per the PRD's stated MVP testing strategy. CI still runs lint+build only, no test step wired in.
- **Logging**: the only precedent is lightweight `console.log`/`console.error` in the adapter; `no-console` is `warn` project-wide.
- **`.astro` ESLint exception**: `no-misused-promises` is off for `.astro` files repo-wide (parser crash workaround for top-level `return` in frontmatter) — already covers any new `.astro` page using the redirect/404-guard idiom.
- **Navigation**: any new page should include `<Topbar />`, per the Phase 3 consistency fix.
- Production stays mock-only for `ANTHROPIC_API_KEY` (free-tier constraint) — irrelevant to S-03 unless it touches the adapter, which it shouldn't.

### FR wording and Business Logic (verbatim, `context/foundation/prd.md`)

> **FR-018**: Creator can set a scene's status (Draft / Needs Work / Ready). Priority: must-have
>
> **FR-019**: Creator can add a freeform notes/corrections field to a generated scene card. Priority: must-have. *Known limitation: creator cannot fix specific generated fields directly. Accepted for MVP.*
>
> **FR-020**: Status "Ready" can only be set when player goal + obstacle + at least one interaction/puzzle element + required assets + no critical logic gaps are all present; if characters are present in the scene, their defined function in the scene is additionally required. Priority: must-have
>
> **FR-022**: Creator can acknowledge or clear generated design risks on a scene card, making the "no unresolved design risks" condition for Ready status actionable. Priority: must-have. *Note: "no critical logic gaps" is assessed during Forge Scene and surfaced as design risks in the card; the product prevents setting "Ready" if the design-risks field is non-empty and unacknowledged.*

Business Logic (`prd.md:122-126`):

> A scene can reach "Ready" status only when it has a clearly defined player goal, an obstacle, at least one interaction or puzzle element, a list of required assets, defined character functions (when characters are present in the scene), and no unresolved design risks. [...] **"No unresolved design risks" means the design-risks field is empty or has been explicitly cleared by the creator — it is never a silent pass.**

Note the terminology bridge: FR-020 says "no critical logic gaps"; FR-022 and the Business Logic paragraph clarify this is the *same concept* as "unresolved design risks" — logic gaps are what Forge Scene surfaces into the `design_risks` field. The completeness rule should therefore be implemented as a single check against `design_risks` (empty-or-all-acknowledged), not as a separate "logic gaps" signal.

## Code References

- `supabase/migrations/20260802120000_create_scene_forge_core.sql:11-47` — `scenes`/`scene_cards` schema, RLS policies
- `supabase/migrations/20260813210000_grant_scene_forge_core_privileges.sql` — existing GRANTs (already cover UPDATE)
- `src/lib/forge-scene/types.ts:1-21` — `SceneCardFields`, `CharacterMention`, the `designRisks` deferred-to-S-03 comment
- `src/lib/forge-scene/mock.ts` — mock generator, always returns `designRisks: []`
- `src/lib/forge-scene/anthropic.ts:45,47,71` — Anthropic tool schema and type guard for `designRisks`
- `src/pages/api/scenes/[id]/forge.ts` — sole writer of `status`/`design_risks`; hardcodes `status: "draft"` on every upsert; ownership-check and `jsonResponse` conventions
- `src/pages/api/scenes/create.ts`, `src/pages/api/projects/create.ts` — form-POST + redirect convention, ownership-check idiom
- `src/pages/scenes/[id].astro` — scene-card read path (does not select `status`), page-level ownership guard, `<Topbar />` usage
- `src/components/scenes/SceneCard.tsx` — hardcoded "Draft" badge (no `status` prop), `ListValue`/`Field` rendering helpers, design-risks bullet list with no acknowledge affordance
- `src/components/scenes/ForgeSceneButton.tsx` — client state machine, POST to `forge.ts`, Regenerate button
- `src/components/ui/button.tsx`, `src/components/ui/LibBadge.astro`, `components.json` — only existing shadcn/badge primitives; no Select/RadioGroup yet
- `eslint.config.js:36,70` and the four scoped inline-disable sites — conventions for async-handler and Supabase-null-check lint exceptions
- `context/foundation/lessons.md:12-17` — GRANT-alongside-RLS rule
- `context/foundation/prd.md:107-126` — FR-018/019/020/022 and Business Logic
- `context/changes/first-forged-scene-card/plan.md:31-38,96,143` — "What We're NOT Doing" (explicitly hands off status/Ready-gate/design-risk-acknowledgment to S-03), current `design_risks jsonb` schema, type-contract comment
- `context/changes/first-forged-scene-card/reviews/plan-review.md` (F4) — rejection of the pre-built `DesignRisk { risk, acknowledged }` structured type; confirms `design_risks` was deliberately kept as `string[]` for S-03 to design
- `context/changes/first-forged-scene-card/reviews/impl-review.md` (F1, F2, F4) — GRANT lesson origin, logging precedent, error-message-forwarding convention

## Architecture Insights

- The codebase deliberately shipped `design_risks` as the *simplest possible* shape (`string[]`) rather than guessing at S-03's acknowledge/clear structure — this was an explicit plan-review decision, not an oversight. S-03's plan has real design latitude here (e.g., restructure to `{ text, acknowledged }` objects with a data migration/backfill for existing rows, vs. a parallel `acknowledged_design_risks jsonb` tracking column that leaves `design_risks` untouched).
- `status` living on `scene_cards` (not `scenes`) is consistent with the 1:1 relationship and means the whole feature is scoped to a single table — no cross-table transaction needed for the update.
- The RLS-and-GRANT layering (privileges checked before RLS) is now a codified project lesson; S-03 doesn't need a new migration for GRANTs since UPDATE is already granted, only if it needs a genuinely new table.
- No DB-level enforcement mechanism exists for the completeness rule, and a DB CHECK constraint is a poor fit for it anyway (it needs conditional logic based on whether characters are present, and needs to inspect a JSON array's contents) — this points toward application-level validation in the update route as the natural implementation, consistent with how the rest of the app validates (form/route-level checks, not DB constraints, aside from the plain status-enum CHECK).
- The `forge.ts` reset-on-regenerate behavior is a latent design gap that predates S-03 but S-03 is the first feature that makes it visible/consequential (status and acknowledgments now have state worth preserving). This should be called out explicitly in the plan, not silently inherited.

## Historical Context (from prior changes)

- `context/changes/first-forged-scene-card/plan.md` — the only prior change. Its "What We're NOT Doing" section names S-03 three separate times as the owner of status/Ready-gate/design-risk-acknowledgment, confirming this was planned scope-splitting, not scope creep discovered late.
- `context/changes/first-forged-scene-card/reviews/plan-review.md` (F4) — the specific decision that simplified `design_risks` away from a structured, acknowledgment-ready shape, explicitly deferring that design to S-03.
- `context/changes/first-forged-scene-card/reviews/impl-review.md` — confirms the ownership/RLS/error-handling conventions above are not just planned but implemented-and-verified as of the Aug 16 review (APPROVED, 0 critical findings).
- `context/foundation/lessons.md` — one directly applicable lesson (GRANT-alongside-RLS); no lesson yet exists about the logging convention or error-message-forwarding, though both were surfaced as low-impact observations in the impl review.

## Related Research

None — this is the first `research.md` in the repository (`first-forged-scene-card` did not use `/10x-research`; it went straight from plan-brief to plan).

## Open Questions

1. **Design-risk acknowledge/clear data shape**: restructure `design_risks` into objects with an acknowledged flag (requires a migration + backfill of existing rows, and keeping the LLM's output shape compatible), or add a separate tracking column/table that references risk text/index without changing what the LLM produces? Both are viable; the plan should pick one and state why.
2. **Regenerate-vs-preserve-state**: should running "Regenerate" on a card that's already Ready/Needs Work reset status to Draft and clear acknowledgments (since the anatomy may have changed), or attempt to preserve them? Not addressed by the PRD or prior plan. Needs a product decision before the update route's write semantics can be finalized.
3. **Status selector UI**: pull in a shadcn `Select`/`RadioGroup` primitive (matches `components.json` convention, adds a new dependency surface) vs. a minimal hand-rolled control (three buttons/pills) consistent with the existing hardcoded-badge visual. Either is consistent with project conventions; worth deciding before implementation rather than during.
4. **Notes column naming/placement**: a new `scene_cards` column (e.g. `notes text default ''`) is the obvious fit given the 1:1 relationship and that the field is described in the PRD as belonging to "a generated scene card" — but this should be confirmed against the plan rather than assumed here.
5. Characters (S-04) aren't built yet, so the "character function required if characters present" branch of the completeness rule is currently untestable end-to-end (`characters` will always be empty). The rule should still be implemented generically (not hardcoded to "always satisfied"), so it activates correctly once S-04 ships.
