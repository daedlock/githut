import * as Dialog from "@radix-ui/react-dialog";
import { useRouterState } from "@tanstack/react-router";
import { useMemo } from "react";
import { useKeybindings } from "@/app/hooks/useKeybindings";
import { cn } from "@/app/lib/cn";
import { useKeyboardHelpStore } from "@/app/stores/keyboardHelp";
import { Kbd } from "@/app/components/ui/Kbd";

/**
 * Keyboard help overlay — `?` opens a dialog listing every registered
 * shortcut, grouped by scope. Motion + shell reuses P1.G2's palette
 * keyframes so the two dialogs feel like one primitive.
 *
 * The shortcut list is a module-level editorial constant below — labels
 * are descriptive prose, not runtime reflection of `GLOBAL_SHORTCUTS`.
 * Follow-up: reconcile with `lib/shortcuts.ts` once per-surface maps land.
 */

type Scope = "global" | "repo" | "diff" | "list";

type Shortcut = {
  /** Space-separated key tokens. `⌘ K` → ⌘ then K. `g h` → g then h. */
  chord: string;
  label: string;
  scope: Scope;
};

const SHORTCUTS: readonly Shortcut[] = [
  // Global
  { chord: "⌘ K", label: "Open command palette", scope: "global" },
  { chord: "?", label: "Open keyboard help", scope: "global" },
  { chord: "g h", label: "Go to inbox", scope: "global" },
  { chord: "g i", label: "Go to issues", scope: "global" },
  { chord: "g p", label: "Go to pull requests", scope: "global" },
  { chord: "g c", label: "Go to code", scope: "global" },

  // Diff viewer (already wired in DiffLayout)
  { chord: "j", label: "Next file", scope: "diff" },
  { chord: "k", label: "Previous file", scope: "diff" },
  { chord: "[", label: "Toggle file tree", scope: "diff" },

  // List (inbox / issues / pulls — placeholders until P2)
  { chord: "j", label: "Move down", scope: "list" },
  { chord: "k", label: "Move up", scope: "list" },
  { chord: "Enter", label: "Open", scope: "list" },
  { chord: "p", label: "Peek", scope: "list" },
  { chord: "e", label: "Archive", scope: "list" },
  { chord: "s", label: "Snooze", scope: "list" },
];

const SCOPE_TITLES: Record<Scope, string> = {
  global: "Global",
  repo: "Repo",
  diff: "Diff viewer",
  list: "List",
};

// Default vertical order; overridden when a surface is promoted via route.
const DEFAULT_ORDER: readonly Scope[] = ["global", "repo", "diff", "list"];

function promoteScope(scope: Scope): readonly Scope[] {
  if (scope === "global") return DEFAULT_ORDER;
  return [scope, ...DEFAULT_ORDER.filter((s) => s !== scope)];
}

// Map the current pathname → the scope that should sit at the top.
// Commit + PR detail are the only "diff" surfaces we own today.
function scopeForPath(pathname: string): Scope {
  if (/\/[^/]+\/[^/]+\/commit\/[^/]+/.test(pathname)) return "diff";
  if (/\/[^/]+\/[^/]+\/pulls\/[^/]+/.test(pathname)) return "diff";
  if (/^\/[^/]+\/[^/]+(\/|$)/.test(pathname) && !pathname.startsWith("/w/")) return "repo";
  return "global";
}

// Render a chord string as a sequence of <Kbd> elements. Tokens are split on
// whitespace; `⌘`, `⇧`, `⌥` and single-letter keys each become one Kbd.
function renderChord(chord: string): React.ReactNode {
  const tokens = chord.split(/\s+/).filter(Boolean);
  return (
    <span className="inline-flex items-center gap-[3px]">
      {tokens.map((t, i) => (
        <Kbd key={`${t}-${i}`}>{t}</Kbd>
      ))}
    </span>
  );
}

