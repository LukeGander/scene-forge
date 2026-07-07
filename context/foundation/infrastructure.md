---
project: scene-forge
researched_at: 2026-07-07
recommended_platform: Cloudflare Workers
runner_up: Vercel
context_type: mvp
tech_stack:
  language: JavaScript/TypeScript
  framework: Astro
  runtime: Cloudflare Workers (edge, static assets + SSR)
---

## Recommendation

**Deploy on Cloudflare Workers** (not Cloudflare Pages — see correction note below).

At this project's scale (small user base, low QPS, single region, cost-minimize priority, no persistent connections needed), Cloudflare Workers is the cheapest viable option ($5/mo flat) while being the best technical fit for the "Forge Scene" LLM-call flow: Workers' CPU-time billing model excludes time spent awaiting I/O (like a 5-15s Claude API call), so the exact workload this product is built around costs almost nothing extra. It also has the strongest agent-readable documentation (GA `llms.txt` and markdown-for-agents) of any candidate, and it is the corrected continuation of what `tech-stack.md` already committed to.

## Correction to tech-stack.md

`context/foundation/tech-stack.md` currently sets `deployment_target: cloudflare-pages`. Research during this session found that **Cloudflare Pages is no longer the correct target for Astro SSR apps**: the official `@astrojs/cloudflare` adapter (v13+, required by current Astro) dropped Pages support entirely, and Cloudflare itself is consolidating Pages into Workers (Workers now has full feature parity for static assets, SSR, and custom domains; Pages gets maintenance updates at best, checked 2026-07-07). The correct target is **Cloudflare Workers with static assets**.

**Action needed**: update `tech-stack.md`'s `deployment_target` field from `cloudflare-pages` to `cloudflare-workers` (or re-run `/10x-tech-stack-selector` if a fuller pass is preferred) before scaffolding/deploying, so the two foundation contracts stay aligned.

## Platform Comparison

Hard filters applied: none dropped a candidate — no persistent-connection requirement (interview Q1 = No), and all six platforms support the JS/Node runtime.

| Platform | CLI-first | Managed/Serverless | Agent-readable docs | Stable deploy API | MCP/Integration | Total |
|---|---|---|---|---|---|---|
| **Cloudflare Workers** | Pass | Pass | Pass | Pass | Partial | 4.5/5 |
| **Vercel** | Pass | Pass | Pass | Pass | Partial (beta) | 4.5/5 |
| **Netlify** | Pass | Pass | Pass | Partial | Pass | 4/5 |
| **Railway** | Pass | Pass | Partial | Partial | Pass | 3.5/5 |
| **Render** | Partial | Pass | Partial | Partial | Pass | 3/5 |
| **Fly.io** | Pass | Partial | Partial | Partial | Partial | 2.5/5 |

**Cloudflare Workers**: `wrangler deploy`/`wrangler rollback`/`wrangler tail` cover the full CLI loop. GA `llms.txt` and per-page markdown ("Markdown for Agents," GA as of Feb 2026) make docs fully agent-readable. Deploy API is deterministic and versioned. MCP tooling exists for *building* agent-facing servers on Workers, but there isn't yet a mature first-party "manage my Cloudflare account" MCP server — scored Partial.

**Vercel**: `vercel deploy`/`vercel rollback`/`vercel logs` are mature. Astro support is first-party GA via `@astrojs/vercel`. Function timeout is 300s by default *and* max on Hobby (Fluid Compute) — the most generous margin of any platform for the 5-15s Claude call. Official MCP server is in Public Beta, read-only — scored Partial. Hobby tier is legally restricted to non-commercial personal use; any future monetization requires Pro ($20/mo).

**Netlify**: Astro support is GA and CLI is solid, but there's no dedicated CLI rollback command (dashboard/API only) — scored Partial on deploy API. Official MCP server is GA. The critical constraint: synchronous function timeout is 10s on Free/Personal and 26s on Pro — a 15s-tail Claude response risks intermittent failure below Pro, which conflicts with the cost-minimize priority.

**Railway**: Solid all-around PaaS — GA CLI, GA MCP server, Astro documented directly, and services don't sleep by default on the Hobby plan. Scored Partial on docs (no `llms.txt`) and deploy API (rollback is really "redeploy a prior build," not a dedicated command). No free tier for new accounts; realistic cost $5-10/mo.

**Render**: CLI is secondary to the dashboard/Blueprints — scored Partial. Long-running requests are very generous (~100 min), which trivializes the LLM-call constraint, and MCP is GA with 20+ tools. Free tier cold-starts (15 min inactivity spin-down) would hurt the "Forge Scene" UX; Starter ($7/mo) avoids it.

