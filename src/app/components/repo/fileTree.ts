import type { FileStatus } from "@/app/components/code";

/**
 * Pure tree model behind `ChangedFileTree`. Kept free of React so the
 * grouping, chain-collapsing, filtering, and per-directory rollups can be
 * unit-tested without rendering.
 */
export type ChangedFile = {
  filename: string;
  status: FileStatus;
  additions: number;
  deletions: number;
};

export type FileTreeFile = { type: "file"; path: string; name: string; file: ChangedFile };

export type FileTreeDir = {
  type: "dir";
  path: string;
  name: string;
  children: FileTreeNode[];
  /** Rolled up across every descendant file — not just direct children. */
  additions: number;
  deletions: number;
  fileCount: number;
};

export type FileTreeNode = FileTreeFile | FileTreeDir;

export function buildFileTree(files: ChangedFile[]): FileTreeNode[] {
  const root = makeDir("", "");

  for (const file of files) {
    const parts = file.filename.split("/");
    let cursor: FileTreeDir = root;
    for (let i = 0; i < parts.length - 1; i++) {
      const part = parts[i]!;
      let next = cursor.children.find((c): c is FileTreeDir => c.type === "dir" && c.name === part);
      if (!next) {
        next = makeDir(parts.slice(0, i + 1).join("/"), part);
        cursor.children.push(next);
      }
      cursor = next;
    }
    cursor.children.push({
      type: "file",
      path: file.filename,
      name: parts[parts.length - 1] ?? file.filename,
      file,
    });
  }

  collapseChains(root);
  sortTree(root);
  summarize(root);
  return root.children;
}

/**
 * Prune the tree to files whose path contains the query. Directories survive
 * iff at least one descendant file matches, and their rollups are recomputed
 * so a filtered folder only counts what is still visible beneath it.
 */
export function filterFileTree(nodes: FileTreeNode[], query: string): FileTreeNode[] {
  const out: FileTreeNode[] = [];
  for (const n of nodes) {
    if (n.type === "file") {
      if (n.file.filename.toLowerCase().includes(query) || n.name.toLowerCase().includes(query)) {
        out.push(n);
      }
      continue;
    }
    const kept = filterFileTree(n.children, query);
    if (kept.length > 0) {
      const dir: FileTreeDir = { ...n, children: kept };
      rollup(dir);
      out.push(dir);
    }
  }
  return out;
}

export function collectDirPaths(nodes: FileTreeNode[]): string[] {
  const out: string[] = [];
  walkFileTree(nodes, (n) => {
    if (n.type === "dir") out.push(n.path);
  });
  return out;
}

export function countFiles(nodes: FileTreeNode[]): number {
  let n = 0;
  walkFileTree(nodes, (node) => {
    if (node.type === "file") n++;
  });
  return n;
}

export function walkFileTree(nodes: FileTreeNode[], visit: (n: FileTreeNode) => void): void {
  for (const n of nodes) {
    visit(n);
    if (n.type === "dir") walkFileTree(n.children, visit);
  }
}

// ─── Internals ──────────────────────────────────────────────────────────────

function makeDir(path: string, name: string): FileTreeDir {
  return { type: "dir", path, name, children: [], additions: 0, deletions: 0, fileCount: 0 };
}

/** Merge `a/` → `b/` → file chains into a single `a/b` row, like VS Code's compact folders. */
function collapseChains(dir: FileTreeDir): void {
  for (const child of dir.children) {
    if (child.type === "dir") collapseChains(child);
  }
  let i = 0;
  while (i < dir.children.length) {
    const c = dir.children[i]!;
    if (c.type === "dir" && c.children.length === 1 && c.children[0]!.type === "dir") {
      const only = c.children[0] as FileTreeDir;
      dir.children[i] = { ...only, name: `${c.name}/${only.name}` };
      continue;
    }
    i++;
  }
}

function sortTree(dir: FileTreeDir): void {
  dir.children.sort((a, b) => {
    if (a.type !== b.type) return a.type === "dir" ? -1 : 1;
    return a.name.localeCompare(b.name);
  });
  for (const child of dir.children) {
    if (child.type === "dir") sortTree(child);
  }
}

/** Post-order pass so every directory's rollup is final before its parent sums it. */
function summarize(dir: FileTreeDir): void {
  for (const child of dir.children) {
    if (child.type === "dir") summarize(child);
  }
  rollup(dir);
}

/** Sum direct children only — child directories must already carry their own rollups. */
function rollup(dir: FileTreeDir): void {
  let additions = 0;
  let deletions = 0;
  let fileCount = 0;
  for (const child of dir.children) {
    if (child.type === "dir") {
      additions += child.additions;
      deletions += child.deletions;
      fileCount += child.fileCount;
    } else {
      additions += child.file.additions;
      deletions += child.file.deletions;
      fileCount += 1;
    }
  }
  dir.additions = additions;
  dir.deletions = deletions;
  dir.fileCount = fileCount;
}
