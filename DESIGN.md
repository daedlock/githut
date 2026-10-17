# Design System

The single source of truth for how GitHut looks and behaves. If `CLAUDE.md`,
a comment, or existing code disagrees with this file, this file wins. Fix
the other place.

Tokens live in `src/app/styles/tokens.css`. Palettes in
`src/app/styles/themes/*.css` override them, so components never use raw
colors and every theme works for free.

## Principles

1. **Surfaces, not borders.** Hierarchy comes from luminance steps between
   surfaces. Borders appear only where structure demands them (see below).
2. **Color means something.** Achromatic structure plus one brand color
   (under 10% of the surface) and status colors. Gray is structure; color is state.
3. **Dense but calm.** A tight type scale, generous rhythm, and no decoration.
4. **Nothing jumps.** Hover reveals never move content, skeletons match the
   final layout, and pending states keep their footprint.
5. **Feedback is instant.** Apply changes optimistically, confirm quietly,
   and make mistakes undoable.

## Color

### Surfaces

| Token | Class | Use |
|---|---|---|
| `--color-frame` | `bg-(--color-frame)` | Window frame behind the title bar and islands (see Islands). Nothing else. |
| `--color-bg` | `bg-background` | Island and page canvas. Rows at rest, in-page sidebars, cards. |
| `--color-bg-subtle` | `bg-muted` | Raised: toolbars, row hover, file and hunk headers, group headers (`/60`). |
| `--color-bg-sunken` | `bg-accent` | Active: selected rows, pressed or open controls. |
| `--color-popover` | `bg-popover` | Every overlay: popovers, menus, dialogs, floating bars, notices. |
| `--color-popover-active` | `bg-(--color-popover-active)` | The highlighted item inside an overlay. |
| `--color-code-bg` | `bg-(--color-code-bg)` | Code and diff areas. |

shadcn's `accent` is our **sunken surface**, not the brand color. The brand
color is shadcn's `primary`.

### Text

| Token | Class | Use |
|---|---|---|
| `--color-fg` | `text-foreground` | Primary text. |
| `--color-fg-muted` | `text-muted-foreground` | Meta text and secondary labels (AA for body). |
| `--color-fg-faint` | `text-(--color-fg-faint)` | Icons, glyphs and large text only (3.3:1). Never body copy. |

### Brand and status

| Token | Class | Use |
|---|---|---|
| `--color-brand` | `bg-primary`, `text-primary` | Primary button, checked controls, links, sub-tab indicator, the focused island's tab tint (see Islands), focus. |
| `--color-success` | `text-(--color-success)` | Open, additions, passing checks. |
| `--color-danger` | `text-destructive`, `bg-destructive` | Closed (PRs), deletions, failures, errors. |
| `--color-warning` | `text-(--color-warning)` | Pending, draft. |
| `--color-pr-merged` | `text-(--color-pr-merged)` | Merged. |

Status colors share one lightness and chroma, so they sit at matched
perceptual weight in every palette. Diff tints derive from them via
`color-mix`. **Never use `primary` as a surface fill** for rows, sections
or selection.

### Borders

Use them only for structure:

| Use | Class |
|---|---|
| Form controls | `border-input` (primitives already apply it) |
| Separators between unrelated regions (sticky page bars, diff file cards) | `border-border` |
| Code and diff containment | `border-border` |

Never use borders to separate list rows, wrap cards, underline toolbars, or
divide a sidebar from the content.

## Typography

Only these sizes exist. **Never use `text-xs`, `text-sm`, `text-base`,
`text-lg` or pixel values.**

