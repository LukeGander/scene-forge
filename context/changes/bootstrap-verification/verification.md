---
bootstrapped_at: 2026-06-21T18:18:08Z
starter_id: 10x-astro-starter
starter_name: "10x Astro Starter (Astro + Supabase + Cloudflare)"
project_name: scene-forge
language_family: js
package_manager: npm
cwd_strategy: git-clone
bootstrapper_confidence: first-class
phase_3_status: ok
audit_command: "npm audit --json"
---

## Hand-off

```yaml
starter_id: 10x-astro-starter
package_manager: npm
project_name: scene-forge
hints:
  language_family: js
  team_size: solo
  deployment_target: cloudflare-pages
  ci_provider: github-actions
  ci_default_flow: auto-deploy-on-merge
  bootstrapper_confidence: first-class
  path_taken: standard
  quality_override: false
  self_check_answers: null
  has_auth: true
  has_payments: false
  has_realtime: false
  has_ai: true
  has_background_jobs: false
```

### Why this stack

A solo creator shipping a 4-week after-hours web-app with email+password auth and an LLM-powered scene-card generation flow needs a battle-tested, agent-friendly starter that handles auth + database + edge deploy without extra plumbing. 10x-astro-starter is the recommended default for (web-app, js), passes all four agent-friendly gates, and ships Supabase auth + PostgreSQL out of the box — covering FR-001 through FR-003 and the data model immediately. Cloudflare Pages deploy pairs with GitHub Actions on auto-deploy-on-merge for a frictionless release cycle on a solo schedule. AI calls (FR-016) hit Cloudflare edge via API routes; typical Claude API response times (5–15 s) sit well within the 30-second edge timeout. Standard path taken; bootstrapper confidence is first-class — expect mostly-smooth scaffolding with occasional manual steps.

---

## Pre-scaffold verification

| Signal      | Value                                                    | Severity | Notes                                            |
| ----------- | -------------------------------------------------------- | -------- | ------------------------------------------------ |
| npm package | not run                                                  | —        | cmd_template starts with `git clone`, not `npm create` — npm check skipped per spec |
| GitHub repo | przeprogramowani/10x-astro-starter last pushed 2026-05-17 | fresh    | 35 days before bootstrap; from card.docs_url via GitHub REST API (gh CLI unavailable, fell back to Invoke-RestMethod) |

---

## Scaffold log

**Resolved invocation**: `git clone https://github.com/przeprogramowani/10x-astro-starter .bootstrap-scaffold && cd .bootstrap-scaffold && npm install`
**Strategy**: git-clone (starter repo cloned without keeping upstream history)
**Exit code**: 0
**Files moved**: 19 top-level items (directories and files)
**Conflicts (.scaffold siblings)**: `CLAUDE.md` → `CLAUDE.md.scaffold` (cwd's course CLAUDE.md preserved; diff with `diff CLAUDE.md CLAUDE.md.scaffold` to review starter's AI context)
**.gitignore handling**: append-merged — cwd lines kept in order; 8 non-duplicate lines from starter appended under `# from 10x-astro-starter` separator (`npm-debug.log*`, `yarn-debug.log*`, `yarn-error.log*`, `pnpm-debug.log*`, `.env.production`, `.dev.vars`, `.DS_Store`, `.idea/`)
**context/ handling**: no `context/` directory present in scaffold — no drop needed
**.bootstrap-scaffold cleanup**: directory left in place (empty; Windows filesystem lock prevented removal — safe to delete manually: `Remove-Item -Recurse -Force .bootstrap-scaffold`)

---

## Post-scaffold audit

**Tool**: `npm audit --json`
**Summary**: 0 CRITICAL, 6 HIGH, 10 MODERATE, 2 LOW
**Direct vs transitive**: not distinguished by this tool (metadata.dependencies.direct not populated in this npm version)

#### CRITICAL findings

None.

#### HIGH findings

| Package    | Advisory                                                                                                   | Fixable |
| ---------- | ---------------------------------------------------------------------------------------------------------- | ------- |
| `astro`    | Reflected XSS via unescaped slot name; XSS via Unescaped Attribute Names in Spread Props; Host header SSRF in prerendered error page fetch; transitive via esbuild | `npm audit fix` |
| `devalue`  | DoS via sparse array deserialization                                                                        | `npm audit fix` |
| `miniflare`| Transitive via `undici` and `ws`                                                                            | `npm audit fix` |
| `undici`   | TLS certificate validation bypass (SOCKS5 ProxyAgent); cross-user info disclosure via shared cache; HTTP header injection via Set-Cookie percent-decoding; WebSocket DoS via fragment count bypass; SOCKS5 proxy pool reuse; HTTP response queue poisoning via keep-alive; Set-Cookie SameSite downgrade | `npm audit fix` |
| `vite`     | NTLMv2 hash disclosure via UNC path handling **on Windows**; `server.fs.deny` bypass via Windows alternate paths — **relevant on this machine** | `npm audit fix` |
| `ws`       | Uninitialized memory disclosure; Memory exhaustion DoS via tiny fragments                                   | `npm audit fix` |

