# Perf harness

Reproduces the UI latency evidence in #56 so performance fixes can record before/after numbers on the
same probes. It has two parts:

- **React render attribution** (`hook/`): a profiling build (`react-dom/profiling`, names kept) with a
  small `__REACT_DEVTOOLS_GLOBAL_HOOK__` stub inlined first in `<head>`. `window.__perf.start()` /
  `stop()` returns which components rendered, why (props / state / context / parent) and where
  (visible pane, background tab, other island, sidebar, overlay). See [`hook/README.md`](hook/README.md).
- **Interaction timings** (`cdp/`): scripts that drive a real, signed-in Chrome over the DevTools
  Protocol with trusted input. They record the worst Event Timing entry per trial, long tasks, request
  counts, and optionally one Chrome trace per probe and the React attribution above.

## Setup

1. Start the worker and a preview build (prod or profiling) on `localhost:4173`. Sign-in needs the
   worker's `APP_URL` to match that origin:
   ```bash
   bunx wrangler dev --port 8787 --var APP_URL:http://localhost:4173
   bun run build && bunx vite preview --port 4173 --strictPort   # ordinary build
   bun run perf:build && bun run perf:preview                    # profiling build (same origin)
   ```
   Switching builds behind the same origin keeps the sign-in and workspace.
2. Start a dedicated Chrome with remote debugging, a throwaway profile and no extensions. Add the
   occlusion flags if the window may be covered; otherwise keep it visible, because a hidden page stops
   painting and the suite aborts:
   ```
   chrome --user-data-dir=<tmp profile> --remote-debugging-port=9222 --disable-extensions \
     --disable-features=CalculateNativeWinOcclusion --disable-backgrounding-occluded-windows --disable-renderer-backgrounding
   ```
   Sign in at `http://localhost:4173` in that window.
3. Load a workspace and warm every tab:
   ```bash
   node perf/cdp/setws.mjs perf/workspaces/reference.json && node perf/cdp/warm.mjs
   ```
   `reference.json` is the 3-island / 12-tab workspace used in #56. `stress.json` holds the largest
   diffs; `minimal.json` keeps only the three visible tabs (an A/B for hidden panes).

**WSL + Windows Chrome:** WSL can't reach Chrome's `[::1]` listener. Run the scripts with Windows
Node (`"/mnt/c/Program Files/nodejs/node.exe" perf/cdp/suite.mjs …`) and set
`PERF_CDP=http://[::1]:9222` if another Chrome already holds `127.0.0.1:9222`.
Pass the variable to Windows with `WSLENV=PERF_CDP` (no `/u` flag). The harness also
tries IPv6 loopback if the IPv4 endpoint fails or returns non-JSON content.
The commit hook retains its `hidden` JSON bucket for compatibility; it means background tabs.

## Running

```bash
node perf/cdp/suite.mjs prod 4 5 A,B,C,D,E,F,T --trace    # ordinary build, 4× CPU, 5 trials, traces
node perf/cdp/suite.mjs prof 1 5 A,B,C,D,E,F,T --react    # profiling build, render attribution
ONLY=A-palette,C-tab-context node perf/cdp/suite.mjs prod 1 5 A,C
node perf/cdp/coldload.mjs load-prod-1x 1 3                # cold + warm reloads
bun run perf:test                                          # validates the commit hook (needs Playwright Chromium)
```

| Group | Probes |
|---|---|
| A | `A-palette` (Ctrl+K), `A-type-pull` (typing in the palette) |
| B | Repo, section and PR pickers on the conversation and Files tabs |
| C | `C-island-actions`, `C-tab-context` (right-click), `C-user-menu`, `C-branch` |
| D | `D-palette`, `D-light`, `D-dark` (user menu theme controls) |
| E | `E-to-conversation`, `E-from-conversation`, `E-to-files`, `E-from-files` (tab switches) |
| F | Wheel scroll (rAF gaps) and PageDown on the conversation and Files tabs |
| T | `T-composer-type`: typing in the PR comment composer (never submitted) |
| S | Stress workspace: Files switches on the largest diffs, palette, tab menu |

`--noanim` disables animations, transitions and view transitions for an A/B. `--tag` suffixes the
output folder.

## Output

Results go to `perf/results/` (gitignored). Each run writes `<label>-<rate>x[-tag]/`:

- `<probe>.json` per probe: per-trial `worst` (Event Timing entry: `dur`, `input`, `proc`, `pres`),
  all entries, long tasks, `net` (request count and URLs), DOM size, `react` (the `__perf.stop()`
  summary when `--react` is passed) and probe-specific `extra` (e.g. scroll rAF gaps).
- `_summary.json`: median and per-trial durations for every probe, plus `Performance.getMetrics`.
- `traces/<probe>-<label>.json`: one Chrome trace for the first trial (with `--trace`). Load it in
  DevTools › Performance.

The console prints a `SUMMARY` table. "—" means no interaction exceeded Chrome's 16 ms Event
Timing threshold, not zero. Report medians of 5 at 1× and 4×. Trial 1 is often a first-time cost, so
call it out rather than mixing it in. Noise at 4× is about ±20%.
