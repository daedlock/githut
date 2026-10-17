import { useReviewStore } from "@/app/features/pulls/stores/review";
import { draftPageFromHref, useDraftsStore } from "@/app/stores/drafts";

/**
 * Whether the page an href shows has an unsent draft: composer text or
 * pending inline review comments. Drives the tab's draft dot.
 */
export function usePageHasDraft(href: string): boolean {
  const page = draftPageFromHref(href);
  const hasText = useDraftsStore((s) => {
    if (!page) return false;
    const prefix = `${page}#`;
    for (const k in s.drafts) if (k.startsWith(prefix)) return true;
    return false;
  });
  const hasPending = useReviewStore((s) => !!page && (s.pendingByPr[page]?.length ?? 0) > 0);
  return hasText || hasPending;
}
