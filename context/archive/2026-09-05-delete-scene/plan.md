# Delete Scene Implementation Plan

## Overview

Add the smallest user-facing Delete Scene feature to complete full CRUD for the Scene resource (PRD FR-015): an authenticated owner can permanently delete their own scene through a confirm-then-delete UI control; another user cannot delete it; the dependent scene card is removed safely via the existing DB foreign-key cascade; on success the creator returns to the parent project's scene list; on failure a visible error is shown.

## Current State Analysis

- No DELETE route exists in production for any entity (`scenes`, `projects`, `scene_cards`). The only precedent for delete syntax anywhere in the codebase is the test-only `/api/test/cleanup-project` route.
- The database is already fully ready: `scene_cards.scene_id` is `on delete cascade` back to `scenes(id)`, no other table references `scenes(id)`, RLS policies on both tables are `FOR ALL` (covers DELETE), and `DELETE` is already `GRANT`ed to `authenticated` on both tables. **No new migration is needed.**
- `scenes/[id].astro` currently selects only `id, title, note, updated_at` — no `project_id` — so the page has no way to know its own parent project today.
- No confirm-dialog, modal, or client-side "fetch success → navigate away" pattern exists anywhere in this app. The two existing "leave the page on success" flows (project/scene creation) are plain HTML form POSTs with server-side redirects, not `fetch()`-driven.
- Every existing mutation route follows an identical auth/ownership/error shape: `createClient` → check `context.locals.user` → owner-scoped query (`.eq("id"/"scene_id", id).eq("user_id", user.id)`) → 401/404/500 JSON via a locally-defined `jsonResponse` helper (duplicated per file, not shared).
- Every interactive scene-page affordance is its own small React island with a hand-rolled local state machine (`NoteEditor`, `SceneCard`, `ForgeSceneButton`), never a shared generic component.
- `src/components/ui/button.tsx` already defines an unused `destructive` variant.
- `src/components/auth/ServerError.tsx` is the established, reusable error-display component (`message?: string | null`).

## Desired End State

An authenticated creator viewing their own scene at `/scenes/{id}` sees a "Danger Zone" section below the existing note/card UI. Clicking "Delete Scene" reveals an inline confirmation naming the scene and warning that its generated card (if any) will also be removed. Confirming sends `DELETE /api/scenes/{id}`; on success the browser navigates to `/projects/{projectId}`; on failure a visible error message appears and the control remains usable. A different signed-in user hitting `/scenes/{id}` for a scene they don't own still gets the existing 404 (unchanged) and never sees this control. Deleting a scene removes its `scene_cards` row automatically — no orphaned data.

Verification:

- The new Vitest integration test passes: unauthenticated → 401, cross-user → 404 (no leak, nothing deleted), owner → 204 with the scene_card cascade confirmed.
- `npm run lint` / `astro check` are clean.
- Manual: delete a scene with and without a generated card; confirm cancel leaves everything unchanged; confirm a simulated failure shows a visible, retryable error.

### Key Discoveries:

- `supabase/migrations/20260802120000_create_scene_forge_core.sql:23` — `scene_cards.scene_id ... on delete cascade` — no app-level cleanup code needed for the dependent card.
- `supabase/migrations/20260813210000_grant_scene_forge_core_privileges.sql:2-3` — `DELETE` already granted on both tables; no new migration.
- `src/pages/api/test/cleanup-project.ts:52` — the only existing delete-syntax precedent, and its `204` no-body success response shape.
- `src/pages/api/scenes/[id]/forge.ts:41-46` — precedent for selecting `project_id` from `scenes` in a route.
- `src/pages/scenes/[id].astro:23-28` — current scene query, missing `project_id`.
- `src/components/scenes/ForgeSceneButton.tsx` — the hand-rolled local-state-machine shape to mirror for the new component.
- `src/lib/test-support/scene-fixtures.ts` + `src/pages/api/scenes/[id]/note.test.ts` — the exact three-case integration-test shape to mirror.

## What We're NOT Doing

