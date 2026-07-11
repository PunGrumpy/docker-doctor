import { setTimeout } from "node:timers/promises";

import type { Diagnostic, ProjectInfo } from "@docker-doctor/core";
import { findRule } from "@docker-doctor/core";
import chalk from "chalk";

const printCodeFrame = (
  content: string | undefined,
  line: number | undefined,
  severityColor: (msg: string) => string
): void => {
  if (!content || !line) {
    return;
  }
  const lines = content.split(/\r?\n/u);
  const start = Math.max(1, line - 1);
  const end = Math.min(lines.length, line + 1);

  for (let i = start; i <= end; i += 1) {
    const rawLine = lines[i - 1];
    const isTarget = i === line;
    const lineNumberStr = String(i).padStart(5, " ");
    if (isTarget) {
      console.log(
        `  ${severityColor(">")} ${chalk.bold(lineNumberStr)} │ ${chalk.white(rawLine)}`
      );
    } else {
      console.log(`    ${chalk.dim(lineNumberStr)} │ ${chalk.dim(rawLine)}`);
    }
  }
  console.log();
};

const printDiscoveredFiles = (project: ProjectInfo): void => {
  console.log(`\nDiscovered Files:`);
  console.log(
    `  Dockerfile(s): ${project.dockerfiles.length ? project.dockerfiles.map((f) => chalk.cyan(f)).join(", ") : chalk.dim("None")}`
  );
  console.log(
    `  Compose file(s):  ${project.composeFiles.length ? project.composeFiles.map((f) => chalk.cyan(f)).join(", ") : chalk.dim("None")}`
  );
};

const printDiagnostics = (
  diagnostics: Diagnostic[],
  verbose: boolean,
  fileContents: Record<string, string>,
  categoryIssueCounts: Record<string, number>
): void => {
  if (diagnostics.length === 0) {
    console.log(
      `\n${chalk.green.bold("✔ No issues found! Your Docker setup looks healthy.")}`
    );
    return;
  }

  if (!verbose) {
    console.log(`\n  All ${chalk.bold(diagnostics.length)} issues\n`);

    const categories = [
      "Security",
      "Performance",
      "Best Practices",
      "Compose",
      "Image Size",
    ];

    for (const cat of categories) {
      const count = categoryIssueCounts[cat];
      const issueLabel = count === 1 ? "1 issue" : `${count} issues`;
      console.log(`  ${cat} › ${chalk.dim(issueLabel)}`);
    }

    console.log(
      `\n  Run ${chalk.cyan("docker-doctor --verbose")} to list every error and warning`
    );

    // Migration-scale checks
    const ruleCounts: Record<string, number> = {};
    for (const d of diagnostics) {
      ruleCounts[d.rule] = (ruleCounts[d.rule] || 0) + 1;
    }
    const migrationRules = Object.entries(ruleCounts).filter(
      ([_, count]) => count >= 5
    );
    if (migrationRules.length > 0) {
      console.log();
      console.log(
        `  ${chalk.yellow("⚠ Migration-scale change: sample before you sweep")}`
      );
      for (const [rule, count] of migrationRules) {
        console.log(`    ${chalk.cyan(rule)} ×${count} across ${count} files`);
      }
      console.log(
        `    Fixing all of them at once is hard to review and prone to`
      );
      console.log(
        `    subtle mistakes across the whole repo. Fix a representative`
      );
      console.log(
        `    few first and confirm the recipe holds. Then get the code`
      );
      console.log(`    owner's sign-off before changing the rest.`);
      console.log(`    Scope it down one area at a time: docker-doctor <path>`);
    }
    return;
  }

  console.log(`\nFound ${chalk.bold(diagnostics.length)} issue(s):`);

  // Group by file
  const filesGrouped: Record<string, Diagnostic[]> = {};
  for (const d of diagnostics) {
    if (!filesGrouped[d.file]) {
      filesGrouped[d.file] = [];
    }
    filesGrouped[d.file].push(d);
  }

  for (const [file, fileDiags] of Object.entries(filesGrouped)) {
    console.log(`\n${chalk.underline.bold(file)}`);
    for (const d of fileDiags) {
      let sevColor = chalk.cyan;
      let prefix = "ℹ INFO";
      if (d.severity === "error") {
        sevColor = chalk.red.bold;
        prefix = "✖ ERROR";
      } else if (d.severity === "warning") {
        sevColor = chalk.yellow;
        prefix = "⚠ WARN";
      }

      const lineInfo = d.line ? `:${d.line}` : "";
      console.log(`  ${sevColor(prefix)} [${chalk.dim(d.rule)}]${lineInfo}`);

      // Print Code Frame
      const content = fileContents[file];
      printCodeFrame(content, d.line, sevColor);

      console.log(`    ${chalk.white(d.message)}`);
      console.log(`    ${chalk.dim("Help:")} ${d.help}`);
      console.log();
    }
  }
};

const getWhaleMascot = (
  score: number,
  border: (text: string) => string
): string[] => {
  let eyes = "x x";
  let spout = "        ";
  if (score >= 75) {
    eyes = "◠ ◠";
    spout = chalk.cyan('  ":"   ');
  } else if (score >= 50) {
    eyes = "• •";
    spout = chalk.cyan("   .    ");
  }

  return [
    spout,
    border(" .---.  "),
    border(`( ${eyes} )>`),
    border(" \\___/  "),
  ];
};

