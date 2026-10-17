import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { setTimeout as delay } from "node:timers/promises";
import { chromium } from "playwright";

const app = process.env.UI_BASE_URL || "http://127.0.0.1:5223";
assert.ok(["localhost", "127.0.0.1"].includes(new URL(app).hostname));
const server = process.env.UI_BASE_URL
  ? null
  : spawn(
      process.execPath,
      ["node_modules/vite/bin/vite.js", "--host", "127.0.0.1", "--port", "5223", "--strictPort"],
      { stdio: ["ignore", "pipe", "pipe"] },
    );
let log = "";
server?.stdout.on("data", (chunk) => (log += chunk));
server?.stderr.on("data", (chunk) => (log += chunk));
process.once("exit", () => server?.kill());
for (let i = 0; ; i++) {
  try {
    if ((await fetch(app)).ok) break;
  } catch {}
  if (i === 100 || server?.exitCode != null) throw Error(log);
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
  description: "Sidebar fixture",
  topics: [],
  language: "TypeScript",
  stargazers_count: 0,
  forks_count: 0,
  open_issues_count: 2,
  html_url: "https://github.com/demo/project",
  pushed_at: "2026-10-01T12:00:00Z",
  updated_at: "2026-10-01T12:00:00Z",
};
const repos = [
  "project",
  "phoenix",
  "alpha",
  "beta",
  "cat",
  "dog",
  "echo",
  "foxtrot",
  "golf",
  "hotel",
].map((name, i) => ({ ...repo, id: i + 1, name, full_name: `demo/${name}` }));
const prs = (prefix, start) =>
  Array.from({ length: 7 }, (_, i) => ({
    id: start + i,
    number: start + i,
    title: `${prefix} ${i + 1}`,
    state: "open",
    user: actor,
    body: "Fixture",
    labels: [],
    assignees: [],
    comments: 0,
    created_at: "2026-01-01T12:00:00Z",
    updated_at: "2026-01-01T12:00:00Z",
    closed_at: null,
    html_url: `https://github.com/demo/project/pull/${start + i}`,
    repository_url: "https://api.github.com/repos/demo/project",
    pull_request: {
      url: `https://api.github.com/repos/demo/project/pulls/${start + i}`,
      html_url: `https://github.com/demo/project/pull/${start + i}`,
      diff_url: "",
      patch_url: "",
    },
  }));

async function fixture({ empty = false, failUnstar = false } = {}) {
  const context = await browser.newContext({
    viewport: { width: 1440, height: 1000 },
    reducedMotion: "reduce",
  });
  await context.addInitScript(() =>
    localStorage.setItem(
      "githut.auth",
      JSON.stringify({ state: { token: "fixture", accountId: 1 }, version: 0 }),
    ),
  );
  const queries = [];
  const writes = [];
  let currentStars = empty ? [] : [...repos];
  await context.route("https://api.github.com/**", async (route) => {
    const url = new URL(route.request().url());
    const path = url.pathname;
    if (route.request().method() === "DELETE" && path.startsWith("/user/starred/")) {
      writes.push(path);
      if (failUnstar)
        return route.fulfill({
          status: 500,
          contentType: "application/json",
          body: JSON.stringify({ message: "Fixture: could not unstar" }),
        });
      currentStars = currentStars.filter((repo) => path !== `/user/starred/${repo.full_name}`);
      return route.fulfill({ status: 204, body: "" });
    }
    let data = [];
    const headers = { "access-control-expose-headers": "link" };
    if (path === "/user" || path === "/users/demo") data = actor;
    else if (path === "/user/repos") {
      const second = url.searchParams.get("page") === "2";
      data = empty ? [] : second ? repos.slice(8) : repos.slice(0, 8);
      if (!empty && !second)
        headers.link = '<https://api.github.com/user/repos?page=2>; rel="next"';
    } else if (path === "/user/orgs") data = [{ id: 9, login: "company" }];
    else if (path === "/orgs/company/repos") {
      queries.push("org-repos");
      data = [{ ...repo, id: 90, name: "member-only", full_name: "company/member-only" }];
    } else if (path === "/user/starred") {
      const page = Number(url.searchParams.get("page"));
      data = page === 1 ? currentStars.slice(0, 8) : currentStars.slice(8);
      if (page === 1 && currentStars.length > 8)
        headers.link = '<https://api.github.com/user/starred?page=2>; rel="next"';
    } else if (/^\/repos\/demo\/[^/]+$/.test(path))
      data = repos.find((r) => path.endsWith(r.name)) ?? repo;
    else if (path === "/search/issues") {
      const q = url.searchParams.get("q");
      queries.push(q);
      const items = empty
        ? []
        : q.includes("review-requested:")
          ? prs("Review requested", 10)
          : q.includes("author:")
            ? prs("Authored PR", 30)
            : [];
      data = { total_count: items.length, incomplete_results: false, items };
    } else if (path.endsWith("/actions/runs")) data = { total_count: 0, workflow_runs: [] };
    await route.fulfill({ contentType: "application/json", headers, body: JSON.stringify(data) });
  });
  await context.route("**/api/**", (route) =>
    route.fulfill({ contentType: "application/json", body: "{}" }),
  );
  const page = await context.newPage();
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto(`${app}/demo/project/issues`);
  return {
    page,
    errors,
    queries,
    writes,
    goOffline: () => context.setOffline(true),
    close: () => context.close(),
  };
}

