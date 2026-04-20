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

## 7. Parallelization model

This plan is built to be executed by **multiple agents running in parallel**. Each phase starts with a short serial "gate" pass that establishes shared contracts (types, hooks, primitives), then opens up for concurrent task execution.

### 7.1 Coordination rules

1. **One agent per task.** Task IDs (see §8) are the coordination unit. An agent claims a task by updating a task-tracker with its worktree name; no other agent touches that task until it's merged or released.
2. **Worktree isolation.** Every agent works on a separate git worktree branched from `main`. No direct work on `main` except merges.
3. **Own only what you claim.** Every task has an `Owns:` list of file paths. An agent may **only modify files in that list**. If a task requires editing outside its scope, it stops and opens a follow-up task.
4. **Read before you write.** Every agent reads `plan.md`, the relevant memory files (`~/.claude/projects/-home-end4-code-projects-githut/memory/`), and the existing components it will touch before writing code. Five minutes of reading prevents hours of rework.
5. **Types/contracts are committed first.** If a task produces shared types or hooks consumed by parallel tasks, it must land those contracts (signatures, exports) before its consumers start. See §7.3.
6. **No speculative abstractions.** Don't add generic helpers "in case" a sibling task needs them. If two tasks end up duplicating logic, that's a known follow-up — extract after merge.
7. **Follow the visual language rules** (§6) and the color discipline memory. Raw hex in components = rejected in review.
8. **Keep `bun tsc --noEmit` green.** Every task's exit criteria includes a clean type-check on `main`-rebased HEAD.
9. **Conflict resolution.** If an agent hits a merge conflict on rebase, it re-runs against the updated `main` — does not modify anyone else's work. Shared surfaces (top bar, palette, memory files) are serialized via task deps.

### 7.2 Task DAG

Phases gate on each other, but tasks **within** a phase run in parallel once that phase's gate tasks are done. The order is:

```
P0 (done)
  │
  ├──> P1 gates ────> P1 parallel tasks
  │         │               │
  │         └───────────────┼──────────┐
  │                         ▼          ▼
  ├──> P2 gates ────> P2 parallel tasks
  │                         │
  │                         ▼
  ├──> P3 gates ────> P3 parallel tasks (largest fan-out)
  │                         │
  │                         ▼
  ├──> P4 (fully parallel — no gates)
  │
  └──> P5 (async, pick up anytime after P3)
```

Gates are strictly serial; everything under a gate's arrow is parallel.

### 7.3 Shared contracts — built by gate tasks

These are the primitives every downstream task consumes. Land them before parallel work starts.

| Contract | Produced by | Consumed by |
|---|---|---|
| `useKeybindings(map)` hook | `P1.G1` | all palette/surface shortcuts |
| `<CommandPalette />` opener API | `P1.G2` | top bar trigger, keyboard shortcuts |
| `useNotifications()` hook + normalized row type | `P2.G3` | inbox sections, inbox pill badge |
| `<PeekPanel />` primitive + `usePeek()` state | `P2.G4` | inbox pill, list-row clicks, palette `⌘Enter` |
| Pulls schemas + `useRepoPulls/Pull/PullFiles` hooks | `P3.G5` | PR list, PR detail shell, every PR tab |
| `Change` view-model type (commit ∪ PR) | `P3.G6` | PR detail tabs, future unified change view |
| `lib/motion.tsx` primitives | `P4.T4.a` | any subsequent polish pass |

Every gate task's acceptance criteria includes "exports the contract and lands it on `main` before dependents start."

### 7.4 Worktree tooling

Use the Agent tool with `isolation: "worktree"` so each agent gets a clean branch. The main-repo `.claude/` configs propagate automatically. Agents run their own `bun tsc --noEmit` and `bun run build` as part of acceptance.

---

## 8. Build plan — tasks

Each task below can be handed to an agent verbatim. Tasks are independent within their phase unless they list a dep.

### Phase 0 — Done

Shell, theme, type scale, `DiffLayout`/`DiffView`, commits list, commit detail, issues CRUD, `CommentBox` with @/# triggers, reactions, `ChangedFileTree`, `FileIcon`, Ember theme presets.

### Phase 1 — Nav unlock

Target: palette + keyboard + top bar upgrade. Land: **~1 week across 2–3 agents**.

