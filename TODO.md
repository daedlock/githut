# GitHut — Product Roadmap

> What needs to happen to go from "impressive side project" to "product people pay for."

---

## Ship-ready strengths (keep, don't touch)

- [x] Repo browsing — file tree, blob view, README, language bar
- [x] PR list — filtering, search, sort, open/closed tabs
- [x] PR detail — conversation, commits, files changed, checks tabs
- [x] PR review mode — full-page zero-chrome diff viewer
- [x] Inline review — comment on lines, threads, resolve/unresolve
- [x] PR mutations — merge (3 strategies), approve, request changes, toggle draft, assign reviewers/labels
- [x] Issues — list, detail, create, comment, close/reopen, reactions
- [x] Commits — history, detail with full diff
- [x] GitHub Actions — workflow list, run detail, log viewer (CORS proxy), dispatch with inputs, rerun/cancel
- [x] Profiles — user/org, 4 layout variants, repos, members
- [x] Command palette — fuzzy search, recent items, actions
- [x] Keyboard shortcuts — global + contextual
- [x] Design system — 11 palettes, light/dark, surface-based hierarchy
- [x] ETag caching — 304s don't burn rate limit, instant cache-first nav
- [x] OAuth — HMAC-signed state, 10min TTL, token in browser only
- [x] Optimistic updates — all mutations snapshot + rollback

---

## Tier 0 — Must fix before anyone pays

### Paywall enforcement
- [ ] Proxy Pro-only API calls through Worker (notifications, cross-repo search, etc.)
- [ ] Store `github_user_id -> plan` in Cloudflare D1 or KV
- [ ] Worker middleware: check subscription on proxied requests, return 403 if not Pro
- [ ] Keep free-tier API calls direct (browser -> GitHub) for speed

### Subscription infrastructure
- [ ] Stripe integration — checkout, webhook for plan changes, customer portal
- [ ] Pricing page (can be part of landing page)
- [ ] Plan status shown in settings
- [ ] Grace period handling (failed payment -> 7 day grace -> downgrade)

### Landing page
- [ ] Single page: hero screenshot, 3 bullet points (fast / keyboard-first / beautiful), speed comparison GIF, pricing, GitHub OAuth button
- [ ] No login wall for public repos (viral loop: share a GitHut link, recipient sees the better UI)
- [ ] SEO basics: title, description, OG image

---

## Tier 1 — Makes it a daily driver (pre-launch)

### Notifications inbox (the #1 missing feature)
- [ ] `GET /notifications` polling (60s + jitter, pause on hidden tab)
- [ ] Cross-repo queries: `review-requested:@me`, `assignee:@me`, `mentions:@me`
- [ ] 4-section inbox: Awaiting your review / Mentioned / Assigned / Your PRs awaiting action
- [ ] Inbox pill in top bar with unread badge
- [ ] Mark as read / archive / snooze (local persistence)
- [ ] `j/k/Enter/e/s` keyboard nav
- [ ] **This is the Pro gate** — free users get a "recent activity" stub, Pro gets full inbox

### Edit existing content
- [ ] Edit own comments (issues + PRs)
- [ ] Edit issue title + description
- [ ] Edit PR title + description
- [ ] Delete own comments

### Quick social actions
- [ ] Star / unstar repos
- [ ] Watch / unwatch repos
- [ ] Fork repo (redirect to GitHub for the actual fork, then navigate back)

### Nav consolidation
- [ ] Pick ONE default nav variant (probably UnifiedNav)
- [ ] Remove the other 8 from production build
- [ ] Offer 2-3 as a Pro "nav style" perk in settings if you want

---

## Tier 2 — Competitive edge (post-launch, drives upgrades)

### Cross-repo search
- [ ] GitHub Search API integration in command palette (`code`, `issues`, `commits`)
- [ ] Scoped search: within current repo vs all repos
- [ ] Search results page with filters (language, repo, date)
- [ ] **Pro gate** — free: current repo only, Pro: cross-repo

