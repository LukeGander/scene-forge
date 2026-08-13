<!-- PLAN-REVIEW-REPORT -->
# Plan Review: Forge Scene: First Scene Card Implementation Plan

- **Plan**: context/changes/first-forged-scene-card/plan.md
- **Mode**: Deep
- **Date**: 2026-08-02
- **Verdict**: REVISE (all findings fixed during triage — plan is now SOUND)
- **Findings**: 1 critical, 2 warnings, 1 observation

## Verdicts

| Dimension | Verdict |
|-----------|---------|
| End-State Alignment | PASS |
| Lean Execution | WARNING |
| Architectural Fitness | PASS |
| Blind Spots | FAIL |
| Plan Completeness | WARNING |

## Grounding

Grounding: 7/7 paths ✓, 2/2 symbols ✓, brief↔plan ✓

## Findings

### F1 — New pages and API routes are unauthenticated-accessible

- **Severity**: ❌ CRITICAL
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Blind Spots
- **Location**: Phase 2 & 3 — all new pages and API routes
- **Detail**: `src/middleware.ts:4`'s `PROTECTED_ROUTES = ["/dashboard"]` is the only auth guard in the codebase (confirmed via sub-agent sweep — no page/layout/component does an independent check). None of the plan's new pages (`projects/new.astro`, `projects/[projectId]/scenes/new.astro`, `scenes/[id].astro`) or API routes (`api/projects/create.ts`, `api/scenes/create.ts`, `api/scenes/[id]/forge.ts`) were covered, missing the PRD's Access Control requirement.
- **Fix**: Add a Phase 2 change entry for `src/middleware.ts` extending `PROTECTED_ROUTES` to `/projects`, `/scenes`, `/api/projects`, `/api/scenes`; new API routes replicate the existing `if (!supabase)` config-missing guard.
- **Decision**: FIXED — added Phase 2 item 7 (route protection), updated items 2/4 (config-missing guard) and Phase 3 item 1's contract, added a Phase 2 manual verification bullet (2.7) and matching Progress entry.

### F2 — Anthropic prompt content and "not enough context" semantics are unspecified

- **Severity**: ⚠️ WARNING
- **Impact**: 🔬 HIGH — architectural stakes; think carefully before deciding
- **Dimension**: Blind Spots
- **Location**: Phase 1 — item 5, Anthropic generator
- **Detail**: Forced tool-use only guarantees the JSON parses, not that the model evaluates the note against the required scene anatomy or uses "not enough context" instead of guessing — the roadmap's own highest-uncertainty risk was left unaddressed by the plan.
- **Fix A ⭐ Recommended**: Add a short prompt-content note to Phase 1 item 5's Contract naming the required anatomy fields and the "not enough context" convention as mandatory prompt content.
  - Strength: Closes the gap without over-specifying wording, consistent with the plan's own "intent not implementation" principle.
  - Tradeoff: Still leaves exact prompt wording to the implementer.
  - Confidence: HIGH — documentation gap, not a design disagreement.
  - Blind spot: Actual card-acceptance quality still can't be verified until Phase 3 is manually exercised.
- **Fix B**: Leave as-is, trust the implementer to derive prompt content from the PRD.
- **Decision**: FIXED via Fix A — added the anatomy/"not enough context" requirement to Phase 1 item 5's Contract.

### F3 — Vitest path-alias resolution isn't addressed

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Plan Completeness
- **Location**: Phase 1 — item 8, Test runner setup
- **Detail**: No `vitest.config.ts` exists yet; Vitest doesn't read `tsconfig.json` paths automatically, so adapter test imports via `@/lib/forge-scene/types` would fail to resolve without explicit alias wiring — Phase 1's own `npm run test` success criterion couldn't pass as specified.
- **Fix**: Add to item 8's Contract that `vitest.config.ts` must include the `vite-tsconfig-paths` plugin or an explicit `resolve.alias` entry for `@`.
- **Decision**: FIXED — added to item 8's Contract.

### F4 — Schema pre-builds an S-03 field ahead of need

- **Severity**: 💡 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Lean Execution
- **Location**: Phase 1 — item 1, `scene_cards.design_risks`
- **Detail**: `DesignRisk { risk: string; acknowledged: boolean }` bakes in FR-022's (S-03, out of scope) acknowledge/clear mechanism, which this slice never sets or reads.
- **Fix**: Either drop `acknowledged` now (S-03 adds it via its own migration) or keep it with a scope note — judgment call.
- **Decision**: FIXED — dropped `acknowledged`; `designRisks` simplified to `string[]`; added a one-line scope note to "What We're NOT Doing".
