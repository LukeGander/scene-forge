# Forge Scene: First Scene Card — Plan Brief

> Full plan: `context/changes/first-forged-scene-card/plan.md`

## What & Why

Build the first end-to-end "Forge Scene" loop: a creator creates a minimal project, adds a scene note, runs Forge Scene, and gets back a structured scene card. This is the roadmap's north star (`S-01`) — the smallest slice that validates the product's core hypothesis, that a purpose-built tool can turn a loose note into a useful scene evaluation.

## Starting Point

The codebase has working auth (Supabase email+password) and a placeholder dashboard, but nothing else: no database schema, no LLM dependency, no test runner, and no JSON API convention (every existing route is form-POST + redirect).

## Desired End State

A signed-in creator clicks "New Project," fills in title/premise/tone, adds a scene note, clicks "Forge Scene," watches a spinner with an elapsed-time counter, and sees a card with every required field populated or explicitly marked "not enough context" — never partial — at Draft status. Works with zero config (deterministic mock) and upgrades transparently once a real Anthropic key is set.

## Key Decisions Made

| Decision | Choice | Why (1 sentence) | Source |
| --- | --- | --- | --- |
| LLM adapter | Official `@anthropic-ai/sdk`, thin wrapper | Pre-verified Workers-compatible in `infrastructure.md`; handles parsing/errors | Plan |
| Mock trigger | Auto-fallback on missing API key | Mirrors the existing `config-status.ts` presence-check pattern exactly | Plan |
| Generation request | JSON `fetch` from a React island | Only way to give FR-017's required *continuous* progress feedback | Plan |
| Card storage | Typed columns + a `design_risks` array | `S-03`'s Ready-gate rule needs field-level checks; array fits variable-length risks | Plan |
| Failure handling | Fail fast, preserve note, manual retry | Matches the "note is never lost" guardrail literally, no invented retry logic | Plan |
| Thin notes | No length gate | PRD already designed "not enough context" as a valid output — a gate would contradict that | Plan |
| Data isolation | Postgres RLS + app-level filtering | Guardrail is explicit in the PRD; defense in depth costs little extra given app filtering is needed anyway | Plan |
| Project fields | Required only (title, premise, tone) | Matches S-01's own "minimal project" framing under the speed/time bias | Plan |
| Testing scope | Unit-test the adapter, manual E2E | Matches PRD's stated manual-first MVP testing strategy while covering the riskiest logic | Plan |
| Logging | Lightweight `console.log` at key points | Makes `wrangler tail` diagnostic without new infra | Plan |
| If time-constrained | Cut visual polish, not the LLM paths | Keeps the PRD's #1 risk (card quality) on schedule | Plan |
| Loading UX | Spinner + elapsed-time counter | Cheap addition, reduces perceived wait vs. a bare spinner | Plan |

## Scope

**In scope:** minimal project creation, scene note creation, Forge Scene generation (mock + real Anthropic path), scene card display, DB schema + RLS, adapter unit tests.

**Out of scope:** character management (S-04), Ready-gate/status rules (S-03), project/scene browsing (S-02), note editing after generation (S-05), CI test wiring, provisioning a real API key in production.

## Architecture / Approach

Three layers, each newly built: a Supabase schema (`projects` → `scenes` → `scene_cards`, RLS on all three, `user_id` denormalized for single-column policies) underneath a small LLM adapter (`src/lib/forge-scene/`) that picks mock vs. real Anthropic based on key presence, underneath a UI that follows the existing form-POST convention for creation steps but introduces the project's first JSON-fetch endpoint specifically for the generation call, where continuous progress feedback is required.

## Phases at a Glance

| Phase | What it delivers | Key risk |
| --- | --- | --- |
| 1. Data model & LLM adapter foundation | Schema + RLS, mock/real adapter, unit tests | No test runner exists yet — this phase also stands one up |
| 2. Project & scene creation flow | Forms + routes to create a project and a scene note | None significant — follows an established convention exactly |
| 3. Forge Scene generation & card display | JSON endpoint, loading UI, card display | Real-model output quality (the PRD's #1 risk) can only be judged once this exists |

**Prerequisites:** none — this is the roadmap's north star slice, ready to plan now.
**Estimated effort:** ~2-3 sessions across 3 phases, solo after-hours pace.

## Open Risks & Assumptions

- The 70%-card-acceptance success criterion can't be validated until Phase 3 is manually exercised against the real Anthropic path — this plan can't de-risk prompt quality itself, only make the loop exist.
- Denormalizing `user_id` onto `scenes`/`scene_cards` means every future insert path must remember to copy it correctly; a missed copy would silently weaken the isolation guardrail despite RLS being enabled.
- The exact Claude model ID isn't pinned in any foundation doc — the implementer should confirm the current recommended model against Anthropic's docs at implementation time.

## Success Criteria (Summary)

- A creator can go from zero to a viewed scene card in one sitting, with no configuration required.
- Every generated card always shows all required fields (populated or "not enough context") — never a partial card.
- One user's projects/scenes/cards are never visible to another user.
