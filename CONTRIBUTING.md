# Contributing to GitHut

Thanks for your interest in contributing! GitHut is open source because we believe developers deserve a faster GitHub experience.

## Quick Links

- [Good First Issues](https://github.com/daedlock/githut/issues?q=is%3Aissue+is%3Aopen+label%3A%22good+first+issue%22) — Start here
- [Bug Reports](https://github.com/daedlock/githut/issues/new?template=bug_report.md) — Found a bug?
- [Feature Requests](https://github.com/daedlock/githut/issues/new?template=feature_request.md) — Have an idea?

## Development Setup

```bash
# Clone and install
git clone https://github.com/daedlock/githut.git
cd githut
bun install

# Start dev server
bun run dev

# Run tests
bun test

# Type check
bun tsc --noEmit
```

## Project Structure

```
src/
├── app/
│   ├── components/    # React components (UI + features)
│   ├── routes/        # TanStack Router pages
│   ├── lib/           # Utilities, API clients
│   └── styles/        # Tailwind + global styles
├── server/            # Cloudflare Worker + Hono API
└── public/            # Static assets
```

## Code Style

- **Formatter:** Biome (`bun run format`)
- **Linter:** Biome (`bun run check`)
- **UI:** shadcn/ui components in `src/app/components/ui/`

Before committing:
```bash
bun run check
bun run format
```

## Pull Request Process

1. **Fork** the repo and create your branch from `main`
2. **Make your changes** with clear commit messages
3. **Test manually** — ensure the app works
4. **Submit PR** — describe what and why, link any issues

We'll review within 48 hours.

## Questions?

- Open a [GitHub Discussion](https://github.com/daedlock/githut/discussions) for general questions
- Join our [Discord](https://discord.gg/githut) *(coming soon)* for real-time chat

---

Thanks for helping make GitHub faster! 🚀
