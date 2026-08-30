# Edit Scene Note After Generation — Plan Brief

> Full plan: `context/changes/edit-note-after-generation/plan.md`

## What & Why

Roadmap slice `S-05` (FR-021): let the creator edit a saved scene note before or after Forge Scene has run. If the note changes after a card already exists, the card is visibly marked stale and the creator is blocked from setting it "Ready" until they regenerate. Without this, correcting a note after a poor first generation currently forces a full scene delete/recreate.

## Starting Point

`scenes.note` is displayed as static, non-editable text on the scene detail page — no edit route exists for it at all. `enforce-scene-readiness` (S-03) just shipped the card status/notes/risk-acknowledgment editing surface but explicitly deferred stale-card marking to this change. No "stale" concept exists anywhere in the schema or code today.

## Desired End State

A creator can edit a scene's note at any time via an always-editable textarea with an explicit Save button. If a card already exists, saving the note immediately marks it stale in the UI (banner + disabled "Ready" pill, live — no page reload needed) and the same block is enforced server-side. Regenerating the card clears staleness.

## Key Decisions Made

| Decision | Choice | Why (1 sentence) | Source |
| --- | --- | --- | --- |
| Staleness detection | Derived comparison: `scenes.updated_at` vs `scene_cards.generated_at` | No new column, single source of truth, can't drift out of sync | Plan |
| Note-edit architecture | New sibling `NoteEditor` React island (not folded into `ForgeSceneButton`) | Keeps S-03's just-reviewed state machine untouched, lower regression risk | Plan |
| Note-edit UX | Always-editable textarea + explicit Save button | Matches the app's only established editing convention (no autosave anywhere) | Plan |
| Ready-gate while stale | Block reaching "Ready" while stale, enforced client + server | Closes the loophole of setting Ready on a card that no longer matches its note | Plan |
| Note validation | Require non-empty note | Consistent with the note's required-field status everywhere else (creation, schema) | Plan |
| Staleness rule shape | Shared pure `isCardStale()` function, unit-tested | Mirrors the `isReadyEligible()` convention from S-03 for the highest-value logic | Plan |
| Cross-island live sync | `NoteEditor` fires a `window` `CustomEvent`; `ForgeSceneButton` listens and flips a boolean | Avoids lifting timestamps between two independent React islands; a save always postdates the loaded `generated_at`, so no timestamp math is needed at the event | Plan |

## Scope

**In scope:** editing `scenes.note` (non-empty validation), stale detection and display, blocking "Ready" while stale (client + server), live cross-island sync on save, unit tests for the staleness rule.

**Out of scope:** editing the scene title, any new DB migration, locking the status/creator-notes/risk-acknowledgment controls while stale (only "Ready" is blocked), scene-list/browsing (S-02), characters (S-04), autosave/draft-recovery, CI test wiring, production Anthropic key provisioning.

## Architecture / Approach

Two phases: (1) make the note editable in isolation — new `PATCH /api/scenes/[id]/note.ts` route + new `NoteEditor.tsx` component replacing the static note paragraph; (2) layer in the shared `isCardStale()` pure function, wire it into the `.astro` page's initial render and `card.ts`'s server-side Ready check, and add the client-side banner/disabled-pill plus the `CustomEvent`-based live sync between the two sibling islands.

## Phases at a Glance

| Phase | What it delivers | Key risk |
| --- | --- | --- |
| 1. Edit the Scene Note | New PATCH route + `NoteEditor` component, wired into the scene page | Low — follows `card.ts`'s established route conventions closely |
| 2. Stale Detection, Ready-Gate Enforcement, and Live Sync | `isCardStale()` + tests, server enforcement, banner, live cross-island event sync | Cross-island state sync is the one genuinely new pattern in this codebase — mitigated by keeping the event payload-free (a save always postdates the loaded generation timestamp) |

**Prerequisites:** `first-forged-scene-card` (S-01) and `enforce-scene-readiness` (S-03) shipped — both done.
**Estimated effort:** ~1-2 sessions across 2 phases — narrower in scope than S-01/S-03, no new migration.

## Open Risks & Assumptions

- The live cross-island sync assumes a note save always happens after the currently-loaded card's `generated_at` within the same page session — true by construction (the card must already be loaded to be viewed), but if this assumption is ever violated (e.g. multi-tab editing) the initial-render server-side check is still the source of truth on next load.
- No new migration means staleness is entirely computed, not queryable in bulk — acceptable now since no scene-list view (S-02) exists yet to need "show me all stale scenes."

## Success Criteria (Summary)

- A creator can fix a scene note after a poor first generation without deleting/recreating the scene.
- A card that no longer matches its note is unmistakably marked stale and can't be pushed to "Ready" until regenerated, both in the UI and via direct API calls.
