import { describe, expect, test } from "bun:test";

// Guards #58. Radix's modal overlays mount react-remove-scroll, whose
// getGapWidth calls getComputedStyle(document.body) on open and forces a
// whole-document style recalc (~600 ms at 4x CPU on a full workspace). The
// workspace body never scrolls, so the shadcn wrappers must not mount it.
// There is no DOM test environment in this repo, so this checks the wrappers'
// source: a `shadcn add` that restores the upstream files fails here.
const read = (name: string) =>
  Bun.file(new URL(`./${name}`, import.meta.url)).text();

describe("overlays never mount Radix's scroll lock", () => {
  test("dialog and sheet do not render DialogPrimitive.Overlay", async () => {
    for (const file of ["dialog.tsx", "sheet.tsx"]) {
      expect(await read(file)).not.toMatch(/<DialogPrimitive\.Overlay\b/);
    }
  });

  test("sheet shares dialog's root, which feeds the backdrop its state", async () => {
    const sheet = await read("sheet.tsx");
    expect(sheet).not.toMatch(/<DialogPrimitive\.Root\b/);
    expect(sheet).toMatch(/<Dialog\b/);
  });

  test.each(["context-menu.tsx", "dropdown-menu.tsx"])(
    "%s root is non-modal",
    async (file) => {
      expect(await read(file)).toMatch(/Primitive\.Root[^>]*modal=\{false\}/);
    },
  );

  test("no other Radix overlay with a scroll lock is wrapped", async () => {
    const glob = new Bun.Glob("*.tsx");
    const dir = new URL(".", import.meta.url).pathname;
    for await (const file of glob.scan(dir)) {
      const src = await read(file);
      expect(src).not.toMatch(/\b(AlertDialog|Select)Primitive\b/);
      // Popover locks scroll only when modal; keep it at Radix's default.
      if (file === "popover.tsx") expect(src).not.toMatch(/modal/);
    }
  });
});
