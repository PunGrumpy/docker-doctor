# Docker Doctor kit

Static analysis for Dockerfiles and Docker Compose files, preinstalled in your sandbox — the agent lints its own Docker changes before committing them.

## Usage

From Docker Hub (no configuration needed — `sbx` trusts `docker.io/` by default). The tag is required; `sbx` does not default to `:latest`:

```console
$ sbx run --kit docker.io/pungrumpy/docker-doctor-kit:latest claude
```

From this repository (source of truth):

```console
$ sbx run --kit "git+https://github.com/PunGrumpy/docker-doctor.git#dir=kits/docker-doctor" claude
```

Or from a local checkout:

```console
$ sbx run --kit ./kits/docker-doctor/ claude
```

The kit is a `mixin`, so it composes with any agent sandbox (`claude`, `codex`, `gemini`, `opencode`, …).

## How it works

At sandbox creation the kit:

1. Installs a pinned `@docker-doctor/cli` globally from `registry.npmjs.org` (the only network access it needs — npm verifies the tarball against the registry's sha512 integrity metadata, so the version pin also pins content).
2. Installs the bundled `docker-doctor` agent skill into the sandbox home via `docker-doctor install --global` — into each agent's global skills directory (e.g. `~/.claude/skills`; universal agents share `~/.agents/skills`). Nothing is written to your mounted workspace.
3. Injects a short memory note telling the agent: after editing any Dockerfile or Compose file, run `docker-doctor` and fix the diagnostics before committing — with the `/docker-doctor` skill available for the full triage workflow.

Requirements: a base template with Node.js (all standard agent templates ship it; `claude-code-minimal` does not).

## Consuming from this repository

By default `sbx` only allows kit sources from `docker.io/`. To pull this kit straight from GitHub, allow the source once:

```console
$ sbx settings set kit.allowedSources '["docker.io/","github.com/PunGrumpy/"]'
```

## Cleanup

None — the kit writes only inside the sandbox (global npm install + home-directory skill files). Your mounted workspace and host stay untouched.

## Publishing (maintainers)

The kit versions independently of the CLI it installs — its own semver lives in `spec.yaml` (`version:`), the same way the GitHub Action's `v1` tag is independent of the npm package. Docker Hub tags are immutable by policy: every push gets a fresh version, `:latest` floats.

- **CLI release (automatic)** — when the Release workflow publishes `@docker-doctor/cli` to npm, it re-pins `spec.yaml`, bumps the kit's **patch** version, commits both back to `main`, and pushes `:<kit-version>` + `:latest`.
- **Kit-only change (automatic)** — bump `version:` in the same PR (minor for new behavior, patch for fixes; CI fails the PR if you forget) and merging publishes it. The manual **Kit Push** workflow (`Actions → Kit Push → Run workflow`) remains for backfills and deliberate overwrites (`force`).

Both paths authenticate with the `DOCKERHUB_USERNAME`/`DOCKERHUB_TOKEN` repository secrets.
