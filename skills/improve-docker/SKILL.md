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
npx @docker-doctor/cli@latest rules list                             # rule -> category map (JSON has no category field)
```

- The JSON `project` field lists every Dockerfile / Compose / .dockerignore discovered.
- The JSON `diagnostics[]` carry `rule`, `severity`, `file`, `line`, `message`, `help` — but **not** category. Use `rules list` to map each `rule` back to its category.
- Note the `score` and `label` as the baseline.

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
npx @docker-doctor/cli@latest . --score   # must not drop; the targeted diagnostic must clear on re-scan
```

End with a short `plans/README.md` index: findings by priority, the baseline score, and the target score once all plans are applied.
