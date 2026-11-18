import { useQuery } from "@tanstack/react-query";
import { createFileRoute, useRouterState } from "@tanstack/react-router";
import { z } from "zod";
import type { ActiveLineRange } from "@/app/components/code";
import { type BlobMode, BlobViewer } from "@/app/components/repo/BlobViewer";
import { BranchSelector } from "@/app/components/repo/BranchSelector";
import { CloneDropdown } from "@/app/components/repo/CloneDropdown";
import { Breadcrumb, FileList } from "@/app/components/repo/FileList";
import { ReadmeViewer } from "@/app/components/repo/ReadmeViewer";
import { RepoAbout } from "@/app/components/repo/RepoAbout";
import { StarButton } from "@/app/components/repo/StarButton";
import { StatusMessage } from "@/app/components/StatusMessage";
import { Container } from "@/app/components/ui/Container";
import { Skeleton, SkeletonGroup } from "@/app/components/ui/skeleton";
import { useVisibleSignal } from "@/app/features/activity/visibleSignal";
import { pathCommitQueryOptions, usePathCommit } from "@/app/hooks/usePathCommit";
import { repoQueryOptions, useRepo } from "@/app/hooks/useRepo";
import { repoBranchesQueryOptions, useRepoBranches } from "@/app/hooks/useRepoBranches";
import type { ContentEntry } from "@/app/hooks/useRepoContents";
import { repoContentsQueryOptions, useRepoContents } from "@/app/hooks/useRepoContents";
import { repoContributorsQueryOptions, useRepoContributors } from "@/app/hooks/useRepoContributors";
import { useRepoFile } from "@/app/hooks/useRepoFile";
import { repoLanguagesQueryOptions, useRepoLanguages } from "@/app/hooks/useRepoLanguages";
import { repoReadmeQueryOptions, useRepoReadme } from "@/app/hooks/useRepoReadme";
import { repoReleasesQueryOptions, useRepoReleases } from "@/app/hooks/useRepoReleases";
import { repoStarredQueryOptions } from "@/app/hooks/useRepoStarred";
import { track } from "@/app/lib/analytics";
import { fileHistorySearchSchema } from "@/app/lib/fileHistorySearch";
import { useAuthStore } from "@/app/stores/auth";

const codeSearchSchema = z.object({
  path: z.string().optional(),
  view: z.enum(["tree", "blob"]).optional(),
  mode: z.enum(["source", "history", "blame"]).optional(),
  branch: z.string().optional(),
  q: z.string().optional(),
  ...fileHistorySearchSchema.shape,
});

const BLOB_SKELETON_WIDTHS = [
  "40%",
  "59%",
  "78%",
  "42%",
  "61%",
  "80%",
  "44%",
  "63%",
  "82%",
  "46%",
  "65%",
  "84%",
] as const;

