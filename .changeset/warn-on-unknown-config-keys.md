---
"@docker-doctor/cli": patch
---

docker-doctor now warns on stderr about an unknown key in the config, such as `rule:` for `rules:` or `ignore.file` for `ignore.files`. The warning names the config file and suggests the closest known key. The warnings about an unknown rule or category name now name the file and suggest a fix too, and a bare rule name such as `no-root-user` gets the full key. A config with more than 20 unknown keys prints the first 20 and a count of the rest. Warnings never change the exit code or the `--json` and `--score` output.
