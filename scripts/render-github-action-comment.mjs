/**
 * Renders a Docker Doctor JSON report into the sticky PR comment body,
 * mirrors it to the job summary, and writes step outputs (including the
 * gate status the final action step exits with and the state/description
 * the commit-status step posts).
 *
 * Inputs (env): DOCTOR_REPORT_FILE, DOCTOR_DIRECTORY, DOCTOR_BLOCKING,
 * DOCTOR_HEAD_SHA, DOCTOR_EXIT_STATUS, plus the standard GITHUB_* /
 * RUNNER_TEMP runner vars. All of them are read in readContext.
 */
import {
  appendFileSync,
  existsSync,
  readFileSync,
  realpathSync,
  writeFileSync,
} from "node:fs";
import path from "node:path";

const MARKER = "<!-- docker-doctor:summary -->";
const SITE_URL = "https://docker-doctor.vercel.app";
const MAX_TABLE_ROWS = 20;
const MAX_FINDING_LINES = 50;
const MAX_MESSAGE_LENGTH = 180;
const SHORT_SHA_LENGTH = 7;
const MAX_SCORE = 100;
// The CLI exits 2 when it could not read or parse a discovered file.
const SCAN_INCOMPLETE_EXIT_STATUS = "2";
// GitHub rejects an issue comment longer than 65,536 characters. The margin
// covers characters GitHub counts as more than one.
const MAX_COMMENT_LENGTH = 60_000;
// How many rows the collapsed "more files" table may hold, tried in order
// until the comment fits. The job summary always gets the full table.
const OVERFLOW_ROW_STEPS = [Number.POSITIVE_INFINITY, 100, 40, 0];

export const readContext = (env = process.env) => ({
  blocking: env.DOCTOR_BLOCKING ?? "none",
  exitStatus: env.DOCTOR_EXIT_STATUS ?? "",
  githubOutput: env.GITHUB_OUTPUT ?? "",
  headSha: env.DOCTOR_HEAD_SHA ?? "",
  isPullRequest: env.GITHUB_EVENT_NAME === "pull_request",
  reportFile: env.DOCTOR_REPORT_FILE ?? "",
  repository: env.GITHUB_REPOSITORY ?? "",
  runnerTemp: env.RUNNER_TEMP ?? ".",
  scanDirectory: env.DOCTOR_DIRECTORY || ".",
  serverUrl: env.GITHUB_SERVER_URL ?? "https://github.com",
  stepSummary: env.GITHUB_STEP_SUMMARY ?? "",
});

