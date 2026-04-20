import { createFileRoute } from "@tanstack/react-router";
import { Search } from "lucide-react";
import { DiffLayout, type DiffLayoutFile } from "@/app/components/code";
import { ThemeToggle } from "@/app/components/ThemeToggle";
import { Button } from "@/app/components/ui/button";
import { Input } from "@/app/components/ui/input";
import { Kbd } from "@/app/components/ui/kbd";

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

      <main className="mx-auto max-w-3xl space-y-10 px-6 py-10">
        <div className="space-y-2">
          <h1 className="font-mono text-heading font-medium">
            UI primitives<span className="text-[var(--color-accent)]">_</span>
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
            <Input placeholder="Search repositories…" />
          </div>
          <div className="w-64">
            <Input className="font-mono tracking-tight" placeholder="deadbeef1234" />
          </div>
          <div className="w-48">
            <Input className="h-7 text-ui" placeholder="Small" />
          </div>
          <div className="w-48">
            <Input className="h-11 text-body" placeholder="Large" />
          </div>
          <div className="w-64">
            <Input disabled placeholder="Disabled" />
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
          <Swatch label="accent" value="--color-accent" />
          <Swatch label="success" value="--color-success" />
          <Swatch label="danger" value="--color-danger" />
          <Swatch label="warning" value="--color-warning" />
        </Section>

        <Section title="Typography">
          <div className="space-y-3">
            <p className="font-sans text-body">
              Sans — IBM Plex Sans. The quick brown fox jumps over the lazy dog.
            </p>
            <p className="font-mono text-body">Mono — IBM Plex Mono. const hash = "9f2c4b8e1a7d0"</p>
          </div>
        </Section>

      </main>

      {/*
       * Diff layout preview — full viewport width, pinned height. DiffLayout
       * owns both the tree sidebar and the stacked diffs + their own scroll
       * container, so the tree stays anchored while diffs scroll. h-[80vh]
       * is there just to give the demo a canvas; in a real PR route it would
       * be flex-1 inside AppShell's main.
       */}
      <section className="w-full px-6 py-10">
        <header className="mb-4 flex items-baseline gap-3 border-t border-[var(--color-border)] pt-8">
          <h2 className="font-sans text-ui font-medium uppercase tracking-widest">Diff layout</h2>
          <span className="font-mono text-micro uppercase tracking-widest text-[var(--color-fg-faint)]">
            tree + stack · scroll-spy · j/k nav · [ toggle · global mode
          </span>
        </header>
        <div className="overflow-hidden rounded-[var(--radius-md)] border border-[var(--color-border-strong)]">
          <DiffLayout files={SAMPLE_DIFF_FILES} />
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
-  --color-accent: #f97316;
+  --color-accent: #ea580c;
+  --color-accent-hover: #c2410c;
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
    filename: "public/logo.png",
    status: "modified",
    additions: 0,
    deletions: 0,
    patch: null,
  },
];
