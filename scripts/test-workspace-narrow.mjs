import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { setTimeout as delay } from "node:timers/promises";
import { chromium } from "playwright";

const app = process.env.UI_BASE_URL || "http://127.0.0.1:5195";
assert.ok(["localhost", "127.0.0.1"].includes(new URL(app).hostname));
const server = process.env.UI_BASE_URL
  ? null
  : spawn(
      process.execPath,
      ["node_modules/vite/bin/vite.js", "--host", "127.0.0.1", "--port", "5195", "--strictPort"],
      {
        stdio: ["ignore", "pipe", "pipe"],
      },
    );
let serverLog = "";
server?.stdout.on("data", (chunk) => (serverLog += chunk));
server?.stderr.on("data", (chunk) => (serverLog += chunk));
process.once("exit", () => server?.kill());
for (let attempt = 0; ; attempt++) {
  try {
    if ((await fetch(app)).ok) break;
  } catch {}
  if (attempt === 100 || server?.exitCode != null) throw new Error(serverLog);
  await delay(200);
}

const browser = await chromium.launch({ headless: true, args: ["--no-sandbox"] });
const actor = {
  id: 1,
  login: "demo",
  avatar_url: "",
  html_url: "https://github.com/demo",
  type: "User",
  name: "Demo",
};
const repo = {
  id: 1,
  name: "project",
  full_name: "demo/project",
  owner: actor,
  default_branch: "main",
  private: false,
  fork: false,
  description: "Navigation fixture",
  topics: [],
  language: "TypeScript",
  stargazers_count: 0,
  forks_count: 0,
  open_issues_count: 2,
  html_url: "https://github.com/demo/project",
  pushed_at: "2026-10-01T12:00:00Z",
  updated_at: "2026-10-01T12:00:00Z",
};
const issues = [1, 2].map((number) => ({
  id: number,
  number,
  title: `Navigation issue ${number}`,
  state: "open",
  user: actor,
  body: "A navigation fixture.",
  labels: [],
  assignees: [],
  comments: 0,
  created_at: "2026-10-01T12:00:00Z",
  updated_at: "2026-10-01T12:00:00Z",
  closed_at: null,
  html_url: `https://github.com/demo/project/issues/${number}`,
}));

async function fixture() {
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    reducedMotion: "reduce",
  });
  await context.addInitScript(() => {
    localStorage.setItem(
      "githut.auth",
      JSON.stringify({ state: { token: "fixture" }, version: 0 }),
    );
  });
  const requests = [];
  await context.route("https://api.github.com/**", async (route) => {
    const path = new URL(route.request().url()).pathname;
    requests.push(path);
    let data = [];
    if (path === "/user" || path === "/users/demo") data = actor;
    else if (path === "/user/repos") data = [repo];
    else if (path === "/repos/demo/project") data = repo;
    else if (path === "/repos/demo/project/issues") data = issues;
    else if (/^\/repos\/demo\/project\/issues\/[12]$/.test(path))
      data = issues[Number(path.split("/").at(-1)) - 1];
    else if (path === "/search/issues")
      data = { total_count: 0, incomplete_results: false, items: [] };
    else if (path.endsWith("/actions/runs")) data = { total_count: 0, workflow_runs: [] };
    await route.fulfill({ contentType: "application/json", body: JSON.stringify(data) });
  });
  await context.route("**/api/**", (route) =>
    route.fulfill({ contentType: "application/json", body: "{}" }),
  );
  const page = await context.newPage();
  page.setDefaultTimeout(10000);
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.clock.install();
  await page.goto(`${app}/demo/project/issues`);
  await page
    .getByRole("link", { name: "Open issue #1: Navigation issue 1", exact: true })
    .waitFor();
  return { page, context, errors, requests, close: () => context.close() };
}

