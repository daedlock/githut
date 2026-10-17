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
      {
        stdio: ["ignore", "pipe", "pipe"],
      },
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
try {
  for (let attempt = 0; ; attempt++) {
    try {
      if ((await fetch(app)).ok) break;
    } catch {}
    if (attempt === 100 || server?.exitCode != null) throw new Error(`Server failed: ${log}`);
    await delay(200);
  }
  browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 960, height: 800 } });
  await page.route("https://api.github.com/**", (route) =>
    route.fulfill({
      json: {
        login: "demo",
        id: 1,
        avatar_url: "",
        html_url: "https://github.com/demo",
        name: "Demo",
      },
    }),
  );
  await page.route("https://cloud.umami.is/**", (route) => route.fulfill({ body: "" }));
  await page.addInitScript(() => {
    localStorage.setItem(
      "githut.auth",
      JSON.stringify({ state: { token: "fixture" }, version: 0 }),
    );
  });
  await page.goto(`${app}/settings?history=one`);
  const first = page.getByRole("tab", { name: "Settings", exact: true });
  await first.waitFor();
  const firstId = await first.getAttribute("data-tab-id");
  // Navigate through the tab's public router, then exercise its lifetime
  // through workspace commands and its restored history through browser Back.
  await page.evaluate(async () => {
    const { getFocusedTabRouter } = await import("/src/app/lib/tabRouters.ts");
    getFocusedTabRouter().history.push("/settings?history=two");
  });
  await page.waitForURL(/history=two/);
  for (let index = 0; index < 8; index++) {
    await page.evaluate(async (index) => {
      const { dispatch } = await import("/src/app/workspace/store.ts");
      dispatch({ type: "openTab", href: `/settings?tab=${index}`, allowDuplicate: true });
    }, index);
    await page.waitForFunction(
      (count) => document.querySelectorAll("[data-tab-id]").length === count,
      index + 2,
    );
  }
  assert.equal(
    await page.locator(`[data-tab-pane="${firstId}"]`).count(),
    0,
    "older tab was released",
  );
  await page.getByRole("button", { name: "Show all tabs", exact: true }).click();
  await page.getByRole("menuitem").first().click();
  await page.waitForURL(/history=two/);
  await page.goBack();
  await page.waitForFunction(
    async () => {
      const { getFocusedTab } = await import("/src/app/workspace/store.ts");
      return getFocusedTab().href === "/settings?history=one";
    },
    null,
    { timeout: 3000 },
  );
  await page.waitForURL(/history=one/, { timeout: 3000 });
  await page.goForward();
  await page.waitForFunction(
    async () => {
      const { getFocusedTab } = await import("/src/app/workspace/store.ts");
      return getFocusedTab().href === "/settings?history=two";
    },
    null,
    { timeout: 3000 },
  );
  await page.waitForURL(/history=two/, { timeout: 3000 });
  console.log("PASS: released tabs retain their own back/forward history when reopened");
} finally {
  await browser?.close();
  server?.kill();
}
