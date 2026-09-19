import {
  BroadcastIcon,
  GitCommitIcon,
  GitPullRequestIcon,
  IssueOpenedIcon,
  PlusIcon,
  RepoForkedIcon,
  StarIcon,
} from "@primer/octicons-react";
import { Link } from "@tanstack/react-router";
import { type ComponentType, useMemo } from "react";
import { Card } from "@/app/components/ui/card";
import { Skeleton, SkeletonGroup } from "@/app/components/ui/skeleton";
import { formatRelativeTime } from "@/app/lib/time";
import type { GitHubEvent } from "../schemas";
import { ProfileSectionHeader } from "./ProfileSectionHeader";

const MAX = 6;
const ACTIVITY_SKELETONS = [0, 1, 2, 3, 4];

export type ProfileLatestActivityProps = {
  events: GitHubEvent[] | undefined;
  isLoading: boolean;
};

type Item = {
  id: string;
  icon: ComponentType<{ className?: string }>;
  verb: string;
  owner: string;
  repo: string;
  iso: string;
  hue: "default" | "success" | "merged" | "warning";
};

/**
 * Compact event timeline — last few public events. Each row is a verb +
 * repo link + relative timestamp. Only visually important event types are
 * surfaced; everything else is collapsed silently.
 */
export function ProfileLatestActivity({ events, isLoading }: ProfileLatestActivityProps) {
  const items = useMemo(() => buildItems(events), [events]);

  return (
    <Card variant="muted" className="flex flex-col gap-3 px-4 py-4 sm:px-5 sm:py-5">
      <ProfileSectionHeader
        title="Latest Activity"
        icon={<BroadcastIcon className="size-3 text-(--color-fg-faint)" />}
      />

      {isLoading ? (
        <ActivitySkeleton />
      ) : items.length === 0 ? (
        <p className="py-2 text-center text-caption text-(--color-fg-faint)">
          No recent public events
        </p>
      ) : (
        <ul className="flex flex-col gap-2">
          {items.map((it) => (
            <ActivityRow key={it.id} item={it} />
          ))}
        </ul>
      )}
    </Card>
  );
}

function ActivityRow({ item }: { item: Item }) {
  const Icon = item.icon;
  return (
    <li className="flex min-w-0 items-center gap-2">
      <span className="shrink-0" style={{ color: hueColor(item.hue) }} aria-hidden="true">
        <Icon className="size-3.5" />
      </span>
      <span className="text-caption text-muted-foreground">{item.verb}</span>
      <Link
        to="/$owner/$repo"
        params={{ owner: item.owner, repo: item.repo }}
        className="min-w-0 truncate font-mono text-caption text-foreground transition-colors hover:text-[color:var(--color-brand)]"
        title={`${item.owner}/${item.repo}`}
      >
        {item.repo}
      </Link>
      <span className="ml-auto shrink-0 font-mono text-caption text-(--color-fg-faint) tabular-nums">
        {formatRelativeTime(item.iso)}
      </span>
    </li>
  );
}

function ActivitySkeleton() {
  return (
    <SkeletonGroup label="Loading activity"><ul className="flex flex-col gap-2">
      {ACTIVITY_SKELETONS.map((i) => (
        <li key={i} className="flex items-center gap-2">
          <Skeleton className="size-3.5 shrink-0 rounded-full" />
          <Skeleton className="h-3 w-12" />
          <Skeleton className="h-3 w-32" />
          <Skeleton className="ml-auto h-3 w-14" />
        </li>
      ))}
    </ul></SkeletonGroup>
  );
}

function hueColor(hue: Item["hue"]): string {
  switch (hue) {
    case "success":
      return "var(--color-success)";
    case "merged":
      return "var(--color-pr-merged)";
    case "warning":
      return "var(--color-warning)";
    default:
      return "var(--color-fg-faint)";
  }
}

function buildItems(events: GitHubEvent[] | undefined): Item[] {
  if (!events) return [];
  const out: Item[] = [];
  for (const ev of events) {
    if (out.length >= MAX) break;
    if (!ev.repo || !ev.created_at) continue;
    const [owner, repo] = ev.repo.name.split("/");
    if (!owner || !repo) continue;

    const item = describeEvent(ev, owner, repo);
    if (item) out.push(item);
  }
  return out;
}

function describeEvent(ev: GitHubEvent, owner: string, repo: string): Item | null {
  const id = ev.id;
  const iso = ev.created_at!;
  const payload = (ev.payload ?? {}) as Record<string, unknown>;
  const action = typeof payload.action === "string" ? payload.action : undefined;

  switch (ev.type) {
    case "PushEvent": {
      const commits = Array.isArray(payload.commits) ? (payload.commits as unknown[]) : [];
      return {
        id,
        icon: GitCommitIcon,
        verb: commits.length > 1 ? `Pushed ${commits.length}×` : "Pushed",
        owner,
        repo,
        iso,
        hue: "default",
      };
    }
    case "PullRequestEvent":
      return {
        id,
        icon: GitPullRequestIcon,
        verb: action === "opened" ? "Opened PR" : action === "closed" ? "Closed PR" : "PR",
        owner,
        repo,
        iso,
        hue: action === "closed" ? "merged" : "success",
      };
    case "IssuesEvent":
      return {
        id,
        icon: IssueOpenedIcon,
        verb: action === "opened" ? "Opened issue" : action === "closed" ? "Closed issue" : "Issue",
        owner,
        repo,
        iso,
        hue: action === "closed" ? "default" : "warning",
      };
    case "WatchEvent":
      return {
        id,
        icon: StarIcon,
        verb: "Starred",
        owner,
        repo,
        iso,
        hue: "warning",
      };
    case "ForkEvent":
      return {
        id,
        icon: RepoForkedIcon,
        verb: "Forked",
        owner,
        repo,
        iso,
        hue: "default",
      };
    case "CreateEvent": {
      const refType = typeof payload.ref_type === "string" ? payload.ref_type : "ref";
      return {
        id,
        icon: PlusIcon,
        verb: `Created ${refType}`,
        owner,
        repo,
        iso,
        hue: "success",
      };
    }
    case "ReleaseEvent":
      return {
        id,
        icon: PlusIcon,
        verb: action === "published" ? "Released" : "Release",
        owner,
        repo,
        iso,
        hue: "success",
      };
    case "PullRequestReviewEvent":
      return {
        id,
        icon: GitPullRequestIcon,
        verb: "Reviewed",
        owner,
        repo,
        iso,
        hue: "default",
      };
    default:
      return null;
  }
}
