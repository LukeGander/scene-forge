# Forge Scene: First Scene Card Implementation Plan

## Overview

Build the first end-to-end "Forge Scene" loop (roadmap `S-01`): a creator creates a minimal game project, adds a scene note, runs Forge Scene, and sees a structured scene card generated either by Anthropic Claude or, when no API key is configured, a deterministic mock — so production never requires a paid key.

## Current State Analysis

The codebase has auth (email+password via Supabase, `src/pages/api/auth/{signin,signup,signout}.ts`) and a placeholder `dashboard.astro`, but nothing else this feature needs exists yet:

- No database schema at all — `supabase/migrations/` doesn't exist. No `projects`, `scenes`, or `scene_cards` tables.
- No LLM dependency anywhere in `package.json` — no `@anthropic-ai/sdk`, no adapter code.
- No test runner configured — no `vitest`/`jest`, no test script, CI (`.github/workflows/ci.yml`) only runs `lint` + `build`.
- No JSON API convention yet — every existing API route (`src/pages/api/auth/*.ts`) reads `formData()` and responds via `context.redirect(...)`, never JSON.
- Character management (FR-009/010, roadmap `S-04`) does not exist, so the scene card's character field will always resolve to "none / not applicable" for this slice.

## Desired End State

A signed-in creator can: click "New Project" from the dashboard, submit a minimal project (title, premise, tone), add a scene note, click "Forge Scene," see continuous progress feedback, and get back a scene card with every required field populated or explicitly marked "not enough context" — never a partial card — at Draft status. This works with zero configuration (mock path) and upgrades transparently to real Claude output once `ANTHROPIC_API_KEY` is set.

Verify by: running the manual test steps in each phase below, and by `npm run test && npm run lint && npx astro check && npm run build` all passing.

### Key Discoveries:

- Existing convention for API routes: `POST: APIRoute` handlers under `src/pages/api/<domain>/`, form-data in, `context.redirect(...)` out, config-missing guarded by checking whether the Supabase client factory returned `null` (`src/pages/api/auth/signin.ts:9-16`, `src/lib/supabase.ts:5-8`).
- Env/secrets flow through Astro's typed `env.schema` in `astro.config.mjs` + `astro:env/server` imports (`src/lib/supabase.ts:1,3`), not `Astro.locals.runtime.env`. A new `ANTHROPIC_API_KEY` follows this same pattern.
- The "is this configured?" pattern already exists for Supabase (`src/lib/config-status.ts:11-19`, `Boolean(SUPABASE_URL && SUPABASE_KEY)`) — the mock-trigger decision below reuses this exact shape for the Anthropic key.
- `deploy-plan.md` records a hard constraint: `ANTHROPIC_API_KEY` must not be provisioned in production until Forge Scene ships with a working no-key/mock path — this plan's mock adapter is what discharges that constraint.
- shadcn "new-york" primitives live under `src/components/ui/` (only `button.tsx` exists so far); new form components should follow the existing React-island pattern seen in `src/components/auth/SignUpForm.tsx` (client-side validation, `FormField`/`SubmitButton`/`ServerError` sub-components).

## What We're NOT Doing

- Character management (FR-009/010) — that's roadmap `S-04`. The card's characters field will show "none / not applicable" until then.
- Scene status changes, the Ready-gate rule, or design-risk acknowledgment (FR-018–020, FR-022) — that's `S-03`. `scene_cards.design_risks` is stored as a plain string array in this slice; the acknowledge/clear mechanism FR-022 needs is `S-03`'s to add via its own migration.
- Project/scene browsing or listing beyond the single happy path this slice needs (FR-005/006/013) — that's `S-02`.
- Editing a scene note after generation or stale-card marking (FR-021) — that's `S-05`.
- Wiring the new test suite into CI — PRD's testing strategy is manual-first for MVP; CI gating is a reasonable fast-follow once there's more than one test file.
- Provisioning a real `ANTHROPIC_API_KEY` in production — stays mock-only in production per `deploy-plan.md` until a paid-key decision is made by the project owner.

## Implementation Approach

Three phases in dependency order: (1) data model + LLM adapter with no UI, fully unit-testable in isolation; (2) the project/scene creation flow, reusing the existing form-POST+redirect convention exactly; (3) the Forge Scene generation call and card display, which is the one place this plan introduces a new JSON-fetch API convention — justified because FR-017's continuous-progress-feedback requirement can't be met by a full-page redirect.

## Critical Implementation Details

