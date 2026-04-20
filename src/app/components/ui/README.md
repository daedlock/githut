# UI Primitives

Owned, not installed. Every primitive lives here as editable source — no CLI, no package. Rules:

1. **Add only on second usage.** One-off styling stays inline. Factor into a primitive only when the same classname combo appears the second time.
2. **Variants via `cva`**, classes via `cn()`. Never concatenate className strings by hand.
3. **Tokens only.** Reference `var(--color-*)`, `var(--radius-*)`, `var(--font-*)` — never raw hex, never Tailwind color utilities (`bg-blue-500` is banned). Swap palette = edit `styles/index.css`.
4. **Headless behavior from Radix** only where focus traps, ARIA, or positioning are needed (Dialog, DropdownMenu, Tooltip, Popover). Plain HTML + Tailwind everywhere else.
5. **`forwardRef` always.** Consumers need refs.
