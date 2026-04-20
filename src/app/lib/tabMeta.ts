import {
  CircleDot,
  Code2,
  FileText,
  GitCommitHorizontal,
  GitPullRequest,
  Home,
  type LucideIcon,
  Play,
  Settings,
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
    meta: () => ({ label: "Home", icon: Home }),
  },
  {
    match: /^\/settings$/,
    meta: () => ({ label: "Settings", icon: Settings }),
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
    match: /^\/(?<owner>[^/]+)\/(?<repo>[^/]+)\/pulls\/(?<number>\d+)$/,
    meta: (g) => ({
      label: `PR #${g.number}`,
      sublabel: `${g.owner}/${g.repo}`,
      icon: GitPullRequest,
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
