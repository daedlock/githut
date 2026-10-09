import { useEffect } from "react";
import type { ShortcutMap } from "@/app/lib/shortcuts";

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
};

const IS_MAC =
  typeof navigator !== "undefined" && /Mac|iPhone|iPad|iPod/i.test(navigator.platform);

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
  // Shift on printable symbols (like "?") is implicit; only enforce when the
  // caller explicitly asked for shift+<key>. A bare letter binding ("j") must
  // not swallow its shifted chord ("shift+j"), which can mean something else.
  if (wantShift && !e.shiftKey) return false;
  if (!wantShift && e.shiftKey && /^[a-z]$/i.test(e.key)) return false;
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

  const key = normalizeKey(e.key);
  // Ignore pure modifier keydowns.
  if (key === "shift" || key === "control" || key === "alt" || key === "meta") return;

  const prefix = pendingPrefix;
  const handler = findHandler(key, prefix, e);
  if (handler) {
    clearPending();
    e.preventDefault();
    handler();
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

function warnCollisionsOnce(parsed: Parsed[]) {
  if (!import.meta.env.DEV) return;
  for (const p of parsed) {
    for (const reg of registrations) {
      if (reg.map[p.chord] && !warnedCollisions.has(p.chord)) {
        warnedCollisions.add(p.chord);
        // biome-ignore lint/suspicious/noConsole: intentional dev-only warning
        console.warn(`[useKeybindings] chord "${p.chord}" is already registered; last-in wins.`);
      }
    }
  }
}

export function useKeybindings(map: ShortcutMap): void {
  useEffect(() => {
    const parsed = Object.keys(map).map(parseChord);
    warnCollisionsOnce(parsed);
    const reg: Registration = { id: nextId++, parsed, map };
    registrations.push(reg);
    attachListener();
    return () => {
      const idx = registrations.findIndex((r) => r.id === reg.id);
      if (idx >= 0) registrations.splice(idx, 1);
      detachListener();
    };
    // map is intentionally a dep so consumers can pass inline maps; if this
    // churns we'll revisit with a ref, but keeping the contract simple first.
  }, [map]);
}
