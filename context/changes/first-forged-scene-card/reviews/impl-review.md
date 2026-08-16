<!-- IMPL-REVIEW-REPORT -->
# Implementation Review: Forge Scene: First Scene Card Implementation Plan

- **Plan**: context/changes/first-forged-scene-card/plan.md
- **Scope**: Phase 1-3 of 3 (full plan review)
- **Date**: 2026-08-16
- **Verdict**: APPROVED
- **Findings**: [0 critical] [1 warning] [3 observations]

## Verdicts

| Dimension | Verdict |
|-----------|---------|
| Plan Adherence | PASS |
| Scope Discipline | PASS |
| Safety & Quality | WARNING |
| Architecture | PASS |
| Pattern Consistency | PASS |
| Success Criteria | PASS |

## Findings

### F1 — Migration shipped 11 days without table-level grants

- **Severity**: WARNING
- **Impact**: LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Safety & Quality
- **Location**: supabase/migrations/20260802120000_create_scene_forge_core.sql (Aug 2) / supabase/migrations/20260813210000_grant_scene_forge_core_privileges.sql (Aug 13)
- **Detail**: The core schema migration enabled RLS and created owner policies but never granted table-level DML privileges (`select, insert, update, delete`) to `authenticated`. Postgres denies access at the privilege layer regardless of RLS, so every query against `projects`/`scenes`/`scene_cards` would have failed with "permission denied for table" from Aug 2 until the follow-up grant migration on Aug 13 (change.md's Phase 2 runtime-fixes note documents this was caught during manual verification). Current state is correct: the Aug 13 migration grants exactly `select, insert, update, delete` to `authenticated` only, no `anon` grant — matches the isolation requirement. No code action needed now; this is a process gap worth recording so it doesn't recur on the next new-table migration.
- **Fix**: Record via `/10x-lesson`: "A migration that creates a new table and enables RLS must also GRANT table privileges to `authenticated` in the same migration — RLS alone does not grant access; Postgres checks privileges before RLS is ever evaluated."
- **Decision**: ACCEPTED-AS-RULE: "New tables need an explicit GRANT alongside RLS" (context/foundation/lessons.md)

### F2 — `adapter.ts` introduces the codebase's first `console.log`/`console.error` calls

- **Severity**: OBSERVATION
- **Impact**: LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Pattern Consistency
- **Location**: src/lib/forge-scene/adapter.ts:25,29,32,35
- **Detail**: No other file in `src/` logs anything — every other route/handler (signin.ts, signup.ts, projects/create.ts, scenes/create.ts, forge.ts) reports failures purely via redirects or JSON error bodies. This is not undocumented drift: the plan's Phase 1 item 6 explicitly specifies "Logs (via `console.log`/`console.error`, per the chosen lightweight-observability approach) which branch was taken, and the outcome" — so the implementation is plan-compliant. Flagging only because it's now the sole precedent for logging in the repo, and `eslint.config.js` has `no-console: warn` project-wide, so the next module that wants to log will either need to follow this precedent or diverge again.
- **Fix**: No change needed — matches the plan. Optionally record the console.log/console.error shape as the project's lightweight-observability convention (e.g. via `/10x-lesson`) so future modules are consistent with it rather than reinventing logging.
- **Decision**: SKIPPED

### F3 — Tooling-deviation note describes suppression mechanism differently than implemented

- **Severity**: OBSERVATION
- **Impact**: LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Plan Adherence
- **Location**: context/changes/first-forged-scene-card/change.md ("Phase 2 tooling deviations" note) vs. src/pages/api/projects/create.ts:30-36, src/pages/api/scenes/create.ts:35-53, src/pages/scenes/[id].astro:27-29, src/pages/projects/[projectId]/scenes/new.astro:27-29, src/pages/api/scenes/[id]/forge.ts:48-65
- **Detail**: change.md's Phase 2 note describes the `no-unnecessary-condition` fix as a "scoped disable" without specifying mechanism. The actual implementation uses inline `eslint-disable`/`eslint-enable` (or `eslint-disable-next-line`) comments around each Supabase null-check, file by file — not an `eslint.config.js`-level rule block. Functionally this is the narrower of the two possible mechanisms (per-line vs. per-file-type), so it satisfies the intent, but the record and the code don't describe the same mechanism.
- **Fix**: Update the change.md note to say "inline eslint-disable/eslint-enable comments around each Supabase null-check" instead of implying an `eslint.config.js`-level scoped block. Text-only, no code change.
- **Decision**: DISMISSED — false positive. change.md line 91 already correctly describes this as inline `eslint-disable`/`eslint-enable` around each guard, matching the code exactly. The apparent mismatch was an artifact of how this reviewer summarized the two tooling items to the sub-agent (conflating both as `eslint.config.js`-level), not an actual documentation error.

### F4 — Anthropic SDK error text forwarded verbatim to the client

- **Severity**: OBSERVATION
- **Impact**: LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Safety & Quality
- **Location**: src/lib/forge-scene/anthropic.ts:88-91, src/pages/api/scenes/[id]/forge.ts:83
- **Detail**: `ForgeSceneGenerationError` wraps `error.message` from the Anthropic SDK, and `forge.ts` returns it directly to the browser (`jsonResponse({ error: error.message }, 502)`). Anthropic SDK errors don't typically embed the API key, so this isn't an active leak, and it matches the existing project convention of surfacing Supabase error messages the same way in `projects/create.ts`/`scenes/create.ts` — so it's consistent with established practice, not a new deviation.
- **Fix**: No action needed now. General note for the future: don't assume third-party error strings are always safe to show end users verbatim.
- **Decision**: SKIPPED

## Supporting detail

**Plan drift check (19/19 planned items, all 3 phases)**: every planned file/contract MATCHed the actual implementation — schema/RLS shape, `ANTHROPIC_API_KEY` env registration, `SceneCardFields`/`ForgeSceneInput` types, mock generator determinism, Anthropic adapter's forced tool-use + typed errors, adapter branch selection + logging, adapter test coverage, vitest setup, both form flows, both creation API routes (including the critical `user_id`-from-session-not-parent-row detail), scene detail page ownership guard, dashboard entry point, `PROTECTED_ROUTES` extension, forge API route (never touches `scenes.note`), button state machine with manual-only retry, card display, and the wire-in with Regenerate. All previously-approved deviations (eslint tooling changes, the grants migration, `.env.example` doc, the Prettier-only formatting fix, and `adapter.ts` taking the API key as a parameter instead of reading `astro:env/server` internally) were independently verified to match their change.md descriptions, apart from F3 above.

**Safety/quality/pattern sweep**: no CRITICAL findings. RLS is correctly enabled with `user_id = auth.uid()` on `USING`/`WITH CHECK` for all three tables; grants are scoped to `authenticated` only; every API route and page double-checks ownership via `.eq("user_id", user.id)` before acting and degrades cross-user access to a plain "Not found" rather than leaking existence or data; Anthropic tool-use is correctly forced (not free-text parsed) with response-shape validation; no XSS sinks introduced (no `dangerouslySetInnerHTML`/`set:html`); the "scene note is never lost" guarantee holds across every code path in `forge.ts`, including failure and concurrent-regenerate cases (worst case is a stale `scene_cards` row, never note loss). New components follow existing form/validation/styling conventions closely.

**Automated verification (re-run 2026-08-16)**:
- `npm run test` — 7/7 passed
- `npx astro check` — 0 errors, 0 warnings, 4 pre-existing hints (unrelated deprecation notices in eslint.config.js)
- `npm run build` — succeeds
- `npm run lint` — 894 errors, all `prettier/prettier` CRLF-deletion errors on files this feature never touched (confirmed via targeted grep across all 14 feature source files — zero hits). Matches change.md's already-documented pre-existing repo-wide CRLF condition (recorded as ~1023 errors on the untouched repo before Phase 1 began). Not a regression introduced by this feature; not re-flagged as a new finding.

**Manual verification**: all Progress rows (1.6-1.7, 2.4-2.7, 3.5-3.9) are checked `[x]` with commit SHAs, and change.md's dated notes give specific, non-rubber-stamped evidence for each — e.g. the second-test-account cross-user checks name the exact routes tried and the exact response received, the CSRF/auth-redirect distinction on unauthenticated POST is called out explicitly, and the Phase 3 error-recovery check names the exact failure mode (invalid key -> 401) and recovery path tested.
