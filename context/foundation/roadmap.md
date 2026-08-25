---
project: "Point&Click Scene Forge"
version: 1
status: draft
created: 2026-08-01
updated: 2026-08-25
prd_version: 1
main_goal: speed
top_blocker: time
---

# Roadmap: Point&Click Scene Forge

> Derived from `context/foundation/prd.md` (v1) + auto-researched codebase baseline.
> Edit-in-place; archive when superseded.
> Slices below are listed in dependency order. The "At a glance" table is the index.

## Vision recap

Solo point-and-click game creators keep scene ideas in scattered, generic notes tools that can't tell them whether a scene is actually ready for production. A point-and-click scene has a specific required anatomy — player goal, obstacle, character presence and function, an interactive element or puzzle, required assets, and no unresolved design risks — and this product is the first tool that knows that anatomy well enough to evaluate it and flag what's missing.

## North star

**S-01: Creator transforms a scene note into a structured scene card** — this is the validation milestone: the smallest end-to-end flow that, if it works, proves the product's core hypothesis (that a purpose-built tool can turn a loose note into a useful, structured scene evaluation). It has no unmet prerequisites — it's ready to plan now — because every other slice only matters if this one lands first.

> "North star" here means the smallest end-to-end slice whose successful delivery would prove the product works — placed as early as its prerequisites allow, since everything else only has value once this is validated.

## At a glance

| ID | Change ID | Outcome (user can …) | Prerequisites | PRD refs | Status |
| --- | --- | --- | --- | --- | --- |
| S-01 | first-forged-scene-card | create a minimal project, add a scene note, run Forge Scene, and see a structured scene card | — | US-01, FR-004, FR-012, FR-014, FR-016, FR-017 | ready |
| S-03 | enforce-scene-readiness | set a scene's status, add notes, and acknowledge design risks — with "Ready" blocked unless the completeness rule is met | S-01 | FR-018, FR-019, FR-020, FR-022 | planning |
| S-02 | browse-projects-and-scenes | view their project list and browse a project's scenes with current status | S-01 | FR-005, FR-006, FR-013 | proposed |
| S-04 | add-characters-to-scenes | add and edit characters so Forge Scene can use them as context | S-01 | FR-009, FR-010 | proposed |
| S-05 | edit-note-after-generation | edit a saved scene note and see the card marked stale if it no longer matches | S-01 | FR-021 | proposed |

## Streams

Navigation aid — groups items that share a Prerequisites chain. Canonical ordering still lives in the dependency graph below; this table is the proposed reading order across parallel tracks.

| Stream | Theme | Chain | Note |
| --- | --- | --- | --- |
| A | Core loop | `S-01` | The first end-to-end Forge Scene flow — including its own LLM adapter and mock path, folded into scope rather than split into a foundation (single consumer, no standalone value). Everything else branches from here. |
| B | Production dashboard | `S-01` → `S-02` / `S-03` (parallel) | Navigating multiple scenes and gating "Ready" status — both extend S-01 without depending on each other. |
| C | Scene loop enrichment | `S-01` → `S-04` / `S-05` (parallel) | Optional inputs (characters) and note-editing refinements — deferrable relative to Stream B under the speed/time bias, but independent of it. |

## Baseline

What's already in place in the codebase as of `2026-08-01` (auto-researched + user-confirmed).
Foundations below assume these are present and do NOT re-scaffold them.

- **Frontend:** partial — Astro 6 SSR + React 19 islands, Tailwind, shadcn-style UI primitives (`astro.config.mjs`). Only auth pages and a placeholder `dashboard.astro` exist; no project/character/scene UI.
- **Backend / API:** partial — Astro API routes exist only for auth (`src/pages/api/auth/{signin,signup,signout}.ts`). No project/character/scene/Forge Scene routes; no LLM client anywhere in `src`.
- **Data:** absent — no `supabase/migrations/`, no `.sql` files, no domain tables (projects, characters, scenes, scene cards). Only the Supabase auth client (`src/lib/supabase.ts`) exists.
- **Auth:** present — full email+password flow (signup, email confirmation, signin, signout, protected `/dashboard`) built, deployed, and smoke-tested in production (`context/deployment/deploy-plan.md`).
- **Deploy / infra:** present — Cloudflare Workers, live at `scene-forge.lukegander.workers.dev`, GitHub Actions CI/CD with auto-deploy-on-merge, verified end to end (commit `5976e64`, run `30568881045`).
- **Observability:** absent — no logging library, error tracker, or structured error handling anywhere in the codebase.

