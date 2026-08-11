import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import readline from "node:readline";
import { setTimeout } from "node:timers/promises";

import type { Diagnostic, JsonReport, RuleSeverity } from "@docker-doctor/core";
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
import type { SkillAgentType } from "agent-install";
import {
  detectInstalledSkillAgents,
  getSkillAgentConfig,
  getSkillAgentTypes,
  isSkillAgentType,
} from "agent-install";
import chalk from "chalk";
import { Command } from "commander";

import packageJson from "../package.json" with { type: "json" };
import { copyToClipboard } from "./agents/clipboard";
import {
  ensureGitignoreEntry,
  writeDiagnosticsDirectory,
} from "./agents/diagnostics-dir";
import { buildHandoffPayload } from "./agents/handoff-payload";
import { launchAgent } from "./agents/launch-agent";
import {
  AGENT_BINARIES,
  detectLaunchableAgents,
} from "./agents/launchable-agents";
import {
  getSkillSourceDirectory,
  installSkillForAgents,
} from "./agents/skill-install";
import { formatTerminal } from "./formatters/terminal";

interface KeypressKey {
  name?: string;
  ctrl?: boolean;
  meta?: boolean;
  shift?: boolean;
}

// The GitHub Action is versioned independently of the CLI: this floating
// major tag moves whenever the action itself changes, so scaffolded
// workflows keep picking up action fixes. Bump it here when the action
// releases a breaking major.
const ACTION_REF = "PunGrumpy/docker-doctor@v1";

const askConfirm = (question: string, defaultYes = false): Promise<boolean> => {
  const isRaw = process.stdin.isTTY;
  if (!isRaw) {
    return Promise.resolve(defaultYes);
  }

  /* eslint-disable promise/avoid-new */
  return new Promise((resolve) => {
    let value = defaultYes;

    readline.emitKeypressEvents(process.stdin);
    process.stdin.setRawMode(true);
    process.stdin.resume();

    // Hide cursor during prompt
    process.stdout.write("\u001B[?25l");

    const render = (firstTime = false) => {
      if (!firstTime) {
        process.stdout.write("\u001B[3A\r");
      }

      process.stdout.write(
        `\r\u001B[K  ${chalk.green("✔")} ${chalk.bold(question)}\n`
      );

      // Print options vertically
      const yesPrefix = value ? chalk.cyan("❯ ") : "  ";
      const yesText = value ? chalk.cyan.bold("Yes") : chalk.dim("Yes");
      process.stdout.write(`\r\u001B[K${yesPrefix}${yesText}\n`);

      const noPrefix = value ? "  " : chalk.cyan("❯ ");
      const noText = value ? chalk.dim("No") : chalk.cyan.bold("No");
      process.stdout.write(`\r\u001B[K${noPrefix}${noText}\n`);
    };

    render(true);

    const handleKeypress = (str: string, key: KeypressKey) => {
      const cleanup = () => {
        process.stdin.removeListener("keypress", handleKeypress);
        if (process.stdin.isTTY) {
          process.stdin.setRawMode(false);
        }
        process.stdin.pause();
        process.stdout.write("\u001B[?25h");
      };

      if (
        key.name === "left" ||
        key.name === "right" ||
        key.name === "up" ||
        key.name === "down" ||
        key.name === "h" ||
        key.name === "l" ||
        key.name === "j" ||
        key.name === "k"
      ) {
        value = !value;
        render();
      } else if (str === "y" || str === "Y") {
        value = true;
        render();
      } else if (str === "n" || str === "N") {
        value = false;
        render();
      } else if (
        key.name === "return" ||
        key.name === "enter" ||
        str === "\r" ||
        str === "\n"
      ) {
        cleanup();
        // Overwrite and resolve vertical layout cleanly
        process.stdout.write("\u001B[3A\r\u001B[K");
        process.stdout.write(
          `  ${chalk.green("✔")} ${chalk.bold(question)} › ${value ? chalk.cyan("Yes") : chalk.dim("No")}\n`
        );
        process.stdout.write("\r\u001B[K\n");
        process.stdout.write("\r\u001B[K\n");
        process.stdout.write("\u001B[2A");
        resolve(value);
      } else if (key.ctrl && key.name === "c") {
        cleanup();
        process.stdout.write("\n");
        process.exit(130);
      }
    };

    process.stdin.on("keypress", handleKeypress);
  });
  /* eslint-enable promise/avoid-new */
};

