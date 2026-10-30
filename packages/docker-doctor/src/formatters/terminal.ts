import { setTimeout } from "node:timers/promises";

import type {
  Diagnostic,
  ProjectInfo,
  RuleCategory,
} from "@docker-doctor/core";
import { findRule, redactSecrets } from "@docker-doctor/core";
import chalk from "chalk";

import { cursorUp, HIDE_CURSOR, SHOW_CURSOR } from "../terminal-control";
import { hasText } from "../text";

const isLineNumber = (line: number | undefined): line is number =>
  line !== undefined && line !== 0 && !Number.isNaN(line);

const printCodeFrame = (
  content: string | undefined,
  line: number | undefined,
  severityColor: (msg: string) => string
): void => {
  if (!hasText(content) || !isLineNumber(line)) {
    return;
  }

  const lines = content.split(/\r?\n/u);
  const start = Math.max(1, line - 1);
  const end = Math.min(lines.length, line + 1);

  for (let i = start; i <= end; i += 1) {
    // The frame quotes the file itself, so a secret the rules flagged would
    // print here as written.
    const rawLine = redactSecrets(lines[i - 1]);
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

const printMigrationWarning = (diagnostics: Diagnostic[]): void => {
  const findingsByRule = new Map<
    string,
    { count: number; files: Set<string> }
  >();

  for (const d of diagnostics) {
    const findings = findingsByRule.get(d.rule) ?? {
      count: 0,
      files: new Set<string>(),
    };

    findings.count += 1;
    findings.files.add(d.file);
    findingsByRule.set(d.rule, findings);
  }

  const migrationRules = [...findingsByRule].filter(
    ([, { count }]) => count >= 5
  );

  if (migrationRules.length > 0) {
    console.log();
    console.log(
      `  ${chalk.yellow("⚠ Migration-scale change: sample before you sweep")}`
    );

    for (const [rule, { count, files }] of migrationRules) {
      const fileWord = files.size === 1 ? "file" : "files";
      console.log(
        `    ${chalk.cyan(rule)} ×${count} across ${files.size} ${fileWord}`
      );
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
};

const printCategorySummary = (
  diagnostics: Diagnostic[],
  categoryIssueCounts: Record<string, number>
): void => {
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

  printMigrationWarning(diagnostics);
};

const printDiagnosticsByFile = (
  diagnostics: Diagnostic[],
  fileContents: Record<string, string>
): void => {
  console.log(`\nFound ${chalk.bold(diagnostics.length)} issue(s):`);

  const filesGrouped = new Map<string, Diagnostic[]>();

  for (const d of diagnostics) {
    const group = filesGrouped.get(d.file);

    if (group === undefined) {
      filesGrouped.set(d.file, [d]);
    } else {
      group.push(d);
    }
  }

  for (const [file, fileDiags] of filesGrouped) {
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

      const lineInfo = isLineNumber(d.line) ? `:${d.line}` : "";
      console.log(`  ${sevColor(prefix)} [${chalk.dim(d.rule)}]${lineInfo}`);

      const content = fileContents[file];
      printCodeFrame(content, d.line, sevColor);

      console.log(`    ${chalk.white(d.message)}`);
      console.log(`    ${chalk.dim("Help:")} ${d.help}`);
      console.log();
    }
  }
};

const printDiagnostics = (
  diagnostics: Diagnostic[],
  verbose: boolean,
  fileContents: Record<string, string>,
  categoryIssueCounts: Record<string, number>,
  failedFileCount: number
): void => {
  if (diagnostics.length === 0) {
    // "Healthy" is a claim about every discovered file, so an incomplete
    // scan does not make it.
    console.log(
      failedFileCount === 0
        ? `\n${chalk.green.bold("✔ No issues found! Your Docker setup looks healthy.")}`
        : `\n${chalk.yellow.bold("⚠ No issues found in the files that could be analyzed.")}`
    );

    return;
  }

  if (!verbose) {
    printCategorySummary(diagnostics, categoryIssueCounts);

    return;
  }

  printDiagnosticsByFile(diagnostics, fileContents);
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
  warningsCount: number,
  errorsCount: number,
  failedFileCount: number
): Promise<void> => {
  const { isTTY } = process.stdout;

  const animationTurnedOff =
    hasText(process.env.CI) || hasText(process.env.NO_ANIMATION);

  const canAnimate =
    process.env.TERM !== "dumb" && process.env.NODE_ENV !== "test";

  const shouldAnimate = isTTY && !animationTurnedOff && canAnimate;

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

  // The utm tags let site analytics separate the person who ran the scan
  // from the visitors who follow their shared link — without them both land
  // on /share as untagged direct traffic.
  const shareQuery = new URLSearchParams({
    e: String(errorsCount),
    s: String(score),
    utm_medium: "terminal",
    utm_source: "cli",
    w: String(warningsCount),
  });

  const shareUrl = `https://docker-doctor.vercel.app/share?${shareQuery.toString()}`;

  if (shouldAnimate) {
    const frameCount = 20;
    const frameDelay = 15;

    process.stdout.write(HIDE_CURSOR);

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
          process.stdout.write(`${cursorUp(whaleLines.length)}\r`);
        } else {
          console.log();
        }

        const scoreText = `${currentScore} / 100`;

        process.stdout.write(
          `  ${whaleLines[0]}  ${scoreColor(scoreText)} ${scoreColor(label)}\n` +
            `  ${whaleLines[1]}  ${bar}\n` +
            `  ${whaleLines[2]}  ${chalk.dim("Docker Doctor (https://docker-doctor.vercel.app)")}\n` +
            `  ${whaleLines[3]}\n`
        );

        if (frame < frameCount) {
          // eslint-disable-next-line no-await-in-loop -- each frame waits for the one before it
          await setTimeout(frameDelay);
        }
      }
    } finally {
      process.stdout.write(SHOW_CURSOR);
    }
  } else {
    const filledBlocks = Math.round(score / 2);
    const emptyBlocks = 50 - filledBlocks;

    const bar =
      scoreColor("█".repeat(filledBlocks)) + chalk.dim("░".repeat(emptyBlocks));

    const scoreText = `${score} / 100`;

    console.log(
      `\n  ${whaleLines[0]}  ${scoreColor(scoreText)} ${scoreColor(label)}`
    );
    console.log(`  ${whaleLines[1]}  ${bar}`);
    console.log(
      `  ${whaleLines[2]}  ${chalk.dim("Docker Doctor (https://docker-doctor.vercel.app)")}`
    );
    console.log(`  ${whaleLines[3]}`);
  }

  console.log(
    `\n  ${chalk.dim("────────────────────────────────────────────────────────────")}\n`
  );

  if (failedFileCount === 0) {
    console.log(`  Share: ${chalk.cyan(shareUrl)}`);
    console.log(`  Tell others how you did on socials\n`);
  } else {
    // The score covers only part of the project, so it is not one to share.
    const fileWord = failedFileCount === 1 ? "file" : "files";
    const warning = `⚠ Incomplete scan: ${failedFileCount} ${fileWord} could not be analyzed.`;

    console.log(`  ${chalk.yellow(warning)}`);
    console.log(`  The score covers only the analyzed files.\n`);
  }

  console.log(`  Docs: ${chalk.cyan("https://docker-doctor.vercel.app")}`);
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
  fileContents: Record<string, string> = {},
  failedFileCount = 0
): Promise<void> => {
  if (verbose) {
    console.log(`\n${chalk.bold("Docker Doctor Diagnostics")}`);
    console.log(`=================================`);
    printDiscoveredFiles(project);
  }

  const categoryIssueCounts = {
    "Best Practices": 0,
    Compose: 0,
    "Image Size": 0,
    Performance: 0,
    Security: 0,
  } satisfies Record<RuleCategory, number>;

  let warningsCount = 0;
  let errorsCount = 0;

  for (const d of diagnostics) {
    const category =
      d.category ?? findRule(d.rule)?.category ?? "Best Practices";

    categoryIssueCounts[category] = (categoryIssueCounts[category] || 0) + 1;

    if (d.severity === "warning") {
      warningsCount += 1;
    } else if (d.severity === "error") {
      errorsCount += 1;
    }
  }

  printDiagnostics(
    diagnostics,
    verbose,
    fileContents,
    categoryIssueCounts,
    failedFileCount
  );

  await printScoreBox(
    score,
    label,
    warningsCount,
    errorsCount,
    failedFileCount
  );
};
