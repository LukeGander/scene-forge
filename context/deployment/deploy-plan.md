---
project: scene-forge
platform: Cloudflare Workers
status: in-progress
planned_at: 2026-07-08
updated_at: 2026-07-19
source: context/foundation/infrastructure.md
---

## Status

**In progress — first manual deploy succeeded; Phase 3 smoke test and CI/CD wiring are pending.** Cloudflare account (Free tier), `wrangler login`, the scoped Cloudflare API token, and the Cloudflare-related GitHub secrets are all in place. `SUPABASE_URL`/`SUPABASE_KEY` are wired into both Wrangler secrets and GitHub Actions secrets (names verified, values never displayed). `wrangler.jsonc` and `package.json` have been renamed and committed (Phase 0). `npm run build` succeeded locally, and `npx wrangler deploy` succeeded after registering the `lukegander` workers.dev subdomain — production URL is `https://scene-forge.lukegander.workers.dev`, currently serving the unmodified scaffold UI (auth flow not yet smoke-tested against production). `.github/workflows/ci.yml` still has no deploy job, and nothing has been pushed to GitHub since this deploy. This file exists so the plan can be resumed in a future session without re-deriving it.

## Context

SceneForge is bootstrapped (Astro 6 SSR + React + Supabase auth; working sign-up/sign-in/protected `/dashboard`) but has never been deployed. `context/foundation/infrastructure.md` already researched and locked the platform decision: **Cloudflare Workers** (not Pages). `tech-stack.md` and `wrangler.jsonc` are already partially aligned with that decision, but no deploy has ever run, there's no deploy step in CI, and the Worker still carries the scaffold's leftover name (`10x-astro-starter`).

This is a **course-certification MVP** with a hard cost constraint set explicitly by the project owner: **free-tier only**. No paid Cloudflare Workers plan and no paid Anthropic API usage are required for the first production deploy. This is a deliberate, recorded deviation from `infrastructure.md`'s own recommendation ("budget the $5/mo Paid plan from day one") — the risk is accepted and monitored rather than pre-emptively avoided.

## Decisions already made

