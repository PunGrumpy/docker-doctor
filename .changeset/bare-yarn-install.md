---
"@docker-doctor/cli": patch
---

A bare `RUN yarn`, which is Yarn's default install, is now checked by `avoid-dev-dependencies` like `yarn install`.
