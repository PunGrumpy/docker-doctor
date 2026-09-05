import { describe, test, expect } from "bun:test";

import {
  createComposeLocator,
  parseCompose,
} from "../src/parsers/compose-parser";
import { parseDockerfile } from "../src/parsers/dockerfile-parser";
import {
  combineAptUpdateInstall,
  usePipefail,
  PIPEFAIL_SETTING_RE,
  absoluteWorkdir,
  avoidRunCd,
  sortMultilineArgs,
  useraddNoLogInit,
  requireHealthcheck,
  preferCopyOverAdd,
  useExecForm,
  requireLabels,
} from "../src/rules/best-practices";
import {
  noVersionKey,
  pinServiceImage,
  requireResourceLimits,
  requireRestartPolicy,
  useDependsOnCondition,
} from "../src/rules/compose";
import {
  pinModelVersion,
  undefinedModelReference,
} from "../src/rules/compose-models";
import {
  noDockerSocketMount,
  noPlaintextSecrets,
  noPrivilegedService,
} from "../src/rules/compose-security";
import {
  preferSlimBase,
  cleanPackageCache,
  avoidDevDependencies,
} from "../src/rules/image-size";
import {
  orderLayers,
  useMultiStage,
  minimizeLayers,
  useDockerignore,
} from "../src/rules/performance";
import {
  noRootUser,
  pinImageVersion,
  noSecretsInEnv,
  noAddRemote,
} from "../src/rules/security";