- **Platform**: Cloudflare Workers (per `infrastructure.md`), not Pages.
- **Plan tier**: **Free tier**, not Paid — overrides `infrastructure.md`'s mitigation for the 10ms CPU-time-ceiling risk. Accepted risk, monitored via smoke tests (see Edge Cases below), with $5/mo Paid upgrade as the human-only fallback if it's actually hit.
- **Worker name**: rename from scaffold default `10x-astro-starter` → `scene-forge` in `wrangler.jsonc` (and `package.json`'s `name` field for consistency) — before the first deploy, since renaming afterward creates a new Worker rather than renaming the existing one.
- **CI deploy mechanism**: `cloudflare/wrangler-action@v3` (official action) in a `deploy` job appended to the existing `.github/workflows/ci.yml`, gated with `needs: ci` so deploy only ever follows a green lint+build on the same commit.
- **Anthropic / Forge Scene**: out of scope for this deploy. `ANTHROPIC_API_KEY` is **not** provisioned now — an unused secret is pure blast-radius with no benefit, and Forge Scene doesn't exist in code yet. Current `compatibility_date` (2026-05-08) and `nodejs_compat` flag already satisfy `@anthropic-ai/sdk`'s Workers requirements (verified against official docs, 2026-07-08) — no adapter changes will be needed when Forge Scene is built. Whoever implements FR-016 should give Forge Scene a working no-key/mock generation path so production never *requires* a paid Anthropic key.

## Pending manual steps

- [x] Create a Cloudflare account (Free plan — no billing upgrade).
- [x] `wrangler login` locally (interactive OAuth) — completed.
- [x] Create a scoped Cloudflare API token (dashboard → My Profile → API Tokens → Create Token): `Workers Scripts:Edit` for this account only — no DNS, no billing, no account-wide admin. Verified valid and active.
- [x] Add `CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID` as GitHub Actions repo secrets. Verified present via `gh secret list --repo LukeGander/scene-forge` (names only, no values):
  - `CLOUDFLARE_API_TOKEN` — set 2026-07-14T19:44:26Z
  - `CLOUDFLARE_ACCOUNT_ID` — set 2026-07-14T19:47:51Z
- [x] Create Supabase project `SceneForge` for local dev and first production deployment.
- [x] GitHub remote `origin` added (`https://github.com/LukeGander/scene-forge.git`).
- [x] GitHub CLI installed and authenticated as `LukeGander` (`gh auth status` confirms `github.com` account `LukeGander`, https protocol).
- [x] Locate the production `SUPABASE_URL` and public `SUPABASE_KEY` in the Supabase dashboard, wire them into Wrangler/GitHub secrets, and confirm they match the GitHub secrets `ci.yml` already reads for its build step. Verified via `wrangler secret list` / `gh secret list` (names only).
- [x] Register a `workers.dev` account subdomain — done as `lukegander`.

## Commands that must NOT be run yet

These require explicit go-ahead in a future session:

- Any further `wrangler deploy` (re-deploys, e.g. after a code/config change) until Phase 3 smoke test is approved and run.
- Any CI/CD deploy job changes to `.github/workflows/ci.yml`.
- `git push` — nothing has been pushed to GitHub since this deploy.

## Repo file changes planned (not executed)

| File | Planned change | Status |
|---|---|---|
| `wrangler.jsonc` | `"name": "10x-astro-starter"` → `"name": "scene-forge"` | Done (commit `aa43a71`) |
| `package.json` | `"name"` → `"scene-forge"`; add `"deploy": "astro build && wrangler deploy"` script | Done (commit `aa43a71`) |
| `.github/workflows/ci.yml` | Add a `deploy` job (`needs: ci`, `if: push to main`) using `cloudflare/wrangler-action@v3` with `apiToken: ${{ secrets.CLOUDFLARE_API_TOKEN }}` | Not done |
| `context/deployment/secrets-bindings-log.md` | New file — one row per future secret/binding change, to compensate for `wrangler rollback` not reverting secrets/bindings | Not created |

No changes needed to `astro.config.mjs` (env schema already matches the planned secret names `SUPABASE_URL`/`SUPABASE_KEY`) or to `compatibility_date`/`compatibility_flags` (already current per live doc check against `developers.cloudflare.com/workers/framework-guides/web-apps/astro/`).

## Full phased plan (for execution once resumed)

### Phase 0 — Repo config corrections
- [x] Rename Worker in `wrangler.jsonc` and `package.json`.
- [x] Add `deploy` script to `package.json`.
- [x] Committed as `aa43a71` — "Prepare Cloudflare Worker deployment config" (2026-07-14).

### Phase 1 — Manual Cloudflare & GitHub setup (free tier)
- [x] Cloudflare account, `wrangler login`, scoped API token, Cloudflare GitHub secrets — done, see checklist above.
- [x] Supabase project `SceneForge` created.
- [x] Supabase env verification (`SUPABASE_URL`/`SUPABASE_KEY` values wired and matched against `ci.yml`) — done, see checklist above.

### Phase 2 — First manual deploy
- [x] `wrangler secret put SUPABASE_URL` / `SUPABASE_KEY` (exact names — not `infrastructure.md`'s illustrative `SUPABASE_SERVICE_KEY`).
- [x] `npm run build` — succeeded locally.
- [x] `wrangler deploy` — succeeded; auto-provisioned the `SESSION` KV namespace (`scene-forge-session`) as a binding side effect.
- [x] Registered `workers.dev` subdomain `lukegander` (required one-time account step before first publish).
- [x] Production URL: **https://scene-forge.lukegander.workers.dev** — loads successfully, currently showing the unmodified scaffold ("10x Astro Starter") UI.

### Phase 3 — Smoke test (manual deploy) — PENDING, next session
- [ ] With `wrangler tail --format pretty` running: sign up → confirm-email redirect → sign in → `/dashboard` loads → sign out → re-visiting `/dashboard` redirects to sign-in.
- [ ] Confirm no `Dynamic require of "..." is not supported` / Node-built-in `ReferenceError`s in the tail output (the known `@supabase/ssr`-on-Workers failure mode without `nodejs_compat`; the flag is already set, this proves it end-to-end against real `workerd`).
- [ ] Watch for a CPU-limit-exceeded error (Free tier's 10ms ceiling — the accepted risk). If hit, see Edge Cases fallback below.

### Phase 4 — Wire CI/CD deploy job
- [ ] Extend `.github/workflows/ci.yml` per the table above.

### Phase 5 — Smoke test (automated deploy)
- [ ] Merge a trivial PR to `main`; confirm `ci` and `deploy` jobs both green.
- [ ] Re-run the Phase 3 smoke test against production.
- [ ] `wrangler deployments list` — confirm the new version ties to the merge commit SHA (rollback target).

### Phase 6 — Edge-case hardening checklist (ongoing)
- [ ] Any future dependency bump touching `@supabase/ssr`/`@supabase/supabase-js` (or later `@anthropic-ai/sdk`): deploy to a throwaway preview version (`wrangler versions upload`) and re-run the smoke test before merging.
- [ ] Before trusting any Cloudflare/Astro troubleshooting source: confirm it's under the `workers/` docs path (not `pages/`) and doesn't reference `wrangler pages deploy` or `wrangler.toml [env]` blocks.
- [ ] **Free-tier CPU-limit fallback**: if smoke tests or later traffic show CPU-limit-exceeded errors in `wrangler tail`, the fallback is a human billing decision to upgrade to the $5/mo Paid plan — not pre-emptive, per the free-tier constraint.
- [ ] Create `context/deployment/secrets-bindings-log.md` the first time any deploy changes secrets/bindings; cross-check it after any `wrangler rollback` before considering the rollback complete.
- [ ] Preview/branch deploys (`wrangler versions upload` wired into CI per-PR): explicitly deferred — solo dev, 4-week MVP, `auto-deploy-on-merge` already the stated flow.

### Phase 7 — Forward-looking note (Forge Scene, not built yet)
- [ ] Do not add `ANTHROPIC_API_KEY` or touch the env schema until Forge Scene is actually implemented.
- [ ] Forge Scene must ship with a no-key/mock generation path so production deploys never require a paid Anthropic key.

## Next step tomorrow

Resume with the **Phase 3 browser smoke test** against `https://scene-forge.lukegander.workers.dev`, one check at a time, approving each before moving to the next:

1. Sign up.
2. Email confirmation (if required by the flow).
3. Sign in.
4. Protected `/dashboard` loads.
5. Sign out.
6. Unauthenticated visit to `/dashboard` redirects to sign-in.

Only after Phase 3 passes: wire the CI/CD deploy job into `.github/workflows/ci.yml` (Phase 4), run the automated-deploy smoke test (Phase 5), and push to GitHub.

## Verification (once executed)

- [x] `npm run build` succeeds locally before any deploy.
- [x] First manual `wrangler deploy` succeeds and serves a reachable production URL.
- [ ] Phase 3 and Phase 5 browser-driven smoke tests (sign up/in/out, protected route) pass against the real deployed Worker with clean `wrangler tail` output.
- [ ] GitHub Actions `ci` and `deploy` jobs both green after merging to `main`.
