/**
 * Renders a Docker Doctor JSON report into the sticky PR comment body,
 * mirrors it to the job summary, and writes step outputs (including the
 * gate status the final action step exits with).
 *
 * Inputs (env): DOCTOR_REPORT_FILE, DOCTOR_DIRECTORY, DOCTOR_BLOCKING,
 * DOCTOR_HEAD_SHA, plus the standard GITHUB_* / RUNNER_TEMP runner vars.
 */
import {
  appendFileSync,
  existsSync,
  readFileSync,
  writeFileSync,
} from "node:fs";
import path from "node:path";

const MARKER = "<!-- docker-doctor:summary -->";
const SITE_URL = "https://docker-doctor.vercel.app";
const MAX_ITEMS_PER_SECTION = 50;
const MAX_MESSAGE_LENGTH = 180;
const SHORT_SHA_LENGTH = 7;

const env = (name, fallback = "") => process.env[name] ?? fallback;

const reportFile = env("DOCTOR_REPORT_FILE");
const scanDirectory = env("DOCTOR_DIRECTORY", ".");
const blocking = env("DOCTOR_BLOCKING", "none");
const headSha = env("DOCTOR_HEAD_SHA");
const serverUrl = env("GITHUB_SERVER_URL", "https://github.com");
const repository = env("GITHUB_REPOSITORY");

