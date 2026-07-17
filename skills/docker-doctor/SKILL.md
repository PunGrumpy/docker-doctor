---
name: docker-doctor
description: Use when finishing a Docker change, before committing a Dockerfile or Compose file, or when the user types `/docker-doctor`, asks to scan, triage, or clean up Docker diagnostics. Covers security, performance, best practices, Compose, and image size. Includes a score-regression check and a full local-triage workflow.
version: "1.0.0"
---

# Docker Doctor

Scans Dockerfile and Docker Compose files for security, performance, best-practices, Compose, and image-size issues. Outputs a 0–100 health score.

## After editing a Dockerfile or Compose file:

Capture the score before you touch anything, make your changes, then re-scan and confirm the score did not drop before committing.

```bash
npx @docker-doctor/cli@latest . --score   # note the number BEFORE editing, and again AFTER
```

The CLI scans the whole project — there is no changed-only scope — so compare the two whole-project scores. If the score dropped, fix the regressions before committing.

## For general cleanup or code improvement:

Run the full scan and fix by severity — `ERROR` first, then `WARN`, then `INFO`.

```bash
npx @docker-doctor/cli@latest . --verbose
```

`--verbose` prints the offending file, line number, an explanation, and a `Help:` fix hint for every diagnostic.

## /docker-doctor — full local triage workflow

When the user types `/docker-doctor`, says "run docker doctor", or asks for a full triage / cleanup pass (not just a regression check), run this scan → triage → fix → validate loop. It edits the working tree directly — **never commit, never open a PR.**

1. **Scan.** `npx @docker-doctor/cli@latest . --verbose` and read every diagnostic. Each one carries its rule key (e.g. `docker-doctor/no-root-user`), severity, file:line, and a `Help:` line with the canonical fix.
2. **Triage.** Order by severity: `ERROR` → `WARN` → `INFO`. Within a severity, prefer security fixes first. Skip nothing silently — if you choose not to fix something, say why.
3. **Fix.** Apply the `Help:` recipe from the scan output to the working tree. When you need more depth on a rule than the inline hint gives, run `npx @docker-doctor/cli@latest rules explain <rule>` (full key required, e.g. `docker-doctor/no-secrets-in-env`).
4. **Validate.** Re-run `npx @docker-doctor/cli@latest . --verbose` and confirm the diagnostics you targeted are gone and the score rose. Repeat until errors are cleared and the score stops improving.

## Configuring or explaining rules

When the user wants to understand a rule, disagrees with one, or wants to disable / tune which rules run (not fix code), read [references/explain.md](references/explain.md) and follow it. Start with `npx @docker-doctor/cli@latest rules explain <rule>`, then hand-edit `docker-doctor.config.ts`.

## Commands

```bash
npx @docker-doctor/cli@latest . --verbose
```

| Command / flag | Purpose |
| --- | --- |
| `.` | Directory to scan (default `.`) |
| `--verbose`, `-v` | Show affected file, line, explanation, and fix hint per diagnostic |
| `--score`, `-s` | Output only the numeric score (exits 1 if score < 50) |
| `--json`, `-j` | Output the full JSON report (exits 1 if any error-severity diagnostic) |
| `--config <path>`, `-c` | Use a custom config file |
| `rules list` | List every rule with its category, default severity, and description |
| `rules explain <rule>` | Explain one rule + its fix. Requires the **full** key (`docker-doctor/no-root-user`), not the bare id |

> The default scan exits non-zero when any `ERROR`-severity diagnostic is present — useful as a CI gate. Inside this repo (monorepo source), run the CLI with `bun packages/docker-doctor/src/cli.ts` instead of `npx`.
