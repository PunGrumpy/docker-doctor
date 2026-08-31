# @docker-doctor/cli

## 0.5.0

### Minor Changes

- c1218ff: Understand the Compose `models:` element (Docker Model Runner) with two new rules: `undefined-model-reference` (error) flags service-level model references with no matching top-level declaration, and `pin-model-version` (warning) flags model artifacts with no tag or a `latest` tag. Unpinned weights change behavior with nothing visible in version control.
- 9ee6eec: Add three Compose security rules aimed at agent-era compose files: `no-privileged-service` (error) flags `privileged: true`, `no-docker-socket-mount` (error) flags bind mounts of `/var/run/docker.sock` in short or long volume syntax, and `no-plaintext-secrets` (warning) flags literal credential values in `environment`. Because new rules add findings, existing projects can score lower than on 0.4.x.
- 536d47c: Implement `ignore.files`. The config key was documented, typed, and validated but consumed by nothing. Glob patterns (`vendored/**`, `**/Dockerfile.test`) now exclude matching files from discovery: they produce no diagnostics, don't affect the score, and don't appear in the report's `project` lists. `**` crosses directories; `*` and `?` stay within one path segment.
- 12c7279: Add the `pin-service-image` Compose rule (warning): flags service `image:` references with no tag or with the mutable `latest` tag, mirroring `pin-image-version` for Dockerfiles. Services with a `build:` context and `${VAR}`-templated references are skipped.
- 8aedfe8: `--score` now exits non-zero on the same condition as every other mode: an `error`-severity diagnostic is present. It previously exited 1 when the score was below 50, so the same project could pass with `--json` and fail with `--score`. If you relied on the old threshold as a CI gate, compare the printed score yourself (e.g. `[ "$(docker-doctor . --score)" -ge 50 ]`).

### Patch Changes

- d444521: Check services with an empty body. `services: { web: }` was skipped by every Compose rule, so the least-configured service in the file produced zero findings. An empty service now reports missing restart policy, resource limits, and the rest like any other service.
- 3e1e0f9: Recognize Docker Hardened Images (`dhi.io/…`): `prefer-slim-base` no longer flags them as heavy bases, and `no-root-user` treats their runtime variants as nonroot by default (`-dev` variants still report). Moving to a hardened base no longer costs score points.

## 0.4.4

### Patch Changes

- 035da22: `clean-package-cache` no longer flags `RUN` instructions that keep apt/apk caches in BuildKit cache mounts (`--mount=type=cache,target=/var/cache/apt`, the pattern Docker documents). A cache mount elsewhere, or a bind mount, still warns.
- 186801a: Compose diagnostics now include the line number of the offending service or key, so terminal output and the GitHub Action's file links point to the correct line instead of the top of the file. Keys that only exist through YAML merge keys (`<<: *anchor`) fall back to the service line.
- 74eba7b: Comment lines inside a line continuation no longer appear in an instruction's `raw` text. They made `sort-multiline-args` misread commented package lists as unsorted. Heredoc bodies keep their `#` lines, since those are shell content.

## 0.4.3

### Patch Changes

- 485a1ee: Sanitize scanned file paths before they reach a coding agent. Rule messages were already flattened, but the paths beside them were interpolated raw into both the handoff prompt and the `.docker-doctor/*.txt` reports, so a filename containing newlines could introduce its own line into an agent's instructions. Those per-rule reports now also flatten the message, matching the prompt.
- 37b3f7d: Warn when a config names a rule or category that does not exist. Keys are matched exactly, so a typo'd rule key — or a category written as `security` instead of `Security` — used to be accepted and then silently match nothing, leaving a suppression the user believed was active doing nothing. Unknown keys are reported on stderr rather than failing the scan, so a config naming a rule removed in a later release still runs.
- 1cda220: Fix `use-exec-form` missing bracket-wrapped `CMD`/`ENTRYPOINT` args that are not valid JSON. `CMD [node, index.js]` was accepted as exec form because the rule only checked for a leading `[` and a trailing `]`, but Docker treats anything that is not a JSON string array as shell form and runs it under `/bin/sh -c` — exactly what the rule exists to flag. Single-quoted elements and trailing commas were missed the same way.

  Exec-form detection now lives in one place, `parseExecForm` in `parsers/`, which `use-exec-form` and `use-pipefail` both use, so the two rules can no longer disagree about what exec form is. This surfaces new warnings on Dockerfiles that previously passed; the fix is to quote the elements (`CMD ["node", "index.js"]`).

