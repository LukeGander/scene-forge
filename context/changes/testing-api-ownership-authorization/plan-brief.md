# API Ownership & Authorization Coverage — Plan Brief

> Full plan: `context/changes/testing-api-ownership-authorization/plan.md`
> Research: `context/changes/testing-api-ownership-authorization/research.md`

## What & Why

`test-plan.md` §3 Phase 1 requires proving that no API route lets one creator touch another's data (risk #1 — data isolation is the PRD's top guardrail, currently zero automated coverage). We're building a two-user integration test suite that hits all 5 mutating routes with real authenticated Supabase users against a local instance.

## Starting Point

Every route already enforces ownership correctly (RLS + app-level `.eq("user_id", ...)`, consistent 404-always shape) — this is a proving task, not a bug fix. But zero test infrastructure exists for HTTP/Supabase-backed tests; only 3 pure-function unit tests exist today. Research also surfaced a real, still-live inconsistency: `projects/create.ts`/`scenes/create.ts` reject unauthenticated requests via a 302 redirect, while `card.ts`/`forge.ts`/`note.ts` return 401 JSON — confirmed by reading the route source directly during planning.

## Desired End State

`npm run test` (with `supabase start` + `npm run dev` running) exercises all 5 routes with two real users and passes, proving cross-user access is blocked everywhere and each route's unauthenticated-guard behaves as it does today. `test-plan.md` §6.1 documents the pattern for the next contributor adding a similar test.

## Key Decisions Made

| Decision | Choice | Why (1 sentence) | Source |
|---|---|---|---|
| Test user & data seeding | Real signup/signin flow only, no service-role client | Matches the project's own zero-service-role convention; tests exercise the exact auth path production uses | Plan (user-confirmed) |
| Mismatched-`user_id` negative test | Skip this phase | No clean seeding path without new infra (service-role client); avoid adding infra for one edge case | Plan (user-confirmed) |
| Unauthenticated-request coverage | Every one of the 5 mutating routes | Cheap per-route, and directly re-verifies the exact regression (S-03) that shipped once already | Plan (user-confirmed) |
| Response-shape assertions | Status/ownership only; don't fix `scenes/create.ts`'s plain-text shape | Keeps Phase 1 a pure test-writing phase, not a routes refactor | Plan (user-confirmed) |
| Shared ownership-check helper | Leave production routes untouched | Matches Phase 1's "prove," not "refactor," goal; avoids scope creep | Plan (user-confirmed) |
| Test file organization | One spec file per route + a shared fixture helper module | Matches the existing 1:1 test-to-module convention (`readiness.test.ts`, etc.) while avoiding duplicated fixture logic | Plan (user-confirmed) |
| Test execution mode | Real HTTP against a running local dev server | `astro:env/server` doesn't resolve under plain Vitest, and it matches `test-plan.md`'s own locked stack decision | Research |
| Server/DB startup | Manual precondition (`supabase start` + `npm run dev`), not auto-orchestrated | No `wait-on`/`start-server-and-test` in the repo; matches the project's existing manual-dev-bring-up convention | Plan |

## Scope

**In scope:**
- Shared auth-fixture helper (`src/lib/test-support/auth-fixture.ts`) + its own smoke test
- 5 route-level integration test files (14 test cases total), each with an unauthenticated-guard case (route-specific shape) and a same-owner positive control; 4 of the 5 (`scenes/create`, `card`, `forge`, `note`) additionally cover a cross-user-404/redirect case — `projects/create` has no existing-resource ownership dimension to test
- `test-plan.md` §6.1 cookbook fill-in

**Out of scope:**
- Mismatched-`user_id` negative test, service-role client
- Shared ownership-helper extraction / any production route changes
- Fixing `scenes/create.ts`'s plain-text 404 shape or enforcing uniform response shapes
- CI wiring (rollout Phase 4) and e2e tests (out of rollout scope)

## Architecture / Approach

Astro API routes run server-side with no way to import them directly under plain Vitest (no `astro:env` resolution). Tests instead run as real `fetch()` calls against a locally running `npm run dev` server, with a shared fixture module handling the sign-up→sign-in→cookie-capture dance (manual-redirect `fetch`, `Response.headers.getSetCookie()`) once, reused by all 5 route spec files.

## Phases at a Glance

| Phase | What it delivers | Key risk |
|---|---|---|
| 1. Test infrastructure | Auth-fixture helper + its own smoke test | Cookie-capture mechanics (manual redirect, chunked Set-Cookie) are non-obvious and load-bearing for every later phase |
| 2. Ownership & auth-guard test suites | 5 route spec files, 14 test cases | Test flakiness from unique-email generation or cookie timing under repeated local runs |
| 3. Cookbook update | `test-plan.md` §6.1 filled in | None significant — documentation only |

**Prerequisites:** Local Supabase running (`supabase start`) and `npm run dev` running; no CI/service-role dependencies.
**Estimated effort:** ~1-2 sessions across 3 phases.

## Open Risks & Assumptions

- Assumes `npm run dev`'s Cloudflare-adapter dev server behaves identically to a plain Node dev server for cookie/session handling — not separately verified beyond the existing README-documented local flow.
- The mismatched-`user_id` edge case (RLS alone wouldn't catch it) remains unverified by automation — flagged for a future risk row or `test-plan.md` §7 entry if it's ever prioritized.
- The auth-guard-shape inconsistency (redirect vs. 401) is tested as-is, not treated as a bug to fix — if the team later decides to unify it, these tests will need updating alongside that change.

## Success Criteria (Summary)

- `npm run test` passes locally (with Supabase + dev server running), covering all 5 mutating routes' ownership and auth-guard behavior with zero flakiness across repeated runs.
- A second authenticated user gets a 404 (or redirect, per route) on every attempt to reach, modify, or infer another user's project/scene/card — verified by code, not just assumed.
- `test-plan.md` §6.1 is no longer a placeholder.
