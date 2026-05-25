# Contributing to GitHut

Thank you for helping make GitHub workflows faster. This guide explains how to propose changes, run the project locally, and get pull requests reviewed smoothly.

## Code of conduct

Participation in this project is covered by our [Code of Conduct](CODE_OF_CONDUCT.md). Be direct, kind, and respectful. Assume good intent, but make space for maintainers to keep discussions focused and actionable.

## Ways to contribute

You can help by:

- Reporting reproducible bugs.
- Improving documentation and onboarding.
- Fixing UI polish, accessibility, keyboard navigation, or performance issues.
- Adding tests around GitHub API behavior and critical workflows.
- Implementing scoped features from the roadmap or an accepted issue.

Before investing significant time in a large feature, open an issue or discussion first so we can align on scope and design.

## Development setup

### Requirements

- Bun 1.2+
- A GitHub OAuth app for local auth
- A GitHub account with access to any repositories you want to test against

### Install

```bash
git clone https://github.com/daedlock/githut.git
cd githut
bun install
```

### Configure OAuth

Create a GitHub OAuth app for local development:

- Homepage URL: `http://localhost:5173`
- Authorization callback URL: `http://localhost:5173/api/auth/callback`

Copy the example env file and fill in the values:

```bash
cp .env.example .env
cp .env.example .dev.vars
```

Required local values:

```ini
GITHUB_CLIENT_ID=your_client_id
GITHUB_CLIENT_SECRET=your_client_secret
OAUTH_STATE_SECRET=long_random_string
APP_URL=http://localhost:5173
```

### Start development

```bash
bun run dev
```

The app runs at `http://localhost:5173`.

## Project conventions

### Runtime and package manager

Use Bun for project commands:

```bash
bun install
bun run dev
bun test
bun run build
bun tsc --noEmit
```

Do not introduce npm/yarn/pnpm lockfiles.

### TypeScript

- Keep types precise at API boundaries.
- Validate external API responses with schemas where practical.
- Avoid broad `any`; if unavoidable, keep it local and explain why.

### UI and design system

Before changing UI, read [`DESIGN.md`](DESIGN.md). Important conventions:

- Use the design system text sizes (`text-caption`, `text-ui`, `text-body`, etc.), not raw Tailwind text sizes.
- Prefer semantic tokens (`bg-background`, `text-muted-foreground`, `border-border`) over hard-coded colors.
- Use existing shadcn/ui primitives from `src/app/components/ui/` before creating custom primitives.
- Use `gap-*` for stack spacing, not `space-*` utilities.
- Keep hover/selected rows subtle (`bg-muted` / `bg-accent`), not brand-filled.

### GitHub API behavior

GitHub behavior can differ by repository visibility, organization settings, merge queue, branch protection, and token scopes. When changing GitHub API code:

- Test public and private repositories when possible.
- Note required scopes or permissions in the PR.
- Handle null/partial GraphQL responses defensively.
- Invalidate TanStack Query caches after mutations.
- Avoid assuming the current viewer is an admin, owner, collaborator, or repository member.

## Quality checks

Run the checks relevant to your change before opening a PR:

```bash
bun tsc --noEmit
bun test
bun run build
```

Also run formatting/linting for files you touched:

```bash
bun run format
bun run check
```

If a repo-wide lint issue is unrelated to your change, mention it in the PR rather than mixing unrelated fixes into the same patch.

## Branch and commit workflow

1. Fork the repository or create a feature branch.
2. Branch from `main`.
3. Keep changes focused and reviewable.
4. Write clear commits in the imperative mood, for example `Add PR merge bypass state`.
5. Rebase or merge `main` if your branch drifts significantly.

## Pull request checklist

Before requesting review, confirm:

- [ ] The PR has a clear title and summary.
- [ ] The change is scoped to one problem or feature.
- [ ] Screenshots or recordings are included for UI changes.
- [ ] `bun tsc --noEmit` passes.
- [ ] `bun test` passes or there are no relevant tests.
- [ ] `bun run build` passes for production-impacting changes.
- [ ] New behavior is documented when needed.
- [ ] Security-sensitive changes do not expose tokens, secrets, or private repo data.

## Review process

Maintainers prioritize correctness, UX quality, performance, and maintainability. Reviews may ask for scope reductions, tests, design adjustments, or follow-up issues.

A PR is most likely to merge quickly when it:

- Links an issue or explains the user problem.
- Includes manual test steps.
- Keeps unrelated formatting changes out of feature commits.
- Follows the existing component and data-fetching patterns.

## Reporting bugs

Use the bug report issue form and include:

- Browser and OS.
- Repository visibility/type if relevant (public, private, fork, organization repo).
- Steps to reproduce.
- Expected vs actual behavior.
- Console/network errors if available.
- Screenshots or recordings for UI issues.

Do not include private tokens, OAuth codes, cookies, or sensitive repository content.

## Security vulnerabilities

Report vulnerabilities privately using the process in [`SECURITY.md`](SECURITY.md). Do not disclose security issues publicly until maintainers have investigated and released a fix.

## License

By contributing, you agree that your contributions will be licensed under the repository's [MIT License](LICENSE).