export function KeyboardHelp() {
  const open = useKeyboardHelpStore((s) => s.open);
  const setOpen = useKeyboardHelpStore((s) => s.setOpen);

  // `?` is registered scoped to this component's lifecycle so the binding
  // disappears if we ever tear the overlay out of the tree.
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

  // Group once per open state. Empty groups (e.g. Repo today) collapse away.
  const grouped = useMemo(() => {
    const byScope: Record<Scope, Shortcut[]> = { global: [], repo: [], diff: [], list: [] };
    for (const s of SHORTCUTS) byScope[s.scope].push(s);
    return order
      .map((scope) => ({ scope, items: byScope[scope] }))
      .filter((g) => g.items.length > 0);
  }, [order]);

  return (
    <Dialog.Root open={open} onOpenChange={setOpen}>
      <Dialog.Portal>
        <Dialog.Overlay
          className={cn(
            "fixed inset-0 z-50",
            "bg-[color-mix(in_oklab,var(--color-fg)_32%,transparent)]",
            "backdrop-blur-[2px]",
            "[animation:palette-backdrop-in_120ms_cubic-bezier(0.16,1,0.3,1)]",
          )}
        />
        <Dialog.Content
          aria-describedby={undefined}
          className={cn(
            "fixed left-1/2 top-[22%] z-50",
            "w-[min(560px,calc(100vw-2rem))]",
            "-translate-x-1/2 -translate-y-1/2",
            "overflow-hidden rounded-[var(--radius-lg)]",
            "border border-[var(--color-border-strong)] bg-[var(--color-bg)]",
            "shadow-[0_1px_0_rgba(0,0,0,0.04),0_12px_32px_-12px_rgba(0,0,0,0.22)]",
            "[animation:palette-enter_120ms_cubic-bezier(0.16,1,0.3,1)]",
            "focus:outline-none",
          )}
        >
          <Dialog.Title className="sr-only">Keyboard shortcuts</Dialog.Title>

          {/*
           * Header strip — matches the palette's footer typography so the two
           * dialogs share a family resemblance. This is the help's eyebrow.
           */}
          <div
            className={cn(
              "flex items-center justify-between border-b border-[var(--color-border)]",
              "bg-[var(--color-bg-subtle)] px-4 py-2.5",
            )}
          >
            <span className="font-mono text-micro uppercase tracking-widest text-[var(--color-fg-faint)]">
              Keyboard shortcuts
            </span>
          </div>

          {/*
           * Scrollable body. Max-height mirrors the palette so the two dialogs
           * align visually when stacked in memory.
           */}
          <div className="max-h-[min(520px,calc(100vh-12rem))] overflow-y-auto px-4 py-4">
            {grouped.map(({ scope, items }, idx) => (
              <section key={scope} className={idx === 0 ? "" : "mt-5"}>
                <h3
                  className={cn(
                    "pb-2 mb-3 border-b border-[var(--color-border)]",
                    "font-mono text-micro uppercase tracking-widest text-[var(--color-fg-faint)]",
                  )}
                >
                  {SCOPE_TITLES[scope]}
                </h3>
                <ul className="grid grid-cols-[auto_1fr] items-center gap-x-5 gap-y-2">
                  {items.map((s) => (
                    <li key={`${scope}-${s.chord}-${s.label}`} className="contents">
                      <div className="justify-self-start">{renderChord(s.chord)}</div>
                      <div className="text-ui text-[var(--color-fg-muted)]">{s.label}</div>
                    </li>
                  ))}
                </ul>
              </section>
            ))}
          </div>

          <div
            className={cn(
              "flex items-center justify-between border-t border-[var(--color-border)]",
              "bg-[var(--color-bg-subtle)] px-3 py-2",
            )}
          >
            <span className="font-mono text-micro uppercase tracking-widest text-[var(--color-fg-faint)]">
              ? to close
            </span>
            <span className="font-mono text-micro uppercase tracking-widest text-[var(--color-fg-faint)]">
              ⌘K for commands
            </span>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