## Foundations

None. The only candidate — an LLM client adapter with a deterministic mock/no-key path for Forge Scene — was assessed as a single-consumer prerequisite: it only unlocks S-01, has no standalone user-visible or verification value on its own, and its provider/package choice is already decided upstream (`context/foundation/tech-stack.md`, `context/foundation/infrastructure.md`, `context/deployment/deploy-plan.md`), not something this roadmap needs to name. Per the progressive-disclosure rule, it's folded into S-01's own scope — splitting it out would add a planning/review cycle with no cross-cutting benefit, which cuts against this roadmap's `speed`/`time` framing.

## Slices

### S-01: Creator transforms a scene note into a structured scene card

- **Outcome:** creator can create a minimal project, add a scene note, run Forge Scene, and see a generated scene card with all required fields (player goal, obstacle, characters and function if present, interactive element or puzzle, required assets, design risks — or "not enough context" where the note doesn't provide it) at Draft status. Scope includes building the scene-card generation adapter itself — including a deterministic no-key/mock generation path — since no LLM integration exists in the codebase yet; the provider/package choice is already recorded upstream, not decided here.
- **Change ID:** first-forged-scene-card
- **PRD refs:** US-01, FR-004, FR-012, FR-014, FR-016, FR-017
- **Prerequisites:** —
- **Parallel with:** —
- **Blockers:** —
- **Unknowns:** —
- **Risk:** This is both the highest-value and highest-uncertainty slice — the PRD's primary success criterion (70% card-acceptance rate) depends entirely on Forge Scene's prompt quality, which can only really be evaluated once this loop exists end to end. It also carries the project's free-tier/no-paid-key constraint (per `deploy-plan.md`): building the mock/no-key path as part of this slice, rather than deferring it, keeps it buildable and testable without requiring a billing decision first.
- **Status:** ready

### S-03: Creator sets and enforces scene readiness status

- **Outcome:** creator can set a scene's status (Draft / Needs Work / Ready), add freeform notes, and acknowledge or clear generated design risks; the app blocks setting "Ready" unless the completeness rule is satisfied (player goal + obstacle + at least one interaction/puzzle element + required assets + character function where applicable + no unresolved design risks).
- **Change ID:** enforce-scene-readiness
- **PRD refs:** FR-018, FR-019, FR-020, FR-022
- **Prerequisites:** S-01
- **Parallel with:** S-02, S-04, S-05
- **Blockers:** —
- **Unknowns:** —
- **Risk:** This is what turns the product from a card generator into a readiness gate — the Vision's core differentiator ("flag what's missing before production starts") is only real once this rule is enforced, not just displayed. Sequenced immediately after S-01, ahead of navigation and enrichment slices, so the product's central value claim is validated early rather than left for last.
- **Status:** planning

### S-02: Creator browses projects and scenes

- **Outcome:** creator can view their list of projects, open a project, and see all its scenes with current status.
- **Change ID:** browse-projects-and-scenes
- **PRD refs:** FR-005, FR-006, FR-013
- **Prerequisites:** S-01
- **Parallel with:** S-03, S-04, S-05
- **Blockers:** —
- **Unknowns:** —
- **Risk:** Low technical risk, but without it a creator with more than one project or scene has no way back in after the first session — needed for any real (non-single-demo) use, and ties directly to the PRD's secondary success criterion on managing multiple scenes without friction.
- **Status:** proposed

### S-04: Creator adds characters to enrich scene generation

- **Outcome:** creator can add a character (name, role, description, manner of speech) to a project and edit it; Forge Scene incorporates character context into the generated card when characters are present.
- **Change ID:** add-characters-to-scenes
- **PRD refs:** FR-009, FR-010
- **Prerequisites:** S-01
- **Parallel with:** S-02, S-03, S-05
- **Blockers:** —
- **Unknowns:** —
- **Risk:** Characters are explicitly optional in US-01, so this doesn't block the core loop — but character context measurably affects card quality for character-driven scenes, so deferring it too long risks the 70%-acceptance criterion on any scene that needs it.
- **Status:** proposed

### S-05: Creator edits a scene note after generation

- **Outcome:** creator can edit a saved scene note before or after Forge Scene has run; if the note changes after a card already exists, the existing card is marked stale and the creator is prompted to re-run Forge Scene.
- **Change ID:** edit-note-after-generation
- **PRD refs:** FR-021
- **Prerequisites:** S-01
- **Parallel with:** S-02, S-03, S-04
- **Blockers:** —
- **Unknowns:** —
- **Risk:** Without this, correcting a note after a poor first generation forces a full scene delete/recreate — a rough edge, not a blocker to the north star. Sequenced last among the parallel slices since it's the narrowest in scope and the least urgent relative to the time pressure on this project.
- **Status:** proposed

## Backlog Handoff

| Roadmap ID | Change ID | Suggested issue title | Ready for `/10x-plan` | Notes |
| --- | --- | --- | --- | --- |
| S-01 | first-forged-scene-card | Generate a structured scene card from a scene note (Forge Scene) | yes | Run `/10x-plan first-forged-scene-card` — scope includes the LLM adapter + mock path as phase 1 |
| S-03 | enforce-scene-readiness | Enforce scene "Ready" status against the completeness rule | no | Blocked on S-01 |
| S-02 | browse-projects-and-scenes | Browse projects and their scenes with status | no | Blocked on S-01 |
| S-04 | add-characters-to-scenes | Add characters as Forge Scene context | no | Blocked on S-01 |
| S-05 | edit-note-after-generation | Edit scene note post-generation with stale-card marking | no | Blocked on S-01 |

This table is the clean handoff to Jira/Linear or any MCP-backed backlog. Include one row for every `F-NN` and `S-NN`. It should be compact enough to copy into issues, but it must not duplicate the detailed roadmap body.

## Open Roadmap Questions

None. The PRD reports zero open questions ("All gaps resolved during shaping and PRD review"), and the Step 5 interview did not surface new cross-cutting decisions — the #1 blocker identified was time pressure, not unresolved decisions.

## Parked

- **FR-007 (edit a project's context)** — Why parked: nice-to-have priority in the PRD; deferred given the `speed` main goal and the `time` blocker — a project can be recreated if needed for MVP validation.
- **FR-008 (delete a project)** — Why parked: nice-to-have priority in the PRD; same rationale as FR-007.
- **FR-011 (delete a character)** — Why parked: nice-to-have priority in the PRD; deferred under the same time pressure.
- **FR-015 (delete a scene)** — Why parked: nice-to-have priority in the PRD; deferred under the same time pressure.
- **No engine integrations** — Why parked: PRD Non-Goals — generated scene cards stay inside the app; no Unity/Adventure Creator/Godot export.
- **No game-level management** — Why parked: PRD Non-Goals — scene-level tool only; no game timeline, quest system, location map, asset manager, or game bible.
- **No advanced content features** — Why parked: PRD Non-Goals — no dialog editor/trees, scene versioning, NPC relationship graphs, or reputation system; all downstream of a validated core loop.
- **No multi-user collaboration** — Why parked: PRD Non-Goals — no shared projects, team workspaces, comments, or co-editing; auth stays flat.
- **No mobile browser requirement** — Why parked: PRD Non-Goals — desktop browsers only; no PWA, service worker, or offline-first sync.

## Done

(Empty on first generation. `/10x-archive` appends an entry here — and flips that item's `Status` to `done` — when a change whose `Change ID` matches the item is archived.)
