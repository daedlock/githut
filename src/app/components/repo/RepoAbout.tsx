import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  ExternalLink,
  GitFork,
  Globe,
  Info,
  Languages as LanguagesIcon,
  Scale,
  Tag,
  Users,
} from "lucide-react";
import { Avatar } from "@/app/components/ui/avatar";
import { Badge } from "@/app/components/ui/badge";
import { Card } from "@/app/components/ui/card";
import { Skeleton } from "@/app/components/ui/skeleton";
import { LanguageBar } from "@/app/components/repo/LanguageBar";
import { ProfileLink } from "@/app/components/user/ProfileLink";
import type { Contributor } from "@/app/hooks/useRepoContributors";
import type { LanguageShare } from "@/app/hooks/useRepoLanguages";
import type { Release } from "@/app/hooks/useRepoReleases";
import type { Repo } from "@/app/hooks/useRepo";
import { cn } from "@/app/lib/cn";

const SECTION_SPRING = { type: "spring" as const, stiffness: 540, damping: 30, mass: 0.5 };

export function RepoAbout({
  repo,
  languages,
  languagesPending,
  releases,
  releasesPending,
  contributors,
  contributorsPending,
}: {
  repo: Repo | undefined;
  languages: LanguageShare[] | undefined;
  languagesPending: boolean;
  releases: Release[] | undefined;
  releasesPending: boolean;
  contributors: Contributor[] | undefined;
  contributorsPending: boolean;
}) {
  return (
    <aside className="flex flex-col gap-3">
      <AboutCard repo={repo} />
      <ReleasesCard releases={releases} pending={releasesPending} repo={repo} />
      <ContributorsCard
        contributors={contributors}
        pending={contributorsPending}
        repo={repo}
      />
      <LanguagesCard languages={languages} pending={languagesPending} />
    </aside>
  );
}

// ─── About ────────────────────────────────────────────────────────────────

