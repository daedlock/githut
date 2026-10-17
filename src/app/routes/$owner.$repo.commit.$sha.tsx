import { createFileRoute, Link } from "@tanstack/react-router";
import { AlertCircle, ArrowLeft, Files, GitCommitHorizontal } from "lucide-react";
import { type ReactNode, useMemo } from "react";
import {
  ChangeStatsBadge,
  DiffLayout,
  type DiffLayoutFile,
  type FileStatus,
} from "@/app/components/code";
import { DiffLayoutSkeleton } from "@/app/components/code/DiffLayoutSkeleton";
import { StatusMessage } from "@/app/components/StatusMessage";
import { Container } from "@/app/components/ui/Container";
import { ShaChip } from "@/app/components/ui/ShaChip";
import { Skeleton, SkeletonGroup } from "@/app/components/ui/skeleton";
import { ProfileLink } from "@/app/components/user/ProfileLink";
import { type CommitFile, repoCommitQueryOptions, useRepoCommit } from "@/app/hooks/useRepoCommit";
import { cn } from "@/app/lib/cn";
import { detectLang } from "@/app/lib/detectLang";
import { formatRelativeTime } from "@/app/lib/time";

export const Route = createFileRoute("/$owner/$repo/commit/$sha")({
  // Fire-and-forget prefetch — component handles its own pending state.
  loader: ({ context, params }) => {
    void context.queryClient.prefetchQuery(
      repoCommitQueryOptions(params.owner, params.repo, params.sha),
    );
  },
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
      <header className="w-full border-b border-border bg-[var(--color-bg-subtle)]/35">
        <Container className="grid @4xl/pane:grid-cols-[320px_minmax(0,1fr)]">
          <div className="border-b border-border px-4 py-4 @4xl/pane:border-r @4xl/pane:border-b-0">
            <CommitBackLink owner={owner} repo={repo} />
            {commit ? <CommitManifest commit={commit} owner={owner} repo={repo} /> : null}
            {isPending && (
              <div className="mt-4 space-y-3">
                <Skeleton className="h-4 w-32" />
                <Skeleton className="h-3 w-48" />
                <Skeleton className="h-3 w-24" />
              </div>
            )}
          </div>

          <div className="min-w-0 px-5 py-5 @4xl/pane:px-7 @4xl/pane:py-6">
            {isPending ? (
              <CommitHeaderSkeleton />
            ) : isError || !commit ? (
              <div className="rounded-md border border-border bg-muted px-4 py-6 text-center">
                <AlertCircle className="mx-auto mb-2 size-4 text-destructive" />
                <p className="text-ui text-muted-foreground">Could not load this commit.</p>
              </div>
            ) : (
              <CommitHeader commit={commit} />
            )}
          </div>
        </Container>
      </header>

      {isPending && <DiffLayoutSkeleton />}

      {commit && diffFiles.length > 0 && (
        <DiffLayout
          files={diffFiles}
          initialSidebarOpen={diffFiles.length > 1}
          owner={owner}
          repo={repo}
          headRef={commit.sha}
          baseRef={commit.parents[0]?.sha}
        />
      )}

      {commit && diffFiles.length === 0 && (
        <div className="border-t border-border px-4 py-8 @xl/pane:px-6">
          <StatusMessage>No file changes in this commit.</StatusMessage>
        </div>
      )}
    </div>
  );
}

// ─── Header ─────────────────────────────────────────────────────────────────