- **Data consistency for RLS**: `user_id` is denormalized directly onto `scenes` and `scene_cards` (not derived via a join through `projects`) so each table's RLS policy is a single-column check (`user_id = auth.uid()`) instead of a multi-hop `EXISTS` join. Every insert into `scenes`/`scene_cards` must copy `user_id` from the authenticated session at write time — never derive it from the parent row — or the isolation guardrail silently breaks even with RLS enabled.
- **Structured output from the LLM**: the Anthropic adapter must use forced tool-use (a single tool shaped like `SceneCardFields`, `tool_choice` forced to it) rather than parsing a free-text completion. This is what makes the "never a partial or malformed card" guardrail actually hold against a real model's naturally unstructured default output.

## Phase 1: Data Model & LLM Adapter Foundation

### Overview

Stand up the schema, RLS policies, and the LLM adapter (mock + real Anthropic path) with unit tests. No UI in this phase.

### Changes Required:

#### 1. Database schema & RLS

**File**: `supabase/migrations/20260802120000_create_scene_forge_core.sql`

**Intent**: Create `projects`, `scenes`, and `scene_cards` with row-level security enforcing the PRD's data-isolation guardrail at the DB layer, in addition to application-level ownership checks in later phases.

**Contract**: Three tables, `user_id` denormalized on all three (see Critical Implementation Details), RLS enabled with a `user_id = auth.uid()` policy per table:

```sql
create table public.projects (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  premise text not null,
  tone text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.scenes (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  note text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.scene_cards (
  id uuid primary key default gen_random_uuid(),
  scene_id uuid not null unique references public.scenes(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  status text not null default 'draft' check (status in ('draft', 'needs_work', 'ready')),
  player_goal text not null,
  obstacle text not null,
  characters jsonb not null default '[]'::jsonb,
  interactive_element text not null,
  required_assets jsonb not null default '[]'::jsonb,
  design_risks jsonb not null default '[]'::jsonb,
  generation_source text not null check (generation_source in ('mock', 'anthropic')),
  generated_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.projects enable row level security;
alter table public.scenes enable row level security;
alter table public.scene_cards enable row level security;

create policy "projects_owner_all" on public.projects
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "scenes_owner_all" on public.scenes
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "scene_cards_owner_all" on public.scene_cards
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());
```

#### 2. Anthropic secret registration

**File**: `astro.config.mjs`

**Intent**: Register `ANTHROPIC_API_KEY` as an optional server secret so the adapter can read it via `astro:env/server`, matching the existing `SUPABASE_URL`/`SUPABASE_KEY` pattern exactly.

**Contract**: Add `ANTHROPIC_API_KEY: envField.string({ context: "server", access: "secret", optional: true })` to the `env.schema` block.

#### 3. Shared scene-card type contract

**File**: `src/lib/forge-scene/types.ts`

**Intent**: Define the single `SceneCardFields` shape consumed by the mock generator, the Anthropic generator, the forge API route, and the card display component — this is the cross-phase contract Phase 3's UI is built against.

**Contract**:

```typescript
export interface CharacterMention {
  name: string;
  function: string;
}

export interface SceneCardFields {
  playerGoal: string;
  obstacle: string;
  characters: CharacterMention[]; // empty = "none / not applicable" for this slice
  interactiveElement: string;
  requiredAssets: string[]; // empty renders as "not enough context"
  designRisks: string[]; // acknowledge/clear (FR-022) is out of scope — added by S-03
}

export interface ForgeSceneInput {
  projectTitle: string;
  projectPremise: string;
  projectTone: string;
  sceneTitle: string;
  sceneNote: string;
}
```

#### 4. Mock generator

**File**: `src/lib/forge-scene/mock.ts`

**Intent**: Deterministic, dependency-free scene card generator used whenever no Anthropic key is configured — the guarantee that production never requires a paid key.

**Contract**: `generateMockSceneCard(input: ForgeSceneInput): SceneCardFields` — pure function, no network I/O. Derives `playerGoal`/`obstacle` from the first two sentences of `sceneNote` when present, falls back to `"not enough context"` for any field it can't confidently derive (`interactiveElement`, `requiredAssets`, `designRisks` are always the "not enough context"/empty case for this deterministic path); `characters` is always `[]` since character entities don't exist yet.

#### 5. Anthropic generator

**File**: `src/lib/forge-scene/anthropic.ts`

**Intent**: Real Claude-backed generator producing schema-valid output via forced tool-use (see Critical Implementation Details).