describe("Security Rules", () => {
  test("no-root-user", () => {
    const withoutUser = parseDockerfile(`
      FROM node:22-alpine
      COPY . .
    `);
    const diags1 = noRootUser.check(withoutUser, "Dockerfile");
    expect(diags1).toHaveLength(1);
    expect(diags1[0].rule).toBe("docker-doctor/no-root-user");

    const withUserNode = parseDockerfile(`
      FROM node:22-alpine
      USER node
    `);
    const diags2 = noRootUser.check(withUserNode, "Dockerfile");
    expect(diags2).toHaveLength(0);

    const multiStageWithFinalUser = parseDockerfile(`
      FROM node:22-alpine AS build
      RUN npm run build
      FROM node:22-alpine
      COPY --from=build /app/dist ./dist
      USER node
      CMD ["node", "dist/index.js"]
    `);
    expect(
      noRootUser.check(multiStageWithFinalUser, "Dockerfile")
    ).toHaveLength(0);
  });

  test("no-root-user detects user:group root spellings", () => {
    for (const user of ["root:root", "0:0", "root:0", "0:1000"]) {
      const instructions = parseDockerfile(`
        FROM node:22-alpine
        USER ${user}
      `);
      expect(noRootUser.check(instructions, "Dockerfile")).toHaveLength(1);
    }

    const nonRoot = parseDockerfile(`
      FROM node:22-alpine
      USER node:node
    `);
    expect(noRootUser.check(nonRoot, "Dockerfile")).toHaveLength(0);
  });

  test("no-root-user inherits USER from a parent stage", () => {
    // Issue #88: FROM <previous stage> inherits that stage's image config,
    // USER included, so this must not report.
    const inherited = parseDockerfile(`
      FROM debian:bookworm-slim AS base
      USER app
      FROM base AS final
      CMD ["node", "x.js"]
    `);
    expect(noRootUser.check(inherited, "Dockerfile")).toHaveLength(0);

    const twoHop = parseDockerfile(`
      FROM debian:bookworm-slim AS a
      USER app
      FROM a AS b
      FROM b AS c
      CMD ["node", "x.js"]
    `);
    expect(noRootUser.check(twoHop, "Dockerfile")).toHaveLength(0);

    // A fresh base image resets to root even if an earlier stage set USER.
    const freshBase = parseDockerfile(`
      FROM debian:bookworm-slim AS base
      USER app
      FROM debian:bookworm-slim AS final
      CMD ["node", "x.js"]
    `);
    expect(noRootUser.check(freshBase, "Dockerfile")).toHaveLength(1);

    // Inheriting a non-root USER and then switching back to root reports.
    const resetToRoot = parseDockerfile(`
      FROM debian:bookworm-slim AS base
      USER app
      FROM base AS final
      USER root
    `);
    expect(noRootUser.check(resetToRoot, "Dockerfile")).toHaveLength(1);
  });

  test("no-root-user: multi-stage runtime without USER", () => {
    const multiStageRootRuntime = parseDockerfile(`
      FROM node:22-alpine AS build
      USER node
      RUN npm run build
      FROM node:22-alpine
      COPY --from=build /app/dist ./dist
      CMD ["node", "dist/index.js"]
    `);
    const diags3 = noRootUser.check(multiStageRootRuntime, "Dockerfile");
    expect(diags3).toHaveLength(1);
  });

  test("no-root-user: DHI runtime bases default to nonroot", () => {
    const dhiRuntime = parseDockerfile(`
      FROM dhi.io/python:3.13
      COPY . .
    `);
    expect(noRootUser.check(dhiRuntime, "Dockerfile")).toHaveLength(0);

    // -dev variants keep a shell and are not assumed nonroot.
    const dhiDev = parseDockerfile(`
      FROM dhi.io/python:3.13-dev
      COPY . .
    `);
    expect(noRootUser.check(dhiDev, "Dockerfile")).toHaveLength(1);

    // An explicit USER root on a DHI base still reports.
    const dhiRoot = parseDockerfile(`
      FROM dhi.io/python:3.13
      USER root
    `);
    expect(noRootUser.check(dhiRoot, "Dockerfile")).toHaveLength(1);

    // Build in a -dev stage, run in the runtime variant.
    const multiStage = parseDockerfile(`
      FROM dhi.io/python:3.13-dev AS build
      RUN pip install -r requirements.txt
      FROM dhi.io/python:3.13
      COPY --from=build /app /app
    `);
    expect(noRootUser.check(multiStage, "Dockerfile")).toHaveLength(0);
  });

  test("pin-image-version: scratch is not an unpinned image", () => {
    const counts = ["scratch", "SCRATCH", "Scratch"].map(
      (base) =>
        pinImageVersion.check(parseDockerfile(`FROM ${base}`), "Dockerfile")
          .length
    );
    expect(counts).toEqual([0, 0, 0]);
  });

  test("pin-image-version", () => {
    const unpinned = parseDockerfile(`
      FROM node
    `);
    const diags1 = pinImageVersion.check(unpinned, "Dockerfile");
    expect(diags1).toHaveLength(1);

    const latest = parseDockerfile(`
      FROM node:latest
    `);
    const diags2 = pinImageVersion.check(latest, "Dockerfile");
    expect(diags2).toHaveLength(1);

    const pinned = parseDockerfile(`
      FROM node:22.2.0-alpine
    `);
    const diags3 = pinImageVersion.check(pinned, "Dockerfile");
    expect(diags3).toHaveLength(0);

    const registryPortUntagged = parseDockerfile(`
      FROM myregistry.example.com:5000/team/app
    `);
    expect(
      pinImageVersion.check(registryPortUntagged, "Dockerfile")
    ).toHaveLength(1);

    const stageAlias = parseDockerfile(`
      FROM node:22-alpine AS build
      FROM build
    `);
    expect(pinImageVersion.check(stageAlias, "Dockerfile")).toHaveLength(0);

    const argDriven = parseDockerfile(`
      ARG NODE_IMAGE=node:22-alpine
      FROM \${NODE_IMAGE}
    `);
    expect(pinImageVersion.check(argDriven, "Dockerfile")).toHaveLength(0);

    const digestPinned = parseDockerfile(`
      FROM node@sha256:aaaabbbbccccdddd
    `);
    expect(pinImageVersion.check(digestPinned, "Dockerfile")).toHaveLength(0);
  });

  test("no-secrets-in-env", () => {
    const withSecret = parseDockerfile(`
      ENV DB_PASSWORD=my-secret-pass
    `);
    const diags = noSecretsInEnv.check(withSecret, "Dockerfile");
    expect(diags).toHaveLength(1);

    const withSpaceSecret = parseDockerfile(`
      ENV DB_PASSWORD my-secret-pass
    `);
    const diagsSpace = noSecretsInEnv.check(withSpaceSecret, "Dockerfile");
    expect(diagsSpace).toHaveLength(1);

    const withSpaceNormal = parseDockerfile(`
      ENV NORMAL_VAR my-value
    `);
    const diagsSpaceNormal = noSecretsInEnv.check(
      withSpaceNormal,
      "Dockerfile"
    );
    expect(diagsSpaceNormal).toHaveLength(0);

    const argPassthrough = parseDockerfile(`
      ARG API_KEY
      ENV API_KEY=\${API_KEY}
    `);
    expect(noSecretsInEnv.check(argPassthrough, "Dockerfile")).toHaveLength(0);

    const multipleNormalVars = parseDockerfile(`
      ENV NODE_ENV=production PORT=3000
    `);
    expect(noSecretsInEnv.check(multipleNormalVars, "Dockerfile")).toHaveLength(
      0
    );

    const awsSecretKey = parseDockerfile(`
      ENV AWS_SECRET_ACCESS_KEY=AKIAIOSFODNN7EXAMPLE
    `);
    expect(noSecretsInEnv.check(awsSecretKey, "Dockerfile")).toHaveLength(1);

    const apiKey = parseDockerfile(`
      ENV API_KEY=not-a-real-secret
    `);
    expect(noSecretsInEnv.check(apiKey, "Dockerfile")).toHaveLength(1);
  });

  test("no-secrets-in-env: AUTHOR is not a secret", () => {
    const authorNotSecret = parseDockerfile(`
      ENV AUTHOR=grumpy
    `);
    expect(noSecretsInEnv.check(authorNotSecret, "Dockerfile")).toHaveLength(0);
  });

  test("no-secrets-in-env: OAUTH_ISSUER_URL is not a secret", () => {
    const oauthUrlNotSecret = parseDockerfile(`
      ENV OAUTH_ISSUER_URL=https://example.com
    `);
    expect(noSecretsInEnv.check(oauthUrlNotSecret, "Dockerfile")).toHaveLength(
      0
    );
  });

  test("no-secrets-in-env: credential-free URLs are endpoints, not secrets", () => {
    const authUrl = parseDockerfile(`
      ENV AUTH_URL=http://auth:8080
      ENV TOKEN_ENDPOINT=https://id.example.com/oauth/token
    `);
    expect(noSecretsInEnv.check(authUrl, "Dockerfile")).toHaveLength(0);

    const urlWithUserinfo = parseDockerfile(`
      ENV DB_PASSWORD_URL=postgres://app:hunter2@db/app
    `);
    expect(noSecretsInEnv.check(urlWithUserinfo, "Dockerfile")).toHaveLength(1);
  });

  test("no-secrets-in-env: PGPASSWORD, APIKEY and PAT spellings", () => {
    const spellings = parseDockerfile(`
      ENV PGPASSWORD=hunter2
      ENV OPENAI_APIKEY=sk-proj-abc
      ENV GITHUB_PAT=ghp_abc
      ENV PATH=/usr/local/bin:/usr/bin
      ENV LOG_PATTERN=json
    `);
    const diags = noSecretsInEnv.check(spellings, "Dockerfile");
    expect(diags.map((d) => d.message)).toEqual([
      expect.stringContaining("'PGPASSWORD'"),
      expect.stringContaining("'OPENAI_APIKEY'"),
      expect.stringContaining("'GITHUB_PAT'"),
    ]);
  });

  test("no-add-remote", () => {
    const remoteAdd = parseDockerfile(`
        ADD https://example.com/file.txt /app/
      `);
    const diags1 = noAddRemote.check(remoteAdd, "Dockerfile");
    expect(diags1).toHaveLength(1);

    const localArchiveWithChown = parseDockerfile(`
      ADD --chown=node:node local-archive.tar.gz /app/
    `);
    expect(noAddRemote.check(localArchiveWithChown, "Dockerfile")).toHaveLength(
      0
    );
  });

  test("no-add-remote: remote URL with --chown flag", () => {
    const remoteAddWithChown = parseDockerfile(`
      ADD --chown=node:node https://example.com/file.txt /app/
    `);
    expect(noAddRemote.check(remoteAddWithChown, "Dockerfile")).toHaveLength(1);
  });
});

