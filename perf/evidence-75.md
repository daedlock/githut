# Picker regression evidence (#75)

Measured in the production fixture build using Playwright Chromium, a
1400x900 viewport, 4x CPU slowdown, 3,000 conversation blocks and 100 options
per picker. Five trusted-click trials per cell; document fonts settle before
measurement. These are controlled fixture timings, not real-account PR timings.

| Data | Picker | Baseline median | Current median |
| --- | --- | ---: | ---: |
| Ready | Reviewers | 179.4 ms | 123.1 ms |
| Ready | Labels | 200.4 ms | 149.6 ms |
| Pending | Reviewers | 75.1 ms | 73.8 ms |
| Pending | Labels | 69.2 ms | 79.5 ms |

The ready-data improvement comes from containing portal layout and skipping
layout/paint for offscreen options while retaining every cmdk option for search
and keyboard navigation. Pending-data timing is comparable and does not wait
for options to arrive. Cold first trials remain slower than later opens; CPU
throttling and browser timing are noisy, so these are not latency guarantees.

The baseline leaves a visible popup after its Activity becomes hidden and fails
the orphan-portal assertion. Current checks pass tab hide/reveal/close, text
filtering, mouse selection, End/Enter selection of the offscreen last row,
keyboard scrolling, Escape focus return after the exit transition, reduced
motion, narrow viewport bounds, resize anchoring, styled popup clickability,
and opening while data is pending. The shared owned host is lazy, so unopened
popovers add no body nodes. The host detaches synchronously on Activity cleanup.

Reproduce in PowerShell:

```powershell
node node_modules/vite/bin/vite.js build --config perf/regressions.vite.config.ts
$env:PERF_PRODUCTION='1'
$env:PERF_LABEL='current'
node scripts/test-sidebar-pickers.mjs
```

Set `PERF_BASELINE=1` for the build to load the two original components directly
from Git commit f8efd23f6e9864001254713d4d8b85f2759e3581. No checkout files are
replaced. Baseline timing results save before the expected lifecycle assertion
fails. Unset PERF_BASELINE and rebuild to test current source. Samples and each
trial's Chrome trace are written under ignored `perf/results/`.

The separate app-wide overlay consolidation audit is tracked in #76.
