import { createFileRoute } from "@tanstack/react-router";
import { Search } from "lucide-react";
import { DiffLayout, type DiffLayoutFile, DiffView } from "@/app/components/code";
import { ThemeToggle } from "@/app/components/ThemeToggle";
import { Button } from "@/app/components/ui/button";
import { Input } from "@/app/components/ui/input";
import { Kbd } from "@/app/components/ui/kbd";
import { THEME_OPTIONS } from "@/app/lib/themeCatalog";

export const Route = createFileRoute("/playground")({
  component: PlaygroundPage,
  beforeLoad: () => {
    if (!import.meta.env.DEV) throw new Error("Not found");
  },
});

function Section({
  title,
  meta,
  children,
}: {
  title: string;
  meta?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="space-y-4 border-t border-[var(--color-border)] pt-8">
      <header className="flex items-baseline gap-3">
        <h2 className="font-mono text-ui font-medium uppercase tracking-widest">{title}</h2>
        {meta ? (
          <span className="font-mono text-micro uppercase tracking-widest text-[var(--color-fg-faint)]">
            {meta}
          </span>
        ) : null}
      </header>
      <div className="flex flex-wrap items-start gap-4">{children}</div>
    </section>
  );
}

function PlaygroundPage() {
  return (
    <div className="min-h-full">
      <header className="sticky top-0 z-10 flex items-center justify-between border-b border-[var(--color-border)] bg-[var(--color-bg)]/80 px-6 py-4 backdrop-blur">
        <div className="flex items-baseline gap-3">
          <span className="font-mono text-body font-medium tracking-tight">GitHut</span>
          <span className="font-mono text-micro uppercase tracking-widest text-[var(--color-fg-faint)]">
            / playground
          </span>
        </div>
        <ThemeToggle />
      </header>

      <div className="mx-auto max-w-3xl space-y-10 px-6 py-10">
        <div className="space-y-2">
          <h1 className="font-mono text-heading font-medium">
            UI primitives<span className="text-[var(--color-brand)]">_</span>
          </h1>
          <p className="text-body text-[var(--color-fg-muted)]">
            Dev-only reference. Each primitive variant rendered against the current theme. Toggle
            theme in the top-right to verify both look right.
          </p>
        </div>

        <Section title="Button" meta="variant × size">
          <Button variant="default">Primary</Button>
          <Button variant="secondary">Secondary</Button>
          <Button variant="ghost">Ghost</Button>
          <Button variant="destructive">Danger</Button>
          <Button disabled>Disabled</Button>
        </Section>

        <Section title="Button sizes">
          <Button size="sm">Small</Button>
          <Button size="default">Medium</Button>
          <Button size="lg">Large</Button>
          <Button size="icon" aria-label="Search">
            <Search className="h-4 w-4" />
          </Button>
        </Section>

        <Section title="Input">
          <div className="w-64">
            <Input
              name="playground-repository-search"
              aria-label="Search repositories example"
              autoComplete="off"
              placeholder="Search repositories…"
            />
          </div>
          <div className="w-64">
            <Input
              name="playground-commit-sha"
              aria-label="Commit SHA example"
              autoComplete="off"
              className="font-mono tracking-tight"
              placeholder="deadbeef1234"
            />
          </div>
          <div className="w-48">
            <Input
              name="playground-small-input"
              aria-label="Small input example"
              autoComplete="off"
              className="h-7 text-ui"
              placeholder="Small"
            />
          </div>
          <div className="w-48">
            <Input
              name="playground-large-input"
              aria-label="Large input example"
              autoComplete="off"
              className="h-11 text-body"
              placeholder="Large"
            />
          </div>
          <div className="w-64">
            <Input
              disabled
              name="playground-disabled-input"
              aria-label="Disabled input example"
              autoComplete="off"
              placeholder="Disabled"
            />
          </div>
        </Section>

        <Section title="Kbd">
          <div className="flex items-center gap-1.5">
            <Kbd>?</Kbd>
          </div>
          <div className="flex items-center gap-1.5">
            <Kbd>⌘</Kbd>
            <Kbd>K</Kbd>
          </div>
          <div className="flex items-center gap-1.5">
            <Kbd>g</Kbd>
            <Kbd>c</Kbd>
          </div>
          <div className="flex items-center gap-1.5">
            <Kbd>esc</Kbd>
          </div>
        </Section>

        <Section title="Color tokens" meta="semantic, theme-aware">
          <Swatch label="bg" value="--color-bg" />
          <Swatch label="bg-subtle" value="--color-bg-subtle" />
          <Swatch label="bg-sunken" value="--color-bg-sunken" />
          <Swatch label="fg" value="--color-fg" />
          <Swatch label="fg-muted" value="--color-fg-muted" />
          <Swatch label="border" value="--color-border-strong" />
          <Swatch label="brand" value="--color-brand" />
          <Swatch label="accent surface" value="--color-accent" />
          <Swatch label="success" value="--color-success" />
          <Swatch label="danger" value="--color-danger" />
          <Swatch label="warning" value="--color-warning" />
        </Section>

        <Section title="Typography">
          <div className="space-y-3">
            <p className="font-sans text-body">
              Sans — Inter. The quick brown fox jumps over the lazy dog.
            </p>
            <p className="font-feature-settings-code text-body">
              Code — selectable in Settings. const result = value !== null =&gt; value
            </p>
          </div>
        </Section>
      </div>

      {/*
       * Diff layout preview — full viewport width, pinned height. DiffLayout
       * owns both the tree sidebar and the stacked diffs + their own scroll
       * container, so the tree stays anchored while diffs scroll. h-[80vh]
       * is there just to give the demo a canvas; in a real PR route it would
       * be flex-1 inside the tab's pane.
       */}
      <section className="w-full px-6 py-10">
        <header className="mb-4 flex items-baseline gap-3 border-t border-[var(--color-border)] pt-8">
          <h2 className="font-sans text-ui font-medium uppercase tracking-widest">Diff layout</h2>
          <span className="font-mono text-micro uppercase tracking-widest text-[var(--color-fg-faint)]">
            tree + stack · scroll-spy · j/k nav · [ toggle · global mode
          </span>
        </header>
        <div className="overflow-hidden rounded-[var(--radius-md)] border border-[var(--color-border-strong)]">
          {/* A public repo with long-lived tags so the media previews below
              resolve without a session; the text samples are synthetic. */}
          <DiffLayout
            files={SAMPLE_DIFF_FILES}
            owner="microsoft"
            repo="vscode"
            headRef="1.90.0"
            baseRef="1.80.0"
          />
        </div>
      </section>

      <section className="w-full px-6 py-10">
        <header className="mb-4 flex items-baseline gap-3 border-t border-[var(--color-border)] pt-8">
          <h2 className="font-sans text-ui font-medium uppercase tracking-widest">Diff contrast</h2>
          <span className="font-mono text-micro uppercase tracking-widest text-[var(--color-fg-faint)]">
            every theme · comments · word highlights
          </span>
        </header>
        <div className="grid grid-cols-2 gap-4">
          {THEME_OPTIONS.map((theme) => (
            <article
              key={theme.id}
              data-contrast-theme={theme.id}
              data-theme={theme.id}
              style={DIFF_CONTRAST_SCOPE_STYLE}
              className={
                theme.mode === "dark"
                  ? "dark overflow-hidden rounded-lg"
                  : "overflow-hidden rounded-lg"
              }
            >
              <h3 className="bg-[var(--color-bg)] px-3 py-2 font-mono text-caption text-[var(--color-fg)]">
                {theme.name}
              </h3>
              <DiffView patch={SAMPLE_DIFF_CONTRAST_PATCH} lang="typescript" />
            </article>
          ))}
        </div>
      </section>

      <footer className="mx-auto max-w-3xl border-t border-[var(--color-border)] px-6 py-6 font-mono text-micro uppercase tracking-widest text-[var(--color-fg-faint)]">
        end of primitives
      </footer>
    </div>
  );
}

function Swatch({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center gap-2">
      <span
        className="h-8 w-8 rounded-[var(--radius-sm)] border border-[var(--color-border-strong)]"
        style={{ backgroundColor: `var(${value})` }}
      />
      <div className="flex flex-col leading-tight">
        <span className="font-mono text-ui">{label}</span>
        <span className="font-mono text-[10px] text-[var(--color-fg-faint)]">{value}</span>
      </div>
    </div>
  );
}

// Sample unified-diff patches for the playground — hand-authored to exercise
// the tree (nested dirs, mixed statuses), word-level intra-line changes (so
// `.diff-word` runs), multiple hunks, different languages, renames, and a
// binary file with no patch.
const SAMPLE_TS_PATCH = `@@ -12,7 +12,8 @@ export async function signIn(code: string) {
   const res = await fetch(\`\${API}/oauth/callback?code=\${code}\`);
   if (!res.ok) throw new Error("auth failed");
   const { token } = await res.json();
-  localStorage.setItem("auth_token", token);
+  sessionStorage.setItem("auth_token", token);
+  setCookie("session", token, { sameSite: "lax" });
   return token;
 }
@@ -28,5 +29,5 @@ export function getToken(): string | null {
-  return localStorage.getItem("auth_token");
+  return sessionStorage.getItem("auth_token");
 }`;

const SAMPLE_TSX_PATCH = `@@ -4,7 +4,7 @@ export function Panel({ title, children }: Props) {
   return (
-    <div className="panel panel--bordered">
-      <h3 className="panel__title">{title}</h3>
+    <section className="card card--bordered">
+      <h3 className="card__title">{title}</h3>
       <div>{children}</div>
-    </div>
+    </section>
   );
 }`;

const SAMPLE_HOOK_PATCH = `@@ -1,8 +1,12 @@
 import { useEffect, useState } from "react";
+import { z } from "zod";
+
+const TokenSchema = z.string().min(1);

 export function useToken() {
-  const [token, setToken] = useState<string | null>(null);
+  const [token, setToken] = useState<string | null>(() =>
+    TokenSchema.safeParse(sessionStorage.getItem("auth_token")).data ?? null,
+  );
   useEffect(() => {
     const cached = sessionStorage.getItem("auth_token");
     if (cached) setToken(cached);`;

const SAMPLE_CSS_PATCH = `@@ -18,8 +18,10 @@
   --color-fg: #1c1917;
   --color-fg-muted: #57534e;
 -  --color-brand: #f97316;
 +  --color-brand: #ea580c;
 +  --color-brand-hover: #c2410c;
   --radius-md: 4px;
+  --radius-lg: 6px;
 }`;

const SAMPLE_README_PATCH = `@@ -1,6 +1,11 @@
 # GitHut

-A fast GitHub client.
+A fast, keyboard-first GitHub client. Built for engineers who live in issues,
+PRs, and diffs.
+
+## Features
+
+- Blazing fast diff viewer with split view, word-level highlighting, and a real file tree
 `;

// Regression fixture: omitted source between these hunks contains the closing
// block-comment delimiter. The second hunk must start with fresh lexer state.
const SAMPLE_LEXER_BOUNDARY_PATCH = `@@ -1,2 +1,2 @@
 /* comment starts in this hunk
 const stillComment = true;
@@ -20,1 +20,1 @@
-const oldValue = 1;
+const newValue = 2;`;

const SAMPLE_DIFF_CONTRAST_PATCH = `@@ -20,2 +20,2 @@
-// Removed comment explains the old behavior
-const oldValue = 1;
+// Added comment explains the new behavior
+const newValue = 2;`;

// Derived custom properties normally resolve on <html>, where the selected
// theme also lives. Re-declare them on each nested gallery card so its local
// theme variables drive the same formulas independently.
const DIFF_CONTRAST_SCOPE_STYLE = {
  "--diff-add-bg": "color-mix(in oklab, var(--color-success) 14%, var(--color-bg))",
  "--diff-add-gutter": "color-mix(in oklab, var(--color-success) 30%, var(--color-bg))",
  "--diff-add-bg-word": "color-mix(in oklab, var(--color-success) 24%, var(--color-bg))",
  "--diff-del-bg": "color-mix(in oklab, var(--color-danger) 14%, var(--color-bg))",
  "--diff-del-gutter": "color-mix(in oklab, var(--color-danger) 30%, var(--color-bg))",
  "--diff-del-bg-word": "color-mix(in oklab, var(--color-danger) 24%, var(--color-bg))",
} as React.CSSProperties;

const SAMPLE_SVG_PATCH = `@@ -1,3 +1,3 @@
 <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32">
-  <path fill="#0065A9" d="M0 0h32v32H0z"/>
+  <path fill="#007ACC" d="M0 0h32v32H0z"/>
 </svg>`;

const SAMPLE_DIFF_FILES: DiffLayoutFile[] = [
  {
    filename: "src/app/lib/auth.ts",
    status: "modified",
    additions: 3,
    deletions: 2,
    patch: SAMPLE_TS_PATCH,
    lang: "typescript",
  },
  {
    filename: "src/app/lib/lexer-boundary.ts",
    status: "modified",
    additions: 1,
    deletions: 1,
    patch: SAMPLE_LEXER_BOUNDARY_PATCH,
    lang: "typescript",
  },
  {
    filename: "src/app/hooks/useToken.ts",
    status: "added",
    additions: 5,
    deletions: 1,
    patch: SAMPLE_HOOK_PATCH,
    lang: "typescript",
  },
  {
    filename: "src/app/components/Card.tsx",
    previousFilename: "src/app/components/Panel.tsx",
    status: "renamed",
    additions: 2,
    deletions: 2,
    patch: SAMPLE_TSX_PATCH,
    lang: "tsx",
  },
  {
    filename: "src/app/styles/index.css",
    status: "modified",
    additions: 3,
    deletions: 1,
    patch: SAMPLE_CSS_PATCH,
    lang: "css",
  },
  {
    filename: "README.md",
    status: "modified",
    additions: 6,
    deletions: 1,
    patch: SAMPLE_README_PATCH,
    lang: "markdown",
  },
  {
    filename: "resources/linux/code.png",
    status: "modified",
    additions: 0,
    deletions: 0,
    patch: null,
  },
  {
    filename: "resources/win32/code_150x150.png",
    status: "added",
    additions: 0,
    deletions: 0,
    patch: null,
  },
  {
    filename: "src/vs/workbench/browser/media/code-icon.svg",
    status: "modified",
    additions: 1,
    deletions: 1,
    patch: SAMPLE_SVG_PATCH,
    lang: "xml",
  },
  {
    filename: "build/assets/bundle.zip",
    status: "added",
    additions: 0,
    deletions: 0,
    patch: null,
  },
];
