import { createFileRoute, Link } from "@tanstack/react-router";
import { AlertCircle, ArrowLeft, Check, Copy } from "lucide-react";
import { Fragment, useMemo, useState } from "react";
import { DiffLayout, type DiffLayoutFile, type FileStatus } from "@/app/components/code";
import { StatusMessage } from "@/app/components/StatusMessage";
import { Skeleton } from "@/app/components/ui/skeleton";
import { ProfileLink } from "@/app/components/user/ProfileLink";
import { type CommitFile, repoCommitQueryOptions, useRepoCommit } from "@/app/hooks/useRepoCommit";
import { cn } from "@/app/lib/cn";
import { detectLang } from "@/app/lib/detectLang";
import { formatRelativeTime } from "@/app/lib/time";

export const Route = createFileRoute("/$owner/$repo/commit/$sha")({
  loader: ({ context, params }) =>
    context.queryClient.ensureQueryData(
      repoCommitQueryOptions(params.owner, params.repo, params.sha),
    ),
  component: CommitDetailPage,
});

function CommitDetailPage() {
  const { owner, repo, sha } = Route.useParams();
  const { data: commit, isPending, isError } = useRepoCommit(owner, repo, sha);

  const diffFiles = useMemo<DiffLayoutFile[]>(() => {
    if (!commit) return [];
    return commit.files.map((f) => ({
      filename: f.filename,
      previousFilename: f.previous_filename,
      status: normalizeStatus(f.status),
      additions: f.additions,
      deletions: f.deletions,
      patch: f.patch ?? null,
      lang: detectLang(f.filename),
    }));
  }, [commit]);

  return (
    <div className="flex w-full flex-col">
      {/*
       * Editorial header — full-bleed, no Container wrap. Horizontal gutter
       * (px-4/sm:px-6) matches the app's global gutter so the header text
       * lines up with the rest of the app's content column, but the header
       * itself is a full-width strip that joins seamlessly to the diff region
       * below via a single hairline. Tight vertical rhythm (py-4) keeps the
       * diff above the fold.
       */}
      <div className="w-full px-4 py-3 sm:px-6 sm:py-4">
        <Link
          to="/$owner/$repo/commits"
          params={{ owner, repo }}
          className={cn(
            "mb-2 inline-flex items-center gap-1 rounded-sm px-1 py-0.5 -ml-1",
            "text-caption text-(--color-fg-muted) outline-none transition-colors",
            "hover:text-(--color-fg)",
            "focus-visible:ring-1 focus-visible:ring-(--color-focus)",
          )}
        >
          <ArrowLeft className="size-3" strokeWidth={2.25} />
          <span>All commits</span>
        </Link>

        {isPending ? (
          <CommitHeaderSkeleton />
        ) : isError || !commit ? (
          <div className="rounded-md border border-border bg-muted px-4 py-6 text-center">
            <AlertCircle className="mx-auto mb-2 size-4 text-destructive" />
            <p className="text-ui text-muted-foreground">Could not load this commit.</p>
          </div>
        ) : (
          <CommitHeader commit={commit} owner={owner} repo={repo} />
        )}
      </div>

      {commit && diffFiles.length > 0 && (
        <div className="border-t border-border">
          <DiffLayout files={diffFiles} initialSidebarOpen={diffFiles.length > 1} />
        </div>
      )}

      {commit && diffFiles.length === 0 && (
        <div className="border-t border-border px-4 py-8 sm:px-6">
          <StatusMessage>No file changes in this commit.</StatusMessage>
        </div>
      )}
    </div>
  );
}

// ─── Header ─────────────────────────────────────────────────────────────────

