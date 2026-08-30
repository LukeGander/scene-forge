# Browse Projects and Scenes Implementation Plan

## Overview

Roadmap slice `S-02`: let a creator view their list of projects and open a project to see all its scenes with current status. This is the read-only "production dashboard" that lets a creator with more than one project or scene find their way back in after the first session.

## Current State Analysis

The codebase has full creation flows (`/projects/new` → `/projects/[projectId]/scenes/new` → `/scenes/[id]`) and a working Forge Scene + readiness-gate loop, but **no way to browse back**. `src/pages/dashboard.astro:1-29` is a placeholder that only shows a welcome message and a single "New Project" link — it doesn't query anything. There is no `src/pages/projects/index.astro` and no `src/pages/projects/[projectId]/index.astro`. `src/components/Topbar.astro:13-15` links to `/dashboard` but nothing links to a project or scene list. No list-returning Supabase query (i.e. `.select()` without `.single()`/`.maybeSingle()`) exists anywhere yet.

### Key Discoveries:

- **No shared `Project`/`Scene` TypeScript types exist.** Every existing page/route declares an inline row interface at the call site matching DB column names (e.g. `SceneCardRow` in `src/pages/scenes/[id].astro:34-44`). This plan follows that same convention rather than introducing a new shared types module.
- **Page-shell convention**: every protected page independently re-derives the Supabase client and re-checks `user`, even though `src/middleware.ts:5-16` already redirects unauthenticated requests to `/projects`, `/scenes`, `/dashboard`, etc. — see `src/pages/scenes/[id].astro:11-14` and `src/pages/projects/[projectId]/scenes/new.astro:11-14`. New pages must follow this belt-and-suspenders pattern.
- **Ownership check pattern**: fetching a single owned row uses `.eq("id", id).eq("user_id", user.id).single()` (or `.maybeSingle()` for optional rows), returning a 404 `Response` on miss — see `src/pages/projects/[projectId]/scenes/new.astro:20-32`.
- **`scene_cards.status` is nullable in practice**: a scene only has a `scene_cards` row once Forge Scene has run at least once (`supabase/migrations/20260802120000_create_scene_forge_core.sql:21-36`). The scene list must treat "no row" as a distinct state, not as `"draft"`.
- **No `updated_at`-bumping trigger or edit route exists** for `projects` or `scenes` — both columns default to `now()` on insert and are never touched again (no project-edit route exists; scene note editing is S-05, not yet built). Sorting by `updated_at desc` is therefore currently equivalent to sorting by `created_at desc` for both tables; it will start reflecting real edits once a future slice adds an edit path. This plan sorts by each table's own `updated_at` and does not join `scene_cards` into the sort, to avoid solving an ordering problem that doesn't yet exist in practice.
- **Topbar is rendered per-page, not inside `Layout.astro`** (`src/components/Topbar.astro`, included manually at the top of each page's content div) — every existing protected page already includes it, so its "Projects" label change is visible everywhere immediately.
- **No list/card UI components exist** (`src/components/` has only single-item editors like `SceneCard.tsx` and forms). Since these new pages are entirely non-interactive (no client state, no form submission), list rendering belongs directly in the `.astro` templates — consistent with how `Topbar.astro` and other Astro components render conditional markup without a React island. No new React components are needed for this change.

## Desired End State

Visiting `/dashboard` while signed in shows the creator's list of projects (or an empty state with a "New Project" CTA if there are none), each linking to `/projects/[projectId]`. Opening a project shows its title/premise/tone plus the full list of its scenes, each showing a status badge — `Draft` / `Needs Work` / `Ready` / `Not forged yet` — and linking to `/scenes/[id]`, plus a "New Scene" CTA and a link back to the project list. The Topbar's "Dashboard" link is now labeled "Projects". Both lists are scoped strictly to the signed-in user via existing RLS + app-level `user_id` filtering, and both order by most-recently-updated.

### Verification
- Sign in, visit `/dashboard`: see all of your own projects, none of anyone else's.
- Click into a project: see all of its scenes with an accurate status badge, including "Not forged yet" for scenes that have never been forged.
- With zero projects (fresh account) or zero scenes (freshly created project), see the empty-state CTA instead of a blank list.

## What We're NOT Doing

- No new database migration, no new API route — this is pure server-rendered read access against the existing schema.
- No scene-count or other aggregate stats on the project list — just title and a link, matching FR-005's literal scope.
- No pagination — target scale is `small`/`low` per `tech-stack.md`; a plain list is sufficient for MVP.
- No project-edit (FR-007) or project/scene-delete (FR-008/FR-015) affordances — those are parked in the roadmap.
- No joining `scene_cards` into the sort order for scenes (see Key Discoveries above).
- No new shared `Project`/`Scene` TypeScript types module — following the established inline-interface-per-query convention.

## Implementation Approach

Two new/changed server-rendered Astro pages, no client-side JavaScript needed. Phase 1 turns `dashboard.astro` into the project list (the natural post-login landing page) and updates the Topbar label to match. Phase 2 adds `src/pages/projects/[projectId]/index.astro`, which fetches the project (ownership-checked) and its scenes, fetches scene_cards' statuses in a second query, merges them in application code via a `Map`, and renders the merged list. Both phases reuse the exact ownership-check, 404, and page-shell patterns already established by the creation-flow pages.

## Phase 1: Projects List

### Overview

Replace the placeholder dashboard with a real project list, and update site navigation to reflect its new purpose.

### Changes Required:

#### 1. Project list page

**File**: `src/pages/dashboard.astro`

**Intent**: Replace the static placeholder with a server-rendered list of the signed-in user's projects, most-recently-updated first, each linking to its detail page, with a "New Project" CTA always visible and a friendly empty state when the list is empty.

**Contract**: Keep the existing auth guard (`Astro.locals.user`, redirect to `/auth/signin` if absent — mirror `src/pages/scenes/[id].astro:11-14`) and the existing `Layout` + `Topbar` shell. Add a query: `supabase.from("projects").select("id, title, updated_at").eq("user_id", user.id).order("updated_at", { ascending: false })`, typed via an inline `ProjectRow` interface (`{ id: string; title: string; updated_at: string }`), following the existing eslint-disable convention for Supabase's response-union type where needed. Render each project as a link to `/projects/${id}` showing its title. When the array is empty, render a message ("No projects yet") in place of the list, alongside the existing "New Project" link to `/projects/new`.

#### 2. Navigation label update

**File**: `src/components/Topbar.astro`

**Intent**: Reflect that `/dashboard` is now the project list, not a generic placeholder.

**Contract**: Change the link text at `src/components/Topbar.astro:14` from `Dashboard` to `Projects` (href stays `/dashboard`).

### Success Criteria:

#### Automated Verification:

- Linting passes: `npm run lint`
- Build succeeds: `npm run build`

#### Manual Verification:

- Signed-in creator with 2+ projects sees all of them on `/dashboard`, ordered by most recently created/updated, each link opening the right project.
- Signed-in creator with zero projects sees the empty-state message and a working "New Project" link.
- A second test account never sees the first account's projects.
- Topbar shows "Projects" (not "Dashboard") and still links to `/dashboard` from every page.

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before proceeding to the next phase.

---

## Phase 2: Project Detail & Scene List

### Overview

Add the project detail page showing project context plus its full scene list with accurate status, including scenes that have never been forged.

### Changes Required:

#### 1. Project detail + scene list page

**File**: `src/pages/projects/[projectId]/index.astro` (new)

**Intent**: Show the project's title/premise/tone and every scene belonging to it, most-recently-updated first, each with a status badge reflecting its real state — including scenes with no `scene_cards` row yet — plus a "New Scene" CTA and a back-link to the project list.

**Contract**: Follow the exact auth-guard, ownership-check, and 404 pattern from `src/pages/projects/[projectId]/scenes/new.astro:11-32` (redirect if no `user`, 404 if `projectId` missing or project not found/not owned). Query 1: `supabase.from("projects").select("id, title, premise, tone").eq("id", projectId).eq("user_id", user.id).single()`. Query 2: `supabase.from("scenes").select("id, title, updated_at").eq("project_id", projectId).eq("user_id", user.id).order("updated_at", { ascending: false })`. Query 3: `supabase.from("scene_cards").select("scene_id, status").eq("user_id", user.id).in("scene_id", <ids from query 2>)` (skip this query entirely when the scene list is empty). Build a `Map<string, SceneStatus>` from query 3's rows keyed by `scene_id`, then render each scene from query 2 with its status looked up from the map (`undefined` → "Not forged yet"). Reuse the `SceneStatus` type from `src/lib/forge-scene/types.ts:6`. Status badge labels: `Draft`, `Needs Work`, `Ready` for the three known values, `Not forged yet` (visually muted, matching the existing `text-blue-100/40 italic` treatment used for "not enough context" elsewhere) when absent from the map. When the scenes array is empty, render a "No scenes yet" message with a link to `/projects/${projectId}/scenes/new` in place of the list. Always show a "New Scene" link/button and a "← Projects" back-link to `/dashboard`.

### Success Criteria:

#### Automated Verification:

- Linting passes: `npm run lint`
- Build succeeds: `npm run build`

#### Manual Verification:

- Opening a project with a mix of forged (Draft/Needs Work/Ready) and never-forged scenes shows the correct distinct badge for each, most-recently-updated first.
- A project with zero scenes shows the empty-state message and a working "New Scene" link.
- Visiting `/projects/[projectId]` for a project ID that doesn't exist, or belongs to another user, returns a 404 rather than leaking data.
- The back-link returns to the project list; the project list's links open the correct project.

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before proceeding to the next phase.

---

## Testing Strategy

### Unit Tests:

- None — this change introduces no new pure logic (no readiness rules, no adapters); it's server-rendered data fetching and templating, consistent with the PRD's manual-first MVP testing strategy already applied to similarly presentational work.

### Integration Tests:

- None — no new API routes or business logic to integration-test.

### Manual Testing Steps:

1. Create two separate accounts (or reuse existing test accounts). On account A, create 2 projects, each with 2+ scenes; forge one scene per project (leave at least one scene un-forged per project).
2. Visit `/dashboard` on account A — confirm both projects appear, most-recently-created first, and open each into its detail page.
3. On each project detail page, confirm scenes show `Draft`/`Needs Work`/`Ready` (whichever was actually set) for forged scenes and `Not forged yet` for the un-forged one.
4. Sign in as account B — confirm `/dashboard` shows none of account A's projects, and a direct visit to one of account A's `/projects/[projectId]` URLs 404s.
5. Delete all projects from a fresh third test account (or use a never-used account) and confirm the project-list empty state renders correctly with a working "New Project" link; create one project with zero scenes and confirm the scene-list empty state renders correctly with a working "New Scene" link.
6. Confirm the Topbar shows "Projects" and links to `/dashboard` from the project list, project detail, and scene detail pages.

## Performance Considerations

None beyond existing NFRs — target scale is `small` users / `low` QPS (`tech-stack.md:8-11`), and both new pages issue at most 3 simple indexed-by-primary-key/foreign-key queries per request, well within the 2-second NFR for navigation.

## Migration Notes

None — no schema changes.

## References

- Related plans: `context/changes/first-forged-scene-card/plan.md`, `context/changes/enforce-scene-readiness/plan.md`
- Ownership-check + 404 pattern: `src/pages/projects/[projectId]/scenes/new.astro:11-32`
- Scene status types: `src/lib/forge-scene/types.ts:6-11`
- Schema: `supabase/migrations/20260802120000_create_scene_forge_core.sql`, `supabase/migrations/20260825120000_enforce_scene_readiness.sql`

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles. See `references/progress-format.md`.

### Phase 1: Projects List

#### Automated

- [x] 1.1 Linting passes: `npm run lint`
- [x] 1.2 Build succeeds: `npm run build`

#### Manual

- [x] 1.3 Signed-in creator with 2+ projects sees all of them on `/dashboard`, ordered by most recently created/updated, each link opening the right project.
- [x] 1.4 Signed-in creator with zero projects sees the empty-state message and a working "New Project" link.
- [x] 1.5 A second test account never sees the first account's projects.
- [x] 1.6 Topbar shows "Projects" (not "Dashboard") and still links to `/dashboard` from every page.

### Phase 2: Project Detail & Scene List

#### Automated

- [x] 2.1 Linting passes: `npm run lint`
- [x] 2.2 Build succeeds: `npm run build`

#### Manual

- [x] 2.3 Opening a project with a mix of forged (Draft/Needs Work/Ready) and never-forged scenes shows the correct distinct badge for each, most-recently-updated first.
- [x] 2.4 A project with zero scenes shows the empty-state message and a working "New Scene" link.
- [x] 2.5 Visiting `/projects/[projectId]` for a project ID that doesn't exist, or belongs to another user, returns a 404 rather than leaking data.
- [x] 2.6 The back-link returns to the project list; the project list's links open the correct project.
