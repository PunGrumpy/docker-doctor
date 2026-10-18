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

/**
 * The report fields this renderer reads. The report file is untrusted.
 * readReportText checks only the structure the renderer relies on, and the
 * score and label stay unknown until safeScore and safeLabel clean them.
 *
 * @typedef {{ file: string; line?: number; message: string; rule: string; severity: string }} ReportDiagnostic
 * @typedef {{ file: string; message: string }} ReportFailure
 * @typedef {{ composeFiles: string[]; dockerfiles: string[] }} ReportProject
 * @typedef {{
 *   diagnostics: ReportDiagnostic[];
 *   failures: ReportFailure[];
 *   label: unknown;
 *   project: ReportProject;
 *   score: unknown;
 *   timestamp: string;
 * }} Report
 * @typedef {ReturnType<typeof readContext>} ActionContext
 * @typedef {ReturnType<typeof stepOutputs>} StepOutputs
 */

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

export const readContext = (env = process.env) => {
  const scanDirectory = env.DOCTOR_DIRECTORY ?? "";

  return {
    blocking: env.DOCTOR_BLOCKING ?? "none",
    exitStatus: env.DOCTOR_EXIT_STATUS ?? "",
    githubOutput: env.GITHUB_OUTPUT ?? "",
    headSha: env.DOCTOR_HEAD_SHA ?? "",
    isPullRequest: env.GITHUB_EVENT_NAME === "pull_request",
    reportFile: env.DOCTOR_REPORT_FILE ?? "",
    repository: env.GITHUB_REPOSITORY ?? "",
    runnerTemp: env.RUNNER_TEMP ?? ".",
    scanDirectory: scanDirectory === "" ? "." : scanDirectory,
    serverUrl: env.GITHUB_SERVER_URL ?? "https://github.com",
    stepSummary: env.GITHUB_STEP_SUMMARY ?? "",
  };
};

// Diagnostic messages and file paths embed content from the scanned repo.
// Rule messages quote Dockerfile lines. Everything interpolated into the
// comment body or step outputs must pass through one of these.
//
// Characters a reader cannot see become a space. These are C0 and C1
// controls (Cc, including newlines, ANSI escapes and NEL), format
// characters (Cf), and the line and paragraph separators. Cf covers
// zero-width characters, bidi embeddings, overrides and isolates, the BOM
// and the assigned tag characters. The CLI sanitizer in
// packages/docker-doctor/src/agents/sanitize.ts uses the same class. The
// renderer test checks that both strip the same samples.
const INVISIBLE_CHARS_RE = /[\p{Cc}\p{Cf}\p{Zl}\p{Zp}\u{E0000}-\u{E007F}]+/gu;

/** @type {(value: unknown) => string} */
const stripInvisible = (value) =>
  String(value).replaceAll(INVISIBLE_CHARS_RE, " ");

// Neutralizes markdown and HTML structure.
/** @type {(text: string) => string} */
const escapeMarkdown = (text) =>
  text
    .replaceAll("`", "'")
    .replaceAll("|", "\\|")
    .replaceAll("<", "&lt;")
    .replaceAll("[", "\\[")
    .replaceAll("]", "\\]");

/** @type {(value: unknown) => string} */
export const sanitizeText = (value) => escapeMarkdown(stripInvisible(value));

