# API Ownership & Authorization Coverage Implementation Plan

## Overview

Implement `test-plan.md` §3 Phase 1: prove no API route lets one creator touch another's data. Build integration tests that hit all 5 mutating routes under `src/pages/api/` (`projects/create`, `scenes/create`, `scenes/[id]/card`, `scenes/[id]/forge`, `scenes/[id]/note`) with two real, independently-authenticated Supabase users against a local instance, and assert the unauthenticated-request guard on every route.

## Current State Analysis

Ownership enforcement is already correct today: every route filters reads/writes by `.eq("user_id", user.id)`, backed by RLS policies with confirmed GRANTs, and returns 404 (not a distinguishable 403) whichever way the resource is inaccessible. But there is zero automated coverage of this — only 3 pure-function unit tests exist (`readiness.test.ts`, `staleness.test.ts`, `adapter.test.ts`), none touching Supabase or HTTP. No auth-fixture helper, Supabase test client, or `APIContext` fabrication exists anywhere in the repo.

### Key Discoveries:

- Every mutating route enforces ownership via `.eq("user_id", user.id)` + RLS defense-in-depth: `src/pages/api/scenes/[id]/card.ts:86,111,138`, `forge.ts:45,59`, `note.ts:54`, `scenes/create.ts:32`; `projects/create.ts:26` stamps `user_id` on insert.
- **Auth-guard responses are NOT uniform across routes** — a correction to research.md's summary, confirmed by reading the route source directly: `projects/create.ts:16-18` and `scenes/create.ts:18-20` `return context.redirect("/auth/signin")` (302) on missing `context.locals.user`, while `card.ts:61-63`, `forge.ts:33-35`, and `note.ts:29-31` return `jsonResponse({error:"Not authenticated"}, 401)`. This split tracks the two routes' form-POST/redirect style vs. the three JSON-API routes' style — it is a real, currently-shipping divergence directly relevant to risk #1's "inconsistent with the others" framing, and Phase 1's tests should assert each route's actual (differing) behavior rather than assume uniformity.
- `card.ts`'s PATCH operates on a `scene_cards` row that only exists after `forge.ts`'s POST has run once for that scene — there is no separate card-create route (`src/pages/api/scenes/[id]/card.ts:80-87` selects, doesn't create).
- `card.ts` and `note.ts` PATCH bodies are **JSON** (`context.request.json()`, `card.ts:69-78`, `note.ts:37-46`); `projects/create.ts`, `scenes/create.ts`, and the auth routes (`signup.ts`, `signin.ts`) take **form-encoded** bodies (`context.request.formData()`).
- `signin.ts`/`signup.ts` (`src/pages/api/auth/signin.ts:4-20`, `signup.ts:4-20`) always `context.redirect(...)` — never return JSON — so a test fixture must use `redirect: "manual"` and read `Set-Cookie` off the redirect response itself, not the (unfollowed) final page.
- `astro:env/server` (used by `src/lib/supabase.ts:3`) is not resolvable under plain Vitest (`vitest.config.ts:1-13` has no `getViteConfig` wiring) — confirms route handlers cannot be imported directly into tests; tests must run as real HTTP requests against a running Astro dev server, consistent with `test-plan.md` §4's already-locked stack decision ("integration test hitting real routes... not a mocked network edge").
- No `supabase db reset`/seed automation exists (`context/changes/testing-api-ownership-authorization/research.md` — Local test-user setup) — tests must generate unique per-run emails, not fixed seeded users.
- Local Supabase auth requires only a 6-character minimum password with no complexity rule (`supabase/config.toml:174-178`).
- Node v24 is in use locally, well above the Node 19+/undici baseline needed for `Response.headers.getSetCookie()`.

## Desired End State

Running `supabase start` + `npm run dev` locally, then `npm run test`, exercises all 5 mutating routes with two real authenticated users and passes, proving: (a) a second user can never read, modify, or infer another user's project/scene/card via any route, and (b) every route correctly rejects an unauthenticated request in its own existing style (redirect or 401 JSON). `test-plan.md` §6.1 documents the pattern for adding the next such test.

### Verification

- `npm run test` passes with the new spec files included, run against a local Supabase instance with no other automated regressions.
- `npm run lint` passes on all new/changed files.

## What We're NOT Doing

- Not adding a service-role Supabase client or a negative test for the denormalized mismatched-`user_id` case (research-flagged risk) — no clean seeding path without new infra; deferred per user decision.
- Not extracting the 6 duplicated ownership-check call sites into a shared helper — production routes are untouched this phase; this is a proving phase, not a refactor.
- Not fixing `scenes/create.ts`'s plain-text 404 vs. the other routes' JSON shape, and not asserting response-shape uniformity across routes — tests assert each route's actual current shape and status code.
- Not automating Supabase/dev-server startup from within the test run (no `start-server-and-test`/`wait-on` orchestration) — documented as a manual precondition, consistent with this project's existing manual local-dev convention.
- Not wiring `npm run test` into CI — that is rollout Phase 4's job.
- Not writing e2e/browser-level tests — out of this rollout's scope per `test-plan.md` §4.

## Implementation Approach

Three phases: (1) a shared auth-fixture helper that creates two independent authenticated test users against a running local server, with its own smoke test; (2) one integration-test file per route, colocated with its source file (matching the existing `readiness.test.ts`/`staleness.test.ts` convention), each asserting the cross-user-404 and unauthenticated-guard cases plus a same-owner positive control; (3) a documentation-only phase filling in `test-plan.md` §6.1 with the established pattern.

## Critical Implementation Details

### Timing & lifecycle

Tests require `supabase start` and `npm run dev` (default `http://localhost:4321`) already running before `npm run test` — there is no automated orchestration of either process from within the test run; document this as a precondition rather than scripting it. **Every request needs an `Origin: <TEST_BASE_URL>` header** — discovered during Phase 1 implementation: Astro's built-in CSRF protection (`security.checkOrigin`, on by default for `output: "server"`) rejects any non-GET request that arrives with no `Origin` header at all (a plain Node `fetch()` sends none), returning `403 "Cross-site POST form submissions are forbidden"` before the route handler ever runs. This affects every mutating route, not just the form-encoded ones — `apiFetch`/`createTestUser` set it on every call. To get a session cookie for a test user: `POST /api/auth/signup` (form-encoded `email`/`password`) then `POST /api/auth/signin` (same credentials) with `fetch(..., { redirect: "manual" })` on both calls, reading `response.headers.getSetCookie()` off the **signin** response (not signup — signup's redirect target is a stale "confirm your email" page even though local auto-confirm means a session may already exist; signin is the reliable, idempotent source of a fresh session). Join the returned `Set-Cookie` values into a single `Cookie` header (`name=value` pairs only, drop attributes) for use on subsequent requests. `card.ts`'s tests depend on `forge.ts` having already created the `scene_cards` row for that scene — call `forge.ts`'s POST as part of `card.test.ts`'s setup, not as a separate precondition.