### PR inbox zero
- [ ] "PRs needing my review" smart list across all repos
- [ ] "PRs I'm waiting on" (authored, pending review/CI)
- [ ] Review queue with keyboard-driven triage (approve/skip/snooze)
- [ ] Daily digest count in inbox pill
- [ ] **This is the killer Team tier feature**

### Branch browsing
- [ ] Branch switcher in code view (compact popover, not dropdown)
- [ ] Compare branches (select base/head, see diff)
- [ ] Branch list page with ahead/behind counts

### Enhanced diff
- [ ] Whitespace toggle (ignore whitespace in diff)
- [ ] File-level expand/collapse all
- [ ] Jump to next/prev comment in review mode
- [ ] Diff between arbitrary commits in PR (not just head vs base)

---

## Tier 3 — Moat features (months 2-6)

### Team tier
- [ ] Shared workspaces (team members see same pinned repos)
- [ ] Review assignment rules (round-robin, load-balanced)
- [ ] Team analytics: review turnaround time, cycle time, PR throughput
- [ ] Custom team themes/branding
- [ ] SSO/SAML (enterprise upsell)

### AI features
- [ ] LLM-generated PR summary ("what this changes" paragraph)
- [ ] AI-suggested reviewers based on file ownership
- [ ] Smart PR labels (auto-categorize: bug fix, feature, refactor, docs)
- [ ] Code explanation on hover (for unfamiliar codebases)

### PWA / installable app
- [ ] manifest.json + service worker
- [ ] Offline read mode (cached repos/PRs render normally)
- [ ] "Add to dock" prompt
- [ ] Push notifications for inbox items (via service worker)

### Performance
- [ ] Service worker cache for static assets
- [ ] IndexedDB query persister (survive page reload without refetch)
- [ ] Background sync for mutations made while offline
- [ ] Predictive prefetch (not just hover — prefetch based on navigation patterns)

---

## Tier 4 — Innovation bets (6+ months)

- [ ] AST-level structural diff (Difftastic-style for JS/TS/Rust)
- [ ] Unified "Change" view — commits and PRs share one layout
- [ ] Multi-repo PR dashboard (monorepo teams)
- [ ] GitHub Codespaces integration (open file in cloud editor from GitHut)
- [ ] VS Code extension (GitHut as a sidebar panel)
- [ ] Releases / tags browsing
- [ ] Gist viewer

---

## Pricing structure

| | Free | Pro $8/mo | Team $12/seat/mo |
|---|---|---|---|
| Public repo browsing | Unlimited | Unlimited | Unlimited |
| Private repos | 5 pinned | Unlimited | Unlimited |
| Notifications inbox | — | Full | Full + team routing |
| Cross-repo search | Current repo | All repos | All repos |
| PR inbox zero | — | Personal | Team-wide |
| Themes | 3 palettes | All 11+ | All + custom |
| Nav variants | Default | Choose | Choose |
| Review analytics | — | — | Full dashboard |
| API routing | Direct (fast) | Pro features via Worker | All via Worker |

---

## Go-to-market checklist

- [ ] Landing page live
- [ ] Stripe checkout working
- [ ] Public repo access without login (viral loop)
- [ ] Speed comparison GIF/video (GitHut vs GitHub side by side)
- [ ] Launch on Hacker News — "I built a faster GitHub UI"
- [ ] Post on r/programming, r/webdev, r/devtools
- [ ] Twitter/X thread with review mode screenshots
- [ ] Product Hunt launch (schedule for Tuesday morning)
- [ ] GitHub star the repo itself (if open-source) or keep closed-source

---

## Architecture decisions needed

1. **Open source or closed?** Open = community + trust + contributions. Closed = harder to clone, easier to monetize. Middle ground: open core (free tier open, Pro features closed).
2. **Proxy everything or selective?** Current: browser talks directly to GitHub. For monetization: proxy only Pro endpoints through Worker. Keeps free tier fast, enforces payment on premium features.
3. **Self-hostable?** If open-core, teams will want to self-host. Decide early — it shapes the Worker dependency.
4. **GitHub App vs OAuth App?** Currently OAuth. GitHub App would give webhook support (real-time updates instead of polling), finer permissions, and org-level install. Worth migrating before Team tier.
