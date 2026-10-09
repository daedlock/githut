import { useRouterState } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { SearchField } from "@/app/components/SearchField";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/app/components/ui/dialog";
import { Kbd } from "@/app/components/ui/kbd";
import { useKeybindings } from "@/app/hooks/useKeybindings";
import { platformKey } from "@/app/lib/platform";
import { useKeyboardHelpStore } from "@/app/stores/keyboardHelp";

type Scope = "global" | "repo" | "diff" | "list";

type Shortcut = {
  chord: string;
  label: string;
  scope: Scope;
};

const SHORTCUTS: readonly Shortcut[] = [
  // Global
  { chord: "⌘ K", label: "Open command palette", scope: "global" },
  { chord: "?", label: "Open keyboard help", scope: "global" },
  { chord: "g h", label: "Go home", scope: "global" },
  { chord: "g i", label: "Go to issues", scope: "global" },
  { chord: "g p", label: "Go to pull requests", scope: "global" },
  { chord: "g c", label: "Go to code", scope: "global" },
  { chord: "g a", label: "Go to actions", scope: "global" },
  { chord: "/", label: "Search this page", scope: "global" },
  { chord: "Esc", label: "Back from a detail page", scope: "global" },
  { chord: "Ctrl N", label: "Next item in a menu or picker (also Ctrl J)", scope: "global" },
  { chord: "Ctrl P", label: "Previous item in a menu or picker (also Ctrl K)", scope: "global" },

  // Diff viewer (already wired in DiffLayout)
  { chord: "j", label: "Next file", scope: "diff" },
  { chord: "k", label: "Previous file", scope: "diff" },
  { chord: "[", label: "Toggle file tree", scope: "diff" },

  // List navigation
  { chord: "j", label: "Move down (or ↓ on a row)", scope: "list" },
  { chord: "k", label: "Move up (or ↑ on a row)", scope: "list" },
  { chord: "Enter", label: "Open", scope: "list" },
  { chord: "x", label: "Select item", scope: "list" },
  { chord: "⇧ x", label: "Extend selection", scope: "list" },
  { chord: "⇧ j", label: "Grow selection down (or ⇧↓)", scope: "list" },
  { chord: "⇧ k", label: "Grow selection up (or ⇧↑)", scope: "list" },
  { chord: "⌘ A", label: "Select all", scope: "list" },
  { chord: "Esc", label: "Clear selection", scope: "list" },
  { chord: "s", label: "Change status of selection", scope: "list" },
  { chord: "l", label: "Label selection", scope: "list" },
  { chord: "a", label: "Assign selection", scope: "list" },
];

const SCOPE_TITLES: Record<Scope, string> = {
  global: "Global",
  repo: "Repo",
  diff: "Diff viewer",
  list: "List",
};

const DEFAULT_ORDER: readonly Scope[] = ["global", "repo", "diff", "list"];

function promoteScope(scope: Scope): readonly Scope[] {
  if (scope === "global") return DEFAULT_ORDER;
  return [scope, ...DEFAULT_ORDER.filter((s) => s !== scope)];
}

function scopeForPath(pathname: string): Scope {
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
    <span className="inline-flex shrink-0 items-center gap-1">
      {tokens.map((token) => (
        <Kbd key={token}>{platformKey(token)}</Kbd>
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
    const byScope: Record<Scope, Shortcut[]> = { global: [], repo: [], diff: [], list: [] };
    for (const s of SHORTCUTS) byScope[s.scope].push(s);
    return order
      .map((scope) => ({ scope, items: byScope[scope] }))
      .filter((g) => g.items.length > 0);
  }, [order]);

  const [query, setQuery] = useState("");
  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return grouped;
    return grouped
      .map(({ scope, items }) => ({
        scope,
        items: items.filter(
          (s) => s.label.toLowerCase().includes(q) || s.chord.toLowerCase().includes(q),
        ),
      }))
      .filter((g) => g.items.length > 0);
  }, [grouped, query]);

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) setQuery("");
      }}
    >
      <DialogContent
        showCloseButton={false}
        className="top-[18%] w-[min(560px,calc(100vw-2rem))] translate-y-0 gap-0 overflow-hidden p-0 sm:max-w-[560px]"
      >
        <DialogTitle className="sr-only">Keyboard shortcuts</DialogTitle>
        <DialogDescription className="sr-only">
          List of keyboard shortcuts available in this app.
        </DialogDescription>

        <div className="flex flex-col gap-2 p-3">
          <span className="px-1 text-ui font-medium text-foreground">Keyboard shortcuts</span>
          <SearchField
            autoFocus
            pageSearch={false}
            aria-label="Filter shortcuts"
            placeholder="Filter shortcuts…"
            value={query}
            onValueChange={setQuery}
          />
        </div>

        <div className="flex max-h-[min(480px,calc(100vh-14rem))] flex-col gap-4 overflow-y-auto px-3 pb-3">
          {visible.length === 0 ? (
            <p className="px-2 py-6 text-center text-ui text-muted-foreground">
              No shortcuts match “{query}”.
            </p>
          ) : (
            visible.map(({ scope, items }) => (
              <section key={scope} className="flex flex-col">
                <h3 className="flex h-7 items-center px-2 text-micro font-medium uppercase tracking-widest text-muted-foreground">
                  {SCOPE_TITLES[scope]}
                </h3>
                <ul className="flex flex-col">
                  {items.map((s) => (
                    <li
                      key={`${scope}-${s.chord}-${s.label}`}
                      className="flex h-8 items-center justify-between gap-4 rounded-md px-2 hover:bg-(--color-popover-active)"
                    >
                      <span className="truncate text-ui text-foreground">{s.label}</span>
                      {renderChord(s.chord)}
                    </li>
                  ))}
                </ul>
              </section>
            ))
          )}
        </div>

        <div className="flex h-10 items-center justify-between border-t border-border px-4 text-caption text-muted-foreground">
          <span className="flex items-center gap-1.5">
            <Kbd>Esc</Kbd> to close
          </span>
          <span className="flex items-center gap-1.5">
            <Kbd>{platformKey("⌘")}K</Kbd> for commands
          </span>
        </div>
      </DialogContent>
    </Dialog>
  );
}
