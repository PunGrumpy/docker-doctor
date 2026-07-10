import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { stdin as input, stdout as output } from "node:process";
import readline from "node:readline/promises";
import { setTimeout } from "node:timers/promises";

import type { Diagnostic, RuleSeverity } from "@docker-doctor/core";
import {
  discoverProject,
  parseDockerfile,
  parseCompose,
  runDockerfileRules,
  runComposeRules,
  calculateScore,
  loadConfig,
  allRules,
  findRule,
  toJsonReport,
} from "@docker-doctor/core";
import chalk from "chalk";
import { Command } from "commander";

import packageJson from "../package.json" with { type: "json" };
import { formatTerminal } from "./formatters/terminal.js";

const runInteractiveWizard = async (): Promise<void> => {
  const rl = readline.createInterface({ input, output });
  try {
    const ghAnswer = await rl.question(
      `\n  ${chalk.green("✔")} ${chalk.bold("Add Docker Doctor to GitHub Actions?")}\n` +
        `    Scan every pull request to prevent new Docker issues while you fix the backlog.\n` +
        `    › (y/N) `
    );
    if (ghAnswer.trim().toLowerCase() === "y") {
      const workflowDir = path.resolve(".github/workflows");
      await fs.mkdir(workflowDir, { recursive: true });
      const workflowPath = path.join(workflowDir, "docker-doctor.yml");
      const workflowYaml = `name: Docker Doctor Scan
on:
  push:
    branches: [ main, master ]
  pull_request:
    branches: [ main, master ]
jobs:
  docker-doctor:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - name: Setup Bun
        uses: oven-sh/setup-bun@v2
      - name: Install dependencies
        run: bun install
      - name: Run docker-doctor
        run: bunx docker-doctor .
`;
      await fs.writeFile(workflowPath, workflowYaml, "utf-8");
      console.log(
        `\n  ${chalk.green("✨")} Created ${chalk.cyan(".github/workflows/docker-doctor.yml")}!`
      );
      console.log(
        `    Scan every pull request to prevent new Docker issues while you fix the backlog.`
      );
    }

    const nextAnswer = await rl.question(
      `\n  ${chalk.green("✔")} ${chalk.bold("What would you like to do next?")}\n` +
        `    1: View rules list\n` +
        `    2: Skip\n` +
        `    › `
    );
    if (nextAnswer.trim() === "1") {
      console.log(`\n  ${chalk.bold("Available Rules:")}`);
      for (const r of allRules) {
        console.log(
          `    - ${chalk.cyan(r.key)}: ${r.message} (${chalk.dim(r.category)})`
        );
      }
    }
  } catch {
    // Ignore prompt errors
  } finally {
    rl.close();
  }
};

const runRulesEngine = async (
  rootDir: string,
  project: { dockerfiles: string[]; composeFiles: string[] },
  rulesConfig: Record<string, RuleSeverity> | undefined,
  projectFilesList: string[],
  fileContents: Record<string, string>,
  options: { score?: boolean; json?: boolean },
  setStatus: (text: string) => void
): Promise<Diagnostic[]> => {
  const diagnostics: Diagnostic[] = [];

  const isSilent = options.score || options.json;

  if (process.stdout.isTTY && !isSilent) {
    setStatus(`Analyzing ${project.dockerfiles.length} Dockerfile(s)...`);
    await setTimeout(100);
  }

  // 1. Scan Dockerfiles in parallel
  const dockerfileResults = await Promise.all(
    project.dockerfiles.map(async (df) => {
      const fullPath = path.join(rootDir, df);
      try {
        const content = await fs.readFile(fullPath, "utf-8");
        fileContents[df] = content;
        const instructions = parseDockerfile(content);
        return runDockerfileRules(
          instructions,
          df,
          projectFilesList,
          rulesConfig
        );
      } catch (error: unknown) {
        const msg = error instanceof Error ? error.message : String(error);
        console.error(`Failed to analyze Dockerfile ${df}: ${msg}`);
        return [];
      }
    })
  );
  for (const diags of dockerfileResults) {
    diagnostics.push(...diags);
  }

  if (process.stdout.isTTY && !isSilent) {
    setStatus(`Analyzing ${project.composeFiles.length} Compose file(s)...`);
    await setTimeout(100);
  }

  // 2. Scan Compose files in parallel
  const composeResults = await Promise.all(
    project.composeFiles.map(async (cf) => {
      const fullPath = path.join(rootDir, cf);
      try {
        const content = await fs.readFile(fullPath, "utf-8");
        fileContents[cf] = content;
        const composeObj = parseCompose(content, cf);
        return runComposeRules(composeObj, cf, rulesConfig);
      } catch (error: unknown) {
        const msg = error instanceof Error ? error.message : String(error);
        console.error(`Failed to analyze Compose file ${cf}: ${msg}`);
        return [];
      }
    })
  );
  for (const diags of composeResults) {
    diagnostics.push(...diags);
  }

  return diagnostics;
};

const program = new Command();

program
  .name("docker-doctor")
  .description("Static analysis for Dockerfile and Docker Compose files")
  .version(packageJson.version, "-V, --version", "display the version number");

