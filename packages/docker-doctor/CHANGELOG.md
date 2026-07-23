# @docker-doctor/cli

## 0.3.0

### Minor Changes

- 77aed82: Replace the saturating score formula with a monotonic, asymptotic curve.

  The score used to be `100 - penalty` (floored at 0), which meant any project with roughly 10 errors or 25 warnings scored exactly 0 and stayed there no matter how much worse it got — the score became inert on messy repos, and score-regression checks (e.g. "re-scan, confirm the score did not drop") stopped working once a project hit the floor.

  The score is now `round(100 * e^(-penalty / 70))`, using the same per-severity penalty weights as before (error 10, warning 4, info 1). This curve approaches 0 without ever getting stuck there, so the score keeps moving and stays meaningful across the whole range.

  **Breaking:**

  - Score values have changed. A given set of diagnostics will now produce a different numeric score than before (e.g. a single error used to score 90, now scores ~87; a project that used to floor at 0 will now show a small nonzero number that keeps decreasing as issues pile up).
  - Existing badges, dashboards, or stored scores will show different numbers after upgrading — this is expected, not a regression.
  - The `Excellent 🏆` / `Good ✅` / `Needs Work ⚠️` / `Critical 🚨` label thresholds (>=90 / >=75 / >=50 / below) are unchanged.
  - The JSON report now includes a `schemaVersion` field (currently `2`) to make future score/shape changes detectable.

### Patch Changes

- ff17a27: The Dockerfile parser now understands heredoc (`<<EOF`) syntax — bodies are folded into the owning instruction instead of being mis-parsed as separate instructions — so content-based rules now inspect heredoc commands and phantom instructions no longer appear.
- 21fb2e8: `effect` is no longer a runtime dependency of `@docker-doctor/cli`. The single `Schema.Struct` used to validate `docker-doctor.config.*` and the three `Data.TaggedError` error classes (`ConfigError`, `ParseError`, `FileNotFoundError`) have been replaced with a hand-rolled validator and plain `Error` subclasses that preserve the exact same validation rules, error `_tag` discriminants, and public API. The package's public types no longer reference `effect/Schema`, so consumers no longer pull in a pinned pre-release beta package for a tiny surface area.
- 9b855c5: Fixed the "Docs:" link printed after every scan. It previously pointed at `https://github.com/PunGrumpy/docker-doctor/docs`, which 404s (there is no `docs/` directory in the repository). It now points at `https://docker-doctor.vercel.app`, the project's actual documentation site.
- 859f48c: Fix four rule-specificity bugs in the Dockerfile rule engine:

  - `no-root-user` now resets its tracked user at each `FROM` (build stage), instead of letting a `USER` set in an earlier stage (e.g. a builder) silently satisfy the check for a later stage that never sets one. Multi-stage Dockerfiles may now surface a new diagnostic here.
  - `no-add-remote`, `prefer-copy-over-add`, and `use-dockerignore` now read the first non-flag operand of `ADD`/`COPY` instead of always taking the first whitespace-separated token, so a leading flag like `--chown` or `--from` no longer silently disables the check (e.g. `ADD --chown=node:node https://...` now correctly trips `no-add-remote`). As a side effect, `use-dockerignore` now explicitly skips `COPY --from=<stage>` since that never reads the build context. These fixes may surface new diagnostics.
  - `no-secrets-in-env` no longer matches secret keywords as an unanchored substring, so keys like `AUTHOR` or `OAUTH_ISSUER_URL` no longer false-positive as "potential secret found" (this is the only error-severity rule, so this previously failed CI on Dockerfiles with no secrets). Genuine segment matches like `DB_PASSWORD` still match. This removes diagnostics.
  - `order-layers` now resets its copy-tracking at each build stage, so a copy-everything in an earlier stage no longer implicates an install command in a later, correctly-ordered stage, and no longer substring-matches `"src"` anywhere in a path (e.g. `/usr/src/lib`, `mysrcdir`). This removes diagnostics.

  These are bug fixes to rule specificity; expect docker-doctor scores to move on existing Dockerfiles as false negatives are corrected and false positives are removed.

- a5641ab: Piped or redirected `--json`/`--score` output is no longer silently truncated. The scan action's output paths used `process.exit()` right after `console.log()`, which could abort the process before the async write to a pipe/file finished flushing. They now set `process.exitCode` and return, letting Node exit naturally once stdout has fully drained. Exit codes (`--score` below 50 exits 1; `--json`/default exit 1 on any error-severity diagnostic) are unchanged.

  The score threshold table (labels/emoji at 90/75/50/0) is now exported as `SCORE_BUCKETS` (and `getScoreBucket`) from `@docker-doctor/core`, replacing what used to be duplicated inline logic in `calculateScore`. The printed/JSON `label` strings are byte-identical to before.

- b4cc9a3: Fix image-reference parsing in `pin-image-version` and `prefer-slim-base`, which both used to split on the first `:` and got several common forms wrong:

  - Images with a registry port (`myregistry.example.com:5000/team/app`) are no longer mistaken for pinned/tagged just because the port number looks like a tag. `pin-image-version` now correctly flags these as unpinned.
  - Digest-pinned images (`node@sha256:...`) are no longer misread as an untagged full-OS image by `prefer-slim-base` — the strongest possible pin is now recognized and silently accepted by both rules.
  - Multi-stage build aliases (`FROM builder`, referencing an earlier `FROM ... AS builder`) are no longer flagged as unpinned or non-slim.
  - `${ARG}`-driven base images are skipped instead of producing a false diagnostic, since the actual image can't be determined statically.

  Image-reference parsing is now handled by a single shared parser (`parseImageRef`/`collectStageAliases` in `@docker-doctor/core`) instead of duplicated ad-hoc string splitting in each rule. Expect diagnostics to change on Dockerfiles that use registry ports, digest pins, or multi-stage aliases as their `FROM` target.

## 0.2.1

### Patch Changes

- 62078a3: Update terminal formatter to output a score sharing URL pointing to the web app dashboard with score, warnings, and errors parameters.
- 49fb8ba: Update terminal score box URL from GitHub repo to Vercel web app.

## 0.2.0

### Minor Changes

- ccfca12: Replace `readline/promises` text input with fully interactive keyboard-driven prompts.

  - `askConfirm`: vertical Yes/No layout with arrow keys, vim keys (h/j/k/l), and y/n shortcuts
  - `askSelect`: vertical option list with up/down / j/k navigation
  - Hidden cursor during prompts; restored on exit, Ctrl+C, SIGINT, and SIGTERM
  - Falls back gracefully to default values in non-TTY (CI/pipe) environments

### Patch Changes

- c47c581: Reduce score animation duration from 2 s to 300 ms (20 frames × 15 ms). Guard animation behind `isTTY`, `CI`, `NO_ANIMATION`, `TERM=dumb`, and `NODE_ENV=test` checks to ensure a clean experience in non-interactive environments.
- 0a04d98: Fix workspace discovery to correctly track and validate `.dockerignore` files, resolving false-positive warnings in the `useDockerignore` performance rule.
- a744994: Fix `no-secrets-in-env` rule to support space-separated `ENV KEY VALUE` format, ensuring hardcoded credentials in this format are correctly detected by the linter.
- 60b743d: Fix `FROM` and `COPY`/`ADD` instruction parsing in rules to correctly skip option flags (e.g. `--platform`, `--chown`), preventing false-positive diagnostics or layer ordering check failures.

## 0.1.0

### Minor Changes

- c11718b: Initial release