// Diagnostic messages and file paths embed content from the scanned repo
// (rule messages quote Dockerfile lines verbatim). Everything interpolated
// into the comment body or step outputs must pass through one of these.
export const sanitizeText = (value) =>
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
export const sanitizeUrlPart = (value) =>
  String(value).replaceAll(
    /[\s()<>`]/gu,
    (c) => URL_ESCAPES[c] ?? encodeURIComponent(c)
  );

// The report JSON is untrusted (fork PR content), so `label` is allowlisted
// rather than passed through — anything outside this set (including
// injected newlines meant to smuggle extra GITHUB_OUTPUT keys) becomes "".
const KNOWN_LABELS = new Set(["Excellent", "Good", "Needs Work", "Critical"]);

export const safeLabel = (label) => {
  // CLI labels carry a trailing emoji ("Good ✅") — keep only the text.
  const text = String(label)
    .replaceAll(/[^ -~]/gu, "")
    .trim();
  return KNOWN_LABELS.has(text) ? text : "";
};

// Same reasoning as safeLabel: the score lands in a link, a URL and the
// commit status, so anything that is not a number becomes 0.
const safeScore = (score) =>
  Math.min(MAX_SCORE, Math.max(0, Math.trunc(Number(score) || 0)));

const SEVERITY_RANK = { error: 3, info: 1, warning: 2 };
// An unanalyzed file sorts above every file with findings.
const UNANALYZED_RANK = 4;

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
const UNANALYZED_STATUS = `${statusDot("error")} Unanalyzed`;

// Score buckets get their own dots, colored to match the badge palette.
const SCORE_DOT_BY_LABEL = {
  Critical: "critical",
  Excellent: "excellent",
  Good: "good",
  "Needs Work": "needs-work",
};

const scoreLine = ({ errors, label, score, warnings }) => {
  const text = safeLabel(label);
  // Same share URL the CLI prints after a terminal scan.
  const shareUrl = `${SITE_URL}/share?s=${score}&w=${warnings}&e=${errors}`;
  const line = `**Score:** [${score} / 100](${shareUrl})`;
  return text
    ? `${line} · ${statusDot(SCORE_DOT_BY_LABEL[text])} ${text}`
    : line;
};

const isObject = (value) => typeof value === "object" && value !== null;

const isValidReport = (parsed) =>
  isObject(parsed) &&
  Array.isArray(parsed.diagnostics) &&
  typeof parsed.score === "number" &&
  typeof parsed.label === "string" &&
  isObject(parsed.project) &&
  Array.isArray(parsed.project.dockerfiles) &&
  Array.isArray(parsed.project.composeFiles);

// Reports from CLIs older than schema 4 have no `failures`; they render as
// complete unless the exit status says otherwise. Entries are coerced rather
// than filtered so a malformed entry still counts as an unanalyzed file.
const normalizeFailures = (failures) =>
  Array.isArray(failures)
    ? failures.map((failure) => ({
        file: String(failure?.file ?? ""),
        message: String(failure?.message ?? ""),
      }))
    : [];

export const readReportText = (text) => {
  try {
    const parsed = JSON.parse(text);
    if (!isValidReport(parsed)) {
      return null;
    }
    return { ...parsed, failures: normalizeFailures(parsed.failures) };
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

const blobUrl = (ctx, file, line) => {
  const joined = path.posix
    .join(
      ctx.scanDirectory.split(path.sep).join("/"),
      file.split(path.sep).join("/")
    )
    .replace(/^(?:\.\/)+/u, "");
  const fragment = line ? `#L${line}` : "";
  return `${ctx.serverUrl}/${ctx.repository}/blob/${ctx.headSha}/${sanitizeUrlPart(joined)}${fragment}`;
};

// GitHub-flavored markdown renders <relative-time> natively ("3 hours ago",
// tooltip with the full date). The absolute UTC text inside is the fallback
// for renderers without the element (email notifications, other viewers).
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
  return `<relative-time datetime="${date.toISOString()}">${day} ${time} UTC</relative-time>`;
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

const fileRow = (ctx, { diagnostics, failureMessage, file, updated }) => {
  const link = `[\`${sanitizeText(file)}\`](${blobUrl(ctx, file)})`;
  // A file the CLI could not parse has no diagnostics, which would otherwise
  // make it look clean.
  if (failureMessage !== undefined) {
    return {
      markdown: `| ${link} | ${UNANALYZED_STATUS} | ${sanitizeText(shortMessage(failureMessage))} | ${updated} |`,
      worst: UNANALYZED_RANK,
    };
  }
  let worst = null;
  for (const { severity } of diagnostics) {
    if ((SEVERITY_RANK[severity] ?? 0) > (SEVERITY_RANK[worst] ?? 0)) {
      worst = severity;
    }
  }
  const status = worst ? STATUS_BY_SEVERITY[worst] : CLEAN_STATUS;
  return {
    markdown: `| ${link} | ${status} | ${countSummary(diagnostics)} | ${updated} |`,
    worst: SEVERITY_RANK[worst] ?? 0,
  };
};

const TABLE_HEADER = [
  "| File | Status | Issues | Updated |",
  "| :--- | :----- | :----- | :------ |",
];

const buildTable = (ctx, report, maxOverflowRows) => {
  const failureMessages = new Map(
    report.failures.map(({ file, message }) => [file, message])
  );
  const byFile = groupByFile(report.diagnostics, [
    ...report.project.dockerfiles,
    ...report.project.composeFiles,
    ...failureMessages.keys(),
  ]);
  const updated = formatTimestamp(report.timestamp);
  const rows = [...byFile.entries()]
    .map(([file, diagnostics]) =>
      fileRow(ctx, {
        diagnostics,
        failureMessage: failureMessages.get(file),
        file,
        updated,
      })
    )
    .toSorted((a, b) => b.worst - a.worst);

  const lines = [
    ...TABLE_HEADER,
    ...rows.slice(0, MAX_TABLE_ROWS).map((row) => row.markdown),
  ];
  // Rows are sorted worst first, so the ones a cap leaves out are the files
  // with the least to report.
  const overflow = rows.slice(MAX_TABLE_ROWS);
  const listed = overflow.slice(0, maxOverflowRows);
  if (listed.length > 0) {
    lines.push(
      "",
      "<details>",
      `<summary>${plural(listed.length, "more file")}</summary>`,
      "",
      ...TABLE_HEADER,
      ...listed.map((row) => row.markdown),
      "",
      "</details>"
    );
  }
  const unlisted = overflow.length - listed.length;
  if (unlisted > 0) {
    lines.push(
      "",
      `…and ${plural(unlisted, "more file")} not listed here. The job summary of this workflow run has the full table.`
    );
  }
  return lines;
};

const findingLine = (ctx, diagnostic) => {
  const location = diagnostic.line
    ? `${diagnostic.file}:${diagnostic.line}`
    : diagnostic.file;
  const rule = diagnostic.rule.replace(/^docker-doctor\//u, "");
  return `- ${ICON_BY_SEVERITY[diagnostic.severity] ?? "•"} [\`${sanitizeText(location)}\`](${blobUrl(ctx, diagnostic.file, diagnostic.line)}) ${sanitizeText(shortMessage(diagnostic.message))} \`${sanitizeText(rule)}\``;
};

const findingsSection = (ctx, report, hasErrors) => {
  const sorted = [...report.diagnostics].toSorted(
    (a, b) =>
      a.file.localeCompare(b.file) ||
      (SEVERITY_RANK[b.severity] ?? 0) - (SEVERITY_RANK[a.severity] ?? 0) ||
      (a.line ?? 0) - (b.line ?? 0)
  );
  const byFile = groupByFile(sorted.slice(0, MAX_FINDING_LINES));
  const groups = [...byFile.entries()].map(
    ([file, diagnostics]) =>
      `**\`${sanitizeText(file)}\`**\n${diagnostics.map((d) => findingLine(ctx, d)).join("\n")}`
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

// With a schema-4 report the failures name the files. An older CLI only
// signals an incomplete scan through its exit status.
const incompleteNotice = (failureCount) =>
  failureCount > 0
    ? `**${plural(failureCount, "file")} could not be analyzed.** The score covers only the files that were. See the workflow log for the parser output.`
    : "**Some files could not be analyzed** (Docker Doctor exited with status 2). The score covers only the files that were. See the workflow log.";

const footer = (ctx) => {
  const shortSha = ctx.headSha.slice(0, SHORT_SHA_LENGTH);
  return `<sub>Scanned by <a href="${SITE_URL}">Docker Doctor</a> for commit <code>${shortSha}</code>.</sub>`;
};

const stepOutputs = (
  ctx,
  { description, errors, gate, infos, label, score, warnings }
) => {
  const errorCount = Number(errors) || 0;
  const warningCount = Number(warnings) || 0;
  const infoCount = Number(infos) || 0;
  return {
    "error-count": String(errorCount),
    "gate-status": gate,
    "info-count": String(infoCount),
    label: safeLabel(label),
    score: String(safeScore(score)),
    "status-description": description,
    // Advisory on pushes: findings never mark a default-branch commit red. On
    // a pull request the status mirrors the gate step so the two never disagree.
    "status-state": ctx.isPullRequest && gate !== "0" ? "failure" : "success",
    "total-issues": String(errorCount + warningCount + infoCount),
    "warning-count": String(warningCount),
  };
};

export const renderFailure = (ctx) => ({
  body: [
    MARKER,
    "**Docker Doctor** could not produce a scan report — check the workflow logs for the CLI output.",
    "",
    `<sub>If this looks like a bug, please <a href="https://github.com/PunGrumpy/docker-doctor/issues/new">open an issue</a>.</sub>`,
  ].join("\n"),
  outputs: stepOutputs(ctx, {
    description: "Scan could not complete",
    errors: 0,
    gate: "1",
    infos: 0,
    label: "",
    score: 0,
    warnings: 0,
  }),
});

// An incomplete scan fails the check regardless of `blocking`, the same way
// renderFailure treats a scan that produced no report at all.
const gateStatus = (ctx, { errors, incomplete, warnings }) => {
  if (incomplete) {
    return "1";
  }
  if (ctx.blocking === "error") {
    return errors > 0 ? "1" : "0";
  }
  if (ctx.blocking === "warning") {
    return errors + warnings > 0 ? "1" : "0";
  }
  return "0";
};

export const renderReport = (
  ctx,
  report,
  { maxOverflowRows = Number.POSITIVE_INFINITY } = {}
) => {
  const count = (severity) =>
    report.diagnostics.filter((d) => d.severity === severity).length;
  const errors = count("error");
  const warnings = count("warning");
  const total = report.diagnostics.length;
  const score = safeScore(report.score);
  const failureCount = report.failures.length;
  const incomplete =
    failureCount > 0 || ctx.exitStatus === SCAN_INCOMPLETE_EXIT_STATUS;
  const scannedFiles =
    report.project.dockerfiles.length + report.project.composeFiles.length;

  const lines = [MARKER, INTRO, ""];

  if (scannedFiles === 0) {
    lines.push(
      `**Docker Doctor** found no Dockerfiles or Compose files in \`${sanitizeText(ctx.scanDirectory)}\`.`
    );
  } else {
    lines.push(...buildTable(ctx, report, maxOverflowRows), "");
    if (incomplete) {
      lines.push(incompleteNotice(failureCount), "");
    }
    lines.push(scoreLine({ errors, label: report.label, score, warnings }));
    if (total > 0) {
      lines.push("", ...findingsSection(ctx, report, errors > 0));
    }
  }

  lines.push("", footer(ctx));

  let description =
    scannedFiles === 0
      ? "No Dockerfiles or Compose files found"
      : `Score: ${score}/100 · ${plural(errors, "error")} · ${plural(warnings, "warning")}`;
  if (failureCount > 0) {
    description += ` · ${failureCount} unanalyzed`;
  } else if (incomplete) {
    description += " · scan incomplete";
  }

  return {
    body: lines.join("\n"),
    outputs: stepOutputs(ctx, {
      description,
      errors,
      gate: gateStatus(ctx, { errors, incomplete, warnings }),
      infos: total - errors - warnings,
      label: report.label,
      score,
      warnings,
    }),
  };
};

// The PR comment has a hard size limit and the job summary does not, so the
// comment drops rows from the collapsed table until it fits. Past the last
// step (enormous file paths) it falls back to the score line alone.
export const renderComment = (ctx, report) => {
  for (const maxOverflowRows of OVERFLOW_ROW_STEPS) {
    const rendered = renderReport(ctx, report, { maxOverflowRows });
    if (rendered.body.length <= MAX_COMMENT_LENGTH) {
      return rendered;
    }
  }
  const { outputs } = renderReport(ctx, report);
  return {
    body: [
      MARKER,
      INTRO,
      "",
      `**Score:** ${outputs.score} / 100 · ${plural(Number(outputs["error-count"]), "error")} · ${plural(Number(outputs["warning-count"]), "warning")}`,
      "",
      "The full report is too long for a comment. The job summary of this workflow run has it.",
      "",
      footer(ctx),
    ].join("\n"),
    outputs,
  };
};

export const main = (ctx = readContext()) => {
  const report =
    ctx.reportFile && existsSync(ctx.reportFile)
      ? readReportText(readFileSync(ctx.reportFile, "utf-8"))
      : null;
  const { body, outputs } = report
    ? renderReport(ctx, report)
    : renderFailure(ctx);

  const commentFile = path.join(ctx.runnerTemp, "docker-doctor-comment.md");
  writeFileSync(commentFile, report ? renderComment(ctx, report).body : body);
  outputs["comment-file"] = commentFile;

  if (ctx.githubOutput) {
    // Belt-and-suspenders on top of the allowlisting in stepOutputs: strip
    // newlines from every value regardless of source so no field can smuggle
    // in an extra GITHUB_OUTPUT key.
    const serialized = Object.entries(outputs)
      .map(
        ([key, value]) => `${key}=${String(value).replaceAll(/\r?\n/gu, " ")}`
      )
      .join("\n");
    appendFileSync(ctx.githubOutput, `${serialized}\n`);
  }

  if (ctx.stepSummary) {
    appendFileSync(ctx.stepSummary, `${body}\n`);
  }
};

// Run only when executed directly (`node render-github-action-comment.mjs`),
// so the tests can import the module without side effects. Node resolves the
// entry module through symlinks but leaves argv[1] as given, so compare real
// paths: a symlinked action path must still run the renderer.
const isEntryPoint = () =>
  process.argv[1] !== undefined &&
  realpathSync(process.argv[1]) === realpathSync(import.meta.filename);

if (isEntryPoint()) {
  main();
}
