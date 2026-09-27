---
"@docker-doctor/cli": patch
---

`--config` paths now resolve from the current directory like every other flag, so the Action's `config` input is relative to the repository root, the same as `directory`. A path that only exists relative to the scanned directory still loads, with a warning. A missing scan target or a file passed as the scan target now gets a plain error instead of a raw `scandir` failure. The terminal migration notice counts files instead of findings. The scaffolded workflow grants `statuses: write`, which the Action's default commit status needs, and uses `actions/checkout@v7`. `rules explain` accepts the short rule name, such as `no-root-user`.
