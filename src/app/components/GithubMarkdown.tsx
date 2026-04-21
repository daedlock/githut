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

// Rewrite github.com links that have an in-app equivalent to our own routes,
// and navigate them via TanStack Router's <Link> so clicks stay client-side.
// External links keep their original <a> rendering with safe rel/target.
const MARKDOWN_COMPONENTS: Components = {
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
};

export function GithubMarkdown({ children }: { children: string }) {
  return (
    <ReactMarkdown
      remarkPlugins={REMARK_PLUGINS}
      rehypePlugins={REHYPE_PLUGINS}
      components={MARKDOWN_COMPONENTS}
    >
      {children}
    </ReactMarkdown>
  );
}
