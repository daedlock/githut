type UmamiEventData = Record<string, string | number | boolean | null | undefined>;

type UmamiGlobal = {
  track?: (
    event: string | ((props: Record<string, unknown>) => Record<string, unknown>),
    data?: UmamiEventData,
  ) => unknown;
};

const UMAMI_DISABLED_KEY = "umami.disabled";

function getUmami(): UmamiGlobal | undefined {
  if (typeof window === "undefined") return undefined;
  return (window as Window & { umami?: UmamiGlobal }).umami;
}

export function isAnalyticsEnabled() {
  if (typeof window === "undefined") return true;
  return window.localStorage.getItem(UMAMI_DISABLED_KEY) !== "1";
}

export function setAnalyticsEnabledPreference(enabled: boolean) {
  if (typeof window === "undefined") return;

  if (enabled) {
    window.localStorage.removeItem(UMAMI_DISABLED_KEY);
  } else {
    window.localStorage.setItem(UMAMI_DISABLED_KEY, "1");
  }
}

// ─── Page identity ───────────────────────────────────────────────────────────
//
// Umami's automatic pageviews are off (index.html: data-auto-track="false"):
// they report the full path and document title, which name private repos and
// PR/issue titles. Pageviews and events carry a route shape instead, e.g.
// `/:owner/:repo/pull/:n/files`.

const TOP_LEVEL = new Set(["", "login", "settings", "playground"]);
const SECTIONS = new Set([
  "pull",
  "pulls",
  "pr",
  "review",
  "issues",
  "actions",
  "runs",
  "commits",
  "commit",
  "code",
  "files",
  "checks",
]);

/** The route shape of `href`, with owners, repos, numbers and paths masked. */
export function pagePath(href: string): string {
  const path = href.split(/[?#]/)[0] ?? "/";
  const parts = path.split("/").filter(Boolean);
  if (parts.length === 0) return "/";
  if (parts.length === 1) return TOP_LEVEL.has(parts[0]!) ? `/${parts[0]}` : "/:user";
  const shape = ["", ":owner", ":repo"];
  for (const part of parts.slice(2, 6)) shape.push(SECTIONS.has(part) ? part : ":id");
  return shape.join("/");
}

function currentPagePath(): string {
  try {
    return pagePath(window.location.pathname);
  } catch {
    return "/";
  }
}

let lastPageview: string | null = null;

/** Report a pageview for the focused page's route shape (repeats are skipped). */
export function trackPageview(href: string) {
  try {
    if (!isAnalyticsEnabled()) return;
    const url = pagePath(href);
    if (url === lastPageview) return;
    const umami = getUmami();
    if (!umami?.track) return;
    lastPageview = url;
    const result = umami.track((props) => ({
      website: props.website,
      hostname: props.hostname,
      screen: props.screen,
      language: props.language,
      url,
      title: "githut",
      referrer: "",
    }));
    void Promise.resolve(result).catch(() => {});
  } catch {
    // Analytics and preference storage must never interrupt a user action.
  }
}

export function track(event: string, data?: UmamiEventData) {
  try {
    if (!isAnalyticsEnabled()) return;
    const url = currentPagePath();
    const result = getUmami()?.track?.((props) => ({
      website: props.website,
      hostname: props.hostname,
      screen: props.screen,
      language: props.language,
      url,
      title: "githut",
      referrer: "",
      name: event,
      data,
    }));
    void Promise.resolve(result).catch(() => {});
  } catch {
    // Analytics and preference storage must never interrupt a user action.
  }
}

export type WorkspaceAction =
  | "split"
  | "drag-dock"
  | "move-island"
  | "pin"
  | "shortcut"
  | "sidebar-toggled";

/** Counts only. Umami's ordinary event overload includes the current page identity. */
export function trackWorkspaceAction(action: WorkspaceAction) {
  try {
    if (!isAnalyticsEnabled()) return;
    const result = getUmami()?.track?.((props) => ({
      website: props.website,
      url: "/workspace",
      title: "Workspace",
      referrer: "",
      name: "workspace_action",
      data: { action },
    }));
    // Tracking may be blocked or reject asynchronously; the action has already succeeded.
    void Promise.resolve(result).catch(() => {});
  } catch {
    // Blocked preference storage also means no tracking.
  }
}

export function bucketNumber(value: number, buckets: number[]): string {
  for (const bucket of buckets) {
    if (value <= bucket) return `<=${bucket}`;
  }
  return `>${buckets.at(-1) ?? 0}`;
}

export function fileExtension(path: string): string {
  const name = path.split("/").pop() ?? path;
  const dot = name.lastIndexOf(".");
  if (dot <= 0 || dot === name.length - 1) return "none";
  return name
    .slice(dot + 1)
    .toLowerCase()
    .slice(0, 16);
}
