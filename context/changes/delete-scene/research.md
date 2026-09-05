---
date: 2026-09-05T20:30:00+02:00
researcher: Claude
git_commit: cfc4dca9b0de577ad26ab00926b81b4e12b10308
branch: main
repository: LukeGander/scene-forge
topic: "Smallest user-facing Delete Scene feature to complete full CRUD for the Scene resource (10xBuilder certification)"
tags: [research, codebase, scenes, delete, crud, rls, cascade]
status: complete
last_updated: 2026-09-05
last_updated_by: Claude
---

# Research: Smallest user-facing Delete Scene feature (Scene CRUD completion)

**Date**: 2026-09-05T20:30:00+02:00
**Researcher**: Claude
**Git Commit**: cfc4dca9b0de577ad26ab00926b81b4e12b10308
**Branch**: main
**Repository**: LukeGander/scene-forge

## Research Question

Add the smallest user-facing Delete Scene feature required to complete full CRUD for the Scene resource for 10xBuilder certification. Scope: authenticated owner can delete their own scene; another user must not be able to; confirmation before deletion; on success return to the parent project's scene list; visible error on failure; dependent scene-card data handled safely per current DB relationships. Explicitly excluded: project update/delete, standalone scene-card delete, soft delete, bulk delete, unrelated refactors. Reuse existing auth/ownership/API/UI patterns.

## Summary

