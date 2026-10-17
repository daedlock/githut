import { useEffect } from "react";
import { pushRecentItem, type RecentKind } from "@/app/lib/recentItems";
import { getTabMeta } from "@/app/lib/tabMeta";
import { useTabTitlesStore } from "@/app/stores/tabTitles";
import { hrefPathname } from "@/app/workspace/model";
import { useFocusedTab } from "@/app/workspace/store";

/** Visits include in-page links and tab switches, not only palette results. */
export function RecentVisits() {
  const { href } = useFocusedTab();
  const pathname = hrefPathname(href);
  const meta = getTabMeta(pathname);
  const entity = /^\/([^/]+)\/([^/]+)\/(pull|pr|review|issues)\/(\d+)/.exec(pathname);
  const key = entity
    ? `${entity[1]}/${entity[2]}/${entity[3] === "issues" ? "issue" : "pull"}/${entity[4]}`
    : "";
  const title = useTabTitlesStore((state) =>
    key ? state.entries[key]?.split("\u0000")[1] : undefined,
  );
  const label = title ?? meta.label;
  const repo = meta.sublabel;
  const kind: RecentKind = entity
    ? entity[3] === "issues"
      ? "issue"
      : "pr"
    : repo
      ? "repo"
      : "page";
  useEffect(() => {
    if (pathname === "/login" || pathname === "/settings") return;
    void pushRecentItem({ id: `page:${href}`, href, label, meta: repo, kind }).catch(() => {});
  }, [href, pathname, label, repo, kind]);
  return null;
}
