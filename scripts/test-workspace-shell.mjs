import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { setTimeout as delay } from "node:timers/promises";
import { chromium } from "playwright";

const app = process.env.UI_BASE_URL || "http://127.0.0.1:5245";
assert.ok(["localhost", "127.0.0.1"].includes(new URL(app).hostname));
const server = process.env.UI_BASE_URL
  ? null
  : spawn(
      process.execPath,
      ["node_modules/vite/bin/vite.js", "--host", "127.0.0.1", "--port", "5245", "--strictPort"],
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

  await page.goto(`${app}/demo/project/issues`);
  await page
    .getByRole("link", { name: "Open issue #1: Navigation issue 1", exact: true })
    .waitFor();
  return { page, context, errors, requests, close: () => context.close() };
}

try {
  const f = await fixture();
  const page = f.page;
  if (process.env.SCREENSHOT_DIR)
    await page.screenshot({ path: `${process.env.SCREENSHOT_DIR}/45-desktop.png` });
  const bounds = await page.locator("[data-island]:visible").boundingBox();
  assert.equal(bounds.y, 8, "workspace starts inside the consistent outer gutter");
  assert.equal(bounds.y + bounds.height, 892, "workspace leaves the same bottom gutter");
  assert.equal(bounds.x + bounds.width, 1432, "workspace leaves the same right gutter");
  await page.getByRole("button", { name: "Collapse sidebar", exact: true }).click();
  const collapsed = await page.locator("[data-island]:visible").boundingBox();
  assert.ok(collapsed.width > bounds.width, "collapsed sidebar releases horizontal space");
  if (process.env.SCREENSHOT_DIR)
    await page.screenshot({ path: `${process.env.SCREENSHOT_DIR}/45-collapsed.png` });
  assert.equal(collapsed.y, 8);
  assert.equal(collapsed.x + collapsed.width, 1432);
  await page.getByRole("button", { name: "Search or jump to", exact: true }).click();
  await page.getByRole("dialog").waitFor();
  await page.keyboard.press("Escape");
  await page.getByRole("dialog").waitFor({ state: "hidden" });
  await page.keyboard.press("Control+k");
  await page.getByRole("dialog").waitFor();
  await page.keyboard.press("Escape");
  await page.getByRole("button", { name: "Open user menu", exact: true }).click();
  await page.getByRole("menuitem", { name: "Settings", exact: true }).click();
  await page.getByRole("dialog", { name: "Settings" }).waitFor();
  await page.keyboard.press("Escape");
  await page.getByRole("button", { name: "Expand sidebar", exact: true }).click();
  await page.waitForFunction(
    () => document.querySelector("[data-island]").getBoundingClientRect().right === innerWidth - 8,
  );
  const restored = await page.locator("[data-island]:visible").boundingBox();
  assert.deepEqual(restored, bounds);
  if (process.env.SCREENSHOT_DIR) {
    await page.getByRole("button", { name: "Open user menu", exact: true }).click();
    await page.getByRole("button", { name: "Dark theme", exact: true }).click();
    await page.keyboard.press("Escape");
    await page.mouse.move(800, 700);
    await delay(250);
    await page.screenshot({ path: `${process.env.SCREENSHOT_DIR}/45-desktop-dark.png` });
  }
  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByRole("button", { name: "Switch island or tab", exact: true }).waitFor();
  if (process.env.SCREENSHOT_DIR)
    await page.screenshot({ path: `${process.env.SCREENSHOT_DIR}/45-narrow.png` });
  const narrow = await page.locator("[data-island]:visible").boundingBox();
  assert.deepEqual(narrow, { x: 8, y: 8, width: 374, height: 828 });
  await page.getByRole("button", { name: "Open sidebar", exact: true }).click();
  await page.getByRole("dialog", { name: "Sidebar", exact: true }).waitFor();
  if (process.env.SCREENSHOT_DIR) {
    await page.mouse.move(380, 820);
    await delay(300);
    await page.screenshot({ path: `${process.env.SCREENSHOT_DIR}/45-drawer.png` });
  }
  await page.getByRole("button", { name: "Open user menu", exact: true }).click();
  await page.getByRole("menuitem", { name: "Settings", exact: true }).click();
  await page.getByRole("dialog", { name: "Settings" }).waitFor();
  await page.keyboard.press("Escape");
  await page.getByRole("dialog", { name: "Settings" }).waitFor({ state: "hidden" });
  await page.getByRole("button", { name: "Open sidebar", exact: true }).click();
  await page.getByRole("button", { name: "Search or jump to", exact: true }).click();
  await page.getByRole("combobox").waitFor();
  assert.equal(await page.getByRole("dialog", { name: "Sidebar", exact: true }).count(), 0);
  await page.keyboard.press("Escape");
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth), 390);
  await contextStatus(page, f.context);
  await page.setViewportSize({ width: 320, height: 640 });
  await page.waitForFunction(
    () =>
      document.querySelector("[data-island][data-focused]").getBoundingClientRect().width === 304,
  );
  const header = page.locator("[data-island]:visible [data-island-header]");
  const controls = await header.locator("button:visible").evaluateAll((nodes) =>
    nodes.map((node) => {
      const r = node.getBoundingClientRect();
      return { name: node.getAttribute("aria-label"), left: r.left, right: r.right };
    }),
  );
  for (const control of controls)
    assert.ok(control.left >= 8 && control.right <= 312, `${control.name} fits narrow island`);
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth), 320);
  assert.deepEqual(f.errors, []);
  await f.close();
  console.log("PASS full-height desktop workspace");
} finally {
  await browser.close();
  server?.kill();
}

async function contextStatus(page, context) {
  await context.setOffline(true);
  await page.getByRole("status").filter({ hasText: "Offline" }).waitFor();
  assert.equal((await page.locator("[data-island]:visible").boundingBox()).y, 8);
  await context.setOffline(false);
  await page.getByRole("status").filter({ hasText: "Offline" }).waitFor({ state: "hidden" });
}
