# GitHut Design Language

> Inspired by Zed and Linear. A professional developer tool — dense, precise, fast.
> Every pixel must justify its existence.

---

## Philosophy

GitHut is used by developers all day. The UI is **infrastructure**, not decoration. Users should feel the app is *fast* and *respects their attention*, not that someone spent time making it pretty.

**Three tests before writing any className:**
1. Does this increase visual weight without adding information? Remove it.
2. Is there a smaller / tighter way to achieve the same goal? Use it.
3. Does this use a non-semantic value (raw hex, raw px, `text-sm`)? Replace it with a token.

**The Zed principle:** Chrome should be nearly invisible. The header, sidebar, and toolbars exist to orient and navigate — they should never compete with the content they frame.

**The Linear principle:** Information density is a feature. Fitting more meaningful data in the same space makes the app feel powerful. Whitespace is not virtue; appropriate whitespace is.

---

## Spatial System

### Base unit: 4px

All spacing uses the 4px grid. Tailwind's default scale maps directly: `gap-1` = 4px, `gap-2` = 8px, `gap-3` = 12px, `gap-4` = 16px.

| Use | Class | Value |
|-----|-------|-------|
| Icon ↔ label (tightly coupled) | `gap-1.5` | 6px |
| Items within a group | `gap-2` | 8px |
| Groups within a section | `gap-3` | 12px |
| Sections within a panel | `gap-4` | 16px |
| Content areas (prose, issue body) | `gap-5` / `gap-6` | 20–24px |

`gap-5` and above belong **only** in content areas (comment threads, README prose, forms). Never in chrome (toolbars, sidebars, tab bars, list rows).

### Chrome height budget — never exceed these

| Surface | Height | Class |
|---------|--------|-------|
| Main top bar (entire row incl. tabs when inline) | 36px | `h-9` |
| Tab strip (standalone, below top bar) | 32px | `h-8` |
| Tab pill (within either strip) | 28px | `h-7` |
| Sidebar / nav row | 28px | `h-7` |
| Secondary toolbar / sub-bar | 32px | `h-8` |
| List row (file list, issue list, PR list) | 32px | `h-8` or `py-1.5` with 14px text |
| Default button / input | 28px | `h-7` |
| Small button / input | 24px | `h-6` |
| Icon button | 28px | `size-7` |
| Icon button (small) | 24px | `size-6` |

**The main top bar rule:** Use `h-9 flex items-center` on the container. Do **not** use `py-*` padding — set height explicitly. `py-2.5` on a 28px avatar produces a 68px header. That's a mobile nav, not a developer tool.

### Horizontal padding

| Context | Class | Value |
|---------|-------|-------|
| Main content container (full-width) | `px-4` or `<Container>` | 16px |
| Panel / sidebar row | `px-3` | 12px |
| Dense row (file tree, list) | `px-2` | 8px |
| Button default | `px-2.5` | 10px |
| Button small | `px-2` | 8px |
| Dropdown item | `px-1.5` | 6px |

---

## Typography

**Never use Tailwind's default text scale** (`text-xs`, `text-sm`, `text-base`, `text-lg`, etc.). We have a semantic scale — use it. Raw pixel values in `className` are a bug.

### The scale

| Token | Size | Line-height | Use |
|-------|------|-------------|-----|
| `text-micro` | 10px | 1.2 | Badges, eyebrow labels (always `uppercase tracking-widest`) |
| `text-caption` | 11px | 1.4 | Timestamps, keyboard hints, secondary metadata |
| `text-ui` | 12px | 1.35 | Button labels, tab labels, nav items, filter chips |
| `text-code` | 13px | 20px fixed | File names, paths, hashes, code — anything monospaced |
| `text-body` | 14px | 1.55 | Default prose, comments, form fields, primary descriptions |
| `text-title` | 18px | 1.35 | Card / section headings |
| `text-heading` | 24px | 1.25 | Page-level headings (issue title, repo name) |
| `text-display` | 32px | 1.15 | Login card, empty-state hero — rarest size |

### Font family assignment

| Font | Token | When to use |
|------|-------|-------------|
| Berkeley Mono SemiCondensed | `font-mono` | Anything that **names a thing**: file names, paths, usernames, branch names, commit hashes, keyboard shortcuts, counts, line numbers, code |
| IBM Plex Sans | `font-sans` | Anything that **describes a thing**: nav labels, button text, descriptions, prose, UI copy |

**The rule in one line:** if it's an identifier or a symbol, it's mono. If it's a sentence or a label, it's sans.

