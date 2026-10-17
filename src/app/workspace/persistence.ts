import {
  createWorkspace,
  type Island,
  type LayoutNode,
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
// so two windows never fight over one layout. On first load the tab strip's
// tabs (`githut.tabs.v3`) migrate into a single island in the same order.
// `closed` is session state and isn't saved.

export const WORKSPACE_SCHEMA_VERSION = 1;
const WINDOW_KEY = "githut.workspace.window";
const LAST_USED_KEY = "githut.workspace";
const LEGACY_TABS_KEY = "githut.tabs.v3";

type Saved = {
  version: number;
  workspace: Pick<Workspace, "layout" | "focusedIslandId" | "maximizedIslandId" | "focusHistory">;
};

/** Upgrades from older schema versions; index n turns version n into n + 1. */
const MIGRATIONS: ((data: unknown) => unknown)[] = [];

/** This window's layout, else the last-used one, else migrated tabs, else one island at `href`. */
export function loadWorkspace(href: string): Workspace {
  return (
    read(safeStorage("session")?.getItem(WINDOW_KEY)) ??
    read(safeStorage("local")?.getItem(LAST_USED_KEY)) ??
    migrateLegacyTabs(safeStorage("local")?.getItem(LEGACY_TABS_KEY)) ??
    createWorkspace([href])
  );
}

export function saveWorkspace(ws: Workspace, { lastUsed = true } = {}) {
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
    safeStorage("session")?.setItem(WINDOW_KEY, json);
    if (lastUsed) safeStorage("local")?.setItem(LAST_USED_KEY, json);
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
    if (!layout) return null;
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
  if (typeof n.id !== "string") return null;
  if (n.kind === "island") {
    if (!Array.isArray(n.tabs)) return null;
    const tabs = n.tabs.filter(isTab).map((t) => ({ id: t.id, href: normalizeHref(t.href) }));
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
    const children = n.children.map(parseNode);
    if (children.some((c) => !c)) return null;
    const sizes = n.sizes.map((s) => (typeof s === "number" && s > 0 ? s : 0));
    return {
      kind: "split",
      id: n.id,
      direction: n.direction,
      children: children as LayoutNode[],
      sizes,
    };
  }
  return null;
}

function isTab(value: unknown): value is Tab {
  const t = value as Partial<Tab> | null;
  return !!t && typeof t.id === "string" && typeof t.href === "string";
}

/** The tab strip's `{ tabs, activeId }` (zustand persist format) → one island. */
function migrateLegacyTabs(raw: string | null | undefined): Workspace | null {
  if (!raw) return null;
  try {
    const state = (JSON.parse(raw) as { state?: { tabs?: unknown; activeId?: unknown } }).state;
    const tabs = Array.isArray(state?.tabs) ? state.tabs.filter(isTab) : [];
    if (!tabs.length) return null;
    const ws = createWorkspace(tabs.map((t) => t.href));
    const island = ws.layout as Island;
    const migrated = tabs.map((t) => ({ id: t.id, href: normalizeHref(t.href) }));
    const selected = migrated.find((t) => t.id === state?.activeId) ?? migrated[0]!;
    return {
      ...ws,
      layout: { ...island, tabs: migrated, selectedTabId: selected.id },
    };
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