## Phase 1: Test infrastructure

### Overview

A shared helper that produces two independently-authenticated test users (real signup + signin against the running dev server) and a thin authenticated-fetch wrapper, so Phase 2's route specs don't each reimplement auth plumbing.

### Changes Required:

#### 1. Auth fixture helper

**File**: `src/lib/test-support/auth-fixture.ts`

**Intent**: Create a uniquely-emailed test user (via the real signup+signin HTTP flow) and return a ready-to-use `Cookie` header string for that user's session, plus a small `apiFetch` wrapper that attaches it. Keeps Phase 2's specs free of auth plumbing.

**Contract**:

```ts
export const TEST_BASE_URL: string; // process.env.TEST_BASE_URL ?? "http://localhost:4321"

export interface TestUser {
  email: string;
  cookie: string;
}

// Signs up + signs in a fresh user (unique email per call); returns their session Cookie header.
export async function createTestUser(label: string): Promise<TestUser>;

// fetch() against TEST_BASE_URL, attaching `cookie` (or none, for unauthenticated-request tests).
export async function apiFetch(cookie: string | null, path: string, init?: RequestInit): Promise<Response>;
```

`createTestUser` must use `redirect: "manual"` on both the signup and signin calls and derive the returned cookie from the signin response only, per the Timing & lifecycle note above.

#### 2. Fixture smoke test

**File**: `src/lib/test-support/auth-fixture.test.ts`

**Intent**: Verify the fixture itself works in isolation (two calls to `createTestUser` yield two distinct users with non-empty, distinct cookies) before Phase 2 builds on it — keeps this phase independently verifiable.

