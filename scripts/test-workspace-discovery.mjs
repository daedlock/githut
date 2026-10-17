import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { setTimeout as delay } from "node:timers/promises";
import { chromium } from "playwright";

const app = process.env.UI_BASE_URL || "http://127.0.0.1:5204";
assert.ok(["localhost", "127.0.0.1"].includes(new URL(app).hostname));
const server = process.env.UI_BASE_URL
  ? null
  : spawn(
      process.execPath,
      ["node_modules/vite/bin/vite.js", "--host", "127.0.0.1", "--port", "5204", "--strictPort"],
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
let browser;

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
    window.workspaceEvents = [];
    window.layoutCommandEvents = [];
    window.umami = {
      // Every event and pageview now goes through the payload-function form.
      track: (event, data) => {
        const payload =
          typeof event === "function"
            ? event({
                website: "site-id",
                url: location.href,
                title: document.title,
                referrer: "https://github.com/private-owner/secret-repo",
                id: "private-person",
              })
            : { name: event, data };
        if (payload.name === "command_palette_command_selected")
          window.layoutCommandEvents.push(payload.data);
        if (payload.name === "workspace_action") window.workspaceEvents.push(payload);
      },
    };
  });
  await context.route("https://api.github.com/**", (route) => {
    const path = new URL(route.request().url()).pathname;
    const body =
      path === "/user"
        ? { login: "demo", id: 1, avatar_url: "" }
        : path.startsWith("/search/")
          ? { total_count: 0, items: [] }
          : path === "/repos/private-owner/secret-repo"
            ? {
                name: "secret-repo",
                full_name: "private-owner/secret-repo",
                default_branch: "main",
                owner: { login: "private-owner" },
              }
            : [];
    return route.fulfill({ json: body });
  });
  await context.route("https://cloud.umami.is/**", (route) => route.fulfill({ body: "" }));
  const page = await context.newPage();
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto(`${app}/private-owner/secret-repo/issues`);
  await page.locator("[data-tab-strip]").waitFor();
  return { page, errors, close: () => context.close() };
}

async function command(page, cmd) {
  await page.evaluate(async (cmd) => {
    const { dispatch } = await import("/src/app/workspace/store.ts");
    dispatch(cmd);
  }, cmd);
}

async function palette(page, label) {
  await page.keyboard.press("Control+k");
  const input = page.getByRole("combobox");
  await input.fill(`> ${typeof label === "string" ? label : "Merge focused island"}`);
  await page
    .getByRole("option", { name: label, exact: typeof label === "string" })
    .click({ timeout: 3000 });
  await input.waitFor({ state: "hidden" });
}