**Fly.io**: CLI (`flyctl`) is mature and WebSocket/long-running support is a genuine strength, but it requires Docker (Managed/Serverless scored Partial — real, ongoing Dockerfile maintenance), no confirmed `llms.txt` (Partial on docs), no dedicated rollback command (Partial on deploy API), and no free tier — realistic always-on cost is $13-20/mo, the highest of any candidate. Doesn't fit the cost-minimize + solo-simplicity constraints as well as the top three.

### Shortlisted Platforms

#### 1. Cloudflare Workers (Recommended)

Cheapest at this traffic level ($5/mo flat, since real app CPU will exceed the 10ms free-tier ceiling), and the only platform where the specific "5-15s LLM call" workload is architecturally free — I/O-wait time doesn't count against CPU-time billing or limits. Best-in-class agent-readable docs. Aligns with (a corrected) tech-stack.md.

#### 2. Vercel

Free at this scale, with the most generous function timeout margin (300s) of any candidate, removing all timeout risk for Forge Scene outright. First-party Astro support is excellent. Held back only by the Hobby tier's non-commercial-use restriction and a beta-stage MCP server.

#### 3. Railway

A long-running Node process sidesteps the entire serverless-timeout question — Forge Scene just runs like a normal request on a normal server, no CPU-time or duration ceilings to reason about. Reasonable cost ($5-10/mo) and a mature, GA MCP server. Weaker on agent-readable docs and lacks a dedicated rollback command.

## Anti-Bias Cross-Check: Cloudflare Workers

### Devil's Advocate — Weaknesses

