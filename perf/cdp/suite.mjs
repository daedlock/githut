// Interaction suite: Event Timing worst interaction, long tasks, request counts, optional
// Chrome trace (first trial) and optional React render attribution (profiling build).
// usage: node suite.mjs <label> <cpuRate> <trials> [groups=A,B,C,D,E,F,T] [--trace] [--react] [--noanim] [--tag x]
//   groups: A palette/typing · B pickers · C menus · D theme · E tab switches · F scroll ·
//           T composer typing · S stress workspace (load workspaces/stress.json first)
//   ONLY=probe,probe limits which probes run. Output: perf/results/<label>-<rate>x[-tag]/
import { createWriteStream } from "node:fs";
import { writeFile } from "node:fs/promises";
import { connect, resultsDir, sleep } from "./lib.mjs";

const argv = process.argv.slice(2);
const flag = (f) => argv.includes(f);
const opt = (f, d) => {
  const i = argv.indexOf(f);
  return i >= 0 ? argv[i + 1] : d;
};
const [MODE, RATE_S, TRIALS_S, GROUPS_S] = argv.filter(
  (a, i) => !a.startsWith("--") && !(i > 0 && argv[i - 1] === "--tag"),
);
if (!MODE || !RATE_S || !TRIALS_S) {
  console.log(
    "usage: suite.mjs <label> <cpuRate> <trials> [groups] [--trace] [--react] [--noanim] [--tag x]",
  );
  process.exit(2);
}
const RATE = Number(RATE_S),
  TRIALS = Number(TRIALS_S),
  GROUPS = (GROUPS_S || "A,B,C,D,E,F,T").split(",");
const TRACE = flag("--trace"),
  REACT = flag("--react"),
  NOANIM = flag("--noanim"),
  TAG = opt("--tag", "");
const PREFIX = `${MODE}-${RATE}x${TAG ? "-" + TAG : ""}`;
const OUT = await resultsDir(PREFIX);
const TRACES = await resultsDir("traces");
const { send, ev, settle, listeners } = await connect();

// network accounting
let netCount = 0,
  netUrls = [];
listeners.add((m) => {
  if (m.method === "Network.requestWillBeSent") {
    netCount++;
    if (netUrls.length < 60)
      netUrls.push(m.params.request.url.replace(/^https?:\/\/[^/]+/, "").slice(0, 140));
  }
});
await send("Network.enable");
await ev(`localStorage.setItem('umami.disabled','1'),1`);
await send("Page.enable");
await send("Page.bringToFront");
await send("Emulation.setCPUThrottlingRate", { rate: RATE });