function AboutCard({ repo }: { repo: Repo | undefined }) {
  const parent = repo?.parent;
  return (
    <Card variant="muted" className="flex flex-col p-3">
      <SectionHeader icon={<Info className="size-3" />} title="About" />

      <div className="mt-2 flex flex-col gap-2">
        {repo ? (
          <>
            {repo.description && (
              <p className="text-caption leading-snug text-foreground">{repo.description}</p>
            )}

            {repo.homepage && (
              <a
                href={repo.homepage}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex min-w-0 items-center gap-1.5 text-caption text-primary transition-colors hover:text-[var(--color-accent-hover)]"
              >
                <Globe className="size-3 flex-shrink-0" />
                <span className="truncate">{repo.homepage.replace(/^https?:\/\//, "")}</span>
                <ExternalLink className="size-2.5 flex-shrink-0 opacity-60" />
              </a>
            )}

            {repo.topics.length > 0 && (
              <div className="flex flex-wrap gap-1">
                {repo.topics.map((t) => (
                  <Badge
                    key={t}
                    variant="secondary"
                    className="font-mono text-micro tracking-tight"
                  >
                    {t}
                  </Badge>
                ))}
              </div>
            )}

            {parent && (
              <a
                href={parent.html_url}
                target="_blank"
                rel="noopener noreferrer"
                className="group/forkrow flex min-w-0 items-center gap-1.5 text-caption text-muted-foreground hover:text-foreground transition-colors"
              >
                <GitFork className="size-3 flex-shrink-0 text-[var(--color-fg-faint)]" />
                <span className="flex-shrink-0">forked from</span>
                <span className="truncate text-foreground/85 group-hover/forkrow:underline underline-offset-2">
                  {parent.full_name}
                </span>
              </a>
            )}

            {repo.license && (
              <div className="flex items-center gap-1.5 text-caption text-muted-foreground">
                <Scale className="size-3 flex-shrink-0 text-[var(--color-fg-faint)]" />
                <span className="text-foreground/85">
                  {repo.license.spdx_id ?? repo.license.name}
                </span>
                <span>license</span>
              </div>
            )}
          </>
        ) : (
          <div className="flex flex-col gap-2">
            <Skeleton className="h-3 w-full" />
            <Skeleton className="h-3 w-4/5" />
            <Skeleton className="h-3 w-2/3" />
          </div>
        )}
      </div>
    </Card>
  );
}

// ─── Releases ─────────────────────────────────────────────────────────────

function ReleasesCard({
  releases,
  pending,
  repo,
}: {
  releases: Release[] | undefined;
  pending: boolean;
  repo: Repo | undefined;
}) {
  if (!pending && (!releases || releases.length === 0)) return null;

  const latest = releases?.[0];
  const rest = releases?.slice(1, 4) ?? [];

  return (
    <Card variant="muted" className="flex flex-col p-3">
      <SectionHeader
        icon={<Tag className="size-3" />}
        title="Releases"
        meta={releases ? releases.length.toString() : undefined}
        href={repo ? `https://github.com/${repo.full_name}/releases` : undefined}
      />

      <div className="mt-2">
        {pending && !releases ? (
          <div className="flex flex-col gap-1.5">
            <Skeleton className="h-3.5 w-3/5" />
            <Skeleton className="h-3 w-2/5" />
          </div>
        ) : latest ? (
          <div className="flex flex-col gap-1.5">
            <a
              href={latest.html_url}
              target="_blank"
              rel="noopener noreferrer"
              className="group/release -mx-1 flex flex-col gap-0.5 rounded-md px-1 py-0.5 transition-colors hover:bg-[color-mix(in_oklab,var(--color-bg-sunken)_70%,transparent)]"
            >
              <div className="flex min-w-0 items-center gap-1.5">
                <span className="inline-flex size-1.5 flex-shrink-0 rounded-full bg-[var(--color-success)]" />
                <span className="truncate font-mono text-caption text-foreground group-hover/release:underline underline-offset-2">
                  {latest.tag_name}
                </span>
                <span className="ml-auto flex-shrink-0 text-caption font-medium text-[var(--color-success)]">
                  Latest
                </span>
              </div>
              {latest.published_at && (
                <span className="text-caption text-muted-foreground">
                  {relativeTime(latest.published_at)}
                </span>
              )}
            </a>

            {rest.length > 0 && (
              <ul className="flex flex-col">
                {rest.map((r) => (
                  <li key={r.id}>
                    <a
                      href={r.html_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="group/r -mx-1 flex items-baseline justify-between gap-2 rounded-md px-1 py-0.5 transition-colors hover:bg-[color-mix(in_oklab,var(--color-bg-sunken)_70%,transparent)]"
                    >
                      <span className="truncate font-mono text-caption text-foreground/80 group-hover/r:underline underline-offset-2">
                        {r.tag_name}
                      </span>
                      {r.published_at && (
                        <span className="flex-shrink-0 text-caption text-muted-foreground">
                          {relativeTime(r.published_at)}
                        </span>
                      )}
                    </a>
                  </li>
                ))}
              </ul>
            )}
          </div>
        ) : null}
      </div>
    </Card>
  );
}

// ─── Contributors ─────────────────────────────────────────────────────────

const PER_ROW = 11; // overlapping avatars per line — tuned for w-64 sidebar with size-md avatars
const DEFAULT_ROWS = 2;

function ContributorsCard({
  contributors,
  pending,
  repo,
}: {
  contributors: Contributor[] | undefined;
  pending: boolean;
  repo: Repo | undefined;
}) {
  const [expanded, setExpanded] = useState(false);

  // Skip the entry animation on first paint. Once the list has been visible
  // once, subsequent mounts (e.g. user expands) DO animate in. We flip the
  // ref one tick after the first render with data so React's commit cycle
  // doesn't double-fire the animation.
  const hasShownRef = useRef(false);
  useEffect(() => {
    if (contributors && !hasShownRef.current) {
      // microtask delay so the first paint completes without animating
      const id = setTimeout(() => {
        hasShownRef.current = true;
      }, 0);
      return () => clearTimeout(id);
    }
  }, [contributors]);
  const animateEntry = hasShownRef.current;

  if (!pending && (!contributors || contributors.length === 0)) return null;

  const list = contributors ?? [];
  const collapsedLimit = PER_ROW * DEFAULT_ROWS;
  const hasOverflow = list.length > collapsedLimit;

  // When collapsed: show first (PER_ROW * DEFAULT_ROWS) - 1 contributors and
  // reserve the trailing slot for the "+N" pill so row 2 still feels "full".
  const visible = expanded
    ? list
    : hasOverflow
      ? list.slice(0, collapsedLimit - 1)
      : list;
  const remaining = list.length - (collapsedLimit - 1);

  // Chunk into rows so each row gets its own -space-x overlap. Wrapping a
  // single flex row breaks the negative margin between visual rows.
  const rows: Contributor[][] = [];
  for (let i = 0; i < visible.length; i += PER_ROW) {
    rows.push(visible.slice(i, i + PER_ROW));
  }

  return (
    <Card variant="muted" className="flex flex-col p-3">
      <SectionHeader
        icon={<Users className="size-3" />}
        title="Contributors"
        meta={
          contributors
            ? `${contributors.length}${contributors.length === 30 ? "+" : ""}`
            : undefined
        }
        href={repo ? `https://github.com/${repo.full_name}/graphs/contributors` : undefined}
      />

      <div className="mt-2">
        {pending && !contributors ? (
          <div className="flex -space-x-1">
            {Array.from({ length: 11 }).map((_, i) => (
              <Skeleton key={i} className="size-6 rounded-full ring-2 ring-(--color-bg-subtle)" />
            ))}
          </div>
        ) : (
          <motion.div layout transition={SECTION_SPRING} className="flex flex-col gap-3">
            {rows.map((row, rowIdx) => {
              const isLastVisibleRow = rowIdx === rows.length - 1;
              const showMorePill = !expanded && hasOverflow && isLastVisibleRow;
              return (
                <div key={rowIdx} className="flex -space-x-1">
                  <AnimatePresence initial={false}>
                    {row.map((c, i) => (
                      <motion.span
                        key={c.login ?? `anon-${rowIdx}-${i}`}
                        layout
                        initial={animateEntry ? { opacity: 0, scale: 0.5 } : false}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={animateEntry ? { opacity: 0, scale: 0.5 } : undefined}
                        transition={SECTION_SPRING}
                        className="relative"
                        style={{ zIndex: PER_ROW - i }}
                      >
                        {c.login && c.avatar_url ? (
                          <span
                            title={`${c.login} · ${c.contributions} commit${c.contributions === 1 ? "" : "s"}`}
                            className="contributor-avatar-wrap"
                          >
                            <ProfileLink login={c.login} className="block">
                              <Avatar
                                login={c.login}
                                avatarUrl={c.avatar_url}
                                size="md"
                                className="ring-2 ring-(--color-bg-subtle) transition-transform hover:scale-110"
                              />
                            </ProfileLink>
                            <span className="tint-overlay" />
                          </span>
                        ) : (
                          <span
                            title={`${c.contributions} commits (anonymous)`}
                            className="flex size-6 items-center justify-center rounded-full bg-[var(--color-bg-sunken)] font-mono text-micro text-muted-foreground ring-2 ring-(--color-bg-subtle)"
                          >
                            ?
                          </span>
                        )}
                      </motion.span>
                    ))}

                    {showMorePill && (
                      <motion.button
                        key="more"
                        layout
                        type="button"
                        onClick={() => setExpanded(true)}
                        initial={animateEntry ? { opacity: 0, scale: 0.5 } : false}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={animateEntry ? { opacity: 0, scale: 0.5 } : undefined}
                        transition={SECTION_SPRING}
                        className={cn(
                          "relative flex size-6 items-center justify-center rounded-full",
                          "bg-(--color-bg-sunken) text-foreground/85",
                          "ring-2 ring-(--color-bg-subtle)",
                          "font-mono text-[10px] font-medium tabular-nums",
                          "hover:bg-(--color-bg-sunken)/70 hover:text-foreground hover:scale-110 hover:z-10",
                          "transition-all outline-none focus-visible:ring-(--color-focus)",
                        )}
                        aria-label={`Show ${remaining} more contributors`}
                      >
                        +{remaining}
                      </motion.button>
                    )}
                  </AnimatePresence>
                </div>
              );
            })}

            {expanded && hasOverflow && (
              <button
                type="button"
                onClick={() => setExpanded(false)}
                className={cn(
                  "self-start text-caption font-medium text-muted-foreground",
                  "transition-colors hover:text-foreground",
                  "outline-none focus-visible:ring-1 focus-visible:ring-(--color-focus) rounded-sm",
                )}
              >
                Show less
              </button>
            )}
          </motion.div>
        )}
      </div>
    </Card>
  );
}

// ─── Languages ────────────────────────────────────────────────────────────

function LanguagesCard({
  languages,
  pending,
}: {
  languages: LanguageShare[] | undefined;
  pending: boolean;
}) {
  if (!pending && (!languages || languages.length === 0)) return null;
  return (
    <Card variant="muted" className="flex flex-col p-3">
      <SectionHeader icon={<LanguagesIcon className="size-3" />} title="Languages" />
      <div className="mt-2">
        {pending || !languages ? (
          <div className="flex flex-col gap-2">
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
    </Card>
  );
}

// ─── Shared bits ──────────────────────────────────────────────────────────

function SectionHeader({
  icon,
  title,
  meta,
  href,
}: {
  icon: React.ReactNode;
  title: string;
  meta?: string;
  href?: string;
}) {
  const inner = (
    <>
      <span className="text-muted-foreground">{icon}</span>
      <span className="flex-1 text-caption font-medium text-muted-foreground">{title}</span>
      {meta && (
        <span className="text-caption tabular-nums text-muted-foreground">{meta}</span>
      )}
    </>
  );
  if (href) {
    return (
      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        className="group/sec flex items-center gap-1.5 outline-none transition-colors hover:[&_*]:text-foreground focus-visible:rounded-sm focus-visible:ring-1 focus-visible:ring-[var(--color-focus)]"
      >
        {inner}
      </a>
    );
  }
  return <div className="flex items-center gap-1.5">{inner}</div>;
}

function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const secs = Math.floor(diff / 1000);
  if (secs < 60) return "just now";
  const mins = Math.floor(secs / 60);
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  const months = Math.floor(days / 30);
  if (months < 12) return `${months}mo ago`;
  return `${Math.floor(months / 12)}y ago`;
}