try {
  const f = await fixture();
  try {
    const sidebar = f.page.getByRole("complementary", { name: "Sidebar" });
    const section = sidebar.getByRole("region", { name: "Your repos" });
    await section.locator("[data-sidebar-row]").first().waitFor({ timeout: 5000 });
    assert.equal(await section.locator("[data-sidebar-row]").count(), 6);
    assert.equal(await sidebar.getByRole("region", { name: "Starred" }).count(), 0);
    assert.equal(await sidebar.getByRole("region", { name: "Recent", exact: true }).count(), 0);
    assert.equal(await sidebar.getByRole("region", { name: "Your work" }).count(), 0);
    assert.equal(f.queries.includes("org-repos"), false);
    await section.getByRole("button", { name: "Show more" }).click();
    assert.equal(await section.locator("[data-sidebar-row]").count(), 10);
    await sidebar.getByRole("button", { name: "company repositories" }).focus();
    await f.page.keyboard.press("Enter");
    await sidebar
      .getByRole("button", { name: "member-only · company/member-only", exact: true })
      .waitFor();
    assert.equal(f.queries.filter((q) => q === "org-repos").length, 1);
    assert.equal(await section.getByText("member-only").count(), 0);
    assert.deepEqual(f.errors, []);
    console.log(
      "PASS quiet initial lists, complete pagination and keyboard-lazy organization browsing",
    );
  } finally {
    await f.close();
  }
  const favorites = await fixture();
  try {
    const page = favorites.page;
    const sidebar = page.getByRole("complementary", { name: "Sidebar" });
    const section = sidebar.getByRole("region", { name: "Favorites" });
    await sidebar
      .getByRole("button", { name: "Favorite project · demo/project", exact: true })
      .click();
    await sidebar.getByRole("button", { name: "Favorite current view", exact: true }).click();
    await section
      .getByRole("button", { name: "project · Issues · demo/project", exact: true })
      .waitFor();
    assert.equal(await section.locator("[data-sidebar-row]").count(), 2);
    await page.reload();
    await section
      .getByRole("button", { name: "project · Issues · demo/project", exact: true })
      .waitFor();
    await section.getByRole("button", { name: "project · demo/project", exact: true }).click();
    await page.waitForURL(`${app}/demo/project/code`);
    await section
      .getByRole("button", { name: "project · Issues · demo/project", exact: true })
      .click();
    await page.waitForURL(`${app}/demo/project/issues`);
    await section
      .getByRole("button", { name: "Remove favorite project · demo/project", exact: true })
      .click();
    assert.equal(await section.locator("[data-sidebar-row]").count(), 1);
    await page.evaluate(async () => {
      const { useAuthStore } = await import("/src/app/stores/auth.ts");
      useAuthStore.getState().setToken("account-b", 2);
    });
    await section.getByText("Keep repos and views here.").waitFor();
    assert.equal(await section.locator("[data-sidebar-row]").count(), 0);
    await page.evaluate(async () => {
      const { useAuthStore } = await import("/src/app/stores/auth.ts");
      useAuthStore.getState().setToken("fixture", 1);
    });
    await section
      .getByRole("button", { name: "project · Issues · demo/project", exact: true })
      .waitFor();
    if (process.env.SIDEBAR_SCREENSHOT)
      await page.screenshot({ path: process.env.SIDEBAR_SCREENSHOT });
    await page.setViewportSize({ width: 640, height: 900 });
    await page.keyboard.press("Control+b");
    await page.getByRole("dialog", { name: "Sidebar" }).waitFor();
    if (process.env.DRAWER_SCREENSHOT)
      await page.screenshot({ path: process.env.DRAWER_SCREENSHOT });
    assert.deepEqual(favorites.writes, []);
    assert.deepEqual(favorites.errors, []);
    console.log(
      "PASS independent local repo/view favorites, reload, verified account isolation, desktop and drawer",
    );
  } finally {
    await favorites.close();
  }
  const navigation = await fixture();
  try {
    const page = navigation.page;
    const sidebar = page.getByRole("complementary", { name: "Sidebar" });
    const stars = sidebar.getByRole("region", { name: "Your repos" });
    await stars.getByRole("button", { name: "project · demo/project", exact: true }).waitFor();
    await stars.getByRole("button", { name: "project · demo/project", exact: true }).click();
    await page.waitForURL(`${app}/demo/project/code`);
    await stars.getByRole("button", { name: "project · demo/project", exact: true }).click();
    assert.equal(await page.getByRole("tab").count(), 2);
    await stars
      .getByRole("button", { name: "phoenix · demo/phoenix", exact: true })
      .click({ modifiers: ["Alt"] });
    await page.waitForURL(`${app}/demo/phoenix/code`);
    assert.equal(await page.locator("[data-island]").count(), 2);
    await stars.getByRole("button", { name: "project · demo/project", exact: true }).click();
    await page.waitForURL(`${app}/demo/project/code`);
    assert.equal(await page.getByRole("tab").count(), 3);
    assert.equal(await page.locator("[data-island]").first().getAttribute("data-focused"), "true");
    assert.equal(
      await stars
        .getByRole("button", { name: "project · demo/project", exact: true })
        .getAttribute("aria-current"),
      "page",
    );
    assert.equal(
      await stars
        .getByRole("button", { name: "project · demo/project", exact: true })
        .getByLabel("Has open tabs")
        .count(),
      1,
    );
    assert.equal(
      await stars
        .getByRole("button", { name: "project · demo/project", exact: true })
        .locator("[data-repo-mark]")
        .innerText(),
      "Pr",
    );
    await sidebar.getByRole("textbox", { name: "Filter sidebar" }).fill("phoenix");
    assert.equal(await stars.locator("[data-sidebar-row]").count(), 1);
    await sidebar.getByRole("textbox", { name: "Filter sidebar" }).fill("");
    await stars
      .getByRole("button", { name: "phoenix · demo/phoenix", exact: true })
      .click({ button: "right" });
    await page.getByRole("menuitem", { name: "Open in new tab", exact: true }).click();
    await page.getByRole("menu").waitFor({ state: "hidden" });
    await page.waitForURL(`${app}/demo/phoenix/code`);
    assert.equal(await page.getByRole("tab").count(), 4);
    assert.equal(await page.locator("[data-island]").first().getAttribute("data-focused"), "true");
    assert.deepEqual(navigation.errors, []);
    console.log(
      "PASS launcher jump, Alt side, menu duplicate, filtering, open indicators and shared repo marks",
    );
  } finally {
    await navigation.close();
  }
  const resize = await fixture();
  try {
    const page = resize.page;
    const sidebar = page.getByRole("complementary", { name: "Sidebar" });
    const mark = sidebar
      .getByRole("region", { name: "Your repos" })
      .getByRole("button", { name: "project · demo/project", exact: true })
      .locator("[data-repo-mark]");
    await mark.waitFor();
    const before = await mark.boundingBox();
    await page.getByRole("button", { name: "Collapse sidebar", exact: true }).click();
    assert.equal((await sidebar.boundingBox()).width, 40);
    assert.equal((await mark.boundingBox()).x, before.x);
    await page.keyboard.press("Control+b");
    assert.equal((await sidebar.boundingBox()).width, 240);
    const separator = page.getByRole("separator", { name: "Resize sidebar" });
    await separator.focus();
    await page.keyboard.press("End");
    assert.equal((await sidebar.boundingBox()).width, 360);
    await page.reload();
    await sidebar.waitFor();
    assert.equal((await sidebar.boundingBox()).width, 360);
    const box = await separator.boundingBox();
    await page.mouse.move(box.x + 4, box.y + 100);
    await page.mouse.down();
    await page.mouse.move(box.x - 250, box.y + 100, { steps: 10 });
    await page.mouse.up();
    assert.equal((await sidebar.boundingBox()).width, 40);
    await separator.dblclick();
    assert.equal((await sidebar.boundingBox()).width, 240);
    assert.deepEqual(resize.errors, []);
    console.log(
      "PASS logo and keyboard collapse keep icons fixed, resize snaps, persists and resets",
    );
  } finally {
    await resize.close();
  }
  const drag = await fixture();
  try {
    const page = drag.page;
    await page.setViewportSize({ width: 2200, height: 1000 });
    const stars = page
      .getByRole("complementary", { name: "Sidebar" })
      .getByRole("region", { name: "Your repos" });
    await stars.getByRole("button", { name: "alpha · demo/alpha", exact: true }).waitFor();
    await stars.getByRole("button", { name: "Show more" }).click();
    const move = async (name, x, y) => {
      const from = await stars
        .getByRole("button", { name: `${name} · demo/${name}`, exact: true })
        .boundingBox();
      await page.mouse.move(from.x + 16, from.y + 16);
      await page.mouse.down();
      await page.mouse.move(x, y, { steps: 12 });
      await page.locator("[data-dock-preview]").waitFor();
    };
    let island = await page.locator("[data-island]").first().boundingBox();
    await move("alpha", island.x + island.width / 2, island.y + island.height / 2);
    await page.mouse.up();
    await page.waitForURL(`${app}/demo/alpha/code`);
    assert.equal(await page.getByRole("tab").count(), 2);
    const firstTab = await page.getByRole("tab").first().boundingBox();
    await move("beta", firstTab.x + 1, firstTab.y + firstTab.height / 2);
    assert.equal(
      await page.locator("[data-dock-preview]").getAttribute("data-dock-preview"),
      "insert",
    );
    await page.mouse.up();
    await page.waitForURL(`${app}/demo/beta/code`);
    assert.equal(await page.getByRole("tab").count(), 3);
    await page.getByRole("tab").first().click();
    assert.equal(new URL(page.url()).pathname, "/demo/beta/code");
    island = await page.locator("[data-island]").first().boundingBox();
    await move("cat", island.x + island.width - 45, island.y + island.height / 2);
    assert.equal(
      await page.locator("[data-dock-preview]").getAttribute("data-dock-preview"),
      "island-edge",
    );
    await page.mouse.up();
    await page.waitForURL(`${app}/demo/cat/code`);
    assert.equal(await page.locator("[data-island]").count(), 2);
    const workspace = await page.locator("[data-workspace-area]").boundingBox();
    const layout = await page.locator("[data-workspace-layout]").boundingBox();
    await move("dog", workspace.x + 2, workspace.y + workspace.height / 2);
    assert.equal(
      await page.locator("[data-dock-preview]").getAttribute("data-dock-preview"),
      "workspace-edge",
    );
    assert.equal((await page.locator("[data-dock-preview]").boundingBox()).x, layout.x);
    await page.mouse.up();
    await page.waitForURL(`${app}/demo/dog/code`);
    assert.equal(await page.locator("[data-island]").count(), 3);
    assert.equal(await page.getByRole("tab").count(), 5);
    await move("echo", workspace.x + 2, workspace.y + workspace.height / 2);
    await page.keyboard.press("Escape");
    await page.mouse.up();
    assert.equal(await page.getByRole("tab").count(), 5);
    assert.deepEqual(drag.errors, []);
    if (process.env.SIDEBAR_SCREENSHOT)
      await page.screenshot({ path: process.env.SIDEBAR_SCREENSHOT });
    console.log(
      "PASS sidebar dragging inserts in strips, adds at island and window edges, and cancels with Escape",
    );
  } finally {
    await drag.close();
  }
} finally {
  await browser.close();
  server?.kill();
}
