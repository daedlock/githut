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
6. **A desktop tool, not a web page.** Everything is reachable from the
   keyboard, controls behave like native controls, and nothing wobbles,
   glows or bounces for decoration.

## Color

### Surfaces

| Token | Class | Use |
|---|---|---|
| `--color-bg` | `bg-background` | Page canvas. Rows at rest, detail sidebars. |
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
| `--color-brand` | `bg-primary`, `text-primary` | Primary button, checked controls, links, active tab indicator, focus. |
| `--color-success` | `text-(--color-success)` | Open, additions, passing checks. |
| `--color-danger` | `text-destructive`, `bg-destructive` | Closed (PRs), deletions, failures, errors. |
| `--color-warning` | `text-(--color-warning)` | Pending, draft. |
| `--color-pr-merged` | `text-(--color-pr-merged)` | Merged. |

State colors by entity. Purple means finished:
- open (issue or PR) = success
- merged PR and completed issue = purple (`--color-pr-merged`; issue pills
  use `--color-issue-closed-*`)
- closed PR = danger
- issue closed as not planned = neutral (`--color-fg-faint` icon, `bg-accent` pill)
- draft PR = neutral (`text-muted-foreground`), not warning

Issue state visuals come from `features/issues/issueState.tsx` (`ISSUE_STATE`,
`IssueStateIcon`); never restyle them locally.

Status colors share one lightness and chroma, so they sit at matched
perceptual weight in every palette. Diff tints derive from them via
`color-mix`. **Never use `primary` as a surface fill** for rows, sections
or selection.

### Borders

Use them only for structure:

| Use | Class |
|---|---|
| Form controls | `border-input` (primitives already apply it) |
| Separators between unrelated regions (app header bottom, the bottom of a sticky bar content scrolls under, diff file cards) | `border-border` |
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
  and page titles use `font-[475]`, emphasis and labels use `font-medium`,
  and everything else stays regular. Never change weight to show state (it
  shifts layout); use a surface instead. Avoid bold in chrome.
- `font-mono` is for identifiers and code: issue and PR numbers, SHAs,
  branches, paths, code. Labels, prose, logins, counts, times, durations
  and diff stats are sans.
- Use `tabular-nums` for every number: counts, times, durations, diff stats.
- **Eyebrow labels** (section labels in caps): `text-micro font-medium
  uppercase tracking-widest text-muted-foreground`, sans, no rule beside them.
- `--color-fg-faint` is for icons and glyphs only, never for text.
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
| `rounded-xl` | 12px | Dialogs, floating bars, notices |
| `rounded-full` | — | Avatars, label pills, status dots |

## Elevation and layering

In-flow surfaces never cast shadows: headers, toolbars, sidebars, rows,
cards. Overlays use their primitive's recipe and nothing else:

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
| `z-40` | Sticky app header, floating action bar |
| `z-50` | Radix overlays: popovers, menus, dialogs, tooltips |

## Interaction states

| State | Treatment |
|---|---|
| Rest | No background. |
| Hover | `hover:bg-muted` |
| Selected / active / pressed | `bg-accent` (hover keeps it) |
| Open (trigger with a popover) | `aria-expanded:bg-muted` (built into `Button`) |
| Disabled | `opacity-50`, no pointer events |
| Pending | A spinner in place of the control, so the footprint doesn't change |

**Raised surfaces.** On a `bg-muted` surface (toolbars, panels, comment
blocks) `hover:bg-muted` is invisible. Mark the surface `data-surface="raised"`
(`ListToolbar` and `Card variant="muted"` do it for you): ghost buttons and
toggles inside then hover to `bg-accent/60`, and selected or open stays
`bg-accent`. Custom controls on raised surfaces use the same pair.

**Focus.** Never remove focus without a replacement.
- Primitives (`Button`, `Input`, `Checkbox`) own their focus ring. Don't override it.
- Custom controls: `outline-none focus-visible:ring-1 focus-visible:ring-foreground/15`.
- Whole-row links put the ring on the stretched overlay:
  `focus-visible:after:ring-1 focus-visible:after:ring-foreground/20`.

## Layout

### Chrome
- The app header is sticky; its height is `--app-header-height` (40px, or
  80px where repo navigation wraps on narrow screens). Rows inside chrome
  are `h-10 flex items-center`. **Never use `py-*` on a chrome bar.**
