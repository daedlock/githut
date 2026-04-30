import { useMemo } from "react";
import rehypeSanitize, { defaultSchema } from "rehype-sanitize";
import rehypeStringify from "rehype-stringify";
import { type Plugin, unified } from "unified";
import uniorgParse from "uniorg-parse";
import uniorg2rehype from "uniorg-rehype";

import {
  type MarkdownAssetContext,
  proxyGitHubImage,
  rewriteAssetUrl,
} from "@/app/components/GithubMarkdown";
import { toInternalHref } from "@/app/lib/githubUrl";

// Rehype plugin: keep org output aligned with GithubMarkdown.
// - GitHub links are rewritten to in-app routes when a mapping exists.
// - Relative image URLs in repo documents are rewritten to raw GitHub assets.
// OrgRendered emits raw HTML via dangerouslySetInnerHTML, so anchors aren't
// intercepted by the router — we rewrite the href string in place.
type HastNode = {
  type?: string;
  tagName?: string;
  properties?: Record<string, unknown>;
  children?: HastNode[];
};

function rehypeRewriteGithubUrls(assetContext?: MarkdownAssetContext) {
  return (tree: HastNode) => {
    const visit = (node: HastNode) => {
      if (node.type === "element" && node.properties) {
        if (node.tagName === "a") {
          const href = node.properties.href;
          if (typeof href === "string") {
            const internal = toInternalHref(href);
            if (internal) node.properties.href = internal;
          }
        }

        if (node.tagName === "img") {
          const src = node.properties.src;
          if (typeof src === "string") {
            const resolved = assetContext ? rewriteAssetUrl(src, assetContext) : src;
            node.properties.src = proxyGitHubImage(resolved);
          }
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

const uniorgParsePlugin = uniorgParse as unknown as Plugin<[]>;
const uniorg2rehypePlugin = uniorg2rehype as unknown as Plugin<[]>;

function renderOrg(source: string, assetContext?: MarkdownAssetContext): string {
  const processor = unified()
    .use(uniorgParsePlugin)
    .use(uniorg2rehypePlugin)
    .use(rehypeRewriteGithubUrls, assetContext)
    .use(rehypeSanitize, sanitizeSchema)
    .use(rehypeStringify);

  return String(processor.processSync(source));
}

export function OrgRendered({
  children,
  assetContext,
}: {
  children: string;
  assetContext?: MarkdownAssetContext;
}) {
  const owner = assetContext?.owner;
  const repo = assetContext?.repo;
  const ref = assetContext?.ref;
  const basePath = assetContext?.basePath;

  const html = useMemo(() => {
    const context = owner && repo ? { owner, repo, ref, basePath } : undefined;
    try {
      return renderOrg(children, context);
    } catch {
      // Malformed org — fall back to plain text so the user still sees content.
      return `<pre>${escapeHtml(children)}</pre>`;
    }
  }, [children, owner, repo, ref, basePath]);

  // biome-ignore lint/security/noDangerouslySetInnerHtml: org HTML is sanitized by rehype-sanitize above.
  return <div dangerouslySetInnerHTML={{ __html: html }} />;
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
