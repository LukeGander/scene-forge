---
project: "Point&Click Scene Forge"
version: 1
status: draft
created: 2026-06-07
context_type: greenfield
product_type: web-app
target_scale:
  users: small
  qps: low
  data_volume: small
timeline_budget:
  mvp_weeks: 4
  hard_deadline: "2026-07-05"
  after_hours_only: true
---

## Vision & Problem Statement

Solo point-and-click game creators work from scattered notes — ideas for scenes, puzzles, NPCs, dialogs, and interactive objects spread across whatever tool they happen to use. When it's time to evaluate whether a scene is ready for production, there's no structured signal: the creator has to mentally reconstruct the full scene from fragmented notes and judge completeness without a checklist.

A point-and-click scene is not just content — it is a structured design problem with a specific required anatomy (player goal, obstacle, character presence and function, interactive element or puzzle, required assets, and no critical logic gaps). Generic tools like Notion or spreadsheets cannot evaluate completeness against that structure. A purpose-built tool that knows the anatomy can — and can flag what's missing before production starts. The gap is not a lack of notes; it is that existing tools do not know what a scene needs to be production-ready.

## User & Persona

**Primary persona:** A solo indie or hobbyist game developer making a point-and-click adventure game as a side project or indie release. Works alone — no team handoff, no collaboration in scope for MVP. Likely uses one or more generic tools (Notion, Google Docs, plain text files) to capture scene ideas today.

## Success Criteria

### Primary
- At least 70% of generated scene cards are accepted by the creator as a useful base for further editing, without requiring a complete rewrite from scratch. *(For MVP: measured through manual validation and testing — no in-app analytics or telemetry required.)*
- The creator can transform a loose scene note into a structured scene card in less than 5 minutes (assuming the project is already set up).
- The generated scene card always contains all key elements required to evaluate scene readiness: player goal, obstacle, characters present in the scene and their function (if characters are defined; otherwise this field is marked "none / not applicable"), interactive element or puzzle, required assets, and design risks or missing elements.

### Secondary
- The creator can manage multiple scenes across a project without friction — adding, viewing, and comparing scene statuses feels natural.

### Guardrails
- Data isolation: a user's projects and scenes are never accessible to another user.
- The generated scene card must always contain all required fields — no partial outputs with missing sections.
- Status "Ready" can only be set when the business rule is satisfied: player goal + obstacle + at least one interaction/puzzle element + required assets + no unresolved design risks; if characters are present in the scene, their defined function in the scene is additionally required.
- Visible progress feedback when Forge Scene runs; generation failures and timeouts handled gracefully — the scene note is never lost.

## User Stories

### US-01: Creator transforms a scene note into a structured scene card

- **Given** a logged-in creator who has created a game project and added at least one scene note (characters optional)
- **When** they run Forge Scene on the scene note
- **Then** a structured scene card is generated with all required fields: player goal, obstacle, characters in scene (if any), character function (if characters are present), interactive element or puzzle, required assets, and design risks or missing elements — and the scene is assigned Draft status by default