const easeOutCubic = (x: number): number => 1 - (1 - x) ** 3;

const printScoreBox = async (
  score: number,
  label: string,
  categoryIssueCounts: Record<string, number>
): Promise<void> => {
  const { isTTY } = process.stdout;
  const shouldAnimate =
    isTTY &&
    !process.env.CI &&
    !process.env.NO_ANIMATION &&
    process.env.TERM !== "dumb" &&
    process.env.NODE_ENV !== "test";

  let scoreColor = chalk.red.bold;
  if (score >= 90) {
    scoreColor = chalk.green.bold;
  } else if (score >= 75) {
    scoreColor = chalk.yellow.bold;
  } else if (score >= 50) {
    scoreColor = chalk.magenta.bold;
  }
  const border = scoreColor;
  const whaleLines = getWhaleMascot(score, border);

  const totalIssues = Object.values(categoryIssueCounts).reduce(
    (a, b) => a + b,
    0
  );
  const shareUrl = `https://github.com/PunGrumpy/docker-doctor/share?s=${score}&w=${totalIssues}`;

  if (shouldAnimate) {
    const frameCount = 20;
    // 15ms * 20 = 300ms
    const frameDelay = 15;

    // Hide cursor
    process.stdout.write("\u001B[?25l");
    try {
      for (let frame = 0; frame <= frameCount; frame += 1) {
        const progress = easeOutCubic(frame / frameCount);
        const currentScore = Math.round(score * progress);
        const filledBlocks = Math.round(currentScore / 2);
        const emptyBlocks = 50 - filledBlocks;

        const bar =
          scoreColor("█".repeat(filledBlocks)) +
          chalk.dim("░".repeat(emptyBlocks));

        if (frame > 0) {
          // Move cursor up 4 lines and carriage return
          process.stdout.write("\u001B[4A\r");
        } else {
          // print an extra newline first to start
          console.log();
        }

        process.stdout.write(
          `  ${whaleLines[0]}  ${scoreColor(`${currentScore} / 100`)} ${scoreColor(label)}\n` +
            `  ${whaleLines[1]}  ${bar}\n` +
            `  ${whaleLines[2]}  ${chalk.dim("Docker Doctor (https://github.com/PunGrumpy/docker-doctor)")}\n` +
            `  ${whaleLines[3]}\n`
        );

        if (frame < frameCount) {
          // eslint-disable-next-line no-await-in-loop
          await setTimeout(frameDelay);
        }
      }
    } finally {
      // Show cursor
      process.stdout.write("\u001B[?25h");
    }
  } else {
    // Non-TTY fall back to static print
    const filledBlocks = Math.round(score / 2);
    const emptyBlocks = 50 - filledBlocks;
    const bar =
      scoreColor("█".repeat(filledBlocks)) + chalk.dim("░".repeat(emptyBlocks));

    console.log(
      `\n  ${whaleLines[0]}  ${scoreColor(`${score} / 100`)} ${scoreColor(label)}`
    );
    console.log(`  ${whaleLines[1]}  ${bar}`);
    console.log(
      `  ${whaleLines[2]}  ${chalk.dim("Docker Doctor (https://github.com/PunGrumpy/docker-doctor)")}`
    );
    console.log(`  ${whaleLines[3]}`);
  }

  console.log(
    `\n  ${chalk.dim("────────────────────────────────────────────────────────────")}\n`
  );
  console.log(`  Share: ${chalk.cyan(shareUrl)}`);
  console.log(`  Tell others how you did on socials\n`);
  console.log(
    `  Docs: ${chalk.cyan("https://github.com/PunGrumpy/docker-doctor/docs")}`
  );
  console.log(`  Learn more about fixing issues, setting up CI/CD, and`);
  console.log(`  configuring rules with a config file\n`);
  console.log(
    `  GitHub: ${chalk.cyan("https://github.com/PunGrumpy/docker-doctor")}`
  );
  console.log(`  Report issues and star the repository!`);
};

export const formatTerminal = async (
  diagnostics: Diagnostic[],
  score: number,
  label: string,
  project: ProjectInfo,
  verbose = false,
  fileContents: Record<string, string> = {}
): Promise<void> => {
  if (verbose) {
    console.log(`\n${chalk.bold("Docker Doctor Diagnostics")}`);
    console.log(`=================================`);
    printDiscoveredFiles(project);
  }

  // Calculate scores per category once
  const categoryIssueCounts: Record<string, number> = {
    "Best Practices": 0,
    Compose: 0,
    "Image Size": 0,
    Performance: 0,
    Security: 0,
  };

  for (const d of diagnostics) {
    const ruleDef = findRule(d.rule);
    const category = ruleDef?.category || "Best Practices";
    categoryIssueCounts[category] = (categoryIssueCounts[category] || 0) + 1;
  }

  printDiagnostics(diagnostics, verbose, fileContents, categoryIssueCounts);

  await printScoreBox(score, label, categoryIssueCounts);
};
