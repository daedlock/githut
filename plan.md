# GitHut — Layout & UI Plan

> **Audience:** the agent or engineer building GitHut's next phase. This document locks the UX direction, layout contracts, and build order. When in doubt, re-read rather than invent. The goal is **Linear-quality feel for the read + review path of GitHub** — speed, keyboard, triage, density. We are not rebuilding all of github.com. We are building the single best client for reading code and reviewing PRs.

---

## 1. Positioning

GitHut is **the fast read-path for GitHub**. Three user jobs, in order of importance:

1. **Review PRs** — the biggest improvement area vs github.com
2. **Triage work** — inbox of what demands your attention today
3. **Browse code, commits, issues** — fast, keyboard-first, spatial memory preserved

What we are **not** building: Actions, Projects, Wiki, Security, Insights, Marketplace, Discussions, code editing, or writing-path features. If a user needs those, they open github.com.

---

## 2. Design DNA — the non-negotiables

These principles are the deciding voice when we argue about any UI decision.

1. **Speed is the product.** Every interaction ≤100ms perceived. Optimistic UI on all mutations. Prefetch on hover. IndexedDB-backed query cache. The spinner is a bug.
2. **Keyboard is the primary input.** Every action has a shortcut. `?` reveals the map. Nothing relies on hover-only or click-only.
3. **Opinionated triage.** The UI tells you what to focus on. Inbox is not a feed — it is a to-do queue, ranked.
4. **Density + rhythm.** Tight vertical spacing, one shared type scale (`--text-*` tokens), one ember accent, restrained. Every gap and size is intentional, not eyeballed.
5. **Motion is narrative.** Peek panels slide from the right; archived items slide out; state changes animate to where they're going. Motion explains structure, never decorates.
6. **Local-first feel.** Cached data is the default; network revalidates in background. Works offline for read paths.
7. **Editorial over utilitarian.** Prose meta lines instead of grids of chips. Content earns its chrome.

---

## 3. Layout thesis

> **Top bar (persistent) + per-surface contextual sidebars + command palette (`⌘K`) as primary navigation. No global left sidebar.**

**Why not Linear's left sidebar?** Linear is list-heavy (issues, projects, cycles). We're code/diff-heavy — diffs, file trees, and split views want every horizontal pixel. A 240px nav rail permanently stolen from main content is the wrong trade. Palette + a thoughtful top bar delivers Linear's nav velocity without the sidebar tax.

**Visual layout:**

```
┌────────────────────────────────────────────────────────────────────────┐
│ ◈ GitHut_   daedlock ▾ ⋮ owner / repo          [●3]  ⌘K   [avatar]    │  top bar (sticky)
├────────────────────────────────────────────────────────────────────────┤
│ Code  Commits  Pull requests  Issues                                    │  repo tabs (when in repo)
├────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│                        content (full width)                             │  contextual sidebars live here per surface
│                                                                         │
└────────────────────────────────────────────────────────────────────────┘
```

**Top bar zones (left → right):**
- `GitHut_` — wordmark, home link (goes to `/` = inbox)
- Workspace switcher — "daedlock ▾" — user's pinned set of repos. Collapses to "All" when no workspace selected.
- Breadcrumb context — `owner / repo` in a repo context; page name otherwise
- Inbox pill — `●N` unread indicator. Click opens peek drawer; direct route is `/`.
- `⌘K` palette trigger
- User menu

**What is NOT in the top bar:** theme toggle (moved to user menu), help, docs, sign out (user menu), notifications bell (replaced by inbox pill).

---

## 4. Surfaces

Exactly the surfaces below. Do not add more without reopening this document.

### 4.1 Inbox — `/` — the new home

Replaces today's "list of all repos." Four sections, ranked by actionability:

```
AWAITING YOUR REVIEW                                                   3
◉ ninja-rs · #128  "add evm precompiles for ecrecover"    you · 4h
◉ githut · #42   "tight editorial commit page"            you · 1d
◉ ninja-rs · #121  "debugger: sticky header fix"          you · 3d

MENTIONED                                                              1
◆ ninja-rs · #119  "@dloc can you triage the stack trace?"  alex · 2h

ASSIGNED                                                               2
● ninja-rs · #113  "perf regression on EVM bench suite"    you · 1d
● githut · #38   "implement PR files view"                you · today

YOUR PRs · AWAITING ACTION                                             1
● ninja-rs · #126  "kpvm rewrite"   2 approvals · CI green · ready
```

