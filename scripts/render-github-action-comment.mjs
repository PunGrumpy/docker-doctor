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

// Diagnostic messages and file paths embed content from the scanned repo
// (rule messages quote Dockerfile lines verbatim). Everything interpolated
// into the comment body or step outputs must pass through one of these.
const sanitizeText = (value) =>
  String(value)
    // control chars (incl. newlines and ANSI escapes) -> single space
    // Intentional: strips control chars from untrusted content.
    // oxlint-disable-next-line no-control-regex
    .replaceAll(/[\u0000-\u001F\u007F]+/gu, " ")
    // neutralize markdown/HTML structure
    .replaceAll("`", "'")
    .replaceAll("|", "\\|")
    .replaceAll("<", "&lt;")
    .replaceAll("[", "\\[")
    .replaceAll("]", "\\]");

// encodeURIComponent leaves "(" and ")" unescaped (they're in its
// unreserved set), which defeats the point here — an unmatched ")" in a
// filename can still close a markdown link early. Map those two explicitly.
const URL_ESCAPES = { "(": "%28", ")": "%29" };
const sanitizeUrlPart = (value) =>
  String(value).replaceAll(
    /[\s()<>`]/gu,
    (c) => URL_ESCAPES[c] ?? encodeURIComponent(c)
  );

const SEVERITY_RANK = { error: 3, info: 1, warning: 2 };

// Status dots are tiny SVG circles served from the site (same approach as
// Vercel's bot comments — https://vercel.com/static/status/ready.svg).
// Empty alt when a text label sits next to the dot (it is decorative there);
// a real alt only where the dot is the sole severity cue.
const statusDot = (kind, alt = "") =>
  `![${alt}](${SITE_URL}/status/${kind}.svg)`;
const STATUS_BY_SEVERITY = {
  error: `${statusDot("error")} Error`,
  info: `${statusDot("info")} Info`,
  warning: `${statusDot("warning")} Warning`,
};
const ICON_BY_SEVERITY = {
  error: statusDot("error", "error"),
  info: statusDot("info", "info"),
  warning: statusDot("warning", "warning"),
};
const CLEAN_STATUS = `${statusDot("clean")} Clean`;

// Score buckets get their own dots, colored to match the badge palette.
const SCORE_DOT_BY_LABEL = {
  Critical: "critical",
  Excellent: "excellent",
  Good: "good",
  "Needs Work": "needs-work",
};

const scoreLine = ({ errors, label, score, warnings }) => {
  // CLI labels carry a trailing emoji ("Good ✅") — keep only the text.
  const text = label.replaceAll(/[^ -~]/gu, "").trim();
  const dot = SCORE_DOT_BY_LABEL[text];
  const status = dot ? `${statusDot(dot)} ${text}` : text;
  // Same share URL the CLI prints after a terminal scan.
  const shareUrl = `${SITE_URL}/share?s=${score}&w=${warnings}&e=${errors}`;
  return `**Score:** [${score} / 100](${shareUrl}) · ${status}`;
};

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

const INTRO = `The latest Docker Doctor scan for this pull request. Learn more about [Docker Doctor](${SITE_URL}).`;

const groupByFile = (diagnostics, seedFiles = []) => {
  const byFile = new Map(seedFiles.map((file) => [file, []]));
  for (const diagnostic of diagnostics) {
    const list = byFile.get(diagnostic.file) ?? [];
    list.push(diagnostic);
    byFile.set(diagnostic.file, list);
  }
  return byFile;
};

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
  return `${serverUrl}/${repository}/blob/${headSha}/${sanitizeUrlPart(joined)}${fragment}`;
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
  let worst = null;
  for (const { severity } of diagnostics) {
    if ((SEVERITY_RANK[severity] ?? 0) > (SEVERITY_RANK[worst] ?? 0)) {
      worst = severity;
    }
  }
  const status = worst ? STATUS_BY_SEVERITY[worst] : CLEAN_STATUS;
  return {
    markdown: `| [\`${sanitizeText(file)}\`](${blobUrl(file)}) | ${status} | ${countSummary(diagnostics)} | ${updated} |`,
    worst: SEVERITY_RANK[worst] ?? 0,
  };
};

const TABLE_HEADER = [
  "| File | Status | Issues | Updated (UTC) |",
  "| :--- | :----- | :----- | :------------ |",
];

const buildTable = (report) => {
  const byFile = groupByFile(report.diagnostics, [
    ...report.project.dockerfiles,
    ...report.project.composeFiles,
  ]);
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
  return `- ${ICON_BY_SEVERITY[diagnostic.severity] ?? "•"} [\`${sanitizeText(location)}\`](${blobUrl(diagnostic.file, diagnostic.line)}) ${sanitizeText(shortMessage(diagnostic.message))} \`${sanitizeText(rule)}\``;
};

const findingsSection = (report, hasErrors) => {
  const sorted = [...report.diagnostics].toSorted(
    (a, b) =>
      a.file.localeCompare(b.file) ||
      (SEVERITY_RANK[b.severity] ?? 0) - (SEVERITY_RANK[a.severity] ?? 0) ||
      (a.line ?? 0) - (b.line ?? 0)
  );
  const byFile = groupByFile(sorted.slice(0, MAX_FINDING_LINES));
  const groups = [...byFile.entries()].map(
    ([file, diagnostics]) =>
      `**\`${sanitizeText(file)}\`**\n${diagnostics.map(findingLine).join("\n")}`
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

// The report JSON is untrusted (fork PR content), so `label` is allowlisted
// rather than passed through — anything outside this set (including
// injected newlines meant to smuggle extra GITHUB_OUTPUT keys) becomes "".
const KNOWN_LABELS = new Set(["Excellent", "Good", "Needs Work", "Critical"]);

const safeLabel = (label) => {
  // CLI labels carry a trailing emoji ("Good ✅") — keep only the text.
  const text = String(label)
    .replaceAll(/[^ -~]/gu, "")
    .trim();
  return KNOWN_LABELS.has(text) ? text : "";
};

const stepOutputs = ({ errors, gate, infos, label, score, warnings }) => {
  const errorCount = Number(errors) || 0;
  const warningCount = Number(warnings) || 0;
  const infoCount = Number(infos) || 0;
  return {
    "error-count": String(errorCount),
    "gate-status": gate,
    "info-count": String(infoCount),
    label: safeLabel(label),
    score: String(Number(score) || 0),
    "total-issues": String(errorCount + warningCount + infoCount),
    "warning-count": String(warningCount),
  };
};

const renderFailure = () => ({
  body: [
    MARKER,
    "**Docker Doctor** could not produce a scan report — check the workflow logs for the CLI output.",
    "",
    `<sub>If this looks like a bug, please <a href="https://github.com/PunGrumpy/docker-doctor/issues/new">open an issue</a>.</sub>`,
  ].join("\n"),
  outputs: stepOutputs({
    errors: 0,
    gate: "1",
    infos: 0,
    label: "",
    score: 0,
    warnings: 0,
  }),
});

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
  const count = (severity) =>
    report.diagnostics.filter((d) => d.severity === severity).length;
  const errors = count("error");
  const warnings = count("warning");
  const total = report.diagnostics.length;
  const scannedFiles =
    report.project.dockerfiles.length + report.project.composeFiles.length;

  const lines = [MARKER, INTRO, ""];

  if (scannedFiles === 0) {
    lines.push(
      `**Docker Doctor** found no Dockerfiles or Compose files in \`${sanitizeText(scanDirectory)}\`.`
    );
  } else {
    lines.push(
      ...buildTable(report),
      "",
      scoreLine({ errors, label: report.label, score: report.score, warnings })
    );
    if (total > 0) {
      lines.push("", ...findingsSection(report, errors > 0));
    }
  }

  lines.push("", footer());

  return {
    body: lines.join("\n"),
    outputs: stepOutputs({
      errors,
      gate: gateStatus(errors, warnings),
      infos: total - errors - warnings,
      label: report.label,
      score: report.score,
      warnings,
    }),
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
  // Belt-and-suspenders on top of the allowlisting in stepOutputs: strip
  // newlines from every value regardless of source so no field can smuggle
  // in an extra GITHUB_OUTPUT key.
  const serialized = Object.entries(outputs)
    .map(([key, value]) => `${key}=${String(value).replaceAll(/\r?\n/gu, " ")}`)
    .join("\n");
  appendFileSync(githubOutput, `${serialized}\n`);
}

const stepSummary = env("GITHUB_STEP_SUMMARY");
if (stepSummary) {
  appendFileSync(stepSummary, `${body}\n`);
}