// ---------- input helpers (trusted) ----------
async function center(sel, nth = 0) {
  const r = await ev(
    `(()=>{const els=[...document.querySelectorAll(${JSON.stringify(sel)})].filter(e=>e.getClientRects().length&&e.checkVisibility());const e=els[${nth}];if(!e)return null;e.scrollIntoView({block:'nearest'});const b=e.getBoundingClientRect();return {x:b.x+b.width/2,y:b.y+b.height/2}})()`,
  );
  if (!r) throw new Error("missing target " + sel + " #" + nth);
  return r;
}
async function mouse(sel, nth = 0, button = "left") {
  const { x, y } = await center(sel, nth);
  await send("Input.dispatchMouseEvent", { type: "mouseMoved", x, y });
  await send("Input.dispatchMouseEvent", {
    type: "mousePressed",
    x,
    y,
    button,
    clickCount: 1,
    buttons: button === "left" ? 1 : 2,
  });
  await send("Input.dispatchMouseEvent", { type: "mouseReleased", x, y, button, clickCount: 1 });
}
const KEYS = {
  Escape: ["Escape", 27],
  PageDown: ["PageDown", 34],
  Enter: ["Enter", 13],
  Backspace: ["Backspace", 8],
};
async function key(k, mods = 0) {
  const [code, vk] = KEYS[k] || ["Key" + k.toUpperCase(), k.toUpperCase().charCodeAt(0)];
  const text = k.length === 1 && !(mods & 2) ? k : undefined;
  await send("Input.dispatchKeyEvent", {
    type: text ? "keyDown" : "rawKeyDown",
    key: k,
    code,
    windowsVirtualKeyCode: vk,
    modifiers: mods,
    text,
  });
  await send("Input.dispatchKeyEvent", {
    type: "keyUp",
    key: k,
    code,
    windowsVirtualKeyCode: vk,
    modifiers: mods,
  });
}
async function ctrlKey(k) {
  await send("Input.dispatchKeyEvent", {
    type: "rawKeyDown",
    key: "Control",
    code: "ControlLeft",
    windowsVirtualKeyCode: 17,
    modifiers: 2,
  });
  await key(k, 2);
  await send("Input.dispatchKeyEvent", {
    type: "keyUp",
    key: "Control",
    code: "ControlLeft",
    windowsVirtualKeyCode: 17,
    modifiers: 0,
  });
}
async function typeText(s) {
  for (const ch of s) {
    await key(ch);
    await sleep(60);
  }
}
// programmatic setup clicks (not measured)
const domClick = (sel, nth = 0) =>
  ev(
    `(async()=>{const els=[...document.querySelectorAll(${JSON.stringify(sel)})].filter(e=>e.getClientRects().length&&e.checkVisibility());const e=els[${nth}];if(!e)throw Error('setup target missing ${sel.replace(/'/g, "")}');e.dispatchEvent(new PointerEvent('pointerdown',{bubbles:true,button:0,pointerType:'mouse'}));e.focus({preventScroll:true});e.dispatchEvent(new PointerEvent('pointerup',{bubbles:true,button:0,pointerType:'mouse'}));e.click();await document.activeViewTransition?.finished.catch(()=>{});await new Promise(r=>setTimeout(r,500));return 1})()`,
  );
const tab = (id) => domClick(`#tab-${id}`).catch(() => console.log("tab missing", id));
const btn = (label, nth = 0) => `button[aria-label="${label}"]`;
const esc = async () => {
  await key("Escape");
  await settle(300);
  if (await ev(`!!document.querySelector('[role=menu],[role=dialog],[cmdk-root]')`)) {
    await key("Escape");
    await settle(300);
  }
};
const waitFor = (cond, ms = 3000) =>
  ev(
    `(async()=>{const t=performance.now();while(performance.now()-t<${ms}){if(${cond})return true;await new Promise(r=>setTimeout(r,50))}return false})()`,
  );
const userMenuOpen = async () => {
  if (await ev(`!!document.querySelector('[role=menu] [aria-label="Light theme"]')`)) return;
  if (await ev(`!!document.querySelector('[role=menu]')`)) {
    await key("Escape");
    await waitFor(`!document.querySelector('[role=menu]')`);
  }
  await mouse(btn("Open user menu"));
  if (
    !(await waitFor(
      `[...document.querySelectorAll('[aria-label="Light theme"]')].some(e=>e.checkVisibility())`,
    ))
  )
    throw new Error("user menu did not open");
};
const radio = (label) => `[role=radio][aria-label="${label}"],button[aria-label="${label}"]`;

// ---------- probes ----------
await ev(
  `(()=>{if(window.__lt)return 1;window.__et=[];window.__lt=[];new PerformanceObserver(l=>{for(const e of l.getEntries())if(e.interactionId)window.__et.push({name:e.name,start:e.startTime,dur:e.duration,input:e.processingStart-e.startTime,proc:e.processingEnd-e.processingStart,pres:e.startTime+e.duration-e.processingEnd,target:e.target?.getAttribute?.('aria-label')||e.target?.tagName})}).observe({type:'event',durationThreshold:16});new PerformanceObserver(l=>window.__lt.push(...l.getEntries().map(e=>({start:e.startTime,dur:e.duration})))).observe({type:'longtask'});return 1})()`,
);
const env = await ev(
  `({vis:document.visibilityState,focus:document.hasFocus(),dom:document.querySelectorAll('*').length,viewport:[innerWidth,innerHeight],dpr:devicePixelRatio,ua:navigator.userAgent,react:typeof __perf,build:[...document.scripts].map(s=>s.src).filter(Boolean)})`,
);
if (NOANIM)
  await ev(
    `(()=>{const s=document.createElement('style');s.id='perf-noanim';s.textContent='*,*::before,*::after{animation:none!important;transition:none!important}::view-transition-group(*),::view-transition-old(*),::view-transition-new(*){animation:none!important}';document.head.append(s);document.startViewTransition=undefined;return 1})()`,
  );
