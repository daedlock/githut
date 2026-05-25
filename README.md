# GitHut

<p align="center">
  <img src="logo.svg" alt="GitHut" width="88" height="88" />
</p>

<p align="center">
  <strong>A fast, keyboard-friendly GitHub client for people who live in repositories.</strong>
</p>

<p align="center">
  <a href="https://githut.app"><strong>Try GitHut</strong></a>
  ·
  <a href="CONTRIBUTING.md">Contribute</a>
  ·
  <a href="https://github.com/daedlock/githut/issues">Issues</a>
  ·
  <a href="plan.md">Roadmap</a>
</p>

<p align="center">
  <a href="https://github.com/daedlock/githut/actions/workflows/ci.yml"><img alt="CI" src="https://img.shields.io/github/actions/workflow/status/daedlock/githut/ci.yml?branch=main&label=ci"></a>
  <a href="LICENSE"><img alt="License" src="https://img.shields.io/github/license/daedlock/githut"></a>
  <a href="https://github.com/daedlock/githut/stargazers"><img alt="GitHub stars" src="https://img.shields.io/github/stars/daedlock/githut?style=social"></a>
</p>

---

GitHut is a client-side GitHub interface focused on speed, review flow, and repository navigation. It uses GitHub's APIs directly, keeps navigation instant, and gives common repo/issue/PR workflows a modern application feel.

> GitHut is independent open-source software and is not affiliated with GitHub, Inc.

## Why GitHut?

GitHub is powerful, but frequent page transitions, heavy navigation, and context switching can slow down day-to-day repository work. GitHut treats GitHub as an API and builds a responsive application on top:

- **Instant navigation** across repositories, files, issues, pull requests, commits, and reviews.
- **Productive pull request review** with rich diffs, inline comments, review drafts, checks, and merge controls.
- **GitHub-native data** via OAuth and the GitHub REST/GraphQL APIs.
- **Large-repo friendly UI** with virtualized lists, lazy syntax grammars, and responsive layouts.
- **Polished interface** built with React, TanStack Router/Query, Tailwind CSS, shadcn/ui, and Shiki.

## Features

| Area | Status |
| --- | --- |
| Repository browsing | Code, branches, files, history, commits |
| Issues | Lists, filters, comments, labels, assignees, reactions |
| Pull requests | Conversation, files, commits, checks, reviews, merge/auto-merge/admin bypass |
| Review workflow | Inline comments, pending draft comments, submit review |
| GitHub auth | OAuth login, org access management, token revocation redirect |
| Uploads | Authenticated image uploads backed by Cloudflare R2 |
| Deployment | Cloudflare Workers + static assets |

See [`plan.md`](plan.md) for the active roadmap.

## Try it

Use the hosted app at **https://githut.app**.

GitHut asks GitHub for these OAuth scopes:

- `repo` — read/write repository data needed for private repos, issues, PRs, reviews, and merge actions.
- `read:user` — read your user profile.
- `read:org` — read organization membership for access-aware repository workflows.

You can revoke access at any time from GitHub's authorized OAuth apps page.

## Local development

### Requirements

- [Bun](https://bun.sh/) 1.2+
- A GitHub OAuth app for local login
- Optional for production-like uploads: a Cloudflare account with an R2 bucket

### 1. Clone and install

```bash
git clone https://github.com/daedlock/githut.git
cd githut
bun install
```

### 2. Configure local secrets

Create `.dev.vars` for Wrangler and/or `.env` for local tooling. Start from the example:

```bash
cp .env.example .env
cp .env.example .dev.vars
```

For local OAuth, create a GitHub OAuth app with:

- Homepage URL: `http://localhost:5173`
- Authorization callback URL: `http://localhost:5173/api/auth/callback`

Then set:

```ini
GITHUB_CLIENT_ID=your_local_oauth_client_id
GITHUB_CLIENT_SECRET=your_local_oauth_client_secret
OAUTH_STATE_SECRET=generate_a_long_random_secret
APP_URL=http://localhost:5173
```

### 3. Run the app

```bash
bun run dev
```

This starts Vite and Wrangler together. Open `http://localhost:5173`.

## Common commands

```bash
bun run dev          # Vite + Cloudflare Worker dev server
bun tsc --noEmit     # Type-check
bun test             # Run tests
bun run build        # Production build
bun run deploy       # Build and deploy with Wrangler
bun run check        # Biome lint/format check
bun run format       # Format with Biome
```

## Architecture

```text
src/
  app/
    components/       Shared UI and shell components
    features/         Feature modules for pulls, issues, dashboard, etc.
    hooks/            Data and interaction hooks
    lib/              GitHub client, routing helpers, utilities
    routes/           TanStack Router file routes
    styles/           Tailwind theme and global styles
  worker/             Cloudflare Worker API (OAuth, uploads, proxy endpoints)
public/               Static public assets
.github/              Workflows, issue forms, repository metadata
```

### Technology

- **Runtime/package manager:** Bun
- **Frontend:** React 19, TanStack Router, TanStack Query
- **Styling:** Tailwind CSS 4, shadcn/ui, custom design system
- **GitHub API:** Octokit, REST, GraphQL
- **Syntax highlighting:** Shiki
- **Edge/API:** Cloudflare Workers, Hono, R2
- **Quality:** TypeScript, Biome, GitHub Actions

## Contributing

We welcome high-quality issues, discussions, documentation improvements, bug fixes, and feature work. Please read [`CONTRIBUTING.md`](CONTRIBUTING.md) before opening a pull request.

Good starting points:

- Issues labeled [`good first issue`](https://github.com/daedlock/githut/issues?q=is%3Aissue+is%3Aopen+label%3A%22good+first+issue%22)
- Small documentation improvements
- Reproduction cases for GitHub API or browser-specific bugs
- Performance improvements with clear before/after notes

## Security

Please do not open public issues for vulnerabilities. See [`SECURITY.md`](SECURITY.md) for the private reporting process.

## License

GitHut is released under the [MIT License](LICENSE).
