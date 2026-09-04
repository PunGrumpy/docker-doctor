/**
 * Mirrors the Docker Sandboxes kit's version and CLI pin from
 * `kits/docker-doctor/package.json` — the file Changesets manages — into
 * `kits/docker-doctor/spec.yaml`, the file `sbx kit push` publishes.
 *
 *   bun run kit:sync           rewrite spec.yaml
 *   bun run kit:sync --check   exit 1 if spec.yaml is out of sync
 *
 * `changeset:version` runs the rewrite after `changeset version`, so the
 * Version Packages PR carries both files; CI's Format job runs it too and
 * fails on drift.
 */
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";

const KIT_DIR = path.resolve(import.meta.dirname, "../kits/docker-doctor");
const SPEC_PATH = path.join(KIT_DIR, "spec.yaml");
const CLI_PACKAGE = "@docker-doctor/cli";
const VERSION_LINE = /^version: "[^"]*"$/mu;
const CLI_PIN = /@docker-doctor\/cli@[\w.-]+/gu;
const EXACT_VERSION = /^\d+\.\d+\.\d+(?:-[\w.-]+)?$/u;

interface KitManifest {
  version: string;
  dependencies?: Record<string, string>;
}

const checkOnly = process.argv.includes("--check");

const manifest = JSON.parse(
  await readFile(path.join(KIT_DIR, "package.json"), "utf-8")
) as KitManifest;
const cliVersion = manifest.dependencies?.[CLI_PACKAGE];

if (!cliVersion || !EXACT_VERSION.test(cliVersion)) {
  throw new Error(
    `kits/docker-doctor/package.json must pin ${CLI_PACKAGE} to an exact version (got ${cliVersion ?? "nothing"}); the pin is what makes Changesets bump the kit on every CLI release.`
  );
}
if (!EXACT_VERSION.test(manifest.version)) {
  throw new Error(
    `kits/docker-doctor/package.json has an invalid version: ${manifest.version}`
  );
}

const before = await readFile(SPEC_PATH, "utf-8");
if (!VERSION_LINE.test(before)) {
  throw new Error(`No \`version: "…"\` line found in ${SPEC_PATH}`);
}
if (!CLI_PIN.test(before)) {
  throw new Error(`No ${CLI_PACKAGE}@<version> pin found in ${SPEC_PATH}`);
}

const after = before
  .replace(VERSION_LINE, `version: "${manifest.version}"`)
  .replaceAll(CLI_PIN, `${CLI_PACKAGE}@${cliVersion}`);

if (after === before) {
  console.log(
    `kit spec.yaml already in sync (kit ${manifest.version}, ${CLI_PACKAGE}@${cliVersion})`
  );
} else if (checkOnly) {
  console.error(
    `kit spec.yaml is out of sync with package.json (kit ${manifest.version}, ${CLI_PACKAGE}@${cliVersion}) — run \`bun run kit:sync\``
  );
  process.exit(1);
} else {
  await writeFile(SPEC_PATH, after);
  console.log(
    `kit spec.yaml updated (kit ${manifest.version}, ${CLI_PACKAGE}@${cliVersion})`
  );
}
