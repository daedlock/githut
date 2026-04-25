# Design System

## Core Principle

**Surfaces, not borders.** Hierarchy comes from luminance stepping between
background surfaces. Borders are used only where structurally necessary:
form inputs, hard separators between unrelated sections, focus rings.
Everything else separates through spacing and surface contrast.

This is the Linear approach: the interface is built from layers of
luminance, not from boxes drawn with lines.

## Surfaces

Three levels. Each is a subtle luminance step from the previous.
In dark mode, higher = lighter. In light mode, higher = slightly tinted.

| Token | Role | Example |
|---|---|---|
| `--color-bg` / `bg-background` | Page canvas | The base everything sits on |
| `--color-bg-subtle` / `bg-muted` | Raised surface | Toolbars, file headers, card-like areas, hover states |
| `--color-bg-sunken` / `bg-accent` | Inset / active | Active controls, pressed states, selected items |

**Rules:**
- Sidebars use the SAME surface as the page. Not a different color. Separation via spacing or a single hairline if absolutely needed.
- Toolbars sit on `bg-muted` to float above the list content.
- Hover states shift to `bg-muted`. No background change on the default state.
- Rows in lists have NO background on default. Hover reveals the surface.
- Cards are just content on the page surface with spacing around them. No border, no shadow, no card wrapper unless the content truly needs containment (e.g. a form, a code block).

## When Borders ARE Used

Borders are not banned. They serve specific structural roles:

| Use case | Token | Why |
|---|---|---|
| Form inputs | `border-input` / `--color-border-strong` | Inputs need a visible boundary to indicate "type here" |
| Hard section separators | `border-border` / `--color-border` | Between truly unrelated content (nav bar bottom, diff file separators) |
| Focus rings | `ring-[--color-focus]` | Keyboard accessibility requires visible focus |
| Code blocks / diff area | `border-border` | Code needs containment to distinguish from prose |

**Never use borders for:**
- Separating list rows (use spacing or hover surface)
- Card wrappers (use spacing and surface stepping)
- Toolbar bottoms (toolbar bg-muted already separates visually)
- Between sidebar and content (spacing is enough; or one hairline max)

## Color Strategy

**Restrained.** Achromatic surfaces + one accent (< 10% surface area).
Color only for meaning: status, diff tints, accent actions.

| Token | Role |
|---|---|
| `--color-accent` | Primary buttons, links, focus, active tab indicator |
| `--color-success` | Open PRs, additions, passing checks |
| `--color-danger` | Closed, deletions, failing checks |
| `--color-warning` | Pending, draft |
| `--color-pr-merged` | Merged PRs (purple) |

All status colors at matched perceptual lightness per palette.
Diff tints derived via `color-mix(status N%, surface-0)`.

## Active Surfaces

When a card or region needs to communicate **state** (ready, error, merged,
pending), it becomes an "active surface" — a tinted container whose border,
background, and glow all derive from a single semantic color variable via
`color-mix`. This keeps every palette consistent: the tint blends into the
theme rather than painting over it.

Pick the semantic color variable for the state:

| State | Variable |
|---|---|
| Ready / success | `--color-success` |
| Error / conflict | `--color-danger` |
| Pending / draft | `--color-warning` |
| Merged | `--color-pr-merged` |
| Neutral / disabled | `--color-fg-faint` |

Then apply the three layers — all use `color-mix(in oklab, var(--var) N%, base)`:

| Layer | Formula | Base token | Purpose |
|---|---|---|---|
| **Border** | `40%` into `--color-border` | `var(--color-border)` | Visible tinted edge that reads as "this region has meaning" |
| **Background** | `8%` into `--color-bg-subtle` | `var(--color-bg-subtle)` | Subtle fill — just enough to tint the surface |
| **Glow** | `12%` into `transparent` | `transparent` | Outer `box-shadow 0 0 20px` — soft ambient halo |
| **Hover** (buttons) | `20%` into `--color-bg-subtle` | `var(--color-bg-subtle)` | Stronger tint on interactive hover |

### Active Surface Button (CTA inside an active card)

For the primary action inside an active surface (e.g. "Merge"), use
stronger mix ratios so the button stands out from the tinted card:

```
border:     color-mix(in oklab, var(--color) 50%, var(--color-border))
background: color-mix(in oklab, var(--color) 12%, var(--color-bg-subtle))
hover:      color-mix(in oklab, var(--color) 20%, var(--color-bg-subtle))
text:       text-foreground (inherits from theme)
```

### Why `color-mix` with theme tokens, not `transparent`

Mixing into `transparent` produces washed-out tints on warm palettes
(ember, dune) because the accent hue floats over nothing. Mixing into
`--color-border` or `--color-bg-subtle` anchors the tint to the palette's
warmth, so green reads as green even on a brown surface.

### Example (inline style)

```tsx
<div
  className="rounded-lg border"
  style={{
    borderColor: `color-mix(in oklab, var(--color-success) 40%, var(--color-border))`,
    backgroundColor: `color-mix(in oklab, var(--color-success) 8%, var(--color-bg-subtle))`,
    boxShadow: `0 0 20px color-mix(in oklab, var(--color-success) 12%, transparent)`,
  }}
>
```

## Typography

