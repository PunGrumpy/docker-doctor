---
"@docker-doctor/cli": patch
---

Add a GitHub Action for running Docker Doctor in CI. `uses: PunGrumpy/docker-doctor@v0` scans the repository on every pull request and posts a sticky summary comment: a per-file status table, the health score linking to a shareable score card, and every finding linked to the exact line at the scanned commit. The gate is advisory by default and can be raised with `blocking: warning | error` (pull requests only — pushes never fail), and the score and per-severity counts are exposed as step outputs. The action is versioned in lockstep with the CLI: every release moves a floating major tag (`v0`, later `v1`) plus an exact `v<version>` tag for reproducible pins.

The post-scan wizard's "Add Docker Doctor to GitHub Actions?" step now scaffolds a workflow that uses the action. It previously wrote a workflow invoking `bunx docker-doctor`, an npm package that does not exist.