Do not mix mono and sans on the same label. Pick one.

### Weight

| Weight | Class | Use |
|--------|-------|-----|
| 400 | `font-normal` | Body text, descriptions, secondary labels |
| 500 | `font-medium` | Primary labels, active tab text, button text, nav items |
| 600 | `font-semibold` | Section headings, page titles — sparingly |

`font-bold` (700) is **never used**. We do not have it in the font stacks and the visual weight is wrong for our aesthetic.

---

## Color

### Surface hierarchy

```
--color-bg          ← page / primary panel background
--color-bg-subtle   ← card surfaces, sidebar background, secondary panels  
--color-bg-sunken   ← hover tint, selected row, inset input, depressed surface
```

These three steps are the entire surface vocabulary. There is no fourth level.

### Hover surfaces — two options, know which to use

We have two ember-tinted hover tokens defined in `base.css`:

| Token | Value | Use |
|-------|-------|-----|
| `bg-(--color-bg-sunken)` | Stone sunken (neutral) | Default hover for rows, list items, dropdown items, nav |
| `bg-(--palette-hover)` | 6% ember tint over bg | Hover on **primary navigation** items (the active section's siblings) |
| `bg-(--palette-selected)` | 14% ember tint over bg | **Persistent selected state** — the currently active nav item |

The `--palette-*` tokens are contextually meaningful: they signal "this row belongs to the current ember-accented selection". Use `--color-bg-sunken` for neutral hover (most cases), and `--palette-*` only in primary navigation where the ember selection context is established.

### The ember accent (`--color-accent`, `text-primary`, `bg-primary`)

Ember is **earned**. It fires attention. Every use must answer: *why does this element deserve brand attention?*

**Correct uses:**
- Active nav item: left accent border `border-l-2 border-l-(--color-accent)`
- Active tab indicator: `border-t-2 border-t-(--color-accent)` or bottom equivalent
- Primary action buttons (`bg-primary`)
- Links and interactive inline text (`text-primary`)
- Focus rings (`ring-(--color-focus)`)
- Brand moment in wordmark (`_` cursor)
- Notification badges on active items
- Count/stat values in profile headers

**Incorrect uses — never do these:**
- ✗ Fill color for a hovered list row
- ✗ Background of a focused dropdown item
- ✗ Decorative border just to add color to a card
- ✗ Icon color that isn't interactive
- ✗ Any use where you could swap in `--color-bg-sunken` and lose nothing

### Text hierarchy

Always use semantic text color tokens. Do not use opacity hacks like `text-foreground/60`.

| Token | Use |
|-------|-----|
| `text-foreground` | Primary content: headings, active labels, selected items |
| `text-muted-foreground` | Secondary content: metadata, inactive tabs, descriptions |
| `text-(--color-fg-faint)` | Decorative only: separators in mono strings, disabled text |
| `text-primary` | Interactive: links, ember accent text |
| `text-destructive` | Danger actions, error states |

### Border treatment

All borders are hairlines. There are no decorative thick borders.

| Use | Class |
|-----|-------|
| Section divider, panel edge | `border-border` (1px, stone-200/stone-800) |
| Form control, focused input | `border-border-strong` |
| Horizontal rule / separator | `h-px bg-border` (not `<hr>`, not `border-b`) |
| Vertical separator | `w-px bg-border self-stretch` |

**No `border-2` or thicker in chrome.** The only thick borders are semantic: the 2px left/top accent border on active nav/tab items.

### Shadows

| Context | Rule |
|---------|------|
| Headers, sidebars, toolbars, tab bars | No shadow — flat, bordered |
| Inline cards in content area | No shadow — use border + bg-subtle |
| Overlays: dropdowns, popovers, tooltips | `shadow-md`  |
| Modals / dialogs | `shadow-xl` |

---

## Interactive State Machine

Every clickable element follows this state machine:

```
rest → hover → pressed
  ↘              ↗
    selected (persistent)

+ focus-visible (keyboard only, overlays all above)
```

| State | Treatment |
|-------|-----------|
| Rest | No background. `text-muted-foreground` for secondary, `text-foreground` for primary |
| Hover | `bg-(--color-bg-sunken)` · `text-foreground` · no transition (tool UIs are instant) |
| Pressed | `bg-(--color-bg-sunken)` with `brightness-95` or `opacity-90` |
| Selected (nav/tab) | `bg-(--palette-selected)` · `text-foreground` · ember accent border |
| Selected (list row) | `bg-(--color-bg-sunken)` · `border-l-2 border-l-(--color-accent)` |
| Focus-visible | `ring-1 ring-(--color-focus) outline-none`. Never show on mouse click — use `:focus-visible` not `:focus` |
| Disabled | `opacity-50 pointer-events-none` |
| Destructive hover | `bg-destructive/10 text-destructive` |

**No transition durations on hover in dense lists.** `transition-colors` is fine for isolated buttons. In file lists, issue lists, and any row with 10+ items, remove transition-colors — instant response feels faster.

---

## Component Patterns

### Top Bar

```
┌─────────────────────────────────────────────────────┐  h-9 (36px)
│ GitHut_  │  tab  tab  [active tab]  tab  │  ⌘K  ◉  │
└─────────────────────────────────────────────────────┘
  wordmark   tab strip (flex-1)              actions
```

```tsx
// Correct
<header className="h-9 border-b border-border">
  <div className="flex h-full items-center gap-2 px-4">
    ...
  </div>
</header>

// Wrong — py-* on a chrome bar
<header>
  <div className="flex items-center gap-3 py-2.5 px-4"> {/* ← 68px header */}
```

- Wordmark: `font-mono text-body font-medium` · ember `_` as the only brand accent
- Tab strip: `flex-1 min-w-0 flex items-center overflow-x-auto`
- Actions cluster: `flex items-center gap-2`
- Bottom border: only when no tabs are present (tabs anchor visually without a border)

### Tab Pills

```
┌──────────────────┐
│ ⊞  label  sub ×  │  h-7 (28px) · active or inactive
└──────────────────┘
```

```tsx
// Active tab
"h-7 flex items-center px-2.5 gap-1.5 font-mono text-caption font-medium"
"text-foreground bg-(--color-bg-subtle) border-t-2 border-t-(--color-accent)"

// Inactive tab  
"h-7 flex items-center px-2.5 gap-1.5 font-mono text-caption font-medium"
"text-muted-foreground hover:text-foreground hover:bg-(--color-bg-sunken)"
```

- Icon: `size-3.5` (`14px`)
- Label: `text-caption font-medium font-mono`
- Sublabel: `text-micro text-muted-foreground`
- Close `×`: `size-4`, hidden at rest (`opacity-0 group-hover:opacity-100`), `hover:bg-(--color-bg-sunken)`
- Tab separator: `w-px bg-border self-stretch my-1.5` — hidden adjacent to active tab

### Navigation / Sidebar Rows

```
│ ▌  ⊞  Label           │  active: ember left border
│    ⊞  Label           │  inactive: no bg
│    ⊞  Label           │  hover: bg-sunken
```

```tsx
// Active
"h-7 flex items-center gap-2 px-3 border-l-2 border-l-(--color-accent)"
"pl-[10px]"  // compensate 2px border so text stays aligned
"bg-(--palette-selected) text-foreground font-medium text-ui"

// Inactive
"h-7 flex items-center gap-2 px-3 border-l-2 border-l-transparent"
"text-muted-foreground hover:bg-(--color-bg-sunken) hover:text-foreground text-ui"
```

Icons: `size-4` (`16px`) · `text-muted-foreground` → `text-foreground` on hover/active

### List Rows (issues, files, PRs, commits)

```
│  ⊞  Primary label            secondary meta  timestamp  │  h-8 (32px)
│  ⊞  Primary label            secondary meta  timestamp  │
```

```tsx
"flex h-8 items-center gap-3 px-3"
"hover:bg-(--color-bg-sunken)"
// No transition-colors for lists
```

- Primary label: `text-body font-medium text-foreground`
- Secondary text: `text-caption text-muted-foreground`
- Timestamps: `text-caption font-mono text-muted-foreground`
- Hashes / IDs: `text-caption font-mono text-muted-foreground`
- Left icon: `size-4 shrink-0 text-muted-foreground`

Selected row in a navigable list adds: `bg-(--color-bg-sunken) border-l-2 border-l-(--color-accent) pl-[10px]`

### Buttons

```
text-ui (12px) · font-medium · h-7 · px-2.5
text-caption (11px) · font-medium · h-6 · px-2   ← small
```

Never use `text-sm` or `text-xs` inside buttons. Our scale is `text-ui` (12px) for standard buttons and `text-caption` (11px) for small ones.

Icon inside button: `size-4` for standard, `size-3.5` for small. Use `data-icon="inline-start"` per shadcn's button convention.

### Badges / Pills

```tsx
// Status badge (e.g. "Open", "Draft")
"text-micro uppercase tracking-widest font-medium px-1.5 py-0.5 rounded-sm"

// Count (e.g. "42 issues")
"font-mono text-caption font-medium text-muted-foreground"

// Notification dot
"size-1.5 rounded-full bg-(--color-accent)"  // no text, no border
```

### Separator / Divider

```tsx
// Horizontal rule within a panel
<div className="h-px bg-border my-1 -mx-1.5" />

// Dropdown / popover separator — use DropdownMenuSeparator

// Vertical separator between button groups
<div className="w-px bg-border self-stretch my-1" />
```

Do not use `<hr>`. Do not use `border-b` on a container just to draw a line — use the `h-px` element.

---

## Anti-Patterns — Never Do These

### Spacing / Layout
- **`py-2.5` or more on any chrome bar** — produces 68px+ headers. Set height explicitly with `h-9`, `h-8`, `h-7`.
- **`gap-4` or more between icon + label** — 16px between a 14px icon and 12px label. Use `gap-1.5` (6px).
- **`p-4` or `p-6` on a list row** — rows are `h-8 py-0` or `py-1.5` max.
- **`space-y-*` or `space-x-*`** — always `gap-*` with `flex`.

### Typography
- **`text-sm`, `text-xs`, `text-base`, `text-lg`** — use our semantic scale.
- **Raw pixel values in className**: `text-[11px]`, `text-[13px]` — use `text-caption`, `text-code`.
- **`font-bold` (700 weight)** — not in our font stacks; use `font-semibold` max.
- **Mixing mono + sans on a single label** — pick one.
- **`uppercase` without `tracking-widest`** — always pair them on micro labels.

### Color
- **Ember as hover fill** — `hover:bg-primary`, `hover:bg-(--color-accent)` on rows or nav items.
- **`bg-accent` from shadcn's default for hover** — the bridge is fragile across themes; use `bg-(--color-bg-sunken)` directly.
- **Raw hex in `className`** — `bg-[#ea580c]`, `text-[#57534e]`. Always a token.
- **`text-foreground/60` opacity hack** — use `text-muted-foreground` instead.
- **`--color-accent` directly in component code** — use `--color-bg-sunken` for hover, `--color-focus` for rings, `text-primary` for links.

### Visual Treatment
- **`rounded-lg` on list rows, nav items, or tab pills** — use `rounded-sm` (3px) or `rounded-md` (4px). Large radius reads as "mobile app".
- **`shadow-*` on chrome** — no box-shadow on headers, sidebars, toolbars, or tab bars. Shadows belong on overlays only.
- **Gradients anywhere in chrome** — flat surfaces, bordered. Gradients only in content (charts, stat cards).
- **Transition delays on dense lists** — `transition-colors duration-200` on a 50-item file list creates lag. Omit or use `duration-75` max.
- **Chevron disclosure on every section** — use only when the expand is genuinely non-obvious.

### Ember misuse
- **Filled ember background on hover** — a hovered nav item is sunken surface + foreground text, NOT an ember rectangle.
- **Ember on decorative icons** — icon colors are `text-muted-foreground` by default; ember is for interactive icons that ARE the primary action.
- **`bg-primary` on anything other than a call-to-action button** — it's the loudest thing on the screen; use it once per view at most.

---

## Density Reference

These are the exact values used in production. When in doubt, match these.

| Element | Height | Font | Size | Weight | Color |
|---------|--------|------|------|--------|-------|
| Top bar | `h-9` | mono | `text-body` | medium | foreground |
| Tab pill active | `h-7` | mono | `text-caption` | medium | foreground |
| Tab pill inactive | `h-7` | mono | `text-caption` | medium | muted |
| Sidebar nav row | `h-7` | sans | `text-ui` | medium | muted→fg |
| List row primary | `h-8` | sans | `text-body` | medium | foreground |
| List row secondary | `h-8` | mono | `text-caption` | normal | muted |
| Dropdown item | auto | sans | `text-body` (14px via shadcn) | normal | foreground |
| Button default | `h-7` | sans | `text-ui` | medium | — |
| Button small | `h-6` | sans | `text-caption` | medium | — |
| Breadcrumb | — | mono | `text-body` | normal | muted+fg |
| Badge / pill | — | sans | `text-micro` | medium | — |
| Timestamp / hash | — | mono | `text-caption` | normal | muted |
| Icon (nav/header) | — | — | `size-3.5` | — | muted |
| Icon (list row) | — | — | `size-4` | — | muted |
| Icon (button) | — | — | `size-4` | — | inherits |
