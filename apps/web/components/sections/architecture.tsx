import {
  BarChart3,
  FileCode,
  Gauge,
  Package,
  Search,
  Shield,
  Terminal,
} from "lucide-react";
import { codeToHtml } from "shiki";

import { Badge } from "@/components/badge";
import { FileContent } from "@/components/icons/file-content";
import { Section } from "@/components/section";

import type { EntryData } from "../file-tree-view";
import { FileTreeView } from "../file-tree-view";

interface Snippet {
  label: string;
  path: string;
  description: string;
  code: string;
  icon: typeof Package;
}

const snippets: Snippet[] = [
  {
    code: `import { discoverProject } from "@docker-doctor/core"
import { parseDockerfile, runDockerfileRules, calculateScore } from "@docker-doctor/core"

// One entry point for the full pipeline
const project = await discoverProject("./")
// → { dockerfiles: ["Dockerfile"], composeFiles: ["compose.yml"] }

const content = await fs.readFile("Dockerfile", "utf-8")
const instructions = parseDockerfile(content)
// → [{ instruction: "FROM", args: "node:22-alpine", line: 1 }]

const diagnostics = runDockerfileRules(instructions, "Dockerfile")
const { score, label } = calculateScore(diagnostics)
// → { score: 85, label: "Good" }`,
    description:
      "A single entry point for the full diagnostic engine — discover projects, parse files, run rules, and calculate scores.",
    icon: Package,
    label: "Core Engine",
    path: "packages/core/",
  },
  {
    code: `const walk = async (dir: string, fileList: string[] = []): Promise<string[]> => {
  const files = await fs.readdir(dir, { withFileTypes: true })
  await Promise.all(files.map(async (file) => {
    const filePath = path.join(dir, file.name)
    if (file.isDirectory()) {
      if (IGNORED.has(file.name)) return
      await walk(filePath, fileList)
    } else {
      fileList.push(filePath)
    }
  }))
  return fileList
}

export const discoverProject = async (rootDir: string) => {
  const allFiles = await walk(rootDir)
  return {
    dockerfiles: allFiles.filter(f => isDockerfile(f)),
    composeFiles: allFiles.filter(f => isComposeFile(f)),
  }
}`,
    description:
      "Recursively walk a directory tree — skipping node_modules, .git, and build artifacts — to find every Dockerfile and Compose file.",
    icon: Search,
    label: "File Discovery",
    path: "project-info/discover.ts",
  },
  {
    code: `export const parseDockerfile = (content: string): DockerfileInstruction[] => {
  const instructions: DockerfileInstruction[] = []
  let currentInstruction = ""

  for (const [i, rawLine] of content.split(/\\r?\\n/u).entries()) {
    const trimmed = rawLine.trim()
    if (trimmed === "" || trimmed.startsWith("#")) continue

    const hasContinuation = trimmed.endsWith("\\\\")

    if (!currentInstruction) {
      const match = trimmed.match(/^(?<inst>[A-Z]+)\\s+(?<args>.*)$/iu)
      if (match?.groups) {
        currentInstruction = match.groups.inst.toUpperCase()
      }
    }

    if (!hasContinuation) {
      instructions.push({ instruction: currentInstruction, args, line: i + 1, raw: rawLine })
      currentInstruction = ""
    }
  }
  return instructions
}`,
    description:
      "A lightweight line-by-line parser that handles multi-line continuations, comment skipping, and produces typed instruction arrays — no AST library needed.",
    icon: FileCode,
    label: "Dockerfile Parser",
    path: "parsers/dockerfile-parser.ts",
  },
  {
    code: `export const noRootUser: DockerfileRule = {
  key: "docker-doctor/no-root-user",
  category: "Security",
  defaultSeverity: "warning",

  check(instructions, file) {
    let lastUser = "root"
    let lastUserLine = 1

    for (const inst of instructions) {
      if (inst.instruction === "USER") {
        lastUser = inst.args.trim().toLowerCase()
        lastUserLine = inst.line
      }
    }

    if (lastUser === "root" || lastUser === "0") {
      return [{
        file, rule: this.key,
        severity: "warning",
        message: "Container runs as root — potential breakout vector",
        help: "Add 'USER node' or 'USER 1000' before the final CMD",
        line: lastUserLine,
      }]
    }
    return []
  },
}`,
    description:
      "Four security rules detect root containers, secrets baked into ENV/ARG, unpinned base images, and remote ADD URLs that bloat images.",
    icon: Shield,
    label: "Security Rules",
    path: "rules/security.ts",
  },
  {
    code: `export const orderLayers: DockerfileRule = {
  key: "docker-doctor/order-layers",
  category: "Performance",

  check(instructions, file) {
    let copyAllLine = -1

    for (const inst of instructions) {
      if (inst.instruction === "COPY" && inst.args.startsWith(".")) {
        copyAllLine = inst.line
      }

      if (inst.instruction === "RUN" && copyAllLine !== -1) {
        if (inst.args.includes("npm install") || inst.args.includes("pip install")) {
          return [{
            file, rule: this.key,
            severity: "warning",
            message: "Package install after COPY . — every code change busts the cache",
            help: "Copy package.json and lockfile first, run install, then copy the rest",
            line: inst.line,
          }]
        }
      }
    }
    return []
  },
}`,
    description:
      "Detects cache-invalidating patterns like COPY-before-install and consecutive RUN layers that increase build time and image size.",
    icon: Gauge,
    label: "Performance Rules",
    path: "rules/performance.ts",
  },
  {
    code: `const config = await loadConfig(rootDir, options.config)

const project = await discoverProject(rootDir)

const diagnostics: Diagnostic[] = []
for (const df of project.dockerfiles) {
  const content = await fs.readFile(df, "utf-8")
  const instructions = parseDockerfile(content)
  const result = runDockerfileRules(instructions, df, projectFiles, config.rules)
  diagnostics.push(...result)
}

const { score, label } = calculateScore(diagnostics)

if (options.score) {
  console.log(score)           // → "42"
  process.exit(score < 50 ? 1 : 0)
} else {
  await formatTerminal(diagnostics, score, label, project, options.verbose)
}`,
    description:
      "Run `docker-doctor .` to scan your project, or use `--score` for CI exit codes and `--json` for machine-readable reports.",
    icon: Terminal,
    label: "CLI Runner",
    path: "packages/docker-doctor/",
  },
  {
    code: `export const calculateScore = (diagnostics: Diagnostic[]) => {
  let penalty = 0

  for (const diag of diagnostics) {
    if (diag.severity === "error")   penalty += 10
    if (diag.severity === "warning") penalty += 4
    if (diag.severity === "info")    penalty += 1
  }

  const score = Math.max(0, 100 - penalty)

  const label =
    score >= 90 ? "Excellent" :
    score >= 75 ? "Good" :
    score >= 50 ? "Needs Work" :
                 "Critical"

  return { label, score }
}`,
    description:
      "A penalty-based health score: errors are -10, warnings are -4, and info is -1. A 100 means a perfectly clean bill of health.",
    icon: BarChart3,
    label: "Scoring",
    path: "scoring.ts",
  },
];