| Class | Size / line-height | Use |
|---|---|---|
| `text-micro` | 11 / 1.2 | Badges, eyebrow labels (`uppercase tracking-widest`) |
| `text-caption` | 12 / 1.4 | Counts, timestamps, keyboard hints, toolbar controls |
| `text-ui` | 13 / 1.35 | Buttons, tabs, menu items, row meta |
| `text-code` | 13 / 20px fixed | Code, diffs, file names (the fixed height keeps the virtualized code view's row math intact) |
| `text-body` | 14 / 1.55 | Comments, paragraphs, row titles |
| `text-body-lg` | 16 / 1.5 | Rare lead copy |
| `text-title` | 18 / 1.35 | Section titles |
| `text-heading` | 24 / 1.25 | Page headings, issue and PR titles |
| `text-display` | 32 / 1.15 | Login and empty-state centerpieces |

- Tokens set size, line-height and tracking; **callers set weight.** Row
  titles use `font-[475]`, emphasis and labels use `font-medium`, and
  everything else stays regular. Avoid bold in chrome.
- `font-mono` is for identifiers and code: issue and PR numbers, SHAs,
  branches, paths, code. Labels and prose use sans.
- Use `tabular-nums` for counts that change in place.
- Keep prose under 72ch.

## Spacing

Base unit 4px. Prefer these steps:

| Step | Use |
|---|---|
| `1` (4px) | Icon gaps, between list rows |
| `2` (8px) | Inside components |
| `3` (12px) | Between related items, row content columns |
| `4` (16px) | Between groups, row side padding |
| `6` (24px) | Between sections, page padding |
| `8` (32px) | Page-level separation |

Use `gap-*` for stacks (`flex flex-col gap-*`), never `space-y-*`.

## Radius

The tokens override Tailwind's defaults; **`rounded-lg` is 6px here.**

| Class | Value | Use |
|---|---|---|
| `rounded-sm` | 3px | Kbd, tiny chips |
| `rounded-md` | 4px | Items inside overlays, small icon buttons, group headers |
| `rounded-lg` | 6px | Rows, toolbars, buttons, inputs, popovers, menus, code blocks |
| `rounded-island` | 10px | Islands only |
| `rounded-xl` | 12px | Dialogs, floating bars, notices |
| `rounded-full` | — | Avatars, label pills, status dots |

## Elevation and layering

In-flow surfaces never cast shadows: headers, toolbars, sidebars, rows,
cards. Islands are the one exception, with a fixed recipe (see Islands).
Overlays use their primitive's recipe and nothing else:

| Overlay | Recipe |
|---|---|
| Popover, menu, hover card | `bg-popover rounded-lg shadow-md ring-1 ring-foreground/10` (from the primitive) |
| Floating bar, notice | `bg-popover rounded-xl shadow-lg ring-1 ring-foreground/10` |
| Tooltip | The primitive (`bg-foreground text-background`) |

Use only this z-index scale:

| Layer | Use |
|---|---|
| `z-10` | Stretched row link (`after:` overlay) |
| `z-20` | Interactive controls inside a row (label pills, author links, checkboxes) |
| `z-30` | Sticky in-page bars (group headers, diff toolbar), fixed page affordances |
| `z-40` | Floating action bar |
| `z-50` | Radix overlays: popovers, menus, dialogs, tooltips |

## Interaction states

| State | Treatment |
|---|---|
| Rest | No background. |
| Hover | `hover:bg-muted` |
| Selected / active | `bg-accent` (hover keeps it) |
| Open (trigger with a popover) | `aria-expanded:bg-muted` (built into `Button`) |
| Disabled | `opacity-50`, no pointer events |
| Pending | A spinner in place of the control, so the footprint doesn't change |

**Focus.** Never remove focus without a replacement.
- Primitives (`Button`, `Input`, `Checkbox`) own their focus ring. Don't override it.
- Custom controls: `outline-none focus-visible:ring-1 focus-visible:ring-foreground/15`.
- Whole-row links put the ring on the stretched overlay:
  `focus-visible:after:ring-1 focus-visible:after:ring-foreground/20`.

## Layout

### Chrome
- Pages have no navigation bar of their own. Global chrome is the title
  bar (`h-11`) and each island's header (`h-10`); see Islands. Rows inside
  chrome are `h-* flex items-center`. **Never use `py-*` on a chrome bar.**
- Each tab scrolls in its own pane. Sticky page bars stick at
  `top-(--app-header-height)`, which is `0px` inside a pane; keep using the
  variable so offsets stay correct if chrome ever returns above a page.
- Full-height regions size against the pane, never the viewport:
  `var(--pane-height, 100dvh)`, not `100dvh` or `min-h-screen`.

### Containers
Wrap every page in `<Container>`. It owns horizontal padding
(`px-4 sm:px-6`) and the user's width preference: Small 896, **Medium 1280
(default)**, Large 1536, Full. Never hand-roll `max-w-*` on a page.

### List page (issues, PRs)
```
Container
  ├── Toolbar (bg-muted, rounded-lg, p-2)
  │   ├── State tabs (Open / Closed with counts)
  │   └── Search · Filter · Display · primary action
  ├── Filter pills (only when filters are active)
  └── List (gap-1)
      ├── Group header (sticky, when grouped)
      ├── Row … Row
      └── Load more
```

### Detail page (issue, PR)
```
Container
  ├── Header (title, state, meta, actions)
  ├── Sub-tabs (Conversation / Commits / Checks / Review)
  └── Main (comments, timeline, merge box) + Sidebar (reviewers, assignees, labels)
```

### Review page
```
Full viewport, no Container
  ├── Sticky bar (back, PR context, Unified/Split, Submit)
  ├── File tree (same surface as the page)
  └── Diff cards (gap-3)
```

## Islands

The workspace is a darker **frame** holding a slim **title bar** and rounded
**islands**. Every page renders inside an island. Vocabulary is in
`GLOSSARY.md`; the shell lives in `components/shell/TabHost.tsx`.

### Frame
- `--color-frame` is derived from the theme's `--color-bg`: mixed 9% toward
  `--color-fg` in light themes (deeper), 30% toward black in dark themes.
  A palette that needs a different frame sets `--color-frame` in its
  `themes/*.css` block. Never hardcode a frame colour in a component.
- The frame pads the window `max(1rem, safe-area)` at the sides and `8px`
  below the islands. Gaps between islands are `8px`.

### Island
- `bg-background rounded-island overflow-hidden`, with
  `shadow-(--island-shadow)` at rest and `shadow-(--island-shadow-focus)`
  for the focused island. The recipe is a 1px hairline edge plus
  `--island-elev`: a barely-there drop in light themes, a 1px top
  highlight in dark themes. Don't add others.
- Edges are Linear-style: a translucent tint of the text colour, never a
  border colour. Idle `--color-island-edge` (fg 7%), focused
  `--color-island-edge-focus` (fg 11%). No brand on the edge; the
  focused island's selected tab carries the brand tint.
- An island is a `@container`, so its header adapts to the island's
  width, not the window's.
- Islands are labelled regions (`<section aria-label>` naming the
  selected tab's page and repo). A press or keyboard focus anywhere in an
  island focuses it.

### Layout and gaps
- The layout is a tree of islands and row/column splits
  (`src/app/workspace/model.ts`). Islands render as flat, absolutely
  positioned siblings (`IslandLayout`), so splitting or resizing never
  remounts a page.
- Minimum island size is **320×200**. Resizing never goes past it.
- A gap is a focusable `role="separator"` with `aria-orientation`. At rest
  it is just frame; on hover (after 150ms), focus or drag a 2px
  `bg-primary` line appears, inset 12px from its ends. Cursor
  `col-resize` / `row-resize`.
- Gaps resize by drag, or with arrow keys while focused (16px, Shift
  64px, Home/End to the limits). Double-clicking a gap equalizes its
  split.
- Double-clicking an island header (outside buttons, links and sections)
  maximizes the island over the others; again restores the exact
  previous sizes. Nothing animates.

### Title bar
- `h-11` grid on the frame: logo, focused context, search (max 420px,
  centred), then the avatar menu. No background, border or shadow.
- Context names the **focused tab**: repo mark, `owner/repo` in mono
  (owner muted), then the branch (`text-caption`, mono): the URL's branch,
  else the repo's default. App-wide pages show their icon and label.
- Search is `h-7 rounded-lg bg-muted` with the island edge, "Search or
  jump to…" and `<Kbd>`; it shrinks to an icon below `md`.

### Island header
- `h-10 flex items-center gap-1 pl-1 pr-1.5`: the tab row takes the
  remaining width, then the section menu, then the island menu
  (`Button ghost icon-sm`, `Columns2`: Split right, Split down,
  Maximize/Restore).
- **Tabs:** `h-7 rounded-lg pl-2 pr-1 gap-1.5 text-ui`, 64–220px wide.
  Order: repo mark (`sm`) → state icon (16px box, `size-3.5`, coloured by
  open / merged / closed / draft) → mono `#number` in `--color-fg-faint` →
  title (truncates) → close `×` (shown on hover and on the selected tab).
  A tab whose page has an unsent draft shows a 6px `--color-warning` draft
  dot in the close slot instead; `×` replaces it on hover. Closing never
  prompts: the draft stays with the page.
- Tab states: rest has no fill; hover `bg-sunken` at 60%; selected
  `bg-muted` with a 1px `--color-border` ring; selected in the focused
  island takes a brand tint instead (9% brand over `bg-muted`, ring 45%
  brand into border). This is the one place brand tints a selection.
- Tabs activate on pointer-down. Nothing animates on switch.
- Pinned tabs lead the row and show only their repo mark and state icon,
  with the title in the tooltip. They keep their draft dot and survive
  bulk close actions. Pin and unpin are in the tab menu and command palette.
- The tab row scrolls horizontally and keeps the selected tab visible.
  A chevron menu lists every tab, including pins, for keyboard navigation.
- **Sections** (Code, Commits, PRs, Issues, Actions) act on the island's
  selected tab's repo; their labels and tooltips name it ("githut · PRs").
  Icons at rest, labels slide out while the group is hovered, and the
  current section keeps its label. Below 620px of island width labels
  go; below 480px the group folds into one "⋯" menu. Pages without a
  repo show no sections.

### Repo marks
- `RepoMark` (`components/shell/RepoMark.tsx`): a 16px (`sm` 14px)
  rounded square with the repo's initial, two letters when two repos in
  view share one.
- Colour hashes the repo's full name onto a curated hue set that skips
  the status hues. Every hue shares `--repo-l` / `--repo-c`, so no repo
  is louder than another. Fill is the colour at 20% over `bg-muted`, ring
  35%. With `<html data-repo-color="off">` marks go neutral.

## Components

Use the shadcn primitives in `src/app/components/ui/` for every popover,
menu, dialog, command palette, tooltip, checkbox and input. Never wrap Radix
yourself.

### Rows
- Flat on the page: no background at rest, `hover:bg-muted`, `rounded-lg`,
  no dividers, `gap-1` between rows.
- The whole row is a link: the title link stretches over the row
  (`after:absolute after:inset-0 after:z-10`). Secondary links and controls
  sit above it at `relative z-20`.
- Anatomy: `px-4 py-2.5`, a 16px state icon (`mt-0.5`), a `text-body
  font-[475]` title with label pills inline, then a meta line in `text-ui
  text-muted-foreground` with `#number` in mono.
- Selectable rows reserve a checkbox gutter (`pl-10`). See Selection.

### Toolbars
`bg-muted rounded-lg p-2`. Controls are `h-7` (`Button size="sm"`, inputs
`h-7 text-ui`): state tabs on the left, search, filter and display on the
right. Toolbars recede; they never dominate.

### Group headers
Sticky at `top-(--app-header-height)` with `z-30 bg-background`. The header
button is `min-h-10 rounded-md bg-muted/60 px-3 text-ui font-medium`:
chevron, icon, label, then the count in `text-caption tabular-nums
text-muted-foreground`.

### Selection (multi-select)
Reference: `features/repo/components/BulkSelection.tsx` and `BulkActionBar.tsx`.
- **Checkbox:** `ui/checkbox` (supports `"indeterminate"`), at `left-3 top-3`
  in the row's reserved gutter. Hidden until the row is hovered or focused;
  shown on every row once anything is selected; always shown on touch.
- **Selected row:** `bg-accent`. Adjacent selected rows merge into one block
  (shared corners squared, the gap filled). No ring, border, or brand tint.
- **Behavior:** in selection mode a row click toggles the row. Modifier-clicks
  keep native link behavior. Rows that leave the view leave the selection.
- **Keys:** `x` toggles, `Shift-x` / Shift-click extend a range, `⌘A` selects
  all, `Esc` clears.

### Floating action bar
- Centered at the bottom (`fixed bottom-6`), `h-11 p-1.5`, overlay recipe
  above. Contents: master checkbox and count, a vertical `Separator`, ghost
  `size="sm"` actions (icon-only below `sm`), another `Separator`, then clear
  (`size="icon-sm"`).
- Results appear in a notice stacked above the bar (`h-10`, same surface)
  with **Undo** or **Retry**. Successes auto-dismiss after 6s; errors stay
  until dismissed.
- On narrow screens it owns the bottom of the viewport, and page scroll
  controls hide.

### Pickers
Label, assignee, reviewer and status pickers use `SidebarPicker`. It's the
same component in detail sidebars and the bulk bar: ✓ when every target has
the value, – when only some do (`mixedIds`), and `closeOnSelect` for
single-choice pickers. List filters use `ui/filter-bar`.

### Buttons
`Button` variants: `default` (brand, at most one primary action per view),
`ghost` (toolbars, bars, icon actions), `outline`, `secondary`,
`destructive` (soft tint), `link`. Sizes: `xs` h-6, `sm` h-7, `default`
h-8, `lg` h-9, plus `icon-*` squares. Icons take
`data-icon="inline-start|inline-end"` and no manual size. Don't invent
variants.

### Tooltips and shortcuts
Every icon-only control gets a tooltip. Put shortcuts in the tooltip as
`<Kbd>`, set `aria-keyshortcuts`, register them with `useKeybindings`, and
list them in `KeyboardHelp.tsx`. `Esc` belongs to the innermost layer
(input, picker) before any page-level action.

### Active surfaces
A card that communicates state (ready, conflict, merged) tints from one
status variable. Reference: `PrMergeBox.tsx`.

| Layer | Formula |
|---|---|
| Border | `color-mix(in oklab, var(--status) 40%, var(--color-border))` |
| Background | `color-mix(in oklab, var(--status) 6%, var(--color-bg))` |
| CTA border | `color-mix(in oklab, var(--status) 50%, var(--color-border))` |
| CTA background / hover | `12%` / `20%` into `var(--color-bg-subtle)`, text `text-foreground` |

Mix into theme tokens, never into `transparent`, so tints keep the
palette's warmth. No glow.

### Diffs
- Review files are separated by `gap-3`. The file header is `bg-muted` and
  sticky below the toolbar; hunk headers use the same surface. Single-hunk
  files skip the hunk header.
- Media files render a Before/After pane pair (a single pane when added or
  removed) on a palette-derived checkerboard. Other binaries get a one-line
  notice and an "Open on GitHub" link. Never show "No changes" for a 0/0
  file without a patch.

### Changed-file tree
File rows always show `+N −N`. Folder rows carry their descendants' rollup:
always shown when collapsed, shown on hover or focus when expanded, and
always shown on touch.

### Loading and empty states
- Skeletons (`SkeletonGroup` + `Skeleton`, `skeleton-fade`) mirror the final
  geometry exactly: same padding, gutters and icon positions.
- Empty states: a centered `size-5` icon in `--color-fg-faint` above one
  `text-body text-muted-foreground` line.

## Motion

- Micro-interactions take 120–160ms on `cubic-bezier(0.16, 1, 0.3, 1)`;
  hovers use `transition-colors`.
- Radix primitives animate through `tw-animate-css` `data-[state]` classes.
  Never add keyframes.
- App-owned enter and exit (floating bars, notices, sidebar lists) uses
  framer-motion `AnimatePresence`: opacity plus at most 8px of translation.
  Under `useReducedMotion`, drop translation and scale; for CSS transitions
  use `motion-reduce:`.
- No scroll-linked motion.

## Anti-patterns

- Card wrappers or borders around list rows.
- `primary` as a fill for rows, selections or sections.
- Shadows on in-flow surfaces.
- An in-page sidebar on a different surface from the page. (The workspace
  sidebar is chrome and sits on the frame.)
- Navigation bars inside pages. Repo identity and sections belong to the
  island header; search and account to the title bar.
- `text-xs` / `text-sm`, arbitrary pixel sizes, or z-index values off the scale.
- Hover reveals that shift layout, or skeletons that don't match the loaded rows.
- Hand-rolled popovers, menus, checkboxes or tooltips.
- Decorative color. Color is state.
