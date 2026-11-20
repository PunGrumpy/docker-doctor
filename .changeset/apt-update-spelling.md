---
"@docker-doctor/cli": patch
---

`combine-apt-update-install` now counts `apt update` as the update step of an `apt-get install`, and `apt install` as the install step of an `apt-get update`, so the example in the Docker build cache docs is no longer reported.