const askSelect = (
  question: string,
  options: string[],
  defaultIndex = 0
): Promise<number> => {
  const isRaw = process.stdin.isTTY;
  if (!isRaw) {
    return Promise.resolve(defaultIndex);
  }

  /* eslint-disable promise/avoid-new */
  return new Promise((resolve) => {
    let index = defaultIndex;

    readline.emitKeypressEvents(process.stdin);
    process.stdin.setRawMode(true);
    process.stdin.resume();

    // Hide cursor during prompt
    process.stdout.write("\u001B[?25l");

    const render = (firstTime = false) => {
      if (!firstTime) {
        // Move back up to overwrite previous render
        process.stdout.write(`\u001B[${options.length + 1}A\r`);
      }

      process.stdout.write(
        `\r\u001B[K  ${chalk.green("✔")} ${chalk.bold(question)}\n`
      );

      // Print options
      let i = 0;
      for (const option of options) {
        const isSelected = i === index;
        const prefix = isSelected ? chalk.cyan("❯ ") : "  ";
        const text = isSelected ? chalk.cyan.bold(option) : chalk.dim(option);
        process.stdout.write(`\r\u001B[K${prefix}${text}\n`);
        i += 1;
      }
    };

    render(true);

    const handleKeypress = (str: string, key: KeypressKey) => {
      const cleanup = () => {
        process.stdin.removeListener("keypress", handleKeypress);
        if (process.stdin.isTTY) {
          process.stdin.setRawMode(false);
        }
        process.stdin.pause();
        process.stdout.write("\u001B[?25h");
      };

      if (key.name === "up" || key.name === "k") {
        index = (index - 1 + options.length) % options.length;
        render();
      } else if (key.name === "down" || key.name === "j") {
        index = (index + 1) % options.length;
        render();
      } else if (
        key.name === "return" ||
        key.name === "enter" ||
        str === "\r" ||
        str === "\n"
      ) {
        cleanup();
        // Overwrite and resolve
        process.stdout.write(`\u001B[${options.length + 1}A\r\u001B[K`);
        process.stdout.write(
          `  ${chalk.green("✔")} ${chalk.bold(question)} › ${chalk.cyan(options[index])}\n`
        );
        for (const _ of options) {
          process.stdout.write("\r\u001B[K\n");
        }
        process.stdout.write(`\u001B[${options.length}A`);
        resolve(index);
      } else if (key.ctrl && key.name === "c") {
        cleanup();
        process.stdout.write("\n");
        process.exit(130);
      }
    };

    process.stdin.on("keypress", handleKeypress);
  });
  /* eslint-enable promise/avoid-new */
};

interface MultiSelectOption {
  label: string;
  selected: boolean;
}