**Contract**: A Vitest `describe`/`it` asserting `createTestUser("a")` and `createTestUser("b")` resolve to different `email` and different `cookie` values.

### Success Criteria:

#### Automated Verification:

- `npm run lint` passes on the two new files
- `npm run test -- auth-fixture` passes (requires `supabase start` + `npm run dev` running locally)

#### Manual Verification:

- With `supabase start` and `npm run dev` running, re-run the fixture smoke test and confirm two new users appear in the local Supabase Studio auth panel (`http://localhost:54323`)

---

## Phase 2: Ownership & auth-guard test suites

### Overview

One integration-test file per mutating route, each importing the Phase 1 fixture and asserting the route's actual unauthenticated-request behavior (redirect or 401, per route) plus a same-owner positive control confirming the fixture and route both work end-to-end. Four of the five routes (`scenes/create`, `card`, `forge`, `note`) additionally assert a cross-user-404/redirect case against another user's resource; `projects/create` has no existing-resource ownership dimension to test — it creates a new project for the authenticated caller, with no prior resource that could belong to someone else.

### Changes Required:

#### 1. Projects create route test

**File**: `src/pages/api/projects/create.test.ts`

**Intent**: Confirm unauthenticated project creation is rejected via redirect (not 401 — this route's actual behavior), and that an authenticated creation succeeds and is scoped to the creator.

**Contract**: Two cases — unauthenticated POST → `302` with `Location` containing `/auth/signin`; authenticated POST with valid form fields (`title`, `premise`, `tone`) → `302` with `Location` matching `/projects/{id}/scenes/new`.

#### 2. Scenes create route test

**File**: `src/pages/api/scenes/create.test.ts`

**Intent**: Confirm a scene cannot be created under another user's project (404, this route's plain-text shape), unauthenticated requests are redirected (not 401), and an owner can create a scene under their own project.

**Contract**: Setup creates a project as user A (via the Phase 2.1 route). Three cases — unauthenticated POST → `302` to `/auth/signin`; user B POSTs with user A's `projectId` → `404` plain-text `"Not found"`; user A POSTs with their own `projectId` → `302` with `Location` matching `/scenes/{id}`.

#### 3. Scene card route test

**File**: `src/pages/api/scenes/[id]/card.test.ts`

**Intent**: Confirm a scene card cannot be read or modified by anyone but its owner, unauthenticated PATCH is rejected with 401 JSON (this route's actual behavior), and the owner can update their own card.

**Contract**: Setup creates a project + scene as user A, then calls `forge.ts`'s POST as user A to generate the initial card. Three cases — unauthenticated PATCH → `401` JSON `{error:"Not authenticated"}`; user B PATCHes user A's scene id with a valid body (`{status:"draft", notes:"", designRisks:[]}`) → `404` JSON `{error:"Not found"}` with no card fields in the body; user A PATCHes their own card → `200` with the returned record reflecting the submitted `status`/`notes`.

#### 4. Scene forge route test

**File**: `src/pages/api/scenes/[id]/forge.test.ts`

**Intent**: Confirm card generation cannot be triggered against another user's scene, unauthenticated POST is rejected with 401 JSON, and the owner can generate a card for their own scene (using the existing mock generator path — no `ANTHROPIC_API_KEY` needed locally, per `test-plan.md`'s mock-only note).

**Contract**: Setup creates a project + scene as user A. Three cases — unauthenticated POST → `401` JSON `{error:"Not authenticated"}`; user B POSTs to user A's scene id → `404` JSON `{error:"Not found"}` with no scene/project fields in the body; user A POSTs to their own scene → `200` with a `card` object in the body.

#### 5. Scene note route test

**File**: `src/pages/api/scenes/[id]/note.test.ts`

**Intent**: Confirm a scene's note cannot be read or modified by anyone but its owner, unauthenticated PATCH is rejected with 401 JSON, and the owner can update their own note.

**Contract**: Setup creates a project + scene as user A. Three cases — unauthenticated PATCH → `401` JSON `{error:"Not authenticated"}`; user B PATCHes user A's scene id with `{note:"..."}` → `404` JSON `{error:"Not found"}` with no `note` field in the body; user A PATCHes their own scene → `200` with `note` matching what was submitted.

