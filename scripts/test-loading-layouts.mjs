import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { mkdir, writeFile } from "node:fs/promises";
import { setTimeout as delay } from "node:timers/promises";
import { chromium } from "playwright";

const out = "test-results/loading-layouts";
await mkdir(out, { recursive: true });
const app = process.env.UI_BASE_URL || "http://127.0.0.1:5176";
assert.ok(["localhost", "127.0.0.1"].includes(new URL(app).hostname), "Use a local test server");
const server = process.env.UI_BASE_URL
  ? null
  : spawn(
      process.execPath,
      ["node_modules/vite/bin/vite.js", "--host", "127.0.0.1", "--port", "5176", "--strictPort"],
      { stdio: ["ignore", "pipe", "pipe"] },
    );
let serverLog = "";
server?.stdout.on("data", (chunk) => (serverLog += chunk));
server?.stderr.on("data", (chunk) => (serverLog += chunk));
process.once("exit", () => server?.kill());
for (let attempt = 0; ; attempt++) {
  try {
    if ((await fetch(app)).ok) break;
  } catch {}
  if (attempt === 100 || server?.exitCode != null)
    throw new Error(`Test server did not start: ${serverLog}`);
  await delay(200);
}
const browser = await chromium.launch({ headless: true, args: ["--no-sandbox"] });
const now = "2026-09-18T12:00:00Z",
  sha = "a".repeat(40);
