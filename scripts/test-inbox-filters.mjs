import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { setTimeout as delay } from "node:timers/promises";
import { chromium } from "playwright";

// Inbox filters (#80): Who / Repo / Type pills, URL state, filtered empty state.
const app = process.env.UI_BASE_URL || "http://127.0.0.1:5197";
assert.ok(["localhost", "127.0.0.1"].includes(new URL(app).hostname));
const server = process.env.UI_BASE_URL
  ? null
  : spawn(
      process.execPath,
      ["node_modules/vite/bin/vite.js", "--host", "127.0.0.1", "--port", "5197", "--strictPort"],
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

const actor = {
  id: 1,
  login: "demo",
  avatar_url: "",
  html_url: "https://github.com/demo",
  type: "User",
};
const repoOf = (full_name) => ({
  id: full_name.length,
  name: full_name.split("/")[1],
  full_name,
  owner: actor,
  default_branch: "main",
  private: false,
  fork: false,
  html_url: `https://github.com/${full_name}`,
});
const thread = (id, repo, type, reason) => ({
  id,
  unread: true,
  reason,
  updated_at: "2026-10-17T10:00:00Z",
  last_read_at: null,
  subject: {
    title: `Thread ${id}`,
    type,
    url: `https://api.github.com/repos/${repo}/${type === "Issue" ? "issues" : "pulls"}/${id}`,
    latest_comment_url: null,
  },
  repository: repoOf(repo),
});
const items = [
  thread("1", "acme/api", "PullRequest", "author"),
  thread("2", "acme/api", "Issue", "assign"),
  thread("3", "acme/web", "PullRequest", "review_requested"),
  // Your own PR, but the latest reason is a mention.
  thread("4", "acme/web", "PullRequest", "mention"),
  thread("5", "other/lib", "Issue", "mention"),
];
const myPr = {
  id: 4,
  number: 4,
  title: "Thread 4",
  state: "open",
  user: actor,
  labels: [],
  assignees: [],
  comments: 0,
  created_at: "2026-10-01T12:00:00Z",
  updated_at: "2026-10-17T14:00:00Z",
  closed_at: null,
  html_url: "https://github.com/acme/web/pull/4",
  repository_url: "https://api.github.com/repos/acme/web",
  pull_request: { url: "", html_url: "", diff_url: "", patch_url: "" },
};

const browser = await chromium.launch({ headless: true, args: ["--no-sandbox"] });
try {
  const context = await browser.newContext({
    viewport: { width: 1440, height: 1000 },
    reducedMotion: "reduce",
  });
  await context.addInitScript(() =>
    localStorage.setItem(
      "githut.auth",
      JSON.stringify({ state: { token: "filters" }, version: 0 }),
    ),
  );
  await context.route("https://api.github.com/**", async (route) => {
    const url = new URL(route.request().url());
    let data = [];
    if (url.pathname === "/notifications") data = items;
    else if (url.pathname === "/user") data = actor;
    else if (url.pathname === "/search/issues") {
      const rows = url.searchParams.get("q")?.includes("author:@me") ? [myPr] : [];
      data = { total_count: rows.length, incomplete_results: false, items: rows };
    }
    await route.fulfill({ contentType: "application/json", body: JSON.stringify(data) });
  });
  await context.route("**/api/**", (route) =>
    route.fulfill({ contentType: "application/json", body: "{}" }),
  );
  const page = await context.newPage();
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  const rows = () =>
    page
      .locator("[data-notification-row]")
      .evaluateAll((els) => els.map((el) => el.dataset.notificationRow));
  const waitRows = async (expected) => {
    for (let i = 0; i < 50; i++) {
      if (JSON.stringify(await rows()) === JSON.stringify(expected)) return;
      await delay(100);
    }
    assert.deepEqual(await rows(), expected);
  };
  const addFilter = async (field, value) => {
    await page.getByRole("button", { name: "Filter", exact: true }).click();
    await page.getByRole("option", { name: field, exact: true }).click();
    await page.getByRole("option", { name: value }).click();
  };

  await page.goto(app);
  await waitRows(["1", "2", "3", "4", "5"]);
  await page.getByText("5 unread").waitFor();

  await addFilter("Repo", "acme/api");
  await waitRows(["1", "2"]);
  await page.getByText("2 unread").waitFor();
  // A second Repo pill ORs with the first.
  await page.getByRole("button", { name: "Add filter" }).click();
  await page.getByRole("option", { name: "Repo", exact: true }).click();
  await page.getByRole("option", { name: "acme/web" }).click();
  await waitRows(["1", "2", "3", "4"]);
  assert.match(new URL(page.url()).search, /repo=acme%2Fapi%2Cacme%2Fweb|repo=acme\/api,acme\/web/);

  await addFilter("Who", "Mine");
  await waitRows(["1", "4"]);
  if (process.env.SHOT) await page.screenshot({ path: process.env.SHOT });

  await page.reload();
  await waitRows(["1", "4"]);

  await page.getByRole("button", { name: "Who", exact: true }).click();
  await page.getByRole("option", { name: /Teammates/ }).click();
  await waitRows(["2", "3"]);
  await addFilter("Type", "Pull requests");
  await waitRows(["3"]);

  await page.getByRole("button", { name: "Remove Repo filter" }).first().click();
  await page.getByRole("button", { name: "Remove Repo filter" }).first().click();
  await waitRows(["3"]);
  await page.getByRole("button", { name: "Who", exact: true }).click();
  await page.getByRole("option", { name: /Mine/ }).click();
  await waitRows(["1", "4"]);

  await page.goto(`${app}/?repo=nobody/here`);
  await page.getByText("No notifications match these filters.").waitFor();
  await page.getByRole("button", { name: "Clear filters" }).click();
  await waitRows(["1", "2", "3", "4", "5"]);
  assert.equal(new URL(page.url()).search, "");
  assert.deepEqual(errors, []);
  console.log("PASS Inbox filters: multi-repo OR, mine vs teammates, type, URL state, clear");
} finally {
  await browser.close();
  server?.kill();
}