### Success Criteria:

#### Automated Verification:

- `npm run test` passes, including all 5 new spec files (requires `supabase start` + `npm run dev` running locally)
- `npm run lint` passes on all new files

#### Manual Verification:

- With both processes running, `npm run test` output shows all new ownership/auth-guard cases passing with zero flakiness across 2 consecutive runs (guards against unique-email collisions or cookie-capture timing issues)
- Spot-check one cross-user case manually (e.g. curl or browser devtools as user B against user A's scene id) and confirm the response matches what the automated test asserts

---

## Phase 3: Cookbook update

### Overview

Fill in `test-plan.md` §6.1 ("Adding an integration test for an API route (ownership)") with the pattern established in Phases 1-2, per `test-plan.md`'s own convention that each rollout phase's plan ends by updating its cookbook entry.

### Changes Required:

#### 1. Cookbook entry

**File**: `context/foundation/test-plan.md`

**Intent**: Replace the `TBD — see §3 Phase 1` placeholder under §6.1 with concrete guidance: fixture location (`src/lib/test-support/auth-fixture.ts`), file-naming convention (colocated `<route>.test.ts` next to the route file), a reference test to point to (`src/pages/api/scenes/[id]/note.test.ts` — the simplest of the 5), and the run command including the `supabase start` + `npm run dev` precondition.

**Contract**: Only the §6.1 subsection body changes; no other section of `test-plan.md` is touched (§3's Status/Change-folder columns are the rollout orchestrator's own responsibility, updated when `/10x-test-plan` is re-run).

### Success Criteria:

#### Automated Verification:

- `npm run lint` passes (docs-only change, but keep the gate)
- `git diff context/foundation/test-plan.md` touches only the §6.1 subsection

#### Manual Verification:

- Re-read §6.1 as a future contributor would and confirm it's sufficient to add a 6th route's ownership test without re-deriving the fixture pattern from scratch

---

## Testing Strategy

### Unit Tests:

- Fixture smoke test (Phase 1) is the only non-route-level test this plan adds.

### Integration Tests:

- 5 route spec files (Phase 2), 14 test cases total: every route covers unauthenticated-request rejection (route-specific shape) and a same-owner positive control; `scenes/create`, `card`, `forge`, and `note` additionally cover a cross-user-404/redirect case (`projects/create` has no existing-resource ownership dimension to test).

### Manual Testing Steps:

1. `supabase start` (first-time or after a stop) and `npm run dev` in separate terminals.
2. `npm run test` — confirm all new and existing tests pass.
3. Re-run `npm run test` a second time immediately to confirm no flakiness from cookie timing or email collisions.
4. Manually hit one cross-user case (e.g. via curl with a captured cookie) to visually confirm the 404/401 response matches the automated assertion.

## Performance Considerations

None — this is a local-only test suite; no production code path changes.

## Migration Notes

None — no schema or data changes.

## References

- Research: `context/changes/testing-api-ownership-authorization/research.md`
- Ownership-check pattern origin: `context/changes/first-forged-scene-card/plan.md:46,61`
- Prior auth-guard regression (S-03): `context/changes/enforce-scene-readiness/plan.md:266-271`
- Response-shape divergence precedent (S-05): `context/archive/2026-08-30-edit-note-after-generation/reviews/impl-review.md` F3

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles. See `references/progress-format.md`.

### Phase 1: Test infrastructure

#### Automated

- [x] 1.1 `npm run lint` passes on the two new files
- [x] 1.2 `npm run test -- auth-fixture` passes

#### Manual

- [x] 1.3 Two new users visible in local Supabase Studio auth panel after re-running the smoke test

### Phase 2: Ownership & auth-guard test suites

#### Automated

- [ ] 2.1 `npm run test` passes, including all 5 new spec files
- [ ] 2.2 `npm run lint` passes on all new files

#### Manual

- [ ] 2.3 `npm run test` passes with zero flakiness across 2 consecutive runs
- [ ] 2.4 One cross-user case spot-checked manually and matches the automated assertion

### Phase 3: Cookbook update

#### Automated

- [ ] 3.1 `npm run lint` passes
- [ ] 3.2 `git diff context/foundation/test-plan.md` touches only §6.1

#### Manual

- [ ] 3.3 §6.1 read back and confirmed sufficient for a future contributor