#### `P1.G1` — Keyboard layer primitive [GATE]
**Scope:** shared hook for keyboard shortcuts with focus-aware dispatch.
**Owns:** `src/app/hooks/useKeybindings.ts` (new), `src/app/lib/shortcuts.ts` (new — registry of global shortcuts).
**Depends on:** none.
**Acceptance:**
- `useKeybindings(map)` accepts `{ [chord: string]: () => void }` (supports `j`, `g h`, `⌘k`, `shift+enter`, etc.)
- Auto-disables dispatch when focus is in `input`, `textarea`, `[contenteditable]`, or when a modifier conflicts with browser (e.g., `⌘r`)
- `g` prefix chord supported with 500ms timeout
- Exports `shortcuts.ts` with the current global map (see §4.*, §5.3)
- Tsc clean

#### `P1.G2` — cmdk + Radix Dialog install + shell [GATE]
**Scope:** install `cmdk`, scaffold the empty palette shell. Actual content lands in T1.b.
**Owns:** `package.json`, `src/app/components/CommandPalette.tsx` (new, empty shell), `src/app/stores/commandPalette.ts` (new, zustand open/close).
**Depends on:** none.
**Acceptance:**
- `bunx cmdk` installed; Radix `Dialog` already available
- `<CommandPalette />` renders an empty Radix Dialog with a cmdk input, opened via `usePaletteStore.open()`
- Exported API: `useCommandPalette()` returning `{ open, close, toggle }`
- Dialog closes on `Esc`, backdrop click, or route change
- Motion: fade + scale-up enter (120ms)

#### `P1.T1.a` — Top bar rework
**Scope:** new top-bar composition per §3 — workspace switcher stub, inbox pill, palette trigger, user menu.
**Owns:** `src/app/components/shell/ShellHeader.tsx`, `src/app/components/shell/TopBar.tsx` (new), `src/app/components/shell/WorkspaceSwitcher.tsx` (new, stub), `src/app/components/shell/InboxPill.tsx` (new, stub that shows count=0 until P2).
**Depends on:** `P1.G2` (for palette trigger).
**Acceptance:**
- Renders in the layout described in §3 visual
- Workspace switcher is a popover listing "All repos" only (real impl in P5)
- Inbox pill = clickable button that opens a peek (stub: opens empty peek until P2.T2.b lands)
- Palette trigger = button labelled `⌘K`, hits `usePaletteStore.open()`
- `UserMenu` still renders sign-out and theme toggle (moved here from top bar)
- Tsc clean; existing routes still render correctly

#### `P1.T1.b` — Command palette content
**Scope:** sections Recent · Actions · Repos · Search. Per §5.1.
**Owns:** `src/app/components/CommandPalette.tsx` (fill in), `src/app/hooks/useCommandPaletteItems.ts` (new), `src/app/lib/recentItems.ts` (new — IDB-backed MRU store).
**Depends on:** `P1.G1` (for `⌘K` binding), `P1.G2` (shell).
**Acceptance:**
- `⌘K` opens palette from anywhere
- Actions section with at least: toggle theme, sign out, open inbox, new issue
- Repos section: fuzzy-match pinned + recent repos (uses existing `useRepos`)
- Search section: cross-repo issue/PR search via GitHub Search API (`GET /search/issues`)
- `Enter` navigates; `⌘Enter` reserved for peek (no-op until `P2.G4`)
- Recent MRU grows with every navigation (cap 20)
- No raw hex, all tokens

#### `P1.T1.c` — Keyboard help overlay
**Scope:** `?` opens a dialog listing every registered shortcut, grouped by surface.
**Owns:** `src/app/components/KeyboardHelp.tsx` (new), `src/app/stores/keyboardHelp.ts` (new).
**Depends on:** `P1.G1`.
**Acceptance:**
- `?` opens the overlay (global shortcut, skipped in inputs)
- Lists shortcuts grouped by scope (Global, Repo, Diff, List)
- Highlights the group matching the current route
- `Esc` closes

---

### Phase 2 — Inbox

Target: make `/` a triaged inbox with peek support. Land: **~1 week across 2–3 agents**.

