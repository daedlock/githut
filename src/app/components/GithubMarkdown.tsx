import { Link } from "@tanstack/react-router";
import { defaultSchema } from "rehype-sanitize";
import ReactMarkdown, { type Components } from "react-markdown";
import rehypeRaw from "rehype-raw";
import rehypeSanitize from "rehype-sanitize";
import remarkGfm from "remark-gfm";

import { toInternalHref } from "@/app/lib/githubUrl";

// Extended sanitize schema — GitHub-compatible HTML subset.
// Adds: details/summary, kbd, sup, sub, mark, del, ins, align/width/height attrs.
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

const REMARK_PLUGINS = [remarkGfm];
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const REHYPE_PLUGINS: any[] = [rehypeRaw, [rehypeSanitize, sanitizeSchema]];

/**
 * Repo context for resolving relative asset URLs in markdown. When a README
 * contains `![logo](./assets/logo.png)` we need to rewrite the img src to
 * `https://raw.githubusercontent.com/{owner}/{repo}/{ref}/{basePath}/assets/logo.png`
 * — otherwise the browser tries to load it from our app's origin and 404s.
 *
 * - `basePath` is the DIRECTORY of the markdown file (e.g. "docs" for
 *   `docs/intro.md`). Leave empty for a root-level README.
 * - `ref` can be a branch name, tag, or commit SHA. Falls back to "HEAD".
 * - Omit this prop entirely for non-repo contexts (issue/comment bodies)
 *   where URLs are already absolute.
 */
export type MarkdownAssetContext = {
  owner: string;
  repo: string;
  ref?: string;
  basePath?: string;
};

/**
 * Rewrite a markdown asset URL to its raw.githubusercontent.com equivalent
 * when it's relative. Absolute URLs (http(s)://, data:, //), in-page anchors,
 * and mailto: links pass through unchanged.
 */
export function rewriteAssetUrl(src: string, ctx: MarkdownAssetContext): string {
  if (!src) return src;
  // Already absolute (any scheme), protocol-relative, or an in-page anchor —
  // leave alone. Covers http(s)://, data:, mailto:, tel:, //cdn/..., #section.
  if (/^[a-z][a-z0-9+\-.]*:/i.test(src) || src.startsWith("//") || src.startsWith("#")) {
    return src;
  }
  const branch = ctx.ref ?? "HEAD";
  const rawBase = `https://raw.githubusercontent.com/${ctx.owner}/${ctx.repo}/${branch}/`;
  // Leading-slash path = repo-root-relative ("/docs/logo.png" → repo root + docs/logo.png)
  if (src.startsWith("/")) {
    return rawBase + src.replace(/^\/+/, "");
  }
  // Truly relative — resolve against basePath (the directory of the current
  // markdown file). Using URL constructor handles `..` and `.` segments.
  const dir = ctx.basePath
    ? ctx.basePath.endsWith("/")
      ? ctx.basePath
      : `${ctx.basePath}/`
    : "";
  try {
    return new URL(src, rawBase + dir).toString();
  } catch {
    return src;
  }
}

function buildComponents(assetContext?: MarkdownAssetContext): Components {
  return {
    // Rewrite github.com links that have an in-app equivalent to our own
    // routes, and navigate them via TanStack Router's <Link> so clicks stay
    // client-side. External links keep their original <a> rendering.
    a: ({ href, children, ...rest }) => {
      const internal = href ? toInternalHref(href) : null;
      if (internal) {
        return (
          <Link to={internal} {...rest}>
            {children}
          </Link>
        );
      }
      return (
        <a href={href} target="_blank" rel="noopener noreferrer" {...rest}>
          {children}
        </a>
      );
    },
    // Rewrite relative image srcs to raw.githubusercontent.com so they load
    // from GitHub instead of our own origin. Absolute URLs pass through.
    img: ({ src, alt, ...rest }) => {
      const resolved = assetContext && typeof src === "string" ? rewriteAssetUrl(src, assetContext) : src;
      // biome-ignore lint/a11y/useAltText: alt is preserved from the source markdown
      return <img src={resolved as string | undefined} alt={alt} {...rest} />;
    },
  };
}

const MARKDOWN_COMPONENTS_NO_CONTEXT = buildComponents();

export function GithubMarkdown({
  children,
  assetContext,
}: {
  children: string;
  assetContext?: MarkdownAssetContext;
}) {
  // When no asset context is provided (e.g. issue/comment bodies where URLs
  // are usually absolute) reuse a shared components object to avoid churning
  // react-markdown's memo on every render.
  const components = assetContext ? buildComponents(assetContext) : MARKDOWN_COMPONENTS_NO_CONTEXT;
  return (
    <ReactMarkdown
      remarkPlugins={REMARK_PLUGINS}
      rehypePlugins={REHYPE_PLUGINS}
      components={components}
    >
      {children}
    </ReactMarkdown>
  );
}
