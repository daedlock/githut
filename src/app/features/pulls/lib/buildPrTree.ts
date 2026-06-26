import type { PrBranchRefs, PrListItem } from "@/app/features/pulls/hooks";

// ─── Types ──────────────────────────────────────────────────────────────────

export type TreePosition = "root" | "first-child" | "middle-child" | "last-child" | "only-child";

export type PrTreeNode = {
  pr: PrListItem;
  depth: number;
  treePosition: TreePosition;
  /** Depths of ancestors that still have siblings below this node (need vertical continuation lines). */
  ancestorContinuations: number[];
};

// ─── Build tree ─────────────────────────────────────────────────────────────
//
// Detects stacked PRs by matching base/head branch refs among visible PRs.
// A PR is a child of another if its `baseRefName` equals the other's
// `headRefName` (and the base is not the repo's default branch).
//
// Returns a depth-first ordered list preserving original sort order among
// siblings. If no branch refs are loaded yet, returns a flat list (all
// depth 0, position "root") so the UI renders identically to before.

export function buildPrTree(
  prs: PrListItem[],
  branchRefs: Map<number, PrBranchRefs>,
  defaultBranch: string | undefined,
): PrTreeNode[] {
  // Graceful fallback: no refs loaded → flat list
  if (branchRefs.size === 0 || !defaultBranch) {
    return prs.map((pr) => ({
      pr,
      depth: 0,
      treePosition: "root" as const,
      ancestorContinuations: [],
    }));
  }

  // Build headRefName → PR number lookup (only for visible PRs with refs)
  const headToNumber = new Map<string, number>();
  for (const [number, refs] of branchRefs) {
    headToNumber.set(refs.headRefName, number);
  }

  // For each PR, determine its parent (if any) among visible PRs
  const parentOf = new Map<number, number>(); // child → parent
  const childrenOf = new Map<number, number[]>(); // parent → children (in original order)
  const prByNumber = new Map<number, PrListItem>();
  const originalOrder = new Map<number, number>(); // number → index

  for (let i = 0; i < prs.length; i++) {
    const pr = prs[i]!;
    prByNumber.set(pr.number, pr);
    originalOrder.set(pr.number, i);
  }

  for (const pr of prs) {
    const refs = branchRefs.get(pr.number);
    if (!refs) continue;
    if (refs.baseRefName === defaultBranch) continue;

    const parentNumber = headToNumber.get(refs.baseRefName);
    if (parentNumber === undefined) continue;
    if (!prByNumber.has(parentNumber)) continue;
    if (parentNumber === pr.number) continue; // self-reference guard

    parentOf.set(pr.number, parentNumber);
    const siblings = childrenOf.get(parentNumber) ?? [];
    siblings.push(pr.number);
    childrenOf.set(parentNumber, siblings);
  }

  // Sort children by their original position in the list
  for (const [, children] of childrenOf) {
    children.sort((a, b) => (originalOrder.get(a) ?? 0) - (originalOrder.get(b) ?? 0));
  }

  // Detect cycles: if following parent links leads back to the same node, break.
  const visited = new Set<number>();
  function hasCycle(start: number): boolean {
    visited.clear();
    let current: number | undefined = start;
    while (current !== undefined) {
      if (visited.has(current)) return true;
      visited.add(current);
      current = parentOf.get(current);
    }
    return false;
  }

  // Remove any nodes that participate in cycles
  for (const pr of prs) {
    if (hasCycle(pr.number)) {
      parentOf.delete(pr.number);
      for (const [parent, children] of childrenOf) {
        const idx = children.indexOf(pr.number);
        if (idx !== -1) {
          children.splice(idx, 1);
          if (children.length === 0) childrenOf.delete(parent);
        }
      }
    }
  }

  // Roots: PRs that have no parent (or parent not in visible set)
  const roots = prs.filter((pr) => !parentOf.has(pr.number));

  // DFS walk
  const result: PrTreeNode[] = [];

  function walk(number: number, depth: number, continuations: number[]) {
    const pr = prByNumber.get(number);
    if (!pr) return;

    const children = childrenOf.get(number) ?? [];
    const isRoot = depth === 0;

    if (isRoot) {
      result.push({
        pr,
        depth: 0,
        treePosition: "root",
        ancestorContinuations: [],
      });
    }

    for (let i = 0; i < children.length; i++) {
      const childNumber = children[i]!;
      const isFirst = i === 0;
      const isLast = i === children.length - 1;
      const isOnly = children.length === 1;

      const position: TreePosition = isOnly
        ? "only-child"
        : isFirst
          ? "first-child"
          : isLast
            ? "last-child"
            : "middle-child";

      // Continuation lines: pass down ancestor depths that still have siblings below
      const childContinuations = isLast
        ? continuations
        : [...continuations, depth];

      result.push({
        pr: prByNumber.get(childNumber)!,
        depth: depth + 1,
        treePosition: position,
        ancestorContinuations: childContinuations,
      });

      walk(childNumber, depth + 1, childContinuations);
    }
  }

  for (const root of roots) {
    walk(root.number, 0, []);
  }

  return result;
}