- No project update or delete.
- No standalone scene-card delete (only via cascade when its parent scene is deleted).
- No soft delete — this is a real, permanent row deletion.
- No bulk delete.
- No new migration (the DB is already ready).
- No shared "ConfirmDialog"/"DangerZone" abstraction — the new component is self-contained, matching this app's one-component-per-affordance convention.
- No cross-island coordination/locking with `NoteEditor`/`ForgeSceneButton` during deletion.
- No toast/notification system.
- No extra friction or special-casing for scenes marked "Ready."
- No Playwright E2E test for this feature (per `test-plan.md`'s own cost×signal principle — an ownership-scoped CRUD delete is exactly what the Vitest integration-test layer already covers cheaply).

## Implementation Approach

Two phases, backend then frontend, matching this codebase's established layering and the fact that no data-model change is needed. Phase 1 delivers a fully-tested, independently-verifiable DELETE route with cascade behavior proven by an integration test — no UI needed to verify it. Phase 2 adds the page-query change and the confirm-UI component that calls that already-proven route.

## Critical Implementation Details

**Ownership enforcement on DELETE must not rely on a bare `.delete()` call.** A plain `supabase.from("scenes").delete().eq("id", id).eq("user_id", user.id)` does not error when zero rows match — Postgrest treats a zero-row delete as a normal success, and RLS silently prevents a cross-user row from being touched rather than raising an error. Without a further check, a cross-user delete attempt would incorrectly return success (200/204) instead of the required 404, even though nothing was actually deleted. The route must chain `.select("id").single()` onto the delete (the same `.single()`-forces-a-real-error idiom already used by every existing ownership-scoped `SELECT` in this codebase) so that a zero-row match produces a genuine Postgrest error the route can turn into 404.

## Phase 1: Backend — DELETE route + cascade verification

### Overview

Add the owner-scoped DELETE route for a scene, proven by a Vitest integration test that also confirms the scene_card cascade.

### Changes Required:

#### 1. DELETE route

**File**: `src/pages/api/scenes/[id]/index.ts` (new)

**Intent**: Let the authenticated owner permanently delete their own scene. Mirrors every other route's auth/ownership/error shape exactly; relies on the existing DB foreign-key cascade to remove the dependent `scene_cards` row — no explicit card-deletion code.

**Contract**: `export const DELETE: APIRoute`. No request body. Guards, in order: `createClient` falsy → 500 `{ error: "Supabase is not configured" }`; no `context.locals.user` → 401 `{ error: "Not authenticated" }`; missing `id` param → 404 `{ error: "Not found" }`. Delete: `supabase.from("scenes").delete().eq("id", id).eq("user_id", user.id).select("id").single()` (see Critical Implementation Details above for why `.select().single()` is required) — on error → 404 `{ error: "Not found" }` (never leak existence to a non-owner, matching every other route). On success → `204 No Content`, no body (mirrors `cleanup-project.ts`).

#### 2. Integration test

**File**: `src/pages/api/scenes/[id]/index.test.ts` (new)

**Intent**: Prove the ownership boundary and the cascade behavior, mirroring `note.test.ts`'s exact shape plus one addition this feature specifically needs: proof that deleting the scene also removes its `scene_cards` row.

**Contract**: Three `it()` cases using `createTestUser`/`createProject`/`createScene`/`apiFetch`:

- Unauthenticated `DELETE` → 401.
- Cross-user (an intruder deleting the owner's scene) → 404; a follow-up owner-authenticated action against the same scene (e.g. the note PATCH route) confirms the scene still exists and is unchanged.
- Owner-success: create a scene, forge a card on it (via the real `/api/scenes/{id}/forge` route, mock path), `DELETE` it as the owner → 204; a follow-up owner-authenticated action against the same scene id (e.g. the note PATCH route) now 404s — proving both the scene and its cascaded card are gone, without needing direct DB access from the test.

### Success Criteria:

#### Automated Verification:

- `npx vitest run src/pages/api/scenes/[id]/index.test.ts` passes (requires `supabase start` + `npm run dev`, per this project's existing integration-test precondition)
- `npx eslint src/pages/api/scenes/[id]/index.ts src/pages/api/scenes/[id]/index.test.ts` passes
- `npx astro check` passes

#### Manual Verification:

- As the owner, delete a scene you own via a direct request → 204; the scene and its card are both gone from Supabase Studio.
- As a different signed-in user, attempt to delete someone else's scene → 404; nothing is removed.

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before proceeding to the next phase.

---

## Phase 2: Frontend — confirm-then-delete UI

### Overview

Add the `project_id` the scene page is missing, build the confirm-then-delete-then-redirect control, and wire it into the scene page's new "Danger Zone" section.

### Changes Required:

#### 1. Scene page query

**File**: `src/pages/scenes/[id].astro`

**Intent**: The page needs its own parent project's id to know the post-delete redirect target and to pass down to the new component.

**Contract**: Add `project_id` to the existing `scenes` select list and its inline result type; pass the resulting `scene.project_id` as a new `projectId` prop to the new component, alongside `sceneId` and `scene.title`.

#### 2. Delete control component

**File**: `src/components/scenes/DeleteSceneButton.tsx` (new)

**Intent**: A self-contained confirm-then-delete-then-redirect control, following this app's existing hand-rolled state-machine convention (see `ForgeSceneButton.tsx`).

**Contract**: Props `{ sceneId: string; projectId: string; sceneTitle: string }`. Local state is a discriminated union: `{ phase: "idle" } | { phase: "confirming" } | { phase: "deleting" } | { phase: "error"; message: string }`. Renders its own bordered "Danger Zone" section using the existing `destructive` button variant.

- `idle`: single "Delete Scene" button → click moves to `confirming`.
- `confirming`: text `` `Delete "${sceneTitle}"? Its generated card (if any) will be deleted too. This cannot be undone.` ``, plus "Yes, delete" (`variant="destructive"`) and "Cancel" (`variant="outline"`, returns to `idle`).
- `deleting`: both buttons disabled, "Yes, delete" reads "Deleting..." (matches `ForgeSceneButton`'s "Forging scene..." / `SceneCard`'s "Saving..." copy convention); fires `fetch(\`/api/scenes/${sceneId}\`, { method: "DELETE" })`. On `response.ok` → `window.location.href = \`/projects/${projectId}\``. On non-ok → `phase: "error"`with`body.error`(falling back to a generic message, matching every existing component's fallback convention). On a thrown exception →`phase: "error"`with`"Network error — could not reach the server"` (copied verbatim from the existing components' identical copy).
- `error`: renders `<ServerError message={state.message} />` above the same confirm-equivalent controls so the user can retry (returns to `confirming`, not silently back to `idle`).

#### 3. Wire into the scene page

**File**: `src/pages/scenes/[id].astro`

**Intent**: Render the new control in its own section below the existing content.

**Contract**: Add `<DeleteSceneButton sceneId={scene.id} projectId={scene.project_id} sceneTitle={scene.title} client:load />` after the existing `<ForgeSceneButton ... />`, inside the same page container.

### Success Criteria:

#### Automated Verification:

- `npx eslint src/pages/scenes/[id].astro src/components/scenes/DeleteSceneButton.tsx` passes
- `npx astro check` passes
- Phase 1's integration test still passes unchanged (no regressions to the route)

#### Manual Verification:

- As the owner, open a scene, click "Delete Scene", then "Cancel" — nothing happens, page unchanged.
- Click "Delete Scene" → "Yes, delete" on a scene with a generated card — redirected to `/projects/{projectId}`; the scene is gone from that project's list; its `scene_cards` row is gone (Supabase Studio).
- Repeat on a scene with no generated card yet — same redirect behavior, no errors.
- Simulate a failure and confirm a visible error appears and the control remains usable afterward.

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before proceeding to the next phase.

---

## Testing Strategy

### Unit Tests:

- None beyond the integration test — no new pure logic function is introduced.

### Integration Tests:

- `src/pages/api/scenes/[id]/index.test.ts`: unauthenticated → 401; cross-user → 404 with no data leak; owner → 204 with cascade-verified card removal.

### Manual Testing Steps:

1. As the owner, cancel out of the confirm step — verify no request is sent and the scene is untouched.
2. As the owner, delete a scene that has a generated card — verify redirect to the parent project and that both the scene and its card are gone.
3. As the owner, delete a scene with no card yet — verify the same redirect behavior.
4. As a different user, confirm the existing 404 on the page itself already prevents ever reaching this control.
5. Force a failure and confirm the error is visible and the control is still usable afterward.

## Performance Considerations

None — a single-row delete on an indexed primary key; no new query patterns or load concerns.

## Migration Notes

None — no schema change; relies entirely on the existing `ON DELETE CASCADE` foreign key.

## References

- Related research: `context/changes/delete-scene/research.md`
- Delete-syntax precedent: `src/pages/api/test/cleanup-project.ts:52`
- Ownership/error-shape precedent: `src/pages/api/scenes/[id]/note.ts`, `src/pages/api/scenes/[id]/card.ts`
- Integration-test shape precedent: `src/pages/api/scenes/[id]/note.test.ts`
- UI state-machine precedent: `src/components/scenes/ForgeSceneButton.tsx`
- Error-display precedent: `src/components/auth/ServerError.tsx`

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles. See `references/progress-format.md`.

### Phase 1: Backend — DELETE route + cascade verification

#### Automated

- [x] 1.1 Vitest integration test passes (`index.test.ts`) — 08f8aed
- [x] 1.2 ESLint passes on new files — 08f8aed
- [x] 1.3 astro check passes — 08f8aed

#### Manual

- [x] 1.4 Owner delete via a direct request → 204, scene + card gone — 08f8aed
- [x] 1.5 Cross-user delete attempt → 404, nothing removed — 08f8aed

### Phase 2: Frontend — confirm-then-delete UI

#### Automated

- [x] 2.1 ESLint passes on changed/new files — 9c60b91
- [x] 2.2 astro check passes — 9c60b91
- [x] 2.3 Phase 1 integration test still passes — 9c60b91

#### Manual

- [x] 2.4 Cancel leaves scene untouched — 9c60b91
- [x] 2.5 Delete scene with a card — redirect + card gone — 9c60b91
- [x] 2.6 Delete scene without a card — redirect works — 9c60b91
- [x] 2.7 Simulated failure shows visible error, control still usable — 9c60b91