1. Astro-on-Workers is a very recent combination (the Pages deprecation is recent) — most existing tutorials, Stack Overflow answers, and AI training data (including this assistant's) still describe the deprecated Pages workflow, so troubleshooting-by-search is more likely than not to surface stale instructions.
2. `nodejs_compat` is required but not all npm packages behave correctly under `workerd` — the Supabase JS client and any Claude SDK dependency need per-package verification; breakage may only surface in production, not local dev.
3. CPU-time billing (10ms free / 30s default paid) diverges sharply from local dev, where CPU is effectively unlimited — a CPU-bound regression (e.g., heavy JSON schema validation on the LLM response) can pass locally and then time out in production.
4. KV's eventual consistency (up to 60s global propagation) is a landmine if ever used for caching or session state later, even though it's unused today.
5. Any tutorial-copied Cloudflare Pages configuration requires real rework to port to Workers (`wrangler.toml` shape differs, routing model differs) — a hidden migration tax on a 4-week solo timeline.

### Pre-Mortem — How This Could Fail

Six months in, Forge Scene generation starts failing intermittently in production but never locally. The project was scaffolded from a tutorial that still referenced Cloudflare Pages, then hand-adapted to Workers without closely re-reading current adapter docs — a subtle `nodejs_compat` mismatch made the Supabase client behave unreliably under concurrent requests. Nobody caught it because `astro dev` doesn't run inside `workerd`, so runtime quirks never appeared until real deploys. The $5/mo Paid plan was adopted early "just in case," but no CPU-time alerting was set up — when a later refactor added synchronous validation to every Forge Scene response, invocations began hitting the 30s CPU ceiling under normal load, timing out exactly the slow Claude responses the platform was supposed to handle gracefully. Weeks of debugging time went into a failure mode invisible in both `wrangler dev` and Cloudflare's own dashboard, which reported "success" for CPU-limit-adjacent failures.

### Unknown Unknowns

- `wrangler dev` and Cloudflare's local emulation do not perfectly replicate `workerd`'s runtime constraints — some bugs (Node API incompatibilities, CPU-limit edge cases) only appear after a real `wrangler deploy`, undermining the usual "test locally, deploy with confidence" loop.
- Because the Pages→Workers consolidation is recent, a large fraction of available guidance skews toward the deprecated workflow — this is a real risk for both human troubleshooting and future agent-assisted debugging sessions.
- Preview/branch deployments work differently on Workers than they did on Pages — not automatically free the way Pages preview URLs were; requires explicit environment/version configuration in `wrangler.toml`.
- `wrangler rollback` reverts code but not bound resources (KV namespaces, secrets, D1 migrations) — a rollback that assumes full state reversion could leave the app in a mixed, broken state if bindings changed between versions.
- The 30s limit is CPU time, not wall-clock — a common mistake is misdiagnosing a timeout as caused by the LLM call itself when it's actually unrelated CPU-bound code, since I/O-wait time is excluded from the limit.

**Decision**: Proceed with Cloudflare Workers, risks noted and recorded in the risk register below.

## Operational Story

- **Preview deploys**: Workers environments/versions provide preview URLs per deployment (`wrangler versions upload` for a preview version, `wrangler versions deploy` to promote); this is not automatic per-PR the way Pages was — needs explicit wiring in the GitHub Actions workflow (e.g., a workflow step that runs `wrangler versions upload` on PR branches and posts the preview URL as a PR comment).
- **Secrets**: Managed via `wrangler secret put <NAME>` (stored encrypted in Cloudflare, not in the repo) for runtime secrets (Supabase service key, Claude API key); GitHub Actions' own secrets store holds the Cloudflare API token used for CI deploys. Only the account owner can read Workers secrets via the dashboard or `wrangler secret list` (names only, not values).
- **Rollback**: `wrangler rollback [version-id]` reverts code to a prior version in seconds. Caveat: this does not revert secrets or KV/D1 bindings if they changed between versions (see Unknown Unknowns) — any Supabase schema migration tied to a bad deploy is not auto-reverted and needs a manual check.
- **Approval**: Routine deploys (`wrangler deploy` on merge to main via GitHub Actions, matching `ci_default_flow: auto-deploy-on-merge`) can run unattended. Human-only: rotating the Cloudflare API token, changing billing/plan tier, deleting the Worker or its bound resources (KV/D1 if ever added).
- **Logs**: `wrangler tail` streams live production logs (request/response, console output, exceptions) directly in the terminal — no dashboard needed for an agent to read runtime behavior read-only.

## Risk Register

| Risk | Source | Likelihood | Impact | Mitigation |
|---|---|---|---|---|
| tech-stack.md still names `cloudflare-pages`, which is no longer valid for Astro SSR | Research finding | H | H | Update `deployment_target` to `cloudflare-workers` in tech-stack.md before bootstrapping; do not follow any Pages-specific scaffolding instructions |
| Guidance/tutorials/training data skew toward deprecated Pages workflow, leading to stale commands or config during setup or debugging | Devil's advocate / Unknown unknowns | H | M | Always cross-check `wrangler` commands and adapter config against `developers.cloudflare.com/workers/framework-guides/web-apps/astro/` and the current `@astrojs/cloudflare` adapter docs, not older Pages-era tutorials |
| `nodejs_compat` incompatibility with a dependency (Supabase client or Claude SDK) surfaces only in production, not local `astro dev` | Devil's advocate / Pre-mortem | M | H | After first deploy, exercise the full auth + Forge Scene flow against the real deployed Worker (not just `astro dev`) before considering the deploy verified; watch `wrangler tail` during that smoke test |
| CPU-time limit (30s default on Paid) is hit by unrelated synchronous code, misdiagnosed as an LLM-call timeout | Unknown unknowns | L | M | If a Forge Scene request times out, check `wrangler tail` for CPU-limit-specific error codes before assuming the Claude API itself was slow |
| `wrangler rollback` reverts code but not bound secrets/resources, leaving a mixed state after a bad deploy | Unknown unknowns | L | M | Document current secret/binding state before any deploy that changes them; treat rollback as code-only and verify bindings manually after |
| Free-tier CPU-time ceiling (10ms) is too low for real app code, forcing the $5/mo Paid plan sooner than expected | Research finding | H | L | Budget the $5/mo Paid plan from day one rather than starting on Free and hitting a wall mid-development |

## Getting Started

1. Correct `context/foundation/tech-stack.md`: change `deployment_target: cloudflare-pages` to `deployment_target: cloudflare-workers`.
2. Confirm the installed `@astrojs/cloudflare` adapter version supports Workers-with-static-assets (v13+); if the bootstrapped project used an older Pages-oriented config, follow `https://developers.cloudflare.com/workers/framework-guides/web-apps/astro/` to migrate `astro.config.mjs` and `wrangler.toml`.
3. Install Wrangler CLI: `npm install --save-dev wrangler` (project-local, keeps CI reproducible).
4. Add `compatibility_flags: ["nodejs_compat"]` to `wrangler.toml` (required for the Supabase client and most Claude SDK/HTTP client code).
5. Set runtime secrets before first deploy: `wrangler secret put SUPABASE_SERVICE_KEY` and `wrangler secret put ANTHROPIC_API_KEY` (names illustrative — match whatever the app's env code expects).
6. Wire GitHub Actions to run `wrangler deploy` on merge to main (matching the existing `ci_default_flow: auto-deploy-on-merge`), authenticated via a Cloudflare API token stored in GitHub Actions secrets (scoped to this Worker only, no account-wide permissions).
7. After first deploy, smoke-test the full auth + Forge Scene flow against the live Worker URL (not just local `astro dev`) to catch any `workerd`-specific runtime issues early.

## Out of Scope

The following were not evaluated in this research:
- Docker image configuration
- CI/CD pipeline setup (beyond noting the existing `auto-deploy-on-merge` flow)
- Production-scale architecture (multi-region, HA, DR)
