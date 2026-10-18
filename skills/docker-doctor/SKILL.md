---
name: docker-doctor
description: Use when finishing a Docker change, before committing a Dockerfile or Compose file, or when the user types `/docker-doctor`, asks to scan, triage, or clean up Docker diagnostics. Covers security, performance, best practices, Compose, and image size. Includes a regression check and a full local-triage workflow.
version: "1.0.0"
---

# Docker Doctor

Scans Dockerfile and Docker Compose files for security, performance, best-practices, Compose, and image-size issues. Outputs a 0–100 health score.

## After editing a Dockerfile or Compose file:

Scan once before you touch anything and once after your change. Save both reports outside the project and note both exit codes.

```bash
npx @docker-doctor/cli@latest . --json > /tmp/docker-doctor-before.json; echo "exit=$?"   # BEFORE editing
npx @docker-doctor/cli@latest . --json > /tmp/docker-doctor-after.json; echo "exit=$?"    # AFTER editing
```

The CLI scans the whole project. There is no changed-only scope, so compare the two whole-project reports in this order:

1. **Exit code.** `0` means no `error`-severity finding, `1` means at least one, `2` means a file could not be read or parsed. If it went from `0` to `1`, your change added an error. Fix it before committing. On `2` the scan is incomplete and nothing else is comparable. Fix the file named on stderr, then scan again.
2. **Findings per rule.** Count `diagnostics[].rule` in each report. A rule with more findings after your change is a regression, even when the score did not move. Fix it before committing.

```bash
node -e 'for (const f of process.argv.slice(1)) { const c = {}; for (const d of require(f).diagnostics) c[d.rule] = (c[d.rule] ?? 0) + 1; console.log(f, c); }' /tmp/docker-doctor-before.json /tmp/docker-doctor-after.json
```

3. **Score.** A coarse signal only. It averages the penalty over every analyzed file, so a new error in one file of a large project can leave the score almost unchanged. Never accept a change because the score held.

A warning that no Dockerfiles or Compose files were found means the scan had no files. Do not compare its report with any other.

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
3. **Fix.** Apply the `Help:` recipe from the scan output to the working tree. `npx @docker-doctor/cli@latest rules explain <rule>` prints the rule's category, default severity and description next to the same fix text (the full key `docker-doctor/no-secrets-in-env` or the short name `no-secrets-in-env`). For the full explanation with examples, read the rule's page at `https://docker-doctor.vercel.app/docs/reference/rules/<short-name>`.
4. **Validate.** Re-run `npx @docker-doctor/cli@latest . --verbose`. Confirm the diagnostics you targeted are gone and no other rule gained findings. Repeat until the exit code is `0` and every remaining finding is one you chose to keep and explained. The score should rise or hold. It is a summary, not proof.

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
| `--score`, `-s` | Output only the numeric score (exits 1 if any error-severity diagnostic, 2 if a file could not be analyzed) |
| `--json`, `-j` | Output the full JSON report (exits 1 if any error-severity diagnostic, 2 if a file could not be analyzed) |
| `--config <path>`, `-c` | Use a custom config file |
| `rules list` | List every rule with its category, default severity, and description |
| `rules explain <rule>` | Print one rule's category, default severity, description and fix hint (the same text as `Help:`). Accepts the full key (`docker-doctor/no-root-user`) or the short name (`no-root-user`) |

> The default scan exits non-zero when any `ERROR`-severity diagnostic is present — useful as a CI gate. Exit `2` means a discovered file could not be read or parsed. Inside this repo (monorepo source), run the CLI with `bun packages/docker-doctor/src/cli.ts` instead of `npx`.
