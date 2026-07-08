---
project: scene-forge
platform: Cloudflare Workers
status: planned-not-executed
planned_at: 2026-07-08
source: context/foundation/infrastructure.md
---

## Status

**Planning only — nothing in this document has been executed yet.** No deploy has run, no secrets have been set, no Cloudflare account/token has been created, and no repo files (`wrangler.jsonc`, `package.json`, `.github/workflows/ci.yml`) have been modified. This file exists so the plan can be resumed in a future session without re-deriving it.

## Context

SceneForge is bootstrapped (Astro 6 SSR + React + Supabase auth; working sign-up/sign-in/protected `/dashboard`) but has never been deployed. `context/foundation/infrastructure.md` already researched and locked the platform decision: **Cloudflare Workers** (not Pages). `tech-stack.md` and `wrangler.jsonc` are already partially aligned with that decision, but no deploy has ever run, there's no deploy step in CI, and the Worker still carries the scaffold's leftover name (`10x-astro-starter`).

This is a **course-certification MVP** with a hard cost constraint set explicitly by the project owner: **free-tier only**. No paid Cloudflare Workers plan and no paid Anthropic API usage are required for the first production deploy. This is a deliberate, recorded deviation from `infrastructure.md`'s own recommendation ("budget the $5/mo Paid plan from day one") — the risk is accepted and monitored rather than pre-emptively avoided.

## Decisions already made

- **Platform**: Cloudflare Workers (per `infrastructure.md`), not Pages.
- **Plan tier**: **Free tier**, not Paid — overrides `infrastructure.md`'s mitigation for the 10ms CPU-time-ceiling risk. Accepted risk, monitored via smoke tests (see Edge Cases below), with $5/mo Paid upgrade as the human-only fallback if it's actually hit.
- **Worker name**: rename from scaffold default `10x-astro-starter` → `scene-forge` in `wrangler.jsonc` (and `package.json`'s `name` field for consistency) — before the first deploy, since renaming afterward creates a new Worker rather than renaming the existing one.
- **CI deploy mechanism**: `cloudflare/wrangler-action@v3` (official action) in a `deploy` job appended to the existing `.github/workflows/ci.yml`, gated with `needs: ci` so deploy only ever follows a green lint+build on the same commit.
- **Anthropic / Forge Scene**: out of scope for this deploy. `ANTHROPIC_API_KEY` is **not** provisioned now — an unused secret is pure blast-radius with no benefit, and Forge Scene doesn't exist in code yet. Current `compatibility_date` (2026-05-08) and `nodejs_compat` flag already satisfy `@anthropic-ai/sdk`'s Workers requirements (verified against official docs, 2026-07-08) — no adapter changes will be needed when Forge Scene is built. Whoever implements FR-016 should give Forge Scene a working no-key/mock generation path so production never *requires* a paid Anthropic key.

## Pending manual steps (human-only, none done yet)

- [ ] Create a Cloudflare account if one doesn't exist yet (Free plan — no billing upgrade).
- [ ] `wrangler login` locally (interactive OAuth) for whoever runs the first manual deploy.
- [ ] Create a scoped Cloudflare API token (dashboard → My Profile → API Tokens → Create Token): `Workers Scripts:Edit` for this account only — no DNS, no billing, no account-wide admin.
- [ ] Add `CLOUDFLARE_API_TOKEN` as a GitHub Actions repo secret. Add `CLOUDFLARE_ACCOUNT_ID` too (either as a GitHub secret, or as a non-secret `account_id` field directly in `wrangler.jsonc` once known).
- [ ] Confirm which Supabase project's `SUPABASE_URL`/`SUPABASE_KEY` values should back production, and that they match the GitHub secrets `ci.yml` already reads for its build step.

## Commands that must NOT be run yet

These require the manual steps above to be completed first, and/or explicit go-ahead in a future session:

- `wrangler login`
- `wrangler deploy`
- `wrangler secret put SUPABASE_URL` / `wrangler secret put SUPABASE_KEY`
- Any GitHub secret creation (`gh secret set ...` or via GitHub UI)

## Repo file changes planned (not executed)

| File | Planned change | Status |
|---|---|---|
| `wrangler.jsonc` | `"name": "10x-astro-starter"` → `"name": "scene-forge"` | Not done |
| `package.json` | `"name"` → `"scene-forge"`; add `"deploy": "astro build && wrangler deploy"` script | Not done |
| `.github/workflows/ci.yml` | Add a `deploy` job (`needs: ci`, `if: push to main`) using `cloudflare/wrangler-action@v3` with `apiToken: ${{ secrets.CLOUDFLARE_API_TOKEN }}` | Not done |
| `context/deployment/secrets-bindings-log.md` | New file — one row per future secret/binding change, to compensate for `wrangler rollback` not reverting secrets/bindings | Not created |

No changes needed to `astro.config.mjs` (env schema already matches the planned secret names `SUPABASE_URL`/`SUPABASE_KEY`) or to `compatibility_date`/`compatibility_flags` (already current per live doc check against `developers.cloudflare.com/workers/framework-guides/web-apps/astro/`).

## Full phased plan (for execution once resumed)

### Phase 0 — Repo config corrections
- [ ] Rename Worker in `wrangler.jsonc` and `package.json`.
- [ ] Add `deploy` script to `package.json`.

### Phase 1 — Manual Cloudflare & GitHub setup (free tier)
- [ ] Account, `wrangler login`, scoped API token, GitHub secrets, Supabase env verification — see checklist above.

### Phase 2 — First manual deploy
- [ ] `wrangler secret put SUPABASE_URL` / `SUPABASE_KEY` (exact names — not `infrastructure.md`'s illustrative `SUPABASE_SERVICE_KEY`).
- [ ] `npm run build`
- [ ] `wrangler deploy`
- [ ] Record the returned `*.workers.dev` URL here.

### Phase 3 — Smoke test (manual deploy)
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

## Next recommended step for tomorrow

Start at **Phase 1** (manual Cloudflare account creation + `wrangler login` + scoped API token + GitHub secrets). Nothing in Phase 0 is blocking — the `wrangler.jsonc`/`package.json` renames can be done independently in the same session as Phase 1, right before the first manual deploy in Phase 2.

## Verification (once executed)

- `npm run build` succeeds locally before any deploy.
- Phase 3 and Phase 5 browser-driven smoke tests (sign up/in/out, protected route) pass against the real deployed Worker with clean `wrangler tail` output.
- GitHub Actions `ci` and `deploy` jobs both green after merging to `main`.
