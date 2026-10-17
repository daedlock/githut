import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { setTimeout as delay } from "node:timers/promises";
import { chromium } from "playwright";

const app = process.env.UI_BASE_URL || "http://127.0.0.1:5194";
assert.ok(["localhost", "127.0.0.1"].includes(new URL(app).hostname));
const server = process.env.UI_BASE_URL
  ? null
  : spawn(
      process.execPath,
      ["node_modules/vite/bin/vite.js", "--host", "127.0.0.1", "--port", "5194", "--strictPort"],
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
  let comments = Array.from({ length: 40 }, (_, index) => ({
    ...comment,
    id: index + 1,
    body: `Discussion comment ${index + 1}\n\nA detailed explanation for the reader.\n\nMore context to keep this discussion long.`,
    created_at: new Date(Date.parse(now) + index * 1000).toISOString(),
  }));
  const lowReset = 0;
  let listItems = [201, 202].map((id, index) => ({
    ...pr,
    id,
    number: id,
    title: index ? "List row Beta" : "List row Alpha",
    repository_url: "https://api.github.com/repos/demo/project",
    labels: [],
    closed_at: null,
    pull_request: { url: `https://api.github.com/repos/demo/project/pulls/${id}` },
  }));
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
      path === "/user/repos"
        ? [repo, { ...repo, id: 2, name: "satellite", full_name: "demo/satellite" }]
        : path === "/user"
          ? actor
          : path === "/repos/demo/project"
            ? repo
            : path.endsWith("/pulls/1")
              ? pr
              : path.endsWith("/pulls/2")
                ? { ...pr, id: 2, number: 2, title: "Other PR" }
                : path.endsWith("/project/issues")
                  ? listItems.map(({ pull_request, ...item }) => item)
                  : path.endsWith("/issues/9")
                    ? {
                        ...pr,
                        id: 9,
                        number: 9,
                        title: "Issue discussion",
                        labels: [],
                        closed_at: null,
                      }
                    : /\/issues\/(1|9)\/comments$/.test(path)
                      ? comments
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
                                  ? {
                                      total_count: listItems.length,
                                      incomplete_results: false,
                                      items: listItems,
                                    }
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
  const content = page.locator("[data-tab-pane]").filter({ visible: true });
  let releaseImage;
  await context.route(
    "https://example.test/late.svg",
    (route) =>
      new Promise((resolve) => {
        releaseImage = () =>
          route
            .fulfill({
              contentType: "image/svg+xml",
              body: '<svg xmlns="http://www.w3.org/2000/svg" width="600" height="400"><rect width="600" height="400" fill="gray"/></svg>',
            })
            .then(resolve);
      }),
  );
  await page.clock.install({ time: new Date(now) });
  await page.goto(`${app}/demo/project/pull/1`);
  const reader = content.getByText("Discussion comment 20", { exact: true });
  await reader.scrollIntoViewIfNeeded();
  const scroller = page.locator("[data-tab-pane]").filter({ visible: true });
  const before = await scroller.evaluate((element) => element.scrollTop);
  comments = [
    ...comments,
    {
      ...comment,
      id: 101,
      body: "Incoming comment below the fold",
      created_at: "2026-10-17T12:01:00Z",
    },
  ];
  await page.clock.fastForward(16_000);
  const pill = page.getByRole("button", { name: "1 new ↓", exact: true });
  await pill.waitFor({ timeout: 5000 });
  assert.equal(await scroller.evaluate((element) => element.scrollTop), before);
  await pill.click({ timeout: 5000 });
  const incoming = content.getByText("Incoming comment below the fold", { exact: true });
  assert.ok(
    await incoming.evaluate((element) => {
      const bounds = element.getBoundingClientRect();
      const viewport = element.closest("[data-tab-pane]").getBoundingClientRect();
      return bounds.top >= viewport.top && bounds.bottom <= viewport.bottom;
    }),
    "Jump reveals the incoming comment",
  );
  console.log("PASS: incoming PR comment preserves scroll and the new-content pill reveals it");
  const highlight = () =>
    incoming.evaluate(
      (element) => getComputedStyle(element.closest("[data-live-item]")).backgroundColor,
    );
  assert.equal(await highlight(), "rgba(0, 0, 0, 0)", "Incoming items are not flashed");
  console.log("PASS: incoming content is not highlighted");

  await reader.scrollIntoViewIfNeeded();
  const anchorTop = (await reader.boundingBox()).y;
  comments = [
    {
      ...comment,
      id: 102,
      body: "Older event delivered late\n\nContext inserted above the reader.",
      created_at: "2026-10-17T11:59:00Z",
    },
    ...comments,
  ];
  await page.clock.fastForward(16_000);
  await content.getByText("Older event delivered late", { exact: true }).waitFor();
  assert.ok(
    Math.abs((await reader.boundingBox()).y - anchorTop) <= 1,
    "An insertion above keeps the same text at the same viewport position",
  );
  console.log("PASS: content inserted above preserves the reading anchor");
  comments = [
    {
      ...comment,
      id: 104,
      body: "Attachment delivered late\n\n![Late attachment](https://example.test/late.svg)",
      created_at: "2026-10-17T11:58:00Z",
    },
    ...comments,
  ];
  await page.clock.fastForward(16_000);
  await content.getByText("Attachment delivered late", { exact: true }).waitFor();
  await releaseImage();
  await page
    .getByRole("img", { name: "Late attachment", exact: true })
    .evaluate((element) => element.decode());
  await delay(100);
  assert.ok(
    Math.abs((await reader.boundingBox()).y - anchorTop) <= 1,
    "Late image dimensions above the reader preserve the anchor too",
  );
  console.log("PASS: delayed attachments above the reader preserve the anchor");

  await page.goto(`${app}/demo/project/issues/9`);
  await content.getByText("Discussion comment 20", { exact: true }).scrollIntoViewIfNeeded();
  const issueScroll = await scroller.evaluate((element) => element.scrollTop);
  comments = [
    ...comments,
    { ...comment, id: 103, body: "New issue reply", created_at: "2026-10-17T12:02:00Z" },
  ];
  await page.clock.fastForward(16_000);
  await pill.waitFor({ timeout: 5000 });
  assert.equal(await scroller.evaluate((element) => element.scrollTop), issueScroll);
  await pill.click();
  assert.ok(
    await content.getByText("New issue reply", { exact: true }).evaluate((element) => {
      const bounds = element.getBoundingClientRect();
      const viewport = element.closest("[data-tab-pane]").getBoundingClientRect();
      return bounds.top >= viewport.top && bounds.bottom <= viewport.bottom;
    }),
  );
  console.log("PASS: issue conversation uses the same non-disruptive updates");

  await page.goto(`${app}/demo/project/pulls`);
  const alpha = content.getByText(/^List row Alpha/);
  const beta = content.getByText("List row Beta", { exact: true });
  await alpha.waitFor();
  await alpha.hover();
  const rowTop = (await alpha.boundingBox()).y;
  listItems = [
    { ...listItems[0], id: 203, number: 203, title: "List row Gamma" },
    listItems[1],
    { ...listItems[0], title: "List row Alpha updated" },
  ];
  await Promise.all([
    page.waitForResponse(
      (response) =>
        response.url().includes("/search/issues?") &&
        new URL(response.url()).searchParams.get("per_page") === "30",
    ),
    page.clock.fastForward(16_000),
  ]);
  await delay(150);
  await content.getByText("List row Alpha updated", { exact: true }).waitFor({ timeout: 3000 });
  assert.equal(
    (await alpha.boundingBox()).y,
    rowTop,
    "Polling must not move the row under the pointer",
  );
  assert.ok((await alpha.boundingBox()).y < (await beta.boundingBox()).y);
  await page.mouse.move(0, 0);
  await delay(100);
  assert.ok(
    (await beta.boundingBox()).y < (await alpha.boundingBox()).y,
    "Latest order applies on pointer leave",
  );
  assert.ok(
    await page.getByText("List row Gamma", { exact: true }).isVisible(),
    "A row that arrived while held is shown after reconciling",
  );
  console.log("PASS: PR rows keep their order under the pointer and reconcile on leave");

  await beta.hover();
  const beforeRemoval = (await beta.boundingBox()).y;
  listItems = listItems.filter((item) => item.id !== 203);
  await Promise.all([
    page.waitForResponse(
      (response) =>
        response.url().includes("/search/issues?") &&
        new URL(response.url()).searchParams.get("per_page") === "30",
    ),
    page.clock.fastForward(16_000),
  ]);
  await delay(100);
  assert.equal(
    (await beta.boundingBox()).y,
    beforeRemoval,
    "Removing a row above cannot move the pointer target",
  );
  await content.getByRole("textbox", { name: "Search pull requests", exact: true }).fill("Beta");
  assert.equal(
    await alpha.count(),
    0,
    "Explicit keyboard filter changes apply even while the pointer remains over the list",
  );
  console.log("PASS: removals wait under the pointer while explicit filters apply immediately");

  listItems = listItems.filter((item) => item.id !== 203).sort((a, b) => a.id - b.id);
  await page.goto(`${app}/demo/project/issues`);
  await alpha.waitFor();
  await alpha.hover();
  const issueRowTop = (await alpha.boundingBox()).y;
  listItems = [listItems[1], listItems[0]];
  await Promise.all([
    page.waitForResponse((response) =>
      new URL(response.url()).pathname.endsWith("/project/issues"),
    ),
    page.clock.fastForward(16_000),
  ]);
  await delay(150);
  assert.equal((await alpha.boundingBox()).y, issueRowTop);
  await page.mouse.move(0, 0);
  await delay(100);
  assert.ok((await beta.boundingBox()).y < (await alpha.boundingBox()).y);
  console.log("PASS: issue rows defer reordered responses while hovered");
  const survivingItems = listItems;
  for (const section of ["pulls", "issues"]) {
    await page.goto(`${app}/demo/project/${section}`);
    await alpha.waitFor();
    await alpha.hover();
    listItems = [];
    await Promise.all([
      page.waitForResponse((response) => {
        const url = new URL(response.url());
        return section === "pulls"
          ? url.pathname === "/search/issues" && url.searchParams.get("per_page") === "30"
          : url.pathname.endsWith("/project/issues");
      }),
      page.clock.fastForward(16_000),
    ]);
    await delay(100);
    assert.equal(await alpha.count(), 1, `${section} retains the final hovered rows`);
    await page.mouse.move(0, 0);
    await alpha.waitFor({ state: "hidden" });
    listItems = survivingItems;
  }
  console.log("PASS: empty refreshes preserve hovered PR and issue rows until leave");
  const stars = page.getByRole("region", { name: "Your repos", exact: true });
  const starOrder = () =>
    stars
      .locator("[data-sidebar-href]")
      .evaluateAll((rows) => rows.map((row) => row.dataset.sidebarHref));
  await stars.locator("[data-sidebar-row]").first().waitFor();
  const initialOrder = await starOrder();
  await stars.getByRole("button", { name: "satellite · demo/satellite", exact: true }).click();
  await page.waitForURL(`${app}/demo/satellite/code`);
  await delay(100);
  assert.deepEqual(
    await starOrder(),
    initialOrder,
    "Opening a repository must not move sidebar destinations",
  );
  await page.mouse.move(0, 0);
  await delay(100);
  assert.deepEqual(await starOrder(), initialOrder);
  console.log("PASS: repository navigation order stays stable across visits");
} finally {
  await browser?.close();
  server?.kill();
}