describe("Performance Rules", () => {
  test("order-layers", () => {
    const badOrder = parseDockerfile(`
      FROM node:22-alpine
      COPY . .
      RUN npm install
    `);
    const diags = orderLayers.check(badOrder, "Dockerfile");
    expect(diags).toHaveLength(1);
    expect(diags[0].rule).toBe("docker-doctor/order-layers");

    const goodOrder = parseDockerfile(`
      FROM node:22-alpine
      COPY package.json package-lock.json ./
      RUN npm install
      COPY . .
    `);
    expect(orderLayers.check(goodOrder, "Dockerfile")).toHaveLength(0);
  });

  test("order-layers: correct multi-stage build", () => {
    const correctMultiStage = parseDockerfile(`
      FROM node:22-alpine AS build
      COPY . .
      RUN npm run build
      FROM node:22-alpine
      COPY package.json ./
      RUN npm ci --omit=dev
    `);
    expect(orderLayers.check(correctMultiStage, "Dockerfile")).toHaveLength(0);
  });

  test("order-layers: /usr/src path is not a copy-all", () => {
    const usrSrcPath = parseDockerfile(`
      FROM node:22-alpine
      COPY /usr/src/lib /lib
      RUN npm ci
    `);
    expect(orderLayers.check(usrSrcPath, "Dockerfile")).toHaveLength(0);
  });

  test("use-multi-stage", () => {
    const singleStage = parseDockerfile(`
        FROM node:22
        RUN npm run build
      `);
    const diags1 = useMultiStage.check(singleStage, "Dockerfile");
    expect(diags1).toHaveLength(1);

    const realisticMultiStage = parseDockerfile(`
      FROM node:22-alpine AS build
      RUN npm run build
      FROM node:22-alpine
      COPY --from=build /app/dist ./dist
    `);
    expect(useMultiStage.check(realisticMultiStage, "Dockerfile")).toHaveLength(
      0
    );
  });

  test("minimize-layers", () => {
    const consecutive = parseDockerfile(`
        RUN step1
        RUN step2
        RUN step3
      `);
    const diags1 = minimizeLayers.check(consecutive, "Dockerfile");
    expect(diags1).toHaveLength(1);

    const combinedRun = parseDockerfile(`
      FROM node:22-alpine
      RUN apt-get update && apt-get install -y git && rm -rf /var/lib/apt/lists/*
    `);
    expect(minimizeLayers.check(combinedRun, "Dockerfile")).toHaveLength(0);
  });

  test("use-dockerignore", () => {
    const copyAll = parseDockerfile(`
      FROM node:22-alpine
      COPY . .
    `);
    const diags1 = useDockerignore.check(copyAll, "Dockerfile", {
      projectFiles: ["Dockerfile"],
    });
    expect(diags1).toHaveLength(1);

    const diags2 = useDockerignore.check(copyAll, "Dockerfile", {
      projectFiles: ["Dockerfile", ".dockerignore"],
    });
    expect(diags2).toHaveLength(0);

    const copyAllWithChown = parseDockerfile(`
      FROM node:22-alpine
      COPY --chown=node:node . .
    `);
    const diags3 = useDockerignore.check(copyAllWithChown, "Dockerfile", {
      projectFiles: ["Dockerfile", ".dockerignore"],
    });
    expect(diags3).toHaveLength(0);
  });

  test("use-dockerignore ignores stage-to-stage copies", () => {
    const stageCopy = parseDockerfile(`
      FROM node:22-alpine AS build
      FROM node:22-alpine
      COPY --from=build . ./
    `);
    expect(
      useDockerignore.check(stageCopy, "Dockerfile", { projectFiles: [] })
    ).toHaveLength(0);
  });
  test("use-dockerignore only accepts an adjacent or root .dockerignore", () => {
    const instructions = parseDockerfile(`
      FROM node:22-alpine
      COPY . .
    `);

    // An unrelated .dockerignore elsewhere in the monorepo must not satisfy it.
    expect(
      useDockerignore.check(instructions, "services/api/Dockerfile", {
        projectFiles: ["services/api/Dockerfile", "services/web/.dockerignore"],
      })
    ).toHaveLength(1);

    // Adjacent to the Dockerfile is fine.
    expect(
      useDockerignore.check(instructions, "services/api/Dockerfile", {
        projectFiles: ["services/api/Dockerfile", "services/api/.dockerignore"],
      })
    ).toHaveLength(0);

    // Scan root is fine (monorepo-root build context).
    expect(
      useDockerignore.check(instructions, "services/api/Dockerfile", {
        projectFiles: ["services/api/Dockerfile", ".dockerignore"],
      })
    ).toHaveLength(0);
  });
});

describe("Compose Rules", () => {
  test("no-version-key", () => {
    const composeContent = {
      services: {
        web: { image: "node:22" },
      },
      version: "3.8",
    };
    const diags = noVersionKey.check(composeContent, "compose.yml");
    expect(diags).toHaveLength(1);

    const realisticCompliant = {
      services: {
        db: { image: "postgres:16-alpine" },
        web: { image: "node:22-alpine" },
      },
    };
    expect(noVersionKey.check(realisticCompliant, "compose.yml")).toHaveLength(
      0
    );
  });

  test("compose diagnostics carry the line of the offending key", () => {
    const source = `version: "3.8"
services:
  web:
    image: node:22-alpine
    depends_on:
      - db
  db:
    image: postgres:16-alpine
    restart: unless-stopped
`;
    const composeContent = parseCompose(source, "compose.yml");
    const locate = createComposeLocator(source);
    const context = { locate };

    const versionDiags = noVersionKey.check(
      composeContent,
      "compose.yml",
      context
    );
    expect(versionDiags).toHaveLength(1);
    expect(versionDiags[0].line).toBe(1);

    const restartDiags = requireRestartPolicy.check(
      composeContent,
      "compose.yml",
      context
    );
    expect(restartDiags).toHaveLength(1);
    expect(restartDiags[0].line).toBe(3);

    const dependsDiags = useDependsOnCondition.check(
      composeContent,
      "compose.yml",
      context
    );
    expect(dependsDiags).toHaveLength(1);
    expect(dependsDiags[0].line).toBe(5);
  });

  test("compose line lookup degrades gracefully through YAML merge keys", () => {
    // `depends_on` on `web` only exists via the merge key, so there is no
    // concrete node to point at — the diagnostic falls back to the service.
    const source = `x-base: &base
  depends_on:
    - db
services:
  web:
    <<: *base
    image: node:22-alpine
    restart: unless-stopped
  db:
    image: postgres:16-alpine
    restart: unless-stopped
`;
    const composeContent = parseCompose(source, "compose.yml");
    const locate = createComposeLocator(source);

    const dependsDiags = useDependsOnCondition.check(
      composeContent,
      "compose.yml",
      { locate }
    );
    expect(dependsDiags).toHaveLength(1);
    expect(dependsDiags[0].line).toBe(5);
  });

  test("compose rules still work without a locator", () => {
    const composeContent = parseCompose(
      "services:\n  web:\n    image: node:22-alpine\n",
      "compose.yml"
    );
    const diags = requireRestartPolicy.check(composeContent, "compose.yml");
    expect(diags).toHaveLength(1);
    expect(diags[0].line).toBeUndefined();
  });

  test("require-resource-limits", () => {
    const composeContent = {
      services: {
        web: { image: "node:22" },
      },
    };
    const diags = requireResourceLimits.check(composeContent, "compose.yml");
    expect(diags).toHaveLength(1);

    const withLimits = {
      services: {
        web: {
          deploy: {
            resources: { limits: { cpus: "0.5", memory: "512M" } },
          },
          image: "node:22-alpine",
        },
      },
    };
    expect(requireResourceLimits.check(withLimits, "compose.yml")).toHaveLength(
      0
    );
  });

  test("require-restart-policy", () => {
    const withoutRestart = {
      services: {
        web: { image: "node:22" },
      },
    };
    const diags1 = requireRestartPolicy.check(withoutRestart, "compose.yml");
    expect(diags1).toHaveLength(1);

    const withRestart = {
      services: {
        web: { image: "node:22", restart: "always" },
      },
    };
    const diags2 = requireRestartPolicy.check(withRestart, "compose.yml");
    expect(diags2).toHaveLength(0);

    const withDeployRestartPolicy = {
      services: {
        web: {
          deploy: { restart_policy: { condition: "on-failure" } },
          image: "node:22-alpine",
        },
      },
    };
    expect(
      requireRestartPolicy.check(withDeployRestartPolicy, "compose.yml")
    ).toHaveLength(0);
  });

  test("require-restart-policy: no false positive when restart comes via merge key", () => {
    const content = `
x-base: &base
  restart: always
services:
  web:
    <<: *base
    image: nginx
    `;
    const composeContent = parseCompose(content, "compose.yml");
    const diags = requireRestartPolicy.check(composeContent, "compose.yml");
    expect(diags).toHaveLength(0);
  });

  test("a service with a null body is still checked", () => {
    const source =
      "services:\n  web:\n  db:\n    image: postgres:16-alpine\n    restart: unless-stopped\n";
    const composeContent = parseCompose(source, "compose.yml");
    const diags = requireRestartPolicy.check(composeContent, "compose.yml", {
      locate: createComposeLocator(source),
    });
    expect(diags).toHaveLength(1);
    expect(diags[0].message).toContain("'web'");
    expect(diags[0].line).toBe(2);

    expect(
      requireResourceLimits.check(composeContent, "compose.yml")
    ).toHaveLength(2);
  });

  test("use-depends-on-condition", () => {
    const shortForm = {
      services: {
        web: { depends_on: ["db"], image: "node:22" },
      },
    };
    const diags1 = useDependsOnCondition.check(shortForm, "compose.yml");
    expect(diags1).toHaveLength(1);

    const longForm = {
      services: {
        web: {
          depends_on: { db: { condition: "service_healthy" } },
          image: "node:22-alpine",
        },
      },
    };
    expect(useDependsOnCondition.check(longForm, "compose.yml")).toHaveLength(
      0
    );
  });
});

