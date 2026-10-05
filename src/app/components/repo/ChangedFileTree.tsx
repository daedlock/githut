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
import { FileIcon } from "@/app/components/repo/FileIcon";
import {
  buildFileTree,
  type ChangedFile,
  collectDirPaths,
  countFiles,
  type FileTreeDir,
  type FileTreeNode,
  filterFileTree,
} from "@/app/components/repo/fileTree";
import { Button } from "@/app/components/ui/button";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupInput,
} from "@/app/components/ui/input-group";
import { Kbd } from "@/app/components/ui/kbd";
import { cn } from "@/app/lib/cn";

export type { ChangedFile } from "@/app/components/repo/fileTree";

/**
 * Reusable file-tree sidebar. Designed to drop into any surface that lists
 * paths with metadata — commit diff, PR diff, search results, etc. The shape
 * is minimal so callers don't have to pre-transform data.
 */
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
  const tree = useMemo(() => buildFileTree(files), [files]);
  const allDirPaths = useMemo(() => collectDirPaths(tree), [tree]);
  const topDirPaths = useMemo(
    () => tree.filter((n): n is FileTreeDir => n.type === "dir").map((n) => n.path),
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
    () => (trimmedQuery ? filterFileTree(tree, trimmedQuery) : tree),
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

  const visibleFileCount = useMemo(
    () => (trimmedQuery ? countFiles(filteredTree) : files.length),
    [filteredTree, files.length, trimmedQuery],
  );

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
  node: FileTreeNode;
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
  node: FileTreeDir;
  depth: number;
  isOpen: boolean;
  onToggle: () => void;
}) {
  const DirIcon = isOpen ? FolderOpen : Folder;
  const hasChanges = node.additions > 0 || node.deletions > 0;
  const fileLabel = `${node.fileCount} ${node.fileCount === 1 ? "file" : "files"}`;
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-expanded={isOpen}
      title={`${node.path} · ${fileLabel} · +${node.additions} −${node.deletions}`}
      className="group flex w-full items-center gap-1.5 rounded-lg py-1 text-left outline-none transition-colors hover:bg-muted focus-visible:bg-muted focus-visible:ring-1 focus-visible:ring-foreground/15"
      style={{ paddingLeft: `${depth * 16 + 8}px` }}
    >
      {isOpen ? (
        <ChevronDown className="size-3 flex-shrink-0 text-muted-foreground" />
      ) : (
        <ChevronRight className="size-3 flex-shrink-0 text-muted-foreground" />
      )}
      <DirIcon className="size-3.5 flex-shrink-0 text-muted-foreground" />
      <span className="min-w-0 flex-1 truncate text-sm text-foreground">{node.name}</span>
      {hasChanges && (
        <FileStats
          additions={node.additions}
          deletions={node.deletions}
          // A collapsed folder is the only place its numbers live, so they stay
          // put. An expanded folder already shows per-file counts beneath it, so
          // the rollup would just be noise — it fades in on hover/focus instead
          // (and stays visible on touch screens, which have no hover).
          className={cn(
            isOpen &&
              "opacity-0 transition-opacity duration-[120ms] group-hover:opacity-100 group-focus-visible:opacity-100 [@media(hover:none)]:opacity-100",
          )}
        />
      )}
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

function FileStats({
  additions,
  deletions,
  className,
}: {
  additions: number;
  deletions: number;
  className?: string;
}) {
  if (additions === 0 && deletions === 0) return null;
  return (
    <span className={cn("flex-shrink-0 text-caption tabular-nums", className)}>
      {additions > 0 && <span className="text-[var(--diff-add-marker)]">+{additions}</span>}
      {additions > 0 && deletions > 0 && " "}
      {deletions > 0 && <span className="text-[var(--diff-del-marker)]">−{deletions}</span>}
    </span>
  );
}

function initialExpand(mode: "all" | "none" | "top", all: string[], top: string[]): Set<string> {
  if (mode === "none") return new Set();
  if (mode === "top") return new Set(top);
  return new Set(all);
}

function basename(path: string): string {
  return path.split("/").pop() ?? path;
}