// Default scan command
program
  .argument("[dir]", "directory to scan", ".")
  .option("-v, --verbose", "show verbose diagnostics description", false)
  .option("-s, --score", "only output numeric health score", false)
  .option("-j, --json", "output results as JSON report", false)
  .option("-c, --config <path>", "custom config file path")
  .action(async (dir, options) => {
    try {
      const rootDir = path.resolve(dir);
      const startTime = Date.now();

      const isSilent = options.score || options.json;

      let statusText = "Discovering workspace...";
      const spinnerFrames = ["⠋", "⠙", "⠹", "⠸", "⠼", "⠴", "⠦", "⠧", "⠇", "⠏"];
      let frameIndex = 0;
      let spinnerInterval: NodeJS.Timeout | null = null;

      const setStatus = (text: string) => {
        statusText = text;
      };

      if (process.stdout.isTTY && !isSilent) {
        process.stdout.write(`${chalk.cyan(spinnerFrames[0])} ${statusText}`);
        spinnerInterval = setInterval(() => {
          process.stdout.write(
            `\r${chalk.cyan(spinnerFrames[frameIndex])} ${statusText}`
          );
          frameIndex = (frameIndex + 1) % spinnerFrames.length;
        }, 80);
      }

      try {
        if (process.stdout.isTTY && !isSilent) {
          await setTimeout(150);
        }

        setStatus("Loading configuration...");
        // Load config first
        const config = await loadConfig(rootDir, options.config);

        setStatus("Scanning workspace files...");
        // Project discovery
        const project = await discoverProject(rootDir);

        // Collect all diagnostics
        const fileContents: Record<string, string> = {};

        const projectFilesList = [
          ...project.dockerfiles,
          ...project.composeFiles,
        ];

        const diagnostics = await runRulesEngine(
          rootDir,
          project,
          config.rules,
          projectFilesList,
          fileContents,
          options,
          setStatus
        );

        // Filter by category config if needed
        let filteredDiagnostics = diagnostics;
        if (config.categories) {
          filteredDiagnostics = diagnostics.filter((d) => {
            const ruleDef = findRule(d.rule);
            if (ruleDef) {
              const catSeverity = config.categories?.[ruleDef.category];
              if (catSeverity === "off") {
                return false;
              }
            }
            return true;
          });
        }

        // Calculate score
        const { score, label } = calculateScore(filteredDiagnostics);

        const duration = ((Date.now() - startTime) / 1000).toFixed(1);
        const concurrency = os.cpus().length;

        if (spinnerInterval !== null) {
          clearInterval(spinnerInterval);
          spinnerInterval = null;
          // Clear the spinner line
          process.stdout.write("\r\u001B[K");
        }

        if (process.stdout.isTTY && !isSilent) {
          console.log(
            `${chalk.green("✔")} Scanned ${projectFilesList.length} files in ${duration}s [~${concurrency} workers]`
          );
        }

        if (options.score) {
          console.log(score);
          process.exit(score < 50 ? 1 : 0);
        } else if (options.json) {
          const report = toJsonReport(
            filteredDiagnostics,
            score,
            label,
            project
          );
          console.log(JSON.stringify(report, null, 2));
          const hasErrors = filteredDiagnostics.some(
            (d) => d.severity === "error"
          );
          process.exit(hasErrors ? 1 : 0);
        } else {
          await formatTerminal(
            filteredDiagnostics,
            score,
            label,
            project,
            options.verbose,
            fileContents
          );

          // Exit with non-zero code if there are any error severity diagnostics
          const hasErrors = filteredDiagnostics.some(
            (d) => d.severity === "error"
          );

          if (process.stdout.isTTY) {
            await runInteractiveWizard();
          }
          process.exit(hasErrors ? 1 : 0);
        }
      } finally {
        if (spinnerInterval !== null) {
          clearInterval(spinnerInterval);
          process.stdout.write("\r\u001B[K");
        }
      }
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : String(error);
      console.error(`Error: ${msg}`);
      process.exit(1);
    }
  });

// Rules subcommand group
const rules = program
  .command("rules")
  .description("manage and list configuration rules");

rules
  .command("list")
  .description("list all available rules")
  .action(() => {
    console.log("\nAvailable Rules:");
    console.log("================\n");
    for (const rule of allRules) {
      console.log(`- ${rule.key} (${rule.category})`);
      console.log(`  Default Severity: ${rule.defaultSeverity}`);
      console.log(`  Description:      ${rule.message}\n`);
    }
  });

rules
  .command("explain <rule>")
  .description("explain a specific rule in detail")
  .action((ruleKey) => {
    const rule = findRule(ruleKey);
    if (!rule) {
      console.error(`Rule '${ruleKey}' not found.`);
      process.exit(1);
    }
    console.log(`\nRule:             ${rule.key}`);
    console.log(`Category:         ${rule.category}`);
    console.log(`Default Severity: ${rule.defaultSeverity}`);
    console.log(`Description:      ${rule.message}`);
    console.log(`Help / Fix:       ${rule.help}\n`);
  });

program.parse(process.argv);
