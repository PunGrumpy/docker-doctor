---
"@docker-doctor/cli": patch
---

The post-scan handoff now uses the directory you scanned. A launched agent starts in that directory instead of the shell's, the launch confirmation names it, and the prompt says which directory its file paths are relative to. `.docker-doctor/` contains its own `.gitignore`, so it stays untracked when you scan a subdirectory of a repository. docker-doctor writes the scaffolded workflow at the repository root, where GitHub runs it, and passes the scanned subdirectory as the action's `directory` input.
