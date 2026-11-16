# docker-doctor verification map

This directory is the maintained source for verifying what a docker-doctor user sees. Read this index before driving the CLI, then use the matching feature file as the recipe.

## Baseline preconditions

- The CLI is built from this checkout with `bun run build --filter @docker-doctor/cli`.
- `C=.agents/skills/verify-docker-doctor/scripts/control-docker-doctor.ts` is set in a shell at the repository root.
- `$C up --run "$RUN"` printed `ready`, and `$C doctor --run "$RUN"` exits 0.
- Every fixture a recipe names was copied with `$C fixture --run "$RUN" <name>`.
- Never point docker-doctor at a directory outside the run's `work/`. The helper refuses it.

## Driving conventions

- Run every docker-doctor command through `$C run --run "$RUN" -- <args>`. Its working directory is the run's `work/`, so fixture names are relative paths.
- Copy a fixture again with `$C fixture` to reset it after a recipe edits it.
- Write a new case as a directory under `work/`, the path `up` printed. Don't edit `packages/docker-doctor/test/fixtures`.
- Use `--json` or `--score` for assertions. The terminal report is for humans and changes wording between releases.
- `NO_COLOR=1` is always set and stdin is never a terminal, so no prompt, handoff or clipboard step runs.

## Proof and skip reporting

- CLI proof is the evidence file `run` writes. It holds the command, exit code, stdout and stderr.
- Show the input and the result. Before a scan of a hand-written case, `cat` the file you wrote.
- Parse JSON with `jq` or `bun -e` and assert a field. Don't grep the pretty report.
- Name the feature file and entry point with every proof.
- Report an unreachable path with the attempted command and the unmet precondition. Don't report a skipped entry point as verified through a different one.

## Feature entry contract

Each feature file starts with an H1 title and one paragraph describing the user-visible behavior. It then uses exactly four H2 sections in this order.

1. `Sub-features` lists short IDs with one line for each behavior.
2. `How to get to it (user POV)` lists every user entry point.
3. `Driving it with control-docker-doctor` starts with `Preconditions:` and uses labeled bullets that pair each user action with an exact command and observable result.
4. `Gotchas` lists traps that can waste or invalidate a verification run.

## Features

- [Scan and report](./scan-report.md) covers the default scan, `--score`, `--json`, `--verbose` and the exit codes 0, 1 and 2.
- [Fail threshold and baseline](./fail-on-and-baseline.md) covers `--fail-on` and `--baseline`.
- [Config and ignores](./config-and-ignores.md) covers config files, `--config`, `--no-config`, inline ignore comments and unknown config keys.
- [Rules reference](./rules.md) covers `rules list` and `rules explain`.
- [Install the agent skill](./install-skill.md) covers `install` into a project and the refused `--global`.

## Not verifiable with this helper

- The interactive scan, the agent handoff, the clipboard copy and the workflow scaffold. They need a terminal on stdin and stdout, and `run` never gives docker-doctor one.
- `install --global`. It writes into the user's home skills directories, so `run` refuses it.
- The GitHub Action (`action.yml`) and the Sandboxes kit. They run in CI and in sbx, not in a local shell.
