#!/usr/bin/env bun
/**
 * Dev runner: starts Vite (5173) and Wrangler (8787) in parallel.
 * Output is prefixed so you can tell who said what.
 */

type Proc = { name: string; color: string; cmd: string[] };

const procs: Proc[] = [
  { name: "vite", color: "\x1b[36m", cmd: ["bunx", "vite"] },
  { name: "wrgl", color: "\x1b[33m", cmd: ["bunx", "wrangler", "dev", "--port", "8787", "--persist-to", ".wrangler/state", "--var", "APP_URL:http://localhost:5173"] },
];

const RESET = "\x1b[0m";
const spawned: ReturnType<typeof Bun.spawn>[] = [];

function prefixStream(
  stream: ReadableStream<Uint8Array>,
  label: string,
  sink: (s: string) => void,
) {
  const decoder = new TextDecoder();
  let buf = "";
  const reader = stream.getReader();
  (async () => {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buf += decoder.decode(value, { stream: true });
      let idx = buf.indexOf("\n");
      while (idx !== -1) {
        sink(`${label}${buf.slice(0, idx)}${RESET}`);
        buf = buf.slice(idx + 1);
        idx = buf.indexOf("\n");
      }
    }
    if (buf) sink(`${label}${buf}${RESET}`);
  })();
}

for (const p of procs) {
  const label = `${p.color}[${p.name}] `;
  const child = Bun.spawn(p.cmd, { stdout: "pipe", stderr: "pipe", stdin: "inherit" });
  spawned.push(child);
  prefixStream(child.stdout, label, console.log);
  prefixStream(child.stderr, label, console.error);
  child.exited.then((code) => {
    console.log(`${label}exited (${code})${RESET}`);
    for (const other of spawned) {
      if (other !== child && !other.killed) other.kill();
    }
  });
}

const shutdown = () => {
  for (const child of spawned) if (!child.killed) child.kill();
  process.exit(0);
};
process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