const askMultiSelect = (
  question: string,
  options: MultiSelectOption[]
): Promise<number[]> => {
  const isRaw = process.stdin.isTTY;
  if (!isRaw) {
    return Promise.resolve(
      options.flatMap((option, i) => (option.selected ? [i] : []))
    );
  }

  /* eslint-disable promise/avoid-new */
  return new Promise((resolve) => {
    let index = 0;
    const selected = options.map((option) => option.selected);
    const lineCount = options.length + 2;

    readline.emitKeypressEvents(process.stdin);
    process.stdin.setRawMode(true);
    process.stdin.resume();

    // Hide cursor during prompt
    process.stdout.write("\u001B[?25l");

    const render = (firstTime = false) => {
      if (!firstTime) {
        process.stdout.write(`\u001B[${lineCount}A\r`);
      }

      process.stdout.write(
        `\r\u001B[K  ${chalk.green("✔")} ${chalk.bold(question)}\n`
      );

      let i = 0;
      for (const option of options) {
        const isCursor = i === index;
        const cursor = isCursor ? chalk.cyan("❯ ") : "  ";
        const box = selected[i] ? chalk.cyan("[x]") : chalk.dim("[ ]");
        let text = chalk.dim(option.label);
        if (isCursor) {
          text = chalk.cyan.bold(option.label);
        } else if (selected[i]) {
          text = option.label;
        }
        process.stdout.write(`\r\u001B[K${cursor}${box} ${text}\n`);
        i += 1;
      }
      process.stdout.write(
        `\r\u001B[K  ${chalk.dim("space to toggle · enter to confirm")}\n`
      );
    };

    render(true);

    const handleKeypress = (str: string, key: KeypressKey) => {
      const cleanup = () => {
        process.stdin.removeListener("keypress", handleKeypress);
        if (process.stdin.isTTY) {
          process.stdin.setRawMode(false);
        }
        process.stdin.pause();
        process.stdout.write("\u001B[?25h");
      };

      if (key.name === "up" || key.name === "k") {
        index = (index - 1 + options.length) % options.length;
        render();
      } else if (key.name === "down" || key.name === "j") {
        index = (index + 1) % options.length;
        render();
      } else if (key.name === "space" || str === " ") {
        selected[index] = !selected[index];
        render();
      } else if (
        key.name === "return" ||
        key.name === "enter" ||
        str === "\r" ||
        str === "\n"
      ) {
        cleanup();
        const chosen = options.flatMap((option, i) =>
          selected[i] ? [option.label] : []
        );
        // Overwrite the prompt with a one-line summary
        process.stdout.write(`\u001B[${lineCount}A\r\u001B[K`);
        process.stdout.write(
          `  ${chalk.green("✔")} ${chalk.bold(question)} › ${chosen.length > 0 ? chalk.cyan(chosen.join(", ")) : chalk.dim("none")}\n`
        );
        for (let i = 0; i < lineCount - 1; i += 1) {
          process.stdout.write("\r\u001B[K\n");
        }
        process.stdout.write(`\u001B[${lineCount - 1}A`);
        resolve(options.flatMap((_, i) => (selected[i] ? [i] : [])));
      } else if (key.ctrl && key.name === "c") {
        cleanup();
        process.stdout.write("\n");
        process.exit(130);
      }
    };

    process.stdin.on("keypress", handleKeypress);
  });
  /* eslint-enable promise/avoid-new */
};

const printAgentPrompt = (payload: string): void => {
  console.log(`\n${chalk.dim("──── Agent prompt ────")}`);
  console.log(payload);
  console.log(chalk.dim("──────────────────────"));
};

interface WizardContext {
  diagnostics: Diagnostic[];
  report: JsonReport;
  rootDir: string;
}

// getSkillAgentConfig rejects the synthetic "universal" id at the type level.
const agentDisplayName = (agent: SkillAgentType): string =>
  agent === "universal" ? "Universal" : getSkillAgentConfig(agent).displayName;

// Post-scan handoff: offer to send the findings to a coding agent detected on
// this machine (launching it with the issues as its prompt), or copy the
// prompt for any other agent. Only reached when the scan found something.
const runAgentHandoff = async (context: WizardContext): Promise<void> => {
  const launchable = detectLaunchableAgents();
  const options = [
    ...launchable.map((agentId) => agentDisplayName(agentId)),
    "Copy prompt to clipboard",
    "Skip",
  ];
  const skipIndex = options.length - 1;
  const clipboardIndex = options.length - 2;

  const choice = await askSelect("What would you like to do next?", options);
  if (choice === skipIndex) {
    return;
  }

  await writeDiagnosticsDirectory(
    context.diagnostics,
    context.report,
    context.rootDir
  );
  await ensureGitignoreEntry(context.rootDir);

  const payload = buildHandoffPayload({
    diagnostics: context.diagnostics,
    projectName: path.basename(context.rootDir),
  });

  if (choice === clipboardIndex) {
    const copied = await copyToClipboard(payload);
    if (copied) {
      console.log(
        `\n  ${chalk.green("✔")} Prompt copied — paste it into any agent or chat.`
      );
    } else {
      printAgentPrompt(payload);
    }
    return;
  }

  const agentId = launchable[choice];
  const installResult = await installSkillForAgents([agentId], context.rootDir);
  if (installResult && installResult.installed.length > 0) {
    console.log(
      `\n  ${chalk.green("✔")} Installed the docker-doctor skill for ${agentDisplayName(agentId)}`
    );
  }
  console.log(`\n  Handing off to ${agentDisplayName(agentId)}...\n`);
  const launched = await launchAgent(agentId, payload);
  if (!launched) {
    console.log(
      `  ${chalk.yellow("⚠")} Couldn't launch ${AGENT_BINARIES[agentId]}. Here's the prompt instead:`
    );
    printAgentPrompt(payload);
  }
};

