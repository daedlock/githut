import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { setTimeout as delay } from "node:timers/promises";
import { chromium } from "playwright";

const app = process.env.UI_BASE_URL || "http://127.0.0.1:5196";
assert.ok(["localhost", "127.0.0.1"].includes(new URL(app).hostname));
const server = process.env.UI_BASE_URL
  ? null
  : spawn(
      process.execPath,
      ["node_modules/vite/bin/vite.js", "--host", "127.0.0.1", "--port", "5196", "--strictPort"],
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
  description: "Inbox fixture",
  topics: [],
  language: "TypeScript",
  stargazers_count: 0,
  forks_count: 0,
  open_issues_count: 2,
  html_url: "https://github.com/demo/project",
  pushed_at: "2026-10-01T12:00:00Z",
  updated_at: "2026-10-01T12:00:00Z",
};
const notification = (id, unread = true) => ({
  id,
  unread,
  reason: id === "3" ? "subscribed" : "mention",
  updated_at: "2026-10-17T10:00:00Z",
  last_read_at: unread ? null : "2026-10-17T09:00:00Z",
  subject: {
    title: `Inbox thread ${id}`,
    type: "Issue",
    url: `https://api.github.com/repos/demo/project/issues/${id}`,
    latest_comment_url: null,
  },
  repository: repo,
});
const workItem = (number, title = `Review work ${number}`) => ({
  id: number,
  number,
  title,
  state: "open",
  user: actor,
  body: "Fixture",
  labels: [],
  assignees: [],
  comments: 0,
  created_at: "2026-01-01T12:00:00Z",
  updated_at: "2026-01-01T12:00:00Z",
  closed_at: null,
  html_url: `https://github.com/demo/project/pull/${number}`,
  repository_url: "https://api.github.com/repos/demo/project",
  pull_request: {
    url: `https://api.github.com/repos/demo/project/pulls/${number}`,
    html_url: `https://github.com/demo/project/pull/${number}`,
    diff_url: "",
    patch_url: "",
  },
});
async function fixture({
  fail = [],
  empty = false,
  pollInterval = "60",
  work = [],
  clock = false,
} = {}) {
  const context = await browser.newContext({
    viewport: { width: 1440, height: 1000 },
    reducedMotion: "reduce",
  });
  await context.addInitScript(() =>
    localStorage.setItem(
      "githut.auth",
      JSON.stringify({ state: { token: "inbox-fixture" }, version: 0 }),
    ),
  );
  let items = empty ? [] : [notification("1"), notification("2", false), notification("3")];
  const writes = [],
    reads = [],
    errors = [];
  await context.route("https://api.github.com/**", async (route) => {
    const request = route.request(),
      url = new URL(request.url()),
      path = url.pathname;
    const match = /^\/notifications\/threads\/(\d+)(\/subscription)?$/.exec(path);
    if (match && request.method() !== "GET") {
      writes.push({ method: request.method(), id: match[1], body: request.postDataJSON() });
      if (fail.includes(match[1]))
        return route.fulfill({
          status: 403,
          contentType: "application/json",
          body: JSON.stringify({ message: "Fixture: update forbidden" }),
        });
      if (request.method() === "DELETE") items = items.filter((item) => item.id !== match[1]);
      if (request.method() === "PATCH")
        items = items.map((item) => (item.id === match[1] ? { ...item, unread: false } : item));
      return route.fulfill({ status: request.method() === "PATCH" ? 205 : 204, body: "" });
    }
    let data = [];
    if (path === "/notifications") {
      reads.push(url.search);
      data =
        url.searchParams.get("participating") === "true"
          ? items.filter((item) => item.id !== "3")
          : items;
    } else if (path === "/user" || path === "/users/demo") data = actor;
    else if (path === "/user/repos" || path === "/user/starred") data = [repo];
    else if (path === "/repos/demo/project") data = repo;
    else if (path === "/search/issues") {
      const rows = url.searchParams.get("q")?.includes("review-requested:") ? work : [];
      data = { total_count: rows.length, incomplete_results: false, items: rows };
    } else if (/^\/repos\/demo\/project\/issues\/\d+$/.test(path))
      data = {
        id: Number(path.split("/").at(-1)),
        number: Number(path.split("/").at(-1)),
        title: `Issue ${path.split("/").at(-1)}`,
        state: "open",
        user: actor,
        body: "Mock issue content",
        labels: [],
        assignees: [],
        comments: 0,
        created_at: "2026-10-01T12:00:00Z",
        updated_at: "2026-10-01T12:00:00Z",
        closed_at: null,
        html_url: "https://github.com/demo/project/issues/1",
        reactions: {
          "+1": 0,
          "-1": 0,
          laugh: 0,
          hooray: 0,
          confused: 0,
          heart: 0,
          rocket: 0,
          eyes: 0,
          total_count: 0,
          url: "",
        },
      };
    await route.fulfill({
      contentType: "application/json",
      headers: {
        "x-poll-interval": pollInterval,
        "access-control-expose-headers": "x-poll-interval",
      },
      body: JSON.stringify(data),
    });
  });
  await context.route("**/api/**", (route) =>
    route.fulfill({ contentType: "application/json", body: "{}" }),
  );
  const page = await context.newPage();
  if (clock) await page.clock.install({ time: new Date() });
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto(app);
  return {
    page,
    writes,
    reads,
    errors,
    context,
    replaceWork: (next) => {
      work = next;
    },
    replaceItems: (next) => {
      items = next;
    },
    close: () => context.close(),
  };
}
try {
  const f = await fixture();
  try {
    const page = f.page;
    await page.getByRole("heading", { name: "Inbox", exact: true }).waitFor({ timeout: 5000 });
    await page.locator("[data-notification-row]").nth(1).waitFor({ timeout: 5000 });
    await page.getByRole("radio", { name: "All", exact: true }).click();
    assert.equal(await page.locator("[data-notification-row]").count(), 3);
    if (process.env.INBOX_SCREENSHOT) await page.screenshot({ path: process.env.INBOX_SCREENSHOT });
    await page
      .locator('[data-notification-row="2"]')
      .getByRole("link", { name: "Inbox thread 2" })
      .focus();
    await page.keyboard.press("Shift+u");
    await page.getByText("Unread on this device", { exact: true }).waitFor();
    assert.equal(f.writes.length, 0);
    await page.reload();
    await page.locator('[data-notification-row="2"]').getByText("Unread on this device").waitFor();
    await page.getByRole("radio", { name: "All", exact: true }).click();
    await page.getByRole("button", { name: "Your turn", exact: true }).click();
    await page
      .getByRole("button", { name: "Inbox", exact: true })
      .filter({ has: page.locator("svg") })
      .first()
      .click();
    await page.locator('[data-notification-row="2"]').getByText("Unread on this device").waitFor();
    await page.locator('[data-notification-row="1"]').getByRole("checkbox").click();
    await page.locator('[data-notification-row="2"]').getByRole("checkbox").click();
    await page.keyboard.press("e");
    await page.waitForFunction(
      () => document.querySelectorAll("[data-notification-row]").length === 1,
    );
    assert.deepEqual(
      f.writes.map((write) => [write.method, write.id]),
      [
        ["DELETE", "1"],
        ["DELETE", "2"],
      ],
    );
    assert.deepEqual(f.errors, []);
    console.log(
      "PASS Inbox default, GitHub participation, local unread, bulk Done and scoped shortcuts",
    );
  } finally {
    await f.close();
  }
  const viewing = await fixture();
  try {
    const page = viewing.page;
    const row = page.locator('[data-notification-row="1"]');
    await row.getByRole("button", { name: "Actions for Inbox thread 1" }).click();
    await page.getByRole("menuitem", { name: "Open to the side", exact: true }).click();
    await page.getByText("Mock issue content").waitFor();
    await page.waitForFunction(
      () =>
        document.querySelector('[data-sidebar-href="/"]')?.getAttribute("aria-label") ===
        "Inbox, 1 unread",
    );
    assert.deepEqual(
      viewing.writes.map((write) => [write.method, write.id]),
      [["PATCH", "1"]],
    );
    await row.getByRole("button", { name: "Actions for Inbox thread 1" }).click();
    await page.getByRole("menuitem", { name: "Mark unread (device only)", exact: true }).click();
    await row.getByText("Unread on this device").waitFor();
    await page.locator('[data-notification-row="2"]').getByRole("link").focus();
    await page.keyboard.press("Shift+u");
    await delay(1200);
    assert.equal(
      viewing.writes.length,
      1,
      "selected issue in an unfocused island must not clear local unread",
    );
    await page.getByText("Mock issue content").click();
    await page.waitForFunction(
      () =>
        document
          .querySelector('[data-notification-row="1"]')
          ?.textContent.includes("Unread on this device") === false,
    );
    assert.deepEqual(
      viewing.writes.map((write) => [write.method, write.id]),
      [
        ["PATCH", "1"],
        ["PATCH", "1"],
      ],
    );
    await page.keyboard.press("Alt+w");
    await page
      .locator('[data-notification-row="1"]')
      .getByRole("button", { name: "Actions for Inbox thread 1" })
      .click();
    await page.getByRole("menuitem", { name: "Done", exact: true }).click({ timeout: 3000 });
    await page.waitForFunction(() => !document.querySelector('[data-notification-row="1"]'));
    assert.deepEqual(viewing.errors, []);
    console.log(
      "PASS viewing marks read once; local unread persists while another island is focused",
    );
  } finally {
    await viewing.close();
  }
  const partial = await fixture({ fail: ["2"] });
  try {
    const page = partial.page;
    await page.locator('[data-notification-row="1"]').getByRole("checkbox").click();
    await page.locator('[data-notification-row="2"]').getByRole("checkbox").click();
    await page
      .getByRole("toolbar", { name: "Notification bulk actions" })
      .getByRole("button", { name: "Done", exact: true })
      .click();
    await page.getByText(/1 updated\. Could not update 1 notification/).waitFor();
    assert.equal(await page.locator("[data-notification-row]").count(), 1);
    assert.equal(
      await page.locator('[data-notification-row="2"]').getByRole("checkbox").isChecked(),
      true,
    );
    await page.getByRole("button", { name: "Retry failed", exact: true }).click();
    await page.getByText(/Could not update 1 notification/).waitFor();
    assert.deepEqual(
      partial.writes.map((write) => write.id),
      ["1", "2", "2"],
    );
    assert.deepEqual(partial.errors, []);
    console.log("PASS bulk partial failure restores only failed rows and retries only failures");
  } finally {
    await partial.close();
  }
  const subscription = await fixture();
  try {
    const page = subscription.page;
    const row = page.locator('[data-notification-row="1"]');
    await row.getByRole("button", { name: "Actions for Inbox thread 1" }).click();
    await page.getByRole("menuitem", { name: "Unsubscribe", exact: true }).click();
    await page.getByText("Unsubscribed from future notifications.", { exact: true }).waitFor();
    assert.equal(await row.count(), 1);
    assert.deepEqual(subscription.writes, [{ method: "PUT", id: "1", body: { ignored: true } }]);
    await subscription.context.setOffline(true);
    await delay(100);
    assert.equal(
      await row.getByRole("button", { name: "Done: Inbox thread 1" }).isDisabled(),
      true,
    );
    console.log(
      "PASS unsubscribe uses subscription endpoint without discarding current thread; offline writes disabled",
    );
  } finally {
    await subscription.close();
  }
  const live = await fixture({ pollInterval: "1" });
  try {
    const page = live.page;
    await page.locator('[data-notification-row="1"]').hover();
    const edited = notification("2", false);
    edited.subject.title = "Updated while hovering";
    live.replaceItems([edited, notification("4")]);
    await page.getByRole("link", { name: "Updated while hovering" }).waitFor({ timeout: 5000 });
    assert.deepEqual(
      await page
        .locator("[data-notification-row]")
        .evaluateAll((rows) => rows.map((row) => row.dataset.notificationRow)),
      ["1", "2"],
    );
    live.replaceItems([]);
    await delay(1600);
    assert.equal(await page.locator("[data-notification-row]").count(), 2);
    await page.getByRole("heading", { name: "Inbox", exact: true }).hover();
    await page.getByRole("heading", { name: "You're all caught up" }).waitFor({ timeout: 3000 });
    assert.deepEqual(live.errors, []);
    console.log(
      "PASS live Inbox holds row order and removals while hovering, updates fields, then releases to empty",
    );
  } finally {
    await live.close();
  }
  const dashboard = await fixture({ work: [workItem(10), workItem(11)], clock: true });
  try {
    const page = dashboard.page;
    await page.getByRole("button", { name: "Your turn", exact: true }).click();
    await page.getByRole("link", { name: /Review work 10/ }).hover();
    const updated = {
      ...workItem(10, "Updated review work"),
      created_at: new Date().toISOString(),
    };
    dashboard.replaceWork([updated, workItem(12)]);
    await page.clock.fastForward(16_000);
    await page.getByRole("link", { name: /Updated review work/ }).waitFor({ timeout: 5000 });
    assert.equal(await page.getByRole("link", { name: /Review work 11/ }).count(), 1);
    assert.equal(await page.getByRole("link", { name: /Review work 12/ }).count(), 0);
    await page.getByRole("heading", { name: "Your turn", exact: true }).hover();
    await page.getByRole("link", { name: /Review work 12/ }).waitFor();
    assert.equal(await page.getByRole("link", { name: /Review work 11/ }).count(), 0);
    assert.deepEqual(dashboard.errors, []);
    console.log(
      "PASS Your turn preserves grouped row positions while fields and group membership update",
    );
  } finally {
    await dashboard.close();
  }
  const empty = await fixture({ empty: true });
  try {
    await empty.page.getByRole("heading", { name: "You're all caught up" }).waitFor();
    assert.equal(
      await empty.page.getByRole("button", { name: "Your work", exact: true }).count(),
      1,
    );
    assert.equal(
      await empty.page.getByRole("button", { name: "Your repos", exact: true }).count(),
      1,
    );
    await empty.page.setViewportSize({ width: 640, height: 900 });
    await empty.page.getByRole("button", { name: "Your repos", exact: true }).click();
    await empty.page.getByRole("dialog", { name: "Sidebar" }).waitFor();
    console.log("PASS calm empty Inbox links to work and opens repository drawer");
  } finally {
    await empty.close();
  }
} finally {
  await browser.close();
  server?.kill();
}
