import { createFileRoute } from "@tanstack/react-router";
import { Search } from "lucide-react";
import { ThemeToggle } from "@/app/components/ThemeToggle";
import { Button } from "@/app/components/ui/Button";
import { Input } from "@/app/components/ui/Input";
import { Kbd } from "@/app/components/ui/Kbd";

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
        <h2 className="font-mono text-xs font-medium uppercase tracking-widest">{title}</h2>
        {meta ? (
          <span className="font-mono text-[10px] uppercase tracking-widest text-[var(--color-fg-faint)]">
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
          <span className="font-mono text-sm font-medium tracking-tight">GitHut</span>
          <span className="font-mono text-[10px] uppercase tracking-widest text-[var(--color-fg-faint)]">
            / playground
          </span>
        </div>
        <ThemeToggle />
      </header>

      <main className="mx-auto max-w-3xl space-y-10 px-6 py-10">
        <div className="space-y-2">
          <h1 className="font-mono text-2xl font-medium tracking-tight">
            UI primitives<span className="text-[var(--color-accent)]">_</span>
          </h1>
          <p className="text-sm text-[var(--color-fg-muted)]">
            Dev-only reference. Each primitive variant rendered against the current theme. Toggle
            theme in the top-right to verify both look right.
          </p>
        </div>

        <Section title="Button" meta="variant × size">
          <Button variant="primary">Primary</Button>
          <Button variant="secondary">Secondary</Button>
          <Button variant="ghost">Ghost</Button>
          <Button variant="danger">Danger</Button>
          <Button disabled>Disabled</Button>
        </Section>

        <Section title="Button sizes">
          <Button size="sm">Small</Button>
          <Button size="md">Medium</Button>
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
            <Input variant="mono" placeholder="deadbeef1234" />
          </div>
          <div className="w-48">
            <Input size="sm" placeholder="Small" />
          </div>
          <div className="w-48">
            <Input size="lg" placeholder="Large" />
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
            <p className="font-sans text-sm">
              Sans — IBM Plex Sans. The quick brown fox jumps over the lazy dog.
            </p>
            <p className="font-mono text-sm">Mono — IBM Plex Mono. const hash = "9f2c4b8e1a7d0"</p>
          </div>
        </Section>
      </main>

      <footer className="mx-auto max-w-3xl border-t border-[var(--color-border)] px-6 py-6 font-mono text-[10px] uppercase tracking-widest text-[var(--color-fg-faint)]">
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
        <span className="font-mono text-xs">{label}</span>
        <span className="font-mono text-[10px] text-[var(--color-fg-faint)]">{value}</span>
      </div>
    </div>
  );
}