describe("Compose Rules — require-resource-limits", () => {
  test("service-level mem_limit / cpus satisfy the rule", () => {
    const composeContent = {
      services: {
        api: { cpus: 0.5, image: "acme/api:1.4.2", mem_limit: "512m" },
        quota: { cpu_quota: 50_000, image: "acme/worker:1.4.2" },
        unlimited: { image: "acme/web:1.4.2", mem_reservation: "256m" },
      },
    };
    const diags = requireResourceLimits.check(composeContent, "compose.yml");
    expect(diags).toHaveLength(1);
    expect(diags[0].message).toContain("'unlimited'");
  });
});

describe("Compose Rules — pin-service-image", () => {
  test("flags untagged and latest images, skips pinned/built/variable ones", () => {
    const source = `services:
  web:
    image: nginx
  cache:
    image: redis:latest
  db:
    image: postgres:16-alpine
  pinned:
    image: nginx@sha256:abc123
  built:
    build: .
    image: myapp
  templated:
    image: \${REGISTRY}/app:\${TAG}
`;
    const composeContent = parseCompose(source, "compose.yml");
    const diags = pinServiceImage.check(composeContent, "compose.yml", {
      locate: createComposeLocator(source),
    });
    expect(diags).toHaveLength(2);
    expect(diags[0].message).toContain("'web'");
    expect(diags[0].message).toContain("does not specify a tag");
    expect(diags[0].line).toBe(3);
    expect(diags[1].message).toContain("'cache'");
    expect(diags[1].message).toContain("'latest'");
    expect(diags[1].line).toBe(5);
  });

  test("works without a locator", () => {
    const diags = pinServiceImage.check(
      { services: { web: { image: "nginx" } } },
      "compose.yml"
    );
    expect(diags).toHaveLength(1);
    expect(diags[0].line).toBeUndefined();
  });
});

describe("Compose Security Rules", () => {
  test("no-privileged-service", () => {
    const source = `services:
  agent:
    image: myagent:1.0
    privileged: true
  web:
    image: nginx:1.27-alpine
`;
    const composeContent = parseCompose(source, "compose.yml");
    const diags = noPrivilegedService.check(composeContent, "compose.yml", {
      locate: createComposeLocator(source),
    });
    expect(diags).toHaveLength(1);
    expect(diags[0].message).toContain("'agent'");
    expect(diags[0].line).toBe(4);
  });

  test("no-privileged-service: privileged false or absent is clean", () => {
    const composeContent = {
      services: {
        web: { image: "nginx:1.27-alpine", privileged: false },
      },
    };
    expect(
      noPrivilegedService.check(composeContent, "compose.yml")
    ).toHaveLength(0);
  });

  test("no-docker-socket-mount: short and long volume syntax", () => {
    const source = `services:
  gateway:
    image: docker/mcp-gateway:1.0
    volumes:
      - /var/run/docker.sock:/var/run/docker.sock:ro
  agent:
    image: myagent:1.0
    volumes:
      - type: bind
        source: /var/run/docker.sock
        target: /var/run/docker.sock
  web:
    image: nginx:1.27-alpine
    volumes:
      - ./html:/usr/share/nginx/html
`;
    const composeContent = parseCompose(source, "compose.yml");
    const diags = noDockerSocketMount.check(composeContent, "compose.yml", {
      locate: createComposeLocator(source),
    });
    expect(diags).toHaveLength(2);
    expect(diags[0].message).toContain("'gateway'");
    expect(diags[0].line).toBe(5);
    expect(diags[1].message).toContain("'agent'");
    expect(diags[1].line).toBe(9);
  });

  test("no-docker-socket-mount: every host spelling of the socket", () => {
    const source = `services:
  gateway:
    image: docker/mcp-gateway:1.0
    volumes:
      - \${DOCKER_SOCK:-/var/run/docker.sock}:/var/run/docker.sock
      - /run/docker.sock:/var/run/docker.sock
      - ~/.docker/run/docker.sock:/var/run/docker.sock:ro
      - //var/run/docker.sock:/var/run/docker.sock
      - \\\\.\\pipe\\docker_engine:\\\\.\\pipe\\docker_engine
      - \${DOCKER_SOCK}:/var/run/docker.sock
      - type: bind
        source: \${XDG_RUNTIME_DIR:-/run/user/1000}/docker.sock
        target: /var/run/docker.sock
`;
    const composeContent = parseCompose(source, "compose.yml");
    const diags = noDockerSocketMount.check(composeContent, "compose.yml", {
      locate: createComposeLocator(source),
    });
    expect(diags.map((d) => d.line)).toEqual([5, 6, 7, 8, 9, 10, 11]);
  });

  test("no-docker-socket-mount: named volumes, unrelated binds, and unknown sources are clean", () => {
    const composeContent = {
      services: {
        web: {
          volumes: [
            "docker.sock:/data",
            "./docker.sock.bak:/backup",
            "/var/run/docker.sock",
            // oxlint-disable-next-line no-template-curly-in-string -- Compose interpolation syntax, shown literally
            "${SOCK}:/tmp/sock",
            // oxlint-disable-next-line no-template-curly-in-string -- Compose interpolation syntax, shown literally
            "${SOCK:-/tmp/app.sock}:/var/run/docker.sock",
            {
              source: "sockets",
              target: "/var/run/docker.sock",
              type: "volume",
            },
          ],
        },
      },
    };
    expect(
      noDockerSocketMount.check(composeContent, "compose.yml")
    ).toHaveLength(0);
  });

  test("no-plaintext-secrets: map and list syntax, interpolation is clean", () => {
    const source = `services:
  agent:
    image: myagent:1.0
    environment:
      OPENAI_API_KEY: sk-abc123
      LOG_LEVEL: debug
      GITHUB_TOKEN: \${GITHUB_TOKEN}
  worker:
    image: myworker:1.0
    environment:
      - DB_PASSWORD=hunter2
      - REDIS_URL=redis://cache:6379
      - ANTHROPIC_API_KEY
`;
    const composeContent = parseCompose(source, "compose.yml");
    const diags = noPlaintextSecrets.check(composeContent, "compose.yml", {
      locate: createComposeLocator(source),
    });
    expect(diags).toHaveLength(2);
    expect(diags[0].message).toContain("'OPENAI_API_KEY'");
    expect(diags[0].line).toBe(5);
    expect(diags[1].message).toContain("'DB_PASSWORD'");
    expect(diags[1].line).toBe(11);
  });

  test("no-plaintext-secrets: URL endpoints are clean, agent-era key spellings are not", () => {
    const composeContent = {
      services: {
        agent: {
          environment: {
            AUTH_URL: "http://auth:8080",
            GITHUB_PAT: "ghp_abc",
            OPENAI_APIKEY: "sk-proj-abc",
            PGPASSWORD: "hunter2",
            TOKEN_ENDPOINT: "https://id.example.com/oauth/token",
          },
        },
      },
    };
    const diags = noPlaintextSecrets.check(composeContent, "compose.yml");
    expect(diags.map((d) => d.message)).toEqual([
      expect.stringContaining("'GITHUB_PAT'"),
      expect.stringContaining("'OPENAI_APIKEY'"),
      expect.stringContaining("'PGPASSWORD'"),
    ]);
  });

  test("compose security rules work without a locator", () => {
    const composeContent = {
      services: {
        agent: {
          environment: { API_KEY: "sk-live" },
          privileged: true,
          volumes: ["/var/run/docker.sock:/var/run/docker.sock"],
        },
      },
    };
    const rules = [
      noPrivilegedService,
      noDockerSocketMount,
      noPlaintextSecrets,
    ];
    for (const rule of rules) {
      const diags = rule.check(composeContent, "compose.yml");
      expect(diags).toHaveLength(1);
      expect(diags[0].line).toBeUndefined();
    }
  });
});

