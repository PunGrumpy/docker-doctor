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

Docker Doctor is an opinionated static analysis tool for Dockerfile and Docker Compose files. It scans your project, runs 25 rules across security, performance, best practices, Compose, and image size — then gives you a health score and fix guidance.

Works with any project that uses Docker.

[Website →](https://docker-doctor.vercel.app)

## Install

### 1. Quick start

```bash
npx @docker-doctor/cli@latest
```

One scan gives you a category summary and a health score:

```text
  All 9 issues

  Security › 2 issues
  Performance › 2 issues
  Best Practices › 3 issues
  Compose › 0 issues
  Image Size › 2 issues

     .      68 / 100 Needs Work ⚠️
   .---.    ██████████████████████████████████░░░░░░░░░░░░░░░░
  ( • • )>  Docker Doctor
   \___/
```

Add `--verbose` and every finding shows the offending line and how to fix it:

```text
  ⚠ WARN [docker-doctor/order-layers]:7
  >     7 │ RUN npm install

    Running package installation command 'npm install' after copying
    application files (at line 5). This invalidates the cache on any
    code changes.
    Help: Copy dependency definition files (like package.json, lockfiles)
    and run install commands BEFORE copying the rest of the application
    source code.
```

### 2. Install for agents

Once you have an audit, install the skill so your coding agent learns the `/docker-doctor` triage workflow and can fix the issues for you:

```bash
npx @docker-doctor/cli@latest install
```

Works with Claude Code, Cursor, Codex, OpenCode, and many more. After an interactive scan finds issues, Docker Doctor also offers to hand them straight to an agent detected on your machine.

[Rules reference →](https://docker-doctor.vercel.app/docs/reference/rules)

### 3. Run in CI

The CLI is non-interactive when stdin isn't a TTY, and two flags make it pipeline-friendly: `--json` emits a machine-readable report, `--score` prints just the numeric score.

```bash
# Machine-readable report as a build artifact
npx @docker-doctor/cli@latest --json > docker-doctor-report.json

# Fail the build below a minimum health score
test "$(npx @docker-doctor/cli@latest --score)" -ge 75
```

Prefer not to write the workflow yourself? Docker Doctor offers to set up a GitHub Actions workflow for you after your first interactive scan.

### 4. Configure

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

Everything the CLI does is exported as plain functions, so you can build your own tooling on top:

```ts
import { readFile } from "node:fs/promises";

import {
  calculateScore,
  discoverProject,
  parseDockerfile,
  runDockerfileRules,
} from "@docker-doctor/cli";

const project = await discoverProject(".");

const file = project.dockerfiles[0];
const instructions = parseDockerfile(await readFile(file, "utf8"));
const diagnostics = runDockerfileRules(
  instructions,
  file,
  project.dockerignores ?? []
);

const { score, label } = calculateScore(diagnostics);
console.log(`${score}/100 (${label})`);
```

Also exported: `parseCompose` and `runComposeRules` for Compose files, `toJsonReport` for the JSON report shape, `defineConfig` and `loadConfig` for configuration, `allRules` and `findRule` for rule metadata, plus the `Diagnostic`, `DockerDoctorConfig`, `RuleCategory`, and `RuleSeverity` types.

## Contributing

[MIT](LICENSE) and [Issues welcome!](https://github.com/PunGrumpy/docker-doctor/issues)