- Data: GitHub REST `/notifications` + cross-repo search queries (`is:open assignee:@me`, `is:open review-requested:@me`, etc.) polled every 60s with jitter
- Row shape: status glyph · repo · `#num` · title · meta · time
- Keyboard: `j/k` move · `Enter` open · `p` peek · `e` archive · `s` snooze · `u` open upstream on github.com
- Section headers collapsible (`h/l` to toggle)
- Empty state: *"You're all caught up."*

Full-page route is `/`. Peek drawer version is accessible from the inbox pill in the top bar — identical content, half the width.

### 4.2 Workspace — `/w/:name` — curated repo grid

- Default workspace = pinned repos (3–10 user-chosen). Initial seed = orgs the user belongs to.
- Grid of repo cards. Responsive 1/2/3 cols at sm/md/xl.
- Per card: name, language bar, latest activity, open PRs, open issues, last-pushed. Click → repo shell.
- Workspace switcher in top bar lets the user flip between workspaces without page reload.
- Creating/editing workspaces is a settings task (not a modal on this page).

### 4.3 Repo shell — `/:owner/:repo/*`

Already built. Tabs: **Code · Commits · Pull requests · Issues**. Keep as-is.

Tab design: sans 12px sentence-case, color + underline on active, no font-weight toggle (reflow bug), underline flush with the closing border so header + tabs read as one chrome unit. Done; documented in memory.

### 4.4 Code — `/:o/:r/code`

