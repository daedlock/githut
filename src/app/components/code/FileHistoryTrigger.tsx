import { useNavigate, useRouterState } from "@tanstack/react-router";
import { History } from "lucide-react";
import { Button } from "@/app/components/ui/button";
import type { FileHistorySearch } from "@/app/lib/fileHistorySearch";

/**
 * Tiny ghost icon button that opens the file-history sheet for a given
 * (path, sha, branch). The sheet itself is mounted at the root and reads
 * its state from URL search params, so this component only nudges the URL.
 *
 * Lives in any header that renders around a file: FileDiff (PR review,
 * commit page, review page), BlobViewer (code page).
 */
export function FileHistoryTrigger({
  path,
  sha,
  branch,
  className,
}: {
  path: string;
  sha: string;
  branch: string;
  className?: string;
}) {
  const navigate = useNavigate();
  const search = useRouterState({ select: (s) => s.location.search });

  const next: FileHistorySearch & Record<string, unknown> = {
    ...(search as Record<string, unknown>),
    fhPath: path,
    fhSha: sha,
    fhBranch: branch,
  };

  return (
    <Button
      type="button"
      variant="ghost"
      size="icon-xs"
      className={className}
      onClick={(e) => {
        e.preventDefault();
        navigate({
          to: ".",
          // biome-ignore lint/suspicious/noExplicitAny: cross-route search merge — each route owns its own schema validation.
          search: next as any,
          resetScroll: false,
        });
      }}
      title="View file history (h)"
      aria-label="View file history"
    >
      <History data-icon="inline-start" />
    </Button>
  );
}
