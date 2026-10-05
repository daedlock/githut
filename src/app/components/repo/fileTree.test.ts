import { describe, expect, test } from "bun:test";
import {
  buildFileTree,
  type ChangedFile,
  collectDirPaths,
  countFiles,
  type FileTreeDir,
  filterFileTree,
} from "./fileTree";

const file = (filename: string, additions: number, deletions: number): ChangedFile => ({
  filename,
  status: "modified",
  additions,
  deletions,
});

function dir(nodes: ReturnType<typeof buildFileTree>, path: string): FileTreeDir {
  let found: FileTreeDir | undefined;
  const visit = (list: ReturnType<typeof buildFileTree>) => {
    for (const n of list) {
      if (n.type !== "dir") continue;
      if (n.path === path) found = n;
      visit(n.children);
    }
  };
  visit(nodes);
  if (!found) throw new Error(`no dir ${path}`);
  return found;
}

describe("buildFileTree rollups", () => {
  const files = [
    file("src/app/components/Button.tsx", 10, 2),
    file("src/app/components/Card.tsx", 3, 7),
    file("src/app/lib/cn.ts", 1, 0),
    file("README.md", 5, 1),
  ];
  const tree = buildFileTree(files);

  test("sums additions and deletions across every descendant", () => {
    expect(dir(tree, "src/app/components")).toMatchObject({
      additions: 13,
      deletions: 9,
      fileCount: 2,
    });
    expect(dir(tree, "src/app/lib")).toMatchObject({ additions: 1, deletions: 0, fileCount: 1 });
  });

  test("collapsed chains carry the rollup of the deepest folder", () => {
    // src → app is a single-child chain, so it renders as one "src/app" row.
    const app = dir(tree, "src/app");
    expect(app.name).toBe("src/app");
    expect(app).toMatchObject({ additions: 14, deletions: 9, fileCount: 3 });
    expect(collectDirPaths(tree)).toEqual(["src/app", "src/app/components", "src/app/lib"]);
  });

  test("puts directories before files and sorts by name", () => {
    expect(tree.map((n) => n.name)).toEqual(["src/app", "README.md"]);
    expect(dir(tree, "src/app").children.map((n) => n.name)).toEqual(["components", "lib"]);
  });
});

describe("filterFileTree", () => {
  const tree = buildFileTree([
    file("src/a/one.ts", 4, 4),
    file("src/a/two.ts", 6, 0),
    file("src/b/three.ts", 1, 1),
  ]);

  test("recomputes folder rollups from the surviving files only", () => {
    const filtered = filterFileTree(tree, "two");
    expect(countFiles(filtered)).toBe(1);
    expect(dir(filtered, "src/a")).toMatchObject({ additions: 6, deletions: 0, fileCount: 1 });
    expect(dir(filtered, "src")).toMatchObject({ additions: 6, deletions: 0, fileCount: 1 });
  });

  test("drops directories with no matching descendants", () => {
    const filtered = filterFileTree(tree, "three");
    expect(collectDirPaths(filtered)).toEqual(["src", "src/b"]);
  });

  test("leaves the original tree untouched", () => {
    filterFileTree(tree, "two");
    expect(dir(tree, "src/a")).toMatchObject({ additions: 10, deletions: 4, fileCount: 2 });
  });
});
