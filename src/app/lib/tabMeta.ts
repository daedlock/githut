import {
  CircleDot,
  Code2,
  FileText,
  GitCommitHorizontal,
  GitPullRequest,
  Inbox,
  type LucideIcon,
  Play,
  Settings,
  User,
} from "lucide-react";

export type TabMeta = {
  label: string;
  sublabel?: string;
  icon: LucideIcon;
};

/** Regex named groups — values guaranteed to exist by the matched pattern. */
type CaptureGroups = { [key: string]: string };

type PatternRule = {
  match: RegExp;
  meta: (g: CaptureGroups) => TabMeta;
};

/**
 * Ordered list of URL patterns → tab metadata. First match wins.
 * Uses named capture groups for readability.
 *
 * To support a new route, add a rule here. Unknown URLs fall through
 * to the default (last segment as label, generic file icon).
 */
const RULES: PatternRule[] = [
  {
    match: /^\/$/,
    meta: () => ({ label: "Inbox", icon: Inbox }),
  },
  {
    match: /^\/settings$/,
    meta: () => ({ label: "Settings", icon: Settings }),
  },
  {
    match: /^\/login$/,
    meta: () => ({ label: "Sign In", icon: User }),
  },
  {
    match: /^\/playground$/,
    meta: () => ({ label: "Playground", icon: Code2 }),
  },
  {
    match: /^\/(?<owner>[^/]+)\/(?<repo>[^/]+)\/code$/,
    meta: (g) => ({ label: "Code", sublabel: `${g.owner}/${g.repo}`, icon: Code2 }),
  },
  {
    match: /^\/(?<owner>[^/]+)\/(?<repo>[^/]+)\/issues$/,
    meta: (g) => ({ label: "Issues", sublabel: `${g.owner}/${g.repo}`, icon: CircleDot }),
  },
  {
    match: /^\/(?<owner>[^/]+)\/(?<repo>[^/]+)\/pulls$/,
    meta: (g) => ({ label: "PRs", sublabel: `${g.owner}/${g.repo}`, icon: GitPullRequest }),
  },
  {
    match: /^\/(?<owner>[^/]+)\/(?<repo>[^/]+)\/pr\/(?<number>\d+)(?:\/.*)?$/,
    meta: (g) => ({
      label: `PR #${g.number}`,
      sublabel: `${g.owner}/${g.repo}`,
      icon: GitPullRequest,
    }),
  },
  {
    match: /^\/(?<owner>[^/]+)\/(?<repo>[^/]+)\/pull\/(?<number>\d+)(?:\/.*)?$/,
    meta: (g) => ({
      label: `PR #${g.number}`,
      sublabel: `${g.owner}/${g.repo}`,
      icon: GitPullRequest,
    }),
  },
  {
    match: /^\/(?<owner>[^/]+)\/(?<repo>[^/]+)\/review\/(?<number>\d+)$/,
    meta: (g) => ({
      label: `Review #${g.number}`,
      sublabel: `${g.owner}/${g.repo}`,
      icon: GitPullRequest,
    }),
  },
  {
    match: /^\/(?<owner>[^/]+)\/(?<repo>[^/]+)\/issues\/(?<number>\d+)$/,
    meta: (g) => ({
      label: `Issue #${g.number}`,
      sublabel: `${g.owner}/${g.repo}`,
      icon: CircleDot,
    }),
  },
  {
    match: /^\/(?<owner>[^/]+)\/(?<repo>[^/]+)\/commits$/,
    meta: (g) => ({
      label: "Commits",
      sublabel: `${g.owner}/${g.repo}`,
      icon: GitCommitHorizontal,
    }),
  },
  {
    match: /^\/(?<owner>[^/]+)\/(?<repo>[^/]+)\/commit\/(?<sha>[^/]+)$/,
    meta: (g) => ({
      label: g.sha?.slice(0, 7) ?? "commit",
      sublabel: `${g.owner}/${g.repo}`,
      icon: GitCommitHorizontal,
    }),
  },
  {
    match: /^\/(?<owner>[^/]+)\/(?<repo>[^/]+)\/actions$/,
    meta: (g) => ({ label: "Actions", sublabel: `${g.owner}/${g.repo}`, icon: Play }),
  },
  {
    match: /^\/(?<owner>[^/]+)\/(?<repo>[^/]+)\/actions\/runs\/(?<runId>[^/]+)$/,
    meta: (g) => ({
      label: `Run #${g.runId}`,
      sublabel: `${g.owner}/${g.repo}`,
      icon: Play,
    }),
  },
  {
    match: /^\/(?<owner>[^/]+)\/(?<repo>[^/]+)$/,
    meta: (g) => ({ label: g.repo!, sublabel: `${g.owner}/${g.repo}`, icon: Code2 }),
  },
  {
    match: /^\/(?<username>[^/]+)$/,
    meta: (g) => ({ label: `@${g.username}`, icon: User }),
  },
];

/**
 * Derive display metadata for a tab from its pathname.
 * First matching rule wins. Falls back to last path segment + generic icon.
 */
export function getTabMeta(pathname: string): TabMeta {
  for (const rule of RULES) {
    const m = rule.match.exec(pathname);
    if (m) {
      return rule.meta((m.groups ?? {}) as Record<string, string>);
    }
  }
  // Fallback: use the last segment of the path as the label.
  const segments = pathname.split("/").filter(Boolean);
  return {
    label: segments[segments.length - 1] ?? pathname,
    icon: FileText,
  };
}

export function getDocumentTitle(pathname: string): string {
  const meta = getTabMeta(pathname);
  return meta.sublabel ? `${meta.label} · ${meta.sublabel} · GitHut` : `${meta.label} · GitHut`;
}

/** The repo (`owner/name`) a page belongs to, or undefined for app-wide pages. */
export function tabRepo(pathname: string): string | undefined {
  return getTabMeta(pathname).sublabel;
}

export type RepoSection = "code" | "commits" | "pulls" | "issues" | "actions";

/** Which repo section a page sits in — PR detail pages count as PRs, etc. */
export function tabSection(pathname: string): RepoSection | null {
  if (!tabRepo(pathname)) return null;
  const rest = /^\/[^/]+\/[^/]+(\/[^/]+)?/.exec(pathname)?.[1] ?? "";
  switch (rest) {
    case "":
    case "/code":
      return "code";
    case "/commits":
    case "/commit":
      return "commits";
    case "/pulls":
    case "/pull":
    case "/pr":
    case "/review":
      return "pulls";
    case "/issues":
      return "issues";
    case "/actions":
      return "actions";
    default:
      return null;
  }
}
