---
change_id: first-forged-scene-card
title: First forged scene card
status: impl_reviewed
created: 2026-08-02
updated: 2026-08-16
archived_at: null
---

## Notes

### Phase 3 navigation-gap investigation (2026-08-16)

Manual verification of Phase 3 surfaced that `/dashboard` has no path back to an existing project/scene beyond "New Project" — only a direct URL (or Supabase Studio) reaches a previously created scene.

**Scope determination**: project/scene browsing/listing is explicitly out of scope for the entire `first-forged-scene-card` plan, not just Phase 3 — see plan.md's "What We're NOT Doing" ("Project/scene browsing or listing beyond the single happy path this slice needs (FR-005/006/013) — that's `S-02`") and roadmap `S-02: browse-projects-and-scenes`, whose own risk note already names this exact gap ("without it a creator with more than one project or scene has no way back in after the first session"). Not pulled forward.

**In-scope path used for manual testing instead**: the existing create-project → create-scene redirect chain (`/dashboard` → New Project → auto-redirect to new-scene form → auto-redirect to `/scenes/{id}`) already lands on a scene detail page without needing a listing UI — this is what Phase 3's manual verification used to reach a test scene.

**Approved plan deviation (dashboard/Topbar consistency)**: `dashboard.astro` was still using its own hand-rolled header (inline "Welcome, {email}" + inline sign-out form) rather than the shared `Topbar` wired into the three Phase 2 pages — a pre-existing gap explicitly left alone during Phase 2 ("dashboard.astro left untouched (pre-existing, out of scope)"). Since every other authenticated page's `Topbar` links back to `/dashboard`, this created a one-way inconsistency. Fixed as a small, approved Phase 3 deviation: `dashboard.astro` now renders `<Topbar />` (same `min-h-screen` + `flex min-h-[80vh] items-center justify-center` restructuring pattern used for the other three pages), with the redundant inline sign-out form removed since `Topbar` already provides it. Not a scope expansion — no new functionality, just adopting the existing shared component. Re-verified clean: `npm run test` (7/7), `npx astro check` (0 errors), `npm run build` succeeds.

Phase 3 not yet marked complete — awaiting manual verification (including confirmation of this dashboard fix) before the commit ritual.

### Phase 3 manual verification complete (2026-08-16)

All Phase 3 Progress rows (3.1–3.9) are now `[x]` in `plan.md`. Confirmed: mock-path generation with no `ANTHROPIC_API_KEY`; real Claude generation with a valid key producing every required field; spinner/elapsed-time visible for the full generation duration; an invalid key surfaces a clear error (401), preserves the scene note, and exposes "Try again"; restoring a valid key lets generation recover via "Try again"; a second test account gets a plain `Not found` for the first account's scene/card with no data leak. The dashboard/Topbar deviation from the navigation-gap investigation above was verified as part of this pass. Commit for Phase 3 is being prepared.

### Phase 2 manual verification complete (2026-08-16)

All Phase 2 Progress rows (2.1–2.7) are now `[x]` in `plan.md`. Final two manual checks, run today:
- **2.6** (cross-user access): navigating as a second user to another user's `/scenes/{id}` and `/projects/{id}/scenes/new` both returned a plain `Not found` with no data leak.
- **2.7** (unauthenticated POST to `/api/projects/create`): first attempt (`curl -d ...` with no `Origin` header) hit Astro's built-in `checkOrigin` CSRF guard (`403 Cross-site POST form submissions are forbidden`) — a different, earlier layer than the auth middleware. Re-tested with a same-origin `Origin` header and no session cookie: `302 Found` / `Location: /auth/signin`, confirming the auth middleware itself redirects rather than executes. No `UnauthProbe` project was created in either case.

Commit for Phase 2 is being prepared (staged, message drafted) but not yet executed — pending explicit go-ahead. Phase 3 has not started.

### Phase 2 paused — resuming tomorrow (2026-08-13)

**Why paused**: user is stopping for the day partway through Phase 2 manual verification. Everything below is code-complete and automated-check-clean; only two manual verification items remain.

