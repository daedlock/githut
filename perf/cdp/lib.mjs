// Shared Chrome DevTools Protocol plumbing for the perf scripts. Plain Node/Bun, no deps.
//
//   PERF_CDP     DevTools HTTP endpoint (default http://127.0.0.1:9222). Use http://[::1]:9222
//                when Chrome only listens on IPv6, e.g. another Chrome already holds 127.0.0.1:9222.
//   PERF_ORIGIN  the app origin whose tab is driven (default http://localhost:4173).
import { mkdir } from "node:fs/promises";
import { fileURLToPath } from "node:url";

export const CDP = process.env.PERF_CDP || "http://127.0.0.1:9222";
export const ORIGIN = process.env.PERF_ORIGIN || "http://localhost:4173";
/** perf/results/, gitignored. */
export const RESULTS = fileURLToPath(new URL("../results/", import.meta.url));

export async function resultsDir(...parts) {
  const dir = [RESULTS, ...parts].join("/").replace(/\/+/g, "/");
  await mkdir(dir, { recursive: true });
  return dir;
}

/** Discover Chrome, including machines where another process owns IPv4 loopback. */
export async function discoverTargets(endpoint = CDP, request = fetch) {
  const candidates = [endpoint];
  const url = new URL(endpoint);
  if (url.hostname === "127.0.0.1" || url.hostname === "localhost") {
    url.hostname = "[::1]";
    candidates.push(url.origin);
  }
  const failures = [];
  for (const candidate of candidates) {
    try {
      const response = await request(`${candidate}/json/list`);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const list = await response.json();
      if (!Array.isArray(list)) throw new Error("expected a JSON array of Chrome targets");
      return list;
    } catch (error) {
      failures.push(`${candidate}: ${error.message}`);
    }
  }
  throw new Error(
    `Cannot discover Chrome DevTools targets. Check --remote-debugging-port and PERF_CDP. ${failures.join("; ")}`,
  );
}

/** Connects to the first page tab on ORIGIN and returns the CDP helpers. */
export async function connect() {
  const list = await discoverTargets();
  const target = list.find((p) => p.type === "page" && p.url.startsWith(ORIGIN));
  if (!target) throw new Error(`no page on ${ORIGIN} at ${CDP}`);
  // Chrome reports IPv6 loopback as [0000:...:0001], which WebSocket hosts reject.
  const ws = new WebSocket(target.webSocketDebuggerUrl.replace(/\[[0:]+1\]/, "[::1]"));
  await new Promise((resolve, reject) => {
    ws.onopen = resolve;
    ws.onerror = reject;
  });
  let id = 0;
  const pending = new Map();
  const listeners = new Set();
  ws.onmessage = (e) => {
    const m = JSON.parse(e.data);
    if (m.id && pending.has(m.id)) {
      pending.get(m.id)(m);
      pending.delete(m.id);
    } else if (m.method) for (const l of listeners) l(m);
  };
  const send = (method, params = {}) =>
    new Promise((resolve) => {
      const i = ++id;
      pending.set(i, resolve);
      ws.send(JSON.stringify({ id: i, method, params }));
    });
  /** Evaluates an expression in the page, awaiting promises; throws page exceptions. */
  const ev = async (expression) => {
    const m = await send("Runtime.evaluate", {
      expression,
      awaitPromise: true,
      returnByValue: true,
    });
    if (m.error) throw new Error(m.error.message);
    if (m.result.exceptionDetails)
      throw new Error(
        m.result.exceptionDetails.exception?.description?.slice(0, 400) || "eval error",
      );
    return m.result.result.value;
  };
  /** Two animation frames plus `ms`, so measured work has painted before the next step. */
  const settle = (ms = 600) =>
    ev(
      `new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(()=>setTimeout(()=>r(1),${ms}))))`,
    );
  const close = () => ws.close();
  return { send, ev, settle, listeners, close };
}

export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** Storage keys hold the signed-in account id; read it from the page instead of hard-coding. */
export async function accountScope(ev) {
  return ev(`(()=>{const keys=[...Object.keys(localStorage),...Object.keys(sessionStorage)];
    const k=keys.find(k=>/^githut\\.workspace(\\.window)?\\.account\\.\\d+$/.test(k));
    return k?k.replace(/^.*\\.account\\./,''):null})()`);
}
