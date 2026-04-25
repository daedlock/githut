import { Check, Copy } from "lucide-react";
import { Link } from "@tanstack/react-router";
import { useState } from "react";
import { cn } from "@/app/lib/cn";

/**
 * SHA chip with copy functionality.
 *
 * Variants:
 * - "pill" (default): Pill link to commit + separate copy button
 * - "compact": Single button with SHA + copy icon inside
 * - "inline": Just the SHA text with copy on click
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

export function ShaChip({
  sha,
  short,
  variant = "pill",
  link,
  className,
}: ShaChipProps) {
  const shortSha = short ?? sha.slice(0, 7);
  const [copied, setCopied] = useState(false);

  const handleCopy = (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    navigator.clipboard.writeText(sha).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1200);
    });
  };

  if (variant === "compact") {
    return (
      <button
        type="button"
        onClick={handleCopy}
        title={copied ? "Copied!" : "Copy full SHA"}
        aria-label="Copy full SHA"
        className={cn(
          "group inline-flex h-5 shrink-0 items-center gap-1 rounded",
          "border border-border bg-(--color-bg-subtle) pl-1.5 pr-1",
          "font-mono text-micro tabular-nums leading-none text-muted-foreground",
          "outline-none transition-colors",
          "hover:border-(--color-border-strong) hover:bg-(--color-bg-sunken) hover:text-foreground",
          "focus-visible:ring-1 focus-visible:ring-(--color-focus)",
          className,
        )}
      >
        <span>{shortSha}</span>
        {copied ? (
          <Check
            className="size-2.5 text-(--color-success)"
            strokeWidth={2.5}
            aria-hidden
          />
        ) : (
          <Copy
            className="size-2.5 text-muted-foreground transition-colors group-hover:text-foreground"
            strokeWidth={2}
            aria-hidden
          />
        )}
      </button>
    );
  }

  if (variant === "inline") {
    return (
      <button
        type="button"
        onClick={handleCopy}
        className={cn(
          "inline-flex items-center gap-1 rounded-sm border border-border px-1.5 py-0.5",
          "font-mono text-caption text-muted-foreground outline-none transition-colors",
          "hover:bg-background hover:text-foreground",
          "focus-visible:ring-1 focus-visible:ring-foreground/15",
          className,
        )}
        aria-label={`Copy full SHA ${sha}`}
      >
        <span>{shortSha}</span>
        <Copy className="size-3" />
        {copied && <span className="text-(--color-success)">copied</span>}
      </button>
    );
  }

  // "pill" variant (default) - link + separate copy button
  return (
    <div className={cn("flex shrink-0 items-center gap-1", className)}>
      {link ? (
        <Link
          to="/$owner/$repo/commit/$sha"
          params={{ owner: link.owner, repo: link.repo, sha }}
          className={cn(
            "rounded-full bg-muted px-2.5 py-1",
            "font-mono text-xs leading-none tabular-nums text-muted-foreground",
            "outline-none transition-colors",
            "hover:text-foreground",
            "focus-visible:ring-1 focus-visible:ring-foreground/15",
          )}
          title={sha}
        >
          {shortSha}
        </Link>
      ) : (
        <span
          className="rounded-full bg-muted px-2.5 py-1 font-mono text-micro leading-none tabular-nums text-muted-foreground"
          title={sha}
        >
          {shortSha}
        </span>
      )}
      <button
        type="button"
        onClick={handleCopy}
        title={copied ? "Copied!" : "Copy SHA"}
        aria-label="Copy full SHA"
        className={cn(
          "rounded-full p-1.5 text-(--color-fg-faint) outline-none transition-colors",
          "hover:bg-muted hover:text-muted-foreground",
          "focus-visible:ring-1 focus-visible:ring-foreground/15",
        )}
      >
        <Copy className="size-3" />
      </button>
    </div>
  );
}
