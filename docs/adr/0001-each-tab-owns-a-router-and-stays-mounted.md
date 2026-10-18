# Each tab owns a router and stays mounted

Every tab runs its own TanStack router over an in-memory history, and recently used tabs stay mounted inside React's `<Activity>` while hidden. Switching tabs is a visibility flip: no route load, no remount, and scroll, expanded sections and drafts survive. We chose this over a single router that re-navigates on every switch, which made switching visibly slow and lost page state.

## Consequences

- App-wide overlays (command palette, keyboard help, file history, scroll controls) render once outside the tabs, bound to the focused tab's router. Route components must not assume they are the only instance of the app.
- Each tab scrolls inside its own container, not the window. Code that reads or sets `window.scrollY` will not work; use the tab's scroll container.
- Hidden tabs pause their effects (polling, listeners), so anything that must stay live in the background needs its own app-level watcher.
- A memory budget releases the least recently used tabs; they rebuild from their URL when shown again.