**No new migration is needed.** The database already has everything this feature requires: `scene_cards.scene_id` is `ON DELETE CASCADE` back to `scenes(id)` ([supabase/migrations/20260802120000_create_scene_forge_core.sql:23](https://github.com/LukeGander/scene-forge/blob/cfc4dca9b0de577ad26ab00926b81b4e12b10308/supabase/migrations/20260802120000_create_scene_forge_core.sql#L23)), no other table references `scenes(id)`, RLS on `scenes` is `FOR ALL` (covers DELETE) scoped to `user_id = auth.uid()`, and `DELETE` is already `GRANT`ed to `authenticated` on both `scenes` and `scene_cards`. A plain owner-scoped `.from("scenes").delete().eq("id", id).eq("user_id", user.id)` call — the exact idiom every existing route already uses for reads/writes — is DB-sufficient; the FK cascade removes the dependent `scene_card` row automatically.

The gaps are entirely in application code, and they're small:

1. **No DELETE route exists anywhere in production** (`/api/test/cleanup-project` is test-only and excluded). The one precedent for delete _syntax_ in this codebase is that test-support route.
2. **No confirmation-UI, no client-side "fetch success → navigate away" pattern, and no Dialog/modal primitive** exist anywhere in the app today. The only "action then leave the page" precedent is a plain HTML form POST + full-page server redirect (used by the two create flows) — not directly reusable for a confirm-first, then-fetch, then-navigate flow.
3. **`scenes/[id].astro` doesn't currently select `project_id`** — needed to know where "the parent project's scene list" is. `forge.ts` already demonstrates selecting `project_id` from `scenes` for its own purposes, so this is a one-line, precedented addition, not a new pattern.
4. This directly fulfills PRD requirement **FR-015: "Creator can delete a scene. Priority: nice-to-have"** ([context/foundation/prd.md:95](https://github.com/LukeGander/scene-forge/blob/cfc4dca9b0de577ad26ab00926b81b4e12b10308/context/foundation/prd.md#L95)). Scene/project delete was explicitly deferred out of an earlier slice (`browse-projects-and-scenes`) with no rationale beyond scope-sequencing — there is no design decision on record that this change would be overriding.

## Detailed Findings

### Database: scenes / scene_cards schema, RLS, grants, cascade

- `scenes` table ([supabase/migrations/20260802120000_create_scene_forge_core.sql:11-19](https://github.com/LukeGander/scene-forge/blob/cfc4dca9b0de577ad26ab00926b81b4e12b10308/supabase/migrations/20260802120000_create_scene_forge_core.sql#L11-L19)): `id`, `project_id` (FK → `projects`, `on delete cascade`), `user_id` (FK → `auth.users`, `on delete cascade`), `title`, `note`, `created_at`, `updated_at`.
- `scene_cards` table ([supabase/migrations/20260802120000_create_scene_forge_core.sql:21-36](https://github.com/LukeGander/scene-forge/blob/cfc4dca9b0de577ad26ab00926b81b4e12b10308/supabase/migrations/20260802120000_create_scene_forge_core.sql#L21-L36)): `scene_id uuid not null unique references public.scenes(id) on delete cascade` (line 23) — this is the exact, sole FK anywhere in the schema that targets `scenes(id)`; grepping all three migration files for `scenes(id)` returns only this one match. **No other table would be affected by deleting a scene.**
- RLS: `scenes_owner_all` ([:44-45](https://github.com/LukeGander/scene-forge/blob/cfc4dca9b0de577ad26ab00926b81b4e12b10308/supabase/migrations/20260802120000_create_scene_forge_core.sql#L44-L45)) and `scene_cards_owner_all` ([:46-47](https://github.com/LukeGander/scene-forge/blob/cfc4dca9b0de577ad26ab00926b81b4e12b10308/supabase/migrations/20260802120000_create_scene_forge_core.sql#L46-L47)) are both `for all using (user_id = auth.uid()) with check (user_id = auth.uid())` — `FOR ALL` covers DELETE, not just read/write.
- Grants: `grant select, insert, update, delete on table public.scenes to authenticated;` and the identical statement for `scene_cards` ([supabase/migrations/20260813210000_grant_scene_forge_core_privileges.sql:2-3](https://github.com/LukeGander/scene-forge/blob/cfc4dca9b0de577ad26ab00926b81b4e12b10308/supabase/migrations/20260813210000_grant_scene_forge_core_privileges.sql#L2-L3)) — `DELETE` is already granted on both tables. This satisfies the project's own recorded lesson ("every migration that creates a table and enables RLS must GRANT ... to authenticated in the same migration") — already true here, nothing to add.
- Cascade-privilege semantics (confirmed, not guessed): a Postgres `ON DELETE CASCADE` removal of the child row is enforced by the FK's trigger machinery as part of the parent statement, not re-checked as an independent, separately-privileged DML statement by the acting role. The deleting role only needs `DELETE` + RLS visibility on `scenes` (the table it directly deletes from). This is moot here regardless, since `scene_cards` independently also has `DELETE` granted and an owner-scoped `FOR ALL` policy.

**Conclusion: zero new migration is required.** `.from("scenes").delete().eq("id", id).eq("user_id", user.id)` is fully sufficient at the DB layer, and it satisfies "existing dependent scene-card data should be handled safely" by construction (cascade).

### Existing API route conventions to reuse

Every mutation route follows the same shape (verified directly, e.g. [src/pages/api/scenes/[id]/note.ts](https://github.com/LukeGander/scene-forge/blob/cfc4dca9b0de577ad26ab00926b81b4e12b10308/src/pages/api/scenes/%5Bid%5D/note.ts), [src/pages/api/scenes/[id]/card.ts](https://github.com/LukeGander/scene-forge/blob/cfc4dca9b0de577ad26ab00926b81b4e12b10308/src/pages/api/scenes/%5Bid%5D/card.ts)):

1. `createClient(context.request.headers, context.cookies)`; if falsy, 500 "Supabase is not configured".
2. `context.locals.user`; if falsy, 401 `{ error: "Not authenticated" }`.
3. Owner-scoped query: `.eq("id"/"scene_id", id).eq("user_id", user.id)`; on error/no-row, 404 (never leaks existence to a non-owner — this is exactly the cross-user 404 contract Phase 1's ownership tests already assert).
4. A **locally-defined** `jsonResponse(body, status)` helper, duplicated per-file rather than shared/imported from a common module — every route re-implements it rather than importing one.
5. CSRF: Astro's `security.checkOrigin` is on by default for `output: "server"` (confirmed — `astro.config.mjs` has no explicit `security` block, so the default applies); the app relies on the browser sending a same-origin `Origin` header automatically for real requests, and test-support code sets it manually to match (`src/lib/test-support/auth-fixture.ts`'s `apiFetch`).

**No production route exports `DELETE` anywhere** (confirmed via `grep -rn "^export const \(PATCH\|PUT\|DELETE\)"` across `src/pages/api`, excluding `test/`). The _only_ delete-syntax precedent in the whole codebase is the test-support route: `supabase.from("projects").delete().eq("id", body.projectId).eq("user_id", user.id)` ([src/pages/api/test/cleanup-project.ts:52](https://github.com/LukeGander/scene-forge/blob/cfc4dca9b0de577ad26ab00926b81b4e12b10308/src/pages/api/test/cleanup-project.ts#L52)) — same idiom, different table, and excluded from counting toward CRUD per your instruction, but it is the right syntax to mirror.

File-naming convention is **one-file-per-action** under `src/pages/api/scenes/[id]/` (`note.ts`, `card.ts`, `forge.ts`), not one `index.ts` bundling multiple HTTP verbs for the resource. There is no existing `[id]/index.ts` anywhere in this app. A new delete route can equally-plausibly be named to match either the action-file convention (e.g. a new file, HTTP method as appropriate) or become the first `[id]/index.ts` in the app (more RESTful — `DELETE /api/scenes/{id}`). Both are "reusing an existing pattern" in a real sense; neither is unambiguously _the_ existing pattern, since this app has never had a resource-root file before. This is a planning decision, not something research can settle.

### UI: confirmation, error display, and post-action navigation

- **No confirmation-before-destructive-action pattern exists anywhere.** Zero matches for `window.confirm`, `AlertDialog`, `Modal`, or "are you sure" in `src/**`.
- **No Dialog/AlertDialog/Modal primitive is installed.** `src/components/ui/` contains exactly two files: `LibBadge.astro` and `button.tsx`. `package.json` lists only `@radix-ui/react-slot` among Radix packages — no `@radix-ui/react-dialog` or `@radix-ui/react-alert-dialog`.
- `src/components/ui/button.tsx:13-14` already defines an unused `variant="destructive"` (`bg-destructive text-white shadow-xs hover:bg-destructive/90 ...`) — directly reusable for a delete button with zero new dependencies.
- **No client-side "fetch succeeds → navigate the browser away" pattern exists.** Zero matches for `window.location` anywhere in `src/**`. The two existing "action then leave the page" flows (`NewProjectForm.tsx`, `NewSceneForm.tsx`) are plain `<form method="POST" action="...">` submissions relying on the server's `context.redirect(...)` and a full page load — not a `fetch()` + client-side redirect. Every component that _does_ use `fetch()` (`NoteEditor.tsx`, `SceneCard.tsx`, `ForgeSceneButton.tsx`) stays on the page and only updates local React state.
- **`ServerError`** ([src/components/auth/ServerError.tsx:3-16](https://github.com/LukeGander/scene-forge/blob/cfc4dca9b0de577ad26ab00926b81b4e12b10308/src/components/auth/ServerError.tsx#L3-L16)) is the established, reusable error-display component — single `message?: string | null` prop, renders `null` when falsy, styled red alert row with a `CircleAlert` icon. Used identically by `NoteEditor.tsx`, `SceneCard.tsx`, `ForgeSceneButton.tsx`, and the auth forms: `setError(...)` (or an equivalent state field) on a non-ok response or a caught network exception, rendered via `<ServerError message={...} />`. This is the direct precedent for "show a visible error if deletion fails."

**Net implication for planning**: since neither existing "success" pattern (full-page form redirect, or stay-on-page fetch) fits a confirm-first / then-delete / then-navigate-away flow cleanly, the smallest reuse-consistent option is a small React island (matching the existing one-component-per-interactive-affordance convention: `NoteEditor`, `SceneCard`, `ForgeSceneButton`) that (a) holds a local confirm/idle/error state — mirroring `ForgeSceneButton`'s existing hand-rolled state-machine style rather than introducing a modal library — (b) calls the new API route via `fetch()` with the existing `ServerError` component for failures, and (c) does `window.location.href = ...` on success. This would be the first use of `window.location` in the codebase, but it's a small, targeted use of a standard browser API, not a new architectural pattern.

### `scenes/[id].astro` — current state and the one data gap

Current query ([src/pages/scenes/[id].astro:23-28](https://github.com/LukeGander/scene-forge/blob/cfc4dca9b0de577ad26ab00926b81b4e12b10308/src/pages/scenes/%5Bid%5D.astro#L23-L28)) selects only `id, title, note, updated_at` from `scenes` — **`project_id` is not selected**, so the page currently has no way to know its own parent project's id (needed both to build the post-delete redirect target and to link "back to project"). `forge.ts` already selects `project_id` from `scenes` for its own purposes ([src/pages/api/scenes/[id]/forge.ts:41-46](https://github.com/LukeGander/scene-forge/blob/cfc4dca9b0de577ad26ab00926b81b4e12b10308/src/pages/api/scenes/%5Bid%5D/forge.ts#L41-L46)), so adding `project_id` to this page's select list is a precedented, one-line change, not a new pattern.

`Topbar.astro` ([src/components/Topbar.astro:13-15](https://github.com/LukeGander/scene-forge/blob/cfc4dca9b0de577ad26ab00926b81b4e12b10308/src/components/Topbar.astro#L13-L15)) only links to `/dashboard` ("Projects"), not to the specific parent project — `scenes/[id].astro` currently has no "back to project" link at all. Not in scope to fix generally, but worth noting since the delete feature's redirect target (`/projects/{projectId}`) is a page this scene currently has zero outbound link to.

### Historical context (from prior changes)

- **PRD**: `FR-015: Creator can delete a scene. Priority: nice-to-have` ([context/foundation/prd.md:95](https://github.com/LukeGander/scene-forge/blob/cfc4dca9b0de577ad26ab00926b81b4e12b10308/context/foundation/prd.md#L95)). Adjacent, explicitly-excluded-by-your-scope requirements: `FR-007: Creator can edit a project's context` (:75) and `FR-008: Creator can delete a project` (:77), both also "nice-to-have".
- `context/archive/2026-08-30-browse-projects-and-scenes/plan.md:30-36` and its `plan-brief.md:35` explicitly park "project/scene edit or delete (FR-007/FR-008/FR-015, parked)" as out of scope for that slice — with no stated rationale beyond scope-sequencing (contrast with `enforce-scene-readiness`, which documents detailed reasoning for its own deferrals). There is no on-record product/design decision this change would be overriding by building scene delete now.
- `context/archive/2026-08-30-edit-note-after-generation/plan-brief.md:7`: _"Without this, correcting a note after a poor first generation currently forces a full scene delete/recreate."_ — implies deletion has only ever happened out-of-band (e.g. via Supabase Studio), never via an in-app affordance. Consistent with the CRUD audit finding zero delete routes in production.
- The `ON DELETE CASCADE` FK from `scene_cards` to `scenes` was set in the very first schema migration (`context/changes/first-forged-scene-card/plan.md`'s Phase 1) with no recorded design discussion — it was a default schema choice, never revisited, that happens to already be exactly the "handle dependent scene-card data safely" behavior this new feature needs.
- No prior change anywhere discusses confirmation-before-delete UI, in any form.

## Code References

- `supabase/migrations/20260802120000_create_scene_forge_core.sql:11-19` — `scenes` table
- `supabase/migrations/20260802120000_create_scene_forge_core.sql:21-36` — `scene_cards` table, `scene_id` FK `on delete cascade` at line 23
- `supabase/migrations/20260802120000_create_scene_forge_core.sql:44-47` — RLS policies (`scenes_owner_all`, `scene_cards_owner_all`)
- `supabase/migrations/20260813210000_grant_scene_forge_core_privileges.sql:2-3` — `DELETE` grants on both tables
- `src/pages/api/scenes/[id]/note.ts`, `card.ts`, `forge.ts` — the auth/ownership/`jsonResponse` route convention to mirror
- `src/pages/api/test/cleanup-project.ts:52` — the only existing delete-syntax precedent (test-only, excluded from CRUD)
- `src/pages/scenes/[id].astro:23-28` — scene query missing `project_id`
- `src/components/auth/ServerError.tsx:3-16` — reusable error-display component
- `src/components/ui/button.tsx:13-14` — unused `destructive` button variant
- `src/components/scenes/ForgeSceneButton.tsx` — precedent for a hand-rolled local state machine (idle/loading/success/error) for an interactive island
- `src/lib/test-support/scene-fixtures.ts` (`createProject`, `createScene`) and `src/pages/api/scenes/[id]/note.test.ts` — the existing two-user-ownership Vitest integration-test shape (unauthenticated → 401, cross-user → 404, owner → success) a delete-route test should mirror
- `context/foundation/prd.md:95` — FR-015

## Architecture Insights

- Ownership is always enforced by a **double layer**: an explicit `.eq("user_id", user.id)` in the application query AND an independent RLS policy at the DB layer — the delete route should keep both, matching every existing route, not rely on RLS alone.
- This app has no shared cross-route utility module for `jsonResponse` — each route redefines it. Reusing that (i.e., NOT extracting a shared helper) is the "no unrelated refactors" choice.
- Interactive, stateful UI is always its own small React island per affordance (`NoteEditor`, `SceneCard`, `ForgeSceneButton`) with a hand-rolled discriminated-union state type, never a shared generic component — a delete-scene component should follow that same shape rather than introducing a generic "ConfirmButton" abstraction.
- Nothing in this app currently leaves the SPA-like island model to force a real browser navigation from client JS — this feature will be the first to need that, but only as a single `window.location.href` assignment on success, not a routing-library addition.

## Related Research

None — this is the first research document for this change. No other `context/changes/**/research.md` or `context/archive/**/research.md` addresses scene/project/scene-card deletion.

## Open Questions

1. **Route naming/shape**: `src/pages/api/scenes/[id]/delete.ts` (matches this app's action-per-file convention) vs. `src/pages/api/scenes/[id]/index.ts` exporting `DELETE` (more RESTful, first use of that shape here). No existing precedent settles this either way — a planning decision.
2. **Confirm mechanic**: a native `window.confirm()` (zero new code/dependencies) vs. a two-step in-component button-state toggle (matches this app's preferred hand-rolled-state-machine style more closely, no browser-native dialog). Both fit "reuse existing patterns" in different ways since there is no existing confirm precedent at all.
3. **Exact placement** of the delete affordance on `scenes/[id].astro` (near `Topbar`, near the page title, or beside `NoteEditor`/`ForgeSceneButton`) is a UI decision, not something the research surfaced a constraint on.
4. Whether the new route should be tested with a dedicated Vitest integration test file (mirroring `note.test.ts`'s three-case shape: unauthenticated, cross-user, owner-success) is a planning/testing-strategy decision — the precedent clearly exists and fully supports it if wanted.
