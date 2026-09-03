---
date: 2026-09-03T20:01:11+02:00
researcher: Łukasz Gąsior
git_commit: 0a9ceeebef2155bf8f98d39a499f25dc253242ba
branch: main
repository: LukeGander/scene-forge
topic: "API ownership & authorization coverage (test-plan.md §3 Phase 1, risk #1)"
tags: [research, codebase, api-routes, auth, rls, supabase, ownership, idor]
status: complete
last_updated: 2026-09-03
last_updated_by: Łukasz Gąsior
---

# Research: API ownership & authorization coverage

**Date**: 2026-09-03T20:01:11+02:00
**Researcher**: Łukasz Gąsior
**Git Commit**: [0a9ceee](https://github.com/LukeGander/scene-forge/blob/0a9ceeebef2155bf8f98d39a499f25dc253242ba)
**Branch**: main
**Repository**: LukeGander/scene-forge

## Research Question

Ground `test-plan.md` §3 Phase 1 — "Prove no API route lets one creator touch another's data" (risk #1) — before planning the two-user integration test suite. Specifically, per the Risk Response Guidance row for #1: which routes exist, each route's ownership-check shape, session/auth fixture setup, and whether the not-found-vs-forbidden response contract is consistent across routes.

## Summary

Every API route under `src/pages/api/` that touches a project/scene/scene_card resource enforces ownership consistently today: each handler checks `context.locals.user`, filters every read/write with `.eq("user_id", user.id)`, and returns an identical `404 { error: "Not found" }` whether the resource doesn't exist or belongs to another user (no 403 anywhere, no distinguishable IDOR shape). This is backed by defense-in-depth: Postgres RLS policies (`user_id = auth.uid()`, `for all`) on `projects`, `scenes`, and `scene_cards`, each with GRANTs to `authenticated` already verified present. There is no service-role/admin Supabase client anywhere — every query, including inserts, goes through the anon-key client bound to the caller's session cookies, so RLS is always live, not bypassable by a route forgetting a check.

The design intent behind this is explicit and traceable to S-01 (`first-forged-scene-card`): RLS + app-level filtering were chosen together deliberately ("defense in depth costs little extra"), not one instead of the other. That said, three concrete facts sharpen where a test suite should look, beyond "does ownership work":

1. **No shared ownership-check helper exists.** The `.eq("id"/"scene_id", id).eq("user_id", user.id).single()` → 404-on-failure pattern is hand-copied 6 times across 4 files. It's currently behaviorally consistent, but nothing stops the next route from omitting it — RLS is the only backstop if that happens.
2. **`user_id` is denormalized, not derived via join**, on `scenes` and `scene_cards` (each has its own `user_id` column; RLS policies check only the row's own column, never a parent). This was flagged in S-01's own plan as a spot where "the isolation guardrail silently breaks even with RLS enabled" if an insert ever forgot to copy `user_id` correctly — worth a negative test seeding a project/scene/card with mismatched `user_id` values to confirm the app-level check (not just RLS) actually catches it.
3. **A real cross-route auth inconsistency shipped once already and was caught only by manual testing, not automation** (S-03): `middleware.ts`'s blanket redirect for protected routes ran before route handlers' own 401 checks, so unauthenticated `/api/*` requests were silently 302-redirected to a 200 HTML sign-in page instead of returning 401 JSON — affecting `forge.ts`, `scenes/create.ts`, and `projects/create.ts` simultaneously. It was fixed by excluding `/api/*` from the middleware redirect (current `src/middleware.ts:19` already reflects the fix), but this is exactly the kind of regression risk #1 is written to prevent from recurring silently — an unauthenticated-request test against every mutating route belongs in Phase 1's suite alongside the two-user ownership tests.

Additionally, `note.ts` uses a structurally different query shape than `card.ts`/`forge.ts` (single `update().eq(id).eq(user_id).select().single()` round-trip vs. select-then-update) — reviewed once already (S-05) and judged behaviorally correct but flagged as a "divergent shape worth being aware of if this becomes the pattern other routes copy." Both shapes should get their own test rather than assuming one covers the other.

## Detailed Findings

### API route inventory (`src/pages/api/`)

8 route files total — confirmed exhaustive via glob, no list/GET endpoints exist (list/detail reads happen in `.astro` page frontmatter, out of scope for this API-focused risk).

| Route | Method | Resource | Current-user source | Ownership check | 404/401 shape | RLS / app-code |
|---|---|---|---|---|---|---|
| `api/auth/signin.ts` | POST | none (session) | n/a | n/a | n/a | n/a |
| `api/auth/signout.ts` | POST | none | n/a | n/a | n/a | n/a |
| `api/auth/signup.ts` | POST | none | n/a | n/a | n/a | n/a |
| `api/projects/create.ts` | POST | project (create) | `locals.user` (`:15`), 401-guarded `:16-18` | insert stamps `user_id: user.id` (`:26`) | n/a (no existing-resource lookup) | both |
| `api/scenes/create.ts` | POST | scene (create), under `projectId` | `locals.user` (`:17`), 401-guarded `:18-20` | project lookup `.eq("id",projectId).eq("user_id",user.id)` (`:28-33`) → 404 (`:39`) | plain-text 404, not JSON (minor inconsistency, not a security issue) | both |
| `api/scenes/[id]/card.ts` | PATCH | scene_card, `[id]`=scene id | `locals.user` (`:60`), 401-guarded `:61-63` | card lookup (`:80-87`) → 404 (`:93`); scene lookup for readiness branch (`:107-112`) → 404 (`:116`); update filtered (`:129-138`) | identical `jsonResponse({error:"Not found"},404)` in both lookup-failure cases | both |
| `api/scenes/[id]/forge.ts` | POST | scene + parent project | `locals.user` (`:32`), 401-guarded `:33-35` | scene lookup (`:41-46`) → 404 (`:52`); project lookup (`:55-60`) → 404 (`:63`) | identical 404 shape | both |
| `api/scenes/[id]/note.ts` | PATCH | scene | `locals.user` (`:28`), 401-guarded `:29-31` | single combined `update().eq("id",id).eq("user_id",user.id).select().single()` (`:50-56`) → 404 on failure (`:62`) | identical 404 shape; **structurally different query pattern** vs. card.ts/forge.ts (update-scoped-by-owner in one round trip, not select-then-update) | both |

No shared "fetch resource and verify ownership" helper exists anywhere in `src/lib/` — confirmed via repo-wide search for `fetchOwned|verifyOwnership|getOwned|assertOwner|requireOwner` (no matches). The pattern is duplicated inline 6 times across 4 files.

### Session/auth wiring

- `src/middleware.ts:6-25` runs on every request. Creates a request-scoped Supabase client (`createClient(context.request.headers, context.cookies)`, `:7`), calls `supabase.auth.getUser()` (`:11`), and sets `context.locals.user = user ?? null` (`:13`; `null` also set at `:15` if Supabase isn't configured).
- `PROTECTED_ROUTES` (`src/middleware.ts:4`) includes `/api/projects` and `/api/scenes`, but line 19 explicitly excludes `/api/*` paths from the middleware's own redirect — this is the fix for the S-03 bug described above. Each route handler is independently responsible for its own 401 via `context.locals.user`.
- Identity flows entirely through Supabase session cookies (set by `@supabase/ssr`'s `setAll`, `src/lib/supabase.ts:17-21`) — no bespoke JWT/header scheme. A test client must sign in through the real auth flow (or the Supabase JS client directly) and forward the resulting cookies.
- `context.locals.user` typed as `User | null` in `src/env.d.ts:1-5`.

### Supabase client construction — no service-role bypass

- `src/lib/supabase.ts:1-24` is the only client factory in the repo: `createServerClient(SUPABASE_URL, SUPABASE_KEY, {...})` using `SUPABASE_KEY` = the **anon public key** (confirmed via `README.md:99-104,120-128`).
- No admin/service-role client exists anywhere (repo-wide search for `service_role`/`SERVICE_ROLE`/`serviceRole` — no matches). Every DB call, including every insert, runs through the anon-key client bound to the caller's session — **RLS is always enforced**, there is no bypass path in production code.
- Implication for test seeding: a two-user integration suite can't fabricate cross-user data via an admin client (none exists); it must seed by actually authenticating as each test user, or the test suite would need to introduce its own service-role client (not currently present) if it needs to seed data as a user other than the one under test (e.g., to construct the mismatched-`user_id` negative case in Finding 2 above).

### RLS policies and GRANTs (`supabase/migrations/`)

`20260802120000_create_scene_forge_core.sql`:
- `:38-40` — RLS enabled on `projects`, `scenes`, `scene_cards`.
- `:42-43` — `projects_owner_all`: `for all using (user_id = auth.uid()) with check (user_id = auth.uid())`.
- `:44-45` — `scenes_owner_all`: same shape, checked against `scenes.user_id` directly (own column, `scenes.user_id uuid not null references auth.users(id)` at `:14` — **not** a join through `projects`).
- `:46-47` — `scene_cards_owner_all`: same shape, own `user_id` column (`:24`).

All three tables use identical single-policy, `for all`, direct-column checks — no cross-table joins in USING/WITH CHECK. Since `user_id` is independently stored per table rather than derived, RLS alone would not catch a row where `scene.user_id` and its `card.user_id` (or parent `project.user_id`) diverge — only the app-level `.eq("user_id", user.id)` lookups catch that. This is the S-01 plan's own documented risk (`plan.md:46`).

`20260813210000_grant_scene_forge_core_privileges.sql:1-3` — `grant select, insert, update, delete on table public.{projects,scenes,scene_cards} to authenticated;` confirmed present for all three tables, consistent with the standing lesson in `context/foundation/lessons.md:12-17` ("New tables need an explicit GRANT alongside RLS") — this project already hit and fixed the RLS-without-GRANT failure mode once (Aug 2 → Aug 13).

Third migration (`20260825120000_enforce_scene_readiness.sql`) only adds a column/backfill, no RLS/GRANT changes.

### Local test-user setup

- No `supabase/seed.sql` exists despite `config.toml:60-65` referencing it (`supabase db reset` seeding is currently a no-op).
- Local `config.toml:209` sets `enable_confirmations = false` for email auth — `POST /api/auth/signup` → `POST /api/auth/signin` works immediately for two distinct users locally, no Inbucket step needed.
- No `package.json` script wires `supabase db reset` or seeding; `supabase` CLI is a devDependency invoked ad hoc per README.
- `.env.example` only has `SUPABASE_URL`/`SUPABASE_KEY` (anon) — no service-role convention anywhere in the repo's env setup.

### Existing test infrastructure

- `vitest.config.ts:1-13` — minimal, just a `@` → `./src` alias, Vitest defaults otherwise (node env, no setup files, no test-env config).
- `package.json:13` — `"test": "vitest run"`, no `test:integration` split.
- All 3 existing test files are pure unit tests with no Supabase/HTTP involvement: `readiness.test.ts`, `staleness.test.ts` (pure functions), `adapter.test.ts` (mocks a plain module via `vi.mock`, the only existing mocking pattern in the repo — not applicable to Supabase/request mocking).
- **No existing helper anywhere for an authenticated request, a fabricated Astro `APIContext`, or a Supabase test client.** Phase 1's plan will need to build this from scratch — either drive route handlers directly with a hand-built `APIContext`-shaped object, or run the dev server and issue real HTTP requests carrying each test user's session cookies against a local Supabase instance.

## Code References

- `src/middleware.ts:4,6-25` — protected-route list, session population, `/api/*` redirect exclusion
- `src/lib/supabase.ts:1-24` — sole Supabase client factory (anon key + cookie-bound session)
- `src/env.d.ts:1-5` — `Locals.user` typing
- `src/pages/api/projects/create.ts:15-26` — 401 guard + `user_id` stamp on insert
- `src/pages/api/scenes/create.ts:17-40` — 401 guard, project-ownership lookup, plain-text 404
- `src/pages/api/scenes/[id]/card.ts:60-138` — 401 guard, card + scene ownership lookups, filtered update
- `src/pages/api/scenes/[id]/forge.ts:32-90` — 401 guard, scene + project ownership lookups, card upsert
- `src/pages/api/scenes/[id]/note.ts:28-63` — 401 guard, combined update+ownership query (divergent shape)
- `supabase/migrations/20260802120000_create_scene_forge_core.sql:14,24,38-47` — table `user_id` columns, RLS enable, owner policies
- `supabase/migrations/20260813210000_grant_scene_forge_core_privileges.sql:1-3` — GRANTs to `authenticated`
- `vitest.config.ts:1-13` — test runner config (no integration-test scaffolding yet)

## Architecture Insights

- **Deliberate defense-in-depth, not redundancy for its own sake.** S-01's `plan-brief.md:27` states the RLS-vs-app-level choice explicitly: both, because "defense in depth costs little extra given app filtering is needed anyway" — this is a documented decision, not an accident, and Phase 1's tests should verify both layers independently rather than treating one as a proxy for the other (e.g., a test that bypasses the app-level check should still be blocked by RLS, and vice versa isn't fully provable without a service-role client, but the mismatched-`user_id` seeding case gets close).
- **404-always is a de facto, unwritten convention, not a documented decision.** Every shipped route across S-01/S-02/S-03 uses 404 for both "doesn't exist" and "not yours" — never 403 — but no document on disk explicitly argues for 404-over-403. Phase 1's plan should treat "never distinguishable 403 vs 404" as the guardrail to assert, and could be the first place this convention gets written down explicitly (candidate for `test-plan.md` §6.1 cookbook entry).
- **Ownership checks are copy-pasted, not centralized.** Currently consistent by discipline, not by structure. A test suite proving risk #1 today is necessary; it doesn't remove the standing risk that a future route skips the pattern (RLS remains the real backstop in that case). Worth flagging as an open question below rather than assuming it's this phase's job to fix.

## Historical Context (from prior changes)

- `context/changes/first-forged-scene-card/plan-brief.md:27`, `plan.md:46,61,290-291,311,425-426` — origin of the RLS+app-level dual-check convention and the 404-not-403 response shape; also names the denormalized-`user_id` risk explicitly.
- `context/changes/first-forged-scene-card/reviews/impl-review.md:24` — "Auth (401) and ownership (`user_id` scoping) verified sound on every touched route," 0 critical findings.
- `context/changes/enforce-scene-readiness/research.md:104` — generalizes the convention: `user_id` denormalized everywhere, every write copies it from the session (never derived from a parent row), every route re-checks explicitly even where RLS would also block it, degrading to a 404 with zero data leak.
- `context/changes/enforce-scene-readiness/plan.md:172,266-271` and `reviews/impl-review.md` F1 — the real, previously-shipped auth bug: middleware's blanket redirect ran before route-level 401 checks for `/api/*`, silently 302-redirecting unauthenticated requests to a 200 HTML page across `forge.ts`, `scenes/create.ts`, and `projects/create.ts` simultaneously; caught by manual testing, not automation, and fixed by excluding `/api/*` from the middleware redirect.
- `context/archive/2026-08-30-browse-projects-and-scenes/plan.md:60,112,182` — reaffirms 404-not-data-leak as a named design principle for page-level (not just API-level) cross-user access.
- `context/archive/2026-08-30-edit-note-after-generation/reviews/impl-review.md` F3 — `note.ts`'s combined update+ownership query is a documented, deliberately-accepted structural divergence from `card.ts`/`forge.ts`'s select-then-update shape.
- `context/foundation/lessons.md:12-17` — the standing RLS-needs-GRANT lesson, already verified satisfied for all three tables in this research.
- `context/foundation/prd.md:39,118,128-130` — the exact guardrail language test-plan.md's risk #1 paraphrases ("a user's projects and scenes are never accessible to another user"; flat user model, no sharing/admin roles in MVP). No dedicated FR number exists for data isolation — it's a cross-cutting NFR/Access-Control statement, not FR-NNN.
- The test-plan.md §2 "interview Q1/Q4" citations have no separate on-disk transcript — `/10x-test-plan`'s interview is conducted live and only synthesized risk rows are persisted (`.claude/skills/10x-test-plan/SKILL.md:228-231`). `test-plan.md` itself is the only surviving record of those answers.

## Related Research

None yet — this is the first `/10x-research` pass for this change. Related historical artifacts are cited above under Historical Context.

## Open Questions

- Should Phase 1's plan introduce a shared ownership-check helper (to close the "duplicated 6 times, no structural guardrail" gap), or is that out of scope for a test-only rollout phase (test-plan.md's Phase 1 goal is proving current behavior, not refactoring routes)? Flagging for `/10x-plan` to decide against cost×signal — tests can pass either way; only test-plan.md §7 (negative space) or a future risk row would formally scope a refactor.
- Should the mismatched-`user_id` (project/scene/card owned by different users at the DB row level) scenario be an explicit negative test case, given it's a documented-but-unverified risk from S-01's own plan? No seeding path exists today (no service-role client, no seed.sql) — the plan will need to decide whether to add one.
- `scenes/create.ts`'s plain-text 404 vs. the JSON `jsonResponse` shape used by `card.ts`/`forge.ts`/`note.ts` is a minor inconsistency noted but not flagged as a security issue — worth a call in the plan on whether the test suite should assert response *shape* consistency too, or only the ownership/status-code guarantee.