#### `P2.G3` — Notifications hook [GATE]
**Scope:** `useNotifications()` + normalized `InboxRow` type.
**Owns:** `src/app/features/inbox/schemas.ts` (new), `src/app/features/inbox/hooks.ts` (new), `src/app/features/inbox/types.ts` (new).
**Depends on:** none.
**Acceptance:**
- Polls `/notifications` every 60s with 5s jitter; pauses when `document.hidden`
- Additionally fires `is:open review-requested:@me` and `is:open assignee:@me` cross-repo searches every 5min
- Returns `{ awaiting: InboxRow[], mentioned: InboxRow[], assigned: InboxRow[], yours: InboxRow[] }`
- `InboxRow` normalizes PR/issue/commit shapes into `{ id, kind, repo, number, title, updatedAt, urgency, url }`
- Uses TanStack Query with persister; staleTime 30s
- Local snooze/archive store (persisted) filters rows out; keyed by `${repo}#${id}`

#### `P2.G4` — Peek panel primitive [GATE]
**Scope:** slide-over drawer + `usePeek()` state.
**Owns:** `src/app/components/PeekPanel.tsx` (new), `src/app/stores/peek.ts` (new).
**Depends on:** none.
**Acceptance:**
- `<PeekPanel />` mounted at app root renders a right-side drawer (50% viewport, min 480px)
- `usePeek()` API: `open({ kind, ...payload })`, `close()`, `promote()` (navigates to full route, closes peek)
- `Esc`/backdrop closes; internal nav replaces content (Finder Quick Look semantics)
- One peek at a time; second `open()` replaces first
- Slide-over motion (180ms ease-out) using CSS transitions
- Focus management: first focusable inside receives focus on open; restores on close

#### `P2.T2.a` — Inbox route
**Scope:** replace `src/app/routes/index.tsx` with the triaged inbox from §4.1.
**Owns:** `src/app/routes/index.tsx`, `src/app/features/inbox/InboxPage.tsx` (new), `src/app/features/inbox/InboxRow.tsx` (new), `src/app/features/inbox/InboxSection.tsx` (new).
**Depends on:** `P2.G3`, `P2.G4`, `P1.G1`.
**Acceptance:**
- Matches the 4-section layout in §4.1 visually
- `j/k`/`Enter`/`p`/`e`/`s`/`u` shortcuts wired
- Section headers collapsible with `h/l`
- Empty state text
- Archives and snoozed items persist across reloads

#### `P2.T2.b` — Inbox pill peek integration
**Scope:** wire the inbox pill in the top bar to open the inbox content as a peek.
**Owns:** `src/app/components/shell/InboxPill.tsx`.
**Depends on:** `P2.G4`, `P2.T2.a` (reuses `InboxPage` content inside peek).
**Acceptance:**
- Click opens peek with inbox content
- Badge shows unread count (`awaiting.length + mentioned.length`), updates live
- `⌘Enter` inside peek promotes to full `/` route

#### `P2.T2.c` — Repo list retired (moved to `/w/all`)
**Scope:** move the old home-page repo list to the new workspace route.
**Owns:** `src/app/routes/w.$name.tsx` (new), `src/app/components/repo/RepoListWidget.tsx` (move).
**Depends on:** none (parallel with T2.a/T2.b).
**Acceptance:**
- `/w/all` renders the repo list (old home content)
- Home (`/`) no longer shows repos
- `WorkspaceSwitcher` stub from `P1.T1.a` links to `/w/all`

---

### Phase 3 — PR view

Target: ship the "Change" view. Largest parallel fan-out. Land: **~2 weeks across 4–6 agents**.

#### `P3.G5` — Pulls data layer [GATE]
**Scope:** schemas + hooks mirroring the issues feature shape.
**Owns:** `src/app/features/pulls/schemas.ts` (new), `src/app/features/pulls/hooks.ts` (new), `src/app/features/pulls/types.ts` (new).
**Depends on:** none.
**Acceptance:**
- Exports: `useRepoPulls(owner, repo, filter)`, `useRepoPull(owner, repo, number)`, `useRepoPullFiles(owner, repo, number)`, `useRepoPullReviews`, `useRepoPullComments`, `useRepoPullCommits`
- Mutations: `useCreatePullComment`, `useSubmitPullReview`, `useMergePull`, `useAddPullReaction`
- Zod schemas at boundary (`PullSummarySchema`, `PullDetailSchema`, `PullFileSchema`, `PullReviewSchema`)
- Follows the hook conventions in `src/app/hooks/` (staleTime, enabled guards, queryKey shape)

