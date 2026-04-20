import { defaultSchema } from "rehype-sanitize";
import ReactMarkdown from "react-markdown";
import rehypeRaw from "rehype-raw";
import rehypeSanitize from "rehype-sanitize";
import remarkGfm from "remark-gfm";

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

export function GithubMarkdown({ children }: { children: string }) {
  return (
    <ReactMarkdown remarkPlugins={REMARK_PLUGINS} rehypePlugins={REHYPE_PLUGINS}>
      {children}
    </ReactMarkdown>
  );
}