describe("Compose Model Rules", () => {
  test("undefined-model-reference: flags unknown names in list and map syntax", () => {
    const source = `services:
  agent:
    image: my-agent:1.0.0
    models:
      gemma3:
        endpoint_var: MODEL_RUNNER_URL
  worker:
    image: my-worker:1.0.0
    models:
      - llama
      - phi4
models:
  llama:
    model: ai/llama3.2:1B-Q8_0
`;
    const composeContent = parseCompose(source, "compose.yml");
    const diags = undefinedModelReference.check(composeContent, "compose.yml", {
      locate: createComposeLocator(source),
    });
    expect(diags).toHaveLength(2);
    expect(diags[0].message).toContain("'gemma3'");
    expect(diags[0].line).toBe(5);
    expect(diags[1].message).toContain("'phi4'");
    expect(diags[1].line).toBe(11);
  });

  test("undefined-model-reference: every reference is undefined without a top-level models section", () => {
    const composeContent = {
      services: {
        agent: { image: "my-agent:1.0.0", models: ["gemma3"] },
      },
    };
    const diags = undefinedModelReference.check(composeContent, "compose.yml");
    expect(diags).toHaveLength(1);
    expect(diags[0].line).toBeUndefined();
  });

  test("pin-model-version: flags untagged and latest model artifacts", () => {
    const source = `services:
  agent:
    image: my-agent:1.0.0
    models: [gemma3, phi4, qwen]
models:
  gemma3:
    model: ai/gemma3
  phi4:
    model: ai/phi4:latest
  qwen:
    model: ai/qwen3:8B-Q4_0
`;
    const composeContent = parseCompose(source, "compose.yml");
    const diags = pinModelVersion.check(composeContent, "compose.yml", {
      locate: createComposeLocator(source),
    });
    expect(diags).toHaveLength(2);
    expect(diags[0].message).toContain("'gemma3'");
    expect(diags[0].message).toContain("does not specify a tag");
    expect(diags[0].line).toBe(7);
    expect(diags[1].message).toContain("'phi4'");
    expect(diags[1].message).toContain("'latest'");
    expect(diags[1].line).toBe(9);

    const references = undefinedModelReference.check(
      composeContent,
      "compose.yml"
    );
    expect(references).toHaveLength(0);
  });

  test("pin-model-version: service-level provider syntax", () => {
    const source = `services:
  llm:
    provider:
      type: model
      options:
        model: ai/gemma3
  embeddings:
    provider:
      type: model
      options:
        model: ai/mxbai-embed-large:335M-F16
  cache:
    provider:
      type: awscloud
      options:
        model: whatever
`;
    const composeContent = parseCompose(source, "compose.yml");
    const diags = pinModelVersion.check(composeContent, "compose.yml", {
      locate: createComposeLocator(source),
    });
    expect(diags).toHaveLength(1);
    expect(diags[0].message).toContain("Service 'llm' model provider");
    expect(diags[0].message).toContain("does not specify a tag");
    expect(diags[0].line).toBe(6);
  });
});

