import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Check, ChevronDown, Code, Copy, Download, ExternalLink } from "lucide-react";
import { Button } from "@/app/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/app/components/ui/popover";
import { cn } from "@/app/lib/cn";

type Protocol = "https" | "ssh" | "cli";

const PROTOCOLS: { id: Protocol; label: string; hint: string }[] = [
  { id: "https", label: "HTTPS", hint: "Clone with a URL via HTTPS" },
  { id: "ssh", label: "SSH", hint: "Clone with an SSH key" },
  { id: "cli", label: "GitHub CLI", hint: "Use the official `gh` CLI" },
];

export function CloneDropdown({
  owner,
  repo,
  branch,
}: {
  owner: string;
  repo: string;
  branch: string | undefined;
}) {
  const [protocol, setProtocol] = useState<Protocol>("https");
  const [copied, setCopied] = useState(false);

  const url =
    protocol === "https"
      ? `https://github.com/${owner}/${repo}.git`
      : protocol === "ssh"
        ? `git@github.com:${owner}/${repo}.git`
        : `gh repo clone ${owner}/${repo}`;

  const downloadHref = branch
    ? `https://github.com/${owner}/${repo}/archive/refs/heads/${encodeURIComponent(branch)}.zip`
    : undefined;

  const onCopy = async () => {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 1400);
    } catch {
      // clipboard access can fail in non-https contexts; fall back silently
    }
  };

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button size="sm" variant="default" className="gap-1.5">
          <Code data-icon="inline-start" />
          <span>Code</span>
          <ChevronDown
            data-icon="inline-end"
            className="opacity-80 transition-transform group-aria-expanded/button:rotate-180"
          />
        </Button>
      </PopoverTrigger>

      <PopoverContent align="end" sideOffset={6} className="w-80 gap-3 p-3">
        {/* Header — section label */}
        <div className="flex items-center justify-between">
          <span className="text-caption font-medium text-muted-foreground">Clone</span>
          <a
            href={`https://github.com/${owner}/${repo}`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-caption text-muted-foreground hover:text-foreground"
          >
            <span>Open on GitHub</span>
            <ExternalLink className="size-3" />
          </a>
        </div>

        {/* Protocol switcher */}
        <div className="grid grid-cols-3 gap-px rounded-md bg-[var(--color-bg-sunken)] p-0.5">
          {PROTOCOLS.map((p) => (
            <button
              key={p.id}
              type="button"
              onClick={() => setProtocol(p.id)}
              aria-pressed={protocol === p.id}
              className={cn(
                "relative h-6 rounded-[4px] px-2 text-caption font-medium",
                "outline-none focus-visible:ring-1 focus-visible:ring-[var(--color-focus)]",
                "transition-colors",
                protocol === p.id
                  ? "text-foreground"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              {protocol === p.id && (
                <motion.span
                  layoutId="clone-protocol-pill"
                  className="absolute inset-0 rounded-[4px] bg-background ring-1 ring-border"
                  transition={{ type: "spring", stiffness: 600, damping: 38 }}
                />
              )}
              <span className="relative">{p.label}</span>
            </button>
          ))}
        </div>

        {/* URL field */}
        <div className="flex flex-col gap-1.5">
          <span className="text-caption text-muted-foreground">
            {PROTOCOLS.find((p) => p.id === protocol)?.hint}
          </span>
          <div className="flex items-stretch gap-1.5">
            <div className="flex min-w-0 flex-1 items-center rounded-md border border-input bg-background px-2 py-1.5 font-mono text-caption text-foreground">
              <span className="truncate">{url}</span>
            </div>
            <Button
              type="button"
              variant="outline"
              size="icon-sm"
              onClick={onCopy}
              aria-label={copied ? "Copied" : "Copy clone command"}
              className="relative shrink-0"
            >
              <AnimatePresence mode="popLayout" initial={false}>
                {copied ? (
                  <motion.span
                    key="check"
                    initial={{ scale: 0.4, opacity: 0, rotate: -30 }}
                    animate={{ scale: 1, opacity: 1, rotate: 0 }}
                    exit={{ scale: 0.4, opacity: 0 }}
                    transition={{ type: "spring", stiffness: 600, damping: 20 }}
                    className="flex"
                  >
                    <Check className="size-3.5 text-[var(--color-success)]" />
                  </motion.span>
                ) : (
                  <motion.span
                    key="copy"
                    initial={{ scale: 0.6, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    exit={{ scale: 0.6, opacity: 0 }}
                    transition={{ duration: 0.15 }}
                    className="flex"
                  >
                    <Copy className="size-3.5" />
                  </motion.span>
                )}
              </AnimatePresence>
            </Button>
          </div>
        </div>

        {/* Download */}
        <div className="flex flex-col gap-1.5 border-t border-border pt-3">
          <span className="text-caption font-medium text-muted-foreground">Download</span>
          {downloadHref ? (
            <a
              href={downloadHref}
              className={cn(
                "flex items-center gap-2 rounded-md px-2 py-1.5",
                "text-ui text-foreground",
                "hover:bg-muted transition-colors",
              )}
            >
              <Download className="size-3.5 text-muted-foreground" />
              <span className="flex-1 text-caption">Download ZIP</span>
              <span className="font-mono text-caption text-muted-foreground">{branch}</span>
            </a>
          ) : (
            <span className="px-2 py-1.5 text-caption text-muted-foreground">
              Default branch unavailable
            </span>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
