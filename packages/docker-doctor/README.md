# Docker Doctor

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

## API

```ts
import { discoverProject, toJsonReport } from "@docker-doctor/cli";
import type { Diagnostic } from "@docker-doctor/cli";
```

## Contributing

[MIT](LICENSE) and [Issues welcome!](https://github.com/PunGrumpy/docker-doctor/issues)
