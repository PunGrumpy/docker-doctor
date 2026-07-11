---
"@docker-doctor/cli": patch
---

Reduce score animation duration from 2 s to 300 ms (20 frames × 15 ms). Guard animation behind `isTTY`, `CI`, `NO_ANIMATION`, `TERM=dumb`, and `NODE_ENV=test` checks to ensure a clean experience in non-interactive environments.
