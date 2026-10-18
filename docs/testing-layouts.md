# Loading and review layout regression checks

Run `bun install` and `bunx playwright install chromium`, then `bun run test:browser`.
The suite starts a local Vite server on port 5176 and uses isolated browser contexts
with mocked GitHub responses. It never submits a real review.

To reuse a running local server, set `UI_BASE_URL=http://localhost:5176`.
Pass `--quick` to check the cold-loading matrix at one mobile width while retaining
the review interaction and error cases. Screenshots and results go to
`test-results/loading-layouts/` (ignored by Git).

The full suite checks 15 page types at a 320px mobile viewport and all four saved
container widths on desktop. It holds requests open to inspect skeleton bounds,
releases them to check the loaded layout, and exercises dependency failures,
partial responses, cached navigation, and reduced motion. Review checks add an
inline comment, open the form after scrolling, verify keyboard focus and viewport
bounds, validate an empty request-changes review, then assert the mocked submission
contains both the summary and pending comment. A short viewport exercises popover
scrolling. GitHub Actions runs these checks on pull requests and retains screenshots.

Run `node scripts/test-workspace-shell.mjs` for workspace chrome and geometry.
It checks consistent 8px outer gutters, reclaimed vertical area, collapsed sidebar
width, desktop and drawer search/settings access, offline notices, and controls
fitting a 320px viewport. Set `SCREENSHOT_DIR` to an existing directory to capture
populated desktop, dark desktop, collapsed, narrow and drawer views. The script
can use a local production preview through `UI_BASE_URL` as well as its own Vite server.
