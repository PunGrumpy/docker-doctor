import { describe, test, expect } from "bun:test";

import { parseDockerfile } from "../src/parsers/dockerfile-parser.js";
import {
  combineAptUpdateInstall,
  usePipefail,
  absoluteWorkdir,
  avoidRunCd,
  sortMultilineArgs,
  useraddNoLogInit,
} from "../src/rules/best-practices.js";
import { noVersionKey, requireResourceLimits } from "../src/rules/compose.js";
import { preferSlimBase, cleanPackageCache } from "../src/rules/image-size.js";
import { orderLayers } from "../src/rules/performance.js";
import {
  noRootUser,
  pinImageVersion,
  noSecretsInEnv,
} from "../src/rules/security.js";

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
  });

  test("no-secrets-in-env", () => {
    const withSecret = parseDockerfile(`
      ENV DB_PASSWORD=my-secret-pass
    `);
    const diags = noSecretsInEnv.check(withSecret, "Dockerfile");
    expect(diags).toHaveLength(1);
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
});