const actor = {
  id: 1,
  login: "demo",
  avatar_url: "",
  html_url: "https://github.com/demo",
  type: "User",
  name: "Demo User",
};
const repo = {
  id: 1,
  name: "project",
  full_name: "demo/project",
  private: false,
  fork: false,
  html_url: "https://github.com/demo/project",
  description: "A repository for loading-state checks.",
  homepage: null,
  language: "TypeScript",
  default_branch: "main",
  stargazers_count: 3,
  watchers_count: 3,
  forks_count: 0,
  open_issues_count: 1,
  topics: [],
  pushed_at: now,
  updated_at: now,
  license: null,
  owner: actor,
};
const ref = {
  label: "demo:main",
  ref: "main",
  sha,
  repo: { id: 1, name: "project", full_name: "demo/project" },
};
const issue = {
  id: 1,
  number: 1,
  title: "Keep loading layouts aligned",
  html_url: "https://github.com/demo/project/issues/1",
  state: "open",
  created_at: now,
  updated_at: now,
  closed_at: null,
  comments: 0,
  user: actor,
  labels: [],
  assignees: [],
  body: "Content arrives inside the same page container.",
};
const item = {
  ...issue,
  repository_url: "https://api.github.com/repos/demo/project",
  pull_request: { url: "https://api.github.com/repos/demo/project/pulls/1" },
};
const pr = {
  ...item,
  user: { ...actor, login: "author" },
  node_id: "PR_1",
  url: item.pull_request.url,
  locked: false,
  review_comments: 0,
  commits: 1,
  additions: 1,
  deletions: 1,
  changed_files: 2,
  head: ref,
  base: ref,
};
const file = {
  sha,
  filename: "src/main.ts",
  status: "modified",
  additions: 1,
  deletions: 1,
  changes: 2,
  blob_url: "",
  raw_url: "",
  contents_url: "",
  patch:
    "@@ -1,40 +1,40 @@\n" +
    Array.from({ length: 40 }, (_, i) => `-before ${i}\n+after ${i}`).join("\n"),
};
const commit = {
  sha,
  html_url: "https://github.com/demo/project/commit/" + sha,
  commit: {
    author: { name: "Demo", email: "demo@example.com", date: now },
    committer: { name: "Demo", email: "demo@example.com", date: now },
    message: "Keep loading layouts aligned",
  },
  author: actor,
  committer: actor,
  parents: [{ sha: "b".repeat(40), html_url: "" }],
  files: [file, { ...file, filename: "src/other.ts" }],
  stats: { additions: 2, deletions: 2, total: 4 },
};
const workflow = {
  id: 20,
  node_id: "w",
  name: "Checks",
  path: ".github/workflows/check.yml",
  state: "active",
  created_at: now,
  updated_at: now,
  html_url: "https://github.com/demo/project/actions/workflows/check.yml",
  badge_url: "",
};
const run = {
  id: 100,
  name: "Checks",
  display_title: "Check loading states",
  head_branch: "main",
  head_sha: sha,
  path: workflow.path,
  run_number: 42,
  run_attempt: 1,
  event: "push",
  status: "completed",
  conclusion: "success",
  workflow_id: 20,
  url: "",
  html_url: "https://github.com/demo/project/actions/runs/100",
  created_at: now,
  updated_at: now,
  run_started_at: now,
  actor,
  triggering_actor: actor,
  head_commit: null,
};
const content = (path, text) => ({
  type: "file",
  name: path.split("/").at(-1),
  path,
  sha,
  size: text.length,
  encoding: "base64",
  content: Buffer.from(text).toString("base64"),
  html_url: "",
  download_url: "",
});
const routes = [
  ["dashboard", "/"],
  ["profile", "/demo"],
  ["code", "/demo/project/code"],
  ["file", "/demo/project/code?path=src/main.ts&view=blob"],
  ["commits", "/demo/project/commits"],
  ["commit", "/demo/project/commit/" + sha],
  ["pulls", "/demo/project/pulls"],
  ["issues", "/demo/project/issues"],
  ["issue", "/demo/project/issues/1"],
  ["conversation", "/demo/project/pull/1"],
  ["pr-commits", "/demo/project/pull/1/commits"],
  ["checks", "/demo/project/pull/1/checks"],
  ["review", "/demo/project/pr/1"],
  ["actions", "/demo/project/actions"],
  ["run", "/demo/project/actions/runs/100"],
];
const report = [];
let activePage;
async function fixture(
  width,
  preset,
  { fail, hold = true, secondary, height = 900, bulk = false } = {},
) {
  const context = await browser.newContext({
    viewport: { width, height },
    reducedMotion: "reduce",
    colorScheme: "dark",
  });
  await context.addInitScript((preset) => {
    localStorage.setItem(
      "githut.auth",
      JSON.stringify({ state: { token: "fixture" }, version: 0 }),
    );
    localStorage.setItem(
      "githut.settings",
      JSON.stringify({ state: { containerWidth: preset }, version: 0 }),
    );
  }, preset);
  let released = !hold,
    resolve;
  const gate = new Promise((r) => (resolve = r));
  if (released) resolve();
  const errors = [],
    requests = [],
    submissions = [];
  const bulkRows = [1, 2, 3, 4].map((number) => ({
    ...issue,
    id: number,
    number,
    title: `Bulk item ${number}`,
    labels: [],
    assignees: [],
    ...(bulk === "pulls" ? { pull_request: item.pull_request } : {}),
  }));
  await context.route("https://api.github.com/**", async (route) => {
    const url = new URL(route.request().url()),
      path = url.pathname;
    requests.push(path);
    const json = (body, status = 200) =>
      route
        .fulfill({ status, contentType: "application/json", body: JSON.stringify(body) })
        .catch(() => {});
    if (bulk) {
      const method = route.request().method();
      if (path.endsWith("/labels") && method === "GET")
        return json([{ id: 1, name: "bug", color: "ff0000" }]);
      if (path.endsWith("/collaborators")) return json([actor]);
      if (path === "/search/issues") {
        const q = url.searchParams.get("q") ?? "";
        const items = bulkRows.filter((row) =>
          q.includes("is:closed")
            ? row.state === "closed"
            : !q.includes("is:open") || row.state === "open",
        );
        return json({ total_count: items.length, incomplete_results: false, items });
      }
      if (path.endsWith("/issues")) return json(bulkRows);
      if (method !== "GET" && path !== "/graphql") {
        const payload = route.request().postDataJSON();
        submissions.push({ path, method, payload });
        if (
          path.endsWith("/issues/2/labels") &&
          submissions.filter((s) => s.path === path).length === 1
        )
          return json({ message: "Permission denied" }, 403);
        // Writes persist, so refetches after a bulk update see its result.
        const row = bulkRows.find(
          (r) => r.number === Number(path.match(/\/(?:issues|pulls)\/(\d+)/)?.[1]),
        );
        if (row && payload?.state) {
          row.state = payload.state;
          row.state_reason = payload.state_reason ?? null;
          row.closed_at = payload.state === "closed" ? now : null;
        }
        if (row && path.endsWith("/labels"))
          row.labels.push(...payload.labels.map((name) => ({ id: 1, name, color: "ff0000" })));
        if (row && /\/labels\/[^/]+$/.test(path))
          row.labels = row.labels.filter((l) => !path.endsWith(`/labels/${l.name}`));
        if (row && path.endsWith("/assignees"))
          row.assignees =
            method === "POST"
              ? [...row.assignees, ...payload.assignees.map((login) => ({ ...actor, login }))]
              : row.assignees.filter((a) => !payload.assignees.includes(a.login));
        return json(path.endsWith("/labels") ? (row?.labels ?? []) : (row ?? issue));
      }
    }
    if (path === "/user") return json(actor);
    if (route.request().method() === "POST" && path.endsWith("/reviews")) {
      const payload = route.request().postDataJSON();
      submissions.push(payload);
      return json({
        id: 10,
        node_id: "review-10",
        user: actor,
        body: payload.body ?? "",
        state: "COMMENTED",
        html_url: "",
        pull_request_url: "",
        commit_id: sha,
        submitted_at: now,
      });
    }
    if (path === "/graphql") return json({ data: { repository: { pullRequest: null } } });
    // Fail closed: fixtures must never write to a real GitHub repository.
    assert.equal(route.request().method(), "GET", `Unexpected API mutation: ${path}`);

    if (!released && (!secondary || secondary(path))) await gate;
    if (fail?.(path)) return json({ message: "Fixture failure" }, 500);
    if (path === "/repos/demo/project") return json(repo);
    if (path === "/users/demo")
      return json({
        ...actor,
        company: null,
        blog: null,
        location: null,
        email: null,
        bio: "Demo profile",
        twitter_username: null,
        public_repos: 1,
        followers: 2,
        following: 3,
        created_at: now,
      });
    if (path.endsWith("/repos")) return json([repo]);
    if (path === "/search/issues")
      return json({
        total_count: 1,
        incomplete_results: false,
        items: [url.searchParams.get("q")?.includes("is:issue") ? issue : item],
      });
    if (path.endsWith("/issues/1")) return json(issue);
    if (path.endsWith("/issues")) return json([issue]);
    if (path.endsWith("/pulls/1")) return json(pr);
    if (path.endsWith("/files")) return json([file, { ...file, filename: "src/other.ts" }]);
    if (path.includes("/commits/") && !/\/(status|check-runs)$/.test(path)) return json(commit);
    if (path.endsWith("/commits")) return json([commit]);
    if (path.endsWith("/branches"))
      return json([{ name: "main", commit: { sha, url: "" }, protected: false }]);
    if (path.includes("/readme"))
      return json(content("README.md", "# Project\n\nContent is ready."));
    if (path.endsWith("/contents/src/main.ts"))
      return json(content("src/main.ts", "export const ready = true;\n"));
    if (path.endsWith("/contents/.github/workflows/check.yml"))
      return json(
        content(
          workflow.path,
          "name: Checks\non: push\njobs:\n  test:\n    runs-on: ubuntu-latest\n    steps:\n      - run: echo test\n",
        ),
      );
    if (path.endsWith("/contents/") || path.endsWith("/contents"))
      return json([
        {
          type: "file",
          name: "main.ts",
          path: "src/main.ts",
          sha,
          size: 25,
          html_url: "",
          download_url: "",
        },
      ]);
    if (path.endsWith("/actions/workflows")) return json({ total_count: 1, workflows: [workflow] });
    if (path.endsWith("/actions/runs")) return json({ total_count: 1, workflow_runs: [run] });
    if (path.endsWith("/actions/runs/100")) return json(run);
    if (path.endsWith("/jobs")) return json({ total_count: 0, jobs: [] });
    if (path.endsWith("/artifacts")) return json({ total_count: 0, artifacts: [] });
    if (path.endsWith("/languages")) return json({ TypeScript: 100 });
    if (path.endsWith("/check-runs")) return json({ total_count: 0, check_runs: [] });
    if (path.endsWith("/status"))
      return json({ state: "success", statuses: [], sha, total_count: 0 });
    if (path === "/graphql") return json({ data: { repository: { pullRequest: null } } });
    if (path.includes("/user/starred/"))
      return route.fulfill({ status: 404, body: "{}" }).catch(() => {});
    return json([]);
  });
  await context.route("https://github.com/**", (r) =>
    r.fulfill({
      status: 200,
      contentType: "image/svg+xml",
      body: '<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32"><rect width="32" height="32" fill="gray"/></svg>',
    }),
  );
  await context.route("https://cloud.umami.is/**", (r) => r.fulfill({ status: 200, body: "" }));
  const page = await context.newPage();
  activePage = page;
  page.on("pageerror", (e) => errors.push(e.message));
  page.setDefaultTimeout(15000);
  return {
    page,
    context,
    errors,
    requests,
    submissions,
    release() {
      released = true;
      resolve();
    },
    async close() {
      released = true;
      resolve();
      await context.close();
    },
  };
}
async function bounds(page) {
  return page.evaluate(() => {
    // Pages render inside the island's tab pane; the page Container carries
    // the width preference.
    const pane = document.querySelector("[data-tab-pane]");
    const nav = pane.querySelector('[data-slot="container"]').getBoundingClientRect();
    const skeletons = [...document.querySelectorAll('[data-tab-pane] [data-slot="skeleton"]')]
      .map((e) => {
        const r = e.getBoundingClientRect();
        return {
          x: r.x,
          right: r.right,
          w: r.width,
          h: r.height,
          animation: getComputedStyle(e).animationName,
        };
      })
      .filter((r) => r.w && r.h);
    return {
      left: nav.x,
      right: nav.right,
      width: nav.width,
      viewport: document.documentElement.clientWidth,
      pane: pane.clientWidth,
      scroll: document.documentElement.scrollWidth,
      skeletons,
    };
  });
}
function checkBounds(m, name, width, preset) {
  assert.ok(m.skeletons.length > 0, `No skeleton: ${name}`);
  assert.ok(m.scroll <= m.viewport, `Page overflow ${name}/${width}/${preset}: ${m.scroll}`);
  for (const rect of m.skeletons) {
    assert.ok(
      rect.x >= m.left - 1 && rect.right <= m.right + 1,
      `Skeleton escaped container ${name}/${width}/${preset}: ${JSON.stringify(rect)}; bounds ${m.left}-${m.right}`,
    );
    assert.equal(rect.animation, "none", "reduced motion");
  }
  const expected = preset === "sm" ? 896 : preset === "md" ? 1280 : preset === "lg" ? 1536 : width;
  assert.ok(Math.abs(m.width - Math.min(expected, m.pane)) < 1, `Wrong width ${name}`);
}
try {
  if (process.env.CASE === "session-motion") {
    const f = await fixture(1280, "md", { hold: false });
    const p = f.page;
    await p.goto(`${app}/demo/project/issues/1`);
    await p.getByRole("button", { name: "Edit labels", exact: true }).waitFor();
    const samples = await p.evaluate(async () => {
      const { useAuthStore } = await import("/src/app/stores/auth.ts");
      const samples = [];
      return new Promise((resolve) => {
        const observer = new MutationObserver(() => {
          const notice = document.querySelector('[role="alert"]');
          if (!notice?.textContent?.includes("Your GitHub sign-in expired")) return;
          observer.disconnect();
          const sample = () => {
            const matrix = new DOMMatrixReadOnly(getComputedStyle(notice).transform);
            samples.push({ x: matrix.m41, y: matrix.m42, scaleX: matrix.m11, scaleY: matrix.m22 });
            if (samples.length < 12) requestAnimationFrame(sample);
            else resolve(samples);
          };
          sample();
        });
        observer.observe(document.body, { childList: true, subtree: true });
        useAuthStore.getState().markExpired();
      });
    });
    assert.equal(samples.length, 12);
    assert.ok(
      samples.every(
        ({ x, y, scaleX, scaleY }) => x === 0 && y === 0 && scaleX === 1 && scaleY === 1,
      ),
      `Reduced-motion notice must not translate or scale: ${JSON.stringify(samples)}`,
    );
    await p.getByRole("button", { name: "Sign in again", exact: true }).waitFor();
    assert.deepEqual(f.errors, []);
    await f.close();
    console.log("PASS expired-session notice respects reduced motion throughout its entrance");
    await browser.close();
    server?.kill();
    process.exit(0);
  }
  // Run against Vite: this case drives the public token-adoption boundary in
  // the live document, where a pending review observer can survive adoption.
  if (process.env.CASE === "review-account-callback") {
    const f = await fixture(1280, "md", { hold: false });
    const p = f.page;
    let releaseReview;
    const reviewGate = new Promise((resolve) => {
      releaseReview = resolve;
    });
    await f.context.route(
      "https://api.github.com/repos/demo/project/pulls/1/reviews",
      async (route) => {
        if (route.request().method() !== "POST") return route.fallback();
        await reviewGate;
        await route.fallback();
      },
    );
    await p.goto(`${app}/demo/project/pr/1`);
    await p.getByRole("button", { name: "Submit review", exact: true }).waitFor();
    await p.evaluate(() => {
      localStorage.setItem(
        "githut.drafts.v1.account.2",
        JSON.stringify({
          state: {
            drafts: {
              "demo/project/1#review": { body: "Bob saved summary", at: Date.now() },
              "demo/project/1#inline:src/main.ts:RIGHT:1": {
                body: "Bob saved inline",
                at: Date.now(),
              },
            },
          },
          version: 0,
        }),
      );
      localStorage.setItem(
        "githut.review-drafts.v1.account.2",
        JSON.stringify({
          state: {
            pendingByPr: {
              "demo/project/1": [
                { id: -1, path: "src/main.ts", line: 1, side: "RIGHT", body: "Bob saved pending" },
              ],
            },
            composerByPr: { "demo/project/1": { path: "src/main.ts", line: 2, side: "RIGHT" } },
          },
          version: 0,
        }),
      );
    });
    const snapshot = () =>
      p.evaluate(() => ({
        drafts: JSON.parse(localStorage.getItem("githut.drafts.v1.account.2")),
        review: JSON.parse(localStorage.getItem("githut.review-drafts.v1.account.2")),
      }));
    const expected = await snapshot();
    await p.getByRole("button", { name: "Submit review", exact: true }).click();
    await p.getByRole("textbox", { name: "Review summary" }).fill("Alice submitted summary");
    const sent = p.waitForRequest(
      (request) => request.method() === "POST" && request.url().endsWith("/reviews"),
    );
    await p
      .getByRole("dialog", { name: "Submit review" })
      .getByRole("button", { name: "Submit review", exact: true })
      .click();
    await sent;
    await p.evaluate(async () => {
      const { adoptToken } = await import("/src/app/lib/github/client.ts");
      adoptToken("bob-token", { sameUser: false, accountId: 2 });
    });
    const returned = p.waitForResponse(
      (response) => response.request().method() === "POST" && response.url().endsWith("/reviews"),
    );
    releaseReview();
    await returned;
    await p.getByRole("button", { name: "Submitting…", exact: true }).waitFor({ state: "hidden" });
    assert.deepEqual(
      await snapshot(),
      expected,
      "Alice's late success preserves every Bob review draft",
    );
    assert.deepEqual(f.errors, []);
    await f.close();
    console.log("PASS late review success preserves the adopted account's drafts");
    await browser.close();
    server?.kill();
    process.exit(0);
  }
  const configs =
    process.env.CASE === "review-flow"
      ? []
      : process.argv.includes("--quick")
        ? [[390, "sm"]]
        : [
            [320, "sm"],
            [1920, "sm"],
            [1920, "md"],
            [1920, "lg"],
            [1920, "full"],
          ];
  for (const [width, preset] of configs) {
    for (const [name, path] of routes.filter(
      ([name]) => !process.env.CASE || name === process.env.CASE,
    )) {
      const f = await fixture(width, preset);
      try {
        await f.page.goto(app + path, { waitUntil: "domcontentloaded" });
        await f.page.locator('[data-tab-pane] [data-slot="skeleton"]:visible').first().waitFor();
        await f.page.evaluate(() => document.fonts.ready);
        const before = await bounds(f.page);
        checkBounds(before, name, width, preset);
        if (
          ["review", "conversation", "code", "issue", "run", "profile"].includes(name) &&
          (width === 320 || preset === "md")
        )
          await f.page.screenshot({ path: `${out}/${name}-${width}-${preset}-loading.png` });
        f.release();
        await f.page.waitForFunction(
          () => !document.querySelector('[data-tab-pane] [data-slot="skeleton"]'),
          {},
          { timeout: 15000 },
        );
        const after = await bounds(f.page);
        assert.ok(
          after.scroll <= after.viewport,
          `Loaded page overflow ${name}/${width}/${preset}: ${after.scroll}`,
        );
        assert.deepEqual(f.errors, [], `Browser errors ${name}`);
        report.push({ name, width, preset, skeletons: before.skeletons.length, passed: true });
        console.log("PASS", name, width, preset);
      } catch (error) {
        await f.page.screenshot({
          path: out + "/" + name + "-" + width + "-" + preset + "-failure.png",
          fullPage: true,
        });
        await writeFile(out + "/" + name + "-failure.html", await f.page.content());
        throw error;
      } finally {
        await f.close();
      }
    }
  }

  // A portaled review panel must remain clickable inside every container, even after scrolling.
  for (const [width, preset, height] of [
    [320, "sm", 640],
    [768, "sm", 600],
    [1920, "sm", 900],
    [1920, "md", 900],
    [1920, "lg", 900],
    [1920, "full", 900],
    [1280, "md", 420],
  ]) {
    const f = await fixture(width, preset, { hold: false, height });
    try {
      await f.page.goto(app + "/demo/project/pr/1");
      const trigger = f.page.getByRole("button", { name: "Submit review", exact: true });
      await trigger.waitFor();
      const addComment = f.page.getByRole("button", { name: "Add comment", exact: true }).first();
      await addComment.focus();
      await addComment.press("Enter");
      await f.page
        .getByPlaceholder("Leave a comment on this line…")
        .fill("Keep this content aligned.");
      await f.page.getByRole("button", { name: "Add review comment", exact: true }).click();
      await f.page.getByText("1 pending", { exact: true }).waitFor();
      await f.page.evaluate(() => window.scrollTo(0, 250));
      await f.page.waitForFunction(() => {
        const toolbar = document.querySelector('[style*="--diff-toolbar-height"] > div');
        const fileHeader = document.querySelector("[data-filename] section > header");
        return (
          toolbar &&
          fileHeader &&
          fileHeader.getBoundingClientRect().top >= toolbar.getBoundingClientRect().bottom
        );
      });
      await trigger.click();
      const panel = f.page.getByRole("dialog", { name: "Submit review" });
      await panel.waitFor();
      const rect = await panel.boundingBox();
      assert.ok(
        rect.x >= 0 &&
          rect.x + rect.width <= width &&
          rect.y >= 0 &&
          rect.y + rect.height <= height,
        `Review panel outside viewport: ${width}/${preset}`,
      );
      assert.equal(
        await panel
          .getByRole("textbox", { name: "Review summary" })
          .evaluate((e) => e === document.activeElement),
        true,
      );
      const submit = panel.getByRole("button", { name: "Submit review", exact: true });
      await submit.click({ trial: true }); // Detect clipping/occlusion, not only DOM visibility.
      await f.page.keyboard.press("Escape");
      await panel.waitFor({ state: "hidden" });
      assert.equal(
        await trigger.evaluate((e) => e === document.activeElement),
        true,
        "Escape restores trigger focus",
      );
      await trigger.press("Enter");
      await panel.getByText("Request changes", { exact: true }).click();
      await submit.click();
      await panel.getByRole("alert").waitFor();
      assert.equal(f.submissions.length, 0, "Invalid review must not submit");
      await panel
        .getByRole("textbox", { name: "Review summary" })
        .fill("Please address the loading layout.");
      await f.page.screenshot({ path: `${out}/review-form-${width}-${preset}-${height}.png` });
      await submit.click();
      await panel.waitFor({ state: "hidden" });
      assert.equal(f.submissions.length, 1);
      assert.equal(f.submissions[0].event, "REQUEST_CHANGES");
      assert.equal(f.submissions[0].body, "Please address the loading layout.");
      assert.equal(f.submissions[0].comments.length, 1);
      assert.equal(f.submissions[0].comments[0].body, "Keep this content aligned.");
      await f.page.getByText("0 pending", { exact: true }).waitFor();
      const m = await bounds(f.page);
      assert.ok(m.scroll <= m.viewport);
      assert.deepEqual(f.errors, []);
      console.log("PASS review flow", width, preset, height);
    } catch (error) {
      await f.page.screenshot({ path: out + "/review-flow-failure.png", fullPage: true });
      throw error;
    } finally {
      await f.close();
    }
  }
  // Partial responses keep the page context visible while only the outstanding section loads.
  for (const [name, path, secondary, heading] of [
    [
      "conversation",
      "/demo/project/pull/1",
      (p) => /\/(comments|timeline|commits|reviews)$/.test(p),
      "Keep loading layouts aligned",
    ],
    ["run", "/demo/project/actions/runs/100", (p) => p.endsWith("/jobs"), "Check loading states"],
  ]) {
    const f = await fixture(390, "md", { secondary });
    try {
      await f.page.goto(app + path);
      await f.page.getByRole("heading", { name: heading, exact: false }).first().waitFor();
      await f.page.locator('[data-tab-pane] [data-slot="skeleton"]:visible').first().waitFor();
      checkBounds(await bounds(f.page), name, 390, "md");
      f.release();
      await f.page.waitForFunction(
        () => !document.querySelector('[data-tab-pane] [data-slot="skeleton"]'),
      );
      assert.deepEqual(f.errors, []);
      console.log("PASS partial response", name);
    } finally {
      await f.close();
    }
  }
  // Returning to an already loaded review keeps cached content instead of a blank/skeleton page.
  {
    const f = await fixture(1280, "md", { hold: false });
    try {
      await f.page.goto(app + "/demo/project/pr/1");
      await f.page.getByRole("button", { name: "Submit review", exact: true }).waitFor();
      await f.page.getByRole("link", { name: "Back", exact: true }).click();
      await f.page
        .getByRole("heading", { name: "Keep loading layouts aligned", exact: false })
        .waitFor();
      await f.page.goBack();
      await f.page.getByRole("button", { name: "Submit review", exact: true }).waitFor();
      assert.equal(await f.page.locator('[data-tab-pane] [data-slot="skeleton"]').count(), 0);
      assert.deepEqual(f.errors, []);
      console.log("PASS cached navigation");
    } finally {
      await f.close();
    }
  }

  // Dependency failures must replace skeletons, including queries that never start.
  for (const [name, path, fail, text] of [
    [
      "repo-code",
      "/demo/project/code",
      (p) => p === "/repos/demo/project",
      "Could not load this repository.",
    ],
    [
      "repo-commits",
      "/demo/project/commits",
      (p) => p === "/repos/demo/project",
      "Could not load commits.",
    ],
    [
      "file",
      "/demo/project/code?path=src/main.ts&view=blob",
      (p) => p.endsWith("/contents/src/main.ts"),
      "Could not load this file.",
    ],
    [
      "directory",
      "/demo/project/code",
      (p) => /\/contents\/?$/.test(p),
      "Could not load this directory.",
    ],
    [
      "pr-checks",
      "/demo/project/pull/1/checks",
      (p) => p.endsWith("/pulls/1"),
      "Could not load this pull request.",
    ],
    [
      "review",
      "/demo/project/pr/1",
      (p) => p.endsWith("/pulls/1"),
      "Could not load this pull request.",
    ],
  ]) {
    const f = await fixture(390, "sm", { fail, hold: false });
    try {
      await f.page.goto(app + path);
      await f.page.getByText(text, { exact: true }).waitFor();
      assert.equal(
        await f.page
          .locator('[data-tab-pane] [role="status"][aria-label="Loading changed files"]')
          .count(),
        0,
      );
      assert.deepEqual(f.errors, []);
      console.log("PASS error", name);
    } finally {
      await f.close();
    }
  }
  for (const kind of ["issues", "pulls"]) {
    for (const width of [1280, 390]) {
      const f = await fixture(width, "sm", { hold: false, bulk: kind });
      try {
        const p = f.page;
        const noun = kind === "issues" ? "issue" : "pull request";
        await p.goto(`${app}/demo/project/${kind}`);
        const box = (n) => p.getByRole("checkbox", { name: `Select ${noun} #${n}`, exact: true });
        const selected = () => p.locator("[data-bulk-row][data-selected]").count();
        const row = (n) =>
          p.locator("a[data-keyboard-list-item]").filter({ hasText: `Bulk item ${n}` });
        const bar = p.getByRole("toolbar", { name: "Bulk actions" });
        const notice = (text) => p.getByText(text, { exact: true }).waitFor();
        const writes = (suffix) => f.submissions.filter((s) => s.path.endsWith(suffix));
        await box(1).waitFor({ state: "attached" });

        // Revealing and checking a box never moves the row.
        const before = await row(1).boundingBox();
        await row(1).hover();
        await box(1).click();
        assert.equal(await selected(), 1);
        assert.deepEqual(await row(1).boundingBox(), before, "Selection must not shift rows");
        await box(3).click({ modifiers: ["Shift"] });
        assert.equal(await selected(), 3, "Shift-click selects a range");
        await p.keyboard.press("Control+a");
        assert.equal(await selected(), 4, "Ctrl/⌘ A selects every visible row");
        await bar.waitFor();
        assert.ok(
          await p.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
          "Bulk bar must fit viewport",
        );
        await p.screenshot({ path: `${out}/bulk-${kind}-${width}.png` });
        await p.keyboard.press("Escape");
        assert.equal(await selected(), 0, "Escape clears");

        // Keyboard and row clicks: x toggles the focused row; in selection mode rows toggle
        // instead of navigating.
        await row(1).focus();
        await p.keyboard.press("x");
        assert.equal(await selected(), 1);
        await row(4).click();
        assert.equal(await selected(), 2);
        assert.equal(new URL(p.url()).pathname, `/demo/project/${kind}`);
        await row(4).click();
        await box(2).click();
        assert.equal(await selected(), 2);

        // Labels apply to every selected row; a failed row is retried on its own.
        await p.getByRole("button", { name: "Labels", exact: true }).click();
        await p.getByRole("option", { name: "bug" }).click();
        await notice(`Couldn't update 1 of 2 ${noun}s`);
        await p.keyboard.press("Escape");
        await p.getByRole("button", { name: "Retry", exact: true }).click();
        await notice("Added bug to #2");
        assert.equal(writes("/issues/1/labels").length, 1);
        assert.equal(writes("/issues/2/labels").length, 2);
        assert.deepEqual(writes("/issues/1/labels")[0].payload, { labels: ["bug"] });

        // Undo reverses exactly what the last batch changed.
        await p.getByRole("button", { name: "Undo", exact: true }).click();
        await notice("Removed bug from #2");
        assert.equal(f.submissions.at(-1).method, "DELETE");
        assert.equal(f.submissions.at(-1).path, "/repos/demo/project/issues/2/labels/bug");

        // Closing removes rows from the open view at once; undo brings them back.
        assert.equal(await selected(), 2);
        await p.keyboard.press("s");
        await p.getByRole("option", { name: "Closed", exact: true }).click();
        await notice(`Closed 2 ${noun}s`);
        assert.equal(await row(1).count(), 0, "Closed rows leave the open view");
        // The bar animates out; wait for it rather than sampling mid-exit.
        await bar.waitFor({ state: "detached" });
        assert.deepEqual(
          f.submissions.at(-1).payload,
          kind === "issues" ? { state: "closed", state_reason: "completed" } : { state: "closed" },
        );
        assert.equal(f.submissions.at(-1).path, `/repos/demo/project/${kind}/2`);
        await p.getByRole("button", { name: "Undo", exact: true }).click();
        await notice(`Reopened 2 ${noun}s`);
        await row(1).waitFor();

        await row(1).hover();
        await box(1).click();
        await p.keyboard.press("a");
        await p.getByRole("option", { name: "demo" }).click();
        await notice("Assigned demo to #1");
        assert.deepEqual(f.submissions.at(-1).payload, { assignees: ["demo"] });
        await p.keyboard.press("Escape");

        // Filtering away selected rows deselects them without stealing focus.
        const search = p
          .getByRole("textbox", { name: "Search pull requests" })
          .or(p.getByRole("searchbox", { name: "Search issues" }));
        await search.fill("Bulk item 4");
        assert.equal(await selected(), 0);
        await bar.waitFor({ state: "detached" });
        assert.equal(
          await search.evaluate((el) => el === document.activeElement),
          true,
          "Filtering preserves focus",
        );
        await search.fill("");
        await row(1).hover();
        await box(1).click();
        await p.getByRole("button", { name: "Open 4", exact: true }).click();
        await bar.waitFor({ state: "detached" }); // Collapsed groups leave selection
        assert.deepEqual(f.errors, []);
        console.log("PASS bulk selection", kind, width);
      } catch (error) {
        await f.page.screenshot({ path: `${out}/bulk-${kind}-${width}-failure.png` });
        throw error;
      } finally {
        await f.close();
      }
    }
  }
  await writeFile(out + "/results.json", JSON.stringify(report, null, 2));
  console.log(
    `PASS: ${report.length} cold-to-loaded page/width cases plus review interactions, partial responses, cached navigation, and dependency errors.`,
  );
} catch (e) {
  console.error(e);
  if (activePage && !activePage.isClosed())
    await activePage.screenshot({ path: out + "/failure.png", fullPage: true });
  process.exitCode = 1;
} finally {
  await browser.close();
  server?.kill();
}
