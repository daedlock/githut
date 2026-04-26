import type { Root, Text, Link, PhrasingContent } from "mdast";
import { visit } from "unist-util-visit";

export type RepoContext = { owner: string; repo: string };

export function remarkMentions(ctx?: RepoContext) {
  return () => (tree: Root) => {
    visit(tree, "text", (node: Text, index, parent) => {
      if (!parent || index === undefined) return;
      if (parent.type === "link") return;

      const parts: PhrasingContent[] = [];
      const text = node.value;
      let last = 0;

      const combined = new RegExp(
        `(?<!\w)@([a-zA-Z0-9](?:[a-zA-Z0-9-]*[a-zA-Z0-9])?)(?!\w)${ctx ? "|(?<!\\w)#(\\d+)(?!\\w)" : ""}`,
        "g",
      );

      let match: RegExpExecArray | null;
      while ((match = combined.exec(text)) !== null) {
        if (match.index > last) {
          parts.push({ type: "text", value: text.slice(last, match.index) });
        }

        if (match[1]) {
          const login = match[1];
          const link: Link = {
            type: "link",
            url: `https://github.com/${login}`,
            children: [{ type: "text", value: `@${login}` }],
          };
          parts.push(link);
        } else if (match[2] && ctx) {
          const num = match[2];
          const link: Link = {
            type: "link",
            url: `https://github.com/${ctx.owner}/${ctx.repo}/issues/${num}`,
            children: [{ type: "text", value: `#${num}` }],
          };
          parts.push(link);
        }

        last = match.index + match[0].length;
      }

      if (parts.length === 0) return;

      if (last < text.length) {
        parts.push({ type: "text", value: text.slice(last) });
      }

      parent.children.splice(index, 1, ...parts);
    });
  };
}
