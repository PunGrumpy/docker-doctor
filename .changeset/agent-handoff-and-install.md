---
"@docker-doctor/cli": patch
---

Add coding-agent integration: a `docker-doctor install` command that installs the bundled agent skill for any agent-install-supported coding agent (Claude Code, Cursor, Codex, OpenCode, and more), and a post-scan handoff that replaces the old "View rules list" prompt — when a scan finds issues, the CLI now offers to launch a detected agent (`claude`, `codex`, `cursor-agent`) with the issues as its prompt, or copy that prompt to the clipboard. Handoffs write the full report to `.docker-doctor/` (auto-gitignored) and install the skill for the chosen agent.