**Contract**: `generateSceneCardWithAnthropic(input: ForgeSceneInput, apiKey: string): Promise<SceneCardFields>` using `@anthropic-ai/sdk`; throws a typed error on any API failure so the caller can fail fast (Phase 3's error handling). The prompt (system or user message) must explicitly instruct the model to evaluate the note against the required scene anatomy from FR-016 — player goal, obstacle, character presence/function if applicable, interactive element or puzzle, required assets, design risks — and to use the literal "not enough context" convention for any field the note doesn't support, rather than guessing or omitting it. This is the plan's highest product risk (per the roadmap); exact prompt wording is left to the implementer, but covering this instruction is not optional.

#### 6. Adapter entry point

**File**: `src/lib/forge-scene/adapter.ts`

**Intent**: The single function the forge API route calls; selects mock vs. Anthropic based on whether `ANTHROPIC_API_KEY` is set, mirroring `config-status.ts`'s existing presence-check pattern.

**Contract**: `generateSceneCard(input: ForgeSceneInput): Promise<{ card: SceneCardFields; source: "mock" | "anthropic" }>`. Logs (via `console.log`/`console.error`, per the chosen lightweight-observability approach) which branch was taken, and the outcome (success/failure+reason).

#### 7. Adapter unit tests

**File**: `src/lib/forge-scene/adapter.test.ts`

**Intent**: Cover the decision this phase is riskiest on — the mock generator's determinism, and the adapter's mock/real branch selection and error propagation — per the chosen "unit-test the adapter, manual-test the UI" testing scope.

**Contract**: Vitest suite; no network calls (Anthropic path tested via a mocked SDK client).

#### 8. Test runner setup

**File**: `package.json`, `vitest.config.ts` (new)

**Intent**: Add this project's first test runner.

**Contract**: `vitest` devDependency; `"test": "vitest run"` script. `vitest.config.ts` must resolve the `@/*` alias used by adapter imports — either via the `vite-tsconfig-paths` plugin or an explicit `resolve.alias: { "@": "./src" }` entry — since Vitest does not read `tsconfig.json` paths automatically.

### Success Criteria:

#### Automated Verification:

- Migration applies cleanly against local Supabase: `supabase db reset`
- Adapter unit tests pass: `npm run test`
- Linting passes: `npm run lint`
- Type/content checking passes: `npx astro check`
- Build succeeds: `npm run build`

#### Manual Verification:

- Supabase Studio (local) shows RLS enabled with the owner policy present on all three new tables
- With `ANTHROPIC_API_KEY` unset locally, manually invoking `generateSceneCard()` (e.g. via a scratch script or the test suite) resolves to the mock path

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before proceeding to the next phase.

---

## Phase 2: Project & Scene Creation Flow

### Overview

Give the creator a way to create a minimal project and add a scene note, reusing the existing form-POST+redirect convention exactly.

### Changes Required:

#### 1. New project form

**File**: `src/pages/projects/new.astro`, `src/components/projects/NewProjectForm.tsx`

**Intent**: Entry point for creating a minimal project — required fields only (title, premise, tone), per the scoped-down decision to defer FR-004's optional fields.

**Contract**: Astro page renders the React island (`client:load`), following the `SignUpForm.tsx` pattern for client-side validation and submission; posts to `/api/projects/create`.

#### 2. Project creation API route

**File**: `src/pages/api/projects/create.ts`

**Intent**: Authenticated handler that inserts a project scoped to the signed-in user, then hands off directly to scene-note creation.

**Contract**: Reads `context.locals.user` and `formData()`; inserts via `createClient()`; redirects to `/projects/{id}/scenes/new` on success, back to the form with an `?error=` param on failure (matches `signin.ts`'s redirect-with-error convention). Replicates the existing `if (!supabase)` config-missing guard from `signin.ts`/`signup.ts` before touching the DB; relies on the extended `PROTECTED_ROUTES` (item 7 below) for the unauthenticated case, so `context.locals.user` is guaranteed non-null here.

#### 3. New scene note form

**File**: `src/pages/projects/[projectId]/scenes/new.astro`, `src/components/scenes/NewSceneForm.tsx`

**Intent**: Form to add a scene note (title + freeform text, FR-012) to an existing project.

**Contract**: Posts to `/api/scenes/create` with `projectId` as a hidden field.

#### 4. Scene creation API route

**File**: `src/pages/api/scenes/create.ts`

**Intent**: Authenticated handler that inserts a scene row, denormalizing `user_id` from the parent project's owner (Critical Implementation Detail).

**Contract**: Verifies the referenced project belongs to `context.locals.user` before inserting (defense-in-depth alongside RLS); redirects to `/scenes/{id}`. Same `if (!supabase)` config-missing guard as item 2.

#### 5. Scene detail page shell

**File**: `src/pages/scenes/[id].astro`

**Intent**: Displays the scene note; provides the page Phase 3 wires the Forge Scene UI into.

**Contract**: Fetches the scene scoped to `context.locals.user`; redirects/404s if not found or not owned.

#### 6. Dashboard entry point

**File**: `src/pages/dashboard.astro`

**Intent**: Give the creator a way into the flow.

**Contract**: Add a "New Project" link to `/projects/new`.

#### 7. Extend route protection

**File**: `src/middleware.ts`

**Intent**: The codebase's only auth-enforcement mechanism is the `PROTECTED_ROUTES` prefix list — without extending it, every page and API route this phase (and Phase 3) adds would be reachable by an unauthenticated visitor, missing the PRD's Access Control requirement that a gated route redirects an unauthenticated user to sign-in.

**Contract**: Extend `PROTECTED_ROUTES` (`src/middleware.ts:4`) to include `/projects`, `/scenes`, `/api/projects`, `/api/scenes` — the existing `startsWith` prefix check already covers nested/dynamic segments under these, so no other middleware logic changes.

### Success Criteria:

#### Automated Verification:

- Linting passes: `npm run lint`
- Type/content checking passes: `npx astro check`
- Build succeeds: `npm run build`

#### Manual Verification:

- Signed-in creator clicks "New Project" from the dashboard, submits valid data, lands on the new-scene-note form
- Submitting a scene note lands on the scene detail page showing the note
- Directly navigating to another user's project or scene id redirects/404s rather than exposing data
- Signing out, then directly navigating to `/projects/new`, `/scenes/{id}`, or POSTing to `/api/projects/create` redirects to sign-in rather than executing

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before proceeding to the next phase.

---

## Phase 3: Forge Scene Generation & Card Display

### Overview

Wire the adapter into a JSON generation endpoint and a React island that shows continuous progress feedback and the resulting card.

### Changes Required:

#### 1. Forge generation API route

**File**: `src/pages/api/scenes/[id]/forge.ts`

**Intent**: JSON endpoint the React island calls to trigger generation; loads scene + project context, calls `generateSceneCard()`, upserts the result into `scene_cards`.

**Contract**: `POST` with no body needed (id from route param); response `{ card: SceneCardFields, source: "mock" | "anthropic" }` on 200, `{ error: string }` on failure. The scene note itself is never touched by this handler on any outcome, satisfying the "note is never lost" guardrail. Covered by the `/api/scenes` prefix added to `PROTECTED_ROUTES` in Phase 2; also verifies the scene belongs to `context.locals.user` before generating (defense-in-depth alongside RLS).

#### 2. Forge Scene button + loading state

**File**: `src/components/scenes/ForgeSceneButton.tsx`

**Intent**: React island holding the loading state; shows the spinner+elapsed-counter loading UI for the duration of the fetch, then renders the card or a fail-fast error with a manual "Try again" action (no automatic retry, per the chosen failure-handling approach).

**Contract**: Local state machine `idle | loading | success | error`.

#### 3. Scene card display

**File**: `src/components/scenes/SceneCard.tsx`

**Intent**: Presentational display of every `SceneCardFields` field, rendering empty/"not enough context" values distinctly from populated ones, plus the Draft status badge.

**Contract**: Props typed by `SceneCardFields` (Phase 1).

#### 4. Wire into scene detail page

**File**: `src/pages/scenes/[id].astro`

**Intent**: Show `ForgeSceneButton` when no card exists yet; show `SceneCard` (with a "Regenerate" affordance reusing the same button/endpoint) once one does.

**Contract**: Passes the scene id as a prop to the React island.

### Success Criteria:

#### Automated Verification:

- Adapter unit tests still pass: `npm run test`
- Linting passes: `npm run lint`
- Type/content checking passes: `npx astro check`
- Build succeeds: `npm run build`

#### Manual Verification:

- With no `ANTHROPIC_API_KEY` set, running Forge Scene produces a mock card with every required field visible (populated or "not enough context"), at Draft status
- With `ANTHROPIC_API_KEY` set locally, running Forge Scene produces a real Claude-generated card with every required field populated or explicitly marked "not enough context"
- The spinner + elapsed-time counter is visible for the full duration of a real generation call
- Simulating a failure (e.g. temporarily invalid key) shows an error, preserves the scene note, and "Try again" successfully retries
- A second test account cannot see the first account's scene card via Supabase Studio or a direct URL guess

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful.

---

## Testing Strategy

### Unit Tests:

- Mock generator determinism (same input → same output shape, correct "not enough context" fallbacks)
- Adapter branch selection (key absent → mock, key present → Anthropic path invoked)
- Anthropic generator error handling (API failure surfaces as a typed error, not a partial card)

### Integration Tests:

- None automated in this cycle — covered by the manual end-to-end steps below, per the PRD's manual-first MVP testing strategy.

### Manual Testing Steps:

1. Sign in, create a project, add a scene note, run Forge Scene with no API key — verify the mock card and Draft status.
2. Set `ANTHROPIC_API_KEY` locally, re-run Forge Scene on a new scene — verify a real generated card with all required fields.
3. Temporarily break the key/network, run Forge Scene — verify the error is shown, the note is intact, and "Try again" recovers.
4. With a second test account, attempt to view the first account's scene/card via direct URL — verify it's blocked.

## Performance Considerations

Card generation is exempt from the 2-second NFR cap but must show continuous visible feedback (Phase 3's loading state satisfies this). Cloudflare Workers' CPU-time billing excludes I/O-wait time, so the LLM call itself is effectively free even on the free tier (per `infrastructure.md`) — no caching or special performance work needed for a single synchronous call.

## Migration Notes

This is the project's first-ever schema migration — there is no existing data to migrate or backfill.

## References

- Roadmap slice: `context/foundation/roadmap.md` (S-01)
- PRD: `context/foundation/prd.md` (US-01, FR-004, FR-012, FR-014, FR-016, FR-017)
- Deploy constraint: `context/deployment/deploy-plan.md` (Phase 7 — no `ANTHROPIC_API_KEY` until Forge Scene ships with a mock path)
- Form+redirect convention: `src/pages/api/auth/signin.ts:1-20`
- Supabase client factory pattern: `src/lib/supabase.ts:1-25`
- Config-presence check pattern: `src/lib/config-status.ts:11-19`

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles. See `references/progress-format.md`.

### Phase 1: Data Model & LLM Adapter Foundation

#### Automated

- [x] 1.1 Migration applies cleanly: `supabase db reset` — 30ccb54
- [x] 1.2 Adapter unit tests pass: `npm run test` — 30ccb54
- [x] 1.3 Linting passes: `npm run lint` — 30ccb54
- [x] 1.4 Type/content checking passes: `npx astro check` — 30ccb54
- [x] 1.5 Build succeeds: `npm run build` — 30ccb54

#### Manual

- [x] 1.6 Supabase Studio shows RLS enabled with owner policy on all three new tables — 30ccb54
- [x] 1.7 With `ANTHROPIC_API_KEY` unset, `generateSceneCard()` resolves to the mock path — 30ccb54

### Phase 2: Project & Scene Creation Flow

#### Automated

- [x] 2.1 Linting passes: `npm run lint`
- [x] 2.2 Type/content checking passes: `npx astro check`
- [x] 2.3 Build succeeds: `npm run build`

#### Manual

- [x] 2.4 Creator can create a project via the dashboard entry point and land on the new-scene-note form
- [x] 2.5 Creator can submit a scene note and land on the scene detail page showing it
- [x] 2.6 Direct navigation to another user's project/scene id redirects/404s
- [x] 2.7 Signed-out access to the new pages/API routes redirects to sign-in instead of executing

### Phase 3: Forge Scene Generation & Card Display

#### Automated

- [ ] 3.1 Adapter unit tests still pass: `npm run test`
- [ ] 3.2 Linting passes: `npm run lint`
- [ ] 3.3 Type/content checking passes: `npx astro check`
- [ ] 3.4 Build succeeds: `npm run build`

#### Manual

- [ ] 3.5 Mock-path card generation shows every required field (populated or "not enough context") at Draft status
- [ ] 3.6 Real Anthropic-path card generation shows every required field
- [ ] 3.7 Spinner + elapsed-time counter visible for the full duration of generation
- [ ] 3.8 Simulated failure shows an error, preserves the note, and "Try again" recovers
- [ ] 3.9 A second test account cannot see the first account's scene/card
