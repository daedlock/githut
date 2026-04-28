import { queryOptions, useQuery } from "@tanstack/react-query";
import { z } from "zod";
import { parseUnifiedDiff } from "@/app/components/code";
import { CommitListSchema, type CommitSummary } from "@/app/hooks/useRepoCommits";
import { getGitHubClient } from "@/app/lib/github/client";
import { useAuthStore } from "@/app/stores/auth";

const MAX_BLAME_COMMITS = 100;
const BLAME_COMMITS_PER_PAGE = 100;

const MaybeGitHubUserSchema = z
  .object({
    login: z.string(),
    avatar_url: z.string(),
  })
  .nullable();

const CommitDetailForBlameSchema = z.object({
  sha: z.string(),
  commit: z.object({
    author: z.object({
      name: z.string(),
      email: z.string(),
      date: z.string(),
    }),
    message: z.string(),
  }),
  author: MaybeGitHubUserSchema,
  files: z
    .array(
      z.object({
        filename: z.string(),
        previous_filename: z.string().optional(),
        status: z.string(),
        patch: z.string().nullish(),
      }),
    )
    .default([]),
});

type CommitDetailForBlame = z.infer<typeof CommitDetailForBlameSchema>;

export type BlameRange = {
  startingLine: number;
  endingLine: number;
  age: number;
  commit: {
    oid: string;
    abbreviatedOid: string;
    messageHeadline: string;
    committedDate: string;
    author: {
      name?: string | null;
      email?: string | null;
      user?: {
        login: string;
        avatarUrl?: string;
      } | null;
    };
  };
};

export type RepoBlame = {
  ranges: BlameRange[];
  isPartial: boolean;
};

type LineRecord = {
  headLine: number;
  trackedLine: number;
};

export const repoBlameQueryOptions = (
  owner: string,
  repo: string,
  path: string,
  ref: string,
  lineCount: number,
) =>
  queryOptions({
    queryKey: ["repo-blame", owner, repo, path, ref, lineCount] as const,
    staleTime: 5 * 60_000,
    queryFn: async (): Promise<RepoBlame> => {
      if (lineCount <= 0) return { ranges: [], isPartial: false };

      const client = getGitHubClient();
      const commitsRes = await client.request("GET /repos/{owner}/{repo}/commits", {
        owner,
        repo,
        sha: ref,
        path,
        per_page: BLAME_COMMITS_PER_PAGE,
        page: 1,
      });
      const commits = CommitListSchema.parse(commitsRes.data).slice(0, MAX_BLAME_COMMITS);
      if (commits.length === 0) return { ranges: [], isPartial: false };

      const details = await mapLimit(commits, 8, async (commit) => {
        const res = await client.request("GET /repos/{owner}/{repo}/commits/{ref}", {
          owner,
          repo,
          ref: commit.sha,
        });
        return CommitDetailForBlameSchema.parse(res.data);
      });

      return computeBlame(path, lineCount, commits, details);
    },
  });

export function useRepoBlame(
  owner: string,
  repo: string,
  path: string,
  ref: string | undefined,
  lineCount: number,
) {
  const token = useAuthStore((s) => s.token);
  return useQuery({
    ...repoBlameQueryOptions(owner, repo, path, ref ?? "", lineCount),
    enabled: !!token && !!owner && !!repo && !!path && !!ref && lineCount > 0,
  });
}