#### MODERATE findings

| Package                  | Advisory summary                                               | Fixable            |
| ------------------------ | -------------------------------------------------------------- | ------------------ |
| `@astrojs/check`         | Transitive via @astrojs/language-server                        | Major bump required |
| `@astrojs/language-server` | Via volar-service-yaml                                       | Major bump required |
| `@cloudflare/vite-plugin`| Transitive via miniflare, wrangler, ws                         | `npm audit fix`    |
| `js-yaml`                | Quadratic-complexity DoS via repeated merge key aliases        | `npm audit fix`    |
| `supabase`               | Transitive via tar                                             | `npm audit fix`    |
| `tar`                    | PAX size override allows file smuggling (parser differential)  | `npm audit fix`    |
| `volar-service-yaml`     | Transitive via yaml-language-server                            | Major bump required |
| `wrangler`               | Transitive via esbuild, miniflare                              | `npm audit fix`    |
| `yaml`                   | Stack overflow via deeply nested YAML collections              | Major bump required |
| `yaml-language-server`   | Transitive via yaml                                            | Major bump required |

#### LOW findings

| Package       | Advisory                                                                 | Fixable         |
| ------------- | ------------------------------------------------------------------------ | --------------- |
| `@babel/core` | Arbitrary file read via sourceMappingURL comment                         | `npm audit fix` |
| `esbuild`     | Arbitrary file read when running dev server **on Windows** — **relevant on this machine** | `npm audit fix` |

**Recommended action**: run `npm audit fix` to resolve the 14 fixable findings (all 6 HIGH, 6 of 10 MODERATE, both LOW). The remaining 4 MODERATE findings require major version bumps; review manually. All HIGH findings are in dev/build tooling (astro, vite, wrangler, miniflare) or their transitive deps — not runtime production dependencies, but worth patching before going live.

---

## Hints recorded but not acted on

| Hint                  | Value               | Notes                                                     |
| --------------------- | ------------------- | --------------------------------------------------------- |
| bootstrapper_confidence | first-class       | surfaced in Step 0 summary; no automated compensation in v1 |
| quality_override      | false               | no quality gate was overridden during stack selection     |
| path_taken            | standard            | informational                                             |
| self_check_answers    | null                | no self-check answers recorded                            |
| team_size             | solo                | no multi-person scaffolding adjustments in v1             |
| deployment_target     | cloudflare-pages    | CI/CD scaffolding deferred to future M1L4 skill           |
| ci_provider           | github-actions      | CI/CD scaffolding deferred to future M1L4 skill           |
| ci_default_flow       | auto-deploy-on-merge | CI/CD scaffolding deferred to future M1L4 skill          |
| has_auth              | true                | starter ships Supabase auth out of the box — no additional scaffold action needed in v1 |
| has_payments          | false               | —                                                         |
| has_realtime          | false               | —                                                         |
| has_ai                | true                | AI integration scaffolding deferred to future M1L4 skill  |
| has_background_jobs   | false               | —                                                         |

---

## Next steps

Next: a future skill will set up agent context (CLAUDE.md, AGENTS.md). For now, your project is scaffolded and verified — happy hacking.

Useful manual steps in the meantime:

- `git init` (if you have not already) to start your own repo history. Note: this project already has an existing `.git` from before bootstrapping — no `git init` needed, but run `git status` to see the new files staged for your first commit.
- Review `CLAUDE.md.scaffold` — the starter ships a useful AI context file with commands, architecture, and conventions. Consider merging its content into your `CLAUDE.md`.
- Run `npm audit fix` to patch the 14 fixable vulnerabilities (all 6 HIGH included). Then review the remaining 4 MODERATE findings that need major bumps.
- Copy `.env.example` to `.env` for local Node development, or `.dev.vars` for Cloudflare local dev (see `CLAUDE.md.scaffold` for details).
- Start local Supabase: `npx supabase start` (requires Docker).
- Address audit findings per your project's risk tolerance — the full breakdown is above.
- Delete `.bootstrap-scaffold/` once Windows releases its lock: `Remove-Item -Recurse -Force .bootstrap-scaffold`