function parseLineHash(hash: string): ActiveLineRange | undefined {
  const clean = hash.replace(/^#/, "");
  const match = /^L(\d+)(?:C\d+)?(?:-L?(\d+)(?:C\d+)?)?$/i.exec(clean);
  if (!match) return undefined;

  const start = Number(match[1]);
  const rawEnd = match[2] ? Number(match[2]) : start;
  if (!Number.isFinite(start) || !Number.isFinite(rawEnd) || start < 1 || rawEnd < 1) {
    return undefined;
  }

  return rawEnd >= start ? { start, end: rawEnd } : { start: rawEnd, end: start };
}

export const Route = createFileRoute("/$owner/$repo/code")({
  validateSearch: codeSearchSchema,
  // Non-blocking prefetch for everything the code page renders. All fire
  // in parallel without awaiting — the component's own useRepo/useRepoX
  // hooks show skeletons on cold load. Branch-dependent queries
  // (pathCommit) are NOT pre-kicked here because we'd need the repo's
  // default_branch; the component fires those once repo data arrives.
  loader: ({ context, params }) => {
    const qc = context.queryClient;
    void qc.prefetchQuery(repoQueryOptions(params.owner, params.repo));
    void qc.prefetchQuery(repoBranchesQueryOptions(params.owner, params.repo));
    void qc.prefetchQuery(repoLanguagesQueryOptions(params.owner, params.repo));
    void qc.prefetchQuery(repoReadmeQueryOptions(params.owner, params.repo));
    void qc.prefetchQuery(repoContentsQueryOptions(params.owner, params.repo, ""));
    void qc.prefetchQuery(repoReleasesQueryOptions(params.owner, params.repo));
    void qc.prefetchQuery(repoContributorsQueryOptions(params.owner, params.repo));
    void qc.prefetchQuery(repoStarredQueryOptions(params.owner, params.repo));
  },
  component: CodePage,
});

function CodePage() {
  const { owner, repo } = Route.useParams();
  const { path = "", view, mode = "source", branch: searchBranch, q } = Route.useSearch();
  const hash = useRouterState({ select: (s) => s.location.hash });
  const activeLineRange = parseLineHash(hash);
  const navigate = Route.useNavigate();

  const repoQuery = useRepo(owner, repo);
  const repoData = repoQuery.data;
  const branchesQuery = useRepoBranches(owner, repo);
  const defaultBranch = repoData?.default_branch;
  const branch = searchBranch ?? defaultBranch;
  const dataRef = searchBranch || undefined;
  const branchReady = !!searchBranch || !!defaultBranch;
  const isBlob = view === "blob";
  const token = useAuthStore((s) => s.token);
  // Root history is the branch head; a nested path's last commit is not.
  // At the root this shares the header's request and cache entry.
  const head = useQuery({
    ...pathCommitQueryOptions(owner, repo, "", dataRef),
    staleTime: 60_000,
    enabled: !!token && branchReady,
  });
  useVisibleSignal(
    "/" +
      owner +
      "/" +
      repo +
      "/code?branch=" +
      encodeURIComponent(JSON.stringify(searchBranch ?? "")),
    head.data?.sha,
    Date.parse(head.data?.date ?? "") || 0,
    head.dataUpdatedAt,
  );

  const {
    data: contents,
    isPending: contentsPending,
    isError: contentsError,
  } = useRepoContents(owner, repo, path, dataRef, { enabled: branchReady && !isBlob });
  const { data: commit, isPending: commitPending } = usePathCommit(owner, repo, path, dataRef, {
    enabled: branchReady && !isBlob,
  });
  const { data: readme, isPending: readmePending } = useRepoReadme(owner, repo, dataRef, {
    enabled: branchReady && !isBlob && !path,
  });
  const { data: languages, isPending: languagesPending } = useRepoLanguages(owner, repo);
  const { data: releases, isPending: releasesPending } = useRepoReleases(owner, repo);
  const { data: contributors, isPending: contributorsPending } = useRepoContributors(owner, repo);

  // blob view
  const {
    data: fileData,
    isPending: filePending,
    isError: fileError,
  } = useRepoFile(owner, repo, path, dataRef, {
    enabled: branchReady && isBlob && !!path,
  });

  function navigateToEntry(entry: ContentEntry) {
    if (entry.type === "dir") {
      navigate({
        search: (prev) => ({
          ...prev,
          path: entry.path || undefined,
          view: undefined,
          mode: undefined,
          q: undefined,
        }),
      });
    } else {
      navigate({
        search: (prev) => ({
          ...prev,
          path: entry.path,
          view: "blob",
          q: undefined,
        }),
      });
    }
  }

  function navigateToPath(newPath: string) {
    navigate({
      search: (prev) => ({
        ...prev,
        path: newPath || undefined,
        view: undefined,
        mode: undefined,
        q: undefined,
      }),
    });
  }

  const showSidebar = !isBlob || !path;

  if (repoQuery.isError && !repoData) {
    return (
      <Container className="py-6">
        <StatusMessage tone="danger">Could not load this repository.</StatusMessage>
      </Container>
    );
  }

  return (
    <Container className="py-6">
      <h1 className="sr-only">
        Code for {owner}/{repo}
      </h1>
      <div className="flex flex-col items-start gap-6 @3xl/pane:flex-row">
        {/* main column */}
        <div className="flex w-full min-w-0 flex-1 flex-col gap-3">
          <div className="flex items-center justify-between gap-3">
            <Breadcrumb repo={repo} path={path} branch={branch ?? ""} onNavigate={navigateToPath} />
            <div className="flex flex-shrink-0 items-center gap-2">
              <BranchSelector
                branches={branchesQuery.data}
                value={branch}
                defaultBranch={defaultBranch}
                isLoading={branchesQuery.isPending}
                onChange={(nextBranch) => {
                  track("branch_changed", {
                    surface: "code",
                    default: nextBranch === defaultBranch,
                  });
                  navigate({
                    search: (prev) => ({
                      ...prev,
                      branch: nextBranch === defaultBranch ? undefined : nextBranch,
                    }),
                  });
                }}
              />
              {!showSidebar && (
                <>
                  <StarButton owner={owner} repo={repo} starCount={repoData?.stargazers_count} />
                  <CloneDropdown owner={owner} repo={repo} branch={branch} />
                </>
              )}
            </div>
          </div>
          {isBlob && path ? (
            fileError && !fileData ? (
              <StatusMessage tone="danger">Could not load this file.</StatusMessage>
            ) : filePending ? (
              <BlobSkeleton />
            ) : fileData ? (
              <BlobViewer
                file={fileData}
                owner={owner}
                repo={repo}
                ref={branch}
                mode={mode}
                activeLineRange={activeLineRange}
                searchQuery={q}
                onModeChange={(nextMode: BlobMode) => {
                  navigate({
                    search: (prev) => ({
                      ...prev,
                      mode: nextMode === "source" ? undefined : nextMode,
                    }),
                  });
                }}
              />
            ) : (
              <StatusMessage tone="danger">This file is not available.</StatusMessage>
            )
          ) : (
            <>
              {contentsError && !contents ? (
                <StatusMessage tone="danger">Could not load this directory.</StatusMessage>
              ) : (
                <FileList
                  owner={owner}
                  repo={repo}
                  refName={dataRef}
                  entries={contents}
                  isPending={contentsPending}
                  path={path}
                  commit={commit}
                  commitPending={commitPending}
                  onNavigate={navigateToEntry}
                />
              )}
              {!path && readmePending && (
                <SkeletonGroup
                  label="Loading README"
                  className="space-y-3 rounded-md border border-border p-5"
                >
                  <Skeleton className="mb-5 h-6 w-48" />
                  {[80, 100, 72, 60].map((width) => (
                    <Skeleton key={width} className="h-4" style={{ width: `${width}%` }} />
                  ))}
                </SkeletonGroup>
              )}
              {!path && readme && (
                <ReadmeViewer readme={readme} owner={owner} repo={repo} ref={branch} />
              )}
            </>
          )}
        </div>

        {/* sidebar — sticky offset = container py-6 (24px), so the sidebar
            parks the same gap below the pane top as above the file list. */}
        {showSidebar && (
          <div className="flex w-full shrink-0 flex-col gap-3 @3xl/pane:sticky @3xl/pane:top-6 @3xl/pane:w-64">
            <div className="flex items-center justify-end gap-2">
              <StarButton owner={owner} repo={repo} starCount={repoData?.stargazers_count} />
              <CloneDropdown owner={owner} repo={repo} branch={branch} />
            </div>
            <RepoAbout
              repo={repoData}
              languages={languages}
              languagesPending={languagesPending}
              releases={releases}
              releasesPending={releasesPending}
              contributors={contributors}
              contributorsPending={contributorsPending}
            />
          </div>
        )}
      </div>
    </Container>
  );
}

function BlobSkeleton() {
  return (
    <SkeletonGroup label="Loading file" className="rounded-md border border-border overflow-hidden">
      <div className="h-10 bg-muted border-b border-border" />
      <div className="skeleton-fade p-4 flex flex-col gap-2">
        {BLOB_SKELETON_WIDTHS.map((width) => (
          <Skeleton key={width} className="h-4" style={{ width }} />
        ))}
      </div>
    </SkeletonGroup>
  );
}
