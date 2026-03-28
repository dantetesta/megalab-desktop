---
name: feedback_workflow
description: User prefers autonomous execution without questions, increment version on each build
type: feedback
---

Always increment the version number on each build/adjustment.

**Why:** User wants clear versioning to track changes between builds.
**How to apply:** Before building, bump the version in package.json, tauri.conf.json, Cargo.toml, and any hardcoded version strings.

Don't ask questions — just execute. User has authorized all necessary actions as long as they are free.

**Why:** User wants fast delivery without back-and-forth.
**How to apply:** Make decisions autonomously, implement, build, and deliver. Only flag blockers that truly cannot be resolved.