#### `P3.G6` — `Change` view-model [GATE]
**Scope:** a thin union type so commits and PRs can share tabs downstream.
**Owns:** `src/app/features/changes/types.ts` (new).
**Depends on:** none (ideally lands same time as G5 but no dependency).
**Acceptance:**
- Exports `type Change = { kind: "commit" | "pr"; id: string; title: string; author: Actor; changedFiles: DiffLayoutFile[]; ...meta }` or similar
- Helpers: `changeFromCommit(commit)`, `changeFromPull(pull, files)`
- Keep minimal — only fields needed by downstream tasks

#### `P3.T3.a` — PR list
**Scope:** `routes/$owner.$repo.pulls.tsx` (replace the coming-soon placeholder).
**Owns:** that route file + `src/app/features/pulls/PullList.tsx` (new), `PullRow.tsx` (new), `PullListFilters.tsx` (new).
**Depends on:** `P3.G5`.
**Acceptance:**
- Segmented tabs: `Needs your review · Yours · All`
- Row shape per §4.7
- `j/k/Enter/p/a/r/c` shortcuts wired
- Virtualized when >100 rows

#### `P3.T3.b` — PR detail shell [GATE for tabs c/d/e/f]
**Scope:** `routes/$owner.$repo.pulls.$num.tsx` with sub-route tab switcher.
**Owns:** that route file + `src/app/features/pulls/PullDetailShell.tsx` (new), `PullHeader.tsx` (new).
**Depends on:** `P3.G5`, `P3.G6`.
**Acceptance:**
- Renders the header per §4.8 (title, branches, state pills)
- Tab switcher: Overview / Files changed / Commits / Discussion (URL: `?tab=overview|files|commits|discussion`)
- Approval/merge action buttons in header (wired stubs; real logic in T3.g)
- Tabs render empty-state placeholders until their owning task lands

#### `P3.T3.c` — Overview tab
**Scope:** description + conversation timeline.
**Owns:** `src/app/features/pulls/tabs/OverviewTab.tsx` (new).
**Depends on:** `P3.T3.b`.
**Acceptance:**
- Renders PR body via `GithubMarkdown`
- Lists linked issues (parses "fixes #N" from body)
- Timeline of comments + events (labeled/assigned/reviewed)
- Reuses `CommentBox` for posting

#### `P3.T3.d` — Files changed tab
**Scope:** wire `DiffLayout` to PR files.
**Owns:** `src/app/features/pulls/tabs/FilesTab.tsx` (new).
**Depends on:** `P3.T3.b`, existing `DiffLayout`.
**Acceptance:**
- Uses `useRepoPullFiles` → maps to `DiffLayoutFile[]` → renders `<DiffLayout />`
- Sidebar auto-collapses for 1-file PRs (existing pattern)

#### `P3.T3.e` — Commits tab
**Scope:** list of commits in the PR; click → commit-detail view inline or peek.
**Owns:** `src/app/features/pulls/tabs/CommitsTab.tsx` (new).
**Depends on:** `P3.T3.b`.
**Acceptance:**
- Lists commits per the commits timeline design (§4.5)
- Click a commit opens it in a peek drawer (uses `P2.G4`)

#### `P3.T3.f` — Discussion tab
**Scope:** review-level conversation (separate from inline file comments).
**Owns:** `src/app/features/pulls/tabs/DiscussionTab.tsx` (new).
**Depends on:** `P3.T3.b`.
**Acceptance:**
- Renders review comments grouped by review submission
- Supports reply + reactions via existing primitives
- `r` shortcut to post reply to focused comment

#### `P3.T3.g` — Review actions
**Scope:** approve · request changes · comment · merge buttons + mutations.
**Owns:** `src/app/features/pulls/PullActions.tsx` (new), extends `P3.G5` mutations.
**Depends on:** `P3.T3.b` (for header slot).
**Acceptance:**
- Approve/request/comment open a `CommentBox` modal with appropriate review state
- Merge button gated on CI + required reviewers; confirmation dialog before merge
- Shortcuts `a` (approve), `r` (request), `c` (comment), `m` (merge) wired

---

### Phase 4 — Polish & speed

All tasks independent. Pick any order. Land: **~1 week across 2–3 agents**.

#### `P4.T4.a` — Motion kit
**Owns:** `src/app/lib/motion.tsx` (new).
**Depends on:** none.
**Acceptance:** exports `fadeIn`, `slideOver`, `listEnter` per §5.5; uses CSS transitions where possible, `@keyframes` in `index.css` for shared ones.

