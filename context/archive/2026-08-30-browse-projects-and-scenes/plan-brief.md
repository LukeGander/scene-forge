# Browse Projects and Scenes — Plan Brief

> Full plan: `context/changes/browse-projects-and-scenes/plan.md`

## What & Why

Roadmap slice `S-02`: let a creator view their list of projects and open one to browse its scenes with current status. Without this, a creator with more than one project or scene has no way back in after the first session — this is the read-only "production dashboard" the PRD's secondary success criterion (managing multiple scenes without friction) depends on.

## Starting Point

Full creation flows exist (`/projects/new` → scene creation → `/scenes/[id]` → Forge Scene → readiness gate), but there is no way to browse back. `dashboard.astro` is a placeholder with a single "New Project" link and doesn't query anything; no project-list or project-detail route exists at all.

## Desired End State

`/dashboard` becomes the creator's project list. Opening a project shows its context plus every scene, each with an accurate status badge — `Draft` / `Needs Work` / `Ready` / `Not forged yet` — linking into the scene detail page. Both lists are scoped to the signed-in user and ordered most-recently-updated first.

## Key Decisions Made

| Decision | Choice | Why (1 sentence) | Source |
| --- | --- | --- | --- |
| Route structure | Single page per level: `/dashboard` (projects), `/projects/[id]` (project + its scenes) | Matches FR-006's literal "view a project and browse its scenes" in one view; avoids extra route surface for a feature this small | Plan |
| Dashboard's role | Dashboard *becomes* the project list (no separate `/projects` route) | It's already the post-login landing page; giving it a real purpose beats adding a parallel page | Plan |
| Navigation | Rename Topbar's "Dashboard" link to "Projects" (same `/dashboard` href) | Reflects the page's new purpose without adding a duplicate link to the same URL | Plan |
| Sort order | `updated_at desc` on each table's own column, no cross-table join | Matches the decision made, but since no edit route exists yet for projects/scenes this is currently equivalent to creation order — accepted rather than over-engineering a join that solves a problem that doesn't exist yet | Plan |
| No-card scene status | Distinct "Not forged yet" badge, not folded into "Draft" | `scene_cards.status` is genuinely absent (nullable in practice) until Forge Scene runs once — conflating it with Draft would misrepresent FR-013's "current status" | Plan |
| List density | Title + status only, no note/premise snippets | Matches FR-013's literal scope; fastest to scan, zero extra queries | Plan |
| Empty states | Friendly message + relevant CTA ("New Project" / "New Scene") for both zero-projects and zero-scenes cases | First-run creators land on the create action instead of a dead-end blank list | Plan |
| Shared types | None added — inline row interfaces per query, matching existing convention | Every existing page already declares ad-hoc `*Row` interfaces at the call site; no precedent to break | Plan |
| List rendering | Plain Astro templating, no new React components | Both pages are fully non-interactive; matches how `Topbar.astro` renders conditional markup without a client island | Plan |

## Scope

**In scope:** `/dashboard` rewritten as the project list; new `/projects/[projectId]` page with project header + scene list + status badges; Topbar label change; empty states for both lists.

**Out of scope:** any new migration or API route (pure reads against the existing schema); project/scene edit or delete (FR-007/FR-008/FR-015, parked); scene count or note-snippet previews; pagination; joining `scene_cards` into sort order.

## Architecture / Approach

Two server-rendered Astro pages, no client JavaScript. `dashboard.astro` issues one `projects` query. The new `projects/[projectId]/index.astro` issues an ownership-checked `projects` query, a `scenes` list query, and (when scenes exist) a `scene_cards` status query — merged in application code via a `Map<scene_id, status>`, following the codebase's established pattern of separate per-table queries hand-mapped together rather than embedded joins.

## Phases at a Glance

| Phase | What it delivers | Key risk |
| --- | --- | --- |
| 1. Projects List | Dashboard rewritten as project list, empty state, Topbar label change | None significant — single new query, follows existing page-shell conventions exactly |
| 2. Project Detail & Scene List | New route with project header, scene list, per-scene status badges (incl. "Not forged yet"), empty state | Getting the two-query merge (scenes + scene_cards statuses) right for scenes that were never forged |

**Prerequisites:** `first-forged-scene-card` (S-01) shipped — done, per roadmap.
**Estimated effort:** ~1-2 sessions across 2 phases — no schema/API work, purely read-side UI.

## Open Risks & Assumptions

- Sorting by `updated_at` is a no-op relative to `created_at` today, since no project/scene edit route exists yet — this will silently start "working as intended" once a future slice (S-05 or FR-007) adds an edit path, with no changes needed here.
- No scene-count or activity summary is shown on the project list; if that turns out to matter for real usage, it's a small, isolated follow-up (one additional count query per project or a single grouped query).

## Success Criteria (Summary)

- A creator can always find their way back to any project or scene from `/dashboard`, without relying on browser history.
- Scene status is always accurate at a glance, including scenes that have never been forged.
- One creator never sees another creator's projects or scenes, including via direct URL access (404, not data leak).
