---
"@docker-doctor/cli": minor
---

Implement `ignore.files`. The config key was documented, typed, and validated but consumed by nothing. Glob patterns (`vendored/**`, `**/Dockerfile.test`) now exclude matching files from discovery: they produce no diagnostics, don't affect the score, and leave the report's `project` lists. `**` crosses directories; `*` and `?` stay within one path segment.
