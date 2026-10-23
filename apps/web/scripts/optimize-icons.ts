import fs from "node:fs/promises";
import path from "node:path";

import { optimize } from "svgo";
import type { Config } from "svgo";

const ICONS_DIR = path.resolve(import.meta.dirname, "../components/icons");

// React camelCase SVG attributes → standard SVG hyphenated names
const REACT_SVG_ATTR_MAP = new Map([
  ["clipPath", "clip-path"],
  ["clipRule", "clip-rule"],
  ["fillOpacity", "fill-opacity"],
  ["fillRule", "fill-rule"],
  ["floodColor", "flood-color"],
  ["floodOpacity", "flood-opacity"],
  ["fontFamily", "font-family"],
  ["fontSize", "font-size"],
  ["fontStretch", "font-stretch"],
  ["fontStyle", "font-style"],
  ["fontVariant", "font-variant"],
  ["fontWeight", "font-weight"],
  ["letterSpacing", "letter-spacing"],
  ["lightingColor", "lighting-color"],
  ["markerEnd", "marker-end"],
  ["markerMid", "marker-mid"],
  ["markerStart", "marker-start"],
  ["overlinePosition", "overline-position"],
  ["overlineThickness", "overline-thickness"],
  ["paintOrder", "paint-order"],
  ["pointerEvents", "pointer-events"],
  ["shapeRendering", "shape-rendering"],
  ["stopColor", "stop-color"],
  ["stopOpacity", "stop-opacity"],
  ["strikethroughPosition", "strikethrough-position"],
  ["strikethroughThickness", "strikethrough-thickness"],
  ["strokeDasharray", "stroke-dasharray"],
  ["strokeDashoffset", "stroke-dashoffset"],
  ["strokeLinecap", "stroke-linecap"],
  ["strokeLinejoin", "stroke-linejoin"],
  ["strokeMiterlimit", "stroke-miterlimit"],
  ["strokeOpacity", "stroke-opacity"],
  ["strokeWidth", "stroke-width"],
  ["textAnchor", "text-anchor"],
  ["textDecoration", "text-decoration"],
  ["textRendering", "text-rendering"],
  ["underlinePosition", "underline-position"],
  ["underlineThickness", "underline-thickness"],
  ["unicodeBidi", "unicode-bidi"],
  ["vectorEffect", "vector-effect"],
]);

const REACT_ATTR_RE = new RegExp(
  `\\b(${[...REACT_SVG_ATTR_MAP.keys()].join("|")})\\s*=`,
  "gu"
);

// Reverse map for restoration: hyphenated → React camelCase
const SVG_ATTR_REVERSE = new Map(
  [...REACT_SVG_ATTR_MAP].map(([k, v]) => [v, k])
);

const SVG_ATTR_RE = new RegExp(
  `\\b(${[...REACT_SVG_ATTR_MAP.values()].join("|")})\\s*=`,
  "gu"
);

const SVG_ELEMENT_RE = /(?<svg><svg[\s\S]*?<\/svg>)/u;

const SVGO_CONFIG: Config = {
  js2svg: { indent: 2, pretty: true },
  multipass: true,
  plugins: [
    {
      name: "preset-default",
      params: {
        overrides: {
          cleanupIds: false,
          removeUnknownsAndDefaults: {
            keepAriaAttrs: true,
            keepDataAttrs: true,
            unknownAttrs: false,
          },
          removeUnusedNS: false,
        },
      },
    },
  ],
};

const formatBytes = (bytes: number) => {
  if (bytes === 0) {
    return "0 B";
  }

  const abs = Math.abs(bytes);
  const sign = bytes < 0 ? "+" : "-";

  if (abs < 1024) {
    return `${sign}${abs} B`;
  }

  return `${sign}${(abs / 1024).toFixed(1)} KB`;
};

const processFile = async (filePath: string) => {
  let content = await fs.readFile(filePath, "utf-8");
  const original = content;

  const originalSvg = SVG_ELEMENT_RE.exec(content)?.groups?.svg;

  if (originalSvg === undefined) {
    console.log(`  ⏭  no SVG found in ${path.basename(filePath)}`);

    return;
  }

  const hasClassName = originalSvg.includes("className=");
  const hasSpread = originalSvg.includes("{...");
  const hasReactAttrs = REACT_ATTR_RE.test(originalSvg);
  // Reset regex state for reuse
  REACT_ATTR_RE.lastIndex = 0;

  let preprocessed = originalSvg;

  // Convert React camelCase attributes to SVG hyphenated form
  if (hasReactAttrs) {
    preprocessed = preprocessed.replace(REACT_ATTR_RE, (match, attr: string) =>
      match.replace(attr, REACT_SVG_ATTR_MAP.get(attr) ?? attr)
    );
  }

  if (hasClassName) {
    preprocessed = preprocessed.replaceAll(/\bclassName\s*=/gu, "class=");
  }

  const spreads: string[] = [];

  if (hasSpread) {
    preprocessed = preprocessed.replaceAll(
      /(?<!\s)\s*\{\.\.\.\w+\}/gu,
      (match) => {
        spreads.push(match);

        return "";
      }
    );
  }

  const result = optimize(preprocessed, {
    ...SVGO_CONFIG,
    path: filePath,
  });

  let optimizedSvg = result.data;

  if (hasClassName) {
    optimizedSvg = optimizedSvg.replaceAll(/\bclass\s*=/gu, "className=");
  }

  // Restore React camelCase SVG attributes
  if (hasReactAttrs) {
    optimizedSvg = optimizedSvg.replace(SVG_ATTR_RE, (match, attr: string) =>
      match.replace(attr, SVG_ATTR_REVERSE.get(attr) ?? attr)
    );
  }

  // Restore JSX spread attributes
  if (spreads.length > 0) {
    optimizedSvg = optimizedSvg.replace(
      /(?<tag>^<svg)/u,
      `$<tag>${spreads.join(" ")}`
    );
  }

  if (optimizedSvg === originalSvg) {
    console.log(`  - ${path.basename(filePath)} (no change)`);

    return;
  }

  content = content.replace(originalSvg, optimizedSvg);
  await fs.writeFile(filePath, content, "utf-8");

  const saved = original.length - content.length;
  console.log(`  ✓ ${path.basename(filePath)} (${formatBytes(saved)})`);
};

const main = async () => {
  const entries = await fs.readdir(ICONS_DIR, { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    if (entry.isFile() && entry.name.endsWith(".tsx")) {
      files.push(path.join(ICONS_DIR, entry.name));
    }
  }

  if (files.length === 0) {
    console.log("No TSX icon files found.");

    return;
  }

  console.log(`Optimizing ${files.length} icon file(s)…\n`);
  await Promise.all(
    files.map(async (file) => {
      await processFile(file);
    })
  );
  console.log("\nDone.");
};

try {
  await main();
} catch (error) {
  console.error(error);
}
