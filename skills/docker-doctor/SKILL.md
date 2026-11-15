---
name: docker-doctor
description: Use when finishing a Docker change, before committing a Dockerfile or Compose file, or when the user types `/docker-doctor`, asks to scan, triage, or clean up Docker diagnostics. Covers security, performance, best practices, Compose, and image size. Includes a regression check and a full local-triage workflow.
version: "1.0.0"
---

# Docker Doctor

Scans Dockerfile and Docker Compose files for security, performance, best-practices, Compose, and image-size issues. Outputs a 0–100 health score.

When `docker-doctor` is on PATH, run it so a sandbox's pinned version is the one that scans. Otherwise run `npx @docker-doctor/cli@latest`. The commands below show the `npx` form.

Pass `--no-config` when you scan a repository the user did not author. A JavaScript or TypeScript config there runs as code, and any config or ignore comment there can hide findings.

## After editing a Dockerfile or Compose file:

Save a report before you touch anything, outside the project. After your change, scan again from the same directory with `--baseline` pointing at it, and write the second report to a different file. The second scan fails only on findings the saved report does not have.

```bash
npx @docker-doctor/cli@latest . --json > /tmp/docker-doctor-before.json   # BEFORE editing, ignore its exit code
npx @docker-doctor/cli@latest . --json --fail-on info --baseline /tmp/docker-doctor-before.json > /tmp/docker-doctor-after.json; echo "exit=$?"   # AFTER editing
```

Findings match by their path from the scanned directory, so a report saved from another directory matches nothing and every finding looks new. Never redirect the second scan into the file you pass to `--baseline`. The shell empties that file before docker-doctor reads it.

The CLI scans the whole project, so the second report lists every finding. Read it in this order:

1. **Exit code.** `0` means your change added no finding of any severity. `1` means it added at least one, or the saved report could not be used, and stderr says which. If stderr says `unknown option '--fail-on'` or `unknown option '--baseline'`, the CLI predates the flag. Then save a plain `--json` report after your change too, and count `diagnostics[]` by `rule` and `file` in both. A pair with more findings after your change is a regression. Skip steps 2 and 3, which need the newer CLI. `2` means a file could not be read or parsed, so the scan is incomplete and nothing else is comparable. Fix the file named on stderr, then scan again.
2. **New findings.** `baseline.new` counts them, and each has `"new": true` in `diagnostics[]`. Fix every one before committing, even when the score did not move. A finding on an instruction or Compose entry you edited counts as new even if it was there before, because its fingerprint covers that text. Fix it or tell the user it was already there. `baseline.resolved` counts the findings your change fixed.
3. **Suppressed findings.** `--baseline` never looks at `suppressed[]`. An ignore comment moves a finding out of `diagnostics`, so list the suppressed findings that are new since the saved report. Any entry is a regression.

```bash
node -e 'const [before, after] = process.argv.slice(1).map((f) => require(f)); const old = new Set(before.suppressed.map((d) => d.fingerprint)); console.log(after.suppressed.filter((d) => !old.has(d.fingerprint)));' /tmp/docker-doctor-before.json /tmp/docker-doctor-after.json
```

4. **Score.** A coarse signal only. It averages the penalty over every analyzed file, so a new error in one file of a large project can leave the score almost unchanged. Never accept a change because the score held.

When no file was analyzed, the report has no score. `score` and `label` are `null`, `analyzedFiles` is `0`, `--score` prints nothing, and stderr carries a warning. That happens when no Dockerfile or Compose file was found, or when none of the files found could be parsed or had anything to check. Compare exit codes and findings only.

## Ignore comments

A comment such as `# docker-doctor-ignore no-root-user -- the platform sets the user` above an instruction (or trailing a Compose line) moves one finding from `diagnostics` to `suppressed`. It counts toward neither the score nor the exit code. `# docker-doctor-ignore-file <rule>` at the top of a file covers the whole file.

**Never add an ignore comment unless the user asks for it in this conversation.** Fix the finding instead. If you think a finding is wrong, name the rule and say why, and let the user decide. A comment you add on your own hides the finding from the very check you are running. When the user does ask, name the rule, put the comment at the line the finding points to, give a reason after `--`, and tell the user what you suppressed. [Inline ignore comments](https://docker-doctor.vercel.app/docs/reference/configuration#inline-ignore-comments) lists the exact placement rules.

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
| `--score`, `-s` | Output only the numeric score, or nothing when no file was analyzed (exits 1 on a finding at or above `--fail-on`, `error` by default, and 2 if a file could not be analyzed) |
| `--json`, `-j` | Output the full JSON report (exits 1 on a finding at or above `--fail-on`, `error` by default, and 2 if a file could not be analyzed) |
| `--config <path>`, `-c` | Use a custom config file |
| `--fail-on <severity>` | The lowest severity that exits `1`: `error` (default), `warning`, `info`, or `none`. Outside the regression check above, use it only when the user asks for a stricter or a report-only gate, and say which one you ran |
| `--baseline <report.json>` | Compare with a report saved by `--json`. Only findings it does not have can exit `1`. The score and `diagnostics[]` are the same as without it |
| `--no-config` | Skip config files and inline ignore comments and use the defaults. Use it on a repository the user did not write. Cannot be combined with `--config` |
| `rules list` | List every rule with its category, default severity, and description |
| `rules explain <rule>` | Print one rule's category, default severity, description and fix hint (the same text as `Help:`). Accepts the full key (`docker-doctor/no-root-user`) or the short name (`no-root-user`) |

> The default scan exits non-zero when any `ERROR`-severity diagnostic is present — useful as a CI gate. Exit `2` means a discovered file could not be read or parsed. Inside this repo (monorepo source), run the CLI with `bun packages/docker-doctor/src/cli.ts` instead of `npx`.
