import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { mkdir, writeFile } from "node:fs/promises";
import { setTimeout as delay } from "node:timers/promises";
import { chromium } from "playwright";

const origin = "http://127.0.0.1:5178";
const server = spawn(
  process.execPath,
  [
    "node_modules/vite/bin/vite.js",
    ...(process.env.PERF_PRODUCTION
      ? ["preview", "--outDir", "perf/results/regressions-build"]
      : []),
    "--host",
    "127.0.0.1",
    "--port",
    "5178",
    "--strictPort",
  ],
  { stdio: "pipe" },
);
let log = "";
server.stdout.on("data", (chunk) => (log += chunk));
server.stderr.on("data", (chunk) => (log += chunk));
const browser = await chromium.launch({ headless: true });
const report = [];
try {
  for (let n = 0; ; n++) {
    try {
      if ((await fetch(`${origin}/perf/fixtures/pickers.html`)).ok) break;
    } catch {}
    if (n > 100 || server.exitCode != null) throw new Error(log);
    await delay(200);
  }
  const page = await browser.newPage({ viewport: { width: 1400, height: 900 } });
  // This fixture may never send real GitHub requests.
  await page.route("https://api.github.com/**", (route) => route.abort());
  await page.goto(`${origin}/perf/fixtures/pickers.html?size=${process.env.PERF_SIZE ?? 3000}`);
  await page.getByRole("button", { name: "Edit labels" }).waitFor();
  await page.evaluate(() => document.fonts.ready);
  await delay(250);
  const cdp = await page.context().newCDPSession(page);

  await cdp.send("Emulation.setCPUThrottlingRate", { rate: 4 });
  for (const dataState of ["ready", "pending"]) {
    if (dataState === "pending") await page.locator("#loading").click();
    for (const name of ["Edit reviewers", "Edit labels"]) {
      const samples = [];
      for (let n = 0; n < Number(process.env.PERF_TRIALS || 5); n++) {
        const box = await page.locator(`button[aria-label="${name}"]`).boundingBox();
        await page.evaluate(() => {
          window.__openAt = 0;
          window.__visibleAt = 0;
          document.addEventListener(
            "click",
            () => {
              window.__openAt = performance.now();
            },
            { once: true, capture: true },
          );
          const check = () => {
            const popup = document.querySelector('[data-slot="popover-content"]');
            if (
              popup?.checkVisibility() &&
              getComputedStyle(popup).visibility !== "hidden" &&
              window.__openAt
            )
              window.__visibleAt = performance.now();
            else requestAnimationFrame(check);
          };
          requestAnimationFrame(check);
        });

        const trace = [];
        const collect = ({ value }) => trace.push(...value);
        cdp.on("Tracing.dataCollected", collect);
        await cdp.send("Tracing.start", {
          categories: "devtools.timeline,disabled-by-default-devtools.timeline.stack",
        });
        await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
        await page.waitForFunction(() => window.__visibleAt > 0);

        const ended = new Promise((resolve) => cdp.once("Tracing.tracingComplete", resolve));
        await cdp.send("Tracing.end");
        await ended;
        cdp.off("Tracing.dataCollected", collect);
        await mkdir("perf/results", { recursive: true });
        await writeFile(
          `perf/results/picker-${process.env.PERF_LABEL || "current"}-${dataState}-${name.replaceAll(" ", "-")}-${n}.trace.json`,
          JSON.stringify({ traceEvents: trace }),
        );
        samples.push(await page.evaluate(() => window.__visibleAt - window.__openAt));
        await page.keyboard.press("Escape");
        await delay(150);
      }
      report.push({
        name,
        dataState,
        samples,
        median: [...samples].sort((a, b) => a - b)[Math.floor(samples.length / 2)],
      });
    }
  }
  await page.locator("#loading").click();
  await page.getByRole("button", { name: "Edit labels" }).click();
  await page.locator("#switch-tab").dispatchEvent("pointerdown");
  await delay(250);
  assert.equal(
    await page.locator('[data-slot="popover-content"]:visible').count(),
    0,
    "Background tab must not leave a visible picker portal",
  );
  await page.locator("#switch-tab").dispatchEvent("pointerdown");
  await delay(250);
  assert.equal(
    await page.locator('[data-slot="popover-content"]:visible').count(),
    0,
    "Returning to a tab must not resurrect its dismissed picker",
  );
  await page.getByRole("button", { name: "Edit labels" }).click();
  await page.getByRole("textbox", { name: "Labels" }).fill("Label 42");
  await page.getByRole("option", { name: "Label 42", exact: true }).click();
  assert.equal(
    await page.getByRole("option", { name: "Label 42", exact: true }).getAttribute("data-checked"),
    "true",
  );
  await page.keyboard.press("Escape");
  await page.waitForFunction(
    () => document.activeElement?.getAttribute("aria-label") === "Edit labels",
  );
  await page.getByRole("button", { name: "Edit labels" }).click();
  await page.keyboard.press("End");
  await page.keyboard.press("Enter");
  assert.equal(
    await page.getByRole("option", { name: "Label 99", exact: true }).getAttribute("data-checked"),
    "true",
    "Keyboard selection reaches the last contained row",
  );
  const last = await page.getByRole("option", { name: "Label 99", exact: true }).boundingBox();
  const list = await page.locator('[data-slot="command-list"]').boundingBox();
  assert(
    last.y >= list.y && last.y + last.height <= list.y + list.height + 2,
    "Keyboard scroll keeps the last option visible",
  );
  await page.keyboard.press("Escape");
  await page.getByRole("button", { name: "Open shared popup" }).click();
  await page.getByRole("button", { name: "Press popup action" }).click();
  await page.getByRole("button", { name: "Pressed", exact: true }).waitFor();
  await page.keyboard.press("Escape");
  await page.setViewportSize({ width: 700, height: 700 });
  await page.getByRole("button", { name: "Edit labels" }).click();
  const positioned = await page.locator('[data-slot="popover-content"]').boundingBox();
  assert(
    positioned.x >= 0 && positioned.x + positioned.width <= 700,
    "Popup stays inside narrow viewport",
  );
  await page.setViewportSize({ width: 1400, height: 900 });
  await delay(150);
  const trigger = await page.locator('button[aria-label="Edit labels"]').boundingBox();
  const popup = await page.locator('[data-slot="popover-content"]').boundingBox();
  assert(Math.abs(popup.x + popup.width - trigger.x - trigger.width) < 3, "Resize reanchors popup");
  await page.keyboard.press("Escape");
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.getByRole("button", { name: "Edit labels" }).click();
  assert.equal(
    await page
      .locator('[data-slot="popover-content"]')
      .evaluate((el) => getComputedStyle(el).animationName),
    "none",
  );
  await page.keyboard.press("Escape");
  await page.getByRole("button", { name: "Toggle pending data" }).click();
  await page.getByRole("button", { name: "Edit reviewers" }).click();
  await page.locator('[data-slot="popover-content"]').waitFor({ state: "visible" });
  await page.keyboard.press("Escape");
  await page.getByRole("button", { name: "Edit labels" }).click();
  await page.locator("#close-tab").dispatchEvent("pointerdown");
  await delay(150);
  assert.equal(
    await page.locator('[data-slot="popover-content"]:visible').count(),
    0,
    "Closing the tab removes its portal",
  );
  console.log(
    "Picker lifecycle, keyboard, focus, reduced motion, positioning, styled content, filtering and pending-data checks passed",
  );
} finally {
  console.log(JSON.stringify(report, null, 2));
  await mkdir("perf/results", { recursive: true });
  await writeFile(
    `perf/results/pickers-${process.env.PERF_LABEL || "current"}.json`,
    JSON.stringify(report, null, 2),
  );
  await browser.close();
  server.kill();
}
