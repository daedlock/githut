import { CaretDown } from "@phosphor-icons/react";
import { FileIcon } from "@primer/octicons-react";
import { useState } from "react";
import { GithubMarkdown } from "@/app/components/GithubMarkdown";
import { Skeleton } from "@/app/components/ui/skeleton";
import { cn } from "@/app/lib/cn";
import { ProfileSectionHeader } from "./ProfileSectionHeader";

const COLLAPSED_HEIGHT = 420; // px

export type ProfileReadmeProps = {
  markdown: string | null | undefined;
  isLoading: boolean;
  /** Owner login — used to resolve relative asset URLs in the README. */
  login: string;
  /** When the profile is an org, the README lives in `<login>/.github`. */
  isOrg: boolean;
};

/**
 * Profile README block — the user's portfolio. The markdown gets one raised
 * surface because it is a contained document region, not a row list.
 *
 * - Users: read from `<login>/<login>` repo's README.
 * - Orgs:  read from `<login>/.github/profile/README.md`.
 */
export function ProfileReadme({ markdown, isLoading, login, isOrg }: ProfileReadmeProps) {
  const [expanded, setExpanded] = useState(false);

  if (isLoading) {
    return (
      <section className="flex flex-col gap-4 rounded-xl bg-muted px-4 py-4 sm:px-5 sm:py-5">
        <SectionEyebrow />
        <div className="flex flex-col gap-3">
          <Skeleton className="h-4 w-3/4" />
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-5/6" />
          <Skeleton className="h-4 w-2/3" />
          <Skeleton className="h-4 w-1/2" />
        </div>
      </section>
    );
  }

  if (!markdown) return null;

  // Heuristic: only collapse long READMEs. Markdown is hard to measure without
  // a layout pass, but character count is a decent proxy for "this will run
  // past 420px". Tuned conservatively so short bios always show in full.
  const isLong = markdown.length > 600;

  return (
    <section className="flex flex-col gap-4 rounded-xl bg-muted px-4 py-4 sm:px-5 sm:py-5">
      <SectionEyebrow />

      <div className="relative">
        <div
          className={cn(
            "readme-prose max-w-none transition-[max-height] duration-200",
            isLong && !expanded && "overflow-hidden",
          )}
          style={{
            maxHeight: isLong && !expanded ? `${COLLAPSED_HEIGHT}px` : undefined,
          }}
        >
          <GithubMarkdown
            assetContext={{
              owner: login,
              repo: isOrg ? ".github" : login,
              ref: "HEAD",
              basePath: isOrg ? "profile/" : "",
            }}
          >
            {markdown}
          </GithubMarkdown>
        </div>

        {isLong && !expanded && (
          <div
            aria-hidden
            className="pointer-events-none absolute inset-x-0 bottom-0 h-32 bg-gradient-to-t from-muted via-muted/85 to-transparent"
          />
        )}
      </div>

      {isLong && (
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          className={cn(
            "inline-flex items-center justify-center gap-1.5 self-center",
            "rounded-md px-3 py-1.5 text-caption text-muted-foreground",
            "transition-colors hover:bg-background hover:text-foreground",
          )}
        >
          {expanded ? "Collapse README" : "Read full README"}
          <CaretDown
            className={cn("size-3.5 transition-transform", expanded && "rotate-180")}
            aria-hidden
          />
        </button>
      )}
    </section>
  );
}

function SectionEyebrow() {
  return (
    <ProfileSectionHeader
      title="Readme"
      icon={<FileIcon className="size-3 text-(--color-fg-faint)" />}
    />
  );
}
