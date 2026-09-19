# GitHut

**GitHub's UI, rebuilt for speed.**

[![GitHub stars](https://img.shields.io/github/stars/daedlock/githut?style=social)](https://github.com/daedlock/githut)
[![License](https://img.shields.io/github/license/daedlock/githut)](LICENSE)
[![Issues](https://img.shields.io/github/issues/daedlock/githut)](https://github.com/daedlock/githut/issues)

---

**[→ Try GitHut Live](https://githut.app)** *(connects to your GitHub)*

---

## The Problem

GitHub's UI is server-side rendered. Every click waits for a server roundtrip. For developers who live in the repo browser, issues, and PRs — that slowness adds up.

## The Solution

GitHut is a client-side GitHub UI:
- **Instant navigation** — No page reloads, no waiting
- **Full GitHub integration** — OAuth login, real data from GitHub API
- **World-class UX** — Clean, stays out of your way, dark/light modes

```
GitHub:  Click → Wait 800ms → Render
GitHut:  Click → Render (instant)
```

## Features

| Feature | Status |
|---------|--------|
| Code browsing | ✅ |
| Commit & branch browsing | ✅ |
| Issues (CRUD + reactions) | ✅ |
| Comment videos with playback, seeking, and fullscreen | ✅ |
| Pull requests (CRUD + code review) | ✅ |
| Collapsible issue and PR groups | ✅ |
| GitHub Actions | 🚧 In progress |
| Syntax highlighting (Shiki) | ✅ |
| Diff viewer | ✅ |
| Virtual scrolling (large repos) | ✅ |

### Group issues and pull requests

Open **Display → Grouping** to group a list by status, assignee, author, label, or
milestone. Choose **No grouping** to return to a flat list. PR ordering is also
available under **Display → Ordering**.

Click a group header to collapse or expand it. **Alt-click** toggles all groups;
the Display menu also has **Expand all groups** and **Collapse all groups**.
Press **Shift V** to open Display, or **T** over a group to toggle it (**Alt T**
toggles all). Focused headers also support the left/right arrow keys, and **J/K**
navigation skips collapsed rows.

Grouping and collapsed sections are saved separately for each repository's issues
and PRs. Filters and search apply before grouping, and counts reflect the loaded,
matching items. Items with multiple labels or assignees appear in each matching
group. Stacked PRs remain nested when they share a group.

### Choose a page width

In **Settings → Workspace → Container width**, choose **Small** (896px),
**Medium** (1280px, the default), **Large** (1536px), or **Full width**. The header
and page content share the same bounds. Changes apply immediately and stay in
this browser. Repository names and owners truncate when space is limited; hover
or focus their header links to read the full text.

## Quick Start

### Use it

Just connect your GitHub account at **[githut.app](https://githut.app)** — no installation needed.

### Run locally

```bash
git clone https://github.com/daedlock/githut.git
cd githut
bun install
bun run dev
```

## Deployment

Production is deployed from GitHub. Every commit merged to `main` runs the
[`Deploy production`](https://github.com/daedlock/githut/actions/workflows/deploy.yml)
workflow, which typechecks, builds, and deploys the exact commit to Cloudflare.

For routine releases, merge a pull request instead of running `bun run deploy`
locally. The manual workflow trigger is the break-glass path for redeploying a
commit that is already on `main`.

## Tech Stack

- **React 19** + **TanStack Router & Query**
- **Tailwind CSS 4** + **shadcn/ui**
- **Shiki** for syntax highlighting
- **Cloudflare Workers** for edge deployment
- **Octokit** for GitHub API

## Contributing

GitHut is open source and contributor-friendly.

1. Check [Good First Issues](https://github.com/daedlock/githut/issues?q=is%3Aissue+is%3Aopen+label%3A%22good+first+issue%22)
2. Read the [Contributing Guide](CONTRIBUTING.md)
3. Join the discussion in [GitHub Discussions](https://github.com/daedlock/githut/discussions)

## Roadmap

See [plan.md](plan.md) for the full roadmap and current progress.

## License

[MIT](LICENSE)

---

<p align="center">
  <b>Star ⭐ the repo if you find it useful</b>
</p>