export const Architecture = async () => {
  const rendered = await Promise.all(
    snippets.map((snippet) =>
      Promise.all([
        codeToHtml(snippet.code, { lang: "typescript", theme: "github-light" }),
        codeToHtml(snippet.code, {
          lang: "typescript",
          theme: "vesper",
        }),
      ])
    )
  );

  const entries: EntryData[] = snippets.map((snippet, i) => {
    const [codeHighlightedLight, codeHighlightedDark] = rendered[i];
    return {
      codeHighlightedDark,
      codeHighlightedLight,
      description: snippet.description,
      icon: <snippet.icon className="size-full" />,
      label: snippet.label,
      path: snippet.path,
    };
  });

  return (
    <Section className="pt-8 pb-16">
      <h1 className="flex flex-col items-center justify-center text-3xl font-normal tracking-tight text-foreground sm:text-5xl">
        <span className="relative top-[-0.08em] ml-1 inline-flex items-center gap-2 rounded-lg bg-muted px-3 py-[0.04em] pr-4 align-baseline font-serif">
          <FileContent
            aria-hidden="true"
            className="size-8 text-muted-foreground"
          />
          packages/core/
        </span>
        <Badge
          aria-hidden="true"
          className="-top-7 left-1/4 -translate-x-1/4 mb-7"
        >
          <span className="block px-1.5 py-1 font-mono text-xs select-none whitespace-nowrap rounded-lg bg-card text-muted-foreground tracking-normal shadow-custom">
            the engine
          </span>
          <span className="absolute flex items-center top-full left-1/2 -translate-x-1/2 flex-col">
            <span className="border-dashed will-change-transform h-3 border-l" />
            <span className="block shrink-0 rounded-full bg-border p-0.5 will-change-transform">
              <span className="block size-[5px] shrink-0 rounded-full bg-background" />
            </span>
          </span>
        </Badge>
      </h1>

      <p className="mx-auto mt-4 max-w-2xl text-balance text-center text-sm text-muted-foreground">
        A visual tour through the Docker Doctor monorepo, from file discovery
        and parsing to rule evaluation and health scoring.
      </p>

      <div className="mt-8 w-full rounded-xl shadow-border">
        <FileTreeView entries={entries} />
      </div>
    </Section>
  );
};
