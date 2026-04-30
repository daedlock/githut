import { GithubMarkdown, type MarkdownAssetContext } from "@/app/components/GithubMarkdown";
import { OrgRendered } from "@/app/components/OrgRendered";
import { detectLang } from "@/app/lib/detectLang";
import type { RepoContext } from "@/app/lib/remarkMentions";

export function isOrgMarkupPath(path: string | undefined): boolean {
  return path ? detectLang(path) === "org" : false;
}

export function MarkupRenderer({
  children,
  path,
  assetContext,
  repoContext,
}: {
  children: string;
  path?: string;
  assetContext?: MarkdownAssetContext;
  repoContext?: RepoContext;
}) {
  if (isOrgMarkupPath(path)) {
    return <OrgRendered assetContext={assetContext}>{children}</OrgRendered>;
  }

  return (
    <GithubMarkdown assetContext={assetContext} repoContext={repoContext}>
      {children}
    </GithubMarkdown>
  );
}