#### Acceptance Criteria
- The card contains all required fields (or marks a field as "not enough context" if the note didn't provide it — never silently omits a field)
- Visible progress feedback is shown during generation
- If Forge Scene fails to generate a card, the scene note is preserved and an error is shown — the user never loses their note
- Default status after generation is always Draft, never Ready or Needs Work

## Functional Requirements

### Authentication
- FR-001: Creator can register with email and password. Priority: must-have
  > Socratic: No counter-argument; registration is required for data isolation.
- FR-002: Creator can sign in with email and password. Priority: must-have
  > Socratic: No counter-argument; stands as written.
- FR-003: Creator can sign out. Priority: must-have
  > Socratic: No counter-argument; both sign-in and sign-out are required for a functional auth flow.

### Project management
- FR-004: Creator can create a game project with required fields: title, short premise, tone; optional fields: genre, dialog style, production constraints. No "main character" field — the protagonist is added as a character via FR-009. Priority: must-have
  > Socratic: Counter-argument considered: "7 fields at creation is a heavyweight form; 'main character' duplicates the character entity." Resolution: required fields reduced to 3 (title, premise, tone); genre/dialog style/production constraints made optional; 'main character' removed — protagonist is added via character management.
- FR-005: Creator can view a list of their own projects. Priority: must-have
  > Socratic: No counter-argument; a project list is the natural home screen. Stands as written.
- FR-006: Creator can view a project and browse its scenes. Priority: must-have
  > Socratic: No counter-argument; stands as written.
- FR-007: Creator can edit a project's context. Priority: nice-to-have
  > Socratic: No counter-argument; already appropriately scoped as nice-to-have. Stands as written.
- FR-008: Creator can delete a project. Priority: nice-to-have
  > Socratic: No counter-argument; already appropriately scoped as nice-to-have. Stands as written.

### Character management
- FR-009: Creator can add a character to a project (name, role, description, manner of speech). Priority: must-have
  > Socratic: No counter-argument; character context is a core differentiator for scene card quality, even if characters are optional at runtime. Stands as written.
- FR-010: Creator can view and edit a character. Priority: must-have
  > Socratic: No counter-argument; editing is required to correct mistakes. Stands as written.
- FR-011: Creator can delete a character. Priority: nice-to-have
  > Socratic: No counter-argument; already appropriately scoped as nice-to-have. Stands as written.

### Scene management
- FR-012: Creator can add a scene note to a project (title + freeform text). Priority: must-have
  > Socratic: No counter-argument; the scene note is the core input artifact. Stands as written.
- FR-013: Creator can view a list of scenes in a project with their current status. Priority: must-have
  > Socratic: No counter-argument; the scene list with status is the core production-readiness dashboard. Stands as written.
- FR-014: Creator can view a scene note and its generated card. Priority: must-have
  > Socratic: No counter-argument; viewing both together is essential for evaluating card quality. Stands as written. (Note: "side by side" is a layout detail — the FR requires both to be visible, layout left to implementation.)
- FR-015: Creator can delete a scene. Priority: nice-to-have
  > Socratic: No counter-argument; already appropriately scoped as nice-to-have. Stands as written.
- FR-021: Creator can edit the raw scene note after saving it, before running Forge Scene or before re-running it. If the note is edited after a scene card was already generated, the existing card is marked as stale and the creator is notified that the card was generated from an older version of the note. Priority: must-have
  > Socratic: Counter-argument considered: "editing the note after generation creates a note/card sync problem." Resolution: FR-021 updated to include a stale-card state — if the note changes after generation, the card is visibly marked as stale and the user is prompted to re-run Forge Scene.

### Forge Scene
- FR-016: Creator can run Forge Scene to generate a structured scene card from project context + optional characters + scene note. Priority: must-have
  > Socratic: No counter-argument; this is the core feature. Note: prompt engineering quality is load-bearing for the 70% acceptance rate success criterion — a product risk, not a scope argument.
- FR-017: Creator sees visible progress feedback while Forge Scene is running. Priority: must-have
  > Socratic: No counter-argument; generation can take several seconds; silent waiting is poor UX. Stands as written.

### Scene card
- FR-018: Creator can set a scene's status (Draft / Needs Work / Ready). Priority: must-have
  > Socratic: No counter-argument; status is the core readiness signal. Stands as written.
- FR-019: Creator can add a freeform notes/corrections field to a generated scene card. Priority: must-have
  > Socratic: No counter-argument; the freeform notes field is the minimal editing surface for a mostly-read-only card. Known limitation: creator cannot fix specific generated fields directly. Accepted for MVP.
- FR-020: Status "Ready" can only be set when player goal + obstacle + at least one interaction/puzzle element + required assets + no critical logic gaps are all present; if characters are present in the scene, their defined function in the scene is additionally required. Priority: must-have
- FR-022: Creator can acknowledge or clear generated design risks on a scene card, making the "no unresolved design risks" condition for Ready status actionable. Priority: must-have
  > Socratic: No counter-argument; the business rule is the product's core value — enforcing it is what separates this from a notes tool. Note: "no critical logic gaps" is assessed during Forge Scene and surfaced as design risks in the card; the product prevents setting "Ready" if the design-risks field is non-empty and unacknowledged. Stands as written.

## Non-Functional Requirements

- Any user-visible operation (navigation, save, status change) responds within 2 seconds. Card generation is exempt from the 2s cap but must show continuous visible progress feedback from the moment the creator triggers it until the card appears.
- One creator's data — projects, characters, scenes, generated cards — is never readable by or visible to another creator's account.
- Every generated scene card contains all required fields. The product never silently omits a section or returns a partial card. A field with insufficient note context is marked "not enough context" rather than omitted.
- The product is fully functional on the latest two major versions of Chrome, Firefox, Safari, and Edge on desktop. No mobile browser requirement for MVP.

## Business Logic

A scene can reach "Ready" status only when it has a clearly defined player goal, an obstacle, at least one interaction or puzzle element, a list of required assets, defined character functions (when characters are present in the scene), and no unresolved design risks.

Forge Scene takes a scene note and project context as inputs and evaluates the scene against its required anatomy — player goal, obstacle, interaction/puzzle, required assets, character presence and function. Each field of the scene card is populated from this evaluation, and design risks or logic gaps are surfaced in the card's design-risks field. The creator manually sets the final status; the product prevents setting "Ready" if any required anatomical element is absent or if design risks are present and unacknowledged. "No unresolved design risks" means the design-risks field is empty or has been explicitly cleared by the creator — it is never a silent pass.

## Access Control

Email + password authentication. Each creator registers and signs in with their own account. Flat user model — every authenticated user sees only their own projects and scenes. No admin roles, no sharing, no team workspaces in MVP. An unauthenticated user who hits a gated route is redirected to sign-in.

## Non-Goals

- **No engine integrations**: generated scene cards stay inside the app. No export to Unity, Adventure Creator, Godot, or any other engine or format. Prevents integration scope creep in MVP.
- **No game-level management**: the tool works at scene level only. No game timeline, no quest system, no location map, no asset manager, no full game bible. A scene knows about itself and its characters — not about the full game structure.
- **No advanced content features**: no dialog editor, no dialog trees, no scene versioning, no NPC relationship graphs, no reputation system. All of these are downstream of a working scene card and will be evaluated after the core Forge Scene loop is validated.
- **No multi-user collaboration**: no shared projects, no team workspaces, no comments, no co-editing. Each creator works in isolation; auth stays flat.
- **No mobile browser requirement**: desktop browsers only. No PWA, no service worker, no offline-first sync.

## Open Questions

None. All gaps resolved during shaping and PRD review.
