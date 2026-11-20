import { describe, expect, test } from "bun:test";

import { parseDockerfile } from "../src/parsers/dockerfile-parser";
import { combineAptUpdateInstall } from "../src/rules/best-practices";
import { hasAptInstall, hasAptUpdate } from "../src/rules/package-managers";

const check = (run: string) =>
  combineAptUpdateInstall.check(
    parseDockerfile(`FROM ubuntu:24.04\n${run}\n`),
    "Dockerfile"
  );

describe("combine-apt-update-install with the apt spelling", () => {
  test("accepts the build cache docs example", () => {
    expect(
      check(
        "RUN --mount=type=cache,target=/var/cache/apt,sharing=locked \\\n    --mount=type=cache,target=/var/lib/apt,sharing=locked \\\n    apt update && apt-get --no-install-recommends install -y gcc"
      )
    ).toHaveLength(0);
  });

  test("accepts apt-get update followed by apt install", () => {
    expect(check("RUN apt-get update && apt install -y gcc")).toHaveLength(0);
  });

  test("accepts apt update followed by apt-get install", () => {
    expect(check("RUN apt update && apt-get install -y gcc")).toHaveLength(0);
  });

  test("still reports apt-get install without any update", () => {
    expect(check("RUN apt-get install -y gcc")).toHaveLength(1);
  });

  test("still reports apt-get update without any install", () => {
    expect(check("RUN apt-get update")).toHaveLength(1);
  });

  test("still reports apt-get install next to apt-cache or apt-key", () => {
    expect(
      check("RUN apt-cache update && apt-get install -y gcc")
    ).toHaveLength(1);
    expect(check("RUN apt-key update; apt-get install -y gcc")).toHaveLength(1);
  });

  test("stays silent for a bare apt install or apt update", () => {
    expect(check("RUN apt install -y gcc")).toHaveLength(0);
    expect(check("RUN apt update")).toHaveLength(0);
  });
});

describe("hasAptInstall and hasAptUpdate", () => {
  test("match both spellings with options in between", () => {
    expect(hasAptInstall("apt -y install gcc")).toBe(true);
    expect(hasAptInstall("apt-get --no-install-recommends install gcc")).toBe(
      true
    );
    expect(hasAptUpdate("apt update")).toBe(true);
    expect(hasAptUpdate("apt-get -qq update")).toBe(true);
  });

  test("do not match other apt tools or a longer name", () => {
    expect(hasAptInstall("apt-cache install gcc")).toBe(false);
    expect(hasAptUpdate("apt-key update")).toBe(false);
    expect(hasAptUpdate("my-apt update")).toBe(false);
    expect(hasAptInstall("aptitude install gcc")).toBe(false);
  });
});