function computeBlame(
  initialPath: string,
  lineCount: number,
  commits: CommitSummary[],
  details: CommitDetailForBlame[],
): RepoBlame {
  let currentPath = initialPath;
  let records: LineRecord[] = Array.from({ length: lineCount }, (_, index) => ({
    headLine: index + 1,
    trackedLine: index + 1,
  }));
  const assigned = new Map<number, BlameRange["commit"]>();
  let lastCommit: BlameRange["commit"] | undefined;

  for (let i = 0; i < details.length && records.length > 0; i++) {
    const detail = details[i]!;
    const commit = toBlameCommit(detail);
    lastCommit = commit;

    const changedFile = detail.files.find(
      (file) => file.filename === currentPath || file.previous_filename === currentPath,
    );
    if (!changedFile) continue;

    if (changedFile.status === "added" || !changedFile.patch) {
      for (const record of records) assigned.set(record.headLine, commit);
      records = [];
    } else {
      const lineMap = buildNewToOldLineMap(changedFile.patch);
      const nextRecords: LineRecord[] = [];

      for (const record of records) {
        if (lineMap.addedLines.has(record.trackedLine)) {
          assigned.set(record.headLine, commit);
          continue;
        }

        const oldLine = lineMap.mapLine(record.trackedLine);
        if (oldLine) nextRecords.push({ ...record, trackedLine: oldLine });
        else assigned.set(record.headLine, commit);
      }

      records = nextRecords;
    }

    if (changedFile.previous_filename && changedFile.status === "renamed") {
      currentPath = changedFile.previous_filename;
    }
  }

  if (lastCommit) {
    for (const record of records) assigned.set(record.headLine, lastCommit);
  }

  return {
    ranges: buildRanges(assigned, lineCount),
    isPartial: commits.length >= MAX_BLAME_COMMITS,
  };
}

function buildNewToOldLineMap(patch: string) {
  const hunks = parseUnifiedDiff(patch);
  const addedLines = new Set<number>();
  const explicit = new Map<number, number>();

  for (const hunk of hunks) {
    for (const line of hunk.lines) {
      if (line.kind === "add" && line.newNum) addedLines.add(line.newNum);
      if (line.kind === "context" && line.newNum && line.oldNum)
        explicit.set(line.newNum, line.oldNum);
    }
  }

  function mapLine(newLine: number): number | undefined {
    const direct = explicit.get(newLine);
    if (direct) return direct;

    let oldLine = newLine;
    for (const hunk of hunks) {
      const hunkNewEnd = hunk.newStart + Math.max(hunk.newLines, 1) - 1;
      if (newLine < hunk.newStart) break;
      if (newLine <= hunkNewEnd) return undefined;
      oldLine += hunk.oldLines - hunk.newLines;
    }
    return oldLine;
  }

  return { addedLines, mapLine };
}

function buildRanges(assigned: Map<number, BlameRange["commit"]>, lineCount: number): BlameRange[] {
  const ranges: BlameRange[] = [];
  let current: BlameRange | null = null;

  for (let line = 1; line <= lineCount; line++) {
    const commit = assigned.get(line);
    if (!commit) continue;

    if (current && current.commit.oid === commit.oid && current.endingLine === line - 1) {
      current.endingLine = line;
      continue;
    }

    current = {
      startingLine: line,
      endingLine: line,
      age: 0,
      commit,
    };
    ranges.push(current);
  }

  return ranges;
}

function toBlameCommit(detail: CommitDetailForBlame): BlameRange["commit"] {
  return {
    oid: detail.sha,
    abbreviatedOid: detail.sha.slice(0, 7),
    messageHeadline: detail.commit.message.split("\n", 1)[0] ?? detail.commit.message,
    committedDate: detail.commit.author.date,
    author: {
      name: detail.commit.author.name,
      email: detail.commit.author.email,
      user: detail.author
        ? {
            login: detail.author.login,
            avatarUrl: detail.author.avatar_url,
          }
        : null,
    },
  };
}

async function mapLimit<T, R>(
  items: T[],
  limit: number,
  mapper: (item: T, index: number) => Promise<R>,
): Promise<R[]> {
  const out = new Array<R>(items.length);
  let cursor = 0;

  async function worker() {
    while (cursor < items.length) {
      const index = cursor;
      cursor++;
      out[index] = await mapper(items[index]!, index);
    }
  }

  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, () => worker()));
  return out;
}
