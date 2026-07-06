# Lessons Learned

> Append-only register of recurring rules and patterns. Re-read at start by /10x-frame, /10x-research, /10x-plan, /10x-plan-review, /10x-implement, /10x-impl-review.

## Keep agent rule files short, reference-based, and validated before relying on them

- **Context**: Agent onboarding / M1L4 — root-level AGENTS.md and project rule files.
- **Problem**: Without a short, reviewed, project-specific onboarding file, future agent sessions infer too much from framework defaults, README, or code structure alone. This can cause scope creep, duplicated README/config knowledge, or implementation choices that ignore PRD non-goals.
- **Rule**: Keep agent rules short, project-specific, and tied to @references such as @context/foundation/prd.md, @README.md, and config files. After generating or editing AGENTS.md, run rule review, remove duplicated public/framework knowledge, and test the rules in a fresh agent session before relying on them for implementation.
- **Applies to**: frame, plan, implement, review
