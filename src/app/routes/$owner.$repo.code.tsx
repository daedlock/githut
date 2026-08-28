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
import { Container } from "@/app/components/ui/Container";
import { Skeleton } from "@/app/components/ui/skeleton";
import { usePathCommit } from "@/app/hooks/usePathCommit";
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

  const { data: repoData } = useRepo(owner, repo);
  const branchesQuery = useRepoBranches(owner, repo);
  const defaultBranch = repoData?.default_branch;
  const branch = searchBranch ?? defaultBranch;
  const dataRef = searchBranch || undefined;
  const branchReady = !!searchBranch || !!defaultBranch;
  const isBlob = view === "blob";

  const { data: contents, isPending: contentsPending } = useRepoContents(
    owner,
    repo,
    path,
    dataRef,
    { enabled: branchReady && !isBlob },
  );
  const { data: commit, isPending: commitPending } = usePathCommit(owner, repo, path, dataRef, {
    enabled: branchReady && !isBlob,
  });
  const { data: readme } = useRepoReadme(owner, repo, dataRef, {
    enabled: branchReady && !isBlob && !path,
  });
  const { data: languages, isPending: languagesPending } = useRepoLanguages(owner, repo);
  const { data: releases, isPending: releasesPending } = useRepoReleases(owner, repo);
  const { data: contributors, isPending: contributorsPending } = useRepoContributors(owner, repo);

  // blob view
  const { data: fileData, isPending: filePending } = useRepoFile(owner, repo, path, dataRef, {
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

  return (
    <Container className="py-6">
      <h1 className="sr-only">
        Code for {owner}/{repo}
      </h1>
      <div className="flex gap-6 items-start">
        {/* main column */}
        <div className="flex min-w-0 flex-1 flex-col gap-3">
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
            filePending || !fileData ? (
              <BlobSkeleton />
            ) : (
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
            )
          ) : (
            <>
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
              {!path && readme && (
                <ReadmeViewer readme={readme} owner={owner} repo={repo} ref={branch} />
              )}
            </>
          )}
        </div>

        {/* sidebar — sticky offset = navbar (h-10/40px) + container py-6
            (24px) so the sidebar parks the same gap below the navbar
            that the buttons originally have above the file list. */}
        {showSidebar && (
          <div className="w-64 flex-shrink-0 sticky top-[64px] flex flex-col gap-3">
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
    <div className="rounded-md border border-border overflow-hidden">
      <div className="h-10 bg-muted border-b border-border" />
      <div className="skeleton-fade p-4 flex flex-col gap-2">
        {BLOB_SKELETON_WIDTHS.map((width) => (
          <Skeleton key={width} className="h-4" style={{ width }} />
        ))}
      </div>
    </div>
  );
}