| Token | Size | Weight | Use |
|---|---|---|---|
| `text-micro` | 11px | 500 | Badges, eyebrow labels |
| `text-caption` | 12px | 450 | Timestamps, toolbar controls, counts |
| `text-ui` | 13px | 475 | Buttons, tabs, row meta |
| `text-code` | 13px | 400 | Monospace: diffs, code, file names |
| `text-body` | 14px | 400 | Comments, paragraphs, PR titles in lists |
| `text-title` | 18px | 550 | Section headers |
| `text-heading` | 24px | 550 | Page headings, PR detail title |

**Rules:**
- Titles use `font-[475]` (between regular and medium, Linear's trick)
- Tracking tightens above 16px (negative letter-spacing)
- Monospace only for code content. Never for UI labels.
- Body line length max 72ch.
- Weight contrast between hierarchy levels >= 50 units.

## Spacing

Base unit: 4px.

| Token | Value | Use |
|---|---|---|
| `--space-1` | 4px | Icon gaps, tight inline |
| `--space-2` | 8px | Within components |
| `--space-3` | 12px | Between related items |
| `--space-4` | 16px | Between groups |
| `--space-6` | 24px | Between sections |
| `--space-8` | 32px | Page-level separation |

No 20px. The gap keeps rhythm syncopated.

## Radius

| Context | Value | Why |
|---|---|---|
| Hover/interactive rows | `rounded-lg` (8px) | Soft, approachable hover surface |
| Toolbar surfaces | `rounded-lg` (8px) | Matches hover rows |
| Inputs, buttons | `rounded-md` (6px) | Slightly tighter, functional |
| Code blocks, diff cards | `rounded-lg` (8px) | Consistent with other cards |
| Avatars, pills | `rounded-full` | Circular |

Surfaces get generous radius. Code gets sharp radius. The contrast
between the two creates visual distinction between "UI" and "content".

## Depth

**No shadows in dark mode.** Hierarchy via surface luminance only.
In light mode, optional subtle shadow for truly floating elements
(dropdowns, popovers): `0 1px 3px oklch(0 0 0 / 0.08)`.

| Level | Treatment |
|---|---|
| Page | `bg-background` (base) |
| Raised | `bg-muted` (toolbar, hover, file headers) |
| Active | `bg-accent` (selected, pressed) |
| Focus | `2px ring var(--color-focus)` |

## Layout Patterns

### List Page (PRs, Issues)
```
Container (narrow, centered)
  ├── Toolbar surface (bg-muted, rounded-lg, compact)
  │   ├── State tabs (Open/Closed with counts)
  │   └── Search + Sort
  └── Rows (no wrapper, no borders)
      ├── Row (flat on bg, hover → bg-muted, rounded-lg)
      ├── Row
      └── Load more
```

### Detail Page (PR, Issue)
```
Container (wide, 1280px)
  ├── Header (title, state, meta, actions)
  ├── Sub-tabs (Conversation / Commits / Checks / Review)
  └── Two-column layout
      ├── Main (comments, timeline, merge box)
      └── Sidebar (reviewers, assignees, labels)
```

### Review Page (full-width)
```
Full viewport, no Container
  ├── Sticky bar (back + PR context + Unified/Split + Submit)
  ├── File tree sidebar (same bg as page)
  └── Diff content (file cards with spacing between)
```

## Component Patterns

### Rows
- No default background. Transparent on page surface.
- Hover: `bg-muted rounded-lg` transition.
- No divider between rows. Spacing (gap or padding) separates.
- Entire row is a link (prefetch on hover via router).

### Toolbars
- `bg-muted rounded-lg` with compact padding.
- Contains controls (tabs, search, sort) at `text-caption` size.
- Sits above the list with a small gap (mb-2).

### File Diff Cards
- In the review view, files are separated by `gap-3`.
- File header: `bg-muted` surface, sticky below the top bar.
- Code area: slightly darker than surface-0 via `color-mix`.
- Hunk headers: `bg-muted` (same as file header surface).
- Single-hunk files skip the hunk header entirely.

### Buttons
- Default (accent): `bg-primary text-primary-foreground`
- Ghost: transparent, `hover:bg-muted`
- Outline: `border-input bg-background` (one of the few bordered elements)
- All sizes same weight/color. Only height + padding scale.

### Navigation
- Single 40px row, full-width.
- Section tabs inline with repo identity.
- No bottom border needed if the content below starts with a different surface.

## Palette System

Themes define all tokens. Components never use raw values.
See `theme-presets.css` for palette definitions.

Each palette provides: surfaces (3), text (4), borders (2),
accent (3), status (4), syntax (8+), icons, charts.

Diff tokens auto-derive from status + surface via `color-mix`.

## Animation

- Micro-interactions: 120ms `cubic-bezier(0.16, 1, 0.3, 1)`
- Hover transitions: `transition-colors` (Tailwind default, ~150ms)
- No motion on scroll.
- Respect `prefers-reduced-motion`.

## Anti-patterns

- **Card wrapper on list items.** Lists are flat rows, not cards.
- **Border between every row.** Use spacing.
- **Different sidebar background.** Same as page.
- **Shadows in dark mode.** Invisible and wasteful.
- **Decorative color.** Color = meaning. Gray = structure.
- **Heavy toolbar chrome.** Toolbar should recede, not dominate.
- **Nested containers.** Content flows on the page surface.