function CommitHeader({
  commit,
  owner,
  repo,
}: {
  commit: NonNullable<ReturnType<typeof useRepoCommit>["data"]>;
  owner: string;
  repo: string;
}) {
  const { title, body } = splitMessage(commit.commit.message);
  const displayAuthor = commit.author?.login ?? commit.commit.author.name;
  const authorLogin = commit.author?.login;
  const avatar = commit.author?.avatar_url;

  return (
    <section className="flex flex-col gap-1.5">
      {/* Title row — title + SHA chip top-aligned, no absolute positioning */}
      <div className="flex items-start justify-between gap-3">
        <h1 className="min-w-0 text-body font-medium leading-snug text-(--color-fg) sm:text-title">
          {title}
        </h1>
        <ShaChip sha={commit.sha} />
      </div>

      {/* Meta — single compact line */}
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-ui text-(--color-fg-muted)">
        {avatar ? (
          <img
            src={avatar}
            alt=""
            className="size-4 flex-shrink-0 rounded-full border border-border"
          />
        ) : null}
        {authorLogin ? (
          <ProfileLink login={authorLogin} className="font-medium text-(--color-fg)">
            {displayAuthor}
          </ProfileLink>
        ) : (
          <span className="font-medium text-(--color-fg)">{displayAuthor}</span>
        )}
        <span>committed {formatRelativeTime(commit.commit.author.date)}</span>

        {commit.parents.length > 0 && (
          <>
            <span className="text-(--color-fg-faint)" aria-hidden>
              ·
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span>{commit.parents.length > 1 ? "parents" : "parent"}</span>
              {commit.parents.map((p, i) => (
                <Fragment key={p.sha}>
                  {i > 0 && (
                    <span className="text-(--color-fg-faint)" aria-hidden>
                      +
                    </span>
                  )}
                  <Link
                    to="/$owner/$repo/commit/$sha"
                    params={{ owner, repo, sha: p.sha }}
                    className={cn(
                      "rounded-sm font-mono text-caption tabular-nums",
                      "text-(--color-fg-muted) outline-none",
                      "underline decoration-(--color-border-strong) decoration-1 underline-offset-[3px] transition-colors",
                      "hover:text-(--color-fg) hover:decoration-(--color-fg-muted)",
                      "focus-visible:ring-1 focus-visible:ring-(--color-focus)",
                    )}
                  >
                    {p.sha.slice(0, 7)}
                  </Link>
                </Fragment>
              ))}
            </span>
          </>
        )}
      </div>

      {body && (
        <pre className="mt-1 max-w-3xl whitespace-pre-wrap border-l-2 border-(--color-border-strong) pl-3 font-mono text-code text-(--color-fg-muted)">
          {body}
        </pre>
      )}
    </section>
  );
}

function ShaChip({ sha }: { sha: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      onClick={() => {
        navigator.clipboard.writeText(sha).then(() => {
          setCopied(true);
          setTimeout(() => setCopied(false), 1200);
        });
      }}
      title={copied ? "Copied!" : "Copy full SHA"}
      aria-label="Copy full SHA"
      className={cn(
        "group inline-flex h-5 shrink-0 items-center gap-1 rounded",
        "border border-border bg-(--color-bg-subtle) pl-1.5 pr-1",
        "font-mono text-micro tabular-nums leading-none text-(--color-fg-muted)",
        "outline-none transition-colors",
        "hover:border-(--color-border-strong) hover:bg-(--color-bg-sunken) hover:text-(--color-fg)",
        "focus-visible:ring-1 focus-visible:ring-(--color-focus)",
      )}
    >
      <span>{sha.slice(0, 7)}</span>
      {copied ? (
        <Check
          className="size-2.5 text-(--color-success)"
          strokeWidth={2.5}
          aria-hidden
        />
      ) : (
        <Copy
          className="size-2.5 text-(--color-fg-muted) transition-colors group-hover:text-(--color-fg)"
          strokeWidth={2}
          aria-hidden
        />
      )}
    </button>
  );
}

// ─── Files list ─────────────────────────────────────────────────────────────

// GitHub's file status includes "unchanged" and "changed" values FileDiff's
// status variants don't render distinctly — map both onto "modified" so the
// badge still makes sense. Everything else passes through.
function normalizeStatus(status: CommitFile["status"]): FileStatus {
  if (status === "unchanged" || status === "changed") return "modified";
  return status;
}

// ─── Skeleton ───────────────────────────────────────────────────────────────

function CommitHeaderSkeleton() {
  return (
    <div className="flex flex-col gap-2">
      <Skeleton className="h-5 w-2/3" />
      <div className="flex items-center gap-3">
        <Skeleton className="size-4 rounded-full" />
        <Skeleton className="h-3.5 w-48" />
      </div>
    </div>
  );
}

function splitMessage(message: string): { title: string; body: string } {
  const trimmed = message.trim();
  const splitIdx = trimmed.indexOf("\n\n");
  if (splitIdx === -1) return { title: trimmed, body: "" };
  return {
    title: trimmed.slice(0, splitIdx).trim(),
    body: trimmed.slice(splitIdx + 2).trim(),
  };
}