#### `P4.T4.b` — Prefetch-on-hover
**Owns:** a shared `<PrefetchLink />` wrapper in `src/app/components/PrefetchLink.tsx`; refactor in-tree `<Link>` usages in list components.
**Depends on:** none.
**Acceptance:** hovering a repo row / issue row / PR row for >50ms prefetches the target route's loaders via TanStack Router.

#### `P4.T4.c` — Optimistic mutations audit
**Scope:** every mutation hook gets optimistic update + rollback on error. Tracked list:
- `useCreateIssueComment`, `useUpdateIssueState`, `useAddIssueReaction`
- `useCreatePull*Comment`, `useSubmitPullReview`, `useMergePull`
**Owns:** `src/app/features/issues/hooks.ts`, `src/app/features/pulls/hooks.ts`.
**Depends on:** `P3.G5`.
**Acceptance:** after each mutation, UI updates within one frame before server confirmation; on 4xx/5xx, state rolls back + toast.

#### `P4.T4.d` — Visual language audit
**Scope:** grep-driven refactor enforcing §6 rules.
**Owns:** anywhere a rule is violated (agent lists files changed in summary).
**Depends on:** none (prefer to run last in P4 so earlier tasks' new code is covered).
**Acceptance:** `grep -rE 'text-\[(9|1[0-9])px\]|#[0-9a-fA-F]{3,8}' src/app/components src/app/routes` returns zero results.

---

### Phase 5 — Innovation bets (async)

Each bet is a standalone track. Pick up anytime after P3 lands. No deps between bets.

- **`P5.B1` — AI PR summary**: LLM-generated "what this changes" paragraph at the top of PR Overview. Cached per head-SHA. Feature-flagged behind `settings.ai`.
- **`P5.B2` — Unified Change route**: merge `/:o/:r/commit/:sha` and `/:o/:r/pulls/:n` into one `<ChangeView />` using the `Change` view-model from `P3.G6`.
- **`P5.B3` — Workspaces real impl**: CRUD workspaces, persist to IndexedDB, per-workspace notification filtering.
- **`P5.B4` — AST-level diff**: research spike. Difftastic-style structural diff for JS/TS/Rust. Behind a flag.
- **`P5.B5` — Offline mutation queue**: queue writes when offline, drain on reconnect with conflict resolution UX.

---

## 9. Agent brief template

When dispatching an agent for any task above, use this prompt structure:

```
You are implementing `<TASK_ID>` from plan.md. Read plan.md sections 1–7 and your task body in §8 before doing anything else.

## Your task
<Paste the task block verbatim — Scope, Owns, Depends on, Acceptance.>

## Rules
- Work in a worktree. Do not touch files outside your `Owns:` list.
- Follow the visual language rules in §6 and the color discipline memory.
- Read the feedback memory files under ~/.claude/projects/-home-end4-code-projects-githut/memory/ before writing code.
- `bun tsc --noEmit` must pass on exit.
- Do not invent new dependencies without adding them to the Owns list.

## Deliverable
A short report listing:
- Files created/modified
- Any new shared contracts exported
- Anything that went out of scope (stop and flag instead of doing it)
- How to verify acceptance (commands to run, routes to visit)
```

Dispatch with `Agent` tool, `isolation: "worktree"`, `run_in_background: true`. Wait for the completion notification before reviewing.

---

## 10. Non-goals / out of scope (this plan)

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

## 11. Decision log — things NOT to relitigate

1. **No global left sidebar.** Decided for main-content horizontal density. Revisit only if list-based surfaces come to dominate the app.
2. **Command palette is primary nav.** Decided; any "I want a menu" impulse should be a palette item instead.
3. **Top bar is a single row.** Resist the urge to split brand, context, and actions across two rows.
4. **Mono for eyebrows; sans for nav.** Font-family choice is tied to intent, not "looks cool."
5. **Fixed-weight active tabs.** Never toggle `font-weight` on interactive state (reflow).
6. **Tokens only, no hex.** Color discipline document is in `memory/feedback_color_discipline.md`.
7. **One type scale.** 9 tokens, documented in `index.css`. No ad-hoc `text-[Npx]`.
8. **Full-bleed gutter is `px-4 sm:px-6`.** Matches `Container`'s horizontal padding so full-bleed rows align with container content visually.
