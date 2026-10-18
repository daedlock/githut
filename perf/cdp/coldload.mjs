// cold/warm reload of the current workspace: paint + long-task + request + memory metrics
// Cold and warm reloads of the current workspace: paint timings, long tasks, requests, bundle, memory.
// usage: node coldload.mjs <label> [cpuRate=1] [reloadsPerCache=3]   Output: perf/results/<label>.json
import { writeFile } from "node:fs/promises";
import { connect, resultsDir } from "./lib.mjs";

const LABEL = process.argv[2] || "coldload";
const RATE = Number(process.argv[3] || 1),
  N = Number(process.argv[4] || 3);
const OUT = `${await resultsDir()}/${LABEL}.json`;
const { send, ev, listeners, close } = await connect();
let reqs = [],
  bytes = 0;
listeners.add((m) => {
  if (m.method === "Network.requestWillBeSent")
    reqs.push(m.params.request.url.replace(/^https?:\/\/[^/]+/, "").slice(0, 120));
  else if (m.method === "Network.loadingFinished") bytes += m.params.encodedDataLength;
});
await send("Page.enable");
await send("Page.bringToFront");
await send("Network.enable");
await send("Performance.enable");
await send("Emulation.setCPUThrottlingRate", { rate: RATE });
await send("Page.addScriptToEvaluateOnNewDocument", {
  source: `window.__lt=[];window.__lcp=0;try{new PerformanceObserver(l=>window.__lt.push(...l.getEntries().map(e=>({s:e.startTime,d:e.duration})))).observe({type:'longtask',buffered:true});new PerformanceObserver(l=>{for(const e of l.getEntries())window.__lcp=e.startTime}).observe({type:'largest-contentful-paint',buffered:true});}catch{}`,
});
const runs = [];
for (const cache of ["cold", "warm"])
  for (let i = 0; i < N; i++) {
    reqs = [];
    bytes = 0;
    if (cache === "cold") await send("Network.clearBrowserCache");
    await send("Network.setCacheDisabled", { cacheDisabled: false });
    await send("Page.reload", { ignoreCache: cache === "cold" });
    await new Promise((r) => setTimeout(r, 15000 * Math.max(1, RATE / 2)));
    const r = await ev(
      `(()=>{const nav=performance.getEntriesByType('navigation')[0];const paint=Object.fromEntries(performance.getEntriesByType('paint').map(p=>[p.name,Math.round(p.startTime)]));const res=performance.getEntriesByType('resource');const js=res.filter(r=>/\\.js(\\?|$)/.test(r.name));return {dcl:Math.round(nav.domContentLoadedEventEnd),load:Math.round(nav.loadEventEnd),paint,lcp:Math.round(window.__lcp),longtasks:{count:(window.__lt||[]).length,total:Math.round((window.__lt||[]).reduce((a,b)=>a+b.d,0)),max:Math.round(Math.max(0,...(window.__lt||[]).map(l=>l.d)))},jsKB:Math.round(js.reduce((a,r)=>a+r.encodedBodySize,0)/1024),jsFiles:js.length,dom:document.querySelectorAll('*').length,heapMB:Math.round(performance.memory.usedJSHeapSize/1048576)}})()`,
    );
    const m = Object.fromEntries(
      (await send("Performance.getMetrics")).result.metrics.map((x) => [x.name, x.value]),
    );
    r.cache = cache;
    r.requests = reqs.length;
    r.transferKB = Math.round(bytes / 1024);
    r.apiRequests = reqs.filter((u) => u.startsWith("/api") || u.includes("api.github")).length;
    r.metrics = {
      Nodes: m.Nodes,
      JSEventListeners: m.JSEventListeners,
      JSHeapUsedMB: Math.round(m.JSHeapUsedSize / 1048576),
      LayoutCount: m.LayoutCount,
      RecalcStyleCount: m.RecalcStyleCount,
      ScriptDuration: +m.ScriptDuration.toFixed(2),
      TaskDuration: +m.TaskDuration.toFixed(2),
    };
    r.sampleRequests = reqs.slice(0, 80);
    console.log(
      cache,
      i,
      JSON.stringify({
        fcp: r.paint["first-contentful-paint"],
        lcp: r.lcp,
        dcl: r.dcl,
        lt: r.longtasks,
        jsKB: r.jsKB,
        req: r.requests,
        api: r.apiRequests,
        dom: r.dom,
        heap: r.heapMB,
        listeners: r.metrics.JSEventListeners,
      }),
    );
    runs.push(r);
  }
await send("Emulation.setCPUThrottlingRate", { rate: 1 });
await writeFile(OUT, JSON.stringify({ rate: RATE, runs }, null, 1));
console.log("saved", OUT);
close();
process.exit(0);
