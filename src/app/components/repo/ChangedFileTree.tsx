import { ChevronDown, ChevronRight, FoldVertical, Search, UnfoldVertical, X } from "lucide-react";
import { Fragment, useCallback, useEffect, useMemo, useState } from "react";
import type { FileStatus } from "@/app/components/code";
import { FileIcon } from "@/app/components/repo/FileIcon";
import { Input } from "@/app/components/ui/Input";
import { cn } from "@/app/lib/cn";

/**
 * Reusable file-tree sidebar. Designed to drop into any surface that lists
 * paths with metadata — commit diff, PR diff, search results, etc. The shape
 * is minimal so callers don't have to pre-transform data.
 */
export type ChangedFile = {
  filename: string;
  status: FileStatus;
  additions: number;
  deletions: number;
};

export type ChangedFileTreeProps = {
  files: ChangedFile[];
  /** Called with the filename when the user clicks a file row. */
  onFileClick?: (filename: string) => void;
  /** Filename of the currently-focused file in the viewport, for highlight. */
  activeFile?: string;
  /** Header title — default "Changed files". */
  title?: string;
  /** Show the search input. Default true. */
  showSearch?: boolean;
  /** Show expand-all / collapse-all buttons. Default true. */
  showExpandControls?: boolean;
  /** Initial expansion — "all" (default), "none", or "top" (only top-level dirs). */
  initialExpanded?: "all" | "none" | "top";
  className?: string;
};

export function ChangedFileTree({
  files,
  onFileClick,
  activeFile,
  title = "Changed files",
  showSearch = true,
  showExpandControls = true,
  initialExpanded = "all",
  className,
}: ChangedFileTreeProps) {
  const tree = useMemo(() => buildTree(files), [files]);
  const allDirPaths = useMemo(() => collectDirPaths(tree), [tree]);
  const topDirPaths = useMemo(
    () => tree.filter((n): n is DirNode => n.type === "dir").map((n) => n.path),
    [tree],
  );

  const [expanded, setExpanded] = useState<Set<string>>(() =>
    initialExpand(initialExpanded, allDirPaths, topDirPaths),
  );
  const [query, setQuery] = useState("");

  // Keep the expand set in sync when the file list changes — if a file set
  // shrinks, stale paths linger harmlessly but we also add any new top-level
  // dirs if we started "all" or "top".
  useEffect(() => {
    if (initialExpanded === "none") return;
    setExpanded((prev) => {
      const next = new Set(prev);
      const paths = initialExpanded === "all" ? allDirPaths : topDirPaths;
      for (const p of paths) next.add(p);
      return next;
    });
  }, [allDirPaths, topDirPaths, initialExpanded]);

  const trimmedQuery = query.trim().toLowerCase();
  const filteredTree = useMemo(
    () => (trimmedQuery ? filterTree(tree, trimmedQuery) : tree),
    [tree, trimmedQuery],
  );

  // Search mode auto-expands every remaining directory so the user can scan
  // all matches at once — otherwise typing would need an extra click to see
  // the file. Persist the pre-search expanded set; restore when cleared.
  const effectiveExpanded = useMemo(() => {
    if (!trimmedQuery) return expanded;
    return new Set(collectDirPaths(filteredTree));
  }, [expanded, trimmedQuery, filteredTree]);

  const toggle = useCallback((path: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(path)) next.delete(path);
      else next.add(path);
      return next;
    });
  }, []);

  const expandAll = useCallback(() => setExpanded(new Set(allDirPaths)), [allDirPaths]);
  const collapseAll = useCallback(() => setExpanded(new Set()), []);

  const totals = useMemo(() => {
    let additions = 0;
    let deletions = 0;
    for (const f of files) {
      additions += f.additions;
      deletions += f.deletions;
    }
    return { additions, deletions };
  }, [files]);

  const visibleFileCount = useMemo(() => {
    if (!trimmedQuery) return files.length;
    let n = 0;
    walk(filteredTree, (node) => {
      if (node.type === "file") n++;
    });
    return n;
  }, [filteredTree, files.length, trimmedQuery]);

  return (
    <aside
      className={cn(
        "overflow-hidden rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-bg)]",
        className,
      )}
    >
      {/* Header */}
      <header className="flex items-center justify-between gap-2 border-b border-[var(--color-border)] bg-[var(--color-bg-subtle)] px-3 py-2">
        <span className="font-mono text-[11px] font-medium uppercase tracking-widest text-[var(--color-fg-muted)]">
          {title}
        </span>
        <span className="font-mono text-[11px] tabular-nums text-[var(--color-fg-faint)]">
          {trimmedQuery ? `${visibleFileCount} / ${files.length}` : files.length}
        </span>
      </header>

      {/* Search + expand controls */}
      {(showSearch || showExpandControls) && (
        <div className="flex items-center gap-1.5 border-b border-[var(--color-border)] px-2 py-1.5">
          {showSearch && (
            <div className="relative flex-1">
              <Search className="pointer-events-none absolute left-2 top-1/2 h-3 w-3 -translate-y-1/2 text-[var(--color-fg-faint)]" />
              <Input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Filter files"
                className="h-7 pl-6 pr-6 text-[12px]"
              />
              {query && (
                <button
                  type="button"
                  onClick={() => setQuery("")}
                  className="absolute right-1.5 top-1/2 -translate-y-1/2 rounded p-0.5 text-[var(--color-fg-faint)] hover:bg-[var(--color-bg-sunken)] hover:text-[var(--color-fg)]"
                  aria-label="Clear filter"
                >
                  <X className="h-3 w-3" />
                </button>
              )}
            </div>
          )}
          {showExpandControls && allDirPaths.length > 0 && (
            <div className="flex items-center">
              <IconBtn
                onClick={expandAll}
                title="Expand all"
                disabled={!!trimmedQuery}
              >
                <UnfoldVertical className="h-3 w-3" />
              </IconBtn>
              <IconBtn
                onClick={collapseAll}
                title="Collapse all"
                disabled={!!trimmedQuery}
              >
                <FoldVertical className="h-3 w-3" />
              </IconBtn>
            </div>
          )}
        </div>
      )}

      {/* Tree body */}
      <div className="p-1.5 text-[13px]">
        <div className="mb-1 flex items-center gap-2 px-2 py-1 font-mono text-[12px] tabular-nums">
          <span className="text-[var(--diff-add-marker)]">+{totals.additions}</span>
          <span className="text-[var(--diff-del-marker)]">−{totals.deletions}</span>
        </div>

        {visibleFileCount === 0 ? (
          <div className="px-2 py-6 text-center font-mono text-[11px] uppercase tracking-widest text-[var(--color-fg-faint)]">
            {trimmedQuery ? "No matches" : "No files"}
          </div>
        ) : (
          filteredTree.map((node, i) => (
            <TreeNode
              key={i}
              node={node}
              depth={0}
              expanded={effectiveExpanded}
              onToggle={toggle}
              onFileClick={onFileClick}
              activeFile={activeFile}
            />
          ))
        )}
      </div>
    </aside>
  );
}

