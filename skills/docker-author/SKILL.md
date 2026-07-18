---
name: docker-author
description: Use when writing, scaffolding, or refactoring a Dockerfile or Docker Compose file — "write me a Dockerfile", "containerize/dockerize this app", "add Docker", or editing an existing Dockerfile/compose.yaml. Applies production defaults (multi-stage, non-root, pinned slim base, layer caching, .dockerignore, healthcheck) and self-verifies with docker-doctor. Companion to the `docker-doctor` scan skill.
version: "1.0.0"
---

# Docker Author

Write Dockerfiles and Compose files that pass a `docker-doctor` scan on the first try. Every default below maps to a rule the scanner enforces — this skill front-loads them so the generated file starts at a high health score instead of being fixed afterward.

**The loop:** author → `npx @docker-doctor/cli@latest . --verbose` → fix anything flagged → aim for `Excellent 🏆` (score ≥ 90). Don't hand back a Dockerfile you haven't scanned.

## Production defaults (each maps to a docker-doctor rule)

Apply these when authoring. If you deviate, say why.

| Default | Rule it satisfies |
| --- | --- |
| **Multi-stage build** — a `build`/`deps` stage separate from the slim runtime stage | `use-multi-stage`, `avoid-dev-dependencies` |
| **Pin the base image** to a concrete tag (never `latest`, never bare) — prefer digest for reproducibility | `pin-image-version` |
| **Slim/alpine/distroless runtime base** (e.g. `node:22-alpine`, `python:3.12-slim`) | `prefer-slim-base` |
| **Run as non-root** — create a user and `USER node` / `USER 1000` before `CMD` | `no-root-user`, `useradd-no-log-init` |
| **No secrets in `ENV`/`ARG`** — pass at runtime or use `RUN --mount=type=secret` | `no-secrets-in-env` |
| **`COPY` not `ADD`** (except local tar auto-extract); never `ADD` a remote URL | `prefer-copy-over-add`, `no-add-remote` |
| **Cache-friendly layer order** — copy manifests + install deps _before_ copying source | `order-layers` |
| **One `RUN` per logical step**, `&&`-chained; `apt-get update && apt-get install` in the same layer | `minimize-layers`, `combine-apt-update-install`, `avoid-run-cd` |
| **Clean package caches in the same layer** (`rm -rf /var/lib/apt/lists/*`, `--no-cache`, `npm ci --omit=dev`) | `clean-package-cache` |
| **`SHELL ["/bin/bash", "-o", "pipefail", "-c"]`** before piped `RUN`s | `use-pipefail` |
| **Absolute `WORKDIR`** (e.g. `/app`), set once | `absolute-workdir` |
| **Exec-form `CMD`/`ENTRYPOINT`** — JSON array, so signals propagate | `use-exec-form` |
| **`HEALTHCHECK`** for long-running services | `require-healthcheck` |
| **OCI `LABEL`s** (`org.opencontainers.image.source`, `.title`, …) | `require-labels` |
| **Sorted multi-line args** (alphabetize package lists) | `sort-multiline-args` |
| **Ship a `.dockerignore`** (`.git`, `node_modules`, build output, secrets) | `use-dockerignore` |

Beyond the rules: enable **BuildKit** and use `RUN --mount=type=cache` for package managers (faster rebuilds without bloating layers) and `RUN --mount=type=secret` for build-time credentials (keeps them out of the image).

## Canonical multi-stage template (Node — adapt per stack)

```dockerfile
# syntax=docker/dockerfile:1
FROM node:22-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN --mount=type=cache,target=/root/.npm npm ci

FROM node:22-alpine AS build
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run build

FROM node:22-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production
LABEL org.opencontainers.image.source="https://github.com/acme/app"
COPY --from=build /app/dist ./dist
COPY --from=deps /app/node_modules ./node_modules
USER node
HEALTHCHECK --interval=30s --timeout=3s CMD wget -q --spider http://localhost:3000/health || exit 1
CMD ["node", "dist/server.js"]
```

## Compose defaults (each maps to a Compose rule)

| Default | Rule |
| --- | --- |
| **No top-level `version:` key** (obsolete in Compose v2) | `no-version-key` |
| **Resource limits** — `deploy.resources.limits` (cpus/memory) per service | `require-resource-limits` |
| **`restart:` policy** (`unless-stopped` / `on-failure`) | `require-restart-policy` |
| **`depends_on` with `condition: service_healthy`**, not the short list form | `use-depends-on-condition` |

## Verify before handing off

```bash
npx @docker-doctor/cli@latest . --verbose
```

Fix every `ERROR`, then `WARN`. If a flagged rule genuinely doesn't apply, don't silently ignore it — either explain the trade-off or configure it (see the `docker-doctor` skill's `references/explain.md`). Inside this repo, run `bun packages/docker-doctor/src/cli.ts .` instead of `npx`.
