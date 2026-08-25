# Enforce Scene Readiness — Plan Brief

> Full plan: `context/changes/enforce-scene-readiness/plan.md`
> Research: `context/changes/enforce-scene-readiness/research.md`

## What & Why

Roadmap slice `S-03`: let the creator set a scene's status (Draft / Needs Work / Ready), add freeform notes, and acknowledge or clear generated design risks — with "Ready" blocked unless the completeness rule holds. This turns the product from a card generator into an actual readiness gate, the PRD's core differentiator (FR-018, FR-019, FR-020, FR-022).

## Starting Point

`scene_cards.status` already exists in the DB but is write-only and hardcoded to `"draft"` on every generate/regenerate. `design_risks` is a flat array of strings with no acknowledgment state — deliberately left simple by S-01's plan review so this change could design it fresh. No notes column, no update route, and no completeness-rule logic exist anywhere yet.

## Desired End State

On any scene with a generated card, the creator can pick a status, write notes, and check off risks as acknowledged, then Save in one action. Ready is disabled in the UI (with a tooltip naming what's missing) and re-validated on the server whenever the rule isn't met. Regenerating resets status/acknowledgments but keeps the creator's notes.

## Key Decisions Made

| Decision | Choice | Why (1 sentence) | Source |
| --- | --- | --- | --- |
| Design-risk storage | Restructure `design_risks` to `{risk, acknowledged}` objects (migration + backfill) | Single source of truth per risk, matches the shape S-01 had originally drafted before deferring it here | Plan |
| Regenerate behavior | Reset status to Draft + clear all acknowledgments; preserve notes | Enforces the PRD's "never a silent pass" guarantee — stale acknowledgments on newly-generated risks would be meaningless | Plan |
| Status control UI | Hand-rolled 3-pill segmented control, no new dependency | Matches the app's existing lightweight visual language for a fixed 3-value control | Plan |
| Ready-blocked UX | Disable the Ready pill client-side (tooltip lists missing items) + server re-validates | Matches the PRD's literal "prevents setting Ready" and delivers the proactive UX version of the core differentiator | Plan |
| Completeness-rule testing | Unit-test `isReadyEligible()` as a pure function | Cheapest-to-test, highest-value logic in the change; matches the "unit-test the riskiest logic" convention from S-01's adapter | Plan |
| Save mechanism | Single explicit Save button, one combined PATCH request (status + notes + acknowledgments) | Matches the app's existing explicit-submit pattern; no autosave exists anywhere yet | Plan |

## Scope

**In scope:** status setting, freeform notes, per-risk acknowledge/clear, server- and client-side Ready-gate enforcement, the `notes` column + `design_risks` restructuring migration, one new PATCH route.

**Out of scope:** character management (S-04), project/scene browsing (S-02), stale-card marking on note edits (S-05), CI test wiring, provisioning a real `ANTHROPIC_API_KEY` in production.

## Architecture / Approach

One new pure function (`isReadyEligible`) shared by both the server (enforcement) and the client (disabling the Ready pill) so the rule is defined exactly once. One new PATCH route (`/api/scenes/[id]/card`) persists status/notes/acknowledgments in a single request, reusing the ownership-check and JSON-response conventions already established by `forge.ts`. The existing `SceneCard`/`ForgeSceneButton` components gain the editing surface directly rather than introducing a new component.

## Phases at a Glance

| Phase | What it delivers | Key risk |
| --- | --- | --- |
| 1. Data Model, Type Contract & Readiness Rule | Migration, updated types, the pure completeness-rule function + unit tests | Data backfill correctness for any non-empty `design_risks` rows (low risk — production has none, per mock-only constraint) |
| 2. Card Update API Route | PATCH route enforcing the rule server-side | None significant — follows an established route pattern closely |
| 3. Card Editing UI | Status pills, notes field, risk checkboxes, wired to Phase 2 | Verifying the Ready-gate UX requires a real `ANTHROPIC_API_KEY` locally, since the mock path can never satisfy the rule |

**Prerequisites:** `first-forged-scene-card` (S-01) shipped and reviewed — done. Local Supabase + Docker/WSL2 available for the migration.
**Estimated effort:** ~3 sessions across 3 phases, consistent with S-01's pacing.

## Open Risks & Assumptions

- **Ready is unreachable in production today.** The mock generator always returns empty `interactiveElement`/`requiredAssets`, and production has no `ANTHROPIC_API_KEY`. This is an accepted consequence of S-01's standing mock-only-production constraint, not something this plan changes — full Ready-gate verification requires a real key, tested locally.
- Characters (S-04) don't exist yet, so the character-function branch of the rule is implemented generically but untestable end-to-end until S-04 ships.

## Success Criteria (Summary)

- A creator can set any status freely, but can only reach Ready once every completeness criterion is genuinely met — enforced both in the UI and on the server.
- Acknowledging/clearing design risks and saving notes both persist correctly, and regenerating a card doesn't silently carry forward a stale Ready status or acknowledgment.