const readReport = () => {
  if (!(reportFile && existsSync(reportFile))) {
    return null;
  }
  try {
    const parsed = JSON.parse(readFileSync(reportFile, "utf-8"));
    if (!Array.isArray(parsed.diagnostics)) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
};

const plural = (count, word) => `${count} ${word}${count === 1 ? "" : "s"}`;

const shortMessage = (message) => {
  const sentenceEnd = message.indexOf(". ");
  const firstSentence =
    sentenceEnd === -1 ? message : message.slice(0, sentenceEnd + 1);
  if (firstSentence.length <= MAX_MESSAGE_LENGTH) {
    return firstSentence;
  }
  return `${firstSentence.slice(0, MAX_MESSAGE_LENGTH)}…`;
};

const blobPath = (file) => {
  const joined = path.posix.join(
    scanDirectory.split(path.sep).join("/"),
    file.split(path.sep).join("/")
  );
  return joined.replace(/^(?:\.\/)+/u, "");
};

const diagnosticLine = (diagnostic, icon) => {
  const location = diagnostic.line
    ? `${diagnostic.file}:${diagnostic.line}`
    : diagnostic.file;
  const fragment = diagnostic.line ? `#L${diagnostic.line}` : "";
  const url = `${serverUrl}/${repository}/blob/${headSha}/${blobPath(diagnostic.file)}${fragment}`;
  const rule = diagnostic.rule.replace(/^docker-doctor\//u, "");
  return `- ${icon} [\`${location}\`](${url}) ${shortMessage(diagnostic.message)} \`${rule}\``;
};

const collapsedSection = (diagnostics, icon, summaryLabel) => {
  if (diagnostics.length === 0) {
    return "";
  }
  const byFile = new Map();
  for (const diagnostic of diagnostics.slice(0, MAX_ITEMS_PER_SECTION)) {
    const lines = byFile.get(diagnostic.file) ?? [];
    lines.push(diagnosticLine(diagnostic, icon));
    byFile.set(diagnostic.file, lines);
  }
  const groups = [...byFile.entries()].map(
    ([file, lines]) => `**\`${file}\`**\n${lines.join("\n")}`
  );
  const overflow = diagnostics.length - MAX_ITEMS_PER_SECTION;
  if (overflow > 0) {
    groups.push(`…and ${plural(overflow, "more")} not shown.`);
  }
  return `<details>\n<summary>${summaryLabel}</summary>\n\n${groups.join("\n\n")}\n\n</details>`;
};

const footer = () => {
  const shortSha = headSha.slice(0, SHORT_SHA_LENGTH);
  return `<sub>Scanned by <a href="${SITE_URL}">Docker Doctor</a> for commit <code>${shortSha}</code>.</sub>`;
};

const renderFailure = () => {
  const body = [
    MARKER,
    "**Docker Doctor** could not produce a scan report — check the workflow logs for the CLI output.",
    "",
    `<sub>If this looks like a bug, please <a href="https://github.com/PunGrumpy/docker-doctor/issues/new">open an issue</a>.</sub>`,
  ].join("\n");
  return {
    body,
    outputs: {
      "error-count": "0",
      "gate-status": "1",
      "info-count": "0",
      label: "",
      score: "0",
      "total-issues": "0",
      "warning-count": "0",
    },
  };
};

const gateStatus = (errorCount, warningCount) => {
  if (blocking === "error") {
    return errorCount > 0 ? "1" : "0";
  }
  if (blocking === "warning") {
    return errorCount + warningCount > 0 ? "1" : "0";
  }
  return "0";
};

const renderReport = (report) => {
  const errors = report.diagnostics.filter((d) => d.severity === "error");
  const warnings = report.diagnostics.filter((d) => d.severity === "warning");
  const infos = report.diagnostics.filter((d) => d.severity === "info");
  const total = report.diagnostics.length;
  const scannedFiles =
    report.project.dockerfiles.length + report.project.composeFiles.length;

  const lines = [MARKER];

  if (scannedFiles === 0) {
    lines.push(
      `**Docker Doctor** found no Dockerfiles or Compose files in \`${scanDirectory}\`.`
    );
  } else if (total === 0) {
    lines.push(
      `**Docker Doctor** found no issues in ${plural(scannedFiles, "file")} 🎉 · score ${report.score} / 100 (${report.label})`
    );
  } else {
    const affectedFiles = new Set(report.diagnostics.map((d) => d.file)).size;
    const counts = [
      errors.length > 0 ? plural(errors.length, "error") : "",
      warnings.length > 0 ? plural(warnings.length, "warning") : "",
      infos.length > 0 ? `${infos.length} info` : "",
    ]
      .filter(Boolean)
      .join(", ");
    lines.push(
      `**Docker Doctor** found **${plural(total, "issue")}** in ${plural(affectedFiles, "file")} · ${counts} · score ${report.score} / 100 (${report.label})`
    );

    if (errors.length > 0) {
      lines.push("");
      const shown = errors.slice(0, MAX_ITEMS_PER_SECTION);
      lines.push(...shown.map((d) => diagnosticLine(d, "❌")));
      if (errors.length > shown.length) {
        lines.push(
          `…and ${plural(errors.length - shown.length, "more error")} not shown.`
        );
      }
    }
    for (const section of [
      collapsedSection(warnings, "⚠️", plural(warnings.length, "warning")),
      collapsedSection(infos, "ℹ️", `${infos.length} info`),
    ]) {
      if (section) {
        lines.push("", section);
      }
    }
  }

  lines.push("", footer());

  return {
    body: lines.join("\n"),
    outputs: {
      "error-count": String(errors.length),
      "gate-status": gateStatus(errors.length, warnings.length),
      "info-count": String(infos.length),
      label: report.label,
      score: String(report.score),
      "total-issues": String(total),
      "warning-count": String(warnings.length),
    },
  };
};

const report = readReport();
const { body, outputs } = report ? renderReport(report) : renderFailure();

const commentFile = path.join(
  env("RUNNER_TEMP", "."),
  "docker-doctor-comment.md"
);
writeFileSync(commentFile, body);
outputs["comment-file"] = commentFile;

const githubOutput = env("GITHUB_OUTPUT");
if (githubOutput) {
  const serialized = Object.entries(outputs)
    .map(([key, value]) => `${key}=${value}`)
    .join("\n");
  appendFileSync(githubOutput, `${serialized}\n`);
}

const stepSummary = env("GITHUB_STEP_SUMMARY");
if (stepSummary) {
  appendFileSync(stepSummary, `${body}\n`);
}
