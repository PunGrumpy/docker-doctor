---
name: improve-docker
description: Use when the user asks to audit their Docker setup, find improvement opportunities across their Dockerfiles/Compose, or wants a prioritized roadmap of fixes rather than a single scan — "audit my Docker", "improve my containers", "what's wrong with my infra images". Read-only on source; produces self-contained plans in plans/ for another agent to execute. Companion to the `docker-doctor` scan skill.
version: "1.0.0"
---

# Improve Docker

A read-only senior advisor for Docker infrastructure. It uses `docker-doctor` as machine-verified evidence, adds judgment the scanner can't (base-image strategy, build-context size, layer architecture, supply-chain), then writes one self-contained plan per opportunity for another agent — or a cheaper model — to implement.

**Strict rule: this skill never edits Dockerfiles, Compose files, or app source.** It only writes to `plans/`. Fixing is a separate step (`/docker-doctor` or `docker-author`).

## Phase 1 — Recon

Gather structured evidence before forming any opinion.

```bash
npx @docker-doctor/cli@latest . --json > docker-doctor-report.json   # diagnostics + score + project files
```

- The JSON `project` field lists every Dockerfile / Compose / .dockerignore discovered.
- The JSON `diagnostics[]` carry `rule`, `category`, `severity`, `file`, `line`, `message`, `help` (report `schemaVersion` 3+). Group by `category` directly — no second command is needed.
- The JSON `failures[]` (schema 4+) lists files that were discovered but could not be parsed. Treat them as unknown, not clean.
- `analyzedFiles` (schema 6+) is how many files the score covers. When it is `0`, `score` and `label` are `null` and there is no baseline score.
- Note the exit code, the count of diagnostics per rule, and the `score` and `label` as the baseline.

## Phase 2 — Audit

Read [references/audit.md](references/audit.md) and assess across all five categories. For each, combine the scanner's diagnostics with judgment the rules don't cover (audit.md lists what to look for beyond the rules). Fan out read-only subagents per category for a large project.

## Phase 3 — Vet & prioritize

- **Confirm** each finding by reading the actual `file:line` — discard anything you can't reproduce in the source.
- **Rank by leverage, not raw severity:** `impact ÷ effort`. A one-line `USER` fix on a public image outranks a large multi-stage refactor that shaves a few MB. Bucket into **HIGH / MEDIUM / LOW**.
- De-duplicate: collapse findings that a single change resolves.

## Phase 4 — Write plans

Create `plans/` and write one file per opportunity using [references/plan-template.md](references/plan-template.md). Each plan must be **self-contained** — an executing agent should need nothing but the plan and the repo. Pull the concrete fix from the diagnostic's `help` text or `npx @docker-doctor/cli@latest rules explain <full-rule-key>`.

Every plan's verification step is mechanical:

```bash
npx @docker-doctor/cli@latest . --json > /tmp/docker-doctor-after.json; echo "exit=$?"
```

The targeted rule's diagnostics must be gone at the planned locations, and no other rule may gain findings. Both the baseline and the verification scan must exit `0` or `1`. Exit `2` means a file could not be analyzed, so the two reports cannot be compared. Fix that file and scan again first. The exit code must not go from `0` to `1`. The score averages over every analyzed file, so treat it as a coarse signal and never as the pass condition.

End with a short `plans/README.md` index: findings by priority, the baseline score, and the target score once all plans are applied.
