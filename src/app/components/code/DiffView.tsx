import { Skeleton } from "@/app/components/ui/Skeleton";
import { CodeView } from "./CodeView";
import type { DiffLine } from "./types";
import { useCodeTokens } from "./useCodeTokens";

// ── LCS-based line diff ──────────────────────────────────────────────────────

function computeDiff(oldLines: string[], newLines: string[]): DiffLine[] {
  const m = oldLines.length;
  const n = newLines.length;

  // DP LCS table (bottom-up)
  const dp: number[][] = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(0));
  for (let i = m - 1; i >= 0; i--) {
    for (let j = n - 1; j >= 0; j--) {
      const row = dp[i];
      if (!row) continue;
      const match = oldLines[i] === newLines[j];
      row[j] = match
        ? (dp[i + 1]?.[j + 1] ?? 0) + 1
        : Math.max(dp[i + 1]?.[j] ?? 0, dp[i]?.[j + 1] ?? 0);
    }
  }

  const result: DiffLine[] = [];
  let i = 0;
  let j = 0;
  let oldNum = 1;
  let newNum = 1;

  while (i < m || j < n) {
    if (i < m && j < n && oldLines[i] === newLines[j]) {
      result.push({ kind: "context", oldNum, newNum, content: oldLines[i] ?? "" });
      i++;
      j++;
      oldNum++;
      newNum++;
    } else if (i >= m) {
      result.push({ kind: "added", newNum, content: newLines[j] ?? "" });
      j++;
      newNum++;
    } else if (j >= n) {
      result.push({ kind: "removed", oldNum, content: oldLines[i] ?? "" });
      i++;
      oldNum++;
    } else if ((dp[i + 1]?.[j] ?? 0) >= (dp[i]?.[j + 1] ?? 0)) {
      result.push({ kind: "removed", oldNum, content: oldLines[i] ?? "" });
      i++;
      oldNum++;
    } else {
      result.push({ kind: "added", newNum, content: newLines[j] ?? "" });
      j++;
      newNum++;
    }
  }

  return result;
}

// ── Component ────────────────────────────────────────────────────────────────

export type DiffViewProps = {
  oldCode: string;
  newCode: string;
  lang: string;
  className?: string;
};

export function DiffView({ oldCode, newCode, lang, className }: DiffViewProps) {
  const { data: oldTokens, isPending: oldPending } = useCodeTokens(oldCode, lang);
  const { data: newTokens, isPending: newPending } = useCodeTokens(newCode, lang);

  if (oldPending || newPending || !oldTokens || !newTokens) {
    return (
      <div className="flex flex-col gap-1.5 p-4">
        {Array.from({ length: 10 }).map((_, i) => (
          <Skeleton key={i} className="h-5" style={{ width: `${50 + (i * 13) % 45}%` }} />
        ))}
      </div>
    );
  }

  const oldLines = oldCode.split("\n");
  const newLines = newCode.split("\n");
  const diff = computeDiff(oldLines, newLines);

  // Build the merged token line array and decorations in lockstep with the diff
  const mergedLines: (typeof oldTokens)[number][] = [];
  const decorations: { kind: "context" | "added" | "removed"; oldNum?: number; newNum?: number }[] =
    [];

  let oldIdx = 0;
  let newIdx = 0;

  for (const d of diff) {
    if (d.kind === "removed") {
      mergedLines.push(oldTokens[oldIdx] ?? []);
      decorations.push({ kind: "removed", oldNum: d.oldNum });
      oldIdx++;
    } else if (d.kind === "added") {
      mergedLines.push(newTokens[newIdx] ?? []);
      decorations.push({ kind: "added", newNum: d.newNum });
      newIdx++;
    } else {
      mergedLines.push(newTokens[newIdx] ?? []);
      decorations.push({ kind: "context", oldNum: d.oldNum, newNum: d.newNum });
      oldIdx++;
      newIdx++;
    }
  }

  return (
    <CodeView
      lines={mergedLines}
      decorations={decorations}
      className={className}
    />
  );
}
