import { useMemo } from "react";
import rehypeSanitize, { defaultSchema } from "rehype-sanitize";
import rehypeStringify from "rehype-stringify";
import { unified } from "unified";
import uniorgParse from "uniorg-parse";
import uniorg2rehype from "uniorg-rehype";

// Same permissive-but-safe sanitize schema as GithubMarkdown — org files often
// embed HTML blocks (`#+BEGIN_HTML`) and use the same tags markdown does, so we
// allow the same extended tag/attr set here.
const sanitizeSchema = {
  ...defaultSchema,
  tagNames: [
    ...(defaultSchema.tagNames ?? []),
    "details",
    "summary",
    "kbd",
    "sup",
    "sub",
    "mark",
    "del",
    "ins",
    "abbr",
    "cite",
    "dfn",
    "samp",
    "var",
  ],
  attributes: {
    ...defaultSchema.attributes,
    td: [...(defaultSchema.attributes?.td ?? []), "align"],
    th: [...(defaultSchema.attributes?.th ?? []), "align"],
    img: [...(defaultSchema.attributes?.img ?? []), "width", "height", "align"],
    div: [...(defaultSchema.attributes?.div ?? []), "align"],
    p: [...(defaultSchema.attributes?.p ?? []), "align"],
    "*": [...(defaultSchema.attributes?.["*"] ?? []), "id"],
  },
};

// Build the pipeline once at module load — unified processors are stateless
// between processSync calls, so reusing saves a pile of plugin setup per render.
// biome-ignore lint/suspicious/noExplicitAny: unified's plugin type is structurally incompatible with its own processor.use()
const processor = unified()
  .use(uniorgParse as any)
  .use(uniorg2rehype as any)
  .use(rehypeSanitize, sanitizeSchema)
  .use(rehypeStringify);

export function OrgRendered({ children }: { children: string }) {
  const html = useMemo(() => {
    try {
      return String(processor.processSync(children));
    } catch {
      // Malformed org — fall back to plain text so the user still sees content.
      return `<pre>${escapeHtml(children)}</pre>`;
    }
  }, [children]);

  // eslint-disable-next-line react/no-danger
  return <div dangerouslySetInnerHTML={{ __html: html }} />;
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
