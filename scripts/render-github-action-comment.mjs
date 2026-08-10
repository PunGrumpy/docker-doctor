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
const MAX_TABLE_ROWS = 20;
const MAX_FINDING_LINES = 50;
const MAX_MESSAGE_LENGTH = 180;
const SHORT_SHA_LENGTH = 7;

const SEVERITY_RANK = { error: 3, info: 1, warning: 2 };

// Status dots are tiny SVG circles served from the site (same approach as
// Vercel's bot comments — https://vercel.com/static/status/ready.svg).
const statusDot = (kind, alt) =>
  `![${alt}](${SITE_URL}/static/status/${kind}.svg)`;
const STATUS_BY_SEVERITY = {
  error: `${statusDot("error", "Error")} Error`,
  info: `${statusDot("info", "Info")} Info`,
  warning: `${statusDot("warning", "Warning")} Warning`,
};
const ICON_BY_SEVERITY = {
  error: statusDot("error", "error"),
  info: statusDot("info", "info"),
  warning: statusDot("warning", "warning"),
};
const CLEAN_STATUS = `${statusDot("clean", "Clean")} Clean`;

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

const intro = `The latest Docker Doctor scan for this pull request. Learn more about [Docker Doctor](${SITE_URL}).`;

const shortMessage = (message) => {
  const sentenceEnd = message.indexOf(". ");
  const firstSentence =
    sentenceEnd === -1 ? message : message.slice(0, sentenceEnd + 1);
  if (firstSentence.length <= MAX_MESSAGE_LENGTH) {
    return firstSentence;
  }
  return `${firstSentence.slice(0, MAX_MESSAGE_LENGTH)}…`;
};

const blobUrl = (file, line) => {
  const joined = path.posix
    .join(
      scanDirectory.split(path.sep).join("/"),
      file.split(path.sep).join("/")
    )
    .replace(/^(?:\.\/)+/u, "");
  const fragment = line ? `#L${line}` : "";
  return `${serverUrl}/${repository}/blob/${headSha}/${joined}${fragment}`;
};

const formatTimestamp = (iso) => {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) {
    return "";
  }
  const day = new Intl.DateTimeFormat("en-US", {
    day: "numeric",
    month: "short",
    timeZone: "UTC",
    year: "numeric",
  }).format(date);
  const time = new Intl.DateTimeFormat("en-US", {
    hour: "numeric",
    hour12: true,
    minute: "2-digit",
    timeZone: "UTC",
  })
    .format(date)
    .replace(" AM", "am")
    .replace(" PM", "pm");
  return `${day} ${time}`;
};

const countSummary = (diagnostics) => {
  const counts = { error: 0, info: 0, warning: 0 };
  for (const diagnostic of diagnostics) {
    counts[diagnostic.severity] += 1;
  }
  const parts = [
    counts.error > 0 ? plural(counts.error, "error") : "",
    counts.warning > 0 ? plural(counts.warning, "warning") : "",
    counts.info > 0 ? `${counts.info} info` : "",
  ].filter(Boolean);
  return parts.length > 0 ? parts.join(", ") : "—";
};

const fileRow = (file, diagnostics, updated) => {
  let worst = 0;
  for (const diagnostic of diagnostics) {
    worst = Math.max(worst, SEVERITY_RANK[diagnostic.severity] ?? 0);
  }
  const status =
    worst === 0
      ? CLEAN_STATUS
      : STATUS_BY_SEVERITY[
          Object.keys(SEVERITY_RANK).find((s) => SEVERITY_RANK[s] === worst)
        ];
  return {
    markdown: `| [\`${file}\`](${blobUrl(file)}) | ${status} | ${countSummary(diagnostics)} | ${updated} |`,
    worst,
  };
};

const TABLE_HEADER = [
  "| File | Status | Issues | Updated (UTC) |",
  "| :--- | :----- | :----- | :------------ |",
];

const buildTable = (report) => {
  const byFile = new Map();
  for (const file of [
    ...report.project.dockerfiles,
    ...report.project.composeFiles,
  ]) {
    byFile.set(file, []);
  }
  for (const diagnostic of report.diagnostics) {
    const list = byFile.get(diagnostic.file) ?? [];
    list.push(diagnostic);
    byFile.set(diagnostic.file, list);
  }
  const updated = formatTimestamp(report.timestamp);
  const rows = [...byFile.entries()]
    .map(([file, diagnostics]) => fileRow(file, diagnostics, updated))
    .toSorted((a, b) => b.worst - a.worst);

  const lines = [
    ...TABLE_HEADER,
    ...rows.slice(0, MAX_TABLE_ROWS).map((row) => row.markdown),
  ];
  const overflow = rows.slice(MAX_TABLE_ROWS);
  if (overflow.length > 0) {
    lines.push(
      "",
      "<details>",
      `<summary>${plural(overflow.length, "more file")}</summary>`,
      "",
      ...TABLE_HEADER,
      ...overflow.map((row) => row.markdown),
      "",
      "</details>"
    );
  }
  return lines;
};

const findingLine = (diagnostic) => {
  const location = diagnostic.line
    ? `${diagnostic.file}:${diagnostic.line}`
    : diagnostic.file;
  const rule = diagnostic.rule.replace(/^docker-doctor\//u, "");
  return `- ${ICON_BY_SEVERITY[diagnostic.severity] ?? "•"} [\`${location}\`](${blobUrl(diagnostic.file, diagnostic.line)}) ${shortMessage(diagnostic.message)} \`${rule}\``;
};

const findingsSection = (report, hasErrors) => {
  const sorted = [...report.diagnostics].toSorted(
    (a, b) =>
      a.file.localeCompare(b.file) ||
      (SEVERITY_RANK[b.severity] ?? 0) - (SEVERITY_RANK[a.severity] ?? 0) ||
      (a.line ?? 0) - (b.line ?? 0)
  );
  const byFile = new Map();
  for (const diagnostic of sorted.slice(0, MAX_FINDING_LINES)) {
    const lines = byFile.get(diagnostic.file) ?? [];
    lines.push(findingLine(diagnostic));
    byFile.set(diagnostic.file, lines);
  }
  const groups = [...byFile.entries()].map(
    ([file, lines]) => `**\`${file}\`**\n${lines.join("\n")}`
  );
  const overflow = sorted.length - MAX_FINDING_LINES;
  if (overflow > 0) {
    groups.push(`…and ${plural(overflow, "more finding")} not shown.`);
  }
  // Auto-expand when there are errors so they are never buried.
  return [
    hasErrors ? "<details open>" : "<details>",
    `<summary>${plural(sorted.length, "issue")}</summary>`,
    "",
    groups.join("\n\n"),
    "",
    "</details>",
  ];
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

  const lines = [MARKER, intro, ""];

  if (scannedFiles === 0) {
    lines.push(
      `**Docker Doctor** found no Dockerfiles or Compose files in \`${scanDirectory}\`.`
    );
  } else {
    lines.push(
      ...buildTable(report),
      "",
      `**Score:** ${report.score} / 100 (${report.label})`
    );
    if (total > 0) {
      lines.push("", ...findingsSection(report, errors.length > 0));
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
