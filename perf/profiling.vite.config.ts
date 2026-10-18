// Profiling build: react-dom/profiling (component actualDuration) with names kept and the
// commit hook inlined as the first <head> script so it is installed before React loads.
import { readFileSync } from "node:fs";
import path from "node:path";
import { mergeConfig, type Plugin } from "vite";
import base from "../vite.config";

const hook = readFileSync(path.join(import.meta.dirname, "hook/commit-hook.js"), "utf8");

const injectCommitHook: Plugin = {
  name: "perf-commit-hook",
  transformIndexHtml: () => [{ tag: "script", children: hook, injectTo: "head-prepend" }],
};

export default mergeConfig(base, {
  plugins: [injectCommitHook],
  resolve: { alias: { "react-dom/client": "react-dom/profiling" } },
  build: {
    outDir: "dist-profiling",
    sourcemap: true,
    rolldownOptions: { output: { keepNames: true } },
  },
});