// GitHub turns @user, @org/team, #123, GH-123 and bare URLs into mentions,
// references and links everywhere except inside code. HTML entities and
// backslash escapes do not stop it. GitHub's markdown API confirmed this.
// So a message word that could become one is shown as inline code. Inside
// code only a backtick and a table pipe still need escaping.
const WORD_SPLIT_RE = /(?<space>\s+)/u;
const LINKABLE_WORD_RE = /[@#]|:\/\/|www\.|\bgh-\d/iu;

/** @type {(word: string) => string} */
const inlineCode = (word) =>
  `\`${word.replaceAll("`", "'").replaceAll("|", "\\|")}\``;

/** @type {(value: unknown) => string} */
export const sanitizeProse = (value) =>
  stripInvisible(value)
    .split(WORD_SPLIT_RE)
    .map((part) =>
      LINKABLE_WORD_RE.test(part) ? inlineCode(part) : escapeMarkdown(part)
    )
    .join("");

// Each path segment is percent-encoded, so `#`, `?` and `%` in a file name
// stay part of the path instead of starting a fragment or a query.
// encodeURIComponent leaves "(" and ")" alone. An unmatched ")" would still
// close the markdown link early, so those two are mapped as well.
/** @type {(segment: string) => string} */
const encodePathSegment = (segment) =>
  encodeURIComponent(segment).replaceAll("(", "%28").replaceAll(")", "%29");

/** @type {(value: unknown) => string} */
export const encodeUrlPath = (value) =>
  String(value).split("/").map(encodePathSegment).join("/");

// The report JSON is untrusted (fork PR content), so `label` is allowlisted
// rather than passed through — anything outside this set (including
// injected newlines meant to smuggle extra GITHUB_OUTPUT keys) becomes "".
const KNOWN_LABELS = new Set(["Excellent", "Good", "Needs Work", "Critical"]);

/** @type {(label: unknown) => string} */
export const safeLabel = (label) => {
  // CLI labels carry a trailing emoji ("Good ✅") — keep only the text.
  const text = String(label)
    .replaceAll(/[^ -~]/gu, "")
    .trim();

  return KNOWN_LABELS.has(text) ? text : "";
};

// Same reasoning as safeLabel: the score lands in a link, a URL and the
// commit status, so anything that is not a number becomes 0.
/** @type {(score: unknown) => number} */
const safeScore = (score) =>
  Math.min(MAX_SCORE, Math.max(0, Math.trunc(Number(score) || 0)));

/** @type {Record<string, number>} */
const SEVERITY_RANK = { error: 3, info: 1, warning: 2 };

/** @type {(severity: string) => number} */
const severityRank = (severity) => SEVERITY_RANK[severity] ?? 0;

// An unanalyzed file sorts above every file with findings.
const UNANALYZED_RANK = 4;

// Status dots are tiny SVG circles served from the site (same approach as
// Vercel's bot comments — https://vercel.com/static/status/ready.svg).
// Empty alt when a text label sits next to the dot (it is decorative there);
// a real alt only where the dot is the sole severity cue.
/** @type {(kind: string, alt?: string) => string} */
const statusDot = (kind, alt = "") =>
  `![${alt}](${SITE_URL}/status/${kind}.svg)`;

/** @type {Record<string, string>} */
const STATUS_BY_SEVERITY = {
  error: `${statusDot("error")} Error`,
  info: `${statusDot("info")} Info`,
  warning: `${statusDot("warning")} Warning`,
};

/** @type {Record<string, string>} */
const ICON_BY_SEVERITY = {
  error: statusDot("error", "error"),
  info: statusDot("info", "info"),
  warning: statusDot("warning", "warning"),
};

const CLEAN_STATUS = `${statusDot("clean")} Clean`;
const UNANALYZED_STATUS = `${statusDot("error")} Unanalyzed`;

// Score buckets get their own dots, colored to match the badge palette.
/** @type {Record<string, string>} */
const SCORE_DOT_BY_LABEL = {
  Critical: "critical",
  Excellent: "excellent",
  Good: "good",
  "Needs Work": "needs-work",
};

/** @type {(counts: { errors: number; label: unknown; score: number; warnings: number }) => string} */
const scoreLine = ({ errors, label, score, warnings }) => {
  const text = safeLabel(label);
  // Same share URL the CLI prints after a terminal scan.
  const shareUrl = `${SITE_URL}/share?s=${score}&w=${warnings}&e=${errors}`;
  const line = `**Score:** [${score} / 100](${shareUrl})`;

  return text
    ? `${line} · ${statusDot(SCORE_DOT_BY_LABEL[text])} ${text}`
    : line;
};

// The report comes from JSON.parse. For its values, Object(value),
// Number(value) and String(value) return the value itself exactly when it
// is an object, a number or a string, the same answers typeof gives.
// typeof is not used because JavaScript has no type predicate syntax, and
// anti-slop allows typeof only inside a type predicate.
/**
 * @param {unknown} value A value from JSON.parse.
 * @returns {value is Record<string, unknown>} Whether it is an object.
 */
const isObject = (value) => value !== null && Object(value) === value;

// Since schema 6 the score and the label are both null when the CLI
// analyzed no file.
/** @type {(report: Record<string, unknown>) => boolean} */
const hasValidScore = ({ label, score }) =>
  (Number(score) === score && String(label) === label) ||
  (score === null && label === null);

/**
 * @param {unknown} project The report's project field.
 * @returns {project is ReportProject} Whether both file lists are arrays.
 */
const isValidProject = (project) =>
  isObject(project) &&
  Array.isArray(project.dockerfiles) &&
  Array.isArray(project.composeFiles);

/**
 * @param {unknown} parsed The parsed report file.
 * @returns {parsed is Omit<Report, "failures"> & { failures?: unknown }} Whether the renderer can read it.
 */
const isValidReport = (parsed) =>
  isObject(parsed) &&
  Array.isArray(parsed.diagnostics) &&
  hasValidScore(parsed) &&
  isValidProject(parsed.project);

// Reports from CLIs older than schema 4 have no `failures`; they render as
// complete unless the exit status says otherwise. Entries are coerced rather
// than filtered so a malformed entry still counts as an unanalyzed file.
/** @type {(failures: unknown) => ReportFailure[]} */
const normalizeFailures = (failures) => {
  /** @type {unknown[]} */
  const entries = Array.isArray(failures) ? failures : [];

  return entries.map((failure) => {
    /** @type {Record<string, unknown>} */
    const entry = isObject(failure) ? failure : {};
    /** @type {unknown} */
    const file = entry.file ?? "";
    /** @type {unknown} */
    const message = entry.message ?? "";

    return { file: String(file), message: String(message) };
  });
};

/** @type {(text: string) => Report | null} */
export const readReportText = (text) => {
  try {
    /** @type {unknown} */
    const parsed = JSON.parse(text);

    if (!isValidReport(parsed)) {
      return null;
    }

    return { ...parsed, failures: normalizeFailures(parsed.failures) };
  } catch {
    return null;
  }
};

/** @type {(count: number, word: string) => string} */
const plural = (count, word) => `${count} ${word}${count === 1 ? "" : "s"}`;

const INTRO = `The latest Docker Doctor scan for this pull request. Learn more about [Docker Doctor](${SITE_URL}).`;

/** @type {(diagnostics: ReportDiagnostic[], seedFiles?: string[]) => Map<string, ReportDiagnostic[]>} */
const groupByFile = (diagnostics, seedFiles = []) => {
  /** @type {Map<string, ReportDiagnostic[]>} */
  const byFile = new Map(seedFiles.map((file) => [file, []]));

  for (const diagnostic of diagnostics) {
    const list = byFile.get(diagnostic.file) ?? [];
    list.push(diagnostic);
    byFile.set(diagnostic.file, list);
  }

  return byFile;
};

/** @type {(message: string) => string} */
const shortMessage = (message) => {
  const sentenceEnd = message.indexOf(". ");

  const firstSentence =
    sentenceEnd === -1 ? message : message.slice(0, sentenceEnd + 1);

  if (firstSentence.length <= MAX_MESSAGE_LENGTH) {
    return firstSentence;
  }

  return `${firstSentence.slice(0, MAX_MESSAGE_LENGTH)}…`;
};

/** @type {(ctx: ActionContext, file: string, line?: number) => string} */
const blobUrl = (ctx, file, line) => {
  const joined = path.posix
    .join(
      ctx.scanDirectory.split(path.sep).join("/"),
      file.split(path.sep).join("/")
    )
    .replace(/^(?:\.\/)+/u, "");

  // The CLI omits the line for findings about the whole file.
  const hasLine = Boolean(line);
  const fragment = hasLine ? `#L${line}` : "";

  return `${ctx.serverUrl}/${ctx.repository}/blob/${ctx.headSha}/${encodeUrlPath(joined)}${fragment}`;
};

// GitHub-flavored markdown renders <relative-time> natively ("3 hours ago",
// tooltip with the full date). The absolute UTC text inside is the fallback
// for renderers without the element (email notifications, other viewers).
/** @type {(iso: string) => string} */
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

/** @type {(diagnostics: ReportDiagnostic[]) => string} */
const countSummary = (diagnostics) => {
  /** @type {Record<string, number>} */
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

/**
 * @type {(
 *   ctx: ActionContext,
 *   row: { diagnostics: ReportDiagnostic[]; failureMessage: string | undefined; file: string; updated: string }
 * ) => { markdown: string; worst: number }}
 */
const fileRow = (ctx, { diagnostics, failureMessage, file, updated }) => {
  const link = `[\`${sanitizeText(file)}\`](${blobUrl(ctx, file)})`;

  // A file the CLI could not parse has no diagnostics, which would otherwise
  // make it look clean.
  if (failureMessage !== undefined) {
    return {
      markdown: `| ${link} | ${UNANALYZED_STATUS} | ${sanitizeProse(shortMessage(failureMessage))} | ${updated} |`,
      worst: UNANALYZED_RANK,
    };
  }

  let worst = "";
  let worstRank = 0;

  for (const { severity } of diagnostics) {
    const rank = severityRank(severity);

    if (rank > worstRank) {
      worst = severity;
      worstRank = rank;
    }
  }

  const status = worst ? STATUS_BY_SEVERITY[worst] : CLEAN_STATUS;

  return {
    markdown: `| ${link} | ${status} | ${countSummary(diagnostics)} | ${updated} |`,
    worst: worstRank,
  };
};

const TABLE_HEADER = [
  "| File | Status | Issues | Updated |",
  "| :--- | :----- | :----- | :------ |",
];

/** @type {(ctx: ActionContext, report: Report, maxOverflowRows: number) => string[]} */
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

/** @type {(line: number | undefined) => number} */
const lineOrZero = (line) => line ?? 0;

/** @type {(ctx: ActionContext, diagnostic: ReportDiagnostic) => string} */
const findingLine = (ctx, diagnostic) => {
  const hasLine = Boolean(diagnostic.line);

  const location = hasLine
    ? `${diagnostic.file}:${diagnostic.line}`
    : diagnostic.file;

  const rule = diagnostic.rule.replace(/^docker-doctor\//u, "");

  return `- ${ICON_BY_SEVERITY[diagnostic.severity] ?? "•"} [\`${sanitizeText(location)}\`](${blobUrl(ctx, diagnostic.file, diagnostic.line)}) ${sanitizeProse(shortMessage(diagnostic.message))} \`${sanitizeText(rule)}\``;
};

/** @type {(ctx: ActionContext, report: Report, hasErrors: boolean) => string[]} */
const findingsSection = (ctx, report, hasErrors) => {
  const sorted = [...report.diagnostics].toSorted(
    (a, b) =>
      a.file.localeCompare(b.file) ||
      severityRank(b.severity) - severityRank(a.severity) ||
      lineOrZero(a.line) - lineOrZero(b.line)
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

/** @type {(incomplete: boolean) => string} */
const noScoreNotice = (incomplete) =>
  incomplete
    ? "**No score.** None of the discovered files could be analyzed. See the workflow log for the parser output."
    : "**No score.** None of the discovered files has anything to check. A Dockerfile needs an instruction, and a Compose file needs a service, a top-level `models` entry or a `version` key.";

// With a schema-4 report the failures name the files. An older CLI only
// signals an incomplete scan through its exit status.
/** @type {(failureCount: number) => string} */
const incompleteNotice = (failureCount) =>
  failureCount > 0
    ? `**${plural(failureCount, "file")} could not be analyzed.** The score covers only the files that were. See the workflow log for the parser output.`
    : "**Some files could not be analyzed** (Docker Doctor exited with status 2). The score covers only the files that were. See the workflow log.";

/** @type {(ctx: ActionContext) => string} */
const footer = (ctx) => {
  const shortSha = ctx.headSha.slice(0, SHORT_SHA_LENGTH);

  return `<sub>Scanned by <a href="${SITE_URL}">Docker Doctor</a> for commit <code>${shortSha}</code>.</sub>`;
};

// Pushes are advisory. Findings never mark a default-branch commit red. On
// a pull request the status mirrors the gate step so the two never disagree.
// A scan whose files all failed has no result to be advisory about, so it
// is an error on every event.
/** @type {(ctx: ActionContext, gate: { gate: string; incomplete: boolean; score: unknown }) => string} */
const statusState = (ctx, { gate, incomplete, score }) => {
  if (score === null && incomplete) {
    return "error";
  }

  return ctx.isPullRequest && gate !== "0" ? "failure" : "success";
};

/**
 * @param {ActionContext} ctx The run's context.
 * @param {{
 *   description: string;
 *   errors: unknown;
 *   gate: string;
 *   incomplete?: boolean;
 *   infos: unknown;
 *   label: unknown;
 *   score: unknown;
 *   warnings: unknown;
 * }} counts The values the outputs are built from.
 */
const stepOutputs = (
  ctx,
  {
    description,
    errors,
    gate,
    incomplete = false,
    infos,
    label,
    score,
    warnings,
  }
) => {
  const errorCount = Number(errors) || 0;
  const warningCount = Number(warnings) || 0;
  const infoCount = Number(infos) || 0;

  return {
    "error-count": String(errorCount),
    "gate-status": gate,
    "info-count": String(infoCount),
    label: score === null ? "" : safeLabel(label),
    score: score === null ? "" : String(safeScore(score)),
    "status-description": description,
    "status-state": statusState(ctx, { gate, incomplete, score }),
    "total-issues": String(errorCount + warningCount + infoCount),
    "warning-count": String(warningCount),
  };
};

/** @type {(ctx: ActionContext) => { body: string; outputs: StepOutputs }} */
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
/** @type {(ctx: ActionContext, counts: { errors: number; incomplete: boolean; warnings: number }) => string} */
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

/**
 * @type {(counts: {
 *   errors: number;
 *   failureCount: number;
 *   incomplete: boolean;
 *   label: unknown;
 *   score: number | null;
 *   warnings: number;
 * }) => string[]}
 */
const scoreSection = ({
  errors,
  failureCount,
  incomplete,
  label,
  score,
  warnings,
}) => {
  if (score === null) {
    return [noScoreNotice(incomplete)];
  }

  const lines = incomplete ? [incompleteNotice(failureCount), ""] : [];
  lines.push(scoreLine({ errors, label, score, warnings }));

  return lines;
};

/** @type {(counts: { errors: number; scannedFiles: number; score: number | null; warnings: number }) => string} */
const statusHeadline = ({ errors, scannedFiles, score, warnings }) => {
  if (scannedFiles === 0) {
    return "No Dockerfiles or Compose files found";
  }

  if (score === null) {
    return "No score";
  }

  return `Score: ${score}/100 · ${plural(errors, "error")} · ${plural(warnings, "warning")}`;
};

/**
 * @param {ActionContext} ctx The run's context.
 * @param {Report} report The validated report.
 * @param {{ maxOverflowRows?: number }} [options] How many rows the collapsed table may hold.
 */
export const renderReport = (
  ctx,
  report,
  { maxOverflowRows = Number.POSITIVE_INFINITY } = {}
) => {
  /** @type {(severity: string) => number} */
  const count = (severity) =>
    report.diagnostics.filter((d) => d.severity === severity).length;

  const errors = count("error");
  const warnings = count("warning");
  const total = report.diagnostics.length;
  const score = report.score === null ? null : safeScore(report.score);
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
    lines.push(
      ...buildTable(ctx, report, maxOverflowRows),
      "",
      ...scoreSection({
        errors,
        failureCount,
        incomplete,
        label: report.label,
        score,
        warnings,
      })
    );

    if (total > 0) {
      lines.push("", ...findingsSection(ctx, report, errors > 0));
    }
  }

  lines.push("", footer(ctx));

  let description = statusHeadline({ errors, scannedFiles, score, warnings });

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
      incomplete,
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
/** @type {(ctx: ActionContext, report: Report) => { body: string; outputs: StepOutputs }} */
export const renderComment = (ctx, report) => {
  for (const maxOverflowRows of OVERFLOW_ROW_STEPS) {
    const rendered = renderReport(ctx, report, { maxOverflowRows });

    if (rendered.body.length <= MAX_COMMENT_LENGTH) {
      return rendered;
    }
  }

  const { outputs } = renderReport(ctx, report);

  const scoreText =
    outputs.score === "" ? "**No score**" : `**Score:** ${outputs.score} / 100`;

  return {
    body: [
      MARKER,
      INTRO,
      "",
      `${scoreText} · ${plural(Number(outputs["error-count"]), "error")} · ${plural(Number(outputs["warning-count"]), "warning")}`,
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

  if (ctx.githubOutput) {
    // Belt-and-suspenders on top of the allowlisting in stepOutputs: strip
    // newlines from every value regardless of source so no field can smuggle
    // in an extra GITHUB_OUTPUT key.
    const serialized = Object.entries({
      ...outputs,
      "comment-file": commentFile,
    })
      .map(([key, value]) => `${key}=${value.replaceAll(/\r?\n/gu, " ")}`)
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
