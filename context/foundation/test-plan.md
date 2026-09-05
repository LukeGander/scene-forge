# Test Plan

> Phased test rollout for this project. Strategy is frozen at the top
> (§1–§5); cookbook patterns at the bottom (§6) fill in as phases ship.
> Read before writing any new test.
>
> Refresh: re-run `/10x-test-plan --refresh` when stale (see §8).
>
> Last updated: 2026-09-03

## 1. Strategy

Tests follow three non-negotiable principles for this project:

1. **Cost × signal.** The cheapest test that gives a real signal for the
   risk wins. Do not promote to e2e because e2e "feels safer." Do not put a
   vision model on top of a deterministic check that already catches the
   regression.
2. **User concerns are first-class evidence.** Risks anchored in "the
   creator is worried about X, and the failure would surface somewhere in
   area Y" carry the same weight as PRD lines or hot-spot data.
3. **Risks are scenarios, not code locations.** This plan documents _what
   could fail_ and _why we believe it's likely_ — drawn from documents,
   interview, and codebase _signal_ (churn, structure, test base). It does
   NOT claim to know which line owns the failure. That knowledge is
   produced by `/10x-research` during each rollout phase. If the plan and
   research disagree about where the failure lives, research is the
   ground truth.

Hot-spot scope used for likelihood weighting: `src/`, `supabase/`, `.github/` (15 commits/30d — sufficient signal).

## 2. Risk Map