env.noanim = NOANIM;
console.log("ENV", JSON.stringify(env));
if (env.vis !== "visible") {
  console.log("ABORT: page not visible");
  process.exit(3);
}
if (REACT && env.react !== "object") {
  console.log("ABORT: --react but no __perf");
  process.exit(3);
}

const TRACE_CATS = [
  "-*",
  "devtools.timeline",
  "v8.execute",
  "disabled-by-default-devtools.timeline",
  "disabled-by-default-devtools.timeline.frame",
  "toplevel",
  "blink.console",
  "blink.user_timing",
  "latencyInfo",
  "disabled-by-default-devtools.timeline.stack",
  "disabled-by-default-v8.cpu_profiler",
  "disabled-by-default-devtools.v8-source-rundown",
  "disabled-by-default-devtools.timeline.invalidationTracking",
  "disabled-by-default-devtools.timeline.layers",
  "loading",
  "v8",
  "blink.animations",
];
async function traceStart() {
  await send("Tracing.start", {
    transferMode: "ReturnAsStream",
    traceConfig: { includedCategories: TRACE_CATS, excludedCategories: ["*"] },
  });
}
async function traceStop(file) {
  const done = new Promise((r) => {
    const l = (m) => {
      if (m.method === "Tracing.tracingComplete") {
        listeners.delete(l);
        r(m.params.stream);
      }
    };
    listeners.add(l);
  });
  await send("Tracing.end");
  const stream = await done;
  const out = createWriteStream(file);
  for (;;) {
    const m = await send("IO.read", { handle: stream, size: 4 << 20 });
    const d = m.result;
    out.write(d.base64Encoded ? Buffer.from(d.data, "base64") : d.data);
    if (d.eof) break;
  }
  await send("IO.close", { handle: stream });
  await new Promise((r) => out.end(r));
}