**What is done (code-complete, do not redo)**:
- All Phase 2 files written: `src/pages/projects/new.astro`, `src/components/projects/NewProjectForm.tsx`, `src/pages/api/projects/create.ts`, `src/pages/projects/[projectId]/scenes/new.astro`, `src/components/scenes/NewSceneForm.tsx`, `src/pages/api/scenes/create.ts`, `src/pages/scenes/[id].astro`, `src/pages/dashboard.astro` (New Project link), `src/middleware.ts` (extended `PROTECTED_ROUTES`).
- Tooling deviations applied and recorded (see "Phase 2 tooling deviations" note below): `.astro`-scoped `no-misused-promises` disable, scoped `no-unnecessary-condition` disables around Supabase null-checks.
- Runtime bug fixes applied and recorded (see "Phase 2 runtime fixes" note below): the GRANT migration (`supabase/migrations/20260813210000_grant_scene_forge_core_privileges.sql`) and the `<Topbar />` wiring on all three new pages.
- Progress rows 2.1–2.3 (automated: lint/astro check/build) are already flipped `[x]` in `plan.md`.
- Automated checks last re-confirmed clean after the Topbar fix: `npm run test` (7/7), `npx astro check` (0 errors), `npm run build` succeeds.
- Manual verification confirmed so far: sign-in works; creating a project works (post-GRANT-fix); creating a scene works; scene detail page shows the saved title/note; Topbar with Sign out is now visible and working on all three new pages.

**What is NOT done — do not mark Phase 2 complete, do not commit**:
- Progress rows 2.4 and 2.5 (create project → new-scene form; submit scene note → scene detail page) are manually confirmed working but **not yet flipped `[x]`** in `plan.md` — flip these together with 2.6/2.7 once the remaining checks below pass, per the "don't check off manual items until user-confirmed" rule.
- Progress row 2.6 — direct navigation to another user's project/scene id must redirect/404 without exposing data. **Not yet tested.**
- Progress row 2.7 — signed-out access to the new pages/API routes must redirect to sign-in instead of executing. **Partially untested**: unauthenticated POST to `/api/projects/create` specifically still needs to be verified as rejected/redirected and non-executing.
- No commit has been made for Phase 2. No files are staged.
- Phase 3 has not started.

**Working tree state at pause** (all uncommitted, matches the Phase 2 touched-file set plus the always-included `plan.md`):
```
 M context/changes/first-forged-scene-card/change.md
 M context/changes/first-forged-scene-card/plan.md
 M eslint.config.js
 M src/middleware.ts
 M src/pages/dashboard.astro
?? src/components/projects/
?? src/components/scenes/
?? src/pages/api/projects/
?? src/pages/api/scenes/
?? src/pages/projects/
?? src/pages/scenes/
?? supabase/migrations/20260813210000_grant_scene_forge_core_privileges.sql
```

