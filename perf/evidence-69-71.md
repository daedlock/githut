# Browser evidence for #69 and #71

Run on 2026-10-18 with Playwright Chromium 153.0.8010.12:

```sh
node perf/cdp/regression-evidence.mjs
```

The harness starts its own Vite server on port 15181, uses a separate dependency
cache, and loads baseline source directly from Git commit
`f8efd23f6e9864001254713d4d8b85f2759e3581` into virtual modules. It does not replace
checkout files. Current modules are imported from the working tree. GitHub
requests are intercepted with deterministic responses; no account or real
GitHub data is accessed. Raw JSON and Chrome traces go to the ignored directory
`perf/results/regression-evidence/`.

## #71: directory request fan-out

The browser executes the actual baseline `pathCommitQueryOptions` once for each
of 116 paths, then the actual current `directoryCommitsQueryOptions` for the same
paths. Both runs independently fetch the directory header. CDP
`Network.requestWillBeSent` supplies each result's `net` count and URL list;
browser CORS OPTIONS preflights are excluded from API request counts.

| Source | Row REST requests | GraphQL requests | Header REST requests | Total |
| --- | ---: | ---: | ---: | ---: |
| Baseline | 116 | 0 | 1 | 117 |
| Current | 0 | 3 | 1 | 4 |

Assertions verify 116 returned entries and identical commit fields for the first
row, last row, and independent header. The complementary unit test verifies
batch sizes of 50, 50, and 16, cache reuse under reordered paths, and empty
histories. This is an isolated data-layer browser probe, not a signed-in
production Code-tab timing claim; the separate `CASE=directory-commits` full-app
browser fixture covers rendered rows and the production row component.

## #69: scroll restoration trace

The browser uses a real 600-pixel scroll container with 10,000 rows and restores
it to 1200 pixels. It captures both an already laid-out container and a container
just revealed from `display:none`. For reveal, hiding is allowed to paint before
tracing begins; revealing and invoking `restoreScroll` happen in the same task.
Trace analysis checks both Layout stack frames and Layout events nested inside
the actual restore callback's FunctionCall interval. Each run must contain a
restore callback and end at the expected scroll position.

| Source / scenario | Restore callbacks | Layouts inside restore callback |
| --- | ---: | ---: |
| Baseline, settled | 1 | 0 |
| Current, settled | 4 | 0 |
| Baseline, newly revealed | 1 | 1 |
| Current, newly revealed | 4 | 0 |

The final implementation produces no forced Layout in either current trace.
The baseline reveal forces Layout at the `el.scrollTop = target` write in
`step` (about 71 ms in this run). The current implementation lets the browser
perform that layout normally, then writes from ResizeObserver before paint.
Its four module callbacks are the requestAnimationFrame scheduling and
ResizeObserver delivery for the write and the next-frame confirmation.

The fixture wraps the native scrollTop setter only to record a performance mark
after each write. Both reveal traces assert that the first restore write occurs
before the first Paint event. The current run reaches the required position
without painting an intermediate un-restored pane. Trace recording continues
for two frames after restoration to include that paint. Assertions fail if a
current reveal forces layout inside a restore callback or writes after the first
paint; raw results and traces are always saved.

The fixture does not substitute for the issue's named full-app
E-to-conversation / E-from-files probes. It provides a reproducible failing
condition in the actual function that those probes exercise.

Final validation: 244 tests passed across 50 files with Bun 1.4.3, TypeScript typecheck and production build passed. A deliberately inverted restore completion condition failed four unit tests; the restored implementation passed. The browser trace check additionally covers actual layout and paint ordering that injected-frame unit tests cannot model.
