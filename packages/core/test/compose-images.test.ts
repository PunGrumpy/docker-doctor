import { describe, expect, test } from "bun:test";

import { parseComposeImage } from "../src/rules/compose-images";

describe("parseComposeImage", () => {
  test.each([
    [
      "lscr.io/linuxserver/socket-proxy:1.2",
      "lscr.io",
      "linuxserver/socket-proxy",
    ],
    ["docker.io/ollama/ollama@sha256:a", "docker.io", "ollama/ollama"],
    ["localhost:5000/team/app:1", "localhost:5000", "team/app"],
    ["library/nginx:1.27", undefined, "nginx"],
    ["nginx", undefined, "nginx"],
    [`\${IMG:-qdrant/qdrant:v1}`, undefined, "qdrant/qdrant"],
  ])("%s reads as %s and %s", (image, registry, repository) => {
    expect(parseComposeImage(image)).toEqual({ registry, repository });
  });

  test.each([`\${IMG}`, "$IMG", `app:\${TAG}`, `\${IMG:-}`])(
    "%s depends on a variable",
    (image) => {
      expect(parseComposeImage(image)).toBeUndefined();
    }
  );
});
