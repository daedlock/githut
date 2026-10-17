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
  await context.route("https://api.github.com/**", async (route) => {
    const path = new URL(route.request().url()).pathname;
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
  return { page, context, errors, close: () => context.close() };
}

try {
  const f = await fixture();
  const page = f.page;
  const repoColour = await page
    .locator("[data-repo-mark]")
    .first()
    .evaluate((mark) => getComputedStyle(mark).color);
  await page.getByRole("button", { name: "Open user menu", exact: true }).click();
  await page.getByRole("menuitem", { name: "Settings", exact: true }).click();
  await page.getByRole("dialog", { name: "Settings", exact: true }).waitFor({ timeout: 5000 });
  const modalBounds = await page
    .getByRole("dialog", { name: "Settings", exact: true })
    .boundingBox();
  assert.ok(
    modalBounds.width <= 800 && modalBounds.x >= 16,
    "Settings leaves the workspace visible around the modal",
  );
  assert.equal(new URL(page.url()).pathname, "/settings");
  assert.equal(await page.locator("[data-tab-id]").count(), 1);
  const colourSwitch = page.getByRole("switch", { name: "Repository colours", exact: true });
  assert.equal(await colourSwitch.getAttribute("aria-checked"), "true");
  await colourSwitch.click();
  assert.equal(await page.locator("html").getAttribute("data-repo-color"), "off");
  assert.notEqual(
    await page
      .locator("[data-repo-mark]")
      .first()
      .evaluate((mark) => getComputedStyle(mark).color),
    repoColour,
  );
  await page.keyboard.press("Escape");
  await page.waitForURL(`${app}/demo/project/issues`);
  const savedLayout = await page.evaluate(() => sessionStorage.getItem("githut.workspace.window"));
  await page.goto(`${app}/settings`);
  await page.getByRole("dialog", { name: "Settings", exact: true }).waitFor({ timeout: 5000 });
  assert.equal(await page.locator("[data-tab-id]").count(), 1);
  await page.reload();
  await page.getByRole("dialog", { name: "Settings", exact: true }).waitFor({ timeout: 5000 });
  assert.equal(await colourSwitch.getAttribute("aria-checked"), "false");
  // The OAuth callback uses the existing layout and restores this window's modal.
  await page.goto(`${app}/#t=recovered-fixture-token`);
  await page.getByRole("dialog", { name: "Settings", exact: true }).waitFor({ timeout: 5000 });
  await page.getByRole("button", { name: "Close", exact: true }).click();
  await page.waitForURL(`${app}/demo/project/issues`);
  assert.equal(
    await page.evaluate(() => sessionStorage.getItem("githut.workspace.window")),
    savedLayout,
  );

  for (const key of ["Enter", "Alt+Enter", "Control+Enter", "Meta+Enter"]) {
    await page.keyboard.press("Control+k");
    await page.getByRole("combobox").fill("> Settings");
    await page.getByRole("option").first().waitFor();
    await page.keyboard.press(key);
    await page.getByRole("dialog", { name: "Settings", exact: true }).waitFor();
    assert.equal(
      await page.locator("[data-tab-id]").count(),
      1,
      `${key} cannot create a settings tab`,
    );
    await page.keyboard.press("Escape");
  }
  await page.getByRole("button", { name: "Open user menu", exact: true }).click();
  await page.getByRole("menuitem", { name: "Settings", exact: true }).click();
  await page.goBack();
  await page.getByRole("dialog", { name: "Settings", exact: true }).waitFor({ state: "hidden" });
  assert.equal(new URL(page.url()).pathname, "/demo/project/issues");
  await page.goForward();
  await page.getByRole("dialog", { name: "Settings", exact: true }).waitFor();
  await page.keyboard.press("Escape");

  await page
    .getByRole("link", { name: "Open issue #1: Navigation issue 1", exact: true })
    .click({ modifiers: ["Alt"] });
  await page.waitForFunction(() => document.querySelectorAll("[data-island]").length === 2);
  await page.getByRole("button", { name: "Open user menu", exact: true }).click();
  assert.equal(await page.getByRole("menuitem", { name: "Sign out", exact: true }).count(), 1);
  assert.equal(await page.getByRole("button", { name: "Dark theme", exact: true }).count(), 1);
  await page.getByRole("menuitem", { name: "Reset layout", exact: true }).click();
  await page.waitForFunction(() => document.querySelectorAll("[data-island]").length === 1);
  assert.equal(await page.locator("[data-tab-id]").count(), 2);
  await page.getByRole("button", { name: /^Undo/ }).click();
  await page.waitForFunction(() => document.querySelectorAll("[data-island]").length === 2);

  // Obsolete named workspaces and old settings tabs disappear at the public load boundary.
  await page.evaluate(() => {
    localStorage.setItem("githut.workspaces.v1", "old");
    localStorage.setItem("githut.workspaces.v2", "old");
    const saved = JSON.parse(sessionStorage.getItem("githut.workspace.window"));
    const first = saved.workspace.layout.children[0];
    first.tabs.push({ id: "retired-settings", href: "/settings" });
    first.selectedTabId = "retired-settings";
    sessionStorage.setItem("githut.workspace.window", JSON.stringify(saved));
  });
  await page.goto(`${app}/settings`);
  await page.getByRole("dialog", { name: "Settings", exact: true }).waitFor();
  assert.equal(await page.locator('[data-tab-id="retired-settings"]').count(), 0);
  assert.equal(await page.evaluate(() => localStorage.getItem("githut.workspaces.v1")), null);
  assert.equal(await page.evaluate(() => localStorage.getItem("githut.workspaces.v2")), null);
  await page.screenshot({ path: "test-results/settings-modal.png" });
  assert.deepEqual(f.errors, []);
  await f.close();
  console.log(
    "PASS settings modal URL/reload/OAuth/history, palette modifiers, colour persistence, reset/undo and cleanup",
  );

  const fresh = await fixture();
  await fresh.page.evaluate(() => {
    sessionStorage.removeItem("githut.workspace.window");
    localStorage.removeItem("githut.workspace");
  });
  await fresh.page.goto(`${app}/settings`);
  await fresh.page.getByRole("dialog", { name: "Settings", exact: true }).waitFor();
  assert.equal(await fresh.page.locator("[data-tab-id]").count(), 1);
  await fresh.page.keyboard.press("Escape");
  await fresh.page.waitForURL(`${app}/`);
  assert.deepEqual(fresh.errors, []);
  await fresh.close();
  console.log("PASS a fresh direct /settings visit keeps a dashboard behind the modal");
} finally {
  await browser.close();
  server?.kill();
}
