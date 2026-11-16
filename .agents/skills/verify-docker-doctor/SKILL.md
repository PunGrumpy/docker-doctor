---
name: verify-docker-doctor
description: Drive the docker-doctor CLI built from this checkout against throwaway copies of the test fixtures, and capture the command, stdout, stderr and exit code as proof. Use to verify or review a change to a rule, a parser, the report, a flag, the config loader or `install` the way a user runs it. Never scans a real project, never writes to your home, and only touches Docker images it labeled itself.
---

# Verify docker-doctor

docker-doctor is a CLI. A user runs `docker-doctor [dir]` and reads stdout, stderr and the exit code. This skill runs that same path, `node packages/docker-doctor/dist/cli.mjs`, through one helper, `control-docker-doctor.ts`. The helper gives each run a throwaway work directory, home and temp directory, copies fixtures into it, and records every command it runs.

docker-doctor is a static analyzer. It reads files and never talks to the Docker daemon, so nothing here needs Docker. Docker is used only by the optional `image-build` check.

Run every command from the repository root. The helper path is long, so set it once:

```sh
C=.agents/skills/verify-docker-doctor/scripts/control-docker-doctor.ts
RUN=my-change   # letters, digits, - and _; default "default"
```

## Safety contract

The helper enforces these, so keep every docker-doctor command inside `$C run`.

- **Work directory only.** `run` refuses a scan directory, a `--config` path or a `--baseline` path that resolves outside the run's `work/`, after following symlinks. Your real projects are never scanned.
- **No home writes.** `run` refuses `-g` and `--global`. docker-doctor gets a clean environment: `PATH`, a throwaway `HOME` and `XDG_*` under the run, a throwaway `TMPDIR` and `NO_COLOR=1`.
- **No terminal.** stdin is closed, so no prompt, agent handoff, clipboard copy or workflow scaffold can run.
- **Own Docker images only.** `image-build` gives every build a fresh tag, `ddverify-<run>-<dir>:b<time>`, and the labels `ddverify=1` and `ddverify.run=<run>`. `down` removes those tags by name, never by image ID, so a tag the helper did not create keeps its image. A labeled image without a `ddverify-<run>-` tag is reported and left alone, and `down` then exits 1. The helper has no prune, no container command and no Docker passthrough.

A refusal prints `control-docker-doctor: refused: <why>` and exits 64 without running docker-doctor. docker-doctor itself never exits 64, so a refusal can't pass for a scan result. It is recorded in the evidence too.

Two argument forms are refused because their paths can't be checked reliably: a path with a `..` segment, and a bundled short flag that contains `c`, such as `-vc`. Write `--config <path>` instead.

Never run `dist/cli.mjs` or an installed `docker-doctor` outside the helper for verification. Without a scan directory it scans the current directory, and `install` writes into it.

## Launch

```sh
bun install --frozen-lockfile                 # once per checkout
bun run build --filter @docker-doctor/cli     # after every source change
$C up --run "$RUN"
```

Ready looks like this:

```text
ready <run>
work <tmp>/ddverify/runs/<run>/work
evidence <tmp>/ddverify/evidence/<run>
```

`up` on a live run reports it and changes nothing. Runs with different names are independent. Two agents must never share one run name. `DDVERIFY_ROOT` moves the whole tree away from `$TMPDIR/ddverify`.

Copy the fixtures a recipe needs into the run. Copying again resets one after a recipe edited it.

```sh
$C fixture --run "$RUN" clean with-error all-broken
```

The fixtures are `packages/docker-doctor/test/fixtures/<name>`. For a new case, write a directory under the `work` path `up` printed.

## Doctor

Run this first, and again whenever anything looks off. It only reads.

```sh
$C doctor --run "$RUN"
```

Each line starts with `ok`, `FAIL` or `info`. The checks are the run's directories, `dist/cli.mjs`, its `--version` against `packages/docker-doctor/package.json`, and whether `dist/` is older than any file in `packages/core/src` or `packages/docker-doctor/src`. A stale `dist/` is a FAIL, because a run against it proves the last build, not your change. Docker is reported as `info` when the daemon is unreachable. Exit code 0 means no check failed.

## Drive

```sh
$C run --run "$RUN" -- <docker-doctor args>
```

Examples: `$C run --run "$RUN" -- --score clean`, `$C run --run "$RUN" -- --json with-error` and `$C run --run "$RUN" -- rules explain docker-doctor/no-root-user`. The working directory is `work/`, so a fixture name is a relative path. stdout and stderr pass through unchanged, and the helper exits with docker-doctor's code. Its last stderr line names the evidence file.

To test a change, drive the recipes the change touches from the matching file in [`features/`](features/README.md). Then drive a neighbor it shouldn't touch.

### Optional Docker ground truth

A rule claims something about how Docker builds or runs an image. When the Docker daemon is up, check that the case you wrote builds:

```sh
$C image-build --run "$RUN" <dir under work>
```

It runs only `docker build --label ddverify=1 --label ddverify.run=<run> -t ddverify-<run>-<dir>:b<time> <dir>` and records the output as evidence. It refuses when the daemon is unreachable. Don't run other `docker` commands against these images by hand.

## Evidence

Each `run` and `image-build` writes `<evidence>/<NN>-<args>.txt` with the command, working directory, exit code, stdout and stderr. The work path reads `$WORK` there. It also appends a row to `<evidence>/index.tsv` with the time, exit code, file and command. Evidence lives outside the run directory, so `down` keeps it.

Proof standards:

- Show the input and the result. Before scanning a case you wrote, `cat` it, so the proof shows what was scanned.
- For JSON, parse stdout (`jq` or `bun -e`) and assert the field. Don't grep the pretty report.
- Prove the exit code. docker-doctor exits 0 below the fail threshold, 1 at or above it, and 2 when it could not analyze at least one file. Exit 2 wins over 1, and the score then covers only the files it analyzed.
- A check passes on what docker-doctor printed for the user path, never on a unit test or an internal function.
- A fixed false positive needs two proofs. The bad case no longer reports, and a true positive next to it still does.

## Cleanup

```sh
$C down --run "$RUN"
```

`down` removes the run's image tags when the daemon is up, then deletes the run directory. It exits 1 when the image list fails or a tag can't be removed, so a clean exit means no image of the run is left. It keeps `<tmp>/ddverify/evidence/<run>/` and its output names that folder. Run `down` after every failed attempt too. Delete evidence by hand once it is in the PR.

## Helpers

- `scripts/control-docker-doctor.ts` runs `up`, `doctor`, `fixture`, `run`, `image-build` and `down`, as shown above. Run it directly. It needs Bun and Node on `PATH`.
- `scripts/tsconfig.json` gives the type-aware lint the Bun and Node types for the helper.
