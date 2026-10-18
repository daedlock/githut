import {
  createWorkspace,
  hrefPathname,
  type Island,
  type LayoutNode,
  newTab,
  normalizeHref,
  normalizeWorkspace,
  type Tab,
  type Workspace,
} from "@/app/workspace/model";

// ─── Workspace persistence ───────────────────────────────────────────────────
//
// The layout is saved per device under a schema version:
//
//   sessionStorage  githut.workspace.window  this window's layout; survives
//                                            reloads, never seen by others
//   localStorage    githut.workspace         the last-used window's layout,
//                                            which a new window starts from
//
// so two windows never fight over one layout. Each verified account has its
// own pair (`<key>.account.<id>`); the unscoped pair holds the layout of a
// token whose account isn't verified yet (and layouts saved before accounts
// were partitioned), adopted once the account is known. On first load the old
// tab strip's tabs (`githut.tabs.v1`, or the `githut.tabs.v3` groundwork
// format) migrate into a single island in the same order, keeping the selected
// tab and pins; the old keys are then deleted. `closed` is session state and
// isn't saved.

export const WORKSPACE_SCHEMA_VERSION = 1;
const WINDOW_KEY = "githut.workspace.window";
const LAST_USED_KEY = "githut.workspace";
/** Retired storage, newest first: the tab strip keys migrate, the rest are dropped. */
const LEGACY_TABS_KEYS = ["githut.tabs.v3", "githut.tabs.v1"];
const RETIRED_KEYS = ["githut.workspaces.v1", "githut.workspaces.v2"];
/** Smallest relative size a saved split child keeps, so none loads as a 0px island. */
const MIN_SAVED_SIZE = 0.05;

type Saved = {
  version: number;
  workspace: Pick<Workspace, "layout" | "focusedIslandId" | "maximizedIslandId" | "focusHistory">;
};

/** Upgrades from older schema versions; index n turns version n into n + 1. */
const MIGRATIONS: ((data: unknown) => unknown)[] = [];

/** `account.<id>` for a verified account; omitted for the unverified (unscoped) layout. */
export type LayoutScope = string | undefined;

function scoped(key: string, scope: LayoutScope): string {
  return scope ? `${key}.${scope}` : key;
}

/** A saved layout for `scope`, if there is one. */
export function readSavedWorkspace(scope: LayoutScope): Workspace | null {
  return (
    read(safeStorage("session")?.getItem(scoped(WINDOW_KEY, scope))) ??
    read(safeStorage("local")?.getItem(scoped(LAST_USED_KEY, scope)))
  );
}

/** Forget the unscoped layout (after it was adopted, or on sign-out). */
export function forgetUnscopedWorkspace() {
  try {
    safeStorage("session")?.removeItem(WINDOW_KEY);
    safeStorage("local")?.removeItem(LAST_USED_KEY);
  } catch {
    /* Storage may be disabled. */
  }
}

/** This window's layout, else the last-used one, else migrated tabs, else one island at `href`. */
export function loadWorkspace(href: string, scope?: LayoutScope): Workspace {
  const local = safeStorage("local");
  const workspace =
    readSavedWorkspace(scope) ??
    LEGACY_TABS_KEYS.reduce<Workspace | null>(
      (found, key) => found ?? migrateLegacyTabs(local?.getItem(key)),
      null,
    ) ??
    createWorkspace([isTransientHref(href) ? "/" : href]);
  // Islands own persistence now; the caller saves the result right away.
  try {
    for (const key of [...LEGACY_TABS_KEYS, ...RETIRED_KEYS]) local?.removeItem(key);
  } catch {
    /* Storage may be disabled. */
  }
  return workspace;
}

export function saveWorkspace(
  ws: Workspace,
  { lastUsed = true, scope }: { lastUsed?: boolean; scope?: LayoutScope } = {},
) {
  const saved: Saved = {
    version: WORKSPACE_SCHEMA_VERSION,
    workspace: {
      layout: ws.layout,
      focusedIslandId: ws.focusedIslandId,
      focusHistory: ws.focusHistory,
      maximizedIslandId: ws.maximizedIslandId,
    },
  };
  const json = JSON.stringify(saved);
  try {
    safeStorage("session")?.setItem(scoped(WINDOW_KEY, scope), json);
    if (lastUsed) safeStorage("local")?.setItem(scoped(LAST_USED_KEY, scope), json);
  } catch {
    // Storage full or blocked: the layout just won't survive a reload.
  }
}

function read(raw: string | null | undefined): Workspace | null {
  if (!raw) return null;
  try {
    let data = JSON.parse(raw) as { version?: unknown; workspace?: unknown };
    let version = typeof data.version === "number" ? data.version : 0;
    if (version > WORKSPACE_SCHEMA_VERSION) return null;
    while (version < WORKSPACE_SCHEMA_VERSION) {
      const migrate = MIGRATIONS[version];
      if (!migrate) return null;
      data = migrate(data) as typeof data;
      version += 1;
    }
    const w = data.workspace as Partial<Saved["workspace"]> | undefined;
    const layout = parseNode(w?.layout);
    if (!layout || !hasUniqueIds(layout)) return null;
    return normalizeWorkspace({
      layout,
      focusedIslandId: typeof w?.focusedIslandId === "string" ? w.focusedIslandId : "",
      maximizedIslandId: typeof w?.maximizedIslandId === "string" ? w.maximizedIslandId : null,
      focusHistory: Array.isArray(w?.focusHistory)
        ? w.focusHistory.filter((id) => typeof id === "string")
        : [],
      closed: [],
    });
  } catch {
    return null;
  }
}