const summary = [];
async function probe(
  name,
  { setup = async () => {}, action, cleanup = esc, wait = 1500, collect },
) {
  if (process.env.ONLY && !process.env.ONLY.split(",").includes(name)) return;
  const samples = [];
  for (let i = 0; i < TRIALS; i++) {
    try {
      await setup();
      await settle(700);
      const before = await ev(
        `({dom:document.querySelectorAll('*').length,vis:document.visibilityState})`,
      );
      if (before.vis !== "visible") throw new Error("page hidden");
      const doTrace = TRACE && i === 0;
      if (doTrace) {
        await traceStart();
        await sleep(300);
      }
      netCount = 0;
      netUrls = [];
      await ev(
        `(window.__et.length=0,window.__lt.length=0,performance.mark('GH:${name}:${i}:start'),${REACT ? `__perf.start(${JSON.stringify(name + ":" + i)}),` : ""}1)`,
      );
      const t0 = Date.now();
      await action();
      await settle(wait);
      const extra = collect ? await collect() : null;
      const r = await ev(
        `(()=>{performance.mark('GH:${name}:${i}:end');const et=window.__et.slice();const worst=et.reduce((a,e)=>e.dur>(a?.dur??-1)?e:a,null);return {worst,et,longtasks:window.__lt.slice(),dom:document.querySelectorAll('*').length,overlay:[...document.querySelectorAll('[role=menu],[role=dialog],[role=listbox],[cmdk-root]')].map(e=>e.getAttribute('aria-label')||e.getAttribute('role')),react:${REACT ? "__perf.stop()" : "null"}}})()`,
      );
      if (doTrace) await traceStop(`${TRACES}/${name}-${PREFIX}.json`);
      r.wallMs = Date.now() - t0;
      r.net = { count: netCount, urls: netUrls };
      r.domBefore = before.dom;
      r.extra = extra;
      samples.push(r);
      const loc = r.react
        ? Object.fromEntries(
            Object.entries(r.react.byLocation).map(([k, v]) => [
              k,
              `${v.renders}r/${v.totalSelf.toFixed(1)}ms`,
            ]),
          )
        : "";
      console.log(
        `${name} ${i + 1}/${TRIALS}: worst=${r.worst ? Math.round(r.worst.dur) : "—"}ms (in ${r.worst?.input?.toFixed(0)}/proc ${r.worst?.proc?.toFixed(0)}/pres ${r.worst?.pres?.toFixed(0)}) maxLT=${Math.round(Math.max(0, ...r.longtasks.map((l) => l.dur)))} net=${netCount}${REACT ? ` commits=${r.react.commits} react=${r.react.totalActualDuration.toFixed(1)}ms ${JSON.stringify(loc)}` : ""}${extra ? " extra=" + JSON.stringify(extra).slice(0, 200) : ""}`,
      );
    } catch (e) {
      console.log(`${name} ${i + 1}/${TRIALS}: ERROR ${e.message}`);
      samples.push({ error: e.message });
      try {
        await esc();
      } catch {}
      continue;
    }
    try {
      await cleanup();
    } catch (e) {
      console.log("cleanup error", e.message);
    }
  }
  const durs = samples
    .filter((s) => s.worst)
    .map((s) => s.worst.dur)
    .sort((a, b) => a - b);
  const median = durs.length ? durs[Math.floor(durs.length / 2)] : null;
  summary.push({
    name,
    median,
    durs: samples.map((s) => s.worst?.dur ?? null),
    errors: samples.filter((s) => s.error).length,
  });
  await writeFile(
    `${OUT}/${name}.json`,
    JSON.stringify({ name, prefix: PREFIX, rate: RATE, env, samples }, null, 1),
  );
}

// workspace tab ids (reference workspace, evidence/prod-session-workspace.json)
const T = {
  inbox: "tmvd3ja6l3",
  gCode: "tmvd3kd5yw",
  gSrc: "tmvd3l13q1q",
  gPRs: "tmvd3kkx2x",
  gIssues: "tmvd3koe3y",
  topConvo: "tmvd3jxwd5",
  topDiff: "tmvd3llq62p",
  n326: "tmvd3k96pm",
  nCode: "tmvd3m3nu3h",
  nPRs: "tmvd3m7sc3i",
  n790: "tmvd3nlp84a",
  run: "tmvd3nw5j52",
};
const baseline = async () => {
  await tab(T.gPRs);
  await tab(T.topDiff);
  await tab(T.n790);
};
const noop = async () => {};

