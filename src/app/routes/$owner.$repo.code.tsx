import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { BlobViewer } from "@/app/components/repo/BlobViewer";
import { Breadcrumb, FileList } from "@/app/components/repo/FileList";
import { ReadmeViewer } from "@/app/components/repo/ReadmeViewer";
import { RepoAbout } from "@/app/components/repo/RepoAbout";
import { Container } from "@/app/components/ui/Container";
import { Skeleton } from "@/app/components/ui/Skeleton";
import { useRepo } from "@/app/hooks/useRepo";
import { useRepoContents } from "@/app/hooks/useRepoContents";
import { useRepoFile } from "@/app/hooks/useRepoFile";
import { useRepoLanguages } from "@/app/hooks/useRepoLanguages";
import { useRepoReadme } from "@/app/hooks/useRepoReadme";
import { usePathCommit } from "@/app/hooks/usePathCommit";
import type { ContentEntry } from "@/app/hooks/useRepoContents";

const codeSearchSchema = z.object({
  path: z.string().optional(),
  view: z.enum(["tree", "blob"]).optional(),
});

export const Route = createFileRoute("/$owner/$repo/code")({
  validateSearch: codeSearchSchema,
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
        <Breadcrumb
          repo={repo}
          path={path}
          branch={branch ?? ""}
          onNavigate={navigateToPath}
        />
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
            <RepoAbout
              repo={repoData}
              languages={languages}
              languagesPending={languagesPending}
            />
          </div>
        )}
      </div>
    </Container>
  );
}

function BlobSkeleton() {
  return (
    <div className="rounded-[var(--radius-md)] border border-[var(--color-border)] overflow-hidden">
      <div className="h-10 bg-[var(--color-bg-subtle)] border-b border-[var(--color-border)]" />
      <div className="skeleton-fade p-4 flex flex-col gap-2">
        {Array.from({ length: 12 }).map((_, i) => (
          <Skeleton key={i} className="h-4" style={{ width: `${40 + (i * 19) % 55}%` }} />
        ))}
      </div>
    </div>
  );
}