describe("Image Size Rules", () => {
  test("prefer-slim-base", () => {
    const heavyBase = parseDockerfile(`
      FROM node:22
    `);
    const diags = preferSlimBase.check(heavyBase, "Dockerfile");
    expect(diags).toHaveLength(1);

    const slimBase = parseDockerfile(`
      FROM node:22-alpine
    `);
    const diags2 = preferSlimBase.check(slimBase, "Dockerfile");
    expect(diags2).toHaveLength(0);

    const digestPinned = parseDockerfile(`
      FROM node@sha256:aaaabbbbccccdddd
    `);
    expect(preferSlimBase.check(digestPinned, "Dockerfile")).toHaveLength(0);

    const registryPort = parseDockerfile(`
      FROM myregistry.example.com:5000/team/app
    `);
    expect(preferSlimBase.check(registryPort, "Dockerfile")).toHaveLength(0);

    const stageAlias = parseDockerfile(`
      FROM node:22-alpine AS build
      FROM build
    `);
    expect(preferSlimBase.check(stageAlias, "Dockerfile")).toHaveLength(0);
  });

  test("prefer-slim-base recognizes minimal images by name", () => {
    const minimal = parseDockerfile(`
      FROM alpine:3.19
      FROM busybox:1.36
      FROM gcr.io/distroless/static:nonroot
    `);
    expect(preferSlimBase.check(minimal, "Dockerfile")).toHaveLength(0);

    const fullOs = parseDockerfile(`
      FROM ubuntu:24.04
    `);
    expect(preferSlimBase.check(fullOs, "Dockerfile")).toHaveLength(1);
  });

  test("prefer-slim-base: Docker Hardened Images are minimal by construction", () => {
    for (const base of ["dhi.io/python:3.13", "dhi.io/node:22-dev"]) {
      expect(
        preferSlimBase.check(parseDockerfile(`FROM ${base}`), "Dockerfile")
      ).toHaveLength(0);
    }
  });

  test("clean-package-cache", () => {
    const noCleanup = parseDockerfile(`
      RUN apt-get update && apt-get install -y git
    `);
    const diags = cleanPackageCache.check(noCleanup, "Dockerfile");
    expect(diags).toHaveLength(1);

    const withCleanup = parseDockerfile(`
      RUN apt-get update && apt-get install -y git && rm -rf /var/lib/apt/lists/*
    `);
    const diags2 = cleanPackageCache.check(withCleanup, "Dockerfile");
    expect(diags2).toHaveLength(0);

    const apkNoCache = parseDockerfile(`
      RUN apk add --no-cache curl
    `);
    expect(cleanPackageCache.check(apkNoCache, "Dockerfile")).toHaveLength(0);
  });

  test("clean-package-cache accepts BuildKit cache mounts as cleanup", () => {
    // The Docker-documented apt pattern: caches live in the mount, not the
    // layer, so no `rm -rf` is needed.
    const aptCacheMount = parseDockerfile(`
      RUN --mount=type=cache,target=/var/cache/apt,sharing=locked \\
          --mount=type=cache,target=/var/lib/apt,sharing=locked \\
          apt-get update && apt-get install -y git
    `);
    expect(cleanPackageCache.check(aptCacheMount, "Dockerfile")).toHaveLength(
      0
    );

    const apkCacheMount = parseDockerfile(`
      RUN --mount=type=cache,target=/var/cache/apk \\
          apk add curl
    `);
    expect(cleanPackageCache.check(apkCacheMount, "Dockerfile")).toHaveLength(
      0
    );

    // A cache mount elsewhere does not excuse the missing cleanup.
    const unrelatedMount = parseDockerfile(`
      RUN --mount=type=cache,target=/root/.npm \\
          apt-get update && apt-get install -y git
    `);
    expect(cleanPackageCache.check(unrelatedMount, "Dockerfile")).toHaveLength(
      1
    );

    // A bind mount to an apt dir is not a cache mount.
    const bindMount = parseDockerfile(`
      RUN --mount=type=bind,target=/var/lib/apt \\
          apt-get update && apt-get install -y git
    `);
    expect(cleanPackageCache.check(bindMount, "Dockerfile")).toHaveLength(1);
  });

  test("avoid-dev-dependencies", () => {
    const withDev = parseDockerfile(`
        FROM node:22 AS builder
        FROM node:22 AS runner
        RUN npm install
      `);
    const diags1 = avoidDevDependencies.check(withDev, "Dockerfile");
    expect(diags1).toHaveLength(1);

    const withoutDev = parseDockerfile(`
        FROM node:22 AS builder
        FROM node:22 AS runner
        RUN npm ci --omit=dev
      `);
    const diags2 = avoidDevDependencies.check(withoutDev, "Dockerfile");
    expect(diags2).toHaveLength(0);
  });

  test("avoid-dev-dependencies audits stages the final image inherits", () => {
    // Issue #90: FROM <previous stage> carries that stage's layers into the
    // final image, so a dev install there ships too.
    const inheritedDev = parseDockerfile(`
      FROM node:22 AS deps
      RUN npm install
      FROM deps AS final
      CMD ["node", "x.js"]
    `);
    const diags = avoidDevDependencies.check(inheritedDev, "Dockerfile");
    expect(diags).toHaveLength(1);
    expect(diags[0].line).toBe(3);

    const inheritedClean = parseDockerfile(`
      FROM node:22 AS deps
      RUN npm ci --omit=dev
      FROM deps AS final
      CMD ["node", "x.js"]
    `);
    expect(
      avoidDevDependencies.check(inheritedClean, "Dockerfile")
    ).toHaveLength(0);

    // A discarded builder stage (not in the final stage's FROM chain) still
    // does not report.
    const discardedBuilder = parseDockerfile(`
      FROM node:22 AS builder
      RUN npm install
      FROM node:22 AS runner
      COPY --from=builder /app/dist ./dist
      RUN npm ci --omit=dev
    `);
    expect(
      avoidDevDependencies.check(discardedBuilder, "Dockerfile")
    ).toHaveLength(0);

    // The default build target is the LAST stage, so a trailing helper stage
    // is what actually ships and its dev install still reports.
    const trailingTestStage = parseDockerfile(`
      FROM node:22 AS build
      RUN npm install
      FROM node:22 AS final
      RUN npm ci --omit=dev
      FROM final AS test
      RUN npm install
    `);
    const trailing = avoidDevDependencies.check(
      trailingTestStage,
      "Dockerfile"
    );
    expect(trailing).toHaveLength(1);
    expect(trailing[0].line).toBe(7);
  });
});

