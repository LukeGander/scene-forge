# Session Handoff

> Read this file first in any new session. It points to authoritative docs rather than duplicating them — follow the links for detail.

## Project / North Star

**Point&Click Scene Forge** — turns a solo point-and-click game creator's loose scene notes into a structured, evaluable scene card (player goal, obstacle, characters/function, interaction/puzzle, required assets, design risks).

- Source of truth for scope, personas, FRs/NFRs, non-goals: `context/foundation/prd.md`
- North star / slice sequencing: `context/foundation/roadmap.md` — **S-01 (`first-forged-scene-card`)** is the validation milestone and is now built (see below).
- Contributor/agent guide: `AGENTS.md`

## Current Course Progress

10xDevs AI Toolkit, Module 2 Lesson 3 (`/10x-impl-review`) just completed for `first-forged-scene-card`. Chain so far: `/10x-init` → `/10x-shape` → `/10x-prd` → `/10x-tech-stack-selector` → `/10x-bootstrapper` → `/10x-roadmap` → `/10x-plan` → `/10x-implement` → `/10x-impl-review`.

## Completed Work

- **S-01 `first-forged-scene-card` is implemented AND implementation-reviewed.** Verdict: **APPROVED**, 0 critical findings, 1 warning (accepted as a recorded lesson), 3 observations (skipped/dismissed as non-actionable).
  - Plan: `context/changes/first-forged-scene-card/plan.md`
  - Review report: `context/changes/first-forged-scene-card/reviews/impl-review.md`
  - Change log / deviations / manual-verification notes: `context/changes/first-forged-scene-card/change.md`
- Delivered end-to-end: auth (pre-existing) → create project → add scene note → run Forge Scene (Anthropic Claude, tool-use forced, with a deterministic no-key mock fallback) → structured scene card displayed with Regenerate.
- Data model: `projects` / `scenes` / `scene_cards` tables, RLS with `user_id = auth.uid()` owner policies, verified cross-user access returns a plain "Not found" (no data leak).
- CI/CD pipeline (`.github/workflows/ci.yml`) added and green: lint → build gate on PRs/push to `main`; auto-deploy to Cloudflare Workers on merge to `main`.

## Current Repository State

- Branch: `main`, up to date with `origin/main`, working tree clean.
- Latest commit: `ac6979d` "Complete M2L3 implementation review".
- Latest CI run on `main`: **success** (run `31967927581`, 2026-08-16).
- One earlier CI run failed transiently (`31945286884`, Prettier/CRLF formatting) and was fixed by the very next commit (`7172f3a`) — not an open issue.
- Live deployment: Cloudflare Workers, per `context/deployment/deploy-plan.md` (not duplicated here — see that file for the verified deploy record).

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

**Roadmap fact**: per `context/foundation/roadmap.md`'s dependency graph, S-01 is done, so its four dependents — S-02, S-03, S-04, S-05 — are all now unblocked and can proceed in any order or in parallel. None is yet marked "ready for `/10x-plan`" in the roadmap's backlog-handoff table; that flip happens when one is chosen to start.

**Recommended** (agent judgment, not roadmap authority): start with **S-03 (`enforce-scene-readiness`)** — the roadmap's own risk note for S-03 frames it as the product's core differentiator (enforcing the "Ready" rule, not just displaying it), so validating it early carries more product risk-reduction than the other three. **S-02 (`browse-projects-and-scenes`)** is the pragmatic runner-up, since it closes the current no-way-back-in navigation gap noted above. Re-evaluate this recommendation against the roadmap file directly before committing to it, since the roadmap may have been edited since this handoff was written.

## Session Notes

- **2026-08-25**: This handoff file created. Repo state as of commit `ac6979d`; CI green; S-01 fully implemented and impl-reviewed; nothing in flight.

<!-- Update this file at the end of each session: bump the date/commit above, note what changed, and adjust "Next Recommended Step" if it moved. -->
