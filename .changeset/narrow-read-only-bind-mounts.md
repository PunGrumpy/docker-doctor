---
"@docker-doctor/cli": patch
---

Add two Compose rules for host bind mounts. `no-broad-bind-mount` (warning) reports services that bind-mount the host root, the home directory or a hidden directory under it, a parent of the project, or a system directory such as `/etc` or `/proc`. `prefer-read-only-bind-mount` (info) reports bind mounts outside the project that are not marked `:ro` / `read_only: true`. Both rules exist because a writable host mount is the foothold for VM-escape bugs like CVE-2026-77179 in Docker Desktop and Docker Sandboxes; mounting less and mounting read-only is the defense that does not depend on the hypervisor.
