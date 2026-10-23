import { remarkMdxMermaid } from "fumadocs-core/mdx-plugins";
import { metaSchema, pageSchema } from "fumadocs-core/source/schema";
import { defineConfig, defineDocs } from "fumadocs-mdx/config";
import type { LastModifiedPluginOptions } from "fumadocs-mdx/plugins/last-modified";
import lastModified from "fumadocs-mdx/plugins/last-modified";

interface MarkdownNode {
  children?: unknown;
  lang?: unknown;
  meta?: unknown;
  type?: unknown;
}

const isMarkdownNode = (value: unknown): value is MarkdownNode =>
  typeof value === "object" && value !== null;

const isString = (value: unknown): value is string => typeof value === "string";

const VALID_LANG = /^[a-zA-Z][a-zA-Z0-9+#-]*$/u;

// Shiki rejects a fence label that is not a language, such as
// `\`\`\`384:401:path/to/file.ts` (a line range and a file path). Normalize
// anything that isn't a plain language identifier to `text`, preserving the
// original label as fence meta so it still renders above the block.
const normalizeCodeLang = (node: MarkdownNode): void => {
  if (
    node.type === "code" &&
    isString(node.lang) &&
    !VALID_LANG.test(node.lang)
  ) {
    node.meta =
      isString(node.meta) && node.meta !== ""
        ? `${node.lang} ${node.meta}`
        : node.lang;
    node.lang = "text";
  }

  if (Array.isArray(node.children)) {
    for (const child of node.children) {
      if (isMarkdownNode(child)) {
        normalizeCodeLang(child);
      }
    }
  }
};

const remarkNormalizeCodeLang = () => (tree: MarkdownNode) => {
  normalizeCodeLang(tree);
};

const lastModifiedVersionControl: LastModifiedPluginOptions["versionControl"] =
  process.env.VERCEL === "1" ? undefined : "git";

export const docs = defineDocs({
  dir: "content/docs",
  docs: {
    postprocess: {
      includeProcessedMarkdown: true,
    },
    schema: pageSchema,
  },
  meta: {
    schema: metaSchema,
  },
});

export default defineConfig({
  mdxOptions: {
    rehypeCodeOptions: {
      themes: {
        dark: "github-dark",
        light: "github-light",
      },
    },
    remarkPlugins: [remarkMdxMermaid, remarkNormalizeCodeLang],
  },
  plugins: [lastModified({ versionControl: lastModifiedVersionControl })],
});