- 8105153: Fix `use-pipefail` so its verdict reflects how Docker actually runs a `RUN`.

  - **`SHELL` is honoured.** The rule's own docs prescribe `SHELL ["/bin/bash", "-o", "pipefail", "-c"]` as the fix, but applying it never cleared the warning, because only the single `RUN` line was inspected. The active shell is now tracked per stage: a stage reached `FROM <previous stage>` inherits it, while a fresh base image or `scratch` resets it, matching BuildKit.
  - **Exec-form `RUN` is judged on its own argv.** `RUN ["/bin/bash", "-o", "pipefail", "-c", "…"]` no longer warns. Conversely, a `SHELL` directive no longer suppresses the warning for an exec-form `RUN` that execs a different shell — Docker runs that argv directly, so the `SHELL` prefix never applies. **This surfaces new warnings on Dockerfiles that previously passed.**
  - **Interior comments no longer flip the verdict.** The check reads the instruction's args, which have comment lines stripped, rather than the raw text. A `# TODO: use set -o pipefail` comment no longer silences a real finding, and a `# avoid curl | sh` comment no longer invents one.
  - **Pipefail detection requires the option adjacent to its flag.** The previous bare-substring match exempted any line merely containing the word. Lines such as `set -o errexit && echo pipefail | tee log` and `ssh -o StrictHostKeyChecking=no h | grep pipefail` now warn. The new pattern is also linear, replacing one that backtracked pathologically on long `RUN` lines.

  Known limitation: quoting is invisible to the check, so `RUN echo "set -o pipefail" >> .bashrc && cat x | grep y` still reads as configuring the option. Tracked as a `test.todo` alongside the existing quoted-pipes case.

- 77f056a: Reword all 25 rule summaries into one imperative voice ("Run the container as a non-root user", "Use multi-stage builds", "Add a .dockerignore file") and format code tokens in help text as backticks (`USER node`, `apk add --no-cache`). `rules list`, `rules explain`, and the docs show the new wording; rule keys, severities, and diagnostic messages are unchanged.
- 4a600a4: Route every rule through one `FROM` parser. `use-pipefail` carried its own regex, which required each `--flag` to precede the base image and lost the stage name when one followed it, so `FROM base --platform=linux/amd64 AS app` never registered `app` as a stage and later stages built on it stopped inheriting its `SHELL`. It now uses the shared `parseFromArgs`, as `pin-image-version` and `prefer-slim-base` already did, and `collectStageAliases` is built on it too.

  The reserved empty base is now recognised the same way everywhere via `isScratch`. `pin-image-version` compared case-sensitively while `use-pipefail` lowercased first, so `FROM SCRATCH` was reported as an image that "does not specify a tag" by one rule and treated as the empty stage by the other. It is treated as the empty stage everywhere now, so that diagnostic no longer appears.

- d78d960: Teach `no-root-user` and `avoid-dev-dependencies` about multi-stage inheritance. A stage built `FROM <previous stage>` inherits that stage's image config and layers, but `no-root-user` reset `USER` to root on every `FROM`, reporting a false positive when the parent stage had already dropped privileges, and `avoid-dev-dependencies` audited only the instructions after the last `FROM`, missing dev installs whose layers the final image inherits from a parent stage. Both rules now resolve the stage chain through a shared `parseFromArgs` helper in the image-ref parser.

## 0.4.2

### Patch Changes

