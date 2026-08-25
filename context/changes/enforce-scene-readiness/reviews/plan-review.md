<!-- PLAN-REVIEW-REPORT -->
# Plan Review: Enforce Scene Readiness Implementation Plan

- **Plan**: context/changes/enforce-scene-readiness/plan.md
- **Mode**: Deep
- **Date**: 2026-08-25
- **Verdict**: REVISE (pre-triage) → SOUND (post-triage — see Progress note below)
- **Findings**: [0 critical] [2 warnings] [3 observations]

## Verdicts (pre-triage)

| Dimension | Verdict |
|-----------|---------|
| End-State Alignment | PASS |
| Lean Execution | WARNING |
| Architectural Fitness | PASS |
| Blind Spots | WARNING |
| Plan Completeness | WARNING |

**Post-triage**: F1, F2, F3, F5 fixed in `plan.md`; F4 accepted as a documented, low-impact risk. No outstanding unresolved findings remain.

## Grounding

8/8 paths ✓, 3/3 symbols ✓, brief↔plan ✓. `docs/reference/contract-surfaces.md` does not exist — that check was skipped.

## Findings

### F1 — Notes-preservation-on-regenerate is verified only in the last manual step of the last phase

- **Severity**: ⚠️ WARNING
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Blind Spots
- **Location**: Critical Implementation Details / Phase 1
- **Detail**: The plan states with high confidence that Supabase's upsert in `forge.ts` leaves `notes` untouched on regenerate because it's omitted from the payload, and explicitly warns not to "fix" this. Verification against the installed `@supabase/postgrest-js@2.105.3` source confirms the JS client sends `Prefer: resolution=merge-duplicates` with no `columns` param for a single-object upsert — consistent with the plan's claim — but the actual column-scoped `DO UPDATE SET` translation happens server-side in PostgREST, which isn't vendored in this repo and couldn't be verified from source. The plan's only test of this exact behavior is manual step 3.9, the last item of the last phase — if the assumption is wrong, it's discovered after all UI work is built on top of it, and no phase currently touches `forge.ts` as a fallback.
- **Fix A ⭐ Recommended**: Add an early, UI-independent check in Phase 1 or 2
  - Strength: Via Supabase Studio, set a `notes` value on an existing row, then `curl -X POST /api/scenes/{id}/forge` (the route already exists from S-01), and confirm `notes` survived. Catches a load-bearing assumption two phases before any UI is built on it.
  - Tradeoff: One extra manual step; requires the forge route to already exist, which it does.
  - Confidence: HIGH — the route is already built and callable today.
  - Blind spot: Doesn't test the initial-migration-backfill interaction in a fully fresh environment; 1.6/1.7/3.9 still cover that.
- **Fix B**: Accept current sequencing, verify only at 3.9
  - Strength: No plan change; this is well-documented, widely-relied-upon PostgREST behavior.
  - Tradeoff: If wrong, discovered late, forcing rework of `forge.ts` plus Phase 3's state-threading logic.
  - Confidence: MEDIUM — standard behavior, but "low probability, real rework cost if wrong" is exactly what a cheap early check is for.
  - Blind spot: None significant.
- **Decision**: FIXED (via Fix A) — added manual verification item 1.8 to Phase 1: preserves-notes-across-regenerate is now checked via curl against the existing forge route, two phases before Phase 3's UI is built.

### F2 — `SceneCardRecord` type is introduced but never consumed

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Lean Execution
- **Location**: Phase 1, item 2 (Shared type contract)
- **Detail**: Phase 1 adds `SceneCardRecord extends SceneCardFields { status; notes }` as "the persisted-row shape the update route and UI need." But Phase 2's route Contract spells out `{ status, notes, designRisks }` as a bare object, not `SceneCardRecord`; Phase 3's `SceneCard` props and the `SceneCardRow` interface in `[id].astro` likewise spell out individual fields. Nothing in Phases 2–3 actually imports or uses `SceneCardRecord` — removing it would not change the achievable end state.
- **Fix**: Either wire `SceneCardRecord` in as the actual type for the PATCH body and `SceneCard`'s bundled props (reduces repetition across three contracts), or drop it from Phase 1 and keep the individual-field style consistently. Either is fine — just pick one so the type isn't dead on arrival.
- **Decision**: FIXED — wired `SceneCardRecord` in as `SceneCard`'s props shape, `ForgeSceneButton`'s success-state/prop shape, and the PATCH route's response shape across Phases 2–3.

### F3 — New column name `notes` is easily confused with the existing `scenes.note`

- **Severity**: 👁 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Plan Completeness
- **Location**: Phase 1, item 1 (Migration)
- **Detail**: `scenes.note` (singular, the original scene description) and the new `scene_cards.notes` (plural, the creator's freeform corrections field) are on different tables and functionally unrelated, but the near-identical name is a real source of confusion in future grep/code-review (confirmed via a repo-wide sweep — no current collision, but worth heading off).
- **Fix**: Either rename the new column to something more distinct (e.g. `creator_notes`) or add an explicit one-line comment in the migration distinguishing it from `scenes.note`.
- **Decision**: FIXED — renamed the DB column to `creator_notes` throughout the plan (migration, Phase 2 route, Phase 3 select list); the TS field on `SceneCardRecord` stays `notes`, mapped the same way `player_goal`↔`playerGoal` already is.

### F4 — No defense against a multi-tab Save/Regenerate race

- **Severity**: 👁 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Blind Spots
- **Location**: Phase 2 / Phase 3
- **Detail**: The PATCH route and `forge.ts` both write to `scene_cards` with no version/timestamp check. Within a single tab this is structurally prevented — `ForgeSceneButton` unmounts `SceneCard` (and its Save button) during the "loading" phase of a regenerate — but two browser tabs open on the same scene could still race. Consistent with the rest of the app having no multi-tab protection anywhere else either.
- **Fix**: No action needed for this MVP; note as an accepted risk if it ever becomes a real multi-tab usage pattern.
- **Decision**: ACCEPTED — no plan change; revisit if multi-tab usage becomes a real pattern.

### F5 — snake_case→camelCase mapping for the readiness check isn't stated in Phase 2's contract

- **Severity**: 👁 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Plan Completeness
- **Location**: Phase 2, item 1
- **Detail**: `isReadyEligible(card: SceneCardFields)` expects camelCase fields, but the ownership-check query returns snake_case columns (`player_goal`, `interactive_element`, ...). The route's Contract doesn't explicitly call out the mapping step, though the exact same mapping already exists as a precedent in `scenes/[id].astro:51-59`.
- **Fix**: Add one sentence to Phase 2's Contract noting the row must be mapped to `SceneCardFields` shape before calling `isReadyEligible()`, pointing at the existing mapping in `[id].astro` as the pattern to copy.
- **Decision**: FIXED — resolved as a side effect of F3's fix; Phase 2's Contract now explicitly states the mapping step and points at `[id].astro:51-59` as the pattern to copy.
