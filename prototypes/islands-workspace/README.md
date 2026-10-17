# Islands workspace prototype

Throwaway, single-file prototype that settled the look and behaviour of the islands workspace (spec #24) and the breadcrumbs (#46). Kept as a primary source; the real implementation lives on `main`.

Open `index.html` in a browser. It uses sample data and needs no build.

What it answers:
- Islands on a frame: Linear-style edges and contrast, 8px gaps
- Docking: drag tabs/islands to split, merge, dock at window edges; resize; maximize
- Navigation rules: links navigate in place, ⇧ new tab, ⌥ to the side; launchers open-or-jump
- Sidebar on the frame surface; logo toggles it
- Breadcrumbs with sibling pickers, branch chip, Open on GitHub
- Loading states mirroring the app's `Skeleton` primitive, error pattern with Retry (use the Network switch: Fast / Slow / Offline)

Where the prototype and the spec/tickets differ, the spec and tickets win.