// ─── Tree rendering ─────────────────────────────────────────────────────────

function TreeNode({
  node,
  depth,
  expanded,
  onToggle,
  onFileClick,
  activeFile,
}: {
  node: Node;
  depth: number;
  expanded: Set<string>;
  onToggle: (path: string) => void;
  onFileClick?: (filename: string) => void;
  activeFile?: string;
}) {
  if (node.type === "file") {
    return (
      <FileRow
        file={node.file}
        depth={depth}
        onClick={onFileClick}
        isActive={activeFile === node.path}
      />
    );
  }
  const isOpen = expanded.has(node.path);
  return (
    <>
      <DirRow
        node={node}
        depth={depth}
        isOpen={isOpen}
        onToggle={() => onToggle(node.path)}
      />
      {isOpen &&
        node.children.map((child, i) => (
          <Fragment key={i}>
            <TreeNode
              node={child}
              depth={depth + 1}
              expanded={expanded}
              onToggle={onToggle}
              onFileClick={onFileClick}
              activeFile={activeFile}
            />
          </Fragment>
        ))}
    </>
  );
}

function DirRow({
  node,
  depth,
  isOpen,
  onToggle,
}: {
  node: DirNode;
  depth: number;
  isOpen: boolean;
  onToggle: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onToggle}
      className="flex w-full items-center gap-1.5 rounded-[var(--radius-xs)] px-2 py-1.5 text-left transition-colors hover:bg-[var(--color-bg-subtle)]"
      style={{ paddingLeft: `${depth * 12 + 8}px` }}
    >
      {isOpen ? (
        <ChevronDown className="h-3.5 w-3.5 flex-shrink-0 text-[var(--color-fg-faint)]" />
      ) : (
        <ChevronRight className="h-3.5 w-3.5 flex-shrink-0 text-[var(--color-fg-faint)]" />
      )}
      <span className="truncate font-mono text-[var(--color-fg-muted)]">{node.name}</span>
    </button>
  );
}

function FileRow({
  file,
  depth,
  onClick,
  isActive,
}: {
  file: ChangedFile;
  depth: number;
  onClick?: (filename: string) => void;
  isActive?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={() => onClick?.(file.filename)}
      className={cn(
        "flex w-full items-center gap-2 rounded-[var(--radius-xs)] px-2 py-1.5 text-left transition-colors",
        isActive
          ? "bg-[var(--color-bg-sunken)] text-[var(--color-fg)]"
          : "hover:bg-[var(--color-bg-subtle)] text-[var(--color-fg)]",
      )}
      style={{ paddingLeft: `${depth * 12 + 8}px` }}
      title={file.filename}
    >
      <FileIcon filename={file.filename} />
      <StatusGlyph status={file.status} />
      <span className="min-w-0 flex-1 truncate font-mono">{basename(file.filename)}</span>
      <FileStats additions={file.additions} deletions={file.deletions} />
    </button>
  );
}

