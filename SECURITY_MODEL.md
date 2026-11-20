# Security model

This file describes who and what docker-doctor trusts, so security reviews and scans judge findings against it. To report a vulnerability, use GitHub's private advisory flow: https://github.com/PunGrumpy/docker-doctor/security/advisories/new

## System overview

Docker Doctor statically analyses Dockerfiles and Compose files. It ships as an npm CLI (`@docker-doctor/cli`, from `packages/docker-doctor` and `packages/core`), a GitHub Action (`action.yml`) and a Docker Sandbox kit (`kits/`).

## Components

| Component | Code | Distribution surface |
| --- | --- | --- |
| docker-doctor | `packages/core`, `packages/docker-doctor`, `action.yml`, `kits/` | npm package / GitHub Action |
| CI/release | `.github/workflows/*` | npm package / GitHub Action |

## Assets

- Secrets in the CI of Action users, above all `GITHUB_TOKEN`.
- Integrity of the published CLI, the Action and their release workflow.

Critical assets across the maintainer's projects, in the maintainer's words: secrets in CI of action users (Cursor API key, `GITHUB_TOKEN`); root privileges and network config on Macs running Peony; integrity of published npm packages and releases; pigo API availability; and the data of downstream apps that use the libraries (logs, vectors, LINE messages).

## Trust boundaries and entry points

- **Scanned repository → scanner**: Dockerfiles, Compose files and config may come from an untrusted pull request. `config/loader.ts` `import()`s a JS/TS config, which is code execution from the scanned repository.
- **Report → terminal and PR comment**: scanned file text is printed and posted, so escape sequences and markdown in it reach readers.
- **Action → GitHub**: the sticky PR comment and commit status use `GITHUB_TOKEN`; the `version` input installs the CLI from npm.
- **Agent handoff**: writes into the scanned checkout.

## Attackers that matter

- A contributor opening a malicious pull request against a repository that runs the Action or CLI.
- A supply-chain attacker targeting the release workflow or npm publish.

## Existing controls

- Inputs reach the Action through its own steps, not inlined into shell.

## Out of scope

- `apps/web` (docs site) and `packages/videos`.
- Across the maintainer's projects: docs and marketing sites, and bench and video packages.
