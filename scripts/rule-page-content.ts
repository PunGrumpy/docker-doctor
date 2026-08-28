/**
 * Authored long-form content for the per-rule docs pages, keyed by full rule
 * key. `scripts/generate-rules-doc.ts` merges these with the rule facts from
 * `@docker-doctor/core` (message, category, severity, help) and fails the
 * generation if a rule is missing an entry here — or an entry no longer
 * matches a shipped rule — so the pages can never drift from the CLI.
 *
 * Writing guidance: each page targets the search phrase a developer types
 * when they hit the problem ("docker container running as root", "npm
 * install reruns every docker build"), so the `description` and prose should
 * use those words, not our internal rule vocabulary.
 */

export interface RuleExample {
  code: string;
  lang: string;
  title?: string;
}

interface RulePageContent {
  /** Meta description — one sentence, phrased the way people search. */
  description: string;
  /** Opening markdown: the problem in the reader's words. */
  intro: string;
  /** Markdown body of the "Why it matters" section. */
  why: string;
  /** Example that triggers the rule. */
  bad: RuleExample;
  /** Example that passes the rule. */
  good: RuleExample;
  /** Scanned for the sample diagnostic when `bad` is not scannable input. */
  diagnosticSource?: RuleExample;
  /** Optional extra markdown appended after "How to fix it". */
  notes?: string;
}