**Resume checklist (user's explicit sequence)**:
1. Verify unauthorized/cross-user project or scene access redirects/404s without exposing data (Progress 2.6) — try navigating to another account's `/projects/{id}/scenes/new` and `/scenes/{id}` while signed in as a different user.
2. Verify unauthenticated POST to `/api/projects/create` is rejected/redirected and does not execute (part of Progress 2.7) — the existing `PROTECTED_ROUTES` extension in `src/middleware.ts` should already cover `/api/projects`, so this should already redirect to `/auth/signin`, but it needs an explicit manual pass.
3. Once both pass, flip Progress rows 2.4–2.7 to `[x]` in `plan.md` (2.4/2.5 already manually confirmed above, just need the checkbox flip alongside 2.6/2.7).
4. Show the Phase 2 changed-file summary and diff, then run the Phase 2 commit ritual (stage → dirty-path check → commit message approval → commit → SHA write-back).
5. Only after that: decide whether to continue into Phase 3.

**Commands that must NOT be run yet**: `git add` / `git commit` for Phase 2, anything from Phase 3.

### Phase 2 runtime fixes found during manual verification (2026-08-13)

1. **`permission denied for table projects`** on project creation. Root cause: the Phase 1 migration created `projects`/`scenes`/`scene_cards` and enabled RLS, but never granted table-level DML privileges to `authenticated` — Postgres rejects at the privilege layer before RLS is ever evaluated. Confirmed via direct `\dp` inspection in the local Postgres container (`authenticated` only had `Dxtm`, not `arwd`) and via `pg_default_acl` (Supabase's default-privilege template intentionally excludes SELECT/INSERT/UPDATE/DELETE from `public` schema defaults). Fixed with a new forward-only migration, `supabase/migrations/20260813210000_grant_scene_forge_core_privileges.sql`, granting `select, insert, update, delete` on all three tables to `authenticated` only (nothing to `anon`). RLS policies untouched. `supabase db reset` re-verified clean; `authenticated` now shows `arwd` on all three tables.
2. **Missing navigation/sign-out** on the three new Phase 2 pages (`projects/new.astro`, `projects/[projectId]/scenes/new.astro`, `scenes/[id].astro`). Root cause: an existing `src/components/Topbar.astro` (user email + Dashboard/Sign-out links) was only ever wired into the marketing `Welcome.astro` page; `dashboard.astro` hand-rolls its own separate inline sign-out instead of using it, and Phase 2's new pages copied the header-less sign-in/sign-up card layout. Fixed by adding `<Topbar />` (existing component, no new files) to all three pages, restructuring the centered-card wrapper so Topbar sits above the centered content rather than being vertically centered itself. `dashboard.astro` left untouched (pre-existing, out of scope).

Both fixes re-verified: `npm run test` (7/7), `npx astro check` (0 errors), `npm run build` succeeds, migration re-applies cleanly via `supabase db reset`.

### Phase 2 tooling deviations (2026-08-13)

Two eslint adaptations were needed, not present in the plan text (plan is read-only during implementation):
1. `eslint.config.js`: added `"@typescript-eslint/no-misused-promises": "off"` to the `.astro`-only rule block. `astro-eslint-parser@1.4.0` crashes this rule on any top-level `return` in Astro frontmatter (verified with a trivial repro unrelated to this feature's code) — a pre-existing tool incompatibility, only surfaced now because `scenes/[id].astro` and `projects/[projectId]/scenes/new.astro` are the first pages to use the redirect/404-guard idiom.
2. In `src/pages/api/projects/create.ts`, `src/pages/api/scenes/create.ts`, and both new `.astro` pages: `@typescript-eslint/no-unnecessary-condition` false-positives on the Supabase `error`/`data` null checks after `.single()` (claims they're always truthy/falsy). Confirmed via `astro check` (0 errors) that the checks are real and necessary; suppressed locally with `eslint-disable`/`eslint-enable` around each guard, with an inline comment explaining why.

Both were approved via the implement skill's mismatch flow before proceeding.

### Phase 1 manual verification complete (2026-08-13)

WSL 2 / Docker blocker described below is resolved. `npx supabase start` and `npx supabase db reset` both completed successfully; the migration applied cleanly (resolves 1.1). Local Supabase Studio confirmed RLS enabled with the owner policy (`projects_owner_all`, `scenes_owner_all`, `scene_cards_owner_all`) on all three tables (resolves 1.6). The no-key mock path is covered by the passing automated adapter test suite (resolves 1.7). All Phase 1 Progress rows are now `[x]`. Commit for Phase 1 is being prepared; Phase 2 has not started.

### Phase 1 paused — resuming after Windows restart (Docker virtualization fix)

**Why paused**: Docker Desktop reported "Virtualization support not detected" even though Task Manager shows hardware virtualization enabled. User is restarting Windows to resolve it. `npx supabase db reset` cannot run until Docker's engine is actually up.

**What is done (code-complete, do not redo)**:
- All Phase 1 files written: `supabase/migrations/20260802120000_create_scene_forge_core.sql`, `astro.config.mjs` (+`ANTHROPIC_API_KEY`), `src/lib/forge-scene/{types,mock,anthropic,adapter}.ts`, `src/lib/forge-scene/adapter.test.ts`, `vitest.config.ts`, `package.json` (+`test` script, +`@anthropic-ai/sdk`, +`vitest` devDependency).
- `npm run test` — 7/7 unit tests pass.
- `npx astro check` — 0 errors, 0 warnings.
- `npm run build` — succeeds.
- Lint on changed files — clean apart from the known pre-existing repo-wide CRLF/Prettier condition (confirmed pre-existing via `git stash` + lint before any Phase 1 change: 1023 errors on the untouched repo).
- Implementation deviation from plan text (not yet reflected in `plan.md`, which is read-only during implementation): `adapter.ts` takes the Anthropic API key as a parameter instead of reading `astro:env/server` internally, since that virtual module isn't resolvable under Vitest. Phase 3's forge route is expected to read the env var and pass it in.

**What is NOT done — do not mark complete, do not commit**:
- Progress item 1.1 (migration applies cleanly via `supabase db reset`) — blocked, not run.
- Progress item 1.6 (Supabase Studio shows RLS enabled on all three tables) — not verified.
- Progress item 1.7 (no-key path resolves to mock) — automated test already covers this, but not yet user-confirmed per the manual-verification convention.
- No commit has been made for Phase 1. No files are staged.
- Phase 2 has not started.

**Resume checklist (user's explicit sequence)**:
1. Confirm Docker Desktop's engine is actually running (not just installed).
2. Run `npx supabase db reset` and confirm the migration applies cleanly.
3. If it succeeds, walk through verifying the three tables (`projects`, `scenes`, `scene_cards`) and their RLS policies in local Supabase Studio.
4. Verify the no-key mock-path requirement (1.7).
5. Show the implementation diff and changed-file summary — *before* any commit.

**Commands that must NOT be run yet**: `git add` / `git commit` for Phase 1, anything from Phase 2.

### External environment blocker — WSL 2 unavailable (company-managed machine)

**Why blocked**: The Windows restart did not resolve the Docker issue as hoped. Docker Desktop cannot start because WSL 2 is not installed, and `wsl --install` requires administrator elevation. This is a **company-managed Windows machine** — the user does not have local administrator privileges and cannot self-service this install. This is a distinct, harder blocker than the earlier "virtualization not detected" one: it is a permissions/IT-policy blocker, not a BIOS/hardware setting the user can flip themselves.

**Practical effect**: `npx supabase db reset` cannot run locally until either (a) IT grants WSL 2 install rights or performs the install, or (b) an alternative verification path is used (see remaining manual steps below).

**What was done today (read-only, no state change)**:
- Reviewed the complete Phase 1 changed-file set and diff.
- Performed a static review of the migration SQL and RLS policies (see review notes below) — no correctness bugs found in the ownership/isolation model; a few non-blocking observations recorded (missing indexes on `user_id`/`project_id` for RLS-filtered lookups; no `to authenticated` clause on policies; no `updated_at` refresh trigger; snake_case↔camelCase mapping between `scene_cards` columns and `SceneCardFields` will need to happen explicitly in Phase 3's forge route, since it isn't handled anywhere yet).
- No files modified other than this entry. No commits made. Phase 2 not started.

**Still not done — unchanged from before**:
- Progress items 1.1 and 1.6 (migration apply + RLS verification in Studio) — blocked on local Supabase, itself blocked on Docker/WSL 2.
- Progress item 1.7 — automated test coverage exists, user-confirmation step still pending.
- No commit for Phase 1.

**Remaining manual verification steps once WSL 2 + Docker are available** (unchanged sequence, restated for resumption):
1. Confirm Docker Desktop's engine is actually running.
2. Run `npx supabase db reset` and confirm the migration applies cleanly (resolves 1.1).
3. In local Supabase Studio, confirm RLS is enabled and the owner policy is present on `projects`, `scenes`, and `scene_cards` (resolves 1.6).
4. Confirm the no-key path resolves to mock generation — either re-run `npm run test` and treat the existing automated coverage as the confirmation, or invoke `generateSceneCard()` directly from a scratch script with `ANTHROPIC_API_KEY` unset (resolves 1.7).
5. Only after 1–4 pass: stage and commit Phase 1, write the commit SHA back into `## Progress`, then proceed to Phase 2.

**Alternative path if WSL 2 approval is delayed**: ask IT for either (a) admin rights to run `wsl --install` once, or (b) a machine-level WSL 2 install pushed via whatever software-deployment tool the company uses. There is no code-level workaround for step 2 — `supabase db reset` requires a local Postgres container, which requires Docker, which requires WSL 2 on Windows.
