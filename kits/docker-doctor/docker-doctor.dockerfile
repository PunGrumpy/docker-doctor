# syntax=docker/dockerfile:1
# The overlay docker-doctor.yaml publishes: the pinned @docker-doctor/cli,
# a private Node runtime for it, and a launcher on PATH. It lands on an
# unknown base, so it asks that base for nothing beyond /bin/sh, glibc and
# libstdc++. The built-in agent kits on sbx 0.51 ship no Node at all.

# Node 22 is the oldest line the CLI's `engines` accepts (>=22.18.0) and the
# line its CI tests on. The tag floats within that line on purpose, so each
# kit release picks up the current Node 22 patch release.
ARG NODE_IMAGE=node:22-trixie-slim

# npm tarballs at build time. npm verifies content against the registry's
# sha512 integrity metadata, so the version pin pins content too. Every
# dependency is plain JavaScript, so this stage runs on the build platform
# and never under emulation.
FROM --platform=$BUILDPLATFORM ${NODE_IMAGE} AS cli
ARG DOCKER_DOCTOR_VERSION
RUN test -n "${DOCKER_DOCTOR_VERSION}" \
 && npm install --global --prefix /out/opt/docker-doctor --no-audit --no-fund \
      "@docker-doctor/cli@${DOCKER_DOCTOR_VERSION}" \
 && rm -rf /out/opt/docker-doctor/bin

# The Node binary for the target platform. Only the binary is copied.
FROM ${NODE_IMAGE} AS node

FROM scratch AS overlay
COPY --from=cli /out/opt/docker-doctor/lib /opt/docker-doctor/lib
COPY --from=node /usr/local/bin/node /opt/docker-doctor/node
# The CLI's own bin entry starts with `#!/usr/bin/env node`, which finds no
# node on these bases. The launcher names the bundled runtime instead.
COPY --chmod=0755 <<'LAUNCHER' /usr/local/bin/docker-doctor
#!/bin/sh
exec /opt/docker-doctor/node /opt/docker-doctor/lib/node_modules/@docker-doctor/cli/dist/cli.mjs "$@"
LAUNCHER

# Debian 13 with no Node, like the built-in agent bases. The checks run as
# the agent's uid with no network, so they prove the overlay works on its
# own and that `provides` names the CLI the layers hold.
FROM debian:trixie-slim AS verify
ARG DOCKER_DOCTOR_VERSION
COPY --from=overlay / /
USER 1000:1000
RUN --network=none set -eu; \
    if command -v node >/dev/null; then echo "verify base unexpectedly has node" >&2; exit 1; fi; \
    installed="$(docker-doctor --version)"; \
    test "$installed" = "${DOCKER_DOCTOR_VERSION}" \
      || { echo "expected ${DOCKER_DOCTOR_VERSION}, docker-doctor printed ${installed}" >&2; exit 1; }; \
    test -f /opt/docker-doctor/lib/node_modules/@docker-doctor/cli/skill/docker-doctor/SKILL.md

# Copying from `verify`, not `overlay`, is what makes BuildKit run the
# checks. A stage the final image does not depend on is never built.
FROM scratch
COPY --from=verify /opt/docker-doctor /opt/docker-doctor
COPY --from=verify /usr/local/bin/docker-doctor /usr/local/bin/docker-doctor
