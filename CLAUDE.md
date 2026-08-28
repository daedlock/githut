
## UI work — read DESIGN.md first

Before building or editing **any** component, shell element, page layout, or list:
**read `DESIGN.md`** at the repo root. It defines chrome heights, spacing rhythm,
typographic scale, color usage rules, and component patterns. Violating it produces
UIs that look wrong even if they technically work.

Key rules that catch most mistakes:
- Top bar: `h-9` with `flex items-center`. **Never `py-*`** on a chrome bar.
- Hover/selected rows: `bg-(--color-bg-sunken)`. **Never ember/primary as a fill**.
- All text sizes: use `text-micro/caption/ui/code/body/title/heading/display`. **Never `text-sm`, `text-xs`, etc.**
- Mono (`font-mono`) for identifiers. Sans (`font-sans`) for labels and descriptions.
- Shadows on overlays only. **No shadows on headers, toolbars, or sidebars**.

---

Default to using Bun instead of Node.js.

- Use `bun <file>` instead of `node <file>` or `ts-node <file>`
- Use `bun test` instead of `jest` or `vitest`
- Use `bun build <file.html|file.ts|file.css>` instead of `webpack` or `esbuild`
- Use `bun install` instead of `npm install` or `yarn install` or `pnpm install`
- Use `bun run <script>` instead of `npm run <script>` or `yarn run <script>` or `pnpm run <script>`
- Use `bunx <package> <command>` instead of `npx <package> <command>`
- Bun automatically loads .env, so don't use dotenv.

## APIs

- `Bun.serve()` supports WebSockets, HTTPS, and routes. Don't use `express`.
- `bun:sqlite` for SQLite. Don't use `better-sqlite3`.
- `Bun.redis` for Redis. Don't use `ioredis`.
- `Bun.sql` for Postgres. Don't use `pg` or `postgres.js`.
- `WebSocket` is built-in. Don't use `ws`.
- Prefer `Bun.file` over `node:fs`'s readFile/writeFile
- Bun.$`ls` instead of execa.

## Testing

Use `bun test` to run tests.

```ts#index.test.ts
import { test, expect } from "bun:test";

test("hello world", () => {
  expect(1).toBe(1);
});
```

# UI components — shadcn first

**This project is shadcn-based.** Config: `components.json` at repo root. Components live in `src/app/components/ui/` (lowercase filenames — `button.tsx`, `dialog.tsx`, `command.tsx`, etc.).

## Rules

1. **Before writing any modal, popover, dropdown, command palette, tooltip, toast, or form input — check `src/app/components/ui/` first.** If the component exists, use it. If it doesn't, add it with `bunx shadcn@latest add <name>` before writing something custom.
2. **Load the shadcn skill** (`Skill` → `shadcn`) at the start of any UI task. It has the critical rules for component usage (FieldGroup/Field for forms, data-icon for icons in buttons, `cn()` for class merging, etc.).
3. **Use semantic theme tokens**, not raw colors or our direct palette vars in shadcn consumers. shadcn's tokens (`bg-background`, `text-muted-foreground`, `border-border`, `text-primary`, `bg-destructive`, etc.) are bridged to our warm-stone/ember palette in `src/app/styles/index.css`. If you find yourself writing `bg-[var(--color-bg)]`, use `bg-background` instead.
4. **Never re-invent primitives.** No hand-rolled `<Sheet>`, `<Popover>`, `<Dialog>` wrappers on top of Radix — use shadcn's `<Dialog>` / `<Popover>` / `<Sheet>` directly.
5. **Button variants:** `default · secondary · ghost · destructive · outline · link`. Button sizes: `default · sm · lg · xs · icon · icon-sm · icon-xs · icon-lg`. Do not invent custom variants — compose via `className` if something specific is needed.
6. **Animation is baked in.** shadcn modals/popovers animate via Radix `data-[state=open/closed]` + `tw-animate-css` utilities (`animate-in fade-in-0 zoom-in-95` etc.). Don't add your own keyframes.
7. **Icons in Button use `data-icon="inline-start"` / `"inline-end"`.** No manual `size-4` / `h-4 w-4` on icons inside Buttons — shadcn handles sizing.
8. **Spacing is `gap-*`, not `space-y-*` / `space-x-*`.** For vertical stacks: `flex flex-col gap-*`.
9. **`cn()` comes from `@/app/lib/cn`.** Not `@/app/lib/utils` (that file was removed; see `components.json` aliases).
10. **Update components** with `bunx shadcn@latest add <name> --dry-run --diff <file>` to see upstream changes. Never fetch raw files from GitHub manually.

## Theme bridge

We own the palette (`--color-bg`, `--color-fg`, `--color-accent`, etc. — warm stone + ember). shadcn's semantic tokens resolve to our palette via the bridge block at the end of `@theme` in `src/app/styles/index.css`:

- `--color-background` → `var(--color-bg)`
- `--color-foreground` → `var(--color-fg)`
- `--color-primary` → `var(--color-accent)` (our ember)
- `--color-secondary` → `var(--color-bg-subtle)`
- `--color-muted-foreground` → `var(--color-fg-muted)`
- `--color-accent` (shadcn) → `var(--color-bg-sunken)` (hover tint — *not* our brand accent; shadcn reuses the `accent` name for subtle surface)
- `--color-destructive` → `var(--color-danger)`
- `--color-border` → `var(--color-border)`
- `--color-ring` → `var(--color-focus)`

When a shadcn component says `bg-background` / `text-muted-foreground`, it inherits our theme automatically. Theme swaps (ember / stone / dark mode) cascade without touching components.

## When adding a new shadcn component

```bash
bunx shadcn@latest add <component-name> --yes
```

After adding:
1. Read the generated file. Verify `cn` is imported from `@/app/lib/cn` (not `@/app/lib/utils`). If wrong, fix it.
2. If the registry file uses icons from a library we don't use, swap to `lucide-react`.
3. Cross-check against the shadcn skill's critical rules.
4. Run `bun tsc --noEmit` — must be clean.

## Agent skills

### Git workflow

For code or documentation changes, follow `docs/agents/git-workflow.md`.

### Issue tracker

Issues are tracked in GitHub Issues for `daedlock/githut`. See `docs/agents/issue-tracker.md`.

### Triage labels

Use the five default Matt Pocock triage labels. See `docs/agents/triage-labels.md`.

### Domain docs

This is a single-context repository. See `docs/agents/domain.md`.
