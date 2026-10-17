import { useEffect } from "react";
import { trackWorkspaceAction } from "@/app/lib/analytics";
import type { ShortcutMap } from "@/app/lib/shortcuts";
import { useTabScope } from "@/app/lib/tabScope";
import { getWorkspace } from "@/app/workspace/store";

type Mod = "meta" | "shift" | "alt";
type Parsed = {
  chord: string;
  sequence: string[];
  mods: Set<Mod>;
};

type Registration = {
  id: number;
  parsed: Parsed[];
  map: ShortcutMap;
  /** Registered from inside a tab: only live while that tab is focused. */
  inScope: () => boolean;
};

const IS_MAC = typeof navigator !== "undefined" && /Mac|iPhone|iPad|iPod/i.test(navigator.platform);

// Keys we must never intercept — the browser owns these. Mirrored against
// common shortcuts; dispatching would break reload/close/new-tab/etc.
function isBrowserOwned(e: KeyboardEvent): boolean {
  const primary = IS_MAC ? e.metaKey : e.ctrlKey;
  const k = e.key.toLowerCase();
  if (e.key === "F5" || e.key === "F11" || e.key === "F12") return true;
  if (primary) {
    if (k === "r" || k === "w" || k === "t" || k === "n" || k === "q") return true;
    if (k === "l" || k === "d" || k === "f") return true;
    if (k === "tab" || k === "+" || k === "-" || k === "=" || k === "0") return true;
    if (k === "arrowleft" || k === "arrowright") return true; // back/forward on mac
  }
  return false;
}

function isEditableTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  const tag = target.tagName;
  if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return true;
  if (target.isContentEditable) return true;
  return false;
}

function normalizeKey(raw: string): string {
  const k = raw.trim().toLowerCase();
  if (k === "esc") return "escape";
  if (k === "return") return "enter";
  if (k === "space" || k === " ") return "space";
  return k;
}

const CODE_KEYS: Record<string, string> = {
  BracketLeft: "[",
  BracketRight: "]",
  Backslash: "\\",
};

// Option on macOS rewrites e.key ("alt+w" arrives as "∑"), so alt chords
// match on the physical key instead.
function eventKey(e: KeyboardEvent): string {
  if (e.altKey) {
    const m = /^(?:Key|Digit)(.)$/.exec(e.code);
    if (m) return m[1]!.toLowerCase();
    if (CODE_KEYS[e.code]) return CODE_KEYS[e.code]!;
  }
  return normalizeKey(e.key);
}

// Parse "⌘k", "shift+enter", "g h", "?" into a canonical shape.
function parseChord(chord: string): Parsed {
  const mods = new Set<Mod>();
  let rest = chord;
  // Meta/Ctrl: ⌘ is the canonical prefix; we also accept "cmd" and "ctrl" tokens.
  if (rest.startsWith("⌘")) {
    mods.add("meta");
    rest = rest.slice(1);
  }
  // Two-key sequence: separated by a single space ("g h").
  if (/^[a-z0-9?] [a-z0-9?]$/i.test(rest)) {
    return { chord, sequence: [normalizeKey(rest[0]!), normalizeKey(rest[2]!)], mods };
  }
  const parts = rest.split("+").map((p) => p.trim());
  const last = parts.pop()!;
  for (const p of parts) {
    const pl = p.toLowerCase();
    if (pl === "cmd" || pl === "meta" || pl === "ctrl" || pl === "⌘") mods.add("meta");
    else if (pl === "shift") mods.add("shift");
    else if (pl === "alt" || pl === "option") mods.add("alt");
  }
  return { chord, sequence: [normalizeKey(last)], mods };
}

let nextId = 1;
const registrations: Registration[] = [];
let pendingPrefix: string | null = null;
let pendingTimer: ReturnType<typeof setTimeout> | null = null;
let listenerAttached = false;
const warnedCollisions = new Set<string>();

function clearPending() {
  pendingPrefix = null;
  if (pendingTimer) {
    clearTimeout(pendingTimer);
    pendingTimer = null;
  }
}

function eventMatchesMods(e: KeyboardEvent, mods: Set<Mod>): boolean {
  const wantMeta = mods.has("meta");
  const wantShift = mods.has("shift");
  const wantAlt = mods.has("alt");
  // ⌘ means Meta on macOS, Ctrl elsewhere.
  const haveMeta = IS_MAC ? e.metaKey : e.ctrlKey;
  // Reject cross-platform stray modifier (ctrl on mac or meta on others) to
  // avoid dispatching on combos we didn't mean to own.
  const strayMeta = IS_MAC ? e.ctrlKey : e.metaKey;
  if (strayMeta) return false;
  if (wantMeta !== haveMeta) return false;
  if (wantAlt !== e.altKey) return false;
  // Shift on printable keys (like "?") is implicit; only enforce when caller
  // explicitly asked for shift+<letter>.
  if (wantShift && !e.shiftKey) return false;
  return true;
}