function CommitHeader({
  commit,
}: {
  commit: NonNullable<ReturnType<typeof useRepoCommit>["data"]>;
}) {
  const { title, paragraphs, trailers } = parseCommitMessage(commit.commit.message);
  const keyedParagraphs = withOccurrenceKeys(paragraphs);
  const displayAuthor = commit.author?.login ?? commit.commit.author.name;
  const authorLogin = commit.author?.login;
  const avatar = commit.author?.avatar_url;

  return (
    <section className="max-w-5xl">
      <p className="mb-2 font-mono text-micro uppercase tracking-[0.16em] text-(--color-fg-faint)">
        Commit summary
      </p>
      <h1 className="text-heading font-semibold leading-tight tracking-tight text-(--color-fg)">
        {title}
      </h1>

      <div className="mt-3 flex flex-wrap items-center gap-x-2 gap-y-1 text-ui text-(--color-fg-muted)">
        {avatar ? (
          <img
            src={avatar}
            alt=""
            className="size-5 flex-shrink-0 rounded-full border border-border"
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
      </div>

      {paragraphs.length > 0 || trailers.length > 0 ? (
        <div className="mt-5 max-w-[82ch] border-t border-border pt-4">
          <div className="flex flex-col gap-3 text-body leading-6 text-(--color-fg-muted)">
            {keyedParagraphs.map((paragraph) => (
              <p key={paragraph.key} className="whitespace-pre-wrap">
                {paragraph.value}
              </p>
            ))}
          </div>

          {trailers.length > 0 ? (
            <dl className="mt-4 flex flex-col gap-1.5 border-l-2 border-(--color-border-strong) pl-3">
              {trailers.map((trailer) => (
                <div key={`${trailer.label}:${trailer.value}`} className="flex flex-wrap gap-x-2">
                  <dt className="font-mono text-caption text-(--color-fg-faint)">
                    {trailer.label}
                  </dt>
                  <dd className="font-mono text-caption text-(--color-fg-muted)">
                    {trailer.value}
                  </dd>
                </div>
              ))}
            </dl>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}

function CommitBackLink({ owner, repo }: { owner: string; repo: string }) {
  return (
    <Link
      to="/$owner/$repo/commits"
      params={{ owner, repo }}
      className={cn(
        "inline-flex items-center gap-1 rounded-sm px-1 py-0.5 -ml-1",
        "text-caption text-(--color-fg-muted) outline-none transition-colors",
        "hover:text-(--color-fg)",
        "focus-visible:ring-1 focus-visible:ring-(--color-focus)",
      )}
    >
      <ArrowLeft className="size-3" strokeWidth={2.25} />
      <span>All commits</span>
    </Link>
  );
}

function CommitManifest({
  commit,
  owner,
  repo,
}: {
  commit: NonNullable<ReturnType<typeof useRepoCommit>["data"]>;
  owner: string;
  repo: string;
}) {
  const additions =
    commit.stats?.additions ?? commit.files.reduce((sum, file) => sum + file.additions, 0);
  const deletions =
    commit.stats?.deletions ?? commit.files.reduce((sum, file) => sum + file.deletions, 0);

  return (
    <div className="mt-7 flex flex-col gap-5">
      <ManifestFact icon={<GitCommitHorizontal className="size-3.5" />} label="Commit">
        <ShaChip sha={commit.sha} variant="compact" className="h-6" />
      </ManifestFact>

      <ManifestFact icon={<Files className="size-3.5" />} label="Changed">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-ui font-medium text-(--color-fg)">
            {commit.files.length} {commit.files.length === 1 ? "file" : "files"}
          </span>
          <ChangeStatsBadge additions={additions} deletions={deletions} />
        </div>
      </ManifestFact>

      {commit.parents.length > 0 ? (
        <ManifestFact label={commit.parents.length > 1 ? "Parents" : "Parent"}>
          <div className="flex flex-wrap items-center gap-2">
            {commit.parents.map((parent) => (
              <Link
                key={parent.sha}
                to="/$owner/$repo/commit/$sha"
                params={{ owner, repo, sha: parent.sha }}
                className={cn(
                  "rounded-sm font-mono text-caption tabular-nums text-(--color-fg-muted)",
                  "underline decoration-(--color-border-strong) underline-offset-[3px] outline-none transition-colors",
                  "hover:text-(--color-fg) hover:decoration-(--color-fg-muted)",
                  "focus-visible:ring-1 focus-visible:ring-(--color-focus)",
                )}
              >
                {parent.sha.slice(0, 7)}
              </Link>
            ))}
          </div>
        </ManifestFact>
      ) : null}
    </div>
  );
}

function ManifestFact({
  icon,
  label,
  children,
}: {
  icon?: ReactNode;
  label: string;
  children: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center gap-1.5 font-mono text-micro uppercase tracking-[0.14em] text-(--color-fg-faint)">
        {icon}
        <span>{label}</span>
      </div>
      <div>{children}</div>
    </div>
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
    <SkeletonGroup label="Loading commit" className="flex flex-col gap-2">
      <Skeleton className="h-5 w-2/3" />
      <div className="flex items-center gap-3">
        <Skeleton className="size-4 rounded-full" />
        <Skeleton className="h-3.5 w-48" />
      </div>
    </SkeletonGroup>
  );
}

export function splitMessage(message: string): { title: string; body: string } {
  const trimmed = message.trim();
  const splitIdx = trimmed.indexOf("\n\n");
  if (splitIdx === -1) return { title: trimmed, body: "" };
  return {
    title: trimmed.slice(0, splitIdx).trim(),
    body: trimmed.slice(splitIdx + 2).trim(),
  };
}

type CommitTrailer = { label: string; value: string };

export function parseCommitMessage(message: string): {
  title: string;
  paragraphs: string[];
  trailers: CommitTrailer[];
} {
  const { title, body } = splitMessage(message);
  if (!body) return { title, paragraphs: [], trailers: [] };

  const blocks = body
    .split(/\n{2,}/)
    .map((block) => block.trim())
    .filter(Boolean);
  const trailerPattern = /^([A-Za-z][A-Za-z-]+):\s+(.+)$/;
  const trailerBlock = blocks.at(-1);
  const trailerLines = trailerBlock?.split("\n") ?? [];
  const parsedTrailers = trailerLines.map((line) => line.match(trailerPattern));
  const hasTrailerBlock = parsedTrailers.length > 0 && parsedTrailers.every(Boolean);

  const trailers: CommitTrailer[] = hasTrailerBlock
    ? parsedTrailers.map((match) => ({ label: `${match![1]}:`, value: match![2]! }))
    : [];
  const bodyBlocks = hasTrailerBlock ? blocks.slice(0, -1) : blocks;
  const paragraphs = bodyBlocks.map(normalizeCommitParagraph);

  return { title, paragraphs, trailers };
}

function withOccurrenceKeys(values: string[]): Array<{ key: string; value: string }> {
  const occurrences = new Map<string, number>();
  return values.map((value) => {
    const occurrence = occurrences.get(value) ?? 0;
    occurrences.set(value, occurrence + 1);
    return { key: `${value}\u0000${occurrence}`, value };
  });
}

function normalizeCommitParagraph(paragraph: string): string {
  const lines = paragraph.split("\n").map((line) => line.trimEnd());
  const preservesLineBreaks = lines.some((line) => /^\s*(?:[-*+] |\d+[.)] )/.test(line));
  return preservesLineBreaks ? lines.join("\n") : lines.map((line) => line.trim()).join(" ");
}
