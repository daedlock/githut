import { create } from "zustand";

export type WorkspaceEntry = {
  key: string; // `${owner}/${repo}`
  owner: string;
  repo: string;
  href: string; // full path: pathname + search + hash
  scrollY: number;
  addedAt: number;
};

type WorkspacesState = {
  entries: WorkspaceEntry[];
  push: (owner: string, repo: string, href: string) => void;
  remove: (key: string) => void;
  saveScroll: (key: string, scrollY: number) => void;
};

const MAX = 8;
const STORAGE_KEY = "githut.workspaces.v2";
const LEGACY_STORAGE_KEY = "githut.workspaces.v1";

export const useWorkspacesStore = create<WorkspacesState>()((set, get) => ({
  entries: readStoredEntries(),

  push: (owner, repo, href) => {
    const key = `${owner}/${repo}`;
    const safeHref = sanitizeHref(owner, repo, href);
    const exists = get().entries.some((e) => e.key === key);

    set((s) => {
      const entries = exists
        ? s.entries.map((e) => (e.key === key ? { ...e, href: safeHref } : e))
        : [
            ...s.entries.slice(-(MAX - 1)),
            { key, owner, repo, href: safeHref, scrollY: 0, addedAt: Date.now() },
          ];

      persistEntries(entries);
      return { entries };
    });
  },

  remove: (key) =>
    set((s) => {
      const entries = s.entries.filter((e) => e.key !== key);
      persistEntries(entries);
      return { entries };
    }),

  saveScroll: (key, scrollY) =>
    set((s) => {
      const entries = s.entries.map((e) => (e.key === key ? { ...e, scrollY } : e));
      persistEntries(entries);
      return { entries };
    }),
}));

function sanitizeHref(owner: string, repo: string, href: string): string {
  const fallback = `/${owner}/${repo}/code`;
  if (!href) return fallback;

  if (href.startsWith("/")) {
    return href.includes("undefined") ? fallback : href;
  }

  try {
    const parsed = new URL(href, "http://localhost");
    const normalized = `${parsed.pathname}${parsed.search}${parsed.hash}` || fallback;
    return normalized.includes("undefined") ? fallback : normalized;
  } catch {
    return fallback;
  }
}

function normalizeEntry(raw: unknown): WorkspaceEntry | null {
  if (!raw || typeof raw !== "object") return null;

  const obj = raw as Partial<WorkspaceEntry>;
  const owner = typeof obj.owner === "string" ? obj.owner : "";
  const repo = typeof obj.repo === "string" ? obj.repo : "";
  const keyFromFields = owner && repo ? `${owner}/${repo}` : "";
  const key = typeof obj.key === "string" && obj.key ? obj.key : keyFromFields;
  if (!key) return null;

  const [derivedOwner = "", derivedRepo = ""] = key.split("/", 2);
  const finalOwner = owner || derivedOwner;
  const finalRepo = repo || derivedRepo;
  if (!finalOwner || !finalRepo) return null;

  const href = sanitizeHref(finalOwner, finalRepo, typeof obj.href === "string" ? obj.href : "");
  const scrollY = typeof obj.scrollY === "number" && Number.isFinite(obj.scrollY) ? obj.scrollY : 0;
  const addedAt =
    typeof obj.addedAt === "number" && Number.isFinite(obj.addedAt) ? obj.addedAt : Date.now();

  return {
    key: `${finalOwner}/${finalRepo}`,
    owner: finalOwner,
    repo: finalRepo,
    href,
    scrollY,
    addedAt,
  };
}

function normalizeEntries(rawEntries: unknown): WorkspaceEntry[] {
  if (!Array.isArray(rawEntries)) return [];

  const byKey = new Map<string, WorkspaceEntry>();
  for (const raw of rawEntries) {
    const normalized = normalizeEntry(raw);
    if (!normalized) continue;
    // Preserve latest-seen order when duplicates exist in legacy data.
    if (byKey.has(normalized.key)) byKey.delete(normalized.key);
    byKey.set(normalized.key, normalized);
  }

  return Array.from(byKey.values()).slice(-MAX);
}

function extractEntriesFromStoredValue(value: unknown): unknown {
  if (Array.isArray(value)) return value;
  if (!value || typeof value !== "object") return [];

  const obj = value as {
    entries?: unknown;
    state?: { entries?: unknown };
  };

  if (Array.isArray(obj.entries)) return obj.entries;
  if (Array.isArray(obj.state?.entries)) return obj.state.entries;
  return [];
}

function readStoredEntries(): WorkspaceEntry[] {
  if (typeof window === "undefined") return [];

  const keys = [STORAGE_KEY, LEGACY_STORAGE_KEY];
  for (const key of keys) {
    try {
      const raw = window.localStorage.getItem(key);
      if (!raw) continue;
      const parsed = JSON.parse(raw);
      const entries = normalizeEntries(extractEntriesFromStoredValue(parsed));
      if (entries.length === 0) continue;

      if (key === LEGACY_STORAGE_KEY) {
        persistEntries(entries);
      }

      return entries;
    } catch {
      // ignore malformed storage and continue fallback chain
    }
  }

  return [];
}

function persistEntries(entries: WorkspaceEntry[]) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify({ version: 1, entries }));
  } catch {
    // ignore quota or storage errors
  }
}
