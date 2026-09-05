# Delete Scene — Plan Brief

> Full plan: `context/changes/delete-scene/plan.md`
> Research: `context/changes/delete-scene/research.md`

## What & Why

Add the smallest user-facing Delete Scene feature to complete full CRUD for the Scene resource, fulfilling PRD FR-015 ("Creator can delete a scene"). Today there is zero delete capability anywhere in the production app for any entity — this closes that gap for scenes specifically.

## Starting Point

No DELETE route exists in production (only a test-only cleanup endpoint, which doesn't count). The database, however, is already fully ready: `scene_cards` has an `ON DELETE CASCADE` foreign key back to `scenes`, and `DELETE` is already granted + RLS-covered on both tables — no migration needed. No confirm-dialog or client-side navigate-on-success pattern exists anywhere in the app yet.

## Desired End State

A creator viewing their own scene sees a "Danger Zone" section with a "Delete Scene" control. Clicking it asks for confirmation (naming the scene, warning that its generated card will go too), then deletes the scene and returns the creator to the parent project's scene list. Another user can never reach or trigger this — the existing per-owner 404 on the scene page already prevents it. A failed delete shows a visible, retryable error.

## Key Decisions Made

| Decision          | Choice                                                       | Why (1 sentence)                                                                                                                         | Source   |
| ----------------- | ------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------- | -------- |
| Confirmation UX   | Inline two-step button state (not native `window.confirm()`) | Matches this app's existing hand-rolled state-machine components and its E2E-testing conventions.                                        | Plan     |
| Control placement | Bottom "Danger Zone" section, not inline near the title      | Standard danger-zone convention, lowest misclick risk.                                                                                   | Plan     |
| Confirmation copy | Names the scene + warns about card loss                      | Surfaces the silent DB cascade explicitly so the creator isn't surprised.                                                                | Plan     |
| Test coverage     | Vitest integration test only, no new E2E spec                | Matches `test-plan.md`'s own cost×signal principle for an ownership-scoped CRUD delete.                                                  | Plan     |
| "Ready" scenes    | No extra friction or special-casing                          | Keeps the feature exactly as small as scoped; avoids a new "protected state" concept.                                                    | Plan     |
| Route shape       | New `src/pages/api/scenes/[id]/index.ts` exporting `DELETE`  | First resource-root route in the app, but consistent with `note.ts`/`card.ts` already using real REST verbs for their own sub-resources. | Plan     |
| Migration         | None                                                         | DB already has cascade + grants + RLS covering DELETE on both tables.                                                                    | Research |

## Scope

**In scope:**

- Owner-scoped `DELETE /api/scenes/{id}` route
- Confirm-then-delete-then-redirect UI control on the scene page
- Vitest integration test (unauthenticated / cross-user / owner + cascade)

**Out of scope:**

- Project update/delete
- Standalone scene-card delete
- Soft delete
- Bulk delete
- Any new migration
- New E2E test
- Toast/notification system, shared confirm-dialog abstraction, cross-island locking

## Architecture / Approach

Two phases, backend then frontend — the DELETE route relies entirely on the existing owner-scoped-query + RLS + FK-cascade pattern every other route already uses, proven independently by an integration test before any UI is built on top of it. The UI is a new, self-contained React island (`DeleteSceneButton`) mirroring the exact state-machine shape of `ForgeSceneButton`, reusing the existing `ServerError` component and the already-defined-but-unused `destructive` button variant.

## Phases at a Glance

| Phase       | What it delivers                                                                                   | Key risk                                                                                                                                                               |
| ----------- | -------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1. Backend  | `DELETE /api/scenes/{id}` route + integration test proving ownership + cascade                     | A bare `.delete()` call doesn't error on a zero-row (cross-user) match — must chain `.select().single()` to force a real 404, or the ownership boundary silently fails |
| 2. Frontend | Confirm-then-delete UI wired into the scene page, with the missing `project_id` added to its query | None significant — small, fully precedented UI addition                                                                                                                |

**Prerequisites:** none beyond what's already in the repo (Supabase running locally, dev server for the integration test).
**Estimated effort:** ~1 session across 2 phases.

## Open Risks & Assumptions

- Assumes deleting a scene regardless of its status (including "Ready") is acceptable with only the standard confirmation — confirmed explicitly during planning, not a residual risk.
- The zero-row-delete-vs-error ambiguity (see Key Decisions / Critical Implementation Details in the full plan) is the one place a naive implementation could silently fail the "another user must not be able to delete it" requirement without any test catching it unless the integration test's cross-user case is written carefully.

## Success Criteria (Summary)

- An owner can delete their own scene through the UI, with confirmation, and lands back on their project's scene list.
- A non-owner can never delete or even reach the control for someone else's scene.
- Deleting a scene leaves no orphaned `scene_cards` row behind.