if (GROUPS.includes("A")) {
  await baseline();
  await probe("A-palette", { action: () => ctrlKey("k") });
  await probe("A-type-pull", {
    setup: async () => {
      await ctrlKey("k");
      await settle(400);
    },
    action: () => typeText("pull"),
  });
}
if (GROUPS.includes("B")) {
  await baseline();
  for (const [short, label, n] of [
    ["conversation-repo", "Switch repository", 2],
    ["conversation-section", "Switch section", 2],
    ["conversation-item", "Switch pull request", 1],
    ["files-repo", "Switch repository", 1],
    ["files-section", "Switch section", 1],
    ["files-item", "Switch pull request", 0],
  ])
    await probe("B-" + short, { action: () => mouse(btn(label), n) });
}
if (GROUPS.includes("C")) {
  await baseline();
  await probe("C-island-actions", { action: () => mouse(btn("Island actions"), 1) });
  await probe("C-tab-context", {
    setup: () => tab(T.topDiff),
    action: () => mouse(`#tab-${T.topDiff}`, 0, "right"),
  });
  await probe("C-user-menu", { action: () => mouse(btn("Open user menu")) });
  await tab(T.nCode);
  await probe("C-branch", { action: () => mouse('button[aria-label^="Branch:"]') });
  await tab(T.n790);
}
if (GROUPS.includes("D")) {
  await tab(T.gIssues);
  await baseline();
  const vtDone = () =>
    ev(
      `(async()=>{const t0=performance.now();const vt=document.activeViewTransition;if(vt){await vt.finished.catch(()=>{});}return {vtFinishedAfterMs:vt?Math.round(performance.now()-t0):null}})()`,
    );
  await probe("D-palette", {
    setup: async () => {
      await userMenuOpen();
      await domClick(btn("githut palette"));
      await esc();
      await userMenuOpen();
    },
    action: () => mouse(btn("ember palette")),
    wait: 2500,
    collect: vtDone,
  });
  await probe("D-light", {
    setup: async () => {
      await userMenuOpen();
      await domClick(radio("Dark theme"));
      await esc();
      await userMenuOpen();
    },
    action: () => mouse(radio("Light theme")),
    wait: 2500,
    collect: vtDone,
  });
  await probe("D-dark", {
    setup: async () => {
      await userMenuOpen();
      await domClick(radio("Light theme"));
      await esc();
      await userMenuOpen();
    },
    action: () => mouse(radio("Dark theme")),
    wait: 2500,
    collect: vtDone,
  });
  try {
    await userMenuOpen();
    await domClick(btn("githut palette"));
    await userMenuOpen();
    await domClick(radio("Light theme"));
    await esc();
  } catch (e) {
    console.log("theme restore failed", e.message);
  }
}
if (GROUPS.includes("E")) {
  await tab(T.gIssues);
  await baseline();
  await probe("E-to-conversation", {
    setup: () => tab(T.nCode),
    action: () => mouse(`#tab-${T.n790}`),
    cleanup: noop,
    wait: 2500,
  });
  await probe("E-from-conversation", {
    setup: () => tab(T.n790),
    action: () => mouse(`#tab-${T.nCode}`),
    cleanup: noop,
    wait: 2500,
  });
  await probe("E-to-files", {
    setup: () => tab(T.topConvo),
    action: () => mouse(`#tab-${T.topDiff}`),
    cleanup: noop,
    wait: 2500,
  });
  await probe("E-from-files", {
    setup: () => tab(T.topDiff),
    action: () => mouse(`#tab-${T.topConvo}`),
    cleanup: noop,
    wait: 2500,
  });
  await tab(T.topDiff);
  await tab(T.n790);
}
if (GROUPS.includes("F")) {
  await baseline();
  const scrollTop = (id) =>
    ev(
      `(()=>{const p=document.querySelector('[data-tab-pane="${id}"]');const s=[p,...p.querySelectorAll('*')].find(e=>e.scrollHeight>e.clientHeight+50&&/(auto|scroll)/.test(getComputedStyle(e).overflowY));if(s)s.scrollTop=0;return !!s})()`,
    );
  const rafProbe = `(()=>{window.__raf={gaps:[],last:performance.now(),on:true};const f=t=>{if(!window.__raf.on)return;window.__raf.gaps.push(t-window.__raf.last);window.__raf.last=t;requestAnimationFrame(f)};requestAnimationFrame(f);return 1})()`;
  const rafCollect = () =>
    ev(
      `(()=>{window.__raf.on=false;const sc=[...document.querySelectorAll('[data-tab-pane]')].filter(p=>p.checkVisibility()).flatMap(p=>[p,...p.querySelectorAll('*')]).filter(e=>e.scrollTop>0).map(e=>e.scrollTop);const g=window.__raf.gaps.slice(1).sort((a,b)=>b-a);return {maxGap:Math.round(g[0]||0),p95:Math.round(g[Math.floor(g.length*0.05)]||0),frames:g.length,over50:g.filter(x=>x>50).length,scrolledTo:sc}})()`,
    );
  const wheel = async (id) => {
    const { x, y } = await center(`[data-tab-pane="${id}"]`);
    await ev(rafProbe);
    for (let k = 0; k < 24; k++) {
      await send("Input.dispatchMouseEvent", { type: "mouseWheel", x, y, deltaX: 0, deltaY: 75 });
      await sleep(16);
    }
  };
  await probe("F-conversation-wheel", {
    setup: () => scrollTop(T.n790),
    action: () => wheel(T.n790),
    cleanup: noop,
    collect: rafCollect,
  });
  await probe("F-files-wheel", {
    setup: () => scrollTop(T.topDiff),
    action: () => wheel(T.topDiff),
    cleanup: noop,
    collect: rafCollect,
  });
  await probe("F-conversation-pagedown", {
    setup: async () => {
      await scrollTop(T.n790);
      await mouse(`[data-tab-pane="${T.n790}"] h1, [data-tab-pane="${T.n790}"]`);
    },
    action: () => key("PageDown"),
    cleanup: noop,
  });
}
if (GROUPS.includes("T")) {
  // typing in the PR comment composer (no submit)
  await baseline();
  const composer = `[data-tab-pane="${T.topConvo}"] textarea`;
  await tab(T.topConvo);
  await probe("T-composer-type", {
    setup: async () => {
      await ev(
        `(()=>{const t=[...document.querySelectorAll(${JSON.stringify(composer)})].pop();t.scrollIntoView({block:'center'});t.focus();t.select();return 1})()`,
      );
      await key("Backspace");
    },
    action: async () => {
      await ev(
        `(()=>{const t=[...document.querySelectorAll(${JSON.stringify(composer)})].pop();t.focus();return 1})()`,
      );
      await typeText("profiling keystroke latency");
    },
    cleanup: async () => {
      await ev(
        `(()=>{const t=[...document.querySelectorAll(${JSON.stringify(composer)})].pop();t.focus();t.select();return 1})()`,
      );
      await key("Backspace");
      await ev("document.activeElement.blur(),1");
    },
  });
  await tab(T.topDiff);
}
if (GROUPS.includes("S")) {
  // stress workspace (evidence/stress-workspace.json must be loaded): biggest diffs
  const S = {
    c741: "tstress741c",
    f741: "tstress741f",
    f727: "tstress727f",
    f717: "tstress717f",
    fd1: "tstressd1f",
    cd1: "tstressd1c",
  };
  await probe("S-to-files-741", {
    setup: () => tab(S.c741),
    action: () => mouse(`#tab-${S.f741}`),
    cleanup: noop,
    wait: 3000,
  });
  await probe("S-to-files-727", {
    setup: () => tab(S.c741),
    action: () => mouse(`#tab-${S.f727}`),
    cleanup: noop,
    wait: 3000,
  });
  await probe("S-to-files-d1", {
    setup: () => tab(S.cd1),
    action: () => mouse(`#tab-${S.fd1}`),
    cleanup: noop,
    wait: 3000,
  });
  await tab(S.f741);
  await probe("S-palette", { action: () => ctrlKey("k") });
  await probe("S-tab-context", { action: () => mouse(`#tab-${S.f741}`, 0, "right") });
}

const metrics = (await send("Performance.enable"), await send("Performance.getMetrics")).result
  .metrics;
await send("Emulation.setCPUThrottlingRate", { rate: 1 });
await writeFile(
  `${OUT}/_summary.json`,
  JSON.stringify(
    { prefix: PREFIX, env, summary, metrics, finishedAt: new Date().toISOString() },
    null,
    1,
  ),
);
console.log("SUMMARY");
for (const s of summary)
  console.log(
    `${s.name.padEnd(26)} median=${s.median === null ? "—" : Math.round(s.median)} [${s.durs.map((d) => (d === null ? "x" : Math.round(d))).join(",")}] errors=${s.errors}`,
  );
process.exit(0);