- a458b4c: Sanitize scanned-file content before it enters agent handoff prompts, label it as untrusted data, and ask for explicit confirmation before launching an agent with its skip-approvals flag.
- d235f97: `categories` severity values other than "off" now actually override rule severities (previously they were silently ignored), and category handling moved into the core runners so programmatic API consumers get the same results as the CLI.
- f2a983a: Resolve YAML merge keys (`<<: *anchor`) when parsing Compose files, eliminating false `require-restart-policy` / `require-resource-limits` warnings on services that inherit those settings from an extension field.
- 37cca50: Discovered Dockerfiles, Compose files and `.dockerignore` files are now returned in sorted order, so repeated scans of an unchanged project produce byte-identical JSON reports (apart from the timestamp) and stable PR-comment row ordering. Previously the concurrent workspace walk emitted files in I/O-completion order.
- 34dc094: Fix the Dockerfile parser treating shell `<<` (arithmetic, here-strings) as a heredoc opener, which silently swallowed the rest of the file and produced false diagnostics.
- bfde65a: Declare `engines.node >= 20.11.0`. The CLI already required Node 20.11+ at runtime (`Array.prototype.toSorted`, `import.meta.dirname`); npm now warns at install time instead of crashing at first run on older Node.
- 3a41a43: Add a "What it catches" section with a before/after layer-ordering example, and correct the rule count to 25.
- bba2a18: Three rule-accuracy fixes: `no-root-user` now detects `USER root:root`, `USER root:0` and other `user:group` root spellings; `prefer-slim-base` recognizes minimal images by name (`alpine`, `busybox`, distroless) instead of only by tag, removing false positives on `alpine:3.19`; `use-dockerignore` now requires a `.dockerignore` next to the Dockerfile or at the scan root, instead of accepting any `.dockerignore` anywhere in the workspace.
- fc5569d: Exit with status 2 when a Dockerfile or Compose file cannot be read or parsed, and list the affected files on stderr. Previously an unparseable file contributed no diagnostics and the run could report a perfect score with exit 0 — a green CI gate over a file that was never analyzed.
- a581f49: The interactive wizard now scaffolds `.github/workflows/docker-doctor.yml` into the scanned directory instead of the current working directory, and asks before overwriting an existing workflow file (declining, or a non-interactive run, keeps the existing file).

## 0.4.1

### Patch Changes

- 152c0c8: Update document the `--global` install flag and the Docker Sandboxes kit.

## 0.4.0

### Minor Changes

- d2a7a45: Add `--global` flag to `docker-doctor install` — installs the agent skill into each agent's global skills directory (e.g. `~/.claude/skills`) instead of the current project. Groundwork for the Docker Sandboxes kit.

## 0.3.4

### Patch Changes

- 23be7e4: Tag the shared score URL with `utm_source=cli&utm_medium=terminal` so site analytics can tell the person who ran the scan apart from the visitors who follow their shared link.

## 0.3.3

### Patch Changes

- 42088be: Update tsdown dts generator config for typescript 7 support
- 78ae451: The post-scan wizard scaffolds workflows against `PunGrumpy/docker-doctor@v1` — the GitHub Action is now versioned independently of the CLI, with a floating major tag that moves only when the action itself changes.

## 0.3.2

### Patch Changes

- 1d838c6: Add a GitHub Action for running Docker Doctor in CI. `uses: PunGrumpy/docker-doctor@v0` scans the repository on every pull request and posts a sticky summary comment: a per-file status table, the health score linking to a shareable score card, and every finding linked to the exact line at the scanned commit. The gate is advisory by default and can be raised with `blocking: warning | error` (pull requests only — pushes never fail), and the score and per-severity counts are exposed as step outputs. The action is versioned in lockstep with the CLI: every release moves a floating major tag (`v0`, later `v1`) plus an exact `v<version>` tag for reproducible pins.

  The post-scan wizard's "Add Docker Doctor to GitHub Actions?" step now scaffolds a workflow that uses the action. It previously wrote a workflow invoking `bunx docker-doctor`, an npm package that does not exist.

## 0.3.1

### Patch Changes

- 3546391: Add coding-agent integration: a `docker-doctor install` command that installs the bundled agent skill for any agent-install-supported coding agent (Claude Code, Cursor, Codex, OpenCode, and more), and a post-scan handoff that replaces the old "View rules list" prompt — when a scan finds issues, the CLI now offers to launch a detected agent (`claude`, `codex`, `cursor-agent`) with the issues as its prompt, or copy that prompt to the clipboard. Handoffs write the full report to `.docker-doctor/` (auto-gitignored) and install the skill for the chosen agent.
- e6e7e88: Export the `DockerDoctorConfig` type (plus `RuleCategory`) and a `defineConfig` helper for typed `docker-doctor.config.ts` files, and fix the config type's `categories` field to accept a subset of categories (`Partial<Record<…>>`) — matching the validator's actual behavior and the documented examples.
- b730028: Support `docker-doctor.config.yaml` / `.yml` config files (resolved after `.json`, and via `--config`). A JSON Schema generated from the rule set is published at https://docker-doctor.vercel.app/schema.json for editor autocomplete/validation in YAML (`# yaml-language-server: $schema=…`) and JSON (`"$schema"` key) configs.

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
