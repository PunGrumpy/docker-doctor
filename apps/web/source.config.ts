import { remarkMdxMermaid } from "fumadocs-core/mdx-plugins";
import { metaSchema, pageSchema } from "fumadocs-core/source/schema";
import { defineConfig, defineDocs } from "fumadocs-mdx/config";
import type { LastModifiedPluginOptions } from "fumadocs-mdx/plugins/last-modified";
import lastModified from "fumadocs-mdx/plugins/last-modified";

// Some docs use non-standard fenced code labels like
// `\`\`\`384:401:path/to/file.ts` (line range + file path instead of a
// language). Shiki rejects those. Normalize anything that isn't a plain
// language identifier to `text`, preserving the original label as fence
// meta so it still renders above the block.
const remarkNormalizeCodeLang = () => (tree: { children?: unknown[] }) => {
  const validLang = /^[a-zA-Z][a-zA-Z0-9+#-]*$/u;
  const walk = (node: unknown) => {
    if (!node || typeof node !== "object") {
      return;
    }
    const n = node as {
      type?: string;
      lang?: string;
      meta?: string;
      children?: unknown[];
    };
    if (
      n.type === "code" &&
      typeof n.lang === "string" &&
      !validLang.test(n.lang)
    ) {
      n.meta = n.meta ? `${n.lang} ${n.meta}` : n.lang;
      n.lang = "text";
    }
    if (Array.isArray(n.children)) {
      for (const c of n.children) {
        walk(c);
      }
    }
  };
  walk(tree);
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
