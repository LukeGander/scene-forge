<!-- IMPL-REVIEW-REPORT -->
# Implementation Review: Enforce Scene Readiness Implementation Plan

- **Plan**: context/changes/enforce-scene-readiness/plan.md
- **Scope**: Phase 1-3 of 3 (full plan)
- **Date**: 2026-08-27
- **Verdict**: APPROVED
- **Findings**: 0 critical, 2 warnings, 3 observations

## Verdicts

| Dimension | Verdict |
|-----------|---------|
| Plan Adherence | PASS |
| Scope Discipline | WARNING |
| Safety & Quality | WARNING |
| Architecture | PASS |
| Pattern Consistency | PASS |
| Success Criteria | PASS |

## Evidence

- **Plan drift sub-agent**: all 10 planned files (migration, types.ts, anthropic.ts, mock.ts, readiness.ts, readiness.test.ts, card.ts, SceneCard.tsx, ForgeSceneButton.tsx, [id].astro) MATCH the plan's stated contract exactly. Zero DRIFT, zero MISSING.
- **Safety/quality/pattern sub-agent**: no CRITICAL findings. Auth (401) and ownership (`user_id` scoping) verified sound on every touched route, including after the `middleware.ts` fix. No hardcoded secrets, no injection vectors, no N+1/pagination issues.
- **Automated verification (re-run for this review)**: `npm run test` — 17/17 pass. `npx astro check` — 0 errors. `npm run build` — succeeds. `npm run lint` (full repo) — 893 pre-existing CRLF errors (`core.autocrlf`, documented in lessons.md), confirmed zero errors on every file this change touched when linted individually during implementation.
- `supabase db reset` was not re-run for this review (would destroy local manual-testing data); no schema changes occurred after Phase 1, where it was already verified.
- Manual verification rows (1.6-1.8, 2.4-2.7, 3.5-3.10) all carry commit SHAs and match real evidence gathered during implementation, including a real bug (the middleware signed-out-redirect issue) caught and fixed live during Phase 2 manual testing — a positive signal against rubber-stamping.

## Findings

### F1 — Unplanned scope not reflected in plan.md

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Scope Discipline
- **Location**: astro.config.mjs, .env.example, src/lib/forge-scene/{anthropic.ts,adapter.ts,adapter.test.ts}, src/pages/api/scenes/[id]/forge.ts, src/middleware.ts
- **Detail**: Two clusters of work landed during Phase 2 at explicit user request — threading `ANTHROPIC_WORKSPACE_ID` through to the Anthropic client as an `anthropic-workspace-id` header, and fixing `middleware.ts` so `/api/*` returns 401 JSON instead of redirecting signed-out requests to the sign-in page — neither of which appears anywhere in plan.md's "Changes Required" sections. Both were correctly implemented, curl-verified, and committed with clear messages; this is a documentation-completeness gap in the plan, not an implementation defect.
- **Fix**: Append a short "Addendum" note to plan.md (e.g. under Phase 2) documenting these two changes and why they were made, so the plan stays an accurate source of truth for future readers and `/10x-archive`.
- **Decision**: FIXED — added an "## Addendum (raised mid-Phase-2, not in original scope)" section to plan.md documenting both changes.

### F2 — forge.ts's upsert still omits `updated_at` (lessons.md rule violation, missed while the file was already touched)

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Safety & Quality
- **Location**: src/pages/api/scenes/[id]/forge.ts:86-101
- **Detail**: The accepted lessons.md rule ("updated_at needs an explicit trigger or write") was recorded specifically because of this gap and predicted "the upcoming Phase 2 PATCH route will hit the same gap." `card.ts` correctly sets `updated_at` on its own `.update()`. `forge.ts`'s upsert — touched again in this very change for the workspace-id addition — still doesn't, so every regenerate still leaves `updated_at` frozen at row-creation time.
- **Fix**: Add `updated_at: new Date().toISOString()` to `forge.ts`'s upsert payload, matching `card.ts`'s convention.
- **Decision**: FIXED — added `updated_at: new Date().toISOString()` to forge.ts's upsert payload (line 100). Verified with `npx eslint` and `npx astro check` (0 errors).

### F3 — Migration backfill doesn't reconcile pre-existing 'ready' rows (theoretical, unreachable in this codebase's history)

- **Severity**: OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Safety & Quality
- **Location**: supabase/migrations/20260825120000_enforce_scene_readiness.sql:5-10
- **Detail**: The backfill converts `design_risks` strings to `{risk, acknowledged: false}` but doesn't touch `status`. Verified unreachable in practice: before this migration, the only writer of `scene_cards.status` was `forge.ts`'s upsert, hardcoded to `"draft"` — no code path ever set `status` to `"ready"` prior to this change's migration/PATCH route shipping together, so no row could have been `"ready"` with risks that just got silently reset. Recorded for the audit trail, not because it's an active risk.
- **Fix**: None required. Optionally add a one-line SQL comment noting this invariant for future readers.
- **Decision**: SKIPPED — no active risk.

### F4 — readiness.ts's character check covers `function` but not `name`

- **Severity**: OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Plan Adherence (forward-looking)
- **Location**: src/lib/forge-scene/readiness.ts:24
- **Detail**: Matches the plan's literal contract exactly (only `function` was specified). Since `characters` always resolves to `[]` in this slice (S-04 not yet built), this is untestable today.
- **Fix**: None required now; revisit when S-04 introduces real characters with potentially-sentinel names.
- **Decision**: SKIPPED — untestable until S-04 exists.

### F5 — Duplicated "not enough context" comparison logic

- **Severity**: OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Pattern Consistency
- **Location**: src/components/scenes/SceneCard.tsx:29 vs src/lib/forge-scene/readiness.ts:5
- **Detail**: `FieldValue`'s emptiness check is case-insensitive (`value.trim().toLowerCase() === NOT_ENOUGH_CONTEXT`) while `isMeaningful` does an exact match. Harmless today since the sentinel is always lowercase at the source, but the two checks aren't sharing one implementation.
- **Fix**: None required now; consolidate into one shared helper if either check's semantics change.
- **Decision**: SKIPPED — harmless duplication.
