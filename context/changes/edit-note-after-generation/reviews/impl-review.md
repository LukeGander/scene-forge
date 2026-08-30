<!-- IMPL-REVIEW-REPORT -->
# Implementation Review: Edit Scene Note After Generation Implementation Plan

- **Plan**: context/changes/edit-note-after-generation/plan.md
- **Scope**: Phase 1 of 2, Phase 2 of 2 (full plan)
- **Date**: 2026-08-30
- **Verdict**: APPROVED
- **Findings**: 0 critical, 1 warning, 5 observations

## Verdicts

| Dimension | Verdict |
|-----------|---------|
| Plan Adherence | PASS |
| Scope Discipline | PASS |
| Safety & Quality | WARNING |
| Architecture | PASS |
| Pattern Consistency | PASS |
| Success Criteria | PASS |

## Findings

### F1 — Cross-island stale event carries no sceneId, so it can't distinguish which card changed

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Safety & Quality
- **Location**: src/components/scenes/NoteEditor.tsx:43, src/components/scenes/ForgeSceneButton.tsx:47
- **Detail**: `NoteEditor` dispatches `window.dispatchEvent(new CustomEvent("sceneforge:note-updated"))` with no `detail` payload; `ForgeSceneButton`'s listener flips `isStale: true` unconditionally whenever the event fires. Safe today because `scenes/[id].astro` mounts exactly one of each island per page, but if a future page ever renders multiple scene cards (e.g. a project-level list), any single note save would mark every card on the page stale, not just its own.
- **Fix**: Add `{ detail: { sceneId } }` to the dispatch and have the listener check `event.detail?.sceneId === sceneId` before flipping `isStale`.
- **Decision**: FIXED — added `{ detail: { sceneId } }` to the dispatch in `NoteEditor.tsx` and a matching `sceneId` filter in `ForgeSceneButton.tsx`'s listener; also fixed the resulting lint findings (unnecessary optional chain, missing `sceneId` hook dependency). Verified: `npm run astro check` (0 errors), `npm run test` (20/20), targeted eslint clean.

### F2 — A card already set "Ready" isn't retroactively flagged when the note changes afterward

- **Severity**: ◻️ OBSERVATION
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Safety & Quality
- **Location**: src/pages/api/scenes/[id]/card.ts:97-127
- **Detail**: Staleness is derived (not stored) by design — the plan's Key Decision explicitly chose this over a stored flag. That means the block only fires on the *next* attempt to set `status: "ready"`; a card that was already `"ready"` before the note changed keeps that DB value untouched. Only this page's client-side `isCardStale` recomputation surfaces the discrepancy. Any future feature reading `scene_cards.status` directly (a dashboard, an export, S-02's browsing list) must independently re-run `isCardStale` rather than trusting the stored status — otherwise it will report a scene as "Ready" when it's actually stale.
- **Fix**: No code change needed now (matches FR-021's literal scope — mark stale + block future Ready-sets, not retroactively invalidate). Recommend capturing this as a `lessons.md` entry so S-02 (or any future status-reading feature) doesn't rediscover it as a bug.
- **Decision**: ACCEPTED-AS-RULE: "Staleness is derived, not stored — don't trust scene_cards.status alone" (added to context/foundation/lessons.md). No code fix applicable — the finding's own recommendation was documentation-only, not a code change.

### F3 — note.ts combines the ownership check and the update into one round trip, unlike card.ts/forge.ts

- **Severity**: ◻️ OBSERVATION
- **Dimension**: Pattern Consistency
- **Location**: src/pages/api/scenes/[id]/note.ts:50-56
- **Detail**: `card.ts` and `forge.ts` both do a `select()`-based ownership/existence check first, then a separate `update()`/`upsert()`. `note.ts` instead does `update().eq(id).eq(user_id).select().single()` in one query. Behaviorally correct (arguably more efficient — one round trip instead of two), just a divergent shape worth being aware of if this becomes the pattern other routes copy.
- **Fix**: None required.
- **Decision**: SKIPPED

### F4 — Scene note is persisted untrimmed despite trim-based validation

- **Severity**: ◻️ OBSERVATION
- **Dimension**: Safety & Quality
- **Location**: src/pages/api/scenes/[id]/note.ts:52
- **Detail**: `isNoteUpdateBody` validates `note.trim().length > 0`, but the raw (untrimmed) `body.note` is what gets saved — a note of `"   text   "` passes validation with its padding intact. Matches `NewSceneForm.tsx`'s existing untrimmed-save behavior, so not a regression introduced by this feature.
- **Fix**: None required.
- **Decision**: SKIPPED

### F5 — No max-length cap on note or card text fields

- **Severity**: ◻️ OBSERVATION
- **Dimension**: Safety & Quality
- **Location**: src/pages/api/scenes/[id]/note.ts, src/components/scenes/NoteEditor.tsx
- **Detail**: Pre-existing gap (also true of `card.ts`'s `notes`/`designRisks`), not introduced by this feature. Worth flagging because this is now a hot path for a user to paste arbitrarily large text, which also feeds a subsequent LLM call via Forge Scene.
- **Fix**: None required now.
- **Decision**: SKIPPED

### F6 — NoteEditor doesn't red-border the textarea on a validation error, unlike NewSceneForm

- **Severity**: ◻️ OBSERVATION
- **Dimension**: Pattern Consistency
- **Location**: src/components/scenes/NoteEditor.tsx
- **Detail**: `NewSceneForm.tsx` red-borders its textarea and shows an inline field-level error on validation failure; `NoteEditor.tsx` only shows the shared `ServerError` banner. Purely cosmetic.
- **Fix**: None required.
- **Decision**: SKIPPED