export const rulePageContent: Record<string, RulePageContent> = {
  "docker-doctor/absolute-workdir": {
    bad: {
      code: "FROM node:22-slim\nWORKDIR app\nCOPY . .",
      lang: "dockerfile",
      title: "Dockerfile — destination depends on the base image",
    },
    description:
      "Relative WORKDIR paths in a Dockerfile resolve against whatever came before. Why WORKDIR should always be absolute.",
    good: {
      code: "FROM node:22-slim\nWORKDIR /app\nCOPY . .",
      lang: "dockerfile",
      title: "Dockerfile — destination is unambiguous",
    },
    intro:
      "`WORKDIR app` doesn't mean `/app` — it means \"`app` relative to wherever the previous `WORKDIR` (or the base image's default) left us\". The directory your files actually land in depends on instruction order and on the base image, and both can change under you. This rule flags `WORKDIR` instructions with relative paths.",
    notes:
      "`WORKDIR` also creates the directory if it doesn't exist, so there's never a need for `RUN mkdir -p /app` before it. Use `WORKDIR` for all directory context instead of `cd` inside `RUN` — that half of the pattern is covered by [avoid-run-cd](/docs/reference/rules/avoid-run-cd).",
    why: "Relative `WORKDIR`s compound: `WORKDIR app` after an inherited `WORKDIR /usr/src` puts you in `/usr/src/app`, and a later refactor or base-image bump silently moves every `COPY`, `RUN`, and `CMD` that follows. That failure mode — files in an unexpected directory, runtime `MODULE_NOT_FOUND` errors, nothing obviously wrong in the diff — costs an afternoon. `WORKDIR /app` costs one character and can never mean anything else.",
  },

  "docker-doctor/avoid-dev-dependencies": {
    bad: {
      code: 'FROM node:22-slim\nWORKDIR /app\nCOPY package*.json ./\nRUN npm install\nCOPY . .\nRUN npm run build\nCMD ["node", "dist/server.js"]',
      lang: "dockerfile",
      title: "Dockerfile — typescript and jest ship to production",
    },
    description:
      "npm devDependencies in a production Docker image: why npm install bloats the final stage and how --omit=dev fixes it.",
    good: {
      code: 'FROM node:22-slim AS build\nWORKDIR /app\nCOPY package*.json ./\nRUN npm ci\nCOPY . .\nRUN npm run build\n\nFROM node:22-slim\nWORKDIR /app\nCOPY package*.json ./\nRUN npm ci --omit=dev\nCOPY --from=build /app/dist ./dist\nUSER node\nCMD ["node", "dist/server.js"]',
      lang: "dockerfile",
      title: "Dockerfile — dev deps live and die in the build stage",
    },
    intro:
      "A plain `npm install` in your Dockerfile's final stage installs **everything** — TypeScript, test runners, linters, build plugins — into an image whose only job is to run the app. `devDependencies` are routinely several times the size of the runtime dependencies they sit next to. This rule flags full dependency installs in the production stage.",
    notes:
      "Equivalents across ecosystems: `yarn install --production`, `pnpm install --prod`, `pip install` from a runtime-only requirements file, `bundle install --without development test`. Also prefer `npm ci` over `npm install` in images — it installs exactly what the lockfile says and fails loudly on drift, which is precisely what you want from a reproducible build.",
    why: "Dev dependencies in production are dead weight with a blast radius: hundreds of megabytes per pull, plus hundreds of packages' worth of vulnerability-scanner findings and supply-chain exposure for tools that will never execute. The runtime stage should hold exactly the packages `require()`d at run time. Build-time tooling belongs in a build stage that gets discarded — the pattern described in [use-multi-stage](/docs/reference/rules/use-multi-stage).",
  },

  "docker-doctor/avoid-run-cd": {
    bad: {
      code: "FROM node:22-slim\nRUN cd /app && npm ci\nRUN npm run build   # runs in /, not /app — build fails",
      lang: "dockerfile",
      title: "Dockerfile — the cd is forgotten line to line",
    },
    description:
      "cd in a Dockerfile RUN doesn't persist to the next instruction. Use WORKDIR to change directories in Docker builds.",
    good: {
      code: "FROM node:22-slim\nWORKDIR /app\nRUN npm ci\nRUN npm run build",
      lang: "dockerfile",
      title: "Dockerfile — WORKDIR persists for every instruction after it",
    },
    intro:
      'Every `RUN` starts a fresh shell, so `RUN cd /app` changes directory for that one instruction and is forgotten by the next line — the most common "why is my file not where I put it" surprise in Dockerfile debugging. This rule flags `cd` used inside `RUN` to establish directory context.',
    notes:
      "A `cd` can be legitimate _within_ one compound command when you need a temporary directory change mid-pipeline (`RUN tar xzf src.tar.gz && cd src && make install && cd .. && rm -rf src`). The rule's target is `cd` standing in for `WORKDIR` — directory context that the next instruction depends on.",
    why: '`cd` inside `RUN` either does nothing beyond its own line (a standalone `RUN cd /app` is a pure no-op) or buries the directory context mid-command where readers and tools can\'t see it. `WORKDIR` is the Dockerfile-native way to say "operations happen here": it persists across all subsequent `RUN`, `COPY`, `CMD`, and `ENTRYPOINT` instructions, creates the directory if needed, and appears at the top level of the file where directory context belongs.',
  },

  "docker-doctor/clean-package-cache": {
    bad: {
      code: "FROM debian:12-slim\nRUN apt-get update && apt-get install -y curl",
      lang: "dockerfile",
      title: "Dockerfile — index cache committed into the layer",
    },
    description:
      "apt, apk and yum caches bloat Docker images unless removed in the same RUN layer. The cleanup pattern for each package manager.",
    good: {
      code: "FROM debian:12-slim\nRUN apt-get update \\\n  && apt-get install -y --no-install-recommends curl \\\n  && rm -rf /var/lib/apt/lists/*",
      lang: "dockerfile",
      title: "Dockerfile — layer committed already clean",
    },
    intro:
      "Package managers keep an index and download cache after installing — tens to hundreds of megabytes that a container image will never use. And because Docker layers are append-only, deleting the cache in a _later_ instruction removes nothing: the bytes are already committed. This rule flags package installs whose `RUN` doesn't clean the cache in the same layer.",
    notes:
      "The pattern per package manager:\n\n- **apt-get** — append `&& rm -rf /var/lib/apt/lists/*`\n- **apk** — use `apk add --no-cache <pkg>` (no cleanup step needed)\n- **dnf / yum** — append `&& dnf clean all` / `&& yum clean all`\n- **pip** — use `pip install --no-cache-dir <pkg>`\n- **npm** — prefer `npm ci`, which is cache-friendly; add `&& npm cache clean --force` after plain `npm install`",
    why: "This is the most common avoidable image bloat, and the layer mechanics make the intuitive fix wrong — a separate `RUN rm -rf /var/lib/apt/lists/*` line makes the image _larger_ (it adds a layer that merely hides files). The cleanup only counts if it happens inside the same `RUN` as the install, so the layer is committed already clean. Same principle behind [minimize-layers](/docs/reference/rules/minimize-layers), applied to the single worst offender.",
  },

  "docker-doctor/combine-apt-update-install": {
    bad: {
      code: "FROM debian:12-slim\nRUN apt-get update\nRUN apt-get install -y curl",
      lang: "dockerfile",
      title: "Dockerfile — update layer goes stale in cache",
    },
    description:
      "apt-get update and install in separate Docker RUN layers cause stale package caches and 404 errors. Why they must share one RUN.",
    good: {
      code: "FROM debian:12-slim\nRUN apt-get update \\\n  && apt-get install -y --no-install-recommends curl \\\n  && rm -rf /var/lib/apt/lists/*",
      lang: "dockerfile",
      title: "Dockerfile — index fetched, used, and removed in one layer",
    },
    intro:
      "`RUN apt-get update` on its own line looks harmless, but Docker caches it as a layer. On a later build, that cached — now weeks-old — package index is reused while `apt-get install` runs fresh, and it either installs outdated packages or fails with `404 Not Found` because the index points at package versions the mirror no longer serves. This rule flags `apt-get update` and `apt-get install` living in separate `RUN` instructions.",
    notes:
      "`--no-install-recommends` skips the recommended-package tree that quietly doubles install size, and the trailing `rm -rf /var/lib/apt/lists/*` removes the package index from the image — covered in depth by [clean-package-cache](/docs/reference/rules/clean-package-cache). All three habits belong in the same `RUN`.",
    why: 'The two commands are only correct as a unit: the update fetches the index, the install consumes it. Split across layers, Docker\'s cache can (and will) reuse one without the other — the classic "cached apt update" trap that makes builds fail mysteriously only on machines with an old build cache. Combining them in one `RUN` means the index is always exactly as fresh as the install that uses it, and lets you clean the index in the same layer so it never ships in the image.',
  },

  "docker-doctor/minimize-layers": {
    bad: {
      code: "FROM debian:12-slim\nRUN apt-get update\nRUN apt-get install -y curl\nRUN rm -rf /var/lib/apt/lists/*",
      lang: "dockerfile",
      title: "Dockerfile — cleanup in a later layer removes nothing",
    },
    description:
      "Too many RUN instructions bloat Docker images. When and how to combine consecutive RUN commands with && to reduce layers.",
    good: {
      code: "FROM debian:12-slim\nRUN apt-get update \\\n  && apt-get install -y --no-install-recommends curl \\\n  && rm -rf /var/lib/apt/lists/*",
      lang: "dockerfile",
      title: "Dockerfile — install and cleanup share one layer",
    },
    intro:
      "Every `RUN` instruction commits a layer, and a layer only ever _adds_ bytes — files deleted in a later layer are hidden, not removed. A Dockerfile written as a long list of small `RUN` steps accumulates layers (and often stray intermediate files) that the final image drags around forever. This rule flags runs of consecutive `RUN` instructions that could be one.",
    notes:
      "Don't over-correct into one giant `RUN` for the whole Dockerfile — that destroys build caching, because any change reruns everything. Group commands that belong to one logical step (install + cleanup, download + verify + extract), and keep steps that change at different rates in separate layers so the cache can work. See [order-layers](/docs/reference/rules/order-layers) for the ordering half of this trade-off.",
    why: "The classic trap is cleanup in a separate step: `RUN apt-get install …` followed by `RUN rm -rf /var/lib/apt/lists/*` removes nothing from the image — the files are already committed in the earlier layer, and the `rm` just masks them. Combining related commands into a single `RUN` means temporary files can be created and deleted inside one layer, and the image only keeps the end state. Fewer layers also means less metadata overhead and faster extraction on pull.",
  },

  "docker-doctor/no-add-remote": {
    bad: {
      code: "FROM debian:12-slim\nADD https://example.com/tool.tar.gz /tmp/tool.tar.gz\nRUN tar -xzf /tmp/tool.tar.gz -C /usr/local/bin && rm /tmp/tool.tar.gz",
      lang: "dockerfile",
      title: "Dockerfile — unverified remote ADD",
    },
    description:
      "Why ADD with a URL in a Dockerfile is a bad idea, and the curl/wget pattern to download files into an image instead.",
    good: {
      code: 'FROM debian:12-slim\nRUN curl -fsSL https://example.com/tool.tar.gz -o /tmp/tool.tar.gz \\\n  && echo "d3adb33f…  /tmp/tool.tar.gz" | sha256sum -c - \\\n  && tar -xzf /tmp/tool.tar.gz -C /usr/local/bin \\\n  && rm /tmp/tool.tar.gz',
      lang: "dockerfile",
      title: "Dockerfile — download, verify, extract, and clean in one layer",
    },
    intro:
      "`ADD https://…` downloads a file straight into an image layer. It looks convenient, but the download is unverified, never cache-busted correctly, and — unlike `ADD` with a local archive — a remote archive is **not** auto-extracted, so the compressed file itself lands in the layer. This rule flags every `ADD` whose source is a remote URL.",
    notes:
      "Because the download, checksum verification, extraction, and cleanup happen inside a single `RUN`, the archive never survives into any layer — the image only contains the extracted tool. The `rm` in the bad example above does _not_ achieve this: it removes the file in a later layer while the `ADD` layer still carries the full archive.",
    why: "Three separate problems stack up. **Integrity:** `ADD` gives you no place to verify a checksum, so you're trusting the remote server and the network path at every build. **Size:** the downloaded file is committed to its own layer; even if a later instruction deletes it, the bytes stay in the image history. **Caching:** Docker cannot tell whether the remote content changed, leading to stale-or-rebuilt-forever cache behavior. A `RUN curl` line fixes all three in one move.",
  },

  "docker-doctor/no-docker-socket-mount": {
    bad: {
      code: "services:\n  mcp-gateway:\n    image: docker/mcp-gateway:0.9.0\n    volumes:\n      - /var/run/docker.sock:/var/run/docker.sock",
      lang: "yaml",
      title: "compose.yaml — raw Docker socket bind mount",
    },
    description:
      "Bind-mounting /var/run/docker.sock into a Compose service hands the container root on the host. Safer alternatives for tools that need the Docker API.",
    good: {
      code: "services:\n  mcp-gateway:\n    image: docker/mcp-gateway:0.9.0\n    # Compose provisions scoped Docker API credentials for this service\n    use_api_socket: true",
      lang: "yaml",
      title: "compose.yaml — scoped API access via use_api_socket",
    },
    intro:
      "Mounting `/var/run/docker.sock` into a container is the standard trick for anything that needs to talk to Docker: CI runners, reverse proxies that watch containers, and increasingly AI-agent tooling like MCP gateways that launch tool containers on demand. It is also equivalent to giving that container root on the host, because the Docker API can start privileged containers, mount any host path, and read every volume. This rule flags any service whose `volumes` bind-mount the Docker socket, in either the short or long syntax.",
    notes:
      "If the service genuinely needs the Docker API, use a mechanism that limits what a compromised container can do:\n\n- **`use_api_socket: true`** (Compose ≥ 2.36): Compose mounts the API socket together with scoped credentials. Docker's own `compose-for-agents` examples use this for MCP gateways.\n- **A filtering socket proxy**: exposes only the API endpoints the client needs, such as read-only container listing.\n\nMounting the socket `:ro` does _not_ help. Writes go through the connected socket, not the file, so a read-only mount still allows every API call.",
    why: "The Docker daemon runs as root and its API has no notion of partial trust. Any client can do anything, including `docker run --privileged -v /:/host`, so a compromised process in a socket-mounted container escapes to the host in one API call. Agent stacks raise the stakes: an MCP gateway or agent runtime executes model-directed actions, so prompt injection anywhere in the toolchain becomes a path to that socket.",
  },

  "docker-doctor/no-plaintext-secrets": {
    bad: {
      code: "services:\n  agent:\n    image: my-agent:1.2.0\n    environment:\n      OPENAI_API_KEY: sk-proj-abc123\n      DB_PASSWORD: hunter2",
      lang: "yaml",
      title: "compose.yaml — credentials committed in plain text",
    },
    description:
      "API keys and passwords written literally in a Compose file end up in version control. Where to put Compose secrets instead: interpolation, env_file, or secrets.",
    good: {
      // oxlint-disable-next-line no-template-curly-in-string -- Compose interpolation syntax, shown literally
      code: "services:\n  agent:\n    image: my-agent:1.2.0\n    environment:\n      # resolved from the host environment / .env at compose up time\n      OPENAI_API_KEY: ${OPENAI_API_KEY}\n    env_file:\n      - .env.local # gitignored",
      lang: "yaml",
      title: "compose.yaml — values resolved outside the file",
    },
    intro:
      // oxlint-disable-next-line no-template-curly-in-string -- Compose interpolation syntax, shown literally
      "A Compose file is code: it gets committed, reviewed, forked, and pushed to template registries. A literal `OPENAI_API_KEY: sk-…` in `environment:` therefore publishes the credential to everyone with repo access, and to every clone, mirror, and backup, forever. This rule flags environment entries (map or list syntax) whose key looks like a credential (`PASSWORD`, `SECRET`, `TOKEN`, `API_KEY`, …) and whose value is a literal rather than a `${VAR}` interpolation.",
    notes:
      // oxlint-disable-next-line no-template-curly-in-string -- Compose interpolation syntax, shown literally
      "Pick the mechanism by how sensitive the value is:\n\n- **`${VAR}` interpolation**: Compose resolves it from the host environment or a `.env` file at `compose up` time; the compose file carries only the reference.\n- **`env_file`**: point it at a gitignored file to keep whole blocks of configuration out of version control.\n- **Compose `secrets`**: mounts the value as a file rather than an environment variable, which also keeps it out of `docker inspect` output and crash dumps.\n\nIf a real credential has already been committed, rotate it. Removing the line only hides it from the working tree, not from git history.",
    why: "Committed credentials are one of the most common real-world breach vectors, and compose files travel further than people expect: they get pasted into issues, copied into starter templates, and pushed to public forks. Agent stacks concentrate the risk, since one file often holds keys for a model provider, a search API, and a database at once. The rule only inspects the key name, so it cannot tell a real key from a placeholder; treat a hit on a placeholder as a prompt to switch to interpolation before the placeholder becomes real.",
  },

  "docker-doctor/no-privileged-service": {
    bad: {
      code: "services:\n  runner:\n    image: my-runner:2.1.0\n    privileged: true",
      lang: "yaml",
      title: "compose.yaml — full host access via privileged",
    },
    description:
      "privileged: true in Docker Compose disables nearly every container isolation mechanism. What it actually grants and the narrower alternatives.",
    good: {
      code: "services:\n  runner:\n    image: my-runner:2.1.0\n    # grant only what the service actually needs\n    cap_add:\n      - NET_ADMIN\n    devices:\n      - /dev/net/tun",
      lang: "yaml",
      title: "compose.yaml — specific capabilities and devices only",
    },
    intro:
      "`privileged: true` is the biggest hammer in the Compose vocabulary: it gives the container every Linux capability, access to every host device, and turns off the seccomp, AppArmor, and cgroup device protections that make a container a container. It usually enters a file as a workaround, because some device wouldn't open or some syscall was blocked, and then never leaves. This rule flags every service that sets it.",
    notes:
      "Almost every legitimate use has a narrower replacement:\n\n- **Network syscalls** (VPN, routing): `cap_add: [NET_ADMIN]`.\n- **One device**: `devices: [/dev/net/tun]` (or `/dev/dri`, `/dev/kvm`, …).\n- **GPU access for model inference**: `deploy.resources.reservations.devices` with the `gpu` capability, not `privileged`.\n- **Docker-in-Docker for CI**: prefer the host's socket via a scoped mechanism (see `no-docker-socket-mount`) or a rootless DinD setup.\n\nStart from nothing and add single capabilities until the service works; the final list is rarely more than two entries.",
    why: "A privileged container is not meaningfully contained: it can load kernel modules, talk to raw disks, and remount host filesystems. Root inside is root on the host, so compromise of the service becomes compromise of the machine and every other workload on it. The setting also hides the service's real requirements, so nobody can later reconstruct which capability it actually needed; an explicit `cap_add`/`devices` list is both safer and better documentation.",
  },

  "docker-doctor/no-root-user": {
    bad: {
      code: 'FROM node:22-slim\nWORKDIR /app\nCOPY . .\nRUN npm ci\nCMD ["node", "server.js"]',
      lang: "dockerfile",
      title: "Dockerfile — runs as root",
    },
    description:
      "Docker containers run as root by default. How to add a non-root USER to your Dockerfile and why it matters for container security.",
    good: {
      code: 'FROM node:22-slim\nWORKDIR /app\nCOPY . .\nRUN npm ci\nUSER node\nCMD ["node", "server.js"]',
      lang: "dockerfile",
      title: "Dockerfile — drops to a non-root user",
    },
    intro:
      "Unless a Dockerfile says otherwise, every process in the container runs as root. Most images never say otherwise: there is no `USER` instruction, so the app inherits root from the base image. This rule flags any Dockerfile whose final stage still runs as root — including the case where a `USER` instruction exists but sets `root` or UID `0`.",
    notes:
      "Official language images usually ship a ready-made unprivileged user: `node` in the Node.js images, `nobody` almost everywhere. If your base image has none, create one:\n\n```dockerfile\nRUN useradd --no-log-init -r appuser\nUSER appuser\n```\n\nSwitch users **after** the instructions that need root (package installs, `chown`), and remember that `USER` resets to root at every new `FROM` — the final stage needs its own `USER` line. If the app must bind a port below 1024, listen on a high port instead and map it (`-p 80:8080`).",
    why: "A container is not a security boundary on its own. If an attacker gets code execution inside a root container — through your app, a dependency, or a supply-chain compromise — they hold root on any file or volume the container can reach, and any kernel or runtime vulnerability becomes a path to root **on the host**. Dropping to an unprivileged user turns most of those escalations into dead ends, which is why it is the first hardening step every container security guide agrees on.",
  },

  "docker-doctor/no-secrets-in-env": {
    bad: {
      code: "FROM node:22-slim\nENV DATABASE_PASSWORD=sup3rs3cret\nARG NPM_TOKEN=npm_abc123",
      lang: "dockerfile",
      title: "Dockerfile — secret baked into the image",
    },
    description:
      "ENV and ARG values are baked into Docker image layers and readable with docker history. Where to put API keys and passwords instead.",
    good: {
      code: "FROM node:22-slim\n# Needed at build time? Use a BuildKit secret mount — never a layer:\nRUN --mount=type=secret,id=npmrc,target=/root/.npmrc npm ci",
      lang: "dockerfile",
      title: "Dockerfile — secret only exists during one RUN",
    },
    intro:
      "`ENV API_KEY=...` feels like configuration, but it is storage: the value is written into the image's metadata and distributed with every push and pull. `ARG` is no safer — build arguments are recorded in the layer history. Anyone who can pull the image can read them back with `docker history --no-trunc` or `docker inspect`. This rule flags `ENV` and `ARG` keys that look like credentials (`PASSWORD`, `SECRET`, `TOKEN`, `API_KEY`, …) with literal values.",
    notes:
      "Pick the mechanism by when the secret is needed:\n\n- **Run time** (database passwords, API keys): pass at startup — `docker run -e`, a Compose `env_file`, or your orchestrator's secret store (Docker/Kubernetes secrets). None of these touch the image.\n- **Build time** (private registry tokens): use a [BuildKit secret mount](https://docs.docker.com/build/building/secrets/) as above — the file is available during that single `RUN` and leaves no trace in any layer.\n\nIf a real secret has already been committed into an image, rotate it. Deleting the image or the `ENV` line later does not un-publish the layers.",
    why: "An image is an artifact, not a runtime. It gets pushed to registries, cached on CI runners, copied to laptops, and mirrored — every copy carries the secret, forever, in plain text. Leaked registry credentials are one of the most common causes of cloud compromises precisely because images travel further than the people who build them expect. A secret that reaches an image layer must be treated as leaked and rotated.",
  },

  "docker-doctor/no-version-key": {
    bad: {
      code: 'version: "3.8"\n\nservices:\n  web:\n    image: nginx:1.27-alpine',
      lang: "yaml",
      title: "compose.yaml — obsolete key, warning on every command",
    },
    description:
      "The version key in docker-compose.yml is obsolete and ignored. Why Compose warns about it and how to migrate.",
    good: {
      code: "services:\n  web:\n    image: nginx:1.27-alpine",
      lang: "yaml",
      title: "compose.yaml — services at the top level",
    },
    intro:
      '`version: "3.8"` at the top of a Compose file does nothing anymore. Compose v2 follows the unified [Compose Specification](https://compose-spec.io) and ignores the key entirely — recent versions print `the attribute `version` is obsolete` on every command. This rule flags Compose files that still declare it.',
    notes:
      "While updating, note the preferred filename is now `compose.yaml` (with `docker-compose.yml` kept for backwards compatibility), and the command is `docker compose` — the standalone `docker-compose` v1 binary is end-of-life.",
    why: "Beyond the warning noise, the key actively misleads: it suggests you're opting into a feature set, but the number has no effect — newer Compose features work regardless of what it says, so a reader trying to determine compatibility from `version: \"3.8\"` is reasoning from fiction. Removing the line loses nothing, silences the warning, and stops the file claiming something that isn't true.",
  },

  "docker-doctor/order-layers": {
    bad: {
      code: 'FROM node:22-slim\nWORKDIR /app\nCOPY . .\nRUN npm ci\nCMD ["node", "server.js"]',
      lang: "dockerfile",
      title: "Dockerfile — every code edit reruns npm ci",
    },
    description:
      "npm install reruns on every Docker build? Fix Dockerfile layer order so dependency installs cache until the lockfile actually changes.",
    good: {
      code: 'FROM node:22-slim\nWORKDIR /app\nCOPY package.json package-lock.json ./\nRUN npm ci\nCOPY . .\nCMD ["node", "server.js"]',
      lang: "dockerfile",
      title: "Dockerfile — npm ci caches until the lockfile changes",
    },
    intro:
      "If `COPY . .` sits above your install command, every source-file edit invalidates the copy layer — and everything after it, including the install. That is why `npm ci` (or `pip install`, or `bundle install`) reruns from scratch on every build even though the dependencies didn't change. This rule flags installs that run after the full application source has been copied.",
    notes:
      "The same pattern applies to every ecosystem: `requirements.txt` before `pip install`, `go.mod`/`go.sum` before `go mod download`, `Gemfile` before `bundle install`, `Cargo.toml` before the build. Pair it with a [`.dockerignore`](/docs/reference/rules/use-dockerignore) so stray files can't invalidate the copy layer either.",
    why: "Docker caches layers top-down: the first changed instruction invalidates everything below it. Dependency manifests change rarely; source files change constantly. Put the rarely-changing thing first — copy just the manifest and lockfile, install, _then_ copy the source — and dependency installation caches across builds. This one reordering routinely takes CI builds from minutes to seconds, and it costs four lines.",
  },

  "docker-doctor/pin-image-version": {
    bad: {
      code: "FROM node\nWORKDIR /app",
      lang: "dockerfile",
      title: "Dockerfile — floating base image",
    },
    description:
      "Why FROM node or FROM node:latest breaks reproducible Docker builds, and how to pin base image tags (or digests) properly.",
    good: {
      code: "FROM node:22.2.0-slim\nWORKDIR /app",
      lang: "dockerfile",
      title: "Dockerfile — pinned tag",
    },
    intro:
      '`FROM node` and `FROM node:latest` mean "whatever the registry serves today". The same Dockerfile produces different images on different days, so a build that passed CI last week can fail — or ship different behavior — this week without a single line changing. This rule flags any `FROM` that uses no tag or the `latest` tag.',
    notes:
      "How specific to pin is a spectrum:\n\n- `node:22-slim` — tracks patch releases automatically; fine for most apps.\n- `node:22.2.0-slim` — exact version; rebuilds are stable until you bump it.\n- `node:22.2.0-slim@sha256:…` — digest-pinned; byte-for-byte immutable, the strictest supply-chain posture.\n\nWhichever you choose, let a bot (Renovate, Dependabot) propose the bumps so pinning doesn't decay into running years-old bases.",
    why: 'Unpinned bases break the core promise of a Dockerfile: reproducibility. Debugging becomes guesswork ("it works on my rebuild"), rollbacks stop being rollbacks because rebuilding an old commit pulls a new base, and you silently absorb every change the upstream image publishes — including breaking ones and, in a registry-compromise scenario, malicious ones. Pinning turns base-image updates into a reviewable diff instead of a background surprise.',
  },

  "docker-doctor/pin-service-image": {
    bad: {
      code: "services:\n  web:\n    image: nginx\n  cache:\n    image: redis:latest",
      lang: "yaml",
      title: "compose.yaml — images that mean something different every pull",
    },
    description:
      "Compose services with an untagged or :latest image deploy a different container every pull. How to pin service images to a tag or digest.",
    good: {
      code: "services:\n  web:\n    image: nginx:1.27-alpine\n  cache:\n    image: redis:7.4-alpine",
      lang: "yaml",
      title: "compose.yaml — every host resolves the same image",
    },
    intro:
      // oxlint-disable-next-line no-template-curly-in-string -- Compose interpolation syntax, shown literally
      '`image: nginx` and `image: redis:latest` both mean "whatever the registry serves today". In a Compose file that\'s worse than in a Dockerfile, because the file _is_ the deployment: two hosts running the same file can silently run different software, and so can one host after a reboot pulls fresh. This rule flags service images with no tag or with the mutable `latest` tag. Services built from a local `build:` context are skipped, as are `${VAR}`-templated references.',
    notes:
      "A version tag (`nginx:1.27-alpine`) is the practical default: readable, and mutated rarely enough for most services. For supply-chain-sensitive deployments, pin the digest (`nginx:1.27-alpine@sha256:…`). A digest is immutable by construction, and the tag next to it stays as documentation. Renovate and Dependabot both understand Compose files, so pinned versions don't have to mean stale versions. The same reasoning for Dockerfile base images lives in `pin-image-version`.",
    why: "Unpinned images break the two properties a deployment file exists to provide. Reproducibility: \"works on staging\" means nothing if production pulled a different `latest` an hour later. Rollback: re-deploying yesterday's compose file after a bad release still pulls today's image, so the rollback undoes nothing. Pinning makes the file's git history an accurate record of what actually ran, which is also what an incident review needs.",
  },

  "docker-doctor/prefer-copy-over-add": {
    bad: {
      code: "FROM node:22-slim\nWORKDIR /app\nADD package.json ./\nADD src/ ./src/",
      lang: "dockerfile",
      title: "Dockerfile — ADD used as a plain copy",
    },
    description:
      "COPY vs ADD in a Dockerfile: why COPY is the right default and the one case where ADD is actually the correct tool.",
    good: {
      code: "FROM node:22-slim\nWORKDIR /app\nCOPY package.json ./\nCOPY src/ ./src/",
      lang: "dockerfile",
      title: "Dockerfile — COPY states exactly what happens",
    },
    intro:
      "`COPY` and `ADD` both copy files into the image, but `ADD` carries hidden extra behavior: it auto-extracts local tar archives and can fetch remote URLs. Using `ADD` for ordinary file copies means every reader has to stop and ask which of those behaviors you meant. This rule flags `ADD` instructions that are doing plain copies.",
    notes:
      "The one legitimate `ADD` use: extracting a **local** tar archive into the image in a single instruction (`ADD rootfs.tar.gz /`), where the auto-extraction is the point. For remote URLs, `ADD` is flagged separately by [no-add-remote](/docs/reference/rules/no-add-remote) — use `RUN curl` with checksum verification instead.",
    why: "The magic is the problem. `ADD app.tar.gz /opt/` silently unpacks the archive — if you wanted the archive itself, you shipped a surprise instead. An `ADD` of a directory behaves like `COPY`, so the reader can't tell intent from the instruction. Docker's own best-practice guidance is blunt about it: use `COPY` unless you specifically need `ADD`'s extraction. Explicit beats implicit in a file that builds your production artifact.",
  },

  "docker-doctor/prefer-slim-base": {
    bad: {
      code: "FROM node:22\nWORKDIR /app",
      lang: "dockerfile",
      title: "Dockerfile — ~1 GB of OS before the app starts",
    },
    description:
      "Docker image too big? Switching from full OS base images to slim, alpine, or distroless variants cuts hundreds of megabytes.",
    good: {
      code: "FROM node:22-slim\nWORKDIR /app",
      lang: "dockerfile",
      title: "Dockerfile — same runtime, ~75% smaller",
    },
    intro:
      "`FROM node:22` starts you at roughly a gigabyte before your app contributes a byte — the full image ships compilers, version control, and an entire development userland your service will never call. This rule suggests base image variants that start from what the app needs instead: `-slim`, `-alpine`, or distroless.",
    notes:
      "Choosing between the variants:\n\n- **`-slim`** — same distro and libc, minimal package set. The safe default; native modules keep working.\n- **`-alpine`** — smallest mainstream option, but musl libc instead of glibc, which occasionally bites native dependencies.\n- **Distroless** (`gcr.io/distroless/*`) — no shell, no package manager, nothing but the runtime. Smallest attack surface; best applied as the final stage of a [multi-stage build](/docs/reference/rules/use-multi-stage).\n\nIf a build tool is missing in a slim base, install it in the build stage — not by retreating to the full image for production.",
    why: "Every megabyte in the base is pulled on every deploy, stored in every registry copy, scanned by every vulnerability scan — and every package is attack surface and CVE noise regardless of whether your app uses it. The bulk of most images' vulnerability-report volume comes from OS packages the application never touches. Slimmer bases mean faster pulls and cold starts, cheaper storage, and dramatically shorter scan reports.",
  },

  "docker-doctor/require-healthcheck": {
    bad: {
      code: 'FROM node:22-slim\nWORKDIR /app\nCOPY . .\nRUN npm ci\nCMD ["node", "server.js"]',
      lang: "dockerfile",
      title: "Dockerfile — 'running' is the only signal",
    },
    description:
      "Docker HEALTHCHECK examples and why containers without one report as running even when the app inside is dead.",
    good: {
      code: 'FROM node:22-slim\nWORKDIR /app\nCOPY . .\nRUN npm ci\nHEALTHCHECK --interval=30s --timeout=3s --start-period=10s --retries=3 \\\n  CMD curl -f http://localhost:3000/health || exit 1\nCMD ["node", "server.js"]',
      lang: "dockerfile",
      title: "Dockerfile — Docker probes the app itself",
    },
    intro:
      'Without a `HEALTHCHECK`, Docker\'s definition of a healthy container is "the process has not exited". An app that is deadlocked, out of database connections, or returning 500s on every request still shows `Up 3 hours`. This rule suggests adding a `HEALTHCHECK` instruction so the runtime can actually see whether the app works.',
    notes:
      "The check must exist in the image — slim bases often lack `curl`, so either install it, use `wget --spider -q`, or ship a tiny built-in prober (for Node, a five-line script using `fetch` avoids any extra package). Keep the endpoint cheap and honest: it should verify the app can do real work, not just that the HTTP server accepts connections. `--start-period` gives slow-booting apps grace before failures count.",
    why: 'Health status is what turns Docker from "process supervisor" into something operationally useful: `docker ps` shows `(healthy)`/`(unhealthy)`, restart tooling and orchestrators can replace containers that stopped serving, and Compose\'s `depends_on: condition: service_healthy` — see [use-depends-on-condition](/docs/reference/rules/use-depends-on-condition) — can hold dependents until a service is genuinely ready rather than merely started. None of that works on a container that never defines what healthy means.',
  },

  "docker-doctor/require-labels": {
    bad: {
      code: 'FROM node:22-slim\nWORKDIR /app\nCOPY . .\nCMD ["node", "server.js"]',
      lang: "dockerfile",
      title: "Dockerfile — anonymous image",
    },
    description:
      "OCI image labels: using LABEL org.opencontainers.image.* to link a Docker image back to its source repo, revision, and license.",
    good: {
      code: 'FROM node:22-slim\nLABEL org.opencontainers.image.source="https://github.com/acme/api" \\\n      org.opencontainers.image.description="Acme API server" \\\n      org.opencontainers.image.licenses="MIT"\nWORKDIR /app\nCOPY . .\nCMD ["node", "server.js"]',
      lang: "dockerfile",
      title: "Dockerfile — image carries its provenance",
    },
    intro:
      "Six months from now, someone will be staring at an image in a registry asking: which repo builds this, which commit is it, who owns it? Without labels the answer is archaeology. This rule suggests adding `LABEL` metadata — ideally the standard `org.opencontainers.image.*` keys — so the image itself carries the answer.",
    notes:
      "Keep static labels (source, license, description) in the Dockerfile and inject per-build values at build time: `docker build --label org.opencontainers.image.revision=$GIT_SHA`. If you build with `docker/metadata-action` in GitHub Actions, the standard OCI labels are generated for you. The full key list lives in the [OCI image spec annotations](https://github.com/opencontainers/image-spec/blob/main/annotations.md).",
    why: "Labels are machine-readable provenance. Registries (GitHub Container Registry among them) read `org.opencontainers.image.source` to link an image to its repository; vulnerability scanners and SBOM tools pick up version and license labels; incident responders use `revision` to go from a running container to the exact commit. It's a few bytes of metadata that makes every downstream tool smarter, and CI can inject the dynamic values so they're never stale.",
  },

  "docker-doctor/require-resource-limits": {
    bad: {
      code: "services:\n  api:\n    image: acme/api:1.4.2",
      lang: "yaml",
      title: "compose.yaml — one leak can take down the host",
    },
    description:
      "Docker Compose services without memory or CPU limits can starve the host. How to set deploy.resources.limits.",
    good: {
      code: 'services:\n  api:\n    image: acme/api:1.4.2\n    deploy:\n      resources:\n        limits:\n          cpus: "1.0"\n          memory: 512M',
      lang: "yaml",
      title: "compose.yaml — the leak is contained at 512 MB",
    },
    intro:
      "By default a Compose service can use every byte of memory and every CPU cycle the host has. One service with a memory leak doesn't just die — it drags the whole machine down first, taking every co-located service with it. This rule flags services that define no resource limits.",
    notes:
      "`docker compose` applies `deploy.resources.limits` directly (no Swarm required). Size limits from observed usage plus real headroom — a limit that's too tight turns normal traffic spikes into OOM kills. Note that Java and Node runtimes size their heaps from the container limit only in recent versions; older runtimes may need explicit flags (`-Xmx`, `--max-old-space-size`) to match.",
    why: "Limits are the isolation part of running containers. With a memory limit, a leaking service is OOM-killed at its cap and restarts — see [require-restart-policy](/docs/reference/rules/require-restart-policy) — while its neighbors keep serving; without one, the _host_ OOM killer picks a victim, and it often picks wrong (your database, for instance). CPU limits likewise keep one busy-looping service from starving everything else. Setting limits also forces the question every production service should answer: how much is this supposed to use?",
  },

  "docker-doctor/require-restart-policy": {
    bad: {
      code: "services:\n  api:\n    image: acme/api:1.4.2",
      lang: "yaml",
      title: "compose.yaml — crash at 3 a.m., down until morning",
    },
    description:
      "Docker Compose services don't restart after a crash or reboot by default. Choosing between restart: always and unless-stopped.",
    good: {
      code: "services:\n  api:\n    image: acme/api:1.4.2\n    restart: unless-stopped",
      lang: "yaml",
      title: "compose.yaml — restarts on crash and after reboot",
    },
    intro:
      "The default restart policy is `no`: when a service crashes at 3 a.m. — or the host reboots after a power cut or kernel update — the container simply stays down until a human notices. This rule flags Compose services with no restart policy.",
    notes:
      "`on-failure[:max-retries]` restarts only on non-zero exits, useful for one-shot jobs that should retry a bounded number of times. Restart policies handle a _dead_ process; they can't see a process that's alive but broken — pair them with a [HEALTHCHECK](/docs/reference/rules/require-healthcheck) so unhealthy states are visible too. Docker restarts with exponential backoff, so a crash-looping service won't peg the host.",
    why: "Crashes are normal operation: OOM kills, unhandled exceptions, dropped database connections, host reboots. A restart policy is the difference between a 10-second blip and an outage that lasts until someone checks. `unless-stopped` is the policy that matches operational intent — it restarts on any crash and after reboot, but stays down when you _deliberately_ stopped the service (whereas `always` will resurrect it at the next daemon restart, surprising whoever stopped it for maintenance).",
  },

  "docker-doctor/sort-multiline-args": {
    bad: {
      code: "FROM debian:12-slim\nRUN apt-get update && apt-get install -y --no-install-recommends \\\n    git \\\n    curl \\\n    libpq-dev \\\n    ca-certificates \\\n    curl \\\n  && rm -rf /var/lib/apt/lists/*",
      lang: "dockerfile",
      title: "Dockerfile — is anything duplicated? Who can tell",
    },
    description:
      "Sorting multi-line package lists in a Dockerfile alphabetically: cleaner diffs, no duplicate packages, easier reviews.",
    good: {
      code: "FROM debian:12-slim\nRUN apt-get update && apt-get install -y --no-install-recommends \\\n    ca-certificates \\\n    curl \\\n    git \\\n    libpq-dev \\\n  && rm -rf /var/lib/apt/lists/*",
      lang: "dockerfile",
      title: "Dockerfile — sorted; the duplicate curl is now obvious to spot",
    },
    intro:
      "A long unsorted package list in a `RUN apt-get install` or `apk add` turns every change into a hunt: is `libpq-dev` already in here? Did two branches both append `git` at the end? This rule suggests keeping multi-line package lists sorted alphabetically.",
    why: "Sorted lists make duplicates impossible to miss, merge conflicts rarer (two branches appending to the same last line is the classic conflict), and reviews instant — a one-line diff in a sorted list is exactly the package that changed. It's the same reason import statements get sorted. Zero runtime effect, purely a maintainability win, and `docker-doctor` only asks for it once the list spans multiple lines.",
  },

  "docker-doctor/use-depends-on-condition": {
    bad: {
      code: "services:\n  web:\n    build: .\n    depends_on:\n      - db\n\n  db:\n    image: postgres:17-alpine",
      lang: "yaml",
      title: "compose.yaml — app starts before postgres accepts connections",
    },
    description:
      "docker compose depends_on doesn't wait for the database to be ready. Using condition: service_healthy to fix startup race conditions.",
    good: {
      code: 'services:\n  web:\n    build: .\n    depends_on:\n      db:\n        condition: service_healthy\n\n  db:\n    image: postgres:17-alpine\n    healthcheck:\n      test: ["CMD-SHELL", "pg_isready -U postgres"]\n      interval: 5s\n      timeout: 3s\n      retries: 5',
      lang: "yaml",
      title: "compose.yaml — app waits until postgres is actually ready",
    },
    intro:
      "Short-form `depends_on: [db]` controls start **order**, not readiness: Compose starts the app the instant the database _container_ exists — several seconds before the database inside it accepts connections. The app's first connection attempt fails, and you're in crash-loop-until-the-race-resolves territory. This rule flags short-form `depends_on` lists.",
    notes:
      "The conditions: `service_healthy` (wait for the healthcheck to pass — what you want for databases and queues), `service_started` (the old short-form behavior), and `service_completed_successfully` (wait for a one-shot task like a migration job to exit 0 — handy for `migrate → app` sequences). Startup ordering complements, but doesn't replace, connection retry logic in the app: services can still become unready _later_.",
    why: '"Web can\'t connect to postgres on `docker compose up`, but works after a restart" is one of the most-asked Compose questions, and this race is the answer. The fix is built in: give the dependency a `healthcheck` that verifies real readiness, and make the dependent wait with `condition: service_healthy`. Compose then holds the app until the database has _proven_ it accepts connections — no `sleep 10`, no wait-for-it scripts, no retry-loop scaffolding around startup.',
  },

  "docker-doctor/use-dockerignore": {
    bad: {
      code: "$ docker build .\n=> transferring context: 482.16MB   # node_modules, .git, logs — all of it\n=> [4/5] COPY . .                    # …and now it's in the image",
      lang: "text",
      title: "Build without .dockerignore",
    },
    description:
      "Missing .dockerignore? Why node_modules, .git and .env end up in your Docker image, slow down builds, and how to write one.",
    diagnosticSource: {
      code: 'FROM node:22-slim\nWORKDIR /app\nCOPY . .\nRUN npm ci\nCMD ["node", "index.js"]',
      lang: "dockerfile",
    },
    good: {
      code: "node_modules\n.git\ndist\n*.log\n.env*\nDockerfile\ncompose.yaml",
      lang: "text",
      title: ".dockerignore",
    },
    intro:
      "Without a `.dockerignore`, `docker build` ships your **entire** project directory to the daemon as build context — `node_modules`, `.git` history, logs, local `.env` files — and `COPY . .` happily bakes all of it into the image. This rule fires when a Dockerfile is not accompanied by a `.dockerignore` file.",
    notes:
      'Start from the entries above and add your ecosystem\'s equivalents (`__pycache__`, `target/`, `vendor/`, `.venv`). Ignoring `node_modules` is not optional polish — a host-platform `node_modules` copied into a Linux image is also a common source of "works locally, crashes in Docker" native-module bugs. The install should happen _inside_ the build, ordered for cache as described in [order-layers](/docs/reference/rules/order-layers).',
    why: "Three failures, one missing file. **Speed:** a multi-hundred-megabyte context is uploaded on every single build before the first instruction runs. **Cache:** `COPY . .` fingerprints everything it copies, so an updated log file or editor swap file invalidates the layer — and every layer after it — even though nothing meaningful changed. **Security:** `.env` files, credentials, and the full `.git` history quietly become part of an artifact that gets pushed to registries. A `.dockerignore` fixes all three and takes a minute to write.",
  },

  "docker-doctor/use-exec-form": {
    bad: {
      code: "FROM node:22-slim\nWORKDIR /app\nCOPY . .\nCMD node server.js",
      lang: "dockerfile",
      title: "Dockerfile — the shell eats SIGTERM",
    },
    description:
      "Docker container takes 10 seconds to stop? Shell form CMD swallows SIGTERM. How exec form fixes signal handling and graceful shutdown.",
    good: {
      code: 'FROM node:22-slim\nWORKDIR /app\nCOPY . .\nCMD ["node", "server.js"]',
      lang: "dockerfile",
      title: "Dockerfile — the app is PID 1 and receives signals",
    },
    intro:
      '`CMD node server.js` (shell form) doesn\'t run your app as PID 1 — it runs `/bin/sh -c "node server.js"`, and the shell becomes PID 1 with your app as its child. When Docker sends `SIGTERM` on `docker stop`, the shell receives it and does **not** forward it. Your app never hears the shutdown request. This rule flags shell-form `CMD` and `ENTRYPOINT` instructions.',
    notes:
      "Exec form is a JSON array, so it must use **double quotes**, and there is no shell: `$VAR`, pipes, and `&&` won't work inside it. If you genuinely need shell features at startup, wrap them in an entrypoint script that ends with `exec node server.js` — `exec` replaces the shell so the app still ends up as PID 1. Then make sure the app actually handles `SIGTERM`; PID 1 gets no default signal handlers.",
    why: 'The visible symptom is every `docker stop` and every rolling deploy hanging for the 10-second grace period and ending in `SIGKILL`. The invisible symptom is worse: your graceful-shutdown code — draining requests, closing database connections, flushing queues — never runs, because the process is killed, not asked to exit. Exec form (`CMD ["node", "server.js"]`) makes your app PID 1 so signals reach it directly.',
  },

  "docker-doctor/use-multi-stage": {
    bad: {
      code: 'FROM node:22\nWORKDIR /app\nCOPY package*.json ./\nRUN npm ci\nCOPY . .\nRUN npm run build\nCMD ["node", "dist/server.js"]',
      lang: "dockerfile",
      title: "Dockerfile — build tools ship to production",
    },
    description:
      "How multi-stage Docker builds keep compilers and build tools out of your production image and cut image size dramatically.",
    good: {
      code: 'FROM node:22 AS build\nWORKDIR /app\nCOPY package*.json ./\nRUN npm ci\nCOPY . .\nRUN npm run build\n\nFROM node:22-slim\nWORKDIR /app\nCOPY package*.json ./\nRUN npm ci --omit=dev\nCOPY --from=build /app/dist ./dist\nUSER node\nCMD ["node", "dist/server.js"]',
      lang: "dockerfile",
      title: "Dockerfile — build stage discarded, runtime stays clean",
    },
    intro:
      "A single-stage Dockerfile ships everything the build needed: compilers, dev dependencies, source code, package-manager caches. None of that runs in production — it just rides along in every pull. This rule suggests splitting build and runtime into separate stages when a Dockerfile shows build activity but only one `FROM`.",
    notes:
      "Everything in the `build` stage — dev dependencies, source, caches — is discarded; only what the final stage explicitly copies survives. For compiled languages the gap is even larger: a Go or Rust binary can run `FROM gcr.io/distroless/static`, taking the image from gigabytes to tens of megabytes.",
    why: "The runtime image should contain the app and its runtime, nothing else. Multi-stage builds get you there without shell gymnastics: one stage has the full toolchain, the final stage starts from a clean base and `COPY --from` pulls in only the built artifacts. The payoff is smaller images (often by hundreds of megabytes), faster pulls and cold starts, and a much smaller attack surface — a compiler in a production container only ever helps an attacker.",
  },

  "docker-doctor/use-pipefail": {
    bad: {
      code: "FROM debian:12-slim\nRUN curl -fsSL https://example.com/install.sh | sh",
      lang: "dockerfile",
      title: "Dockerfile — a failed curl still builds green",
    },
    description:
      "curl | sh in a Dockerfile succeeds even when curl fails. How set -o pipefail makes Docker RUN pipelines fail loudly.",
    good: {
      code: 'FROM debian:12-slim\nSHELL ["/bin/bash", "-o", "pipefail", "-c"]\nRUN curl -fsSL https://example.com/install.sh | sh',
      lang: "dockerfile",
      title: "Dockerfile — any failure in the pipe fails the build",
    },
    intro:
      "A shell pipeline's exit code is the exit code of its **last** command. So `RUN curl -fsSL https://example.com/install.sh | sh` succeeds as long as `sh` exits 0 — even if `curl` got a 404 and piped it nothing. The build goes green with the tool silently not installed. This rule flags `RUN` pipelines executed without `pipefail`.",
    notes:
      "`pipefail` is a bash/ash feature, and Debian-family images run `RUN` under `/bin/sh` (dash), which doesn't support it — hence the `SHELL` instruction in the fix. On Alpine, BusyBox ash supports it, so `RUN set -o pipefail && curl … | sh` works per-line without changing `SHELL`. Setting `SHELL` once at the top covers every subsequent `RUN` in the stage.",
    why: "Silent partial failure is the worst kind in a build: the image ships and the problem surfaces at run time, far from the line that caused it. With `set -o pipefail`, a failure anywhere in the pipeline fails the `RUN`, which fails the build — turning a production surprise into an immediate, pointing-at-the-right-line build error. One flag converts wrong-but-green into red.",
  },

  "docker-doctor/useradd-no-log-init": {
    bad: {
      code: "FROM debian:12-slim\nRUN useradd -u 100000 appuser\nUSER appuser",
      lang: "dockerfile",
      title: "Dockerfile — a high UID balloons the layer",
    },
    description:
      "useradd with a high UID can add gigabytes to a Docker image via /var/log/faillog. Why useradd needs --no-log-init in Dockerfiles.",
    good: {
      code: "FROM debian:12-slim\nRUN useradd --no-log-init -r appuser\nUSER appuser",
      lang: "dockerfile",
      title: "Dockerfile — accounting files never created",
    },
    intro:
      "`RUN useradd -u 100000 appuser` can silently add **gigabytes** to an image. `useradd` initializes the `/var/log/faillog` and `/var/log/lastlog` accounting files, which are indexed by UID — creating a high-UID user makes them enormous sparse files, and Docker's layer format stores sparse files at their full apparent size. This rule flags `useradd` calls without `--no-log-init`.",
    notes:
      "`-r` creates a system account (no home directory, UID from the system range), which is usually what a service container wants. On Alpine the equivalent tool is `adduser -S`, which doesn't have this problem. Creating a non-root user in the first place is the subject of [no-root-user](/docs/reference/rules/no-root-user).",
    why: "This is a genuine footgun (docker/docker#5419): the Dockerfile looks completely innocent, the build succeeds, and the image is mysteriously huge — nothing in the file hints that a login-accounting quirk from the 1990s is the cause. `--no-log-init` skips initializing those files, which containers never use anyway (nobody interactively logs into a container through the login subsystem). There is no downside; it's pure insurance.",
  },
};
