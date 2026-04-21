import { useMemo } from "react";
import rehypeSanitize, { defaultSchema } from "rehype-sanitize";
import rehypeStringify from "rehype-stringify";
import { unified } from "unified";
import uniorgParse from "uniorg-parse";
import uniorg2rehype from "uniorg-rehype";

import { toInternalHref } from "@/app/lib/githubUrl";

// Rehype plugin: rewrite <a href="https://github.com/..."> to our in-app routes
// when a mapping exists. OrgRendered emits raw HTML via dangerouslySetInnerHTML,
// so anchors aren't intercepted by the router — we just rewrite the href string
// in place. Internal navigation will cause a full page load, but the router will
// pick it up on the next mount. If you need client-side nav here, switch this
// component to return JSX with per-node <Link> instead of a string.
// biome-ignore lint/suspicious/noExplicitAny: hast node types live outside our dep tree.
function rehypeRewriteGithubLinks() {
  return (tree: any) => {
    const visit = (node: any) => {
      if (node.type === "element" && node.tagName === "a" && node.properties) {
        const href = node.properties.href;
        if (typeof href === "string") {
          const internal = toInternalHref(href);
          if (internal) node.properties.href = internal;
        }
      }
      if (Array.isArray(node.children)) {
        for (const child of node.children) visit(child);
      }
    };
    visit(tree);
  };
}

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
  .use(rehypeRewriteGithubLinks)
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