/** Validate a stored node; anything malformed discards the saved layout. */
function parseNode(value: unknown): LayoutNode | null {
  if (!value || typeof value !== "object") return null;
  const n = value as Record<string, unknown>;
  if (typeof n.id !== "string" || !n.id) return null;
  if (n.kind === "island") {
    if (!Array.isArray(n.tabs)) return null;
    const tabs = n.tabs
      .filter(isTab)
      .filter((t) => !isTransientHref(t.href))
      .map((t) => ({ id: t.id, href: normalizeHref(t.href) }));
    const island: Island = {
      kind: "island",
      id: n.id,
      tabs,
      selectedTabId: typeof n.selectedTabId === "string" ? n.selectedTabId : "",
      pinned: Array.isArray(n.pinned) ? n.pinned.filter((p) => typeof p === "string") : [],
    };
    return island;
  }
  if (n.kind === "split") {
    if (n.direction !== "row" && n.direction !== "column") return null;
    if (!Array.isArray(n.children) || !Array.isArray(n.sizes)) return null;
    if (!n.children.length || n.children.length !== n.sizes.length) return null;
    const children = n.children.map(parseNode);
    if (children.some((c) => !c)) return null;
    return {
      kind: "split",
      id: n.id,
      direction: n.direction,
      children: children as LayoutNode[],
      sizes: savedSizes(n.sizes),
    };
  }
  return null;
}

/** Settings is a modal and the login page a signed-out screen: neither is ever restored as a tab. */
function isTransientHref(href: string): boolean {
  const path = hrefPathname(href);
  return path === "/settings" || path === "/login";
}

/** Relative sizes summing to 1, each at least `MIN_SAVED_SIZE`; junk becomes an even share. */
function savedSizes(raw: unknown[]): number[] {
  const even = 1 / raw.length;
  const valid = raw.map((s) => (typeof s === "number" && Number.isFinite(s) && s > 0 ? s : even));
  const total = valid.reduce((a, b) => a + b, 0);
  const floored = valid.map((s) => Math.max(s / total, MIN_SAVED_SIZE));
  const sum = floored.reduce((a, b) => a + b, 0);
  return floored.map((s) => s / sum);
}

/** Node ids and tab ids must each be unique, or commands would edit several places at once. */
function hasUniqueIds(layout: LayoutNode): boolean {
  const nodes = new Set<string>();
  const tabs = new Set<string>();
  const walk = (node: LayoutNode): boolean => {
    if (nodes.has(node.id)) return false;
    nodes.add(node.id);
    if (node.kind === "split") return node.children.every(walk);
    for (const tab of node.tabs) {
      if (tabs.has(tab.id)) return false;
      tabs.add(tab.id);
    }
    return true;
  };
  return walk(layout);
}

function isTab(value: unknown): value is Tab {
  const t = value as Partial<Tab> | null;
  return !!t && typeof t.id === "string" && typeof t.href === "string";
}

/**
 * The old tab strip's zustand persist state → one island. `main` saved
 * `{ tabs: [{ id, href, pinned, … }], activeTabId }` under `githut.tabs.v1`;
 * the groundwork branch saved `{ tabs, activeId }` under `githut.tabs.v3`.
 * Tabs get fresh ids, because v1 used the pathname as the id.
 */
function migrateLegacyTabs(raw: string | null | undefined): Workspace | null {
  if (!raw) return null;
  try {
    const state = (
      JSON.parse(raw) as { state?: { tabs?: unknown; activeTabId?: unknown; activeId?: unknown } }
    ).state;
    const old = Array.isArray(state?.tabs)
      ? state.tabs
          .filter(isTab)
          .filter((t) => !isTransientHref(t.href))
          .filter((t, i, all) => all.findIndex((o) => o.id === t.id) === i)
      : [];
    if (!old.length) return null;
    const activeId = state?.activeTabId ?? state?.activeId;
    const tabs = old.map((t) => newTab(t.href));
    const selected = Math.max(
      0,
      old.findIndex((t) => t.id === activeId),
    );
    const pinned = old.flatMap((t, i) =>
      (t as { pinned?: unknown }).pinned === true ? [tabs[i]!.id] : [],
    );
    const ws = createWorkspace([]);
    const island = ws.layout as Island;
    return normalizeWorkspace({
      ...ws,
      layout: { ...island, tabs, pinned, selectedTabId: tabs[selected]!.id },
    });
  } catch {
    return null;
  }
}

function safeStorage(kind: "local" | "session"): Storage | null {
  try {
    return kind === "local" ? window.localStorage : window.sessionStorage;
  } catch {
    return null;
  }
}
