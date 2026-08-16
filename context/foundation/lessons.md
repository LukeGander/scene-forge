# Lessons Learned

> Append-only register of recurring rules and patterns. Re-read at start by /10x-frame, /10x-research, /10x-plan, /10x-plan-review, /10x-implement, /10x-impl-review.

## Keep agent rule files short, reference-based, and validated before relying on them

- **Context**: Agent onboarding / M1L4 — root-level AGENTS.md and project rule files.
- **Problem**: Without a short, reviewed, project-specific onboarding file, future agent sessions infer too much from framework defaults, README, or code structure alone. This can cause scope creep, duplicated README/config knowledge, or implementation choices that ignore PRD non-goals.
- **Rule**: Keep agent rules short, project-specific, and tied to @references such as @context/foundation/prd.md, @README.md, and config files. After generating or editing AGENTS.md, run rule review, remove duplicated public/framework knowledge, and test the rules in a fresh agent session before relying on them for implementation.
- **Applies to**: frame, plan, implement, review

## New tables need an explicit GRANT alongside RLS

- **Context**: supabase/migrations/20260802120000_create_scene_forge_core.sql / supabase/migrations/20260813210000_grant_scene_forge_core_privileges.sql
- **Problem**: The Aug 2 schema migration enabled RLS and owner policies but never granted table-level DML privileges (select/insert/update/delete) to `authenticated`. Postgres denies access at the privilege layer before RLS is ever evaluated, so every query failed with "permission denied for table" until an Aug 13 follow-up migration added the grants.
- **Rule**: Every migration that creates a table and enables RLS must GRANT select/insert/update/delete to `authenticated` in the same migration.
- **Applies to**: plan, implement, impl-review
