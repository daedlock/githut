# commit-hook.js — self-contained React commit recorder

Used instead of the React DevTools backend, which failed with missing-fiber Store errors.
`bun run perf:build` builds `dist-profiling` (react-dom/profiling, keepNames) and inlines
this script as the first child of `<head>`.
It installs a minimal `__REACT_DEVTOOLS_GLOBAL_HOOK__` (supportsFiber, inject,
renderers, onCommitFiberRoot, ...) and does nothing per commit until `__perf.start()`.

## API
- `__perf.start(label)`: reset buffers and record every commit.
- `__perf.stop()`: stop and return the summary (JSON-serializable).
- `__perf.reset()`: clear buffers.  `__perf.raw()`: per-commit fiber records.
- `__perf.isRecording()`

## Summary fields (`stop()`)
- `commits`, `totalActualDuration` (sum of HostRoot actualDuration per commit), `elapsedMs`, `errors` (hook exceptions, React swallows them).
- `byComponent[]` (top 200, sorted by `totalActual` desc): `name`, `renders`, `mounts`,
  `totalActual` (inclusive of children), `totalSelf` (actual minus children's actual), `maxActual`,
  `selfBaseDuration` (last seen), `why{props,state,context,parent}`, `propKeys{key:count}`,
  `locations{visible,hidden,otherIsland,sidebar,overlay,shell}`, `panes{paneId:count}`.
- `bySelf[]`: top 50 by exclusive time (inclusive sorting puts shell ancestors on top).
- `byLocation{loc:{renders,totalActual,totalSelf}}`.
- `byPane{paneId:{island,renders,totalActual,totalSelf,hiddenRenders,hidden}}`. `hidden` reflects the last render.
- `commitsList[]`: `{t (ms since start), duration, fibers, priority}`.
- `raw().commits[].f[]`: `[name, actual, self, selfBase, why, location, pane, island, changedProps]`.

## How "rendered" is decided
The walk starts at `root.current`. It descends into a fiber's children only when `fiber.child !== alternate.child`
(or the fiber mounted), so subtrees React did not reconcile are skipped. A component fiber
(function, class, forwardRef, simple memo) counts as rendered when it has no alternate (mount)
or carries the `PerformedWork` flag (`flags & 1`). This is the same test DevTools uses for components.
`MemoComponent` wrapper fibers (tag 14) are skipped because their inner component is counted as its own fiber.

## Why
Every applicable reason is counted, so the reasons are not exclusive. `parent` is used only when no other reason applies.
- `props`: a top-level shallow diff of memoizedProps against the alternate found changed keys. A new props object with equal values falls to `parent`.
- `state`: a class state change, or a change in a hook that has an update queue (useState, useReducer, useSyncExternalStore, useTransition, useActionState, useOptimistic). Effect and memo hooks are ignored because their identity changes on every render. Zustand and TanStack store updates show up as `state` through useSyncExternalStore.
- `context`: a position-wise compare of `fiber.dependencies.firstContext` `memoizedValue` against the alternate.

## Location (DOM attributes from the islands workspace)
The walk tracks the nearest host ancestor element. Portals use `containerInfo`. The element is classified and cached per element per commit:
1. `overlay`: inside `[role=dialog|alertdialog|menu|listbox|tooltip]`, `[data-radix-popper-content-wrapper]`, `[data-link-menu-content]` or `[cmdk-root]`, or not under `#root`.
2. `sidebar`: inside `#workspace-sidebar` (`<aside>` in Sidebar.tsx).
3. Inside `[data-tab-pane=<tabId>]` (TabHost.tsx) or `[data-island=<islandId>]` (IslandLayout.tsx):
   - `hidden`: the pane or island fails `checkVisibility()` (Activity display:none, or a `hidden` island when another is maximized). Cached per element per commit.
   - `otherIsland`: visible, but the island lacks `data-focused`.
   - `visible`: in the focused island.
4. `shell`: anything else, such as App, TabHost and IslandLayout wrappers.
Any fiber under a hidden `OffscreenComponent` (memoizedState != null, i.e. `<Activity mode="hidden">`) is `hidden`, whatever its DOM.

## Known limits
- A component's location is where its parent host element is, not where its own output goes. Wrapper components above a pane's `<div data-tab-pane>` (for example TabPane itself) count as `shell`.
- Context attribution is exact for `useContext`/`use` reads, but a context read that happens only on some renders (conditional) misaligns the positional compare and falls to `parent`/`props`.
- Hook `state` covers queue hooks only. A component re-rendered by a store whose selector returns a new reference each time is still reported as `state`, which is correct but noisy.
- Durations come from the profiling build (`actualDuration`) and include the profiler's own overhead. Treat them as relative numbers. Hidden-Activity pre-rendering happens in separate low-priority commits.
- Commit-phase (effects, layout) time is not measured. Use a Performance trace for that.
- Validation: `commit-hook.test.ts` (real react-dom/profiling in headless Chromium, 15 checks) and a load of the served profiling build.
