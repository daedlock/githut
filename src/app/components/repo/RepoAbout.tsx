import { ExternalLink, GitFork, Globe, Scale, Star } from "lucide-react";
import { Badge } from "@/app/components/ui/Badge";
import { Skeleton } from "@/app/components/ui/Skeleton";
import { LanguageBar } from "@/app/components/repo/LanguageBar";
import type { LanguageShare } from "@/app/hooks/useRepoLanguages";
import type { Repo } from "@/app/hooks/useRepo";

export function RepoAbout({
  repo,
  languages,
  languagesPending,
}: {
  repo: Repo | undefined;
  languages: LanguageShare[] | undefined;
  languagesPending: boolean;
}) {
  return (
    <aside className="flex flex-col gap-5">
      <div className="flex flex-col gap-3">
        <h3 className="font-mono text-ui font-medium uppercase tracking-widest text-[var(--color-fg-muted)]">
          About
        </h3>

        {repo ? (
          <>
            {repo.description && (
              <p className="text-body text-[var(--color-fg)] leading-relaxed">{repo.description}</p>
            )}

            {repo.homepage && (
              <a
                href={repo.homepage}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 text-body text-[var(--color-accent)] hover:text-[var(--color-accent-hover)] transition-colors duration-75"
              >
                <Globe className="h-3.5 w-3.5 flex-shrink-0" />
                <span className="truncate">{repo.homepage.replace(/^https?:\/\//, "")}</span>
                <ExternalLink className="h-3 w-3 flex-shrink-0 opacity-60" />
              </a>
            )}

            {repo.topics.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {repo.topics.map((t) => (
                  <Badge key={t}>{t}</Badge>
                ))}
              </div>
            )}
          </>
        ) : (
          <div className="flex flex-col gap-2">
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-3/4" />
          </div>
        )}
      </div>

      <div className="border-t border-[var(--color-border)] pt-4 flex flex-col gap-2">
        <StatRow
          icon={<Star className="h-3.5 w-3.5" />}
          label="Stars"
          value={repo ? formatCount(repo.stargazers_count) : undefined}
        />
        <StatRow
          icon={<GitFork className="h-3.5 w-3.5" />}
          label="Forks"
          value={repo ? formatCount(repo.forks_count) : undefined}
        />
        {repo?.license && (
          <StatRow
            icon={<Scale className="h-3.5 w-3.5" />}
            label="License"
            value={repo.license.spdx_id ?? repo.license.name}
          />
        )}
      </div>

      {(languages && languages.length > 0) || languagesPending ? (
        <div className="border-t border-[var(--color-border)] pt-4 flex flex-col gap-2">
          <h3 className="font-mono text-ui font-medium uppercase tracking-widest text-[var(--color-fg-muted)]">
            Languages
          </h3>
          {languagesPending || !languages ? (
            <div className="flex flex-col gap-3">
              <Skeleton className="h-2 w-full rounded-full" />
              <div className="flex flex-wrap gap-x-3 gap-y-1.5">
                {Array.from({ length: 3 }).map((_, i) => (
                  <Skeleton key={i} className="h-3 w-20" />
                ))}
              </div>
            </div>
          ) : (
            <LanguageBar languages={languages} />
          )}
        </div>
      ) : null}
    </aside>
  );
}

function StatRow({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string | undefined;
}) {
  return (
    <div className="flex items-center gap-2 text-body text-[var(--color-fg-muted)]">
      <span className="text-[var(--color-fg-faint)]">{icon}</span>
      {value !== undefined ? (
        <>
          <span className="font-mono text-[var(--color-fg)] text-ui tabular-nums">{value}</span>
          <span className="text-ui">{label}</span>
        </>
      ) : (
        <Skeleton className="h-3.5 w-16" />
      )}
    </div>
  );
}

function formatCount(n: number): string {
  if (n >= 1000) return `${(n / 1000).toFixed(1)}k`;
  return String(n);
}
