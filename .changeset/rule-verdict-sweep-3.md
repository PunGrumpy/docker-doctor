---
"@docker-doctor/cli": patch
---

Eight rule verdicts are corrected. Some files gain findings and some lose them.

These changes add findings. `avoid-dev-dependencies` reports `bun install` and `pnpm install` under `NODE_ENV=production`. Bun and pnpm 10 and later install devDependencies anyway. `clean-package-cache` reports an apt cache mount on `/var/cache/apt` alone, which leaves the package lists in the layer. `clean-package-cache` also reports an `apk add` whose only `--no-cache` belongs to another command, such as `pip install --no-cache-dir`. An `rm` inside a quoted string no longer counts as cleanup. `pin-image-version` reports `FROM golang AS golang`, which pulls the untagged image. `useradd-no-log-init` reports `useradd -gwheel`, where the `l` belongs to the group name.

These changes remove findings. `avoid-dev-dependencies` reads `NODE_ENV` from `ARG NODE_ENV=production`, alone or copied with `ENV NODE_ENV=$NODE_ENV`. `clean-package-cache` accepts `rm --recursive --force`. `sort-multiline-args` skips option values such as `apk add --virtual .build-deps` and `apt-get install -o Key=Value`. `useradd-no-log-init` accepts `useradd -lu1000`.