Already built (file browser + blob viewer + README). Polish items:
- Sticky path breadcrumb aligned to app gutter (outside container)
- `t` to open fuzzy file finder (palette scoped to current repo's file index)
- Recent-files rail at top (MRU, IndexedDB-cached)
- Branch switcher as compact popover in the top-right of the file list, not a fat dropdown

### 4.5 Commits — `/:o/:r/commits`

Currently plain. Redesign as grouped timeline:

```
2026-04-19  ──────────────────────────────────────────────────────────
◔ remove tui from workspace for now            daedlock · bad8697 · 4h
● feat: add ecrecover precompile                 daedlock · 3bf810e · 6h
● docs: tighten reviewer notes                   alex · 1be2ff4 · 12h

2026-04-18  ──────────────────────────────────────────────────────────
● merge: main ← feature/debugger-ui             daedlock · 8a9f03c · 1d
```

- Grouped by ISO date headers
- Per row: CI glyph (◔ pending / ● green / ✕ red) · message · author · SHA chip · time
- Virtualized (react-virtual) for long histories
- Keyboard: `j/k` · `Enter` full detail · `p` peek
- Filter chips: author, date range, branch

### 4.6 Commit detail — `/:o/:r/commit/:sha`

Already built. Editorial header (title, prose meta, SHA anchored top-right, optional body as blockquote) + `DiffLayout` (file tree + stacked diffs + sticky top bar + `j/k`/`[` shortcuts). Keep; polish with motion when shipping phase 3.

### 4.7 Pull requests list — `/:o/:r/pulls`

Currently coming-soon placeholder. Design:

- Segmented tabs at top: `Needs your review · Yours · All` (default = "Needs your review")
- Row shape identical to issues list + additions:
  - CI traffic-light dot
  - Reviewer avatar stack (max 3 + overflow)
  - Mergeability pill (ready · conflicts · draft · needs approval)
  - Approval count (`✓ 2/2`)
- Keyboard: `j/k` · `Enter` · `p` peek · `a` approve · `r` request changes · `c` comment

### 4.8 PR detail — `/:o/:r/pulls/:num` — the "Change" view

The biggest redesign lever in the app.

```
┌─ top bar + repo tabs ──────────────────────────────────────────────┐
│ ← back   #128  "add evm precompiles for ecrecover"                  │
│ daedlock wants to merge 3 commits into main from feature/precompiles│
│ ● Open   ✓ 2 reviews   ✓ CI passing   ● Ready to merge              │
├─────────────────────────────────────────────────────────────────────┤
│  Overview  |  Files changed (12)  |  Commits (3)  |  Discussion (8) │
├─────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  Overview      → markdown description + AI "what this changes"       │
│                  summary paragraph + linked issues + timeline        │
│  Files changed → DiffLayout (tree + stacked diffs + top bar)         │
│  Commits       → per-commit mini-list; click → that commit's diff    │
│  Discussion    → review conversations (separate from inline comments)│
│                                                                      │
│ Primary actions (keyboard): a approve · r request · c comment · m merge│
└─────────────────────────────────────────────────────────────────────┘
```

The commit and PR views SHARE the diff renderer (`DiffLayout`) but differ on metadata/actions around it. Treat a commit and a PR as two instances of a `Change` concept — same shape, different lifecycle.

### 4.9 Issues list — `/:o/:r/issues`

Already built. Additions:
- Saved-views chip bar above list: `my open · assigned · mentioned · created`
- `c` to create issue
- Bulk select via `x` for multi-assign/close/label (post-MVP stretch)

### 4.10 Issue detail — `/:o/:r/issues/:num`

Already built (title + prose meta + markdown body + comments + reactions + CommentBox with @/# triggers + sidebar for labels/assignees). Keep.

### 4.11 Settings — `/settings`

Already scaffolded. Lives in the user menu. Sections:
- **Theme** — palette picker (stone / ember / ember-soft) + light/dark/system. Uses `ThemePicker`.
- **Workspaces** — manage pinned repos per workspace (future)
- **Keyboard** — full shortcut reference
- **Account** — sign out, token info

### 4.12 Login — `/login`

Single-button GitHub OAuth card. No landing page. Keep.

---

## 5. Cross-cutting systems

These are shared primitives that every surface consumes.

### 5.1 Command palette — `⌘K`

Primary navigation. Overlay dialog (Radix Dialog + cmdk). Sections, in order:

1. **Recent** — last 5 items opened (IndexedDB-backed MRU)
2. **Actions** — starting with `>`: toggle theme, snooze all, sign out, new issue, etc.
3. **Repos** — fuzzy match; pinned first
4. **Issues & PRs** — cross-repo, uses GitHub search API (`is:open assignee:@me bug` style queries)
5. **Files** — scoped to current repo when user is in a repo context; uses cached tree

`Enter` navigates. `⌘Enter` opens in peek drawer. Search input is always focused on open.

### 5.2 Peek panel (right drawer)

Slide-over panel from the right, 50% viewport width. Content = the same React component that would render at the full route, just inside a drawer container.

Use cases:
- Click an item in a list → opens as peek (preserves list position)
- Reference another issue/PR in a comment → open as peek instead of navigating
- Palette `⌘Enter` → peek the selected result

Behavior:
- `Esc` or clicking outside closes
- `⌘Enter` promotes peek → full route
- Navigating inside a peek (clicking another link) **replaces** peek content (Finder-style Quick Look, not stacked)
- At most ONE peek at a time

### 5.3 Keyboard layer

One shared hook, one map per surface, one help overlay.

- Global: `⌘K` palette · `g h` home · `g i` issues · `g p` PRs · `g c` code · `?` help
- Contextual per surface (documented above per section)
- Discovery: `?` opens an overlay with every shortcut, grouped by surface. Takes current URL into account so only relevant shortcuts show up top.
- Implementation: a single `useKeybindings(map)` hook that disables when focus is in inputs/textareas/contenteditable, otherwise dispatches.

### 5.4 Sync & cache layer

- TanStack Query + IndexedDB persister (already wired)
- `staleTime` per resource type, documented in hooks
- On window focus → revalidate stale queries
- Optimistic updates for all mutations (create issue, post comment, react, approve PR, etc.)
- Offline read mode — cached data renders normally; mutations queued with UI hint and retried on reconnect (stretch)

### 5.5 Motion kit

Three shared primitives, exported from `src/app/lib/motion.tsx`:

1. `fadeIn` — 120ms cubic-out, used for dialogs/popovers
2. `slideOver` — 180ms ease-out, used for peek drawer entering from right
3. `listEnter` — 60ms stagger per row, capped at 8 visible; used for the inbox reveal on first load

No bounces. No springs. Industrial, deliberate motion.

### 5.6 Notification polling

Single worker/hook that hits `/notifications` and aggregates the inbox sections. Poll interval: 60s with 5s jitter. Pause when the tab is hidden. Badge count updates the inbox pill in real time.

---

## 6. Visual language — rules to lock in

Most of these are already partially enforced. Formalizing them so every future surface is consistent.

| Area | Rule |
|---|---|
| **Type scale** | Only the 9 tokens in `index.css`: `text-micro · caption · ui · code · body · body-lg · title · heading · display`. No `text-[Npx]` in new code. |
| **Mono vs sans** | Mono = eyebrows, code, hashes, technical meta. Sans = body, nav, UI labels, anything that reads as running text. |
| **Uppercase tracking-widest** | Reserved for eyebrow labels (section markers you don't click). Never on nav or primary actions. |
| **Page titles** | Two patterns only: **section header** (`text-title` / 18px medium) and **hero** (`text-heading` / 24px medium). |
| **List row** | Canonical shape: `px-4 py-3`, hairline bottom border, no outer card. Variants only for density (compact/cozy). |
| **Cards vs hairlines** | Cards ONLY for isolated content blocks (comment cards, widget boxes). Hairlines everywhere else. Kill outer borders on list panels. |
| **Icons** | `h-3.5 w-3.5` inline-with-text · `h-4 w-4` standalone/button. Lucide only. No decorative icons. |
| **Colors** | Tokens only (`var(--color-*)`, `var(--diff-*)`, `var(--syntax-*)`). Never raw hex in components. WCAG AA on all token definitions, documented inline. |
| **Hover states** | Subtle bg tint (`--color-bg-subtle` or `--color-bg-sunken`). Never outlines, shadows, or scale. |
| **Active state on controls** | Color shift + underline (for tabs) or filled bg (for buttons). NEVER `font-weight` toggle — causes layout reflow. |
| **Numbers** | `tabular-nums` everywhere counts, SHAs, or line numbers render. |
| **Radius** | `--radius-xs · sm · md · lg` — the only four. |
| **Gutters** | `px-4 sm:px-6` — one horizontal gutter rule, applied via `Container` primitive or matched manually on full-bleed rows. |

---

## 7. Build order

Rough estimates; adjust per velocity.

| Phase | Scope | Est. |
|---|---|---|
| **0 — Done** | Shell + theme + type scale + diff viewer + commits list + commit detail + issues CRUD + comment box + file tree | ✓ |
| **1 — Nav unlock** | Top bar rework (inbox pill, palette trigger, workspace stub) · command palette with Actions/Repos/Search · keyboard layer + `?` help | 1 week |
| **2 — Inbox** | Replace `/` with triaged inbox · notifications polling hook · peek panel primitive · inbox-pill peek | 1 week |
| **3 — PR view** | PR list with segmented filter · PR detail Change view with tabs (Overview / Files / Commits / Discussion) · approval + merge actions | 2 weeks |
| **4 — Polish & speed** | Motion kit · prefetch-on-hover · optimistic mutations · visual language audit pass | 1 week |
| **5 — Innovation bets** | AI PR summary (toggleable) · unified Change model for commits+PRs · workspaces real impl · AST-level diff (research) | async |

**Phase 1 is the unlock.** Once palette + keyboard ship, the app *feels* like Linear even before the PR view is built. Users start their day in GitHut instead of github.com. That habit change is what makes the rest worth doing.

---

## 8. Non-goals / out of scope (this plan)

- Writing/editing code
- Actions / CI runs
- Projects / Boards
- Wiki
- Discussions
- Security / Dependabot
- Insights
- Marketplace / Explore
- Mobile-optimized layouts (responsive ok; no tablet/phone-first design)
- Org admin / access management
- Gists

If the user asks for any of these, deflect to github.com and consider whether the missing surface would materially improve the review/triage path.

---

## 9. Decision log — things NOT to relitigate

1. **No global left sidebar.** Decided for main-content horizontal density. Revisit only if list-based surfaces come to dominate the app.
2. **Command palette is primary nav.** Decided; any "I want a menu" impulse should be a palette item instead.
3. **Top bar is a single row.** Resist the urge to split brand, context, and actions across two rows.
4. **Mono for eyebrows; sans for nav.** Font-family choice is tied to intent, not "looks cool."
5. **Fixed-weight active tabs.** Never toggle `font-weight` on interactive state (reflow).
6. **Tokens only, no hex.** Color discipline document is in `memory/feedback_color_discipline.md`.
7. **One type scale.** 9 tokens, documented in `index.css`. No ad-hoc `text-[Npx]`.
8. **Full-bleed gutter is `px-4 sm:px-6`.** Matches `Container`'s horizontal padding so full-bleed rows align with container content visually.
