import { createFileRoute } from "@tanstack/react-router";
import { FileList } from "@/app/components/repo/FileList";
import { ReadmeViewer } from "@/app/components/repo/ReadmeViewer";
import { RepoAbout } from "@/app/components/repo/RepoAbout";
import { useRepo } from "@/app/hooks/useRepo";
import { useRepoContents } from "@/app/hooks/useRepoContents";
import { useRepoLanguages } from "@/app/hooks/useRepoLanguages";
import { useRepoReadme } from "@/app/hooks/useRepoReadme";

export const Route = createFileRoute("/$owner/$repo/code")({
  component: CodePage,
});

function CodePage() {
  const { owner, repo } = Route.useParams();

  const { data: repoData } = useRepo(owner, repo);
  const { data: contents, isPending: contentsPending } = useRepoContents(
    owner,
    repo,
    "",
    repoData?.default_branch,
  );
  const { data: readme } = useRepoReadme(owner, repo, repoData?.default_branch);
  const { data: languages, isPending: languagesPending } = useRepoLanguages(owner, repo);

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-6">
      <div className="flex gap-6 items-start">
        {/* main column */}
        <div className="flex min-w-0 flex-1 flex-col gap-4">
          <FileList entries={contents} isPending={contentsPending} />
          {readme && <ReadmeViewer readme={readme} />}
        </div>

        {/* sidebar */}
        <div className="w-64 flex-shrink-0 sticky top-6">
          <RepoAbout
            repo={repoData}
            languages={languages}
            languagesPending={languagesPending}
          />
        </div>
      </div>
    </div>
  );
}