describe("Best Practices Rules", () => {
  test("combine-apt-update-install", () => {
    const uncombinedUpdate = parseDockerfile(`
      RUN apt-get update
    `);
    const diags1 = combineAptUpdateInstall.check(
      uncombinedUpdate,
      "Dockerfile"
    );
    expect(diags1).toHaveLength(1);
    expect(diags1[0].rule).toBe("docker-doctor/combine-apt-update-install");

    const uncombinedInstall = parseDockerfile(`
      RUN apt-get install -y git
    `);
    const diags2 = combineAptUpdateInstall.check(
      uncombinedInstall,
      "Dockerfile"
    );
    expect(diags2).toHaveLength(1);

    const combined = parseDockerfile(`
      RUN apt-get update && apt-get install -y git && rm -rf /var/lib/apt/lists/*
    `);
    const diags3 = combineAptUpdateInstall.check(combined, "Dockerfile");
    expect(diags3).toHaveLength(0);
  });

  // Each case is one Dockerfile and the rules it must report, so a
  // failure names the scenario instead of hiding the cases after it.
  const pipefailCases: {
    dockerfile: string;
    expectedRules: string[];
    name: string;
  }[] = [
    {
      dockerfile: `RUN wget -O - https://some.site | wc -l > /number`,
      expectedRules: ["docker-doctor/use-pipefail"],
      name: "reports pipelines without pipefail",
    },
    {
      dockerfile: `RUN set -o pipefail && wget -O - https://some.site | wc -l > /number`,
      expectedRules: [],
      name: "accepts pipelines with pipefail",
    },
    {
      dockerfile: `RUN echo "hello" > /msg`,
      expectedRules: [],
      name: "ignores commands without a pipeline",
    },
    // Issue #84: the SHELL directive the docs prescribe must clear the
    // warning, but only while it actually enables pipefail.
    {
      dockerfile: `
      FROM debian:bookworm-slim
      SHELL ["/bin/bash", "-o", "pipefail", "-c"]
      RUN curl -fsSL https://bun.sh/install | bash
    `,
      expectedRules: [],
      name: "a SHELL directive enabling pipefail clears the warning",
    },
    {
      dockerfile: `
      FROM debian:bookworm-slim
      SHELL ["/bin/bash", "-c"]
      RUN curl -fsSL https://bun.sh/install | bash
    `,
      expectedRules: ["docker-doctor/use-pipefail"],
      name: "a SHELL directive without pipefail does not",
    },
    // A stage-level SHELL with pipefail carries into a stage that builds
    // FROM the previous one (the image config inherits), but not into a
    // stage that starts from a fresh base image.
    {
      dockerfile: `
      FROM debian:bookworm-slim AS base
      SHELL ["/bin/bash", "-o", "pipefail", "-c"]
      FROM base AS app
      RUN curl -fsSL https://bun.sh/install | bash
    `,
      expectedRules: [],
      name: "a stage built FROM a previous stage inherits its SHELL",
    },
    {
      dockerfile: `
      FROM debian:bookworm-slim AS base
      SHELL ["/bin/bash", "-o", "pipefail", "-c"]
      FROM debian:bookworm-slim AS app
      RUN curl -fsSL https://bun.sh/install | bash
    `,
      expectedRules: ["docker-doctor/use-pipefail"],
      name: "a stage from a fresh base image does not inherit",
    },
    {
      dockerfile: `
      FROM debian:bookworm-slim AS a
      SHELL ["/bin/bash", "-o", "pipefail", "-c"]
      FROM a AS b
      FROM b AS c
      RUN curl -fsSL https://bun.sh/install | bash
    `,
      expectedRules: [],
      name: "stage inheritance chains across two hops",
    },
    {
      dockerfile: `
      FROM debian:bookworm-slim AS base
      SHELL ["/bin/bash", "-o", "pipefail", "-c"]
      FROM base --platform=linux/amd64 AS app
      FROM app AS final
      RUN curl -fsSL https://bun.sh/install | bash
    `,
      expectedRules: [],
      name: "stage inheritance survives a flag written after the base",
    },
    // The opposite direction of the substring bug: a RUN that sets another
    // shell option must not exempt a pipeline that merely mentions the word.
    {
      dockerfile: `
      RUN set -o errexit && echo pipefail | tee log
    `,
      expectedRules: ["docker-doctor/use-pipefail"],
      name: "another shell option does not exempt a bare pipefail mention",
    },
    {
      dockerfile: `
      RUN set -euo pipefail && curl -fsSL https://x.sh | sh
    `,
      expectedRules: [],
      name: "the combined short form counts",
    },
    // Exec-form RUN runs its own argv: SHELL does not apply, the argv
    // itself must configure pipefail.
    {
      dockerfile: `
      RUN ["/bin/bash", "-o", "pipefail", "-c", "curl -fsSL https://x.sh | sh"]
    `,
      expectedRules: [],
      name: "exec-form RUN configuring pipefail in its own argv",
    },
    {
      dockerfile: `
      FROM debian:bookworm-slim
      SHELL ["/bin/bash", "-o", "pipefail", "-c"]
      RUN ["/bin/sh", "-c", "curl -fsSL https://x.sh | sh"]
    `,
      expectedRules: ["docker-doctor/use-pipefail"],
      name: "exec-form RUN does not pick up the stage SHELL",
    },
    // Interior comment lines (stripped from args) must not flip the verdict.
    {
      dockerfile: `
      RUN apt-get update \\
      # TODO: use set -o pipefail here
      && curl -s https://x.sh | sh
    `,
      expectedRules: ["docker-doctor/use-pipefail"],
      name: "an interior comment mentioning pipefail does not exempt",
    },
    {
      dockerfile: `
      RUN apt-get update \\
      # TODO: avoid curl | sh
      && apt-get install -y curl
    `,
      expectedRules: [],
      name: "an interior comment containing a pipe does not trigger",
    },
  ];

  test.each(pipefailCases)(
    "use-pipefail: $name",
    ({ dockerfile, expectedRules }) => {
      const diagnostics = usePipefail.check(
        parseDockerfile(dockerfile),
        "Dockerfile"
      );
      expect(diagnostics.map((diagnostic) => diagnostic.rule)).toEqual(
        expectedRules
      );
    }
  );

  test("use-pipefail flag regex", () => {
    // Direct guard on PIPEFAIL_SETTING_RE: accepts the spellings that set the
    // option, rejects commands that merely mention the word or pass it to a
    // non-shell flag.
    expect(PIPEFAIL_SETTING_RE.test("set -o pipefail && curl | sh")).toBe(true);
    expect(PIPEFAIL_SETTING_RE.test("set -euo pipefail && curl | sh")).toBe(
      true
    );
    expect(PIPEFAIL_SETTING_RE.test("bash -o pipefail -c curl | sh")).toBe(
      true
    );
    expect(
      PIPEFAIL_SETTING_RE.test(
        "ssh -o StrictHostKeyChecking=no h | grep pipefail"
      )
    ).toBe(false);
    expect(
      PIPEFAIL_SETTING_RE.test("set -o errexit && echo pipefail | tee log")
    ).toBe(false);
  });

  // Known false positive: the pipefail check reads inst.args with no quote
  // awareness, so a regex alternation inside a quoted argument reads as a
  // shell pipeline. Not fixed here - see plans/README.md deferred list.
  test.todo("use-pipefail ignores pipes inside quoted arguments", () => {
    const quotedPipe = parseDockerfile(`
      FROM node:22-alpine
      RUN grep -E "foo|bar" /etc/passwd
    `);
    expect(usePipefail.check(quotedPipe, "Dockerfile")).toHaveLength(0);
  });

  test("absolute-workdir", () => {
    const relative = parseDockerfile(`
      WORKDIR app/src
    `);
    const diags1 = absoluteWorkdir.check(relative, "Dockerfile");
    expect(diags1).toHaveLength(1);
    expect(diags1[0].rule).toBe("docker-doctor/absolute-workdir");

    const absolute = parseDockerfile(`
      WORKDIR /usr/src/app
    `);
    const diags2 = absoluteWorkdir.check(absolute, "Dockerfile");
    expect(diags2).toHaveLength(0);

    const variableWorkdir = parseDockerfile(`
      WORKDIR \${APP_HOME}
    `);
    expect(absoluteWorkdir.check(variableWorkdir, "Dockerfile")).toHaveLength(
      0
    );
  });

  test("avoid-run-cd", () => {
    const withCd = parseDockerfile(`
      RUN cd /app && npm run build
    `);
    const diags1 = avoidRunCd.check(withCd, "Dockerfile");
    expect(diags1).toHaveLength(1);
    expect(diags1[0].rule).toBe("docker-doctor/avoid-run-cd");

    const withoutCd = parseDockerfile(`
      WORKDIR /app
      RUN npm run build
    `);
    const diags2 = avoidRunCd.check(withoutCd, "Dockerfile");
    expect(diags2).toHaveLength(0);
  });

  // Known false positive: /\bcd\b/ matches path segments and words in
  // strings, not just the cd command. Not fixed here.
  test.todo("avoid-run-cd ignores cd inside paths and strings", () => {
    const pathWithCd = parseDockerfile(`
      FROM node:22-alpine
      RUN mkdir -p /opt/cd && echo abcd
    `);
    expect(avoidRunCd.check(pathWithCd, "Dockerfile")).toHaveLength(0);
  });

  test("sort-multiline-args", () => {
    const unsorted = parseDockerfile(`
      RUN apt-get update && apt-get install -y --no-install-recommends \\
        git \\
        curl \\
        tmux
    `);
    const diags1 = sortMultilineArgs.check(unsorted, "Dockerfile");
    expect(diags1).toHaveLength(1);
    expect(diags1[0].rule).toBe("docker-doctor/sort-multiline-args");

    const sorted = parseDockerfile(`
      RUN apt-get update && apt-get install -y --no-install-recommends \\
        curl \\
        git \\
        tmux
    `);
    const diags2 = sortMultilineArgs.check(sorted, "Dockerfile");
    expect(diags2).toHaveLength(0);
  });

  test("sort-multiline-args ignores comment lines inside the list", () => {
    const sortedWithComment = parseDockerfile(`
      RUN apt-get update && apt-get install -y --no-install-recommends \\
        curl \\
        # version control
        git \\
        tmux
    `);
    expect(
      sortMultilineArgs.check(sortedWithComment, "Dockerfile")
    ).toHaveLength(0);
  });

  test("useradd-no-log-init", () => {
    const withoutFlag = parseDockerfile(`
      RUN useradd -r -g mygroup myuser
    `);
    const diags1 = useraddNoLogInit.check(withoutFlag, "Dockerfile");
    expect(diags1).toHaveLength(1);
    expect(diags1[0].rule).toBe("docker-doctor/useradd-no-log-init");

    const withFlag = parseDockerfile(`
      RUN useradd --no-log-init -r -g mygroup myuser
    `);
    const diags2 = useraddNoLogInit.check(withFlag, "Dockerfile");
    expect(diags2).toHaveLength(0);
  });

  test("require-healthcheck", () => {
    const withoutHealth = parseDockerfile(`
        FROM node:22-alpine
        EXPOSE 3000
      `);
    const diags1 = requireHealthcheck.check(withoutHealth, "Dockerfile");
    expect(diags1).toHaveLength(1);

    const withHealth = parseDockerfile(`
        FROM node:22-alpine
        HEALTHCHECK --interval=30s --timeout=3s CMD curl -f http://localhost/ || exit 1
      `);
    const diags2 = requireHealthcheck.check(withHealth, "Dockerfile");
    expect(diags2).toHaveLength(0);

    const multiStageWithHealth = parseDockerfile(`
      FROM node:22-alpine AS build
      RUN npm run build
      FROM node:22-alpine
      COPY --from=build /app/dist ./dist
      EXPOSE 3000
      HEALTHCHECK --interval=30s --timeout=3s CMD curl -f http://localhost:3000/health || exit 1
      CMD ["node", "dist/index.js"]
    `);
    expect(
      requireHealthcheck.check(multiStageWithHealth, "Dockerfile")
    ).toHaveLength(0);
  });

  test("prefer-copy-over-add", () => {
    const addFile = parseDockerfile(`
        ADD file.txt /app/file.txt
      `);
    const diags1 = preferCopyOverAdd.check(addFile, "Dockerfile");
    expect(diags1).toHaveLength(1);

    const addArchive = parseDockerfile(`
        ADD archive.tar.gz /app/
      `);
    const diags2 = preferCopyOverAdd.check(addArchive, "Dockerfile");
    expect(diags2).toHaveLength(0);

    const addArchiveWithChown = parseDockerfile(`
      ADD --chown=node:node archive.tar.gz /app/
    `);
    expect(
      preferCopyOverAdd.check(addArchiveWithChown, "Dockerfile")
    ).toHaveLength(0);
  });

  test("use-exec-form", () => {
    const shellForm = parseDockerfile(`
        CMD node index.js
      `);
    const diags1 = useExecForm.check(shellForm, "Dockerfile");
    expect(diags1).toHaveLength(1);

    const execForm = parseDockerfile(`
        CMD ["node", "index.js"]
      `);
    const diags2 = useExecForm.check(execForm, "Dockerfile");
    expect(diags2).toHaveLength(0);

    const entrypointExecForm = parseDockerfile(`
      ENTRYPOINT ["docker-entrypoint.sh"]
    `);
    expect(useExecForm.check(entrypointExecForm, "Dockerfile")).toHaveLength(0);

    // Bracket-wrapped but not a JSON array: Docker runs these through
    // /bin/sh -c, so they are shell form and must be reported.
    const unquotedTokens = parseDockerfile(`
      CMD [node, index.js]
    `);
    expect(useExecForm.check(unquotedTokens, "Dockerfile")).toHaveLength(1);

    const singleQuoted = parseDockerfile(`
      ENTRYPOINT ['docker-entrypoint.sh']
    `);
    expect(useExecForm.check(singleQuoted, "Dockerfile")).toHaveLength(1);

    const trailingComma = parseDockerfile(`
      CMD ["node", "index.js",]
    `);
    expect(useExecForm.check(trailingComma, "Dockerfile")).toHaveLength(1);
  });

  test("require-labels", () => {
    const withoutLabels = parseDockerfile(`
        FROM node:22-alpine
      `);
    const diags1 = requireLabels.check(withoutLabels, "Dockerfile");
    expect(diags1).toHaveLength(1);

    const withLabels = parseDockerfile(`
        LABEL maintainer="me"
      `);
    const diags2 = requireLabels.check(withLabels, "Dockerfile");
    expect(diags2).toHaveLength(0);

    const withOciLabels = parseDockerfile(`
      LABEL org.opencontainers.image.authors="team@example.com" org.opencontainers.image.version="1.0.0"
    `);
    expect(requireLabels.check(withOciLabels, "Dockerfile")).toHaveLength(0);
  });
});
