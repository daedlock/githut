import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { BlobViewer } from "@/app/components/repo/BlobViewer";
import { Breadcrumb, FileList } from "@/app/components/repo/FileList";
import { ReadmeViewer } from "@/app/components/repo/ReadmeViewer";
import { RepoAbout } from "@/app/components/repo/RepoAbout";
import { Container } from "@/app/components/ui/Container";
import { Skeleton } from "@/app/components/ui/skeleton";
import { pathCommitQueryOptions, usePathCommit } from "@/app/hooks/usePathCommit";
import { repoQueryOptions, useRepo } from "@/app/hooks/useRepo";
import type { ContentEntry } from "@/app/hooks/useRepoContents";
import { repoContentsQueryOptions, useRepoContents } from "@/app/hooks/useRepoContents";
import { useRepoFile } from "@/app/hooks/useRepoFile";
import { repoLanguagesQueryOptions, useRepoLanguages } from "@/app/hooks/useRepoLanguages";
import { repoReadmeQueryOptions, useRepoReadme } from "@/app/hooks/useRepoReadme";

const codeSearchSchema = z.object({
  path: z.string().optional(),
  view: z.enum(["tree", "blob"]).optional(),
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

export const Route = createFileRoute("/$owner/$repo/code")({
  validateSearch: codeSearchSchema,
  // Fire-and-forget prefetches for everything the code page renders. We wait
  // for `repo` (so we know the default branch) before dispatching the
  // branch-dependent queries; the independent ones go in parallel.
  loader: async ({ context, params }) => {
    const qc = context.queryClient;
    const [repo] = await Promise.all([
      qc.ensureQueryData(repoQueryOptions(params.owner, params.repo)),
      qc.prefetchQuery(repoLanguagesQueryOptions(params.owner, params.repo)),
      qc.prefetchQuery(repoReadmeQueryOptions(params.owner, params.repo)),
      qc.prefetchQuery(repoContentsQueryOptions(params.owner, params.repo, "")),
    ]);
    qc.prefetchQuery(pathCommitQueryOptions(params.owner, params.repo, "", repo.default_branch));
  },
  component: CodePage,
});

function CodePage() {
  const { owner, repo } = Route.useParams();
  const { path = "", view } = Route.useSearch();
  const navigate = Route.useNavigate();

  const { data: repoData } = useRepo(owner, repo);
  const branch = repoData?.default_branch;
  const isBlob = view === "blob";

  const { data: contents, isPending: contentsPending } = useRepoContents(
    owner,
    repo,
    isBlob ? "" : path,
  );
  const { data: commit, isPending: commitPending } = usePathCommit(
    owner,
    repo,
    isBlob ? "" : path,
    branch,
  );
  const { data: readme } = useRepoReadme(owner, repo);
  const { data: languages, isPending: languagesPending } = useRepoLanguages(owner, repo);

  // blob view
  const { data: fileData, isPending: filePending } = useRepoFile(
    owner,
    repo,
    isBlob ? path : "",
    branch,
  );

  function navigateToEntry(entry: ContentEntry) {
    if (entry.type === "dir") {
      navigate({
        search: (prev) => ({
          ...prev,
          path: entry.path || undefined,
          view: undefined,
        }),
      });
    } else {
      navigate({
        search: (prev) => ({
          ...prev,
          path: entry.path,
          view: "blob",
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
      }),
    });
  }

  const showSidebar = !isBlob || !path;

  return (
    <Container className="py-6">
      {/* breadcrumb */}
      <div className="mb-3">
        <Breadcrumb repo={repo} path={path} branch={branch ?? ""} onNavigate={navigateToPath} />
      </div>

      <div className="flex gap-6 items-start">
        {/* main column */}
        <div className="flex min-w-0 flex-1 flex-col gap-4">
          {isBlob && path ? (
            filePending || !fileData ? (
              <BlobSkeleton />
            ) : (
              <BlobViewer file={fileData} />
            )
          ) : (
            <>
              <FileList
                owner={owner}
                repo={repo}
                refName={branch}
                entries={contents}
                isPending={contentsPending}
                path={path}
                commit={commit}
                commitPending={commitPending}
                onNavigate={navigateToEntry}
              />
              {!path && readme && <ReadmeViewer readme={readme} />}
            </>
          )}
        </div>

        {/* sidebar — always visible */}
        {showSidebar && (
          <div className="w-64 flex-shrink-0 sticky top-6">
            <RepoAbout repo={repoData} languages={languages} languagesPending={languagesPending} />
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
