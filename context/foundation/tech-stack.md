---
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
---

## Why this stack

A solo creator shipping a 4-week after-hours web-app with email+password auth and an LLM-powered scene-card generation flow needs a battle-tested, agent-friendly starter that handles auth + database + edge deploy without extra plumbing. 10x-astro-starter is the recommended default for (web-app, js), passes all four agent-friendly gates, and ships Supabase auth + PostgreSQL out of the box — covering FR-001 through FR-003 and the data model immediately. Cloudflare Pages deploy pairs with GitHub Actions on auto-deploy-on-merge for a frictionless release cycle on a solo schedule. AI calls (FR-016) hit Cloudflare edge via API routes; typical Claude API response times (5–15 s) sit well within the 30-second edge timeout. Standard path taken; bootstrapper confidence is first-class — expect mostly-smooth scaffolding with occasional manual steps.
