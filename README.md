<picture>
  <source media="(prefers-color-scheme: dark)" srcset="https://docker-doctor.vercel.app/docker-doctor-readme-logo-dark.svg">
  <source media="(prefers-color-scheme: light)" srcset="https://docker-doctor.vercel.app/docker-doctor-readme-logo-light.svg">
  <img alt="Docker Doctor" src="https://docker-doctor.vercel.app/docker-doctor-readme-logo-light.svg" width="134" height="36">
</picture>

<br />

<status>
    <a href="https://www.npmjs.com/package/@docker-doctor/cli"><picture><source media="(prefers-color-scheme: dark)" srcset="https://shieldcn.dev/npm/@docker-doctor/cli.svg?size=xs&amp;statusDot=true&amp;mode=dark"><img alt="badge" src="https://shieldcn.dev/npm/@docker-doctor/cli.svg?size=xs&amp;statusDot=true&amp;mode=light"></picture></a>
    <a href="https://www.npmjs.com/package/@docker-doctor/cli"><picture><source media="(prefers-color-scheme: dark)" srcset="https://shieldcn.dev/npm/dm/@docker-doctor/cli.svg?size=xs&amp;statusDot=true&amp;mode=dark"><img alt="badge" src="https://shieldcn.dev/npm/dm/@docker-doctor/cli.svg?size=xs&amp;statusDot=true&amp;mode=light"></picture></a>
    <a href="https://github.com/PunGrumpy/docker-doctor"><picture><source media="(prefers-color-scheme: dark)" srcset="https://shieldcn.dev/github/PunGrumpy/docker-doctor/license.svg?size=xs&amp;statusDot=true&amp;mode=dark"><img alt="badge" src="https://shieldcn.dev/github/PunGrumpy/docker-doctor/license.svg?size=xs&amp;statusDot=true&amp;mode=light"></picture></a>
</status>

Your Dockerfiles are probably wrong. Docker Doctor finds out why.

Docker Doctor is an opinionated static analysis tool for Dockerfile and Docker Compose files. It scans your project, runs 29 rules across security, performance, best practices, Compose, and image size — then gives you a health score and fix guidance.

Works with any project that uses Docker.

[Website →](https://docker-doctor.vercel.app)

## What it catches

The most common finding: an install that sits below the source copy, so editing any file reruns it.

```dockerfile
FROM node:22-slim
WORKDIR /app
COPY . .
RUN npm ci
CMD ["node", "server.js"]
```

```text
⚠ WARN [docker-doctor/order-layers]:4
      3 │ COPY . .
>     4 │ RUN npm ci
      5 │ CMD ["node", "server.js"]

  Running package installation command 'npm ci' after copying application files (at line 3). This invalidates the cache on any code changes.
  Help: Copy dependency definition files (like package.json, lockfiles) and run install commands BEFORE copying the rest of the application source code.
```

Manifest first, install, then the source — plus a `.dockerignore`, so a stray log file or a local `node_modules` cannot invalidate that layer either:

```dockerfile
FROM node:22-slim
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
CMD ["node", "server.js"]
```

Four lines reordered and one new file takes that Dockerfile from `77` to `87`, with the Performance category down to zero.

## Install

### 1. Quick start

```bash
npx @docker-doctor/cli@latest
```

### 2. Install for agents

Once you have an audit, install the skill so your coding agent learns the `/docker-doctor` triage workflow and can fix the issues for you:

```bash
npx @docker-doctor/cli@latest install
```

Works with Claude Code, Cursor, Codex, OpenCode, and many more. After an interactive scan finds issues, Docker Doctor also offers to hand them straight to an agent detected on your machine. Add `--global` to install the skill once for your whole machine instead of the current project.

Prefer plugins? This repository is also a Claude Code plugin marketplace and ships a Cursor plugin — both bundle all three skills (`docker-doctor`, `docker-author`, `improve-docker`) and update with the repo:

```text
/plugin marketplace add PunGrumpy/docker-doctor
/plugin install docker-doctor@docker-doctor
```

[Rules reference →](https://docker-doctor.vercel.app/docs/reference/rules)

### 3. Run in Docker Sandboxes

Running coding agents unattended in [Docker Sandboxes](https://www.docker.com/products/docker-sandboxes/)? The Docker Doctor kit preinstalls the CLI and skill in every sandbox and tells the agent to lint its own Dockerfile and Compose changes before committing:

```bash
sbx run --kit docker.io/pungrumpy/docker-doctor-kit:latest claude
```

See [`kits/docker-doctor`](https://github.com/PunGrumpy/docker-doctor/tree/main/kits/docker-doctor) for what the kit installs and how it works.

### 4. Run in CI

The GitHub Action (`PunGrumpy/docker-doctor`) scans every pull request and posts a sticky summary comment — advisory by default, with an opt-in gate. See the [GitHub Actions guide](https://docker-doctor.vercel.app/docs/guides/github-actions) for setup, inputs, and gating.

### 5. Configure

```ts
// docker-doctor.config.ts
import type { DockerDoctorConfig } from "@docker-doctor/cli";

export default {
  rules: {
    "docker-doctor/no-root-user": "error",
  },
} satisfies DockerDoctorConfig;
```

Prefer YAML? `docker-doctor.config.yaml` works too, with editor autocomplete via `# yaml-language-server: $schema=https://docker-doctor.vercel.app/schema.json`. A `defineConfig` helper is also exported for projects with `@docker-doctor/cli` installed — see the [configuration docs](https://docker-doctor.vercel.app/docs/reference/configuration).

## How the score works

Every scan produces a 0-100 health score alongside a label (`Excellent 🏆`, `Good ✅`, `Needs Work ⚠️`, `Critical 🚨`).

Each diagnostic adds a penalty based on severity:

| Severity  | Penalty |
| --------- | ------- |
| `error`   | 10      |
| `warning` | 4       |
| `info`    | 1       |

The penalties are summed, then the score is computed as an asymptotic decay curve rather than a simple subtraction:

```
score = round(100 * e^(-penalty / K))   // K = 70
```

A perfect project (no diagnostics) always scores exactly 100. As penalty increases, the score keeps decreasing — it approaches 0 but never gets stuck there, so the score stays meaningful (and can still register improvement) even on projects with a lot of findings. `K = 70` was chosen so a single warning (penalty 4) still lands around 94 — comfortably inside the `Excellent` bucket — while errors and repeated warnings continue to meaningfully erode the score.

The label thresholds are unchanged: `>= 90` Excellent, `>= 75` Good, `>= 50` Needs Work, otherwise Critical.

## API

```ts
import { discoverProject, toJsonReport } from "@docker-doctor/cli";
import type { Diagnostic } from "@docker-doctor/cli";
```

## Contributing

[MIT](LICENSE) and [Issues welcome!](https://github.com/PunGrumpy/docker-doctor/issues)
