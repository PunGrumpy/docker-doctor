# Docker Doctor kit

Static analysis for Dockerfiles and Docker Compose files, preinstalled in your sandbox. The agent lints its own Docker changes before committing them.

## Usage

Kit releases from 0.2.0 on need Docker Sandboxes (`sbx`) 0.51 or later. Pull it from Docker Hub, which `sbx` trusts by default. The tag is required, because `sbx` does not default to `:latest`:

```console
$ sbx run --kit docker.io/pungrumpy/docker-doctor-kit:latest claude
```

On `sbx` older than 0.51, use `0.1.14`, the last kit in the v2 format:

```console
$ sbx run --kit docker.io/pungrumpy/docker-doctor-kit:0.1.14 claude
```

From 0.51 on, the built-in agents such as `claude` are v3 kits, and `sbx` refuses to combine them with v1 or v2 kits ([release notes](https://github.com/docker/sbx-releases/releases/tag/v0.51.0)). So `0.1.14` works only on older releases, and the current kit works only on 0.51 and later.

From this repository (source of truth):

```console
$ sbx run --kit "git+https://github.com/PunGrumpy/docker-doctor.git#dir=kits/docker-doctor" claude
```

Or from a local checkout:

```console
$ sbx run --kit ./kits/docker-doctor/ claude
```

The kit is a `mixin`, so it composes with any agent sandbox (`claude`, `codex`, `cursor`, `opencode`, …).

## How it works

The kit is one OCI image in the [Kit Specification v3](https://github.com/docker/sandbox-kit-spec) format. `docker-doctor.yaml` declares what it offers, and `docker-doctor.dockerfile` builds what it ships.

1. **The CLI is in the image.** The kit carries a pinned `@docker-doctor/cli` under `/opt/docker-doctor`, its own Node.js 22 runtime, and a `docker-doctor` launcher in `/usr/local/bin`. The base image needs no Node.js, and the built-in agent images from `sbx` 0.51 on have none. Sandbox creation does not download the CLI from npm. npm verifies the tarball against the registry's sha512 integrity metadata when the kit is built, so the version pin also pins content. The kit declares `provides: docker-doctor@<cli version>`, and the build fails unless the installed CLI prints that version.
2. **The skill comes with it.** The `/docker-doctor` triage skill ships inside the CLI package, and the kit offers it to `sbx` as a bundled skill (`agent-skill@1`). `sbx` exposes it in every skills directory the agent's kit declares. On 2026-11-08 that is `~/.claude/skills` for `claude` and `~/.agents/skills` for `codex`. The other built-in agents declare none, so the agent instructions name the skill's path in the image instead. Nothing is written to your mounted workspace.
3. **The agent is told to use it.** `docker-doctor-context.md` adds a short instruction. After editing any Dockerfile or Compose file, the agent runs `docker-doctor` and fixes the diagnostics before committing.

The bundled Node.js binary needs glibc and libstdc++, which every built-in agent image has.

## Consuming from this repository

By default `sbx` only allows kit sources from `docker.io/`. To pull this kit straight from GitHub, allow the source once:

```console
$ sbx settings set kit.allowedSources '["docker.io/","github.com/PunGrumpy/"]'
```

## Cleanup

None. The kit adds files to the sandbox image only. Your mounted workspace and host stay untouched.

## Publishing (maintainers)

The kit versions independently of the CLI it installs. Its semver is `version` in `package.json`, managed by Changesets like the npm package. `bun run kit:sync` mirrors it into the `version:` line of `docker-doctor.yaml`, and mirrors the `@docker-doctor/cli` pin into the default of the `cliVersion` arg. Docker Hub tags are immutable by policy. Every push gets a fresh version, and `:latest` floats.

- **CLI release (automatic).** `package.json` pins `@docker-doctor/cli` to an exact version, so `changeset version` bumps the kit's **patch** version and the pin whenever the CLI is released, inside the same Version Packages PR. Merging it publishes the CLI to npm (Release workflow). Once that version resolves on npm, the Kit Push workflow builds the kit once and pushes `:<kit-version>` and `:latest` together, so both tags share a digest.
- **Kit-only change.** Add a changeset for `docker-doctor-kit` in the same PR (`bunx changeset`, minor for new behavior, patch for fixes). CI fails the PR if you forget. The bump lands through the Version Packages PR, and merging that publishes it. The manual **Kit Push** workflow (`Actions → Kit Push → Run workflow`) remains for backfills and deliberate overwrites (`force`).

Every pull request that touches the kit builds it for `linux/amd64` and `linux/arm64` without publishing. That build is the validation. The `sandbox-kit:3` frontend checks the descriptor, and the recipe checks that the CLI runs on a Debian 13 base with no Node.js and prints the pinned version. The Version Packages PR skips the build, because its CLI version reaches npm only when the PR merges.

To build the kit yourself (Docker with Buildx, and network access to npm and Docker Hub):

```console
$ cd kits/docker-doctor
$ docker buildx build . -f docker-doctor.yaml --output type=cacheonly
```

### Roll back `:latest`

If a release breaks, point `:latest` back at a known-good tag. Run **Kit Push** from the Actions tab with `latest_from` set to that tag. The workflow runs the command below and then checks that both tags serve the same manifest:

```console
$ docker buildx imagetools create --prefer-index=false \
    -t docker.io/pungrumpy/docker-doctor-kit:latest \
    docker.io/pungrumpy/docker-doctor-kit:0.1.14
```

`--prefer-index=false` copies the manifest as it is. Without it, Buildx wraps a single manifest in a new index, and the v2 kits are single manifests. Pointing `:latest` at `0.1.14` restores the kit for `sbx` before 0.51 and breaks it for 0.51 and later, so prefer the newest working v3 tag.

All Docker Hub writes authenticate with the `DOCKERHUB_USERNAME` and `DOCKERHUB_TOKEN` repository secrets.