try {
  for (let i = 0; ; i++) {
    try {
      if ((await fetch(app)).ok) break;
    } catch {}
    if (i === 100 || server?.exitCode != null) throw Error(log);
    await delay(200);
  }
  browser = await chromium.launch({ headless: true, args: ["--no-sandbox"] });
  const first = await fixture();
  try {
    const hint = first.page.getByRole("dialog", { name: "Tab tips" });
    assert.equal(await hint.count(), 0);
    await command(first.page, { type: "openTab", href: "/private-owner/secret-repo/pulls" });
    await hint.waitFor({ timeout: 3000 });
    assert.match(
      await hint.innerText(),
      /Drag a tab to split. Shift-click opens a new tab, (Alt|⌥)-click opens it beside./,
    );
    const hintBox = await hint.boundingBox();
    const stripBox = await first.page.locator("[data-tab-strip]").boundingBox();
    assert.ok(Math.abs(hintBox.y - stripBox.y - stripBox.height) < 20, "Hint anchors to tab row");
    await hint.getByRole("button", { name: "Dismiss tab tips" }).click();
    await hint.waitFor({ state: "hidden" });
    await first.page.reload();
    await first.page.locator("[data-tab-strip]").waitFor();
    assert.equal(await hint.count(), 0);
    assert.deepEqual(first.errors, []);
    console.log("PASS: two tabs show one anchored hint; dismissal survives reload");
  } finally {
    await first.close();
  }

  const second = await fixture();
  try {
    await command(second.page, { type: "splitIsland", side: "right" });
    await command(second.page, { type: "openTab", href: "/private-owner/secret-repo/pulls" });
    await second.page.reload();
    await second.page.locator("[data-tab-strip]").first().waitFor();
    assert.equal(await second.page.getByRole("dialog", { name: "Tab tips" }).count(), 0);
    assert.deepEqual(second.errors, []);
    console.log("PASS: first split retires the hint permanently");
  } finally {
    await second.close();
  }

  const counts = await fixture();
  try {
    const page = counts.page;
    await page.keyboard.press("Alt+Backslash");
    await page.waitForFunction(() => document.querySelectorAll("[data-island]").length === 2);
    assert.deepEqual(await page.evaluate(() => window.workspaceEvents.map((e) => e.data.action)), [
      "split",
      "shortcut",
    ]);
    await page.keyboard.press("Control+b");
    assert.deepEqual(
      (
        await page.evaluate(() => window.workspaceEvents.slice(-2).map((e) => e.data.action))
      ).sort(),
      ["shortcut", "sidebar-toggled"],
    );
    await page.evaluate(async () => {
      const { dispatch, getFocusedTab } = await import("/src/app/workspace/store.ts");
      dispatch({ type: "pinTab", tabId: getFocusedTab().id, pinned: true });
      dispatch({ type: "pinTab", tabId: getFocusedTab().id, pinned: true });
    });
    assert.equal(
      await page.evaluate(
        () => window.workspaceEvents.filter((e) => e.data.action === "pin").length,
      ),
      1,
    );
    const target = await page.locator("[data-island]").first().boundingBox();
    const source = await page
      .locator("[data-island]")
      .last()
      .locator("[data-tab-strip]")
      .boundingBox();
    await page.mouse.move(source.x + source.width - 8, source.y + 15);
    await page.mouse.down();
    await page.mouse.move(target.x + target.width / 2, target.y + target.height / 2, { steps: 12 });
    await page.locator("[data-dock-preview]").waitFor();
    await page.mouse.up();
    await page.waitForFunction(() => document.querySelectorAll("[data-island]").length === 1);
    const events = await page.evaluate(() => window.workspaceEvents);
    assert.deepEqual(
      events.slice(-2).map((e) => e.data.action),
      ["move-island", "drag-dock"],
    );
    for (const event of events)
      assert.deepEqual(event, {
        website: "site-id",
        url: "/workspace",
        title: "Workspace",
        referrer: "",
        name: "workspace_action",
        data: { action: event.data.action },
      });
    await page.evaluate(() => localStorage.setItem("umami.disabled", "1"));
    await page.keyboard.press("Alt+Backslash");
    assert.equal(await page.evaluate(() => window.workspaceEvents.length), events.length);
    await page.evaluate(() => {
      localStorage.removeItem("umami.disabled");
      window.umami.track = () => {
        throw Error("blocked analytics");
      };
    });
    await page.keyboard.press("Alt+Backslash");
    await page.waitForFunction(() => document.querySelectorAll("[data-island]").length === 3);
    await palette(page, "Split island down");
    await page.waitForFunction(() => document.querySelectorAll("[data-island]").length === 4);
    assert.deepEqual(counts.errors, []);
    console.log(
      "PASS: actual splits, shortcuts, sidebar toggles, pins and drags emit anonymous counts; opt-out and failures are harmless",
    );
  } finally {
    await counts.close();
  }

  const discover = await fixture();
  try {
    const page = discover.page;
    await palette(page, "Split island right");
    await page.waitForFunction(() => document.querySelectorAll("[data-island]").length === 2);
    await page.waitForTimeout(300);
    const before = await page.locator("[data-island]").first().boundingBox();
    // The palette no longer lists per-gap resizes; gaps resize from the keyboard.
    await page.getByRole("separator", { name: "Resize islands" }).first().focus();
    await page.keyboard.press("ArrowLeft");
    await page.waitForTimeout(300);
    const resized = await page.locator("[data-island]").first().boundingBox();
    assert.ok(
      Math.abs(before.width - resized.width - 16) < 2,
      `${before.width} -> ${resized.width}`,
    );
    await page.locator("[data-island]").nth(1).getByRole("tab").first().click();
    await palette(page, "Equalize island sizes");
    assert.ok(
      Math.abs((await page.locator("[data-island]").first().boundingBox()).width - before.width) <
        2,
    );
    await palette(page, "Merge focused island into island left");
    await page.waitForFunction(() => document.querySelectorAll("[data-island]").length === 1);
    await palette(page, "Undo layout change");
    await page.waitForFunction(() => document.querySelectorAll("[data-island]").length === 2);
    await palette(page, "Maximize focused island");
    assert.equal(await page.locator("[data-island]:visible").count(), 1);
    await palette(page, "Restore island layout");
    assert.equal(await page.locator("[data-island]:visible").count(), 2);
    await palette(page, "Pin focused tab");
    await palette(page, "Unpin focused tab");
    await page.setViewportSize({ width: 600, height: 900 });
    await page.waitForFunction(
      () => document.querySelector("[data-workspace-area]")?.dataset.narrow === "true",
    );
    await palette(page, "Toggle sidebar");
    await page.getByRole("dialog", { name: "Sidebar" }).waitFor();
    assert.equal(
      await page.evaluate(() => window.workspaceEvents.at(-1).data.action),
      "sidebar-toggled",
    );
    const toggles = await page.evaluate(
      () =>
        window.workspaceEvents.filter((event) => event.data.action === "sidebar-toggled").length,
    );
    await page.keyboard.press("Escape");
    await page.getByRole("dialog", { name: "Sidebar" }).waitFor({ state: "hidden" });
    assert.equal(
      await page.evaluate(
        () =>
          window.workspaceEvents.filter((event) => event.data.action === "sidebar-toggled").length,
      ),
      toggles + 1,
    );
    assert.deepEqual(
      await page.evaluate(() => window.layoutCommandEvents),
      [],
      "Dynamic layout commands must never enter ordinary page-aware telemetry",
    );
    assert.deepEqual(discover.errors, []);
    console.log(
      "PASS: palette discovers and executes layout commands and toggles the narrow sidebar",
    );
  } finally {
    await discover.close();
  }
} finally {
  await browser?.close();
  server?.kill();
}
