# Session Handoff

> Read this file first in any new session. It points to authoritative docs rather than duplicating them — follow the links for detail.

## Project / North Star

**Point&Click Scene Forge** — turns a solo point-and-click game creator's loose scene notes into a structured, evaluable scene card (player goal, obstacle, characters/function, interaction/puzzle, required assets, design risks).

- Source of truth for scope, personas, FRs/NFRs, non-goals: `context/foundation/prd.md`
- North star / slice sequencing: `context/foundation/roadmap.md` — **S-01 (`first-forged-scene-card`)** is the validation milestone and is now built (see below).
- Contributor/agent guide: `AGENTS.md`

## Current Course Progress

10xDevs AI Toolkit, Module 2 Lesson 3 (`/10x-impl-review`) completed for `first-forged-scene-card`. Module 2 Lesson 4 (research-backed planning chain: `/10x-research` → `/10x-plan` → `/10x-plan-review`) is **in progress**, applied to roadmap slice `S-03` (`enforce-scene-readiness`) — research, plan, and plan review are done; `/10x-implement` has not been run yet. Chain so far: `/10x-init` → `/10x-shape` → `/10x-prd` → `/10x-tech-stack-selector` → `/10x-bootstrapper` → `/10x-roadmap` → `/10x-plan` → `/10x-implement` → `/10x-impl-review` → `/10x-research` → `/10x-plan` → `/10x-plan-review`.

## Completed Work

- **S-01 `first-forged-scene-card` is implemented AND implementation-reviewed.** Verdict: **APPROVED**, 0 critical findings, 1 warning (accepted as a recorded lesson), 3 observations (skipped/dismissed as non-actionable).
  - Plan: `context/changes/first-forged-scene-card/plan.md`
  - Review report: `context/changes/first-forged-scene-card/reviews/impl-review.md`
  - Change log / deviations / manual-verification notes: `context/changes/first-forged-scene-card/change.md`
- Delivered end-to-end: auth (pre-existing) → create project → add scene note → run Forge Scene (Anthropic Claude, tool-use forced, with a deterministic no-key mock fallback) → structured scene card displayed with Regenerate.
- Data model: `projects` / `scenes` / `scene_cards` tables, RLS with `user_id = auth.uid()` owner policies, verified cross-user access returns a plain "Not found" (no data leak).
- CI/CD pipeline (`.github/workflows/ci.yml`) added and green: lint → build gate on PRs/push to `main`; auto-deploy to Cloudflare Workers on merge to `main`.
- **S-03 `enforce-scene-readiness` is researched and planned, but NOT implemented yet.** Change status: `plan_reviewed`. Plan review verdict: **SOUND** (post-triage — 4 findings fixed, 1 accepted as a documented risk; pre-triage verdict was REVISE).
  - Research: `context/changes/enforce-scene-readiness/research.md`
  - Plan / brief: `context/changes/enforce-scene-readiness/plan.md`, `context/changes/enforce-scene-readiness/plan-brief.md`
  - Plan review: `context/changes/enforce-scene-readiness/reviews/plan-review.md`
  - Key decisions locked into the plan (see the plan/brief for full rationale, not duplicated here):
    - `design_risks` becomes structured `{risk, acknowledged}` objects (was a flat string array) — migration includes a backfill.
    - Regenerating a card resets status to Draft and clears all risk acknowledgments, but preserves the creator's notes.
    - Status UI is a hand-rolled 3-pill control (Draft/Needs Work/Ready) — no new UI dependency.
    - The Ready pill is disabled client-side whenever the completeness rule isn't met (with a tooltip naming what's missing), and the server independently re-validates on save.
    - The completeness/"Ready-gate" rule (`isReadyEligible()`) is a pure, framework-agnostic function shared by client and server, with unit tests.
    - Status, notes, and risk acknowledgments all save together via a single explicit "Save" action (no autosave).
    - The new column is named `scene_cards.creator_notes`, not `notes`, to avoid confusion with the pre-existing `scenes.note` column.
    - A multi-tab Save/Regenerate race (no version check) was explicitly accepted as a low-impact MVP risk — single-tab races are already structurally prevented by the UI's state machine.

## Current Repository State

- Branch: `main`, working tree clean, **2 commits ahead of `origin/main`** (not yet pushed as of this handoff — includes the M2L4 research/planning materials and the S-03 plan + plan review).
- Latest local commit: `a143fdf` "Plan and review S-03 scene readiness".
- Latest CI run confirmed green was on the last **pushed** commit, `ac6979d` (run `31967927581`, 2026-08-16) — CI has not yet run against the 2 unpushed local commits.
- One earlier CI run failed transiently (`31945286884`, Prettier/CRLF formatting) and was fixed by the very next commit (`7172f3a`) — not an open issue.
- Live deployment: Cloudflare Workers, per `context/deployment/deploy-plan.md` (not duplicated here — see that file for the verified deploy record). No new code has been deployed for S-03 since it isn't implemented yet.