- Secondary sticky bars stick at `top-(--app-header-height)`.

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
Container (the user's width preference applies here too)
  ├── Sticky bar (back, PR context, Unified/Split, Submit)
  ├── File tree (same surface as the page)
  └── Diff cards (gap-3)
```

### Detail page header (issue, PR, run, commit)
```
BackLink ("← Issues"; Esc follows it)
Title       text-heading font-[475]
Meta line   state pill · #number (mono) · author (ProfileLink) · time,
            text-caption text-muted-foreground, mt-2
```
Actions (Close, ⋯) sit at the right of the title row. Sub-tabs, when a page
has them, are a sticky `h-10` bar with the brand underline for the current
tab, like the repo navigation.

## Components

Use the shadcn primitives in `src/app/components/ui/` for every popover,
menu, dialog, command palette, tooltip, checkbox and input. Never wrap Radix
yourself.

### Shared building blocks

Reach for these before writing markup. They live in `src/app/components/`.

| Component | Use |
|---|---|
| `ListToolbar`, `ListToolbarTitle` | The bar every list page starts with |
| `ViewTab` | Open/Closed-style view switches in a toolbar |
| `SearchField` | Every search box; `/` focuses the page's search |
| `StaticListGroupHeader` | Group headers that don't collapse (`GroupedList` has the collapsible one) |
| `EmptyState` | Every empty and error state |
| `LoadMoreButton` | The row at the end of a paginated list |
| `NavLabel`, `NavItem`, `NavCount` | Left-hand view lists (dashboard, workflows, jobs) |
| `BackLink` | The back link above a detail page title |
| `PropertySection`, `PropertyEmpty` | Groups in a detail sidebar |

Primitives in `ui/` cover the rest: `Select` (never a native `<select>`),
`Switch`, `RadioGroup`, `Checkbox`, `ToggleGroup` (segmented controls),
`Tooltip`, `Popover`, `DropdownMenu`, `Command`, `Dialog`.

### Panels, sections and documents
- **Section** (default): content flat on the page with a small header. Detail
  sidebars are sections (`PropertySection`), stacked `gap-6`.
- **Panel**: when a busy page needs grouping (profile tiles, run summary,
  workflow graph, comment blocks): `Card variant="muted"` = `rounded-lg
  bg-muted`, no border, no shadow.
- **Document**: rendered markdown and code need containment: `rounded-lg
  border border-border`, header `h-10 px-4`.

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

### Segmented controls
`ToggleGroup type="single" size="sm"`: items are `h-7`, the selected item
takes `bg-accent`. In a toolbar use it bare; on the page surface wrap it in
`rounded-lg bg-muted p-0.5`. Inside an overlay the selected item uses
`--color-popover-active`. Never hand-roll one.

### Side navigation
`NavLabel` eyebrows over `NavItem`s: `h-7 rounded-lg px-2 text-ui`, hover
`bg-muted`, current `bg-accent` via `aria-current="page"`. Counts sit at the
end with `NavCount`.

### Comment blocks
One `Card variant="muted"` per comment: header `flex h-10 items-center
gap-2 px-4` (author `ProfileLink`, verb and time muted), body `px-4 pb-4`.
No header divider, no border. Reactions are `rounded-full` chips; the
viewer's own reaction uses `bg-accent`, never the brand color.

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
Every icon-only control gets a `Tooltip` (never `title=` alone). Put
shortcuts in the tooltip as `<Kbd>`, set `aria-keyshortcuts`, register them
with `useKeybindings`, and list them in `KeyboardHelp.tsx`. `Esc` belongs to
the innermost layer (input, picker, dialog) before any page-level action.

### Durations and stats
Durations are `text-caption tabular-nums text-muted-foreground`, never
status-colored (the status icon carries state). Diff stats keep their
success/danger colors but are sans `tabular-nums`.

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

## Desktop feel

- Controls use the arrow cursor, like a native app; only inline text links
  get the hand. `base.css` sets this, so don't add `cursor-pointer`.
- Chrome isn't selectable text (buttons, tabs, menu items, kbd). Content is.
- No rubber-band overscroll; selection uses a brand tint.
- Pending actions keep their label and swap the icon for a spinner.

## Keyboard

The app is fully usable from the keyboard. `?` lists everything.

| Keys | Where | Action |
|---|---|---|
| `⌘K` | Everywhere | Command palette |
| `g h` / `g i` / `g p` / `g c` / `g a` | Everywhere | Go to home / issues / PRs / code / actions |
| `/` | Pages with a search | Focus the page's search; `Esc` clears, then leaves |
| `Esc` | Detail pages | Back to the list |
| `Ctrl N` / `Ctrl P` (also `Ctrl J` / `Ctrl K`) | Menus, pickers, palette | Next / previous item |
| `j` / `k`, `Enter` | Lists | Move, open |
| `x`, `⇧x`, `⌘A`, `Esc` | Lists | Select, extend, select all, clear |
| `s` / `l` / `a` | Lists with a selection | Status / labels / assignees for the selection |
| `l` / `a` | Issue and PR detail | Labels / assignees picker |
| `⇧V`, `t` | Lists | Display options, toggle the hovered group |
| `⌘Enter` | Composers | Submit |

New shortcuts follow these rules: single letters only where no input has
focus (`useKeybindings` enforces it), the mnemonic is the action's first
letter, and every shortcut shows in its control's tooltip and in `?`.

Chrome on Windows and Linux reserves `Ctrl N`, so pages can't receive it
there; `Ctrl J` always works.

## Motion

- Micro-interactions take 120–160ms on `cubic-bezier(0.16, 1, 0.3, 1)`;
  hovers use `transition-colors`.
- Radix primitives animate through `tw-animate-css` `data-[state]` classes.
  Never add keyframes.
- App-owned enter and exit (floating bars, notices, sidebar lists) uses
  framer-motion `AnimatePresence`: opacity plus at most 8px of translation.
  Under `useReducedMotion`, drop translation and scale; for CSS transitions
  use `motion-reduce:`.
- No scroll-linked motion, no infinite pulses on content, no glow. One
  sanctioned delight: the star button's pop.

## Anti-patterns

- Card wrappers or borders around list rows.
- `primary` as a fill for rows, selections or sections.
- Shadows on in-flow surfaces.
- A sidebar on a different surface from the page.
- `text-xs` / `text-sm`, arbitrary pixel sizes, or z-index values off the scale.
- Hover reveals that shift layout, or skeletons that don't match the loaded rows.
- Hand-rolled popovers, menus, checkboxes, selects, switches, segmented
  controls or tooltips.
- `title=` as the only tooltip; weight changes to show state.
- Decorative color. Color is state.