try {
  const f = await fixture();
  const page = f.page;
  await page.setViewportSize({ width: 720, height: 900 });
  assert.equal(
    await page.getByRole("button", { name: "Switch island or tab", exact: true }).count(),
    0,
  );
  await page.setViewportSize({ width: 719, height: 900 });
  await page.getByRole("button", { name: "Switch island or tab", exact: true }).waitFor();
  await page.setViewportSize({ width: 1440, height: 900 });
  await page
    .getByRole("button", { name: "Switch island or tab", exact: true })
    .waitFor({ state: "hidden" });
  await page
    .getByRole("link", { name: "Open issue #1: Navigation issue 1", exact: true })
    .click({ modifiers: ["Alt"] });
  await page.waitForFunction(() => document.querySelectorAll("[data-island]").length === 2);
  await page
    .getByRole("link", { name: "Open issue #2: Navigation issue 2", exact: true })
    .click({ modifiers: ["Shift"] });
  await page.waitForURL(`${app}/demo/project/issues/2`);
  const saved = await page.evaluate(() =>
    sessionStorage.getItem(
      Object.keys(sessionStorage).find((k) => k.startsWith("githut.workspace.window")) ?? "",
    ),
  );
  const beforeBounds = await page.locator("[data-island]").evaluateAll((nodes) =>
    nodes.map((node) => {
      const r = node.getBoundingClientRect();
      return [r.x, r.y, r.width, r.height];
    }),
  );
  await page.setViewportSize({ width: 900, height: 900 });
  await page.getByRole("button", { name: "Switch island or tab", exact: true }).waitFor();
  assert.equal(await page.locator("[data-island]:visible").count(), 1);
  assert.equal(await page.locator("[data-sidebar]").count(), 0);
  assert.equal(
    await page.evaluate(() =>
      sessionStorage.getItem(
        Object.keys(sessionStorage).find((k) => k.startsWith("githut.workspace.window")) ?? "",
      ),
    ),
    saved,
  );
  const area = await page.locator("[data-workspace-area]").boundingBox();
  const island = await page.locator("[data-island]:visible").boundingBox();
  assert.equal(island.width, area.width);
  // Resizing repeatedly at the minimum-fit boundary must remain stable.
  for (let i = 0; i < 3; i++) {
    await page.setViewportSize({ width: 900 + i, height: 900 });
    await delay(100);
    assert.equal(await page.locator("[data-workspace-area]").getAttribute("data-narrow"), "true");
  }
  await page.setViewportSize({ width: 1440, height: 900 });
  await page
    .getByRole("button", { name: "Switch island or tab", exact: true })
    .waitFor({ state: "hidden" });
  assert.equal(await page.locator("[data-island]:visible").count(), 2);
  assert.equal(
    await page.evaluate(() =>
      sessionStorage.getItem(
        Object.keys(sessionStorage).find((k) => k.startsWith("githut.workspace.window")) ?? "",
      ),
    ),
    saved,
  );
  assert.deepEqual(
    await page.locator("[data-island]").evaluateAll((nodes) =>
      nodes.map((node) => {
        const r = node.getBoundingClientRect();
        return [r.x, r.y, r.width, r.height];
      }),
    ),
    beforeBounds,
  );
  console.log(
    "PASS 720px threshold, minimum-fit trigger, stable mode and exact desktop restoration",
  );

  await page
    .locator('[data-island][data-focused="true"]')
    .getByRole("button", {
      name: "Island actions",
      exact: true,
    })
    .click();
  await page.getByRole("menuitem", { name: "Maximize", exact: true }).click();
  const maximized = await page.evaluate(() =>
    sessionStorage.getItem(
      Object.keys(sessionStorage).find((k) => k.startsWith("githut.workspace.window")) ?? "",
    ),
  );
  const maximizedIsland = JSON.parse(maximized).workspace.focusedIslandId;
  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByRole("button", { name: "Switch island or tab", exact: true }).waitFor();
  assert.equal(
    await page.evaluate(() =>
      sessionStorage.getItem(
        Object.keys(sessionStorage).find((k) => k.startsWith("githut.workspace.window")) ?? "",
      ),
    ),
    maximized,
  );
  await page.setViewportSize({ width: 1440, height: 900 });
  await page
    .getByRole("button", { name: "Switch island or tab", exact: true })
    .waitFor({ state: "hidden" });
  assert.equal(
    await page.locator("[data-island]:visible").getAttribute("data-island"),
    maximizedIsland,
  );
  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByRole("button", { name: "Switch island or tab", exact: true }).click();
  const otherIsland = JSON.parse(saved).workspace.layout.children.find(
    (island) => island.id !== maximizedIsland,
  );
  await page.locator(`[data-switcher-tab="${otherIsland.selectedTabId}"]`).click();
  await page.waitForFunction(
    (id) =>
      document.querySelector('[data-island][data-focused="true"]')?.getAttribute("data-island") ===
      id,
    otherIsland.id,
  );
  assert.equal(
    await page.locator("[data-island]:visible").getAttribute("data-island"),
    otherIsland.id,
  );
  await page.setViewportSize({ width: 1440, height: 900 });
  await page
    .getByRole("button", { name: "Switch island or tab", exact: true })
    .waitFor({ state: "hidden" });
  assert.equal(await page.locator("[data-island]:visible").count(), 2);
  assert.deepEqual(
    await page.evaluate(
      () =>
        JSON.parse(
          sessionStorage.getItem(
            Object.keys(sessionStorage).find((k) => k.startsWith("githut.workspace.window")) ?? "",
          ),
        ).workspace.layout,
    ),
    JSON.parse(saved).workspace.layout,
  );
  console.log(
    "PASS maximize survives resizing and switching narrow focus restores both desktop islands",
  );

  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByRole("button", { name: "Switch island or tab", exact: true }).waitFor();
  const allTabs = await page.evaluate(() => {
    const ws = JSON.parse(
      sessionStorage.getItem(
        Object.keys(sessionStorage).find((k) => k.startsWith("githut.workspace.window")) ?? "",
      ),
    ).workspace;
    const all = (node) => (node.kind === "island" ? node.tabs : node.children.flatMap(all));
    return all(ws.layout);
  });
  for (const tab of allTabs) {
    await page.getByRole("button", { name: "Switch island or tab", exact: true }).click();
    await page.locator("[data-switcher-tab]").first().waitFor();
    assert.equal(await page.locator("[data-switcher-tab]").count(), allTabs.length);
    await page.locator(`[data-switcher-tab="${tab.id}"]`).click();
    await page.waitForURL(`${app}${tab.href}`);
    await page.waitForFunction(
      (id) => document.activeElement?.getAttribute("data-tab-pane") === id,
      tab.id,
    );
    assert.equal(await page.locator("[data-island]:visible").count(), 1);
    assert.equal(
      await page
        .locator("[data-island]:visible [data-tab-id][aria-selected=true]")
        .getAttribute("data-tab-id"),
      tab.id,
    );
  }
  await page.getByRole("button", { name: "Switch island or tab", exact: true }).focus();
  await page.keyboard.press("ArrowDown");
  await page.keyboard.press("Home");
  await page.keyboard.press("Enter");
  await page.waitForURL(`${app}${allTabs[0].href}`);
  console.log("PASS switcher reaches every island and tab with pointer and keyboard");

  // Hidden detail pages must not run their ordinary comment queries.
  const commentRequests = () =>
    f.requests.filter((path) => /issues\/[12]\/comments$/.test(path)).length;
  await delay(200);
  const beforePoll = commentRequests();
  await page.clock.fastForward(61_000);
  await delay(250);
  assert.equal(commentRequests(), beforePoll, "hidden island comment polling is paused");

  await page.keyboard.press("Control+b");
  const drawer = page.getByRole("dialog", { name: "Sidebar", exact: true });
  await drawer.waitFor();
  await page.keyboard.press("Escape");
  await drawer.waitFor({ state: "hidden" });
  assert.equal(
    await page
      .getByRole("button", { name: "Open sidebar", exact: true })
      .evaluate((node) => node === document.activeElement),
    true,
  );
  await page.getByRole("button", { name: "Open sidebar", exact: true }).click();
  await drawer.getByRole("button", { name: "Inbox", exact: true }).click();
  await drawer.waitFor({ state: "hidden" });
  await page.waitForURL(`${app}/`);
  await page.getByRole("button", { name: "Open sidebar", exact: true }).click();
  await drawer.getByRole("button", { name: "Inbox", exact: true }).click({ button: "right" });
  await page.getByRole("menuitem", { name: "Dock at window edge", exact: true }).hover();
  await page.getByRole("menuitem", { name: "Bottom", exact: true }).click();
  await drawer.waitFor({ state: "hidden" });
  assert.equal(await page.locator("[data-island]").count(), 3);
  console.log("PASS sidebar logo/shortcut/Escape and launch/menu docking close the drawer");

  await page.getByRole("button", { name: "Open sidebar", exact: true }).click();
  await drawer.getByRole("button", { name: "Inbox", exact: true }).hover();
  const start = await drawer.getByRole("button", { name: "Inbox", exact: true }).boundingBox();
  const destination = await page.locator("[data-island]:visible").boundingBox();
  await page.mouse.move(start.x + start.width / 2, start.y + start.height / 2);
  await page.mouse.down();
  await page.mouse.move(start.x + start.width / 2 + 10, start.y + start.height / 2, { steps: 2 });
  await drawer.waitFor({ state: "hidden" });
  await page.mouse.move(
    destination.x + destination.width / 2,
    destination.y + destination.height / 2,
    { steps: 6 },
  );
  await page.locator("[data-dock-preview]").waitFor();
  const tabsBeforeDrop = await page.locator("[data-tab-id]").count();
  await page.mouse.up();
  await page.locator("[data-dock-ghost]").waitFor({ state: "hidden" });
  assert.equal(await page.locator("[data-tab-id]").count(), tabsBeforeDrop + 1);
  console.log("PASS drawer drag retains capture and docks after its portal closes");

  await page.getByRole("button", { name: "Open sidebar", exact: true }).click();
  await drawer.waitFor();
  await page.getByRole("button", { name: "Open user menu", exact: true }).click();
  await page.getByRole("menuitem", { name: "Settings", exact: true }).click();
  const settings = page.getByRole("dialog", { name: "Settings", exact: true });
  await settings.waitFor();
  const settingsBounds = await settings.boundingBox();
  assert.ok(settingsBounds.width <= 390 - 32 && settingsBounds.x >= 16);
  await page.keyboard.press("Escape");
  await page.waitForURL(`${app}/`);
  await settings.waitFor({ state: "hidden" });
  await page.screenshot({ path: "test-results/workspace-narrow.png" });
  assert.deepEqual(f.errors, []);
  await f.close();
  console.log("PASS hidden polling and Settings compatibility on a phone-sized viewport");
} finally {
  await browser.close();
  server?.kill();
}
