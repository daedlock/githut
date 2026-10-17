import { ExternalLink } from "lucide-react";
import { Button } from "@/app/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/app/components/ui/tooltip";
import { getOpenInGithubHref } from "@/app/lib/openGithubUrl";

/** The GitHub page for a tab's href, or null where GitHub has no equivalent. */
export function githubHrefFor(href: string): string | null {
  const url = new URL(href, "https://githut.invalid");
  return getOpenInGithubHref({
    pathname: url.pathname,
    search: Object.fromEntries(url.searchParams),
    hash: url.hash,
  });
}

/** Lives in each island's header, so it always opens that island's page. */
export function OpenInGithubLink({ href }: { href: string }) {
  const github = githubHrefFor(href);
  if (!github) return null;
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button asChild variant="ghost" size="icon-sm" className="shrink-0 text-muted-foreground">
          <a href={github} target="_blank" rel="noreferrer" aria-label="Open in GitHub">
            <ExternalLink />
          </a>
        </Button>
      </TooltipTrigger>
      <TooltipContent side="bottom">Open in GitHub</TooltipContent>
    </Tooltip>
  );
}
