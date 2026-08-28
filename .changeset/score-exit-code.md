---
"@docker-doctor/cli": minor
---

`--score` now exits non-zero on the same condition as every other mode: an `error`-severity diagnostic is present. It previously exited 1 when the score was below 50, so the same project could pass with `--json` and fail with `--score`. If you relied on the old threshold as a CI gate, compare the printed score yourself (e.g. `[ "$(docker-doctor . --score)" -ge 50 ]`).
