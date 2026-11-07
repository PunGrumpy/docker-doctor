/**
 * Mirrors the Docker Sandboxes kit's version and CLI pin from
 * `kits/docker-doctor/package.json`, the file Changesets manages, into
 * `kits/docker-doctor/docker-doctor.yaml`, the Kit Specification v3
 * descriptor that `docker buildx build` publishes.
 *
 *   bun run kit:sync           rewrite the descriptor
 *   bun run kit:sync --check   exit 1 if the descriptor is out of sync
 *
 * The descriptor carries the kit version on its `version:` line and the CLI
 * pin as the default of its `cliVersion` arg, which the frontend expands
 * into `provides` and hands to the recipe as a build arg.
 *
 * `changeset:version` runs the rewrite after `changeset version`, so the
 * Version Packages PR carries both files. CI's Format job runs it too and
 * fails on drift.
 */
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";

const KIT_DIR = path.resolve(import.meta.dirname, "../kits/docker-doctor");
const DESCRIPTOR_PATH = path.join(KIT_DIR, "docker-doctor.yaml");
const CLI_PACKAGE = "@docker-doctor/cli";
const VERSION_LINE = /^version: "[^"]*"$/mu;
const CLI_PIN = /^(?<block> {2}cliVersion:\n {4}default: )"[^"]*"$/mu;
const EXACT_VERSION = /^\d+\.\d+\.\d+(?:-[\w.-]+)?$/u;

interface KitPins {
  cliVersion: string;
  kitVersion: string;
}

interface KitManifest {
  version: string;
  dependencies?: Record<string, string>;
}

interface ManifestFields {
  dependencies?: unknown;
  version?: unknown;
}

const isJsonObject = (value: unknown): value is ManifestFields =>
  typeof value === "object" && value !== null;

const isString = (value: unknown): value is string => typeof value === "string";

const isDependencyMap = (value: unknown): value is Record<string, string> =>
  isJsonObject(value) && Object.values(value).every(isString);

const isKitManifest = (value: unknown): value is KitManifest =>
  isJsonObject(value) &&
  isString(value.version) &&
  (value.dependencies === undefined || isDependencyMap(value.dependencies));

export const syncKitDescriptor = (source: string, pins: KitPins): string => {
  if (!VERSION_LINE.test(source)) {
    throw new Error('The kit descriptor has no `version: "…"` line');
  }

  if (!CLI_PIN.test(source)) {
    throw new Error(
      'The kit descriptor has no `cliVersion` arg with a `default: "…"` line'
    );
  }

  return source
    .replace(VERSION_LINE, `version: "${pins.kitVersion}"`)
    .replace(CLI_PIN, `$<block>"${pins.cliVersion}"`);
};

const readPins = async (): Promise<KitPins> => {
  const manifest: unknown = JSON.parse(
    await readFile(path.join(KIT_DIR, "package.json"), "utf-8")
  );

  if (!isKitManifest(manifest)) {
    throw new Error(
      "kits/docker-doctor/package.json is not a package manifest"
    );
  }

  const cliVersion = manifest.dependencies?.[CLI_PACKAGE];

  if (
    cliVersion === undefined ||
    cliVersion === "" ||
    !EXACT_VERSION.test(cliVersion)
  ) {
    throw new Error(
      `kits/docker-doctor/package.json must pin ${CLI_PACKAGE} to an exact version (got ${cliVersion ?? "nothing"}); the pin is what makes Changesets bump the kit on every CLI release.`
    );
  }

  if (!EXACT_VERSION.test(manifest.version)) {
    throw new Error(
      `kits/docker-doctor/package.json has an invalid version: ${manifest.version}`
    );
  }

  return { cliVersion, kitVersion: manifest.version };
};

const main = async (): Promise<void> => {
  const checkOnly = process.argv.includes("--check");
  const pins = await readPins();
  const summary = `kit ${pins.kitVersion}, ${CLI_PACKAGE}@${pins.cliVersion}`;
  const before = await readFile(DESCRIPTOR_PATH, "utf-8");
  const after = syncKitDescriptor(before, pins);

  if (after === before) {
    console.log(`kit descriptor already in sync (${summary})`);
  } else if (checkOnly) {
    console.error(
      `kit descriptor is out of sync with package.json (${summary}). Run \`bun run kit:sync\``
    );
    process.exitCode = 1;
  } else {
    await writeFile(DESCRIPTOR_PATH, after);
    console.log(`kit descriptor updated (${summary})`);
  }
};

if (import.meta.main) {
  await main();
}
