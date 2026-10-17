import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { setTimeout as delay } from "node:timers/promises";
import { chromium } from "playwright";

const app = process.env.UI_BASE_URL || "http://127.0.0.1:5188";
assert.ok(["localhost", "127.0.0.1"].includes(new URL(app).hostname));
const server = process.env.UI_BASE_URL
  ? null
  : spawn(
      process.execPath,
      ["node_modules/vite/bin/vite.js", "--host", "127.0.0.1", "--port", "5188", "--strictPort"],
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
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto(`${app}/demo/project/issues`);
  await page
    .getByRole("link", { name: "Open issue #1: Navigation issue 1", exact: true })
    .waitFor();
  return { page, errors, close: () => context.close() };
}

async function palette(page, query, key = "Enter") {
  await page.keyboard.press("Control+k");
  await page.getByRole("combobox").fill(query);
  await page.getByRole("option").first().waitFor();
  await page.keyboard.press(key);
  await page.getByRole("dialog", { name: "Command palette" }).waitFor({ state: "hidden" });
}

async function tabCount(page, count) {
  await page.waitForFunction(
    (expected) => document.querySelectorAll("[data-tab-id]").length === expected,
    count,
    { timeout: 5000 },
  );
}

const issueLink = (page, number) =>
  page.getByRole("link", {
    name: `Open issue #${number}: Navigation issue ${number}`,
    exact: true,
  });

try {
  const f = await fixture();
  try {
    await palette(f.page, "> Settings");
    await f.page.waitForURL(`${app}/settings`);
    await tabCount(f.page, 2);
    assert.equal(await f.page.locator("[data-island]").count(), 1);
    assert.deepEqual(f.errors, []);
    console.log("PASS palette Enter opens without replacing the selected tab");
  } finally {
    await f.close();
  }
  const links = await fixture();
  try {
    const page = links.page;
    await issueLink(page, 1).click();
    await page.waitForURL(`${app}/demo/project/issues/1`);
    await tabCount(page, 1);
    await page.goBack();
    await issueLink(page, 1).click({ modifiers: ["Shift"] });
    await page.waitForURL(`${app}/demo/project/issues/1`);
    await tabCount(page, 2);
    await page.getByRole("tab").first().click();
    await issueLink(page, 1).click({ modifiers: ["Shift"] });
    await tabCount(page, 2);
    await page.getByRole("tab").first().click();
    await issueLink(page, 1).click({ modifiers: ["Alt"] });
    await tabCount(page, 3);
    assert.equal(await page.locator("[data-island]").count(), 2);
    assert.deepEqual(links.errors, []);
    console.log(
      "PASS plain, Shift and Alt links preserve source tabs and allow cross-island copies",
    );
  } finally {
    await links.close();
  }
  const hover = await fixture();
  try {
    const page = hover.page;
    await issueLink(page, 1).click({ modifiers: ["Alt"] });
    await tabCount(page, 2);
    const source = page.locator("[data-island]").first();
    await issueLink(page, 2).hover();
    await page.getByRole("button", { name: "Open in new tab", exact: false }).click();
    await tabCount(page, 3);
    assert.equal(await source.getByRole("tab").count(), 2);
    await source.getByRole("tab").first().click();
    await issueLink(page, 1).hover();
    await page
      .getByRole("button", { name: "Open to the side", exact: false })
      .click({ timeout: 5000 });
    await tabCount(page, 4);
    assert.equal(await page.locator("[data-island]").count(), 3);
    assert.deepEqual(hover.errors, []);
    console.log("PASS resting link actions retain the source island across a portalled menu");
  } finally {
    await hover.close();
  }
  const launchers = await fixture();
  try {
    const page = launchers.page;
    await issueLink(page, 1).click({ modifiers: ["Alt"] });
    await tabCount(page, 2);
    const first = page.locator("[data-island]").first();
    const second = page.locator("[data-island]").nth(1);
    await first.getByRole("button", { name: "project PRs", exact: true }).click();
    await tabCount(page, 3);
    await second.getByRole("button", { name: "project PRs", exact: true }).click();
    await page.waitForFunction(
      () => document.querySelector("[data-island]")?.hasAttribute("data-focused"),
      null,
      { timeout: 5000 },
    );
    await tabCount(page, 3);
    assert.equal(await second.getByRole("tab").count(), 1);
    await page.setViewportSize({ width: 900, height: 900 });
    await second.getByRole("button", { name: "project sections", exact: true }).click();
    await page.getByRole("menuitem", { name: "PRs", exact: true }).click();
    await page.getByRole("menu").waitFor({ state: "hidden" });
    await page.waitForFunction(
      () => document.querySelector("[data-island]")?.hasAttribute("data-focused"),
      null,
      { timeout: 5000 },
    );
    await tabCount(page, 3);
    assert.deepEqual(launchers.errors, []);
    console.log("PASS section launchers jump across islands without replacing tabs");
  } finally {
    await launchers.close();
  }
  const modifiers = await fixture();
  try {
    const page = modifiers.page;
    await palette(page, "> Issues", "Alt+Enter");
    await tabCount(page, 2);
    assert.equal(await page.locator("[data-island]").count(), 2);
    await palette(page, "> Settings", "Meta+Enter");
    await page.waitForURL(`${app}/settings`);
    await tabCount(page, 2);
    await palette(page, "> Go home", "Control+Enter");
    await page.waitForURL(`${app}/`);
    await tabCount(page, 2);
    // A repository result uses the same modifiers as a command result.
    await palette(page, "@ project");
    await page.waitForURL(`${app}/demo/project/code`);
    await tabCount(page, 3);
    await palette(page, "> Issues");
    await page.waitForURL(`${app}/demo/project/issues`);
    await tabCount(page, 3);
    assert.equal(await page.locator("[data-island]").first().getAttribute("data-focused"), "true");
    assert.deepEqual(modifiers.errors, []);
    console.log("PASS palette Alt/Meta/Ctrl Enter, result launchers and cross-island jumps");
  } finally {
    await modifiers.close();
  }
  const lifetime = await fixture();
  try {
    const page = lifetime.page;
    await issueLink(page, 1).click();
    await page.waitForURL(`${app}/demo/project/issues/1`);
    const originalId = await page.getByRole("tab").first().getAttribute("data-tab-id");
    for (let index = 0; index < 8; index++) {
      await page.locator('[data-tab-id][aria-selected="true"]').click({ button: "right" });
      await page.getByRole("menuitem", { name: "Duplicate tab", exact: true }).click();
      await tabCount(page, index + 2);
    }
    assert.equal(await page.locator(`[data-tab-pane="${originalId}"]`).count(), 0);
    await page.getByRole("button", { name: "Show all tabs", exact: true }).click();
    await page.getByRole("menuitem").first().click();
    await page.goBack();
    await issueLink(page, 1).waitFor();
    assert.equal(new URL(page.url()).pathname, "/demo/project/issues");
    await page.goForward();
    await page.getByRole("heading", { name: /Navigation issue 1/ }).waitFor();
    assert.equal(new URL(page.url()).pathname, "/demo/project/issues/1");
    assert.deepEqual(lifetime.errors, []);
    console.log("PASS released tabs retain back/forward history after reopening from overflow");
  } finally {
    await lifetime.close();
  }
} finally {
  await browser.close();
  server?.kill();
}
