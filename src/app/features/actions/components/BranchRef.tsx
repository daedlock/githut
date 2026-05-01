import { Check, Clipboard, GitBranch } from "lucide-react";
import { useState } from "react";
import { Button } from "@/app/components/ui/button";
import { HoverCard, HoverCardContent, HoverCardTrigger } from "@/app/components/ui/hover-card";
import { cn } from "@/app/lib/cn";

export function BranchRef({ branch, className }: { branch: string; className?: string }) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    await navigator.clipboard.writeText(branch);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1200);
  }

  return (
    <HoverCard openDelay={250} closeDelay={100}>
      <HoverCardTrigger asChild>
        <span
          className={cn(
            "inline-flex min-w-0 items-center gap-1 rounded-sm px-1 py-0.5",
            "font-mono transition-colors hover:bg-muted hover:text-foreground",
            className,
          )}
        >
          <GitBranch className="size-3 shrink-0 opacity-50" aria-hidden />
          <span className="truncate">{shortBranch(branch)}</span>
        </span>
      </HoverCardTrigger>
      <HoverCardContent align="start" className="w-80">
        <div className="flex flex-col gap-2">
          <div className="break-all font-mono text-caption text-foreground">{branch}</div>
          <Button type="button" size="xs" variant="secondary" onClick={copy} className="self-start">
            {copied ? <Check data-icon="inline-start" /> : <Clipboard data-icon="inline-start" />}
            {copied ? "Copied" : "Copy branch"}
          </Button>
        </div>
      </HoverCardContent>
    </HoverCard>
  );
}

function shortBranch(branch: string): string {
  if (branch.length <= 30) return branch;
  const parts = branch.split("/");
  const last = parts.at(-1) ?? branch;
  if (last.length <= 24 && parts.length > 1) return `…/${last}`;
  return `${branch.slice(0, 14)}…${branch.slice(-12)}`;
}
