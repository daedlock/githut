import { createFileRoute, Link } from "@tanstack/react-router";
import { AlertCircle, ArrowLeft, Check, Copy } from "lucide-react";
import { Fragment, useMemo, useState } from "react";
import { DiffLayout, type DiffLayoutFile, type FileStatus } from "@/app/components/code";
import { StatusMessage } from "@/app/components/StatusMessage";
import { Skeleton } from "@/app/components/ui/Skeleton";
import { type CommitFile, useRepoCommit } from "@/app/hooks/useRepoCommit";
import { detectLang } from "@/app/lib/detectLang";
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
          className="mb-2 inline-flex items-center gap-1.5 text-ui text-[var(--color-fg-muted)] transition-colors hover:text-[var(--color-fg)]"
        >
          <ArrowLeft className="h-3 w-3" />
          All commits
        </Link>

        {isPending ? (
          <CommitHeaderSkeleton />
        ) : isError || !commit ? (
          <div className="rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-bg-subtle)] px-4 py-6 text-center">
            <AlertCircle className="mx-auto mb-2 h-4 w-4 text-[var(--color-danger)]" />
            <p className="text-ui text-[var(--color-fg-muted)]">Could not load this commit.</p>
          </div>
        ) : (
          <CommitHeader commit={commit} owner={owner} repo={repo} />
        )}
      </div>

      {commit && diffFiles.length > 0 && (
        <div className="border-t border-[var(--color-border)]">
          <DiffLayout
            files={diffFiles}
            // Single-file commits don't need a sidebar — gives the diff the
            // full viewport. User can still open the tree with [ if they want.
            initialSidebarOpen={diffFiles.length > 1}
          />
        </div>
      )}

      {commit && diffFiles.length === 0 && (
        <div className="border-t border-[var(--color-border)] px-4 py-8 sm:px-6">
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
      <h1 className="pr-24 text-title font-medium text-[var(--color-fg)]">{title}</h1>

      {/*
       * Meta as prose — single line reading "author committed time · parent sha".
       * No labels, no chips (except the parent link which needs a surface to
       * hint at clickability). Dot separators carry the rhythm.
       */}
      <div className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-ui text-[var(--color-fg-muted)]">
        {avatar ? (
          <img
            src={avatar}
            alt=""
            className="h-4 w-4 flex-shrink-0 rounded-full border border-[var(--color-border)]"
          />
        ) : null}
        <span className="font-medium text-[var(--color-fg)]">{displayAuthor}</span>
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
                    className="rounded-[var(--radius-xs)] font-mono text-caption tabular-nums text-[var(--color-fg-muted)] underline decoration-[var(--color-border-strong)] decoration-1 underline-offset-2 transition-colors hover:text-[var(--color-fg)] hover:decoration-[var(--color-fg-muted)]"
                  >
                    {p.sha.slice(0, 7)}
                  </Link>
                </Fragment>
              ))}
            </span>
          </>
        )}
      </div>

      {/* Optional body — left-border accent, mono. Reads like `git log` body. */}
      {body && (
        <pre className="mt-3 max-w-3xl whitespace-pre-wrap border-l-2 border-[var(--color-border-strong)] pl-3 font-mono text-code text-[var(--color-fg-muted)]">
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
      className="group inline-flex items-center gap-1.5 rounded-[var(--radius-xs)] border border-[var(--color-border)] bg-[var(--color-bg)] px-2 py-1 font-mono text-caption tabular-nums text-[var(--color-fg-muted)] transition-colors hover:border-[var(--color-border-strong)] hover:text-[var(--color-fg)]"
    >
      <span>{sha.slice(0, 7)}</span>
      {copied ? (
        <Check className="h-3 w-3 text-[var(--color-success)]" />
      ) : (
        <Copy className="h-3 w-3 text-[var(--color-fg-faint)] transition-colors group-hover:text-[var(--color-fg-muted)]" />
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
    <div className="space-y-2">
      <Skeleton className="h-5 w-2/3" />
      <div className="flex items-center gap-3">
        <Skeleton className="h-4 w-4 rounded-full" />
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