const runInteractiveWizard = async (context: WizardContext): Promise<void> => {
  try {
    const addGhActions = await askConfirm(
      "Add Docker Doctor to GitHub Actions?"
    );
    if (addGhActions) {
      const workflowDir = path.resolve(".github/workflows");
      await fs.mkdir(workflowDir, { recursive: true });
      const workflowPath = path.join(workflowDir, "docker-doctor.yml");
      const workflowYaml = `name: Docker Doctor
on:
  pull_request:
permissions:
  contents: read
  pull-requests: write
  issues: write
jobs:
  docker-doctor:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v5
      - uses: ${ACTION_REF}
`;
      await fs.writeFile(workflowPath, workflowYaml, "utf-8");
      console.log(
        `\n  ${chalk.green("✨")} Created ${chalk.cyan(".github/workflows/docker-doctor.yml")}!`
      );
      console.log(
        `    Every pull request gets a scan and a sticky summary comment — advisory by default.`
      );
      console.log(
        `    Inputs and gating: ${chalk.cyan("https://docker-doctor.vercel.app/docs/guides/github-actions")}`
      );
    }

    if (context.diagnostics.length === 0) {
      return;
    }
    await runAgentHandoff(context);
  } catch {
    // Ignore prompt errors
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

const filterDiagnostics = (
  diagnostics: Diagnostic[],
  categories?: Record<string, RuleSeverity>
): Diagnostic[] => {
  if (!categories) {
    return diagnostics;
  }
  return diagnostics.filter((d) => {
    const ruleDef = findRule(d.rule);
    if (ruleDef) {
      const catSeverity = categories[ruleDef.category];
      if (catSeverity === "off") {
        return false;
      }
    }
    return true;
  });
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
    const isSilent = options.score || options.json;

    // Helper to safely show terminal cursor
    const restoreCursor = (): void => {
      if (process.stdout.isTTY && !isSilent) {
        process.stdout.write("\u001B[?25h");
      }
    };

    // Set signal handlers to restore cursor on aborts
    process.on("exit", restoreCursor);
    process.once("SIGINT", () => {
      restoreCursor();
      process.exit(130);
    });
    process.once("SIGTERM", () => {
      restoreCursor();
      process.exit(143);
    });

    try {
      const rootDir = path.resolve(dir);
      const startTime = Date.now();

      let statusText = "Discovering workspace...";
      const spinnerFrames = ["⠋", "⠙", "⠹", "⠸", "⠼", "⠴", "⠦", "⠧", "⠇", "⠏"];
      let frameIndex = 0;
      let spinnerInterval: NodeJS.Timeout | null = null;

      const setStatus = (text: string) => {
        statusText = text;
      };

      if (process.stdout.isTTY && !isSilent) {
        // Hide cursor during progress/spinner
        process.stdout.write("\u001B[?25l");
        process.stdout.write(`${chalk.cyan(spinnerFrames[0])} ${statusText}`);
        spinnerInterval = setInterval(() => {
          process.stdout.write(
            `\r\u001B[K${chalk.cyan(spinnerFrames[frameIndex])} ${statusText}`
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
          ...(project.dockerignores || []),
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
        const filteredDiagnostics = filterDiagnostics(
          diagnostics,
          config.categories
        );

        // Calculate score
        const { score, label } = calculateScore(filteredDiagnostics);

        const duration = ((Date.now() - startTime) / 1000).toFixed(1);
        const concurrency = os.cpus().length;

        if (spinnerInterval !== null) {
          clearInterval(spinnerInterval);
          spinnerInterval = null;
          // Clear spinner line and restore cursor
          process.stdout.write("\r\u001B[K\u001B[?25h");
        }

        if (process.stdout.isTTY && !isSilent) {
          console.log(
            `${chalk.green("✔")} Scanned ${projectFilesList.length} files in ${duration}s [~${concurrency} workers]`
          );
        }

        if (options.score) {
          console.log(score);
          process.exitCode = score < 50 ? 1 : 0;
          return;
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
          process.exitCode = hasErrors ? 1 : 0;
          return;
        }
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

        if (process.stdout.isTTY && process.stdin.isTTY) {
          await runInteractiveWizard({
            diagnostics: filteredDiagnostics,
            report: toJsonReport(filteredDiagnostics, score, label, project),
            rootDir,
          });
        }
        process.exitCode = hasErrors ? 1 : 0;
      } finally {
        if (spinnerInterval !== null) {
          clearInterval(spinnerInterval);
          process.stdout.write("\r\u001B[K\u001B[?25h");
        }
      }
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : String(error);
      console.error(`Error: ${msg}`);
      process.exit(1);
    }
  });

// Curated picker entries shown alongside whatever agents are detected on this
// machine — any other agent-install id still works via --agent.
const CURATED_INSTALL_AGENTS: SkillAgentType[] = [
  "claude-code",
  "codex",
  "cursor",
  "opencode",
];

const resolveInstallAgents = async (
  requested: string[] | undefined
): Promise<SkillAgentType[] | null> => {
  if (requested && requested.length > 0) {
    const invalid = requested.filter((agent) => !isSkillAgentType(agent));
    if (invalid.length > 0) {
      console.error(`Unknown agent id(s): ${invalid.join(", ")}`);
      console.error(
        `Valid ids: ${getSkillAgentTypes()
          .filter((agent) => agent !== "universal")
          .join(", ")}`
      );
      return null;
    }
    return requested.filter((agent) => isSkillAgentType(agent));
  }

  if (!(process.stdin.isTTY && process.stdout.isTTY)) {
    console.error(
      "Non-interactive run: pass --agent <id...> (e.g. --agent claude-code cursor)."
    );
    return null;
  }

  const installedAgents = await detectInstalledSkillAgents();
  const detected = installedAgents.filter((agent) => agent !== "universal");
  const choices = [...new Set([...detected, ...CURATED_INSTALL_AGENTS])];
  const detectedSet = new Set<SkillAgentType>(detected);
  const picked = await askMultiSelect(
    "Which coding agents should get the docker-doctor skill?",
    choices.map((agent) => ({
      label: agentDisplayName(agent),
      selected: detectedSet.has(agent),
    }))
  );
  return picked.map((i) => choices[i]);
};

program
  .command("install")
  .description("install the Docker Doctor agent skill for your coding agents")
  .option(
    "-a, --agent <agents...>",
    "agent id(s) to install for (e.g. claude-code codex cursor)"
  )
  .action(async (options: { agent?: string[] }) => {
    const source = getSkillSourceDirectory();
    if (!source) {
      console.error(
        "Bundled skill not found — this looks like a broken installation."
      );
      process.exit(1);
    }

    const agents = await resolveInstallAgents(options.agent);
    if (agents === null) {
      process.exit(1);
    }
    if (agents.length === 0) {
      console.log("Nothing selected — skipped.");
      return;
    }

    const result = await installSkillForAgents(agents, process.cwd());
    if (!result) {
      console.error("Failed to install the skill.");
      process.exit(1);
    }
    for (const installed of result.installed) {
      console.log(
        `  ${chalk.green("✔")} ${agentDisplayName(installed.agent)} → ${installed.path}`
      );
    }
    for (const failed of result.failed) {
      console.log(
        `  ${chalk.red("✖")} ${agentDisplayName(failed.agent)}: ${failed.error}`
      );
    }
    if (result.installed.length > 0) {
      console.log(
        `\n  The agent can now run ${chalk.cyan("/docker-doctor")} to scan and triage this project.`
      );
    }
    process.exitCode = result.failed.length > 0 ? 1 : 0;
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
