<!-- IMPL-REVIEW-REPORT -->
# Implementation Review: API Ownership & Authorization Coverage

- **Plan**: context/changes/testing-api-ownership-authorization/plan.md
- **Scope**: Phase 1-3 of 3 (full plan)
- **Date**: 2026-09-03
- **Verdict**: APPROVED
- **Findings**: 0 critical, 1 warning, 3 observations

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

### F1 — Auth fixture swallows signup/signin failures, and the local rate-limit budget is tight for this suite

- **Severity**: ⚠️ WARNING
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Safety & Quality
- **Location**: src/lib/test-support/auth-fixture.ts:29-43
- **Detail**: `createTestUser` doesn't check the signup or signin response for errors/non-redirect status before extracting the cookie. A failure silently produces an empty-string cookie, which `apiFetch` (line 58, `if (cookie)`) then treats as "no Cookie header" — an anonymous request. Downstream tests expecting an authenticated 200/302 instead see 401/302 and fail with no indication the root cause was in the fixture. Separately: this suite already issues ~36 signup+signin requests in one run (18 `createTestUser` calls × 2 requests), against `supabase/config.toml:190`'s `sign_in_sign_ups = 30` (per 5 minutes, per IP) local rate limit — already at/near the ceiling before more route tests are added in future rollout phases.
- **Fix A ⭐ Recommended**: Add fail-fast checks to `createTestUser` only (defer the rate-limit question)
  - Strength: Directly fixes the confusing-failure-mode problem with a small, narrowly-scoped change to one file; matches the fail-fast pattern already used in the `createProject`/`createScene` test helpers.
  - Tradeoff: Doesn't address the rate-limit headroom — a future phase adding more route tests could still hit the 30/5min ceiling.
  - Confidence: HIGH — the fix is mechanical (check the signin response is a non-error redirect, throw a descriptive `Error` otherwise).
  - Blind spot: Haven't measured actual request timing or whether Supabase's rate-limit window resets fast enough between local test runs to avoid ever tripping it in practice.
- **Fix B**: Add fail-fast checks AND raise `supabase/config.toml`'s `sign_in_sign_ups` now
  - Strength: Closes both problems in one pass, ahead of Phase 4 (CI wiring) or future rollout phases adding more auth-fixture-based tests.
  - Tradeoff: Touches project-wide Supabase config (not scoped to this change's test files) — an infra decision arguably outside a test-authoring phase's remit; the plan's "What We're NOT Doing" scoped this phase to test-writing only.
  - Confidence: MEDIUM — raising the limit is a one-line config change, but its downstream implications weren't fully audited here.
  - Blind spot: Unclear whether this local-only config value has any bearing on other environments.
- **Decision**: FIXED (via Fix A) — added fail-fast redirect-target checks after both signup and signin in `createTestUser`, throwing a descriptive `Error` on unexpected redirects.

### F2 — createProject/createScene helpers duplicated verbatim across 4 test files

- **Severity**: 🔵 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Pattern Consistency
- **Location**: src/pages/api/scenes/create.test.ts:4-15 (identical copies in card.test.ts, forge.test.ts, note.test.ts)
- **Detail**: Both helpers are copy-pasted identically across 4 spec files; a future change to the create-project/create-scene response contract requires editing every copy in sync. (This duplication was a deliberate scope call during planning — Phase 1's fixture was scoped to auth only — but is worth revisiting now that the pattern has been copied 4 times.)
- **Fix**: Extract both helpers into a shared module (e.g. `src/lib/test-support/scene-fixtures.ts`, alongside `auth-fixture.ts`) and import from all 4 spec files.
- **Decision**: FIXED — extracted to `src/lib/test-support/scene-fixtures.ts`; all 4 spec files now import `createProject`/`createScene` from there.

### F3 — Unauthenticated-request tests in forge.test.ts/note.test.ts seed real fixtures they don't need

- **Severity**: 🔵 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Safety & Quality
- **Location**: src/pages/api/scenes/[id]/forge.test.ts:31-40, src/pages/api/scenes/[id]/note.test.ts:31-44
- **Detail**: Both routes check `context.locals.user` before ever reading the `id` param (`forge.ts:32-35`, `note.ts:28-31`), so the unauthenticated case would 401 identically against any placeholder scene id. Creating a real owner+project+scene first adds unnecessary Supabase writes/HTTP round-trips per run, compounding F1's rate-limit exposure.
- **Fix**: Use a literal placeholder id (e.g. `"nonexistent"`) for the unauthenticated-request case in both files instead of seeding real data.
- **Decision**: FIXED (fix differently) — used a syntactically valid but non-existent UUID (`00000000-0000-0000-0000-000000000000`) rather than a non-UUID placeholder string, so the test stays robust if the route later adds param-format validation. Removed the now-unused fixture creation in both unauthenticated-request cases.

### F4 — forge.test.ts's mock-path assertion depends on an environment precondition the test doesn't document

- **Severity**: 🔵 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Safety & Quality
- **Location**: src/pages/api/scenes/[id]/forge.test.ts:64
- **Detail**: `expect(body.source).toBe("mock")` is correct only when the dev server under test has no real `ANTHROPIC_API_KEY` configured (per `adapter.ts`). If a contributor runs this suite against a dev server started without the `.env.test`/`--mode test` override (documented in `test-plan.md` §6.1, but not enforced by the test itself), this assertion fails **and** makes a real, billed Anthropic call — exactly the failure mode encountered during this change's own implementation.
- **Fix**: Add a one-line comment above the assertion noting the environment precondition and pointing to `test-plan.md` §6.1.
- **Decision**: FIXED — added a comment above `expect(body.source).toBe("mock")` pointing to the §6.1 precondition.