## Important Technical Setup / Local Development Notes

- Stack: Astro v6 (SSR) + React v19 islands, TypeScript v5, Tailwind v4, Supabase (Postgres + auth), deployed via `@astrojs/cloudflare`.
- `npm run build` requires `SUPABASE_URL` and `SUPABASE_KEY` in the environment.
- Local Supabase runs via the Supabase CLI on **Docker + WSL2** — this was a real blocker earlier in the project on a company-managed Windows machine without admin rights (see `context/changes/first-forged-scene-card/change.md`, "External environment blocker" note) and may recur in future sessions on similar machines.
- App config comes from a local `.env` (see `.env.example` for the variable names only): `SUPABASE_URL`, `SUPABASE_KEY`, and optional `ANTHROPIC_API_KEY` — **no key values are recorded in this file or in memory.** Without `ANTHROPIC_API_KEY`, Forge Scene falls back to a deterministic mock generator by design (keeps the app usable within the project's free-tier constraint).
- No test framework beyond a small Vitest unit suite for the Forge Scene adapter (`src/lib/forge-scene/adapter.test.ts`, 7 tests). CI does not run tests — it runs `astro sync` → lint → build only.
- Path alias `@/*` → `./src/*`.

## Known Issues / Accepted Limitations

- **Windows CRLF / `autocrlf` vs. Prettier**: the repo has a long-standing, pre-existing condition where local `npm run lint` reports ~900–1000 `prettier/prettier` CRLF-deletion errors across files the current feature never touched. This is a line-ending artifact, not a real regression — confirmed via `git stash` diffing before any change. **It can mask genuine new Prettier violations in local lint output**, so when lint output looks large, diff it against the pre-existing baseline (or check only the files you actually touched) rather than assuming it's all noise.
- Project/scene **browsing and listing is intentionally deferred** — out of scope for `first-forged-scene-card` and explicitly assigned to roadmap slice **S-02 (`browse-projects-and-scenes`)**. Today, reaching an existing project/scene requires a direct URL or Supabase Studio; `/dashboard` only offers "New Project."
- Scene card is mostly read-only in the MVP (status, title, freeform notes editable — not individual generated fields) — by PRD design, not a bug.
- `dashboard.astro` was patched during Phase 3 to use the shared `Topbar` component for navigation consistency (small approved deviation, not a scope expansion).

## Important Lessons / Project Rules Learned So Far

Full register: `context/foundation/lessons.md`. Currently two entries:
1. Keep agent rule files (AGENTS.md, CLAUDE.md rules) short, project-specific, reference-based, and validated in a fresh session before relying on them.
2. **Any migration that creates a new table and enables RLS must also `GRANT` table-level DML privileges to `authenticated` in the same migration** — Postgres checks privileges before RLS is ever evaluated. (Learned the hard way: the Aug 2 schema migration shipped 11 days without grants before this was caught in manual verification and fixed on Aug 13.)

## Next Recommended Step

`/10x-implement enforce-scene-readiness phase 1` — S-03's plan is written and plan-reviewed (SOUND post-triage), but **implementation has not started**. Phase 1 covers the migration (`creator_notes` column + `design_risks` restructuring/backfill), the updated type contract, the Anthropic adapter wrapping change, and the pure `isReadyEligible()` completeness rule with unit tests. See `context/changes/enforce-scene-readiness/plan.md` for the full phase breakdown (Phase 2: PATCH route; Phase 3: editing UI).

Roadmap slices S-02, S-04, S-05 remain unblocked and available in parallel if priorities shift — see `context/foundation/roadmap.md`.

## Session Notes

- **2026-08-25**: This handoff file created. Repo state as of commit `ac6979d`; CI green; S-01 fully implemented and impl-reviewed; nothing in flight.
- **2026-08-25 (later)**: Ran the M2L4 research-backed planning chain on roadmap slice S-03 (`enforce-scene-readiness`): `/10x-research` → `/10x-plan` → `/10x-plan-review`. Research and plan are written, plan review triaged to completion (4 findings fixed in the plan, 1 accepted as risk), verdict SOUND. Change status: `plan_reviewed`. Nothing implemented yet — next session should run `/10x-implement enforce-scene-readiness phase 1`. Local repo is 2 commits ahead of `origin/main` (not pushed this session).

<!-- Update this file at the end of each session: bump the date/commit above, note what changed, and adjust "Next Recommended Step" if it moved. -->
