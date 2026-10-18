// Validates commit-hook.js against the real react-dom/profiling renderer in headless Chromium.
// Skipped when Playwright's Chromium isn't installed (`bunx playwright install chromium`).
import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { chromium } from "playwright";

type Summary = {
  commits: number;
  totalActualDuration: number;
  errors: unknown[];
  byComponent: Array<{
    name: string;
    renders: number;
    mounts: number;
    totalActual: number;
    why: Record<string, number>;
    propKeys: Record<string, number>;
    locations: Record<string, number>;
  }>;
  byPane: Record<string, { hidden: boolean; hiddenRenders: number }>;
};

const hasChromium = (() => {
  try {
    return existsSync(chromium.executablePath());
  } catch {
    return false;
  }
})();

describe.skipIf(!hasChromium)("commit-hook", () => {
  let dir = "";
  let res: Record<"mount" | "tick" | "ctx" | "counter", Summary>;

  beforeAll(async () => {
    dir = mkdtempSync(path.join(tmpdir(), "commit-hook-"));
    const built = await Bun.build({
      entrypoints: [path.join(import.meta.dir, "fixture/app.jsx")],
      define: { "process.env.NODE_ENV": '"production"' },
      minify: false,
    });
    if (!built.success) throw new AggregateError(built.logs, "fixture build failed");
    writeFileSync(path.join(dir, "app.js"), await built.outputs[0]!.text());
    writeFileSync(
      path.join(dir, "commit-hook.js"),
      readFileSync(path.join(import.meta.dir, "commit-hook.js")),
    );
    writeFileSync(
      path.join(dir, "index.html"),
      '<!doctype html><html><head><script src="./commit-hook.js"></script></head><body><div id="root"></div><script src="./app.js"></script></body></html>',
    );
    const browser = await chromium.launch({ headless: true });
    try {
      const page = await browser.newPage();
      const pageErrors: string[] = [];
      page.on("pageerror", (e) => pageErrors.push(e.message));
      await page.goto(`file://${dir}/index.html`);
      await page
        .waitForFunction(() => document.title === "DONE", null, { timeout: 20_000 })
        .catch((e) => {
          throw new Error(`fixture did not finish: ${pageErrors.join("; ") || e.message}`);
        });
      const out = await page.evaluate(() =>
        Object.fromEntries(
          [...document.querySelectorAll("pre")].map((p) => [
            p.id,
            p.id === "error" ? p.textContent : JSON.parse(p.textContent ?? "null"),
          ]),
        ),
      );
      if (out.error) throw new Error(String(out.error));
      res = out;
    } finally {
      await browser.close();
    }
  }, 60_000);

  afterAll(() => {
    if (dir) rmSync(dir, { recursive: true, force: true });
  });

  // Bun renames shadowed function-expression names (MemoLeaf -> MemoLeaf2).
  const comp = (s: Summary, n: string) =>
    s.byComponent.find((c) => c.name === n || c.name === `${n}2`);

  test("records mounts with names and durations", () => {
    expect(res.mount.commits).toBeGreaterThanOrEqual(1);
    expect(res.mount.totalActualDuration).toBeGreaterThan(0);
    expect(comp(res.mount, "MemoLeaf")?.mounts).toBe(4);
  });

  test("attributes location: hidden, otherIsland, visible, sidebar, overlay", () => {
    expect(res.tick.byPane.paneB?.hidden).toBe(true);
    expect(res.tick.byPane.paneB?.hiddenRenders).toBeGreaterThan(0);
    expect(res.tick.byPane.paneD?.hidden).toBe(true);
    expect(res.tick.byPane.paneC?.hidden).toBe(false);
    expect(comp(res.tick, "Pane")?.locations.otherIsland).toBe(1);
    expect(comp(res.tick, "Pane")?.locations.visible).toBe(1);
    expect(comp(res.tick, "Leaf")?.locations.sidebar).toBe(1);
    expect(comp(res.tick, "Leaf")?.locations.overlay).toBe(1);
  });

  test("classifies why a component rendered", () => {
    expect(comp(res.tick, "MemoLeaf")).toBeUndefined();
    expect(comp(res.tick, "App")?.why.state).toBe(1);
    expect(comp(res.tick, "Pane")?.why.props).toBe(4);
    expect(comp(res.tick, "Pane")?.propKeys.tick).toBe(4);
    expect(comp(res.tick, "Counter")?.why.parent).toBe(1);
    expect(comp(res.ctx, "CtxReader")?.why.context).toBe(4);
    expect(comp(res.ctx, "MemoLeaf")).toBeUndefined();
    expect(res.counter.byComponent).toHaveLength(2);
    expect(comp(res.counter, "Counter")?.why.state).toBe(1);
  });

  test("measures update durations without hook errors", () => {
    expect(res.tick.totalActualDuration).toBeGreaterThan(0);
    expect(comp(res.tick, "Leaf")?.totalActual).toBeGreaterThan(0);
    expect([...res.mount.errors, ...res.tick.errors, ...res.ctx.errors]).toHaveLength(0);
  });
});
