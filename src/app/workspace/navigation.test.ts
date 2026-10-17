import { describe, expect, test } from "bun:test";
import {
  createWorkspace,
  findIsland,
  focusedIsland,
  focusedTab,
  islands,
  runCommand,
} from "@/app/workspace/model";
import { loadWorkspace, saveWorkspace } from "@/app/workspace/persistence";

describe("workspace navigation", () => {
  test("restored workspaces preserve launcher focus priority and accept older saved layouts", () => {
    const previousWindow = Object.getOwnPropertyDescriptor(globalThis, "window");
    const values = new Map<string, string>();
    const storage = {
      getItem: (key: string) => values.get(key) ?? null,
      setItem: (key: string, value: string) => values.set(key, value),
    };
    Object.defineProperty(globalThis, "window", {
      configurable: true,
      value: { sessionStorage: storage, localStorage: storage },
    });
    try {
      let ws = createWorkspace(["/demo/project/pulls"]);
      ws = runCommand(ws, { type: "splitIsland", side: "right" });
      const second = focusedIsland(ws).id;
      ws = runCommand(ws, { type: "openToSide", href: "/demo/project/code" });
      saveWorkspace(ws);
      const restored = runCommand(loadWorkspace("/"), {
        type: "openOrJump",
        href: "/demo/project/pulls",
      });
      expect(restored.focusedIslandId).toBe(second);

      // Schema v1 before navigation history was added remains a valid layout.
      const old = JSON.parse(values.get("githut.workspace.window")!);
      delete old.workspace.focusHistory;
      storage.setItem("githut.workspace.window", JSON.stringify(old));
      expect(islands(loadWorkspace("/").layout).map((island) => island.tabs[0]?.href)).toEqual([
        "/demo/project/pulls",
        "/demo/project/pulls",
        "/demo/project/code",
      ]);
    } finally {
      if (previousWindow) Object.defineProperty(globalThis, "window", previousWindow);
      else Reflect.deleteProperty(globalThis, "window");
    }
  });

  test("new-tab links deduplicate only exact pages inside their source island", () => {
    let ws = createWorkspace(["/demo/project/code?path=first.ts"]);
    const source = focusedIsland(ws).id;
    ws = runCommand(ws, { type: "openToSide", href: "/demo/project/code?path=second.ts" });
    const command = {
      type: "openTab" as const,
      href: "/demo/project/code?path=second.ts",
      islandId: source,
      match: "href" as const,
    };
    ws = runCommand(ws, command);
    ws = runCommand(ws, command);
    expect(findIsland(ws.layout, source)?.tabs.map((tab) => tab.href)).toEqual([
      "/demo/project/code?path=first.ts",
      "/demo/project/code?path=second.ts",
    ]);
    expect(ws.focusedIslandId).toBe(source);
    expect(islands(ws.layout)[1]?.tabs.map((tab) => tab.href)).toEqual([
      "/demo/project/code?path=second.ts",
    ]);
  });

  test("opening to the side preserves the source and permits the same page in two islands", () => {
    let ws = createWorkspace(["/demo/project/pulls"]);
    const originalTab = focusedTab(ws);
    const source = focusedIsland(ws).id;
    ws = runCommand(ws, { type: "openToSide", href: originalTab.href, islandId: source });
    expect(islands(ws.layout).map((island) => island.tabs.map((tab) => tab.href))).toEqual([
      ["/demo/project/pulls"],
      ["/demo/project/pulls"],
    ]);
    expect(focusedTab(ws).id).not.toBe(originalTab.id);
    expect(ws.focusedIslandId).not.toBe(source);
  });

  test("launchers prefer the focused island, then the most recently focused matching island", () => {
    let ws = createWorkspace(["/demo/project/pulls"]);
    const first = focusedIsland(ws).id;
    ws = runCommand(ws, { type: "splitIsland", side: "right" });
    const second = focusedIsland(ws).id;
    ws = runCommand(ws, { type: "splitIsland", side: "right" });
    const third = focusedIsland(ws).id;
    ws = runCommand(ws, { type: "navigate", tabId: focusedTab(ws).id, href: "/demo/project/code" });

    ws = runCommand(ws, { type: "openOrJump", href: "/demo/project/pulls" });
    expect(ws.focusedIslandId).toBe(second);
    ws = runCommand(ws, { type: "focusIsland", islandId: first });
    ws = runCommand(ws, { type: "openOrJump", href: "/demo/project/pulls" });
    expect(ws.focusedIslandId).toBe(first);
    ws = runCommand(ws, { type: "focusIsland", islandId: third });
    ws = runCommand(ws, { type: "openOrJump", href: "/demo/project/pulls" });
    expect(ws.focusedIslandId).toBe(first);
    expect(islands(ws.layout).map((island) => island.tabs.length)).toEqual([1, 1, 1]);
  });
});
