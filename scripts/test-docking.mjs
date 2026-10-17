import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { setTimeout as delay } from "node:timers/promises";
import { chromium } from "playwright";

const app = process.env.UI_BASE_URL || "http://127.0.0.1:5189";
assert.ok(["localhost", "127.0.0.1"].includes(new URL(app).hostname));
const server = process.env.UI_BASE_URL
  ? null
  : spawn(
      process.execPath,
      ["node_modules/vite/bin/vite.js", "--host", "127.0.0.1", "--port", "5189", "--strictPort"],
      { stdio: ["ignore", "pipe", "pipe"] },
    );
let log = "";
server?.stdout.on("data", (chunk) => {
  log += chunk;
});
server?.stderr.on("data", (chunk) => {
  log += chunk;
});
process.once("exit", () => server?.kill());
let browser;
try {
  for (let attempt = 0; ; attempt++) {
    try {
      if ((await fetch(app)).ok) break;
    } catch {}
    if (attempt === 100 || server?.exitCode != null) throw new Error(`Server failed: ${log}`);
    await delay(200);
  }
  browser = await chromium.launch({ headless: true, args: ["--no-sandbox"] });
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    reducedMotion: "reduce",
  });
  await context.addInitScript(() => {
    localStorage.setItem(
      "githut.auth",
      JSON.stringify({ state: { token: "fixture" }, version: 0 }),
    );
    localStorage.setItem(
      "githut.workspace",
      JSON.stringify({
        version: 1,
        workspace: {
          layout: {
            kind: "island",
            id: "first",
            tabs: [
              { id: "inbox", href: "/" },
              { id: "issues", href: "/demo/project/issues" },
              { id: "pulls", href: "/demo/project/pulls" },
            ],
            selectedTabId: "inbox",
            pinned: ["inbox"],
          },
          focusedIslandId: "first",
          maximizedIslandId: null,
        },
      }),
    );
  });
  await context.route("https://api.github.com/**", (route) => {
    const path = new URL(route.request().url()).pathname;
    const body =
      path === "/user"
        ? { login: "demo", id: 1, avatar_url: "" }
        : path.startsWith("/search/")
          ? { total_count: 0, items: [] }
          : path === "/repos/demo/project"
            ? {
                name: "project",
                full_name: "demo/project",
                default_branch: "main",
                owner: { login: "demo" },
              }
            : [];
    return route.fulfill({ json: body });
  });
  await context.route("https://cloud.umami.is/**", (route) => route.fulfill({ body: "" }));
  const page = await context.newPage();
  await page.goto(app);
  await page.locator('[data-tab-id="issues"]').waitFor();
  const island = await page.locator('[data-island="first"]').boundingBox();
  const tab = await page.locator('[data-tab-id="issues"]').boundingBox();
  assert.ok(island && tab);
  await page.mouse.move(tab.x + tab.width / 2, tab.y + tab.height / 2);
  await page.mouse.down();
  await page.mouse.move(island.x + island.width - 40, island.y + island.height / 2, { steps: 12 });
  await page.locator("[data-dock-preview]").waitFor({ timeout: 3000 });
  const preview = await page.locator("[data-dock-preview]").boundingBox();
  assert.ok(await page.locator("[data-dock-ghost]").isVisible());
  await page.mouse.up();
  await page.waitForFunction(() => document.querySelectorAll("[data-island]").length === 2);
  const moved = await page.locator('[data-island]:has([data-tab-id="issues"])').boundingBox();
  for (const key of ["x", "y", "width", "height"])
    assert.ok(Math.abs(moved[key] - preview[key]) < 2, `Preview ${key} matches the drop`);
  console.log("PASS: dragging a tab splits an island at the previewed position");

  const layoutBeforeCancel = await page
    .locator("[data-island]")
    .evaluateAll((els) =>
      els.map((el) => [...el.querySelectorAll("[data-tab-id]")].map((tab) => tab.dataset.tabId)),
    );
  const secondTab = await page.locator('[data-tab-id="issues"]').boundingBox();
  await page.mouse.move(secondTab.x + 35, secondTab.y + 12);
  await page.mouse.down();
  await page.mouse.move(island.x + 10, island.y + island.height / 2, { steps: 12 });
  await page.locator("[data-dock-preview]").waitFor();
  await page.keyboard.press("Escape");
  await page.mouse.up();
  assert.equal(await page.locator("[data-dock-ghost]").count(), 0);
  assert.deepEqual(
    await page
      .locator("[data-island]")
      .evaluateAll((els) =>
        els.map((el) => [...el.querySelectorAll("[data-tab-id]")].map((tab) => tab.dataset.tabId)),
      ),
    layoutBeforeCancel,
  );
  console.log("PASS: Escape cancels without changing the layout");

  const sourceStrip = await page.locator('[data-island="first"] [data-tab-strip]').boundingBox();
  await page.mouse.move(sourceStrip.x + sourceStrip.width - 8, sourceStrip.y + 20);
  await page.mouse.down();
  await page.mouse.move(moved.x + moved.width / 2, moved.y + moved.height / 2, { steps: 12 });
  await page.locator("[data-dock-preview]").waitFor();
  await page.mouse.up();
  await page.waitForFunction(() => document.querySelectorAll("[data-island]").length === 1);
  await page.getByText("Islands merged", { exact: true }).waitFor();
  await page.getByRole("button", { name: /Undo/ }).click();
  await page.waitForFunction(() => document.querySelectorAll("[data-island]").length === 2);
  await page.keyboard.press("Control+z");
  await page.waitForFunction(() => document.querySelectorAll("[data-island]").length === 1);
  console.log("PASS: island header merge, toast Undo and keyboard Undo restore the layouts");

  await page.locator('[data-tab-id="pulls"]').click({ button: "right" });
  for (const name of [
    "Split right",
    "Split down",
    "Reorder tab",
    "Move to island",
    "Dock beside island",
    "Dock at window edge",
  ]) {
    assert.ok(await page.getByRole("menuitem", { name, exact: true }).isVisible());
  }
  await page.getByRole("menuitem", { name: "Split down", exact: true }).click();
  await page.waitForFunction(() => document.querySelectorAll("[data-island]").length === 2);
  assert.ok(
    (await page.locator('[data-island]:has([data-tab-id="pulls"])').boundingBox()).y >
      island.y + 100,
  );
  console.log("PASS: tab menu exposes docking operations and splits without dragging");

  await page.keyboard.press("Control+z");
  const pulls = await page.locator('[data-tab-id="pulls"]').boundingBox();
  const inbox = await page.locator('[data-tab-id="inbox"]').boundingBox();
  await page.mouse.move(pulls.x + 40, pulls.y + 12);
  await page.mouse.down();
  await page.mouse.move(inbox.x + inbox.width / 2 - 8, inbox.y + 12, { steps: 12 });
  await page.locator('[data-dock-preview="insert"]').waitFor();
  const line = await page.locator('[data-dock-preview="insert"]').boundingBox();
  await page.mouse.up();
  const reordered = await page.locator('[data-tab-id="pulls"]').boundingBox();
  assert.ok(Math.abs(reordered.x - line.x) < 3, "Insertion preview respects the pinned prefix");
  assert.deepEqual(
    await page
      .locator('[data-island="first"] [data-tab-id]')
      .evaluateAll((els) => els.map((el) => el.dataset.tabId)),
    ["inbox", "pulls", "issues"],
  );
  console.log("PASS: reorder preview respects the pinned prefix");
} finally {
  await browser?.close();
  server?.kill();
}
