import { describe, expect, test } from "bun:test";

import { parseDockerfile } from "../src/parsers/dockerfile-parser";
import { usePipefail } from "../src/rules/best-practices";

const check = (content: string) =>
  usePipefail.check(parseDockerfile(content), "Dockerfile");

const PIPED_RUN = "RUN Get-ChildItem C:\\ | Select-Object -First 1";

describe("use-pipefail under cmd and PowerShell", () => {
  test("skips a pipe after a PowerShell SHELL", () => {
    expect(
      check(
        `FROM mcr.microsoft.com/windows/servercore:ltsc2022\nSHELL ["powershell", "-Command", "$ErrorActionPreference = 'Stop';"]\n${PIPED_RUN}\n`
      )
    ).toHaveLength(0);
  });

  test("skips a pipe after a cmd SHELL", () => {
    expect(
      check(
        `FROM mcr.microsoft.com/windows/servercore:ltsc2022\nSHELL ["cmd", "/S", "/C"]\nRUN type a.txt | findstr x\n`
      )
    ).toHaveLength(0);
  });

  test("skips a pipe after a pwsh SHELL", () => {
    expect(
      check(`FROM node:20\nSHELL ["pwsh", "-Command"]\n${PIPED_RUN}\n`)
    ).toHaveLength(0);
  });

  test("reads the shell name from a full Windows path", () => {
    expect(
      check(
        `FROM mcr.microsoft.com/windows/servercore:ltsc2022\nSHELL ["C:\\\\Windows\\\\System32\\\\WindowsPowerShell\\\\v1.0\\\\powershell.exe", "-Command"]\n${PIPED_RUN}\n`
      )
    ).toHaveLength(0);
  });

  test("reads the shell name case-insensitively", () => {
    expect(
      check(
        `FROM node:20\nSHELL ["PowerShell.EXE", "-Command"]\n${PIPED_RUN}\n`
      )
    ).toHaveLength(0);
  });

  test("lets a child stage inherit the exemption", () => {
    expect(
      check(
        `FROM mcr.microsoft.com/windows/servercore:ltsc2022 AS base\nSHELL ["powershell", "-Command"]\nFROM base\n${PIPED_RUN}\n`
      )
    ).toHaveLength(0);
  });

  test("reports again once a POSIX SHELL replaces it in the same stage", () => {
    const diagnostics = check(
      `FROM node:20\nSHELL ["powershell", "-Command"]\nSHELL ["/bin/bash", "-c"]\nRUN curl x | sh\n`
    );

    expect(diagnostics.map((d) => d.line)).toEqual([4]);
  });

  test("resets to a POSIX shell on a fresh base image", () => {
    const diagnostics = check(
      `FROM node:20 AS win\nSHELL ["powershell", "-Command"]\nFROM ubuntu:24.04\nRUN curl x | sh\n`
    );

    expect(diagnostics.map((d) => d.line)).toEqual([4]);
  });

  test("still reports a pipe with the default shell", () => {
    expect(check("FROM ubuntu:24.04\nRUN curl x | sh\n")).toHaveLength(1);
  });

  test("keeps checking an exec-form RUN that names its own shell", () => {
    expect(
      check(
        `FROM node:20\nSHELL ["powershell", "-Command"]\nRUN ["bash", "-c", "curl x | sh"]\n`
      )
    ).toHaveLength(1);
  });
});
