import { createFileRoute, Link } from "@tanstack/react-router";
import { AlertCircle, ArrowLeft, Check, Copy } from "lucide-react";
import { Fragment, useMemo, useState } from "react";
import { DiffLayout, type DiffLayoutFile, type FileStatus } from "@/app/components/code";
import { StatusMessage } from "@/app/components/StatusMessage";
import { Skeleton } from "@/app/components/ui/skeleton";
import { ProfileLink } from "@/app/components/user/ProfileLink";
import { type CommitFile, useRepoCommit } from "@/app/hooks/useRepoCommit";
import { detectLang } from "@/app/lib/detectLang";
import { cn } from "@/app/lib/cn";
import { formatRelativeTime } from "@/app/lib/time";

export const Route = createFileRoute("/$owner/$repo/commit/$sha")({
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
      <div className="w-full px-4 py-4 sm:px-6">
        <Link
          to="/$owner/$repo/commits"
          params={{ owner, repo }}
          className={cn(
            "mb-2 inline-flex items-center gap-1.5 rounded-sm px-1 py-0.5 -ml-1",
            "text-ui text-muted-foreground outline-none transition-colors",
            "hover:text-foreground focus-visible:ring-1 focus-visible:ring-foreground/15",
          )}
        >
          <ArrowLeft className="size-3" />
          All commits
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
          <DiffLayout
            files={diffFiles}
            initialSidebarOpen={diffFiles.length > 1}
          />
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
    <section className="relative">
      {/* SHA anchored top-right — treat it as the commit's fingerprint, the
          visual ID of this page. Separated from the prose meta row so the
          copy-action isn't competing with author/parent info for attention. */}
      <div className="absolute right-0 top-0">
        <ShaChip sha={commit.sha} />
      </div>

      {/*
       * Title — text-title (18px) medium weight. Commit messages are sentences,
       * not page headings; sizing them like an <h1 text-2xl font-semibold>
       * over-signals hierarchy. pr-24 reserves space for the SHA chip so long
       * titles don't collide with it.
       */}
      <h1 className="pr-24 text-title font-medium text-foreground">{title}</h1>

      {/* Meta as prose — single line, no chips. Dot separators carry rhythm. */}
      <div className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-ui text-muted-foreground">
        {avatar ? (
          <img
            src={avatar}
            alt=""
            className="size-4 flex-shrink-0 rounded-full border border-border"
          />
        ) : null}
        {authorLogin ? (
          <ProfileLink login={authorLogin} className="font-medium text-foreground">
            {displayAuthor}
          </ProfileLink>
        ) : (
          <span className="font-medium text-foreground">{displayAuthor}</span>
        )}
        <span>committed {formatRelativeTime(commit.commit.author.date)}</span>

        {commit.parents.length > 0 && (
          <>
            <span className="text-[var(--color-fg-faint)]" aria-hidden>
              ·
            </span>
            <span className="inline-flex items-center gap-1">
              <span>{commit.parents.length > 1 ? "parents" : "parent"}</span>
              {commit.parents.map((p, i) => (
                <Fragment key={p.sha}>
                  {i > 0 && (
                    <span className="text-[var(--color-fg-faint)]" aria-hidden>
                      +
                    </span>
                  )}
                  <Link
                    to="/$owner/$repo/commit/$sha"
                    params={{ owner, repo, sha: p.sha }}
                    className={cn(
                      "rounded-sm font-mono text-caption tabular-nums",
                      "text-muted-foreground outline-none",
                      "underline decoration-input decoration-1 underline-offset-2 transition-colors",
                      "hover:text-foreground hover:decoration-muted-foreground",
                      "focus-visible:ring-1 focus-visible:ring-foreground/15",
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
        <pre className="mt-3 max-w-3xl whitespace-pre-wrap border-l-2 border-input pl-3 font-mono text-code text-muted-foreground">
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
        "group inline-flex items-center gap-1.5 rounded-sm border border-border bg-background px-2 py-1",
        "font-mono text-caption tabular-nums text-muted-foreground",
        "outline-none transition-colors",
        "hover:border-input hover:text-foreground",
        "focus-visible:ring-1 focus-visible:ring-foreground/15",
      )}
    >
      <span>{sha.slice(0, 7)}</span>
      {copied ? (
        <Check className="size-3 text-[var(--color-success)]" />
      ) : (
        <Copy className="size-3 text-[var(--color-fg-faint)] transition-colors group-hover:text-muted-foreground" />
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
