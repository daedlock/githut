import {
  ChevronDown,
  ChevronRight,
  Folder,
  FolderOpen,
  FoldVertical,
  Search,
  UnfoldVertical,
  X,
} from "lucide-react";
import { Fragment, useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { FileStatus } from "@/app/components/code";
import { FileIcon } from "@/app/components/repo/FileIcon";
import { Button } from "@/app/components/ui/button";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupInput,
} from "@/app/components/ui/input-group";
import { Kbd } from "@/app/components/ui/kbd";
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
  const searchInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    function isEditable(el: EventTarget | null): boolean {
      if (!(el instanceof HTMLElement)) return false;
      if (el.isContentEditable) return true;
      const tag = el.tagName;
      return tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT";
    }

    function onKeyDown(event: KeyboardEvent) {
      if (!showSearch || event.metaKey || event.ctrlKey || event.altKey) return;
      if (event.key !== "/" || isEditable(event.target)) return;
      event.preventDefault();
      searchInputRef.current?.focus();
    }

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [showSearch]);

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

  const visibleFileCount = useMemo(() => {
    if (!trimmedQuery) return files.length;
    let n = 0;
    walk(filteredTree, (node) => {
      if (node.type === "file") n++;
    });
    return n;
  }, [filteredTree, files.length, trimmedQuery]);

  return (
    <aside className={cn("bg-background", className)}>
      {/* Header + search — sticky at top of sidebar scroll */}
      <div className="sticky top-0 z-10 bg-background pt-2">
        <header className="flex items-center justify-between gap-2 px-3 py-2">
          <span className="text-caption font-medium text-muted-foreground">{title}</span>
          <span className="font-mono text-caption tabular-nums text-muted-foreground">
            {trimmedQuery ? `${visibleFileCount} / ${files.length}` : files.length}
          </span>
        </header>

        {(showSearch || showExpandControls) && (
          <div className="flex items-center gap-2 px-3 pb-2">
            {showSearch && (
              <InputGroup className="flex-1">
                <InputGroupAddon align="inline-start">
                  <Search />
                </InputGroupAddon>
                <InputGroupInput
                  ref={searchInputRef}
                  type="search"
                  name="changed-file-search"
                  aria-label="Filter changed files"
                  autoComplete="off"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  onKeyDown={(event) => {
                    if (event.key !== "Escape") return;
                    if (query) setQuery("");
                    else event.currentTarget.blur();
                  }}
                  placeholder="Filter files"
                />
                <InputGroupAddon align="inline-end">
                  {query ? (
                    <InputGroupButton
                      size="icon-xs"
                      onClick={() => {
                        setQuery("");
                        searchInputRef.current?.focus();
                      }}
                      aria-label="Clear filter"
                      title="Clear filter"
                    >
                      <X />
                    </InputGroupButton>
                  ) : (
                    <Kbd>/</Kbd>
                  )}
                </InputGroupAddon>
              </InputGroup>
            )}
            {showExpandControls && allDirPaths.length > 0 && (
              <div className="flex shrink-0 items-center gap-1">
                <IconBtn onClick={expandAll} title="Expand all" disabled={!!trimmedQuery}>
                  <UnfoldVertical />
                </IconBtn>
                <IconBtn onClick={collapseAll} title="Collapse all" disabled={!!trimmedQuery}>
                  <FoldVertical />
                </IconBtn>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Tree body */}
      <div className="p-1.5">
        {visibleFileCount === 0 ? (
          <div className="px-2 py-6 text-center text-sm text-muted-foreground">
            {trimmedQuery ? "No matches" : "No files"}
          </div>
        ) : (
          filteredTree.map((node) => (
            <TreeNode
              key={node.path}
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
      <DirRow node={node} depth={depth} isOpen={isOpen} onToggle={() => onToggle(node.path)} />
      {isOpen &&
        node.children.map((child) => (
          <Fragment key={child.path}>
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
  const DirIcon = isOpen ? FolderOpen : Folder;
  return (
    <button
      type="button"
      onClick={onToggle}
      className="flex w-full items-center gap-1.5 rounded-lg py-1 text-left outline-none transition-colors hover:bg-muted focus-visible:bg-muted focus-visible:ring-1 focus-visible:ring-foreground/15"
      style={{ paddingLeft: `${depth * 16 + 8}px` }}
    >
      {isOpen ? (
        <ChevronDown className="size-3 flex-shrink-0 text-muted-foreground" />
      ) : (
        <ChevronRight className="size-3 flex-shrink-0 text-muted-foreground" />
      )}
      <DirIcon className="size-3.5 flex-shrink-0 text-muted-foreground" />
      <span className="truncate text-sm text-foreground">{node.name}</span>
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
        "flex w-full items-center gap-1.5 rounded-lg py-1 text-left outline-none transition-colors",
        "focus-visible:ring-1 focus-visible:ring-foreground/15",
        isActive
          ? "bg-muted text-foreground font-medium"
          : "text-foreground/80 hover:bg-muted hover:text-foreground",
      )}
      style={{ paddingLeft: `${depth * 16 + 24}px` }}
      title={file.filename}
    >
      <FileIcon filename={file.filename} />
      <span className="min-w-0 flex-1 truncate text-sm">{basename(file.filename)}</span>
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
    <Button
      type="button"
      variant="ghost"
      size="icon-xs"
      onClick={onClick}
      title={title}
      disabled={disabled}
    >
      {children}
    </Button>
  );
}

function FileStats({ additions, deletions }: { additions: number; deletions: number }) {
  if (additions === 0 && deletions === 0) return null;
  return (
    <span className="flex-shrink-0 text-xs tabular-nums">
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
      let next = cursor.children.find((c): c is DirNode => c.type === "dir" && c.name === part);
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

function initialExpand(mode: "all" | "none" | "top", all: string[], top: string[]): Set<string> {
  if (mode === "none") return new Set();
  if (mode === "top") return new Set(top);
  return new Set(all);
}

function basename(path: string): string {
  return path.split("/").pop() ?? path;
}
