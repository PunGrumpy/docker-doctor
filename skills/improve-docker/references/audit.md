# Docker audit dimensions

Assess every discovered Dockerfile and Compose file across these five categories. Each lists the `docker-doctor` rules that give machine-verified evidence, plus the judgment calls the scanner can't make. Confirm everything at `file:line` before it becomes a plan.

## 1. Security

**Rules:** `no-root-user`, `no-secrets-in-env`, `pin-image-version`, `no-add-remote`.

**Beyond the rules:**

- Base image provenance — official/verified publisher? Known-vulnerable tag?
- Attack surface — is a full OS shipped where distroless/scratch would do?
- Build-time secrets leaking into layers (check for tokens in `ARG`, `COPY` of `.env`/`.npmrc`).
- Capabilities / privileged mode in Compose (`privileged: true`, `cap_add`).

## 2. Image Size

**Rules:** `prefer-slim-base`, `clean-package-cache`, `avoid-dev-dependencies`.

**Beyond the rules:**

- Is a multi-stage build used to keep build toolchains out of the runtime image?
- Build-context bloat — is `.dockerignore` actually excluding `node_modules`, `.git`, build output?
- Large `COPY . .` early in the file that busts cache and pulls in junk.

## 3. Performance (build & cache)

**Rules:** `use-multi-stage`, `order-layers`, `minimize-layers`, `use-dockerignore`.

**Beyond the rules:**

- Layer ordering — are dependency-install layers above source-copy layers so edits don't reinstall deps?
- BuildKit cache mounts (`RUN --mount=type=cache`) for package managers?
- Redundant/duplicated `RUN` steps that could chain.

## 4. Best Practices

**Rules:** `require-healthcheck`, `prefer-copy-over-add`, `use-exec-form`, `require-labels`, `combine-apt-update-install`, `use-pipefail`, `absolute-workdir`, `avoid-run-cd`, `sort-multiline-args`, `useradd-no-log-init`.

**Beyond the rules:**

- Signal handling — exec-form entrypoints + an init (`tini`) for PID 1 zombie reaping?
- Reproducibility — pinned dependency versions inside `RUN`, not just the base image.
- Documentation — OCI labels present and pointing at the real source repo.

## 5. Compose

**Rules:** `no-version-key`, `require-resource-limits`, `require-restart-policy`, `use-depends-on-condition`.

**Beyond the rules:**

- Networks & isolation — services on scoped networks, not all on default bridge.
- Named volumes vs bind mounts for stateful data; secrets via `secrets:` not `environment:`.
- Healthcheck definitions that `depends_on: condition: service_healthy` can actually key off.

---

**Leverage reminder:** severity from the scanner is _not_ priority. Rank each confirmed finding by impact ÷ effort. A public-facing image running as root (`no-root-user`, one-line fix) outranks shaving megabytes off an internal image.
