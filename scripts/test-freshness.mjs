import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { setTimeout as delay } from "node:timers/promises";
import { chromium } from "playwright";

const app = process.env.UI_BASE_URL || "http://127.0.0.1:5193";
assert.ok(["localhost", "127.0.0.1"].includes(new URL(app).hostname));
const server = process.env.UI_BASE_URL
  ? null
  : spawn(
      process.execPath,
      ["node_modules/vite/bin/vite.js", "--host", "127.0.0.1", "--port", "5193", "--strictPort"],
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
const now = "2026-10-17T12:00:00Z";
const actor = {
  id: 1,
  login: "demo",
  name: "Demo",
  avatar_url: "",
  html_url: "https://github.com/demo",
  type: "User",
};
const repo = {
  id: 1,
  name: "project",
  full_name: "demo/project",
  private: false,
  fork: false,
  html_url: "https://github.com/demo/project",
  description: null,
  homepage: null,
  language: null,
  default_branch: "main",
  stargazers_count: 0,
  watchers_count: 0,
  forks_count: 0,
  open_issues_count: 0,
  topics: [],
  pushed_at: now,
  updated_at: now,
  license: null,
  owner: actor,
};
const ref = { label: "demo:main", ref: "main", sha: "a".repeat(40), repo };
const pr = {
  id: 1,
  number: 1,
  node_id: "PR_1",
  title: "Fresh pull request",
  state: "open",
  locked: false,
  url: "https://api.github.com/repos/demo/project/pulls/1",
  html_url: "https://github.com/demo/project/pull/1",
  created_at: now,
  updated_at: now,
  user: actor,
  body: "Review discussion",
  comments: 1,
  review_comments: 0,
  commits: 1,
  additions: 0,
  deletions: 0,
  changed_files: 0,
  head: ref,
  base: ref,
};
const comment = {
  id: 1,
  node_id: "C_1",
  user: actor,
  body: "Original comment",
  created_at: now,
  updated_at: now,
  url: "https://api.github.com/repos/demo/project/issues/comments/1",
  html_url: "https://github.com/demo/project/pull/1#issuecomment-1",
};
const run = {
  id: 100,
  name: "Checks",
  display_title: "Visible running workflow",
  head_branch: "main",
  head_sha: ref.sha,
  path: ".github/workflows/check.yml",
  run_number: 1,
  run_attempt: 1,
  event: "push",
  status: "in_progress",
  conclusion: null,
  workflow_id: 20,
  url: "https://api.github.com/repos/demo/project/actions/runs/100",
  html_url: "https://github.com/demo/project/actions/runs/100",
  created_at: now,
  updated_at: now,
  actor,
  triggering_actor: actor,
  head_commit: null,
};
let browser;
try {
  for (let attempt = 0; ; attempt++) {
    try {
      if ((await fetch(app)).ok) break;
    } catch {}
    if (attempt === 100 || server?.exitCode != null) throw new Error(log);
    await delay(200);
  }
  browser = await chromium.launch({ headless: true, args: ["--no-sandbox"] });
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  await context.addInitScript(() =>
    localStorage.setItem(
      "githut.auth",
      JSON.stringify({ state: { token: "fixture" }, version: 0 }),
    ),
  );
  const requests = [];
  let hasNewComment = false;
  let lowReset = 0;
  await context.route("https://api.github.com/**", (route) => {
    const path = new URL(route.request().url()).pathname;
    requests.push({ path, headers: route.request().headers() });
    if (path === "/graphql")
      return route.fulfill({ json: { data: { repository: { pullRequest: null } } } });
    if (path.endsWith("/actions/runs/100/cancel") && route.request().method() === "POST") {
      return route.fulfill({ status: 202, json: {} });
    }
    assert.equal(route.request().method(), "GET", "Fixtures never mutate GitHub");
    const body =
      path === "/user"
        ? actor
        : path === "/repos/demo/project"
          ? repo
          : path.endsWith("/pulls/1")
            ? pr
            : path.endsWith("/pulls/2")
              ? { ...pr, id: 2, number: 2, title: "Other PR" }
              : path.endsWith("/issues/1/comments")
                ? hasNewComment
                  ? [comment, { ...comment, id: 2, body: "Comment delivered by polling" }]
                  : [comment]
                : path.endsWith("/actions/runs/100")
                  ? run
                  : path.endsWith("/jobs")
                    ? { total_count: 0, jobs: [] }
                    : path.endsWith("/artifacts")
                      ? { total_count: 0, artifacts: [] }
                      : path.endsWith("/check-runs")
                        ? { total_count: 0, check_runs: [] }
                        : path.endsWith("/status")
                          ? { state: "success", total_count: 0, statuses: [] }
                          : path === "/search/issues"
                            ? { total_count: 0, incomplete_results: false, items: [] }
                            : [];
    return route.fulfill({
      json: body,
      headers: {
        etag: '"fixture"',
        "access-control-expose-headers":
          "etag,x-ratelimit-limit,x-ratelimit-remaining,x-ratelimit-reset",
        ...(lowReset
          ? {
              "x-ratelimit-limit": "5000",
              "x-ratelimit-remaining": "499",
              "x-ratelimit-reset": String(lowReset),
            }
          : {}),
      },
    });
  });
  await context.route("https://cloud.umami.is/**", (route) => route.fulfill({ body: "" }));
  const page = await context.newPage();
  await page.clock.install({ time: new Date(now) });
  await page.goto(`${app}/demo/project/pull/1`);
  await page.getByText("Original comment", { exact: true }).waitFor();
  hasNewComment = true;
  await page.clock.fastForward(16_000);
  await page.getByText("Comment delivered by polling", { exact: true }).waitFor({ timeout: 3000 });
  assert.ok(
    requests.filter((request) => request.path.endsWith("/issues/1/comments")).at(-1).headers[
      "if-none-match"
    ],
  );
  console.log("PASS: focused PR receives comments within 15 seconds using conditional GET");
  await delay(150);
  await page.evaluate(() => {
    Object.defineProperty(document, "visibilityState", { configurable: true, value: "hidden" });
    document.dispatchEvent(new Event("visibilitychange"));
  });
  const paused = requests.length;
  await page.clock.fastForward(60_000);
  await delay(150);
  assert.equal(requests.length, paused, "Hidden window must not fetch");
  await page.evaluate(() => {
    Object.defineProperty(document, "visibilityState", { configurable: true, value: "visible" });
    document.dispatchEvent(new Event("visibilitychange"));
  });
  await delay(150);
  assert.ok(requests.length > paused, "Returning refreshes stale data");
  console.log("PASS: hidden window pauses requests and returning refreshes stale data");

  lowReset = Math.floor((await page.evaluate(() => Date.now())) / 1000) + 180;
  await page.clock.fastForward(16_000);
  await page.getByText("Updates slowed", { exact: true }).waitFor({ timeout: 3000 });
  await delay(150);
  const countComments = () =>
    requests.filter((request) => request.path.endsWith("/issues/1/comments")).length;
  const slowed = countComments();
  await page.clock.fastForward(59_000);
  await delay(150);
  assert.equal(countComments(), slowed);
  await page.clock.fastForward(2000);
  await delay(150);
  assert.equal(countComments(), slowed + 1);
  await page.clock.fastForward(125_000);
  await page
    .getByText("Updates slowed", { exact: true })
    .waitFor({ state: "hidden", timeout: 3000 });
  console.log("PASS: low quota slows updates fourfold and notice clears at reset");

  lowReset = 0;
  await page.addInitScript(() => {
    // Layouts are saved per verified account; seed both the unscoped and account copy.
    const layout = JSON.stringify({
      version: 1,
      workspace: {
        layout: {
          kind: "split",
          id: "split",
          direction: "row",
          sizes: [0.5, 0.5],
          children: [
            {
              kind: "island",
              id: "discussion",
              tabs: [
                { id: "pr", href: "/demo/project/pull/1" },
                { id: "background", href: "/demo/project/pull/2" },
              ],
              selectedTabId: "pr",
              pinned: [],
            },
            {
              kind: "island",
              id: "ci",
              tabs: [{ id: "run", href: "/demo/project/actions/runs/100" }],
              selectedTabId: "run",
              pinned: [],
            },
          ],
        },
        focusedIslandId: "discussion",
        maximizedIslandId: null,
      },
    });
    for (const key of ["githut.workspace.window", "githut.workspace.window.account.1"])
      sessionStorage.setItem(key, layout);
  });
  await page.reload();
  await page.getByRole("heading", { name: /Visible running workflow/ }).waitFor();
  await page.getByText("Original comment", { exact: true }).waitFor();
  await delay(150);
  const countRun = () =>
    requests.filter((request) => request.path.endsWith("/actions/runs/100")).length;
  const running = countRun();
  await page.clock.fastForward(3100);
  await delay(150);
  assert.equal(countRun(), running + 1, "Visible non-focused CI uses exactly one fast refresh");
  console.log("PASS: non-focused visible CI refreshes at 3 seconds without duplicate polling");

  await page.locator('[data-tab-id="background"]').click();
  await page.getByRole("heading", { name: /Other PR/ }).waitFor();
  await page.locator('[data-tab-id="pr"]').click();
  await delay(150);
  const backgroundRequests = () =>
    requests.filter((request) => /\/(pulls|issues)\/2(?:\/|$)/.test(request.path)).length;
  const background = backgroundRequests();
  await page.clock.fastForward(61_000);
  await delay(150);
  assert.equal(backgroundRequests(), background);
  await page.locator('[data-tab-id="background"]').click();
  await delay(150);
  assert.ok(backgroundRequests() > background, "Focusing a stale tab refreshes it immediately");
  console.log("PASS: background tab makes no requests and refreshes when focused");

  await Promise.all([
    page.waitForResponse((response) => response.url().endsWith("/actions/runs/100/cancel")),
    page.getByRole("button", { name: "Cancel workflow", exact: true }).click(),
  ]);
  await delay(150);
  await page.evaluate(() => {
    Object.defineProperty(document, "visibilityState", { configurable: true, value: "hidden" });
    document.dispatchEvent(new Event("visibilitychange"));
  });
  const commandPaused = countRun();
  await page.clock.fastForward(3100);
  await delay(150);
  assert.equal(
    countRun(),
    commandPaused,
    "Accepted Actions command must not install a separate hidden-window polling loop",
  );
  console.log("PASS: accepted Actions command shares the workspace polling lifecycle");
} finally {
  await browser?.close();
  server?.kill();
}
