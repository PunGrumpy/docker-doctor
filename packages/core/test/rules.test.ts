import { describe, test, expect } from "bun:test";

import { parseDockerfile } from "../src/parsers/dockerfile-parser";
import {
  combineAptUpdateInstall,
  usePipefail,
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
  requireResourceLimits,
  requireRestartPolicy,
  useDependsOnCondition,
} from "../src/rules/compose";
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
  });

  test("require-resource-limits", () => {
    const composeContent = {
      services: {
        web: { image: "node:22" },
      },
    };
    const diags = requireResourceLimits.check(composeContent, "compose.yml");
    expect(diags).toHaveLength(1);
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
  });

  test("use-depends-on-condition", () => {
    const shortForm = {
      services: {
        web: { depends_on: ["db"], image: "node:22" },
      },
    };
    const diags1 = useDependsOnCondition.check(shortForm, "compose.yml");
    expect(diags1).toHaveLength(1);
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

  test("use-pipefail", () => {
    const withoutPipefail = parseDockerfile(`
      RUN wget -O - https://some.site | wc -l > /number
    `);
    const diags1 = usePipefail.check(withoutPipefail, "Dockerfile");
    expect(diags1).toHaveLength(1);
    expect(diags1[0].rule).toBe("docker-doctor/use-pipefail");

    const withPipefail = parseDockerfile(`
      RUN set -o pipefail && wget -O - https://some.site | wc -l > /number
    `);
    const diags2 = usePipefail.check(withPipefail, "Dockerfile");
    expect(diags2).toHaveLength(0);

    const noPipe = parseDockerfile(`
      RUN echo "hello" > /msg
    `);
    const diags3 = usePipefail.check(noPipe, "Dockerfile");
    expect(diags3).toHaveLength(0);
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
  });
});
