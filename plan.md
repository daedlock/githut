# GitHut — Genesis to MVP Plan

> **Audience:** an engineering agent with no prior context on this project. Execute milestones in order. Do not skip acceptance criteria. When in doubt, re-read the relevant section rather than inventing.

---

## 1. Product Summary

GitHut is a drop-in replacement for github.com's web UI. GitHub's site is SSR-heavy and slow; GitHut is a client-rendered SPA that talks to GitHub's API directly, with aggressive caching and prefetching to feel instant.

**MVP scope (this plan):**
- Code browsing (repos, files, branches, commits, diffs)
- Issues (CRUD, reactions, comments, filters)
- PRs (CRUD, reactions, inline review comments, approve/request-changes)

**Explicitly out of MVP:**
- GitHub Actions (deferred to post-MVP)
- Writing code / editing files
- Notifications, Projects, Discussions, Wiki, Security tab

---

## 2. Locked Technical Decisions

Do **not** revisit these without explicit user approval.

| Area | Choice | Notes |
|---|---|---|
| Frontend framework | **Vite + React 19 + TypeScript** | Pure SPA. No Next.js. No SSR. |
| Routing | **TanStack Router** | Type-safe, file-based-ish routes |
| Server cache | **TanStack Query v5** | SWR, prefetch, optimistic updates |
| Client state | **Zustand** | Tiny slices, one store per concern. **Never** for server data. |
| URL state | **TanStack Router search params** | Filters, tabs, line ranges — shareable, history-aware |
| Styling | **Tailwind CSS v4** | CSS vars for theming via `@theme` |
| UI primitives | **Owned in `src/components/ui/`** | shadcn-style: we own the source. Variants via `cva`, classes via `cn` (clsx + tailwind-merge). Headless behavior from Radix only where needed (Dialog, DropdownMenu, Tooltip, Tabs, Popover). |
| Syntax highlighting | **Shiki** | `shiki` + web workers for large files |
| Markdown | **react-markdown** + `remark-gfm` | GitHub-flavored |
| Icons | **lucide-react** | Consistent, tree-shakeable |
| GitHub API | **GraphQL primary, REST fallback — called direct from browser** | `@octokit/graphql`, `@octokit/rest` hitting `api.github.com` directly. No server proxy. |
| Validation | **Zod** | Validate all external responses |
| Command palette | **cmdk** | Keyboard-first nav |
| Virtualization | **@tanstack/react-virtual** | File trees, long lists |
| Backend | **Minimal Cloudflare Worker** (Hono) | Only two jobs: (1) `/api/auth/callback` performs the OAuth `code → access_token` exchange (the one call that requires `client_secret` and doesn't allow browser CORS), (2) falls through to static SPA assets via the [Workers Assets binding](https://developers.cloudflare.com/workers/static-assets/). ~40 LOC. After login, the Worker is never hit again. |
| Storage | **None** | No KV, no DB. Token lives in the browser; server has nothing to persist. |
| Auth | **GitHub OAuth, browser-held token** | Worker swaps `code` for `access_token`, redirects to `/#token=…`. SPA reads the hash, clears it, stores token in `zustand/persist` → `localStorage`. All subsequent GitHub calls are direct from the browser. Same pattern as Pulldash / Octotree / `gh auth`. |
| Deploy | **Cloudflare Workers + Assets** | Single `wrangler deploy`. No Pages project. |
| Package manager | **Bun** | `bun install`, `bun run` |
| Project layout | **Single workspace** | `src/app/` (SPA), `src/worker/` (server), `src/shared/` (types + zod schemas). One `package.json`, one `tsconfig`, one Biome config. |
| Testing | `bun test` (unit), **Playwright** (e2e smoke) | |
| Lint/format | **Biome** | Single tool, no eslint/prettier split |

**Hard rules:**
- No SSR. No RSC. No `use server`. If you type those words, stop.
- No auth library (no NextAuth, no better-auth, no clerk). Hand-rolled OAuth — ~40 lines in the Worker.
- No ORM, no DB, **no KV**, no sessions table. The browser-held token IS the session.
- No server-side GitHub proxy. Browser talks to `api.github.com` directly. The Worker is on the critical path exactly once per login, then never again.
- No CSS-in-JS runtime. Tailwind only.
- **No UI library install** (no MUI, no Mantine, no Chakra, no shadcn CLI). Primitives are hand-rolled in `src/app/components/ui/` and we own them. Add a primitive only when the second usage appears.
- **Server data never enters Zustand.** TanStack Query owns it. Zustand is for cross-cutting client UI state only (including the auth token — it's a client-held credential, not server data).
- **No landing/marketing page.** `/` is the authed shell; unauthed users redirect to `/login` (single GitHub button).
- **Strict CSP.** `script-src 'self'`, no `unsafe-inline`, no `unsafe-eval`, `connect-src 'self' https://api.github.com https://avatars.githubusercontent.com`. Markdown rendering never allows HTML passthrough (`react-markdown` without `rehype-raw`). The token is in `localStorage`, so XSS = token exfiltration — minimize surface area.

---

## 3. Repo Layout

Single workspace. One `package.json`, one `tsconfig`, one `biome.json`, one `wrangler.toml`. The Worker serves both `/api/*` and falls through to the built SPA assets.

```
githut/
├── plan.md                 # this file
├── prd.md                  # product brief
├── CLAUDE.md               # Bun conventions
├── README.md
├── package.json
├── biome.json
├── tsconfig.json
├── vite.config.ts
├── wrangler.toml
├── index.html              # Vite entry
├── .env.example
└── src/
    ├── app/                # SPA (browser only)
    │   ├── main.tsx        # createRoot + RouterProvider
    │   ├── routes/         # TanStack Router routes
    │   │   ├── __root.tsx
    │   │   ├── index.tsx           # / — authed shell home
    │   │   ├── login.tsx           # /login — single GitHub button
    │   │   ├── $owner.tsx          # /:owner
    │   │   ├── $owner.$repo.tsx    # /:owner/:repo
    │   │   └── ...
    │   ├── components/
    │   │   ├── ui/         # owned primitives (Button, Dialog, Kbd, ...)
    │   │   └── ...         # domain components
    │   ├── features/       # feature-grouped: code/, issues/, pulls/
    │   ├── stores/         # Zustand: theme, toasts, command palette, kbd registry
    │   ├── lib/
    │   │   ├── github/     # Octokit clients bound with the stored token; query keys
    │   │   ├── cn.ts       # clsx + tailwind-merge
    │   │   ├── auth.ts     # token store integration, login(), logout(), bootstrap from #hash
    │   │   ├── keyboard.ts # shortcut registry
    │   │   └── cache.ts    # IDB persister for TanStack Query
    │   ├── hooks/
    │   ├── styles/
    │   │   └── index.css   # Tailwind v4 + @theme tokens
    │   └── types/
    ├── worker/             # Cloudflare Worker (server only — tiny)
    │   ├── index.ts        # Hono app: /api/auth/login, /api/auth/callback, /api/health, ASSETS fallback
    │   └── env.ts          # typed Env bindings (GITHUB_CLIENT_ID, GITHUB_CLIENT_SECRET, ASSETS)
    └── shared/             # imported by both app/ and worker/
        ├── types.ts
        └── schemas.ts      # zod schemas
```

**Boundary rule:** `src/app/*` must never import from `src/worker/*` and vice versa. Both may import from `src/shared/*`. Enforced by separate `tsconfig` `references` (or a Biome rule).

---

## 4. Prerequisites

Only two of these block deploy (M0 final checkpoint + M1). Local dev works without them — noted per item.

1. **Cloudflare account** with Workers enabled (free tier is enough). *Needed: M0 deploy checkpoint.*
2. **GitHub OAuth App** at https://github.com/settings/developers: *Needed: M1.*
   - Callback URLs: `https://<your-deploy-url>/api/auth/callback` and `http://localhost:5173/api/auth/callback` for dev.
   - Scopes requested at authorize time: `repo read:user read:org`.
   - Record **Client ID** and **Client Secret**.
3. **OAuth state signing secret**: `openssl rand -hex 32`. Used to sign the `state` param so the callback can verify the login was initiated by us (CSRF on login). *Needed: M1.* Not a session secret — we have no sessions.
4. **Toolchain**: `bun` ≥ 1.1, `wrangler` via `bunx` (no global install needed).

Secrets are set via `bunx wrangler secret put <NAME>` (never committed). Non-secret config (`GITHUB_CLIENT_ID`) lives in `[vars]` in `wrangler.toml` and is safe to commit.

**.env.example** (documentation only — dev reads from `.dev.vars` or shell env, prod from `wrangler secret`)
```
# Worker
GITHUB_CLIENT_ID=
GITHUB_CLIENT_SECRET=
OAUTH_STATE_SECRET=
APP_URL=http://localhost:5173
```

No `VITE_*` vars needed — the browser learns its own origin from `window.location`.

---

## 5. Milestones

Each milestone has: **Goal → Steps → Deliverables → Acceptance Criteria**. Do not mark a milestone done unless every acceptance box is checked.

---

### M0 — Foundation (Day 1–3)

**Goal:** a repo that builds, runs, deploys, and has the design system and developer ergonomics in place. No product features yet.

M0 is split into **five checkpoints**. At each checkpoint the agent stops, runs the app, and hands off to the user to verify in the browser. Don't begin the next checkpoint until the user confirms the current one.

**Dependency install (shared across checkpoints):**
```
bun add react react-dom \
  @tanstack/react-router @tanstack/react-query \
  @tanstack/react-query-persist-client @tanstack/query-sync-storage-persister \
  @tanstack/react-virtual idb-keyval \
  zustand cmdk lucide-react clsx tailwind-merge class-variance-authority \
  react-markdown remark-gfm shiki \
  @octokit/graphql @octokit/rest zod \
  @radix-ui/react-dialog \
  hono
bun add -d @types/react @types/react-dom @types/node \
  vite @vitejs/plugin-react @tailwindcss/vite tailwindcss \
  @tanstack/router-plugin @tanstack/router-devtools @tanstack/react-query-devtools \
  wrangler @cloudflare/workers-types \
  @biomejs/biome
```

---

#### Checkpoint M0-A — Bare app boots

**Build:**
1. Single `package.json` at repo root, `"type": "module"`, no workspaces.
2. Install deps (above).
3. `vite.config.ts` with `@vitejs/plugin-react`, `@tailwindcss/vite`, `@tanstack/router-plugin`. Dev proxy `/api → http://127.0.0.1:8787`. Path aliases `@/app`, `@/worker`, `@/shared`.
4. `index.html` at repo root (Vite entry), loads `/src/app/main.tsx`.
5. `src/app/main.tsx` — `createRoot` + `RouterProvider` with one placeholder route (`/`) rendering "GitHut".
6. `src/app/styles/index.css` with `@import "tailwindcss"` and a minimal `@theme` block (bg/fg/muted/border/accent).
7. `src/app/routes/__root.tsx` + `routes/index.tsx` + `routes/login.tsx`. `/login` is the single-button card (button is a plain `<button>` for now — primitives come in M0-B).
8. Biome config at root.
9. Scripts: `dev` (vite), `build` (vite build), `check` (biome), `format`.

**Pause and test:**
- Run `bun dev`.
- Open http://localhost:5173 — blank page with "GitHut" text, no console errors.
- Open http://localhost:5173/login — single-button card visible.
- `bun run check` passes.
- User confirms visually → proceed.

---

#### Checkpoint M0-B — Theme + UI primitives

**Build:**
1. `src/app/lib/cn.ts` — `clsx` + `tailwind-merge`.
2. Expand `index.css` `@theme` + `.dark` override with a production palette (bg, bg-subtle, fg, fg-muted, border, border-strong, accent, accent-fg, danger).
3. `src/app/stores/theme.ts` — Zustand store `{ theme: 'light'|'dark'|'system', setTheme, resolved }`, `persist` middleware → `localStorage`. On change (and on bootstrap), toggle `.dark` on `<html>`. Resolves `'system'` via `matchMedia('(prefers-color-scheme: dark)')` + listener.
4. UI primitives in `src/app/components/ui/` — only: `Button` (variants via cva: primary/secondary/ghost, sizes sm/md), `Input`, `Kbd`. Each uses `cn()`. One-paragraph `components/ui/README.md` documenting the "own it, add on second use, `cn` + `cva` only" rule.
5. `src/app/components/ThemeToggle.tsx` — uses the `Button` primitive + `lucide-react` icons; cycles light → dark → system.
6. Put the `ThemeToggle` in the `/login` card and a tiny dev-only `/playground` route that shows each primitive variant (gated behind `import.meta.env.DEV`).

**Pause and test:**
- `bun dev`, visit `/login` — toggle theme; reload; toggle persists.
- Visit `/playground` — all Button variants + Input + Kbd render correctly in both themes.
- No raw hex in any component (`grep` for `#` outside `styles/`).
- User confirms → proceed.

---

#### Checkpoint M0-C — Router + Query + keyboard + command palette

**Build:**
1. Add `src/app/lib/cache.ts` — `idb-keyval` persister for TanStack Query.
2. `QueryClient` (staleTime 30s, gcTime 24h) with `PersistQueryClientProvider`. Devtools in dev only.
3. `src/app/lib/keyboard.ts` — registry: single keys, chords, combos, scopes. Single global `keydown` listener. `useShortcut({ keys, scope, handler, description })` hook. Skips when focus is in an input/textarea/contentEditable (unless `allowInInput`).
4. `src/app/stores/commandPalette.ts` — `{ open, setOpen }`.
5. `Dialog` primitive wrapping `@radix-ui/react-dialog` (owned in `components/ui/Dialog.tsx`). Adds keyboard-registry awareness (close on Esc is native; logs registration so `?` help can list "Esc — close dialog").
6. `src/app/components/CommandPalette.tsx` — `cmdk` inside `Dialog`. `Cmd/Ctrl+K` opens via shortcut registry. Empty state: "Nothing here yet — commands arrive in M1."
7. `src/app/components/ShortcutHelp.tsx` — Dialog listing all registered shortcuts (pulled from registry, no hardcoded list). Opens on `?`.
8. Register core shortcuts at app root: `mod+k`, `?`.

**Pause and test:**
- Reload `/` — `Cmd/Ctrl+K` opens palette, Esc closes it.
- `?` opens shortcut help listing `Cmd+K` and `?` at minimum.
- Typing in an input doesn't trigger `?`.
- No console errors.
- User confirms → proceed.

---

#### Checkpoint M0-D — Worker serves `/api/health` locally

**Build:**
1. `wrangler.toml`:
   - `main = "src/worker/index.ts"`
   - `compatibility_date = "<today>"`
   - `[assets]` → `directory = "./dist"`, `binding = "ASSETS"`, `not_found_handling = "single-page-application"`
   - No KV. No secrets yet (M1 adds them).
2. `src/worker/env.ts` — `type Env = { ASSETS: Fetcher }` (expanded in M1).
3. `src/worker/index.ts` — Hono app. Routes:
   - `GET /api/health → { ok: true, time: Date.now() }`
   - `* → env.ASSETS.fetch(request)` (fallback).
4. `src/shared/types.ts` — placeholder `export {};`.
5. `package.json` `dev` script runs Vite **and** `wrangler dev --port 8787` concurrently. Small `scripts/dev.ts` using `Bun.spawn` to run both and forward output (avoid adding `concurrently` dep).

**Pause and test:**
- `bun dev` boots both processes.
- http://localhost:5173/api/health returns `{"ok":true,"time":...}` (proxied through Vite to Worker).
- http://localhost:8787/api/health returns the same (Worker direct).
- SPA still works at http://localhost:5173.
- User confirms → proceed.

---

#### Checkpoint M0-E — First production deploy

**User-blocked prereqs** (agent flags and waits if missing):
- Cloudflare account + `bunx wrangler login` done.

**Build:**
1. `bun run build` produces `dist/`.
2. `bunx wrangler deploy` ships the Worker + assets. Record the `*.workers.dev` URL.
3. Agent does not register the GitHub OAuth app yet — that's M1's prereq.
4. Basic CI at `.github/workflows/ci.yml`: `bun install --frozen-lockfile && bun run check && bun run build`.

**Pause and test:**
- Visit the deployed URL — `/` and `/login` render, theme toggle persists.
- Visit `<deploy>/api/health` — returns JSON.
- Lighthouse (desktop, cold cache) on `/`: performance ≥ 90, a11y ≥ 95.
- User confirms → M0 complete.

---

**M0 Exit Criteria (all checkpoints green):**
- [ ] `bun run build` and `bun run check` pass.
- [ ] Light/dark/system theme persists.
- [ ] `Cmd/Ctrl+K` and `?` work; `?` help is data-driven from the registry.
- [ ] `src/app/*` never imports `src/worker/*` and vice versa.
- [ ] Deployed URL serves both SPA and `/api/health`.
- [ ] Lighthouse a11y ≥ 95 on the shell.

---

### M1 — OAuth + browser-held token (Day 4–6)

**Goal:** user signs in with GitHub; browser stores the access token; the app makes an authenticated call direct to `api.github.com`; avatar appears in the shell. After login the Worker is never hit again.

Split into **three checkpoints**.

**User-blocked prereqs (agent pauses if missing):**
- GitHub OAuth App created. Callback URLs set to `http://localhost:5173/api/auth/callback` (dev) and `<deploy>/api/auth/callback` (prod). Scopes selected at authorize time: `repo read:user read:org`.
- Client ID: added to `wrangler.toml` `[vars]`.
- Client Secret: `bunx wrangler secret put GITHUB_CLIENT_SECRET`.
- State signing secret: `bunx wrangler secret put OAUTH_STATE_SECRET` (from `openssl rand -hex 32`).
- For local dev: same values in `.dev.vars` (gitignored).

---

#### Checkpoint M1-A — Worker OAuth flow (code → token → hash redirect)

**Build:**
1. `src/worker/env.ts` — extend: `{ ASSETS, GITHUB_CLIENT_ID, GITHUB_CLIENT_SECRET, OAUTH_STATE_SECRET, APP_URL }`.
2. `src/worker/index.ts`:
   - `GET /api/auth/login`: generate random 16-byte `nonce`, sign with HMAC-SHA256 using `OAUTH_STATE_SECRET` → `state = base64url(nonce) + "." + base64url(sig)`. Redirect to `https://github.com/login/oauth/authorize?client_id=...&scope=repo%20read:user%20read:org&state=<state>&redirect_uri=<APP_URL>/api/auth/callback`.
   - `GET /api/auth/callback`: verify `state` HMAC (constant-time). POST to `https://github.com/login/oauth/access_token` with `{ client_id, client_secret, code }`, `Accept: application/json`. On success, redirect `302` to `/#t=<token>` (token only in URL fragment, which is never sent to the server by the browser). On failure, redirect to `/login?error=<reason>`.
3. **No cookies set anywhere.** No KV. No session storage.

**Pause and test:**
- `bun dev`. Visit `/api/auth/login` — redirected to GitHub.
- Approve app → redirected back to `/#t=<token>`.
- Hash contains a `gho_...` token. Console has no errors.
- User confirms → proceed.

---

#### Checkpoint M1-B — Browser stores token, makes an authenticated call

**Build:**
1. `src/app/stores/auth.ts` — Zustand store `{ token: string | null, setToken, clear }`, `persist` middleware → `localStorage` key `githut.auth`.
2. `src/app/lib/auth.ts`:
   - `bootstrapAuthFromHash()` — called once from `main.tsx` *before* React renders. If `location.hash` starts with `#t=`, extract token, call `setToken`, then `history.replaceState(null, '', location.pathname + location.search)` to clear the hash.
   - `login()` → `location.href = '/api/auth/login'`.
   - `logout()` → `clear()`, `queryClient.clear()`, navigate to `/login`.
3. `src/app/lib/github/client.ts` — factory that builds Octokit REST + GraphQL clients bound with the current token from the auth store. Re-creates on token change.
4. `src/app/hooks/useMe.ts` — `useQuery({ queryKey: ['me'], queryFn: () => octokit.rest.users.getAuthenticated(), enabled: !!token, staleTime: 5*60*1000 })`.
5. `/login` route: if token already present, redirect to `/`. Else show the "Sign in with GitHub" button wired to `login()`.
6. `/` route: if no token, redirect to `/login`. Else show "Hi, @${me.login}" with avatar.
7. Shell chrome in `__root.tsx`: top bar with wordmark, `ThemeToggle`, avatar + `Sign out` (wired to `logout()`).

**Pause and test:**
- Start fresh: clear localStorage. Visit `/` → redirected to `/login`.
- Click "Sign in with GitHub" → OAuth → land on `/` with your avatar and handle visible.
- Network tab: the `/user` call goes direct to `https://api.github.com/user` (not through our Worker).
- Reload page — still logged in.
- Click "Sign out" → back to `/login`, localStorage cleared.
- Open a new tab to the same origin — still signed in (persist + storage event sync).
- User confirms → proceed.

---

#### Checkpoint M1-C — CSP, rate-limit banner, cross-tab sync, prod deploy

**Build:**
1. **CSP** — worker sends `Content-Security-Policy` header on HTML responses (intercept the ASSETS fetch for `text/html`): `default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' https://avatars.githubusercontent.com https://*.githubusercontent.com data:; connect-src 'self' https://api.github.com; frame-ancestors 'none'; base-uri 'self'`.
2. **Rate-limit banner** — Octokit hook to read `x-ratelimit-remaining` / `x-ratelimit-reset` from responses; if remaining < 50, show a `Badge` in the shell footer with reset countdown. At 0, mutations disabled with tooltip.
3. **401 handler** — if any GitHub call returns 401, clear the token and navigate to `/login?reason=expired`.
4. **Cross-tab logout sync** — Zustand `persist` uses `storage` events; ensure logout propagates (verify manually).
5. **Deploy** — `bun run deploy`. Update GitHub OAuth app with production callback URL.

**Pause and test:**
- Deployed site: full login → shell → logout round-trip works.
- DevTools → Security → CSP: no violations.
- Revoke your own OAuth token at github.com/settings/applications in another tab; trigger a call in the app → you get bounced to `/login?reason=expired`.
- Open the site in two tabs, sign out in one → the other goes to `/login` within a second or two.
- User confirms → M1 complete.

---

**M1 Exit Criteria:**
- [ ] OAuth state param verified with HMAC (constant-time).
- [ ] `client_secret` never appears in the browser bundle (`grep` `dist/`).
- [ ] After login, no request to the Worker is made for any GitHub API call (Network tab).
- [ ] Token lives only in `localStorage` under `githut.auth` — not in cookies, not in response bodies outside the hash redirect.
- [ ] CSP is active and there are zero violations on the happy path.
- [ ] 401 from GitHub → auto-logout + `/login` redirect.

---

### M2 — Code Browsing (Day 7–13)

**Goal:** sign in, navigate to any repo you have access to, browse files, branches, commits, and diffs. This is the largest milestone — split into sub-milestones.

#### M2.1 — Repo shell & home

**Routes:**
- `/:owner` — user/org overview: avatar, bio, pinned repos, repo list with filter.
- `/:owner/:repo` — repo home: README rendered, file tree at repo root, quick stats (stars, watchers, default branch, latest commit).

**Steps:**

1. GraphQL query `RepoHome`: owner info + repo metadata + default branch + latest commit on default branch + README blob + root tree entries.
2. Render README via `react-markdown` + `remark-gfm`, with code blocks highlighted via Shiki (async boundary with Suspense).
3. File tree (flat at this stage): list of entries with type icons (folder/file), clickable.
4. Stats sidebar (right column on ≥1024px, collapsed on mobile).

**Acceptance:**
- [ ] Loading `/:owner/:repo` shows README + tree in <500ms on warm cache.
- [ ] Navigating back/forward preserves scroll position.

#### M2.2 — File tree & file viewer

**Routes:**
- `/:owner/:repo/tree/:branch/*path` — browse a directory
- `/:owner/:repo/blob/:branch/*path` — view a file

**Steps:**

1. Tree view: use REST `GET /repos/{o}/{r}/git/trees/{sha}?recursive=0`. Load one level at a time. Virtualize with `@tanstack/react-virtual` when >100 entries.
2. Breadcrumb at top of tree/file views.
3. File viewer:
   - Binary detection (Content-Type or extension list): show "Binary file, X KB, [Download raw]" instead of contents.
   - Images: render inline.
   - Text: fetch raw blob, Shiki highlight, show line numbers, permalink on line click (`#L42`, shift-click for range `L42-L60`).
   - Large files (>500KB): warn + "Load anyway" button.
4. Syntax theme matches app theme (Shiki `github-light` / `github-dark`).
5. Copy path button, Copy content button, Raw link.
6. Keyboard: `y` copies permalink with commit SHA (GitHub parity).

**Acceptance:**
- [ ] Directories with 10k+ files don't jank (virtualized).
- [ ] File >1MB shows warning before loading.
- [ ] Line ranges in URL (`#L10-L20`) highlight and scroll into view on load.

#### M2.3 — Branch/tag switcher

**Steps:**

1. Dropdown in repo header: Branches tab + Tags tab, search filter.
2. Switching branch updates URL in place; caches per-branch.
3. "Default branch" badge on the default.

**Acceptance:**
- [ ] Switching branches updates file tree and commit history without full page reload.

#### M2.4 — Commits list + detail

**Routes:**
- `/:owner/:repo/commits/:branch` — list
- `/:owner/:repo/commit/:sha` — detail

**Steps:**

1. Commits list: paginated (30 per page), grouped by day, showing author avatar, message, SHA (short), relative time.
2. Commit detail: author info, full message, parents, files changed (summary: N files, +X −Y), diff for each file.
3. Diff renderer (`features/diff/`):
   - Parse unified diff from GitHub API (`patch` field per file).
   - Support unified + split view toggle.
   - Line numbers for old and new.
   - Expand context (10-line chunks) via ranged blob fetch.
   - Syntax-highlight via Shiki using the file's language.
   - Collapse/expand per-file.
4. Keyboard: `j/k` next/previous file in diff; `[`/`]` prev/next commit.

**Acceptance:**
- [ ] Diffs with 100+ files render progressively (don't block on all of them).
- [ ] Split view aligns old/new line numbers correctly on hunks with adds and deletes.
- [ ] Binary files show "Binary file not shown" (no crash).

---

### M3 — Issues (Day 14–17)

**Routes:**
- `/:owner/:repo/issues` — list
- `/:owner/:repo/issues/new` — create
- `/:owner/:repo/issues/:number` — detail

**Steps:**

1. **List:**
   - Tabs: Open / Closed.
   - Filters: labels (multi), assignee, author, milestone, sort (newest/oldest/most-commented).
   - Search bar (uses GitHub's issue search syntax; pass through as-is to `q=`).
   - Row: title, number, labels, opened N ago by @user, N comments, assignee avatars.
   - Pagination: infinite scroll via TanStack Query's `useInfiniteQuery`.
2. **Detail:**
   - Header: title (editable by author/maintainer), #number, open/closed state badge.
   - Body: markdown rendered with GFM. Author avatar + timestamp.
   - Comments timeline: mix of `IssueComment`, `LabeledEvent`, `AssignedEvent`, `ClosedEvent`, `ReopenedEvent`, `ReferencedEvent`. Render each with a consistent timeline skeleton.
   - Reactions: 👍 👎 😄 🎉 😕 ❤️ 🚀 👀 — optimistic toggle via GraphQL `addReaction` / `removeReaction`.
   - Right sidebar: Assignees, Labels, Projects (skip), Milestone, Linked PRs.
   - New comment box with tabs (Write/Preview), markdown toolbar, drag-drop image upload (POST to GitHub via REST).
3. **Create issue:** title + body + labels + assignees. Submit via GraphQL `createIssue`.
4. **Mutations** (all optimistic with rollback on error):
   - Add/edit/delete comment
   - Close/reopen
   - Toggle reaction
   - Assign/unassign
   - Add/remove label
5. **Keyboard:** `c` new issue (on list), `e` edit (on your own comment/body), `cmd+enter` submit comment.

**Acceptance:**
- [ ] List filters composable and reflected in URL query params.
- [ ] Reactions toggle instantly (optimistic), correct count on rollback.
- [ ] Long issues (200+ comments) virtualize and stay 60fps on scroll.
- [ ] Markdown preview matches GitHub rendering for: fenced code, tables, task lists, strikethrough, @mentions, #issue refs, commit SHAs.

---

### M4 — Pull Requests (Day 18–24)

**Routes:**
- `/:owner/:repo/pulls` — list
- `/:owner/:repo/pull/:number` — detail with tabs
- `/:owner/:repo/pull/:number/files` — Files Changed
- `/:owner/:repo/pull/:number/commits` — Commits
- `/:owner/:repo/pull/:number/checks` — Checks (read-only; links to GitHub Actions UI for now)

**Steps:**

1. **List:** same pattern as issues, with extra filter: draft / ready for review / has reviews.
2. **Detail — Conversation tab:** reuses issue detail components + PR-specific events (Commit, ReviewRequested, Review, HeadRefForcePushed, Merged, Closed).
3. **Detail — Commits tab:** list of commits with short stats and links to commit detail.
4. **Detail — Files Changed tab:**
   - Reuse diff renderer from M2.4.
   - Inline comment threads attached to a specific line (old or new).
   - "Add a comment" ghost button appears on line hover; opens a thread input.
   - Threads render inside the diff between hunks.
   - "Start a review" → queue comments → "Submit review" with radio: Comment / Approve / Request changes + summary text.
   - Sidebar: file tree of changed files with +/- counts; click jumps to file.
   - "Viewed" checkbox per file (collapses it, local state, not synced).
5. **Detail — Checks tab:** list check runs + statuses. No log viewing in MVP (Actions is post-MVP).
6. **Merge panel** (bottom of Conversation tab when mergeable):
   - Merge / Squash and merge / Rebase and merge dropdown.
   - Custom merge commit title/message.
   - Disabled with tooltip explaining why when not mergeable (conflicts / failing checks / unapproved).
7. **Mutations:**
   - Create PR (minimal — from branch compare page linked from branch switcher)
   - Comment, review comment, submit review
   - Request reviewers, assign, label, milestone
   - Close / reopen / merge / mark-ready / convert-to-draft
8. **Keyboard:** `g f` jump to Files Changed, `g c` Conversation, `g x` Commits, `.` toggle file viewed.

**Acceptance:**
- [ ] Review flow (queue comments → submit) matches GitHub's semantics exactly.
- [ ] Inline comment position survives rebases (use the new `position` + `line` + `side` semantics from the v4 API).
- [ ] PR with 500 changed files paginates the file list but renders the selected file immediately.
- [ ] Mergeability UI reflects real-time state (poll every 10s on detail page).

---

### M5 — Polish, Perf, Launch (Day 25–28)

**Steps:**

1. **Perf audit:**
   - Lighthouse run on: repo home, file viewer (1000-line file), issue list, PR detail with 50 files.
   - Targets: LCP <1.5s cold / <500ms warm, TBT <200ms, CLS <0.05.
   - Investigate any violations; likely culprits: Shiki bundle size (code-split languages), unoptimized avatars (proxy through Worker with `cf-image-resize`).
2. **Bundle audit:** `bunx vite-bundle-visualizer`. Split Shiki and Markdown renderer into async chunks.
3. **A11y audit:**
   - Keyboard-navigable: every interactive element reachable via Tab; focus ring visible.
   - Screen reader: all icons have `aria-label`, live regions for toasts.
   - Color contrast AA on both themes.
4. **Error handling:**
   - Global error boundary with reload button.
   - Per-route error boundaries for degraded-but-usable failure modes.
   - Network-offline banner.
5. **Empty states:** every list has a designed empty state (no repos, no issues, etc.).
6. **Onboarding:** first-login modal: "Press Cmd+K to navigate anywhere. Press ? for shortcuts." Dismissible, one-time.
7. **Analytics:** Cloudflare Web Analytics (privacy-preserving, no consent banner needed). No other tracking.
8. **Rate limit visibility:** small badge in footer showing remaining GitHub API quota, tooltip with reset time.
9. **Domain + deploy:** point production domain, confirm OAuth callback URL, enable WAF rules, deploy.
10. **Smoke tests** (Playwright):
    - Login → repo home → view file → open issue → comment → open PR → leave review.
    - Runs on CI against preview deploys.

**Acceptance Criteria (launch gate):**
- [ ] All prior milestone acceptance boxes checked.
- [ ] Lighthouse perf ≥ 90, a11y ≥ 95, best practices ≥ 95 on the 4 key pages.
- [ ] Playwright smoke passes on a real GitHub test account against the preview deploy.
- [ ] No console errors on any happy path.
- [ ] Sentry (or equivalent) wired; zero unhandled errors over a 24h soak.
- [ ] README updated with setup + deploy instructions.

---

## 6. Cross-Cutting Concerns

### 6.1 Caching strategy (three layers)

1. **In-memory (TanStack Query):** 30s `staleTime` default, 24h `gcTime`. Override per-query.
2. **IndexedDB (persistQueryClient):** survives reloads. Max age 24h. Key: query hash.
3. **Edge (Cloudflare Cache API):** per-user, short TTL, ETag-aware. Invalidated on mutations via `cf-cache-tag`.

**Invalidation rules:**
- Any mutation calls `queryClient.invalidateQueries(['gh', owner, repo, ...])` scoped to the affected repo.
- Worker mutations purge edge cache tags for the affected resource.

### 6.2 Prefetch policy

- **Hover on a link** → `queryClient.prefetchQuery()` for that route's primary query. Debounced 100ms.
- **Viewport prefetch** (IntersectionObserver) for top 5 items in a list.
- **Route preload:** TanStack Router `preload: 'intent'`.

### 6.3 Error taxonomy

| Category | UX |
|---|---|
| 401 (session expired) | Silent redirect to `/login?redirect=...` |
| 403 rate limit | Global banner + disable mutations |
| 403 scope / permission | Inline: "You need `repo` scope. Re-authenticate." |
| 404 | Dedicated not-found page with helpful suggestions |
| 5xx | Toast + retry button; keep cached data visible |
| Offline | Banner; queries serve from IDB; mutations queue |

### 6.4 Keyboard shortcuts (MVP set)

| Key | Action | Scope |
|---|---|---|
| `Cmd/Ctrl+K` | Command palette | Global |
| `?` | Shortcut help | Global |
| `g h` | Go home | Global |
| `g i` | Go to issues | Repo |
| `g p` | Go to PRs | Repo |
| `g c` | Go to code | Repo |
| `t` | Focus file finder | Code view |
| `y` | Copy permalink with SHA | File view |
| `c` | New issue / PR | List view |
| `e` | Edit | Own comment |
| `j`/`k` | Next/prev | Lists, diffs |
| `[`/`]` | Prev/next commit | Commit/PR |
| `.` | Toggle file viewed | PR files |

### 6.5 Type generation

- Run GraphQL Codegen in CI against a pinned schema snapshot (`shared/schema.graphql`, updated monthly).
- REST types from `@octokit/openapi-types`.
- All API responses validated with Zod at the boundary.

### 6.6 Testing strategy

- **Unit (`bun test`):** pure utilities, diff parser, keyboard registry, cookie signing.
- **Component tests:** skipped for MVP — cost/value poor at this stage.
- **E2E (Playwright):** one smoke test covering the happy path end-to-end, against a dedicated GitHub test account.
- **Manual QA checklist** in `web/docs/qa.md` run before each deploy.

### 6.7 Security

Threat model is "public-client SPA with browser-held OAuth token" — the same model as `gh auth`, Octotree, and Pulldash.

- **OAuth state HMAC** verification on login callback (constant-time compare).
- **Token transport** — only ever delivered via URL fragment (`/#t=...`), which browsers never send to the server. App reads it and immediately clears the hash with `history.replaceState`.
- **Token at rest** — `localStorage` under `githut.auth` (so it survives reload and syncs across tabs). Not a cookie. Not accessible to the Worker.
- **Token in flight** — only to `https://api.github.com` via `Authorization: Bearer`. Enforced by CSP `connect-src`.
- **CSP** (sent from the Worker on HTML responses):
  `default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' https://avatars.githubusercontent.com https://*.githubusercontent.com data:; connect-src 'self' https://api.github.com; frame-ancestors 'none'; base-uri 'self'`.
  No `unsafe-inline`/`unsafe-eval` for scripts. Shiki highlight runs as app code, not inline.
- **Markdown** — `react-markdown` with `remark-gfm` but **without** `rehype-raw`. Issue/PR bodies and READMEs from GitHub are never trusted as HTML.
- **Dep surface** — deliberately small and mainstream. Renovate (or Dependabot) enabled post-launch. Avoid pulling packages with wide transitive trees.
- **No third-party scripts.** No analytics until §M5 Cloudflare Web Analytics (first-party).
- **401 from GitHub** → clear token and redirect to `/login?reason=expired`.
- **Secrets** — `GITHUB_CLIENT_SECRET`, `OAUTH_STATE_SECRET` via `wrangler secret put`. Never committed.
- **User revocation** — documented in README: users can revoke the token at https://github.com/settings/applications at any time.

### 6.8 Design system notes

- Spacing scale: Tailwind defaults, nothing custom.
- Typography: system font stack. Monospace: `ui-monospace, SFMono-Regular, Menlo, Consolas, monospace`.
- Border radius: `rounded-md` (6px) default, `rounded-lg` (8px) for cards, `rounded-full` for avatars/pills.
- Shadows: almost none. Use border + subtle bg shift instead. One shadow allowed for modals (`shadow-2xl`).
- Motion: 150ms ease-out for most transitions. Respect `prefers-reduced-motion`.
- Density: comfortable, not cramped. Assume 1440px+ primary; responsive to 768px.

---

## 7. Execution Rules for the Agent

1. **Work milestone-by-milestone.** Do not start M2 until every M0 + M1 box is checked.
2. **Commit small.** One commit per meaningful step. Commit messages: `M2.2: add Shiki highlighter for file viewer`.
3. **Ask the user** before: adding a dependency not listed here, changing a locked decision, skipping an acceptance box.
4. **Don't invent features.** If something isn't in this plan and isn't in `prd.md`, it's out of scope.
5. **When blocked,** write your question + what you've tried into a comment on the relevant milestone in this file, then ask the user.
6. **Keep this plan updated.** If a decision changes (with user approval), update section 2. If a milestone's scope changes, update it in place with a dated note.
7. **Never skip CI.** If CI fails, fix it before moving on.
8. **Never push directly to `main`** unless the user says so. Use feature branches + PRs (yes, we'll dogfood via github.com until M4 lands).

---

## 8. Open Questions (flag to user before they block you)

- [ ] Custom domain: what should we register? Placeholder: `githut.dev`.
- [ ] Logo/wordmark: text-only for MVP, or do we want a mark? Placeholder: text "GitHut" in Inter Bold.
- [ ] Test GitHub account for Playwright: user to create and provide credentials via Cloudflare secret `E2E_TEST_TOKEN`.
- [ ] Billing account on Cloudflare: confirmed? KV + Pages free tier should cover initial launch.
- [ ] Analytics: Cloudflare Web Analytics OK? Or skip entirely?

---

## 9. Post-MVP Backlog (do not work on until MVP is shipped)

- GitHub Actions: workflows, runs, live log streaming (SSE from Worker polling GitHub logs).
- Notifications inbox.
- Repo settings (collaborators, branches, webhooks).
- Projects v2.
- Discussions.
- Wiki.
- Search across all repos (global).
- Gists.
- Mobile PWA polish.
- File editing (in-browser with Monaco).
- Offline-first (queue mutations while offline).
