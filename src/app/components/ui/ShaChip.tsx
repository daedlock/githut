import { Link } from "@tanstack/react-router";
import { Check, Copy } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { Button } from "@/app/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/app/components/ui/tooltip";
import { cn } from "@/app/lib/cn";

/**
 * SHA chip with copy functionality.
 *
 * Variants:
 * - "pill" (default): Pill link to commit + separate copy button
 * - "compact": Single button with SHA + copy icon inside
 * - "inline": Just the SHA text with copy on click
 *
 * Copying swaps the copy icon for a check in place, so nothing shifts.
 */

export type ShaChipProps = {
  /** Full SHA hash */
  sha: string;
  /** Short SHA to display (defaults to first 7 chars) */
  short?: string;
  /** Visual variant */
  variant?: "pill" | "compact" | "inline";
  /** Link to commit page (only for "pill" variant) */
  link?: { owner: string; repo: string };
  /** Additional class names */
  className?: string;
};

function useCopy(text: string) {
  const [copied, setCopied] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    [],
  );
  const copy = useCallback(
    (event: React.MouseEvent) => {
      event.stopPropagation();
      event.preventDefault();
      void navigator.clipboard.writeText(text).then(() => {
        setCopied(true);
        if (timer.current) clearTimeout(timer.current);
        timer.current = setTimeout(() => setCopied(false), 1200);
      });
    },
    [text],
  );
  return { copied, copy };
}

const chipFocus = "outline-none focus-visible:ring-1 focus-visible:ring-foreground/15";

function CopyIcon({ copied }: { copied: boolean }) {
  return copied ? (
    <Check aria-hidden className="size-3 shrink-0 text-(--color-success)" />
  ) : (
    <Copy aria-hidden className="size-3 shrink-0" />
  );
}

function CopiedAnnouncement({ copied }: { copied: boolean }) {
  return (
    <span className="sr-only" aria-live="polite">
      {copied ? "Copied" : ""}
    </span>
  );
}

export function ShaChip({ sha, short, variant = "pill", link, className }: ShaChipProps) {
  const shortSha = short ?? sha.slice(0, 7);
  const { copied, copy } = useCopy(sha);
  const hint = copied ? "Copied" : "Copy full SHA";

  if (variant === "compact" || variant === "inline") {
    return (
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            type="button"
            onClick={copy}
            aria-label={`Copy full SHA ${sha}`}
            className={cn(
              "inline-flex shrink-0 items-center gap-1 font-mono tabular-nums text-muted-foreground transition-colors hover:text-foreground",
              chipFocus,
              variant === "compact"
                ? "h-5 rounded-sm bg-muted pr-1 pl-1.5 text-micro hover:bg-accent"
                : "h-6 rounded-sm px-1.5 text-caption hover:bg-muted",
              className,
            )}
          >
            <span>{shortSha}</span>
            <CopyIcon copied={copied} />
            <CopiedAnnouncement copied={copied} />
          </button>
        </TooltipTrigger>
        <TooltipContent>{hint}</TooltipContent>
      </Tooltip>
    );
  }

  // "pill" variant (default) - link + separate copy button
  const pill =
    "inline-flex h-6 items-center rounded-full bg-muted px-2 font-mono text-caption tabular-nums text-muted-foreground";
  return (
    <div className={cn("flex shrink-0 items-center gap-1", className)}>
      {link ? (
        <Tooltip>
          <TooltipTrigger asChild>
            <Link
              to="/$owner/$repo/commit/$sha"
              params={{ owner: link.owner, repo: link.repo, sha }}
              aria-label={`Commit ${sha}`}
              className={cn(
                pill,
                chipFocus,
                "transition-colors hover:bg-accent hover:text-foreground",
              )}
            >
              {shortSha}
            </Link>
          </TooltipTrigger>
          <TooltipContent className="font-mono">{sha}</TooltipContent>
        </Tooltip>
      ) : (
        <span className={pill}>{shortSha}</span>
      )}
      <Tooltip>
        <TooltipTrigger asChild>
          <Button variant="ghost" size="icon-xs" onClick={copy} aria-label="Copy full SHA">
            <CopyIcon copied={copied} />
          </Button>
        </TooltipTrigger>
        <TooltipContent>{hint}</TooltipContent>
      </Tooltip>
      <CopiedAnnouncement copied={copied} />
    </div>
  );
}