function findHandler(
  tailKey: string,
  prefix: string | null,
  e: KeyboardEvent,
): (() => void) | null {
  // Later registrations shadow earlier ones, so iterate LIFO.
  for (let i = registrations.length - 1; i >= 0; i--) {
    const reg = registrations[i]!;
    if (!reg.inScope()) continue;
    for (const p of reg.parsed) {
      if (p.sequence.length === 2) {
        if (!prefix) continue;
        if (p.sequence[0] !== prefix || p.sequence[1] !== tailKey) continue;
        if (p.mods.size > 0) continue; // sequences don't carry modifiers
        return reg.map[p.chord]!;
      }
      if (p.sequence[0] !== tailKey) continue;
      if (!eventMatchesMods(e, p.mods)) continue;
      return reg.map[p.chord]!;
    }
  }
  return null;
}

function isSequencePrefix(key: string): boolean {
  for (const reg of registrations) {
    if (!reg.inScope()) continue;
    for (const p of reg.parsed) {
      if (p.sequence.length === 2 && p.mods.size === 0 && p.sequence[0] === key) return true;
    }
  }
  return false;
}

function onKeyDown(e: KeyboardEvent) {
  if (e.defaultPrevented) return;
  const editable = isEditableTarget(e.target);
  // Let Escape through editables so users can bail out of inputs.
  if (editable && e.key !== "Escape") return;
  if (isBrowserOwned(e)) return;

  const key = eventKey(e);
  // Ignore pure modifier keydowns.
  if (key === "shift" || key === "control" || key === "alt" || key === "meta") return;

  const prefix = pendingPrefix;
  const handler = findHandler(key, prefix, e);
  if (handler) {
    clearPending();
    e.preventDefault();
    const layout = getWorkspace().layout;
    handler();
    // Count layout shortcuts only: list moves and palette keys would send a
    // beacon per keypress.
    if (getWorkspace().layout !== layout) trackWorkspaceAction("shortcut");
    return;
  }

  // No direct match — if no modifiers pressed and key starts a sequence, arm prefix.
  const bareKey = !e.metaKey && !e.ctrlKey && !e.altKey && !e.shiftKey;
  if (bareKey && !prefix && isSequencePrefix(key)) {
    pendingPrefix = key;
    pendingTimer = setTimeout(clearPending, 500);
    return;
  }
  // Non-matching key while a prefix is armed resets it.
  if (prefix) clearPending();
}

function attachListener() {
  if (listenerAttached) return;
  window.addEventListener("keydown", onKeyDown);
  listenerAttached = true;
}

function detachListener() {
  if (!listenerAttached) return;
  if (registrations.length > 0) return;
  window.removeEventListener("keydown", onKeyDown);
  listenerAttached = false;
  clearPending();
}

function warnCollisionsOnce(parsed: Parsed[], inScope: () => boolean) {
  if (!import.meta.env.DEV) return;
  for (const p of parsed) {
    for (const reg of registrations) {
      // Two tabs registering the same page shortcut don't collide: only the
      // focused one is live.
      if (reg.inScope !== inScope) continue;
      if (reg.map[p.chord] && !warnedCollisions.has(p.chord)) {
        warnedCollisions.add(p.chord);
        // biome-ignore lint/suspicious/noConsole: intentional dev-only warning
        console.warn(`[useKeybindings] chord "${p.chord}" is already registered; last-in wins.`);
      }
    }
  }
}

/**
 * Register shortcuts while the calling component is mounted. Called inside a
 * tab, they only fire while that tab is focused (see lib/tabScope).
 */
export function useKeybindings(map: ShortcutMap): void {
  const { isFocused } = useTabScope();
  useEffect(() => {
    const parsed = Object.keys(map).map(parseChord);
    warnCollisionsOnce(parsed, isFocused);
    const reg: Registration = { id: nextId++, parsed, map, inScope: isFocused };
    registrations.push(reg);
    attachListener();
    return () => {
      const idx = registrations.findIndex((r) => r.id === reg.id);
      if (idx >= 0) registrations.splice(idx, 1);
      detachListener();
    };
    // map is intentionally a dep so consumers can pass inline maps; if this
    // churns we'll revisit with a ref, but keeping the contract simple first.
  }, [map, isFocused]);
}