The top failure scenarios this project must protect against, ordered by
risk = impact × likelihood. Risks are failure scenarios in user / business
terms, not test names. The Source column cites the _evidence that surfaced
this risk_ — never a specific file as "where the failure lives" (that is
research's job, see §1 principle #3).

| #   | Risk (failure scenario)                                                                                                                                                                                                             | Impact | Likelihood | Source (evidence — not anchor)                                                                                                                                                                                                      |
| --- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------ | ---------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | A creator reaches, modifies, or infers the existence of another creator's project/scene/card through an API route whose ownership check is missing, wrong, or inconsistent with the others                                          | High   | Medium     | interview Q1 (data-isolation fear), Q4 (explicit, most concrete named gap: "ownership checks... not covered by automated tests"); PRD guardrail ("never accessible to another user"); hot-spot dir `src/pages/api/` (8 commits/30d) |
| 2   | Forge Scene returns a card with a field silently empty/defaulted instead of populated or explicitly marked "not enough context," and the creator doesn't notice                                                                     | High   | Medium     | interview Q1 (explicit: "incomplete data without making the problem obvious"); PRD guardrail ("never silently omits a section"); hot-spot dir `src/lib/forge-scene/` (15 commits/30d — top hot-spot)                                |
| 3   | A scene note is edited after its card was generated, but the card is not visibly marked stale to the creator (logic fires but the UI doesn't surface it, or an edge case in the staleness condition is missed)                      | High   | Medium     | interview Q1 (explicit: "card becoming inconsistent with the source scene note"); PRD FR-021; roadmap slice S-05 (archived, implemented)                                                                                            |
| 4   | The server-side re-validation of the "Ready" completeness rule regresses (e.g. a future change to the card-update route accepts a Ready transition it shouldn't), independent of whether the pure rule function itself is correct   | High   | Low        | PRD guardrail + FR-020 (core differentiator); roadmap S-03 risk note ("what turns the product from a card generator into a readiness gate")                                                                                         |
| 5   | Client-side state (React island) falls out of sync with server state after a Save or Regenerate round-trip — e.g. the UI shows a stale readiness/status or risk-acknowledgment state that doesn't match what was actually persisted | Medium | Medium     | interview Q3 (explicit: SSR/hydration/auth/DB-state agreement is the low-confidence boundary); hot-spot dirs `src/components/scenes/` (11 commits/30d), `src/pages/scenes/` (6 commits/30d)                                         |
| 6   | Two independently-tested changes each pass their own lint/build/unit gates but produce a runtime failure only visible when exercised together after merge                                                                           | Medium | High       | interview Q2 (explicit, recurring pattern named directly: S-02 + S-05 individually green, broke post-merge); repo history (a recent fix commit addressing a cross-slice dev-session breakage)                                       |

Risks 1–3 tie at High/Medium; ordered by directness of evidence (#1 is the most explicitly named, concrete, currently-zero-coverage gap per interview Q4) rather than by a false finer-grained score split.

**Abuse / security lens applied:** Risk #1 is the authorization/IDOR row required by the abuse lens (auth + user data present). Resource-abuse (repeated Forge Scene calls) was evaluated and dropped: production runs mock-only (no `ANTHROPIC_API_KEY` provisioned, per `deploy-plan.md`), so there is no real LLM cost exposure today. Revisit if a real key is ever provisioned to production.

### Risk Response Guidance

| Risk | What would prove protection                                                                                                                                                          | Must challenge                                                                                                                            | Context `/10x-research` must ground                                                                                                                                     | Likely cheapest layer                                                                                                 | Anti-pattern to avoid                                                                                                                                                         |
| ---- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| #1   | A second authenticated user cannot read, modify, or distinguish-by-response (404 vs 403) another user's project/scene/card via any API route                                         | "It was manually verified once, so it stays correct" / "the new route copied the same pattern as the old one correctly"                   | Which routes exist, each route's ownership-check shape, session/auth fixture setup, consistent not-found-vs-forbidden response contract                                 | integration test hitting real routes with two seeded users                                                            | Testing only the happy path (owner accessing own data); asserting against the route's own implementation instead of the independent "never visible to another user" guardrail |
| #2   | Every required scene-card field is either populated or explicitly marked "not enough context" — never silently empty/omitted, across a range of malformed/partial LLM tool responses | "The tool call succeeding / JSON parsing means the response is valid and complete"                                                        | The validation/mapping boundary between raw LLM tool output and the card's field contract, the existing sentinel convention, what already-passing tests cover vs. don't | unit / contract test at the adapter validation boundary                                                               | Oracle problem — asserting against whatever the adapter currently returns rather than the PRD's "no partial output" contract                                                  |
| #3   | After a note edit post-generation, the stale state is both computed correctly and visibly rendered in the UI                                                                         | "A passing unit test on the staleness function proves the creator sees the stale state" — logic correctness ≠ UI surfacing                | Where the staleness flag is computed vs. where/how it's displayed, edge cases (edit before vs. after generation, regenerate clearing staleness)                         | component / integration test asserting the visible stale indicator, distinct from the existing pure-function coverage | Re-testing the already-covered pure function instead of the display gap; snapshotting markup instead of asserting the behavior                                                |
| #4   | A Ready-status transition is rejected server-side whenever the completeness rule is unmet, regardless of what the client already checked or sent                                     | "The pure rule function is unit-tested, so the route that calls it is safe" — route-level wiring/re-fetch logic is untested independently | The update route's re-validation flow, what row data it re-fetches vs. trusts from the request body                                                                     | integration test on the route itself (not just the pure function)                                                     | Duplicating the pure-function's unit tests at the route level instead of testing the route's re-validation wiring specifically                                                |
| #5   | After Save or Regenerate, the rendered UI state (status, notes, risk-acknowledgment) matches exactly what was persisted — no stale client state lingering                            | "A 200 response means the UI reflects it correctly" — server correctness doesn't guarantee client reconciliation                          | The component state-update flow after a round-trip, what the route returns vs. what the component merges into local state                                               | component-level test on the round-trip, not full e2e                                                                  | Full e2e test for something a component test catches cheaper; asserting on rendered markup snapshot instead of state values                                                   |
| #6   | Running the full test suite against a merged/integrated tree (not per-branch in isolation) catches interaction failures that isolated gates miss                                     | "Each PR's own green lint/build/unit run means the integrated app works after merge"                                                      | Whether CI runs tests at all today (it does not), what a minimal cross-cutting check would need to exercise                                                             | CI gate wiring; a lightweight smoke check is a stretch goal, not a requirement                                        | Writing a test that re-asserts the specific past bug instead of the general "gate the full suite on merge" behavior                                                           |

## 3. Phased Rollout

Each row is a discrete rollout phase that will open its own change folder
via `/10x-new`. Status moves left-to-right through the values below; the
orchestrator updates Status as artifacts appear on disk.

| #   | Phase name                                     | Goal (one line)                                                                                                                                                                                     | Risks covered | Test types                         | Status      | Change folder                                                                          |
| --- | ---------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------- | ---------------------------------- | ----------- | -------------------------------------------------------------------------------------- |
| 1   | API ownership & authorization coverage         | Prove no API route lets one creator touch another's data                                                                                                                                            | #1            | integration (two-user route tests) | complete    | `context/archive/2026-09-03-testing-api-ownership-authorization/`                      |
| 2   | Forge Scene contract & staleness integrity     | Prove generated cards never silently omit fields, and stale notes are visibly flagged                                                                                                               | #2, #3        | unit/contract + component          | not started | —                                                                                      |
| 3   | Readiness-gate & state-reconciliation coverage | Prove the Ready-gate re-validates server-side, and client state matches server state after Save/Regenerate                                                                                          | #4, #5        | integration + component            | not started | —                                                                                      |
| 4   | Quality-gates wiring                           | Wire `npm run test` into CI as a blocking gate, formalizing the floor Phases 1–3 built                                                                                                              | #6            | gates                              | not started | —                                                                                      |
| 5   | M3L4 supplemental E2E coverage                 | Add the one E2E test genuinely required (#3, cross-island stale-state sync) plus a supplemental browser-level check for #5 — supplemental to, not a replacement for, Phases 1–4's existing coverage | #3, #5        | e2e (Playwright)                   | complete    | no change folder (standalone `/10x-e2e` run) — commits `83b658e`, `5e08d35`, `3c829f8` |

**Order rationale:** Phase 1 leads despite tying #2/#3 on score because it is the most explicitly named, currently zero-coverage gap (interview Q4) and its two-user fixture is reused by Phase 3's readiness-route tests. Phase 2 groups #2/#3 as the "silent wrong state" cluster sharing the `forge-scene` area. Phase 3 depends on Phase 1's fixture pattern. Phase 4 must come last — gates only make sense once there is a suite worth gating, and closes risk #6 directly.

**Phase 5 addendum (added 2026-09-05, M3L4 scope expansion):** #3 is the strongly justified E2E case — the stale-state behavior crosses independently mounted React islands and is only fully observable in the rendered app, which no cheaper layer can prove. #5 is added as supplemental browser-level verification for the M3L4 exercise, not because it structurally requires E2E: its primary/cheapest protection remains the component/integration test already scoped for it, and this E2E test does not replace that layer. #1/#2/#4 remain correctly served by their existing layers without E2E, and #6 remains parked under Phase 4 (CI gate wiring), not pulled into this addendum.

**Phase 5 completion (2026-09-05):** both #3 (`tests/e2e/seed.spec.ts`, commit `83b658e`) and #5 (`tests/e2e/card-state-persists-after-save.spec.ts`, commit `3c829f8`) are implemented and deliberate-break verified — each test was confirmed to fail when its protected behavior was temporarily broken (the cross-island `sceneforge:note-updated` reaction for #3; server-side notes persistence for #5), then reverted uncommitted. Commit `5e08d35` added the `aria-pressed` accessibility fix on the status pills that #5's test relies on. The full suite (`npm run test:e2e`, both specs together) passed twice consecutively.

**Status vocabulary** (fixed — parser literals): `not started` → `change opened` → `researched` → `planned` → `implementing` → `complete`.

**AI-native layer:** evaluated and deferred. The PRD's 70%-acceptance success criterion is explicitly measured via manual validation for MVP (no in-app analytics required). Classic contract tests (Phase 2) already cover the guardrail-level correctness ("no partial output"); an LLM-as-judge layer on card _usefulness_ would add signal beyond that, but conflicts with the interview's explicit budget priorities (Q5: not mock-only behavior, not without protecting a real user-facing risk) and the roadmap's `speed`/`time` framing. Not included as a phase; may become one after Phase 2 ships if manual review surfaces a recurring quality gap classic tests can't catch.

## 4. Stack

The classic test base for this project. Recommendations are grounded in
local manifests/configs plus the MCP/tools actually exposed in the current
session.

| Layer                    | Tool                                                                                                | Version                  | Notes                                                                                                                                                                                                                                                                                                                                                                                    |
| ------------------------ | --------------------------------------------------------------------------------------------------- | ------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| unit + integration       | Vitest                                                                                              | ^4.1.10                  | Configured (`vitest.config.ts`); 3 existing test files, all in `src/lib/forge-scene/`                                                                                                                                                                                                                                                                                                    |
| API/integration fixtures | none yet — see Phase 1                                                                              | —                        | Two-user route tests hit a real local Supabase instance (per this repo's existing manual-testing convention: `supabase db reset`), not a mocked network edge                                                                                                                                                                                                                             |
| component testing        | none yet — see Phase 2/3                                                                            | —                        | No React Testing Library or equivalent installed; needed for stale-badge (#3) and state-reconciliation (#5) tests                                                                                                                                                                                                                                                                        |
| e2e                      | Playwright                                                                                          | (version TBD at install) | Introduced for Phase 5 (M3L4 addendum). #3 is the risk that genuinely requires it (cross-island state only observable in the rendered app); #5 gets supplemental browser-level verification on top of its existing component/integration coverage, not in place of it. Risks #1/#2/#4/#6 remain deliberately e2e-free per the cost×signal principle in §1 — see Phase 5 rationale in §3. |
| accessibility            | baseline via ESLint jsx-a11y (already wired in CI via `npm run lint`); no dedicated a11y test layer | —                        | Deferred for this MVP/risk rollout — not among the top-6 risks from PRD/interview/hot-spots; distinct from the §7 visual/snapshot-test exclusion (Q5), which is about styling, not accessibility                                                                                                                                                                                         |
| (optional) AI-native     | deferred — see §3 "AI-native layer" note                                                            | n/a                      | checked: 2026-09-03                                                                                                                                                                                                                                                                                                                                                                      |

**Stack grounding tools (current session):**

- Docs: none available (no Context7/framework-docs MCP); checked: 2026-09-03
- Search: generic WebSearch only, no specialized search MCP; checked: 2026-09-03
- Runtime/browser: none available; checked: 2026-09-03
- Provider/platform: none available (no GitHub/Cloudflare/Supabase MCP; `gh` CLI exists as a shell tool, not an MCP); checked: 2026-09-03

## 5. Quality Gates

The full set of gates that must pass before a change reaches production.
"Required for §3 Phase <N>" means the gate is enforced once that rollout
phase lands; before that, the gate is `planned`.

| Gate                      | Where                        | Required?                                                                                                                                                 | Catches                                                                                                              |
| ------------------------- | ---------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------- |
| lint                      | local + CI                   | required (already wired)                                                                                                                                  | syntactic drift, incl. jsx-a11y rule violations                                                                      |
| typecheck (`astro check`) | local only                   | not required by this rollout — pre-existing CI gap, outside Phases 1–4's scope                                                                            | type drift, currently only caught locally                                                                            |
| unit + integration        | local only today             | required after §3 Phase 4                                                                                                                                 | logic regressions (suite exists but is not yet CI-blocking)                                                          |
| e2e on critical flows     | local (Playwright)           | required after §3 Phase 5 (M3L4 addendum) — scoped to risk #3 (justified) and risk #5 (supplemental, does not replace its component/integration coverage) | cross-island UI state-sync failures (#3), and supplementally, round-trip state mismatches after Save/Regenerate (#5) |
| post-edit hook            | —                            | not planned this rollout                                                                                                                                  | out of scope (Lesson 3)                                                                                              |
| pre-prod smoke            | manual, between merge + prod | recommended, not required                                                                                                                                 | environment-specific failures (mock-only production per `deploy-plan.md`)                                            |

## 6. Cookbook Patterns

How to add new tests in this project. Each sub-section is filled in once
the relevant rollout phase ships; before that, the sub-section reads
"TBD — see §3 Phase <N>."

### 6.1 Adding an integration test for an API route (ownership)

Tests hit a running local dev server + local Supabase over real HTTP — they
do not import route handlers directly (`astro:env/server` isn't resolvable
under plain Vitest).

- **Preconditions**: `supabase start`, then `npm run dev`. If the route
  under test can call Anthropic (currently only `forge.ts`), force the
  mock path instead of a real, billed API call: create a local
  `.env.test` file (gitignored via the repo's existing `.env.*` rule,
  same as `.env` itself — never committed) containing one line,
  `ANTHROPIC_API_KEY=`, then start the server with
  `npm run dev -- --mode test` instead of a plain `npm run dev`. Vite's
  mode-specific env loading (`.env.<mode>` overrides `.env` for matching
  keys, confirmed via `loadEnv()` in `node_modules/vite/dist/node/chunks/config.js`)
  resolves the key to an empty string this way regardless of shell —
  verified end-to-end on this repo in both PowerShell and Git Bash. Do
  **not** use a shell-level override (`VAR=`/`$env:VAR=""`) instead: it
  is not portable — PowerShell and cmd.exe treat assigning an empty
  string as deleting the variable, so a child process sees it as absent
  rather than empty, and Astro then silently falls back to `.env`'s real
  key (confirmed by reproducing this exact failure during Phase 1 of
  this rollout phase's own implementation). Never edit `.env` itself.
  After any dev-server restart, confirm via `netstat`/
  `curl http://localhost:4321` that exactly one process is listening on
  the expected port — Astro silently auto-increments the port if a stale
  process is still bound, which can leave a new, correctly-configured
  server unreachable while an old, wrongly-configured one keeps answering.
- **Fixture**: `src/lib/test-support/auth-fixture.ts` — `createTestUser(label)`
  signs up + signs in a uniquely-emailed user against the running dev
  server and returns `{ email, cookie }`; `apiFetch(cookie, path, init)`
  wraps `fetch()` against the dev server, attaching the cookie (or none,
  for an unauthenticated-request case) and leaving redirects unfollowed.
  `apiFetch` also sets an `Origin` header matching the dev server's own
  origin on every request — Astro's built-in CSRF `Origin` check
  (`security.checkOrigin`, on by default) otherwise 403s any POST/PATCH
  that arrives without one, which a plain Node `fetch()` never sends.
- **Naming/location**: one spec file per route, colocated with the route
  file (`<route>.test.ts` next to `<route>.ts` — matches
  `readiness.test.ts`/`staleness.test.ts`'s existing convention).
- **Reference test**: `src/pages/api/scenes/[id]/note.test.ts` — the
  simplest of the 5 Phase 1 specs (one PATCH route, JSON body, no
  cross-route setup dependency). Copy its shape: an unauthenticated case
  asserting the route's actual guard response (401 JSON or a redirect —
  check the route's source, don't assume), a cross-user case asserting
  404 with no leaked data (skip this case only if the route has no
  existing-resource ownership dimension, like `projects/create.ts`), and
  a same-owner positive control.
- **Run**: `npm run test` (all specs) or `npm run test -- <route-name>`
  (one file) — both require the preconditions above already running.

### 6.2 Adding a unit/contract test (Forge Scene output contract)

- TBD — see §3 Phase 2.

### 6.3 Adding a component test (stale-badge / state reconciliation)

- TBD — see §3 Phase 2 (staleness) / Phase 3 (state reconciliation).

### 6.4 Adding an integration test for the readiness-gate route

- TBD — see §3 Phase 3.

### 6.5 Wiring a new gate into CI

- TBD — see §3 Phase 4.

### 6.6 Per-rollout-phase notes

(Filled in as each phase lands.)

## 7. What We Deliberately Don't Test

Exclusions agreed during the rollout (Phase 2 interview, Q5). Future
contributors should respect these unless the underlying assumption changes.

- **Visual styling and snapshot tests** — cosmetic, easily verified manually, high-churn/low-signal as automated assertions. Re-evaluate if the product adds a public-facing surface with real conversion stakes. (Source: interview Q5.)
- **Deployment/Wrangler configuration** — one manual smoke test after deploy is sufficient at solo/manual deploy cadence. Re-evaluate if deploy frequency increases beyond that. (Source: interview Q5.)
- **Exhaustive coverage of the mock Forge Scene generator's output variety** — it's a fixture, not product logic; Phase 2's contract test covers the no-partial-output guarantee once, using either the mock or real path. Re-evaluate if the mock generator gains conditional logic beyond a fixed fixture. (Source: interview Q5.)

## 8. Freshness Ledger

- Strategy (§1–§5) last reviewed: 2026-09-03
- Stack versions last verified: 2026-09-03
- AI-native tool references last verified: 2026-09-03
- Phase 5 (M3L4 E2E addendum) added: 2026-09-05 — #3 is the justified E2E case (cross-island rendered-only state); #5 is supplemental browser-level verification alongside its existing component/integration coverage, not a replacement.

Refresh (`/10x-test-plan --refresh`) when:

- a new top-3 risk surfaces from the roadmap or archive,
- a recommended tool's `checked:` date is older than three months,
- the project's tech stack changes (new framework, new test runner),
- §7 negative-space no longer matches what the team believes.
