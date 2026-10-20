// Deterministic browser evidence for #69 and #71. Baseline modules are read
// from Git into virtual modules; no checkout files or real GitHub data change.
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { chromium } from "playwright";
import { createServer } from "vite";
import ts from "typescript";

const base = process.env.PERF_BASE || "f8efd23f6e9864001254713d4d8b85f2759e3581";
const root = path.resolve(import.meta.dirname, "../..");
const output = path.join(root, "perf/results/regression-evidence");
const source = (name) =>
  ts.transpileModule(
    execFileSync("git", ["show", `${base}:src/app/${name}`], { cwd: root, encoding: "utf8" }),
    { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext } },
  ).outputText;
const baseline = {
  "baseline-scroll": source("lib/scrollRestore.ts"),
  "baseline-path": source("hooks/usePathCommit.ts"),
};
const html = `<!doctype html><html><body><div id="pane" style="height:600px;overflow:auto"></div><script type="module">
import { restoreScroll as before } from 'baseline-scroll';
import { restoreScroll as after } from '/src/app/lib/scrollRestore.ts';
import { pathCommitQueryOptions as oldPath } from 'baseline-path';
import { pathCommitQueryOptions as header } from '/src/app/hooks/usePathCommit.ts';
import { directoryCommitsQueryOptions } from '/src/app/hooks/useDirectoryCommits.ts';
import { useAuthStore } from '/src/app/stores/auth.ts';
import { QueryClient } from '@tanstack/react-query';
useAuthStore.setState({token:'fixture-only'});
const pane = document.getElementById('pane');
const nativeScroll = Object.getOwnPropertyDescriptor(Element.prototype,'scrollTop');
Object.defineProperty(pane,'scrollTop',{get(){return nativeScroll.get.call(this)},set(value){nativeScroll.set.call(this,value);performance.mark('restore-scroll-write')}});
pane.innerHTML = Array.from({length:10000}, (_,i)=>'<article style="height:30px">Row '+i+' <span>Conversation content</span></article>').join('');
window.runDirectory = async (label) => {
  const client = new QueryClient({defaultOptions:{queries:{retry:false}}});
  const paths = Array.from({length:116}, (_,i)=>'src/file-'+i+'.ts');
  const commits = label === 'before'
    ? Object.fromEntries(await Promise.all(paths.map(async p=>[p,await client.fetchQuery(oldPath('fixture','repo',p,'main'))])))
    : await client.fetchQuery(directoryCommitsQueryOptions('fixture','repo',paths,'main'));
  const head = await client.fetchQuery(header('fixture','repo','','main'));
  const result = {rows:Object.keys(commits).length, first:commits[paths[0]], last:commits[paths.at(-1)], header:head};
  client.clear(); return result;
};
window.prepareScroll = async (reveal) => {pane.scrollTop=0; pane.style.display=reveal?'none':'block';await new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)));};
window.runScroll = async (label, reveal) => {
  if (reveal) pane.style.display='block';
  const restore = ({before,after})[label](pane,1200);
  await new Promise(resolve=> {const tick=()=>restore.restoring?requestAnimationFrame(tick):resolve();requestAnimationFrame(tick)});
  return {scrollTop:pane.scrollTop,rows:pane.children.length};
};
window.ready=true;
</script></body></html>`;
baseline["evidence-fixture"] = html.match(/<script type="module">([\s\S]*)<\/script>/)[1];
const shell = html.replace(
  /<script type="module">[\s\S]*<\/script>/,
  '<script type="module" src="/@id/evidence-fixture"></script>',
);
const server = await createServer({
  configFile: false,
  root,
  cacheDir: path.join(output, "vite-cache"),
  server: { host: "127.0.0.1", port: 15181, strictPort: true },
  resolve: { alias: { "@/app": path.join(root, "src/app") } },
  optimizeDeps: { include: ["@tanstack/react-query"] },
  plugins: [
    {
      name: "evidence-fixture",
      resolveId(id) {
        if (id in baseline) return id;
      },
      load(id) {
        return baseline[id];
      },
      configureServer(s) {
        s.middlewares.use((req, res, next) => {
          if (req.url !== "/evidence.html") return next();
          res.setHeader("Content-Type", "text/html");
          res.end(shell);
        });
      },
    },
  ],
});
await server.listen();
await mkdir(output, { recursive: true });
const browser = await chromium.launch({ headless: true });
const report = { base, browser: browser.version(), directory: [], scroll: [] };
try {
  const page = await browser.newPage();
  const errors = [];
  page.on("pageerror", (e) => {
    errors.push(e.message);
    console.error(e.message);
  });
  await page.route("https://api.github.com/**", async (route) => {
    const req = route.request();
    const url = new URL(req.url());
    const commit = {
      oid: "abcdef1234567890",
      message: "Fixture commit",
      committedDate: "2026-10-18T12:00:00Z",
      author: { name: "Demo", user: { login: "demo" } },
    };
    if (url.pathname === "/graphql") {
      const { query, variables } = req.postDataJSON();
      assert.ok(!query.includes("mutation"));
      const head = Object.fromEntries(
        Object.keys(variables)
          .filter((k) => /^p\d+$/.test(k))
          .map((k) => [k, { nodes: [commit] }]),
      );
      return route.fulfill({ json: { data: { repository: { head } } } });
    }
    assert.equal(req.method(), "GET");
    assert.equal(url.pathname, "/repos/fixture/repo/commits");
    return route.fulfill({
      json: [
        {
          sha: commit.oid,
          commit: {
            message: commit.message,
            author: { name: "Demo", date: commit.committedDate },
            committer: { name: "Demo", date: commit.committedDate },
          },
          author: { login: "demo", avatar_url: "" },
        },
      ],
    });
  });
  await page.goto("http://127.0.0.1:15181/evidence.html");
  await page.waitForFunction(() => window.ready);
  const cdp = await page.context().newCDPSession(page);
  await cdp.send("Network.enable");
  let urls = [];
  cdp.on("Network.requestWillBeSent", ({ request }) => {
    if (request.method !== "OPTIONS" && request.url.startsWith("https://api.github.com/"))
      urls.push(request.url);
  });
  for (const label of ["before", "after"]) {
    urls = [];
    const result = await page.evaluate((label) => window.runDirectory(label), label);
    assert.equal(result.rows, 116);
    assert.deepEqual(result.first, result.last);
    assert.deepEqual(result.first, result.header);
    const rest = urls.filter((url) => new URL(url).pathname.endsWith("/commits"));
    const graphql = urls.filter((url) => new URL(url).pathname === "/graphql");
    assert.equal(rest.length, label === "before" ? 117 : 1);
    assert.equal(graphql.length, label === "before" ? 0 : 3);
    report.directory.push({
      label,
      net: { count: urls.length, rest: rest.length, graphql: graphql.length, urls },
      result,
    });
  }
  for (const reveal of [false, true])
    for (const label of ["before", "after"]) {
      await page.evaluate((reveal) => window.prepareScroll(reveal), reveal);
      const events = [];
      const collect = ({ value }) => events.push(...value);
      cdp.on("Tracing.dataCollected", collect);
      await cdp.send("Tracing.start", {
        categories:
          "devtools.timeline,disabled-by-default-devtools.timeline.stack,blink.user_timing",
      });
      const result = await page.evaluate(({ label, reveal }) => window.runScroll(label, reveal), {
        label,
        reveal,
      });
      await page.evaluate(
        () => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))),
      );
      const ended = new Promise((resolve) => cdp.once("Tracing.tracingComplete", resolve));
      await cdp.send("Tracing.end");
      await ended;
      cdp.off("Tracing.dataCollected", collect);
      assert.equal(result.scrollTop, 1200);
      const layouts = events.filter((e) => e.name === "Layout");
      const calls = events.filter((e) => e.name === "FunctionCall");
      const restoreCalls = calls.filter((e) =>
        /scrollRestore|baseline-scroll/.test(e.args?.data?.url ?? ""),
      );
      assert.ok(restoreCalls.length > 0, "Trace must capture the real restore callback");
      const forced = layouts.filter(
        (e) =>
          e.args?.beginData?.stackTrace?.length ||
          calls.some(
            (c) =>
              c.pid === e.pid && c.tid === e.tid && c.ts <= e.ts && c.ts + c.dur >= e.ts + e.dur,
          ),
      );
      const restoreLayouts = layouts.filter((e) =>
        restoreCalls.some(
          (c) => c.pid === e.pid && c.tid === e.tid && c.ts <= e.ts && c.ts + c.dur >= e.ts + e.dur,
        ),
      );
      const writes = events.filter((e) => e.name === "restore-scroll-write");
      const paints = events.filter((e) => e.name === "Paint");
      const wroteBeforeFirstPaint =
        !reveal || (writes.length > 0 && paints.length > 0 && writes[0].ts < paints[0].ts);
      assert.ok(wroteBeforeFirstPaint, "Restore must write before first paint after reveal");
      const file = `scroll-${label}-${reveal ? "reveal" : "settled"}.trace.json`;
      await writeFile(path.join(output, file), JSON.stringify({ traceEvents: events }));
      report.scroll.push({
        label,
        reveal,
        ...result,
        layouts: layouts.length,
        restoreCallbacks: restoreCalls.length,
        wroteBeforeFirstPaint,
        restoreLayouts: restoreLayouts.length,
        forcedLayouts: forced.map((e) => ({
          durationUs: e.dur,
          stack: e.args.beginData.stackTrace,
        })),
        trace: file,
      });
    }
  assert.deepEqual(errors, []);
  assert.equal(
    report.scroll.find((row) => row.label === "after" && row.reveal).restoreLayouts,
    0,
    "#69: revealing a pane must not force Layout inside restoreScroll",
  );
} finally {
  await writeFile(path.join(output, "results.json"), JSON.stringify(report, null, 2));
  console.log(
    JSON.stringify(
      {
        ...report,
        directory: report.directory.map(({ net, ...rest }) => ({
          ...rest,
          net: { ...net, urls: undefined },
        })),
      },
      null,
      2,
    ),
  );
  await browser.close();
  await server.close();
}
