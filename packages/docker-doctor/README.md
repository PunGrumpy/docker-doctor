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

Docker Doctor is an opinionated static analysis tool for Dockerfile and Docker Compose files. It scans your project, runs 21+ rules across security, performance, best practices, Compose, and image size — then gives you a health score and fix guidance.

Works with any project that uses Docker.

[Website →](https://docker-doctor.vercel.app)

## Install

### 1. Quick start

```bash
npx @docker-doctor/cli@latest
```

### 2. Browse rules

```bash
npx @docker-doctor/cli@latest rules list
npx @docker-doctor/cli@latest rules explain docker-doctor/no-root-user
```

### 3. Run in CI

Docker Doctor walks you through setting up a GitHub Actions workflow after your first scan:

```bash
npx @docker-doctor/cli@latest
```

### 4. Configure

```js
// docker-doctor.config.ts
export default {
  rules: {
    "docker-doctor/no-root-user": "error",
  },
};
```

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