function IconBtn({
  onClick,
  title,
  disabled,
  children,
}: {
  onClick: () => void;
  title: string;
  disabled?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      disabled={disabled}
      className="inline-flex h-6 w-6 items-center justify-center rounded-[var(--radius-xs)] text-[var(--color-fg-faint)] transition-colors hover:bg-[var(--color-bg-subtle)] hover:text-[var(--color-fg)] disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-transparent disabled:hover:text-[var(--color-fg-faint)]"
    >
      {children}
    </button>
  );
}

function StatusGlyph({ status }: { status: FileStatus }) {
  const glyph =
    status === "added" ? "A" : status === "removed" ? "D" : status === "renamed" ? "R" : "M";
  const tone =
    status === "added"
      ? "text-[var(--diff-add-marker)]"
      : status === "removed"
        ? "text-[var(--diff-del-marker)]"
        : status === "renamed"
          ? "text-[var(--color-accent)]"
          : "text-[var(--color-fg-faint)]";
  return (
    <span
      className={cn("flex-shrink-0 font-mono text-[11px] font-semibold uppercase w-3 text-center", tone)}
      aria-label={status}
    >
      {glyph}
    </span>
  );
}

function FileStats({ additions, deletions }: { additions: number; deletions: number }) {
  if (additions === 0 && deletions === 0) return null;
  return (
    <span className="flex-shrink-0 font-mono text-[11px] tabular-nums">
      {additions > 0 && <span className="text-[var(--diff-add-marker)]">+{additions}</span>}
      {additions > 0 && deletions > 0 && " "}
      {deletions > 0 && <span className="text-[var(--diff-del-marker)]">−{deletions}</span>}
    </span>
  );
}

// ─── Tree building ──────────────────────────────────────────────────────────

type FileNode = { type: "file"; path: string; name: string; file: ChangedFile };
type DirNode = { type: "dir"; path: string; name: string; children: Node[] };
type Node = FileNode | DirNode;

function buildTree(files: ChangedFile[]): Node[] {
  const root: DirNode = { type: "dir", path: "", name: "", children: [] };

  for (const file of files) {
    const parts = file.filename.split("/");
    let cursor: DirNode = root;
    for (let i = 0; i < parts.length - 1; i++) {
      const part = parts[i]!;
      let next = cursor.children.find(
        (c): c is DirNode => c.type === "dir" && c.name === part,
      );
      if (!next) {
        next = {
          type: "dir",
          path: [...parts.slice(0, i + 1)].join("/"),
          name: part,
          children: [],
        };
        cursor.children.push(next);
      }
      cursor = next;
    }
    const leaf: FileNode = {
      type: "file",
      path: file.filename,
      name: parts[parts.length - 1] ?? file.filename,
      file,
    };
    cursor.children.push(leaf);
  }

  collapseChains(root);
  sortTree(root);
  return root.children;
}

function collapseChains(dir: DirNode): void {
  for (const child of dir.children) {
    if (child.type === "dir") collapseChains(child);
  }
  let i = 0;
  while (i < dir.children.length) {
    const c = dir.children[i]!;
    if (c.type === "dir" && c.children.length === 1 && c.children[0]!.type === "dir") {
      const only = c.children[0] as DirNode;
      const merged: DirNode = {
        type: "dir",
        path: only.path,
        name: `${c.name}/${only.name}`,
        children: only.children,
      };
      dir.children[i] = merged;
      continue;
    }
    i++;
  }
}

function sortTree(dir: DirNode): void {
  dir.children.sort((a, b) => {
    if (a.type !== b.type) return a.type === "dir" ? -1 : 1;
    return a.name.localeCompare(b.name);
  });
  for (const child of dir.children) {
    if (child.type === "dir") sortTree(child);
  }
}

function collectDirPaths(nodes: Node[]): string[] {
  const out: string[] = [];
  walk(nodes, (n) => {
    if (n.type === "dir") out.push(n.path);
  });
  return out;
}

function walk(nodes: Node[], visit: (n: Node) => void): void {
  for (const n of nodes) {
    visit(n);
    if (n.type === "dir") walk(n.children, visit);
  }
}

/**
 * Prune the tree to nodes whose filename (full path) contains the query.
 * Directories survive iff at least one descendant file matches. Keeps the
 * containing hierarchy visible so users see where matches live.
 */
function filterTree(nodes: Node[], q: string): Node[] {
  const out: Node[] = [];
  for (const n of nodes) {
    if (n.type === "file") {
      if (n.file.filename.toLowerCase().includes(q) || n.name.toLowerCase().includes(q)) {
        out.push(n);
      }
    } else {
      const kept = filterTree(n.children, q);
      if (kept.length > 0) {
        out.push({ ...n, children: kept });
      }
    }
  }
  return out;
}

function initialExpand(
  mode: "all" | "none" | "top",
  all: string[],
  top: string[],
): Set<string> {
  if (mode === "none") return new Set();
  if (mode === "top") return new Set(top);
  return new Set(all);
}

function basename(path: string): string {
  return path.split("/").pop() ?? path;
}
