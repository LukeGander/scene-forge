---
change_id: browse-projects-and-scenes
title: Browse projects and their scenes with status
status: impl_reviewed
created: 2026-08-30
updated: 2026-08-30
archived_at: null
---

## Notes

**Cross-branch integration note (for after S-05 merges):** S-02 sorts the project detail page's scene list by `scenes.updated_at`. S-05 (`edit-note-after-generation`) will add a note-edit route that explicitly bumps `scenes.updated_at`. Once both are merged, smoke-test that editing a scene's note moves that scene to the top of its project's scene list. Not a blocker for S-02 — the S-02 worktree doesn't contain S-05's note-edit route yet.
