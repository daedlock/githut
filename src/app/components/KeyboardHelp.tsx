import { useRouterState } from "@tanstack/react-router";
import { useMemo } from "react";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/app/components/ui/dialog";
import { Kbd } from "@/app/components/ui/kbd";
import { useKeybindings } from "@/app/hooks/useKeybindings";
import { cn } from "@/app/lib/cn";
import { useKeyboardHelpStore } from "@/app/stores/keyboardHelp";

type Scope = "global" | "tabs" | "repo" | "diff" | "list" | "inbox";

type Shortcut = {
  chord: string;
  label: string;
  scope: Scope;
};

const SHORTCUTS: readonly Shortcut[] = [
  // Global
  { chord: "⌘ K", label: "Open command palette", scope: "global" },
  { chord: "⌘ B", label: "Toggle sidebar", scope: "global" },
  { chord: "?", label: "Open keyboard help", scope: "global" },
  { chord: "g h", label: "Go to inbox", scope: "global" },
  { chord: "g i", label: "Go to issues", scope: "global" },
  { chord: "g p", label: "Go to pull requests", scope: "global" },
  { chord: "g c", label: "Go to code", scope: "global" },

  // Tabs
  { chord: "⇧ Click", label: "Open link in new tab", scope: "tabs" },
  { chord: "Alt W", label: "Close tab", scope: "tabs" },
  { chord: "⌘ Z", label: "Undo layout change", scope: "tabs" },
  { chord: "Alt ⇧ T", label: "Reopen closed tab", scope: "tabs" },
  { chord: "Alt [", label: "Previous tab", scope: "tabs" },
  { chord: "Alt ]", label: "Next tab", scope: "tabs" },
  { chord: "Alt 1–9", label: "Jump to tab (9 = last)", scope: "tabs" },
  { chord: "Alt \\", label: "Split island right", scope: "tabs" },
  { chord: "Alt ⇧ ←↑↓→", label: "Focus neighbouring island", scope: "tabs" },
  { chord: "←↑↓→", label: "Resize the focused gap (⇧ for larger steps)", scope: "tabs" },

  // Diff viewer (already wired in DiffLayout)
  { chord: "j", label: "Next file", scope: "diff" },
  { chord: "k", label: "Previous file", scope: "diff" },
  { chord: "[", label: "Toggle file tree", scope: "diff" },

  // List navigation
  { chord: "j", label: "Move down", scope: "list" },
  { chord: "k", label: "Move up", scope: "list" },
  { chord: "Enter", label: "Open", scope: "list" },
  { chord: "x", label: "Select item", scope: "list" },
  { chord: "⇧ x", label: "Extend selection", scope: "list" },
  { chord: "⌘ A", label: "Select all", scope: "list" },
  { chord: "Esc", label: "Clear selection", scope: "list" },
  { chord: "s", label: "Change status of selection", scope: "list" },
  { chord: "l", label: "Label selection", scope: "list" },
  { chord: "a", label: "Assign selection", scope: "list" },
  { chord: "e", label: "Mark notification or selection done", scope: "inbox" },
  { chord: "⇧ U", label: "Toggle read / unread (unread is device only)", scope: "inbox" },
];

const SCOPE_TITLES: Record<Scope, string> = {
  global: "Global",
  tabs: "Tabs and islands",
  repo: "Repo",
  diff: "Diff viewer",
  list: "List",
  inbox: "Inbox",
};

const DEFAULT_ORDER: readonly Scope[] = ["global", "tabs", "repo", "diff", "list", "inbox"];

function promoteScope(scope: Scope): readonly Scope[] {
  if (scope === "global") return DEFAULT_ORDER;
  return [scope, ...DEFAULT_ORDER.filter((s) => s !== scope)];
}

function scopeForPath(pathname: string): Scope {
  if (pathname === "/") return "inbox";
  if (/\/[^/]+\/[^/]+\/commit\/[^/]+/.test(pathname)) return "diff";
  if (/\/[^/]+\/[^/]+\/pr\/[^/]+/.test(pathname)) return "diff";
  if (pathname === "/" || /^\/[^/]+\/[^/]+\/(pulls|issues|commits|actions)\/?$/.test(pathname))
    return "list";
  if (/^\/[^/]+\/[^/]+(\/|$)/.test(pathname) && !pathname.startsWith("/w/")) return "repo";
  return "global";
}

function renderChord(chord: string): React.ReactNode {
  const tokens = chord.split(/\s+/).filter(Boolean);
  return (
    <span className="inline-flex items-center gap-[3px]">
      {tokens.map((token) => (
        <Kbd key={token}>{token}</Kbd>
      ))}
    </span>
  );
}

export function KeyboardHelp() {
  const open = useKeyboardHelpStore((s) => s.open);
  const setOpen = useKeyboardHelpStore((s) => s.setOpen);

  useKeybindings(
    useMemo(
      () => ({
        "?": () => useKeyboardHelpStore.getState().toggle(),
      }),
      [],
    ),
  );

  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const order = useMemo(() => promoteScope(scopeForPath(pathname)), [pathname]);

  const grouped = useMemo(() => {
    const byScope: Record<Scope, Shortcut[]> = {
      global: [],
      tabs: [],
      repo: [],
      diff: [],
      list: [],
      inbox: [],
    };
    for (const s of SHORTCUTS) byScope[s.scope].push(s);
    return order
      .map((scope) => ({ scope, items: byScope[scope] }))
      .filter((g) => g.items.length > 0);
  }, [order]);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent
        showCloseButton={false}
        className="top-[22%] translate-y-0 w-[min(560px,calc(100vw-2rem))] gap-0 overflow-hidden p-0 sm:max-w-[560px]"
      >
        <DialogTitle className="sr-only">Keyboard shortcuts</DialogTitle>
        <DialogDescription className="sr-only">
          List of keyboard shortcuts available in this app.
        </DialogDescription>

        <div className="flex items-center justify-between border-b border-border bg-muted px-4 py-2.5">
          <span className="font-mono text-micro uppercase tracking-widest text-muted-foreground">
            Keyboard shortcuts
          </span>
        </div>

        <div className="max-h-[min(520px,calc(100vh-12rem))] overflow-y-auto px-4 py-4">
          {grouped.map(({ scope, items }, idx) => (
            <section key={scope} className={idx === 0 ? "" : "mt-5"}>
              <h3
                className={cn(
                  "pb-2 mb-3 border-b border-border",
                  "font-mono text-micro uppercase tracking-widest text-muted-foreground",
                )}
              >
                {SCOPE_TITLES[scope]}
              </h3>
              <ul className="grid grid-cols-[auto_1fr] items-center gap-x-5 gap-y-2">
                {items.map((s) => (
                  <li key={`${scope}-${s.chord}-${s.label}`} className="contents">
                    <div className="justify-self-start">{renderChord(s.chord)}</div>
                    <div className="text-ui text-muted-foreground">{s.label}</div>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>

        <div className="flex items-center justify-between border-t border-border bg-muted px-3 py-2">
          <span className="font-mono text-micro uppercase tracking-widest text-muted-foreground">
            ? to close
          </span>
          <span className="font-mono text-micro uppercase tracking-widest text-muted-foreground">
            ⌘K for commands
          </span>
        </div>
      </DialogContent>
    </Dialog>
  );
}
