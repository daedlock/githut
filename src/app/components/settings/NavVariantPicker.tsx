import { Check } from "lucide-react";
import { cn } from "@/app/lib/cn";
import { type NavVariantId, NAV_VARIANTS, useNavVariantStore } from "@/app/stores/navVariant";

/**
 * Nav variant picker — 4 cards, each with an ASCII-style mini-diagram of
 * the layout. Preview communicates the structural difference at a glance
 * so the user picks based on shape, not just a name.
 */
export function NavVariantPicker() {
  const variantId = useNavVariantStore((s) => s.variantId);
  const setVariantId = useNavVariantStore((s) => s.setVariantId);

  return (
    <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
      {NAV_VARIANTS.map((v) => (
        <VariantCard
          key={v.id}
          id={v.id}
          name={v.name}
          description={v.description}
          active={variantId === v.id}
          onSelect={() => setVariantId(v.id)}
        />
      ))}
    </div>
  );
}

function VariantCard({
  id,
  name,
  description,
  active,
  onSelect,
}: {
  id: NavVariantId;
  name: string;
  description: string;
  active: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      aria-pressed={active}
      className={cn(
        "group relative flex flex-col gap-2 rounded-md border bg-(--color-bg-subtle) p-3 text-left",
        "transition-all duration-150",
        "focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-(--color-focus)",
        active
          ? "border-(--color-accent) shadow-[0_0_0_1px_var(--color-accent)]"
          : "border-border hover:border-(--color-fg-faint)",
      )}
    >
      {/* Mini preview — thin structural diagram */}
      <div className="h-16 overflow-hidden rounded-sm border border-border bg-background p-2">
        <VariantPreview id={id} />
      </div>

      {/* Label */}
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex flex-col">
          <span className="font-mono text-caption font-medium text-foreground">{name}</span>
          <span className="truncate font-sans text-micro italic text-muted-foreground">
            {description}
          </span>
        </div>
        {active && (
          <span
            aria-hidden
            className="flex size-4 shrink-0 items-center justify-center rounded-full bg-(--color-accent) text-(--color-accent-fg)"
          >
            <Check className="size-2.5" strokeWidth={3} />
          </span>
        )}
      </div>
    </button>
  );
}

// ─── Tiny structural previews, one per variant ──────────────────────────────

function VariantPreview({ id }: { id: NavVariantId }) {
  if (id === "inline" || id === "inline-wide") {
    // Single row — wordmark, inline tabs, search pill, avatar.
    // Inline constrains via inner "container" box; wide goes edge-to-edge.
    const wide = id === "inline-wide";
    const row = (
      <div className="flex flex-1 items-center gap-1.5 font-mono text-[8px] leading-none">
        <span className="font-semibold text-foreground">
          GitHut<span className="text-(--color-accent)">_</span>
        </span>
        <div className="flex flex-1 items-center gap-0.5 overflow-hidden">
          <span className="rounded-sm bg-(--color-bg-sunken) px-1 text-foreground shadow-[0_-1px_0_var(--color-accent)_inset]">
            tab1
          </span>
          <span className="rounded-sm px-1 text-muted-foreground">tab2</span>
          <span className="rounded-sm px-1 text-muted-foreground">tab3</span>
        </div>
        <span className="rounded border border-border bg-(--color-bg-subtle) px-1 text-muted-foreground">
          ⌘K
        </span>
        <span className="block size-2.5 rounded-full bg-(--color-bg-sunken)" />
      </div>
    );
    return (
      <div className="flex h-full items-center">
        {wide ? (
          // Edge-to-edge: no inner container outline
          row
        ) : (
          // Container-bounded: inset with dashed margins on the sides
          <>
            <span aria-hidden className="h-full w-2 border-r border-dashed border-border/60" />
            {row}
            <span aria-hidden className="h-full w-2 border-l border-dashed border-border/60" />
          </>
        )}
      </div>
    );
  }

  if (id === "terminal") {
    return (
      <div className="flex h-full flex-col justify-center font-mono text-[9px] leading-none">
        <div className="flex items-center gap-1 text-muted-foreground">
          <span className="text-(--color-accent)">$</span>
          <span className="text-foreground">githut</span>
          <span className="text-(--color-fg-faint)">▸</span>
          <span className="text-foreground">main.ts</span>
          <span
            aria-hidden
            className="ml-0.5 inline-block h-2 w-[1.5px] bg-(--color-accent)"
          />
          <span className="text-(--color-fg-faint)">▸</span>
          <span className="text-muted-foreground">utils.ts</span>
        </div>
      </div>
    );
  }

  if (id === "split-rail") {
    return (
      <div className="flex h-full flex-col gap-1">
        <div className="flex items-center justify-between border-b border-border pb-1 font-mono text-[8px] leading-none">
          <span className="font-semibold text-foreground">
            H<span className="text-(--color-accent)">_</span>
          </span>
          <span className="text-muted-foreground">⌘K</span>
        </div>
        <div className="flex flex-1 items-center gap-1">
          <span className="h-3 rounded-sm bg-(--color-accent)/20 px-1 font-mono text-[7px] leading-3 text-foreground">
            repo1
          </span>
          <span className="h-3 rounded-sm bg-(--color-bg-sunken) px-1 font-mono text-[7px] leading-3 text-muted-foreground">
            repo2
          </span>
        </div>
      </div>
    );
  }

  if (id === "command-center") {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-1">
        <div className="h-3 w-20 rounded-full border border-border bg-(--color-bg-subtle)">
          <div className="flex h-full items-center justify-center gap-1 font-mono text-[7px] leading-none text-muted-foreground">
            <span>🔍</span>
            <span>search…</span>
          </div>
        </div>
        <div className="flex gap-0.5">
          <span className="h-2 w-6 rounded-full bg-(--color-accent)/20" />
          <span className="h-2 w-6 rounded-full bg-(--color-bg-sunken)" />
        </div>
      </div>
    );
  }

  if (id === "monoline") {
    return (
      <div className="flex h-full items-center gap-1.5 font-mono text-[8px] leading-none">
        <span className="font-semibold text-foreground">
          H<span className="text-(--color-accent)">_</span>
        </span>
        <span className="h-2 w-px bg-border-strong" />
        <div className="flex flex-1 items-center gap-1">
          <span className="block size-1.5 rounded-full bg-(--color-accent)" />
          <span className="block size-1 rounded-full border border-(--color-border-strong)" />
          <span className="block size-1 rounded-full border border-(--color-border-strong)" />
          <span className="block size-1 rounded-full border border-(--color-border-strong)" />
        </div>
        <span className="text-muted-foreground">⌘K</span>
      </div>
    );
  }

  if (id === "deck") {
    // Full-bleed four-segment control strip
    return (
      <div className="flex h-full items-stretch divide-x divide-border overflow-hidden rounded-[1px] border border-border bg-(--color-bg-subtle) font-mono text-[7px] leading-none">
        <div className="flex items-center px-1 font-semibold text-foreground">
          H<span className="text-(--color-accent)">_</span>
        </div>
        <div className="flex flex-[2] items-center px-1 text-muted-foreground">🔍 search</div>
        <div className="flex flex-[3] items-center gap-0.5 px-1">
          <span className="rounded-sm bg-background px-0.5 text-foreground shadow-[0_-1px_0_var(--color-accent)_inset]">
            tab1
          </span>
          <span className="text-(--color-fg-faint)">▸</span>
          <span className="text-muted-foreground">tab2</span>
        </div>
        <div className="flex items-center px-1">
          <span className="block size-2 rounded-full bg-(--color-bg-sunken)" />
        </div>
      </div>
    );
  }

  if (id === "vertical-rail") {
    // Sidebar preview — narrow left column with content on the right
    return (
      <div className="flex h-full gap-1">
        <div className="flex w-4 flex-col items-center justify-between rounded-sm border border-border bg-(--color-bg-subtle) py-1">
          <span className="font-mono text-[7px] font-semibold leading-none text-foreground">
            H<span className="text-(--color-accent)">_</span>
          </span>
          <div className="flex flex-col gap-0.5">
            <span className="block size-1.5 rounded-sm bg-(--color-accent)" />
            <span className="block size-1.5 rounded-sm border border-(--color-border-strong)" />
            <span className="block size-1.5 rounded-sm border border-(--color-border-strong)" />
          </div>
          <span className="block size-1.5 rounded-full bg-(--color-bg-sunken)" />
        </div>
        <div className="flex flex-1 items-center justify-center rounded-sm border border-dashed border-border">
          <span className="font-mono text-[7px] uppercase tracking-widest text-(--color-fg-faint)">
            content
          </span>
        </div>
      </div>
    );
  }

  if (id === "heads-up") {
    // Floating rounded island centered above content
    return (
      <div className="relative flex h-full items-center justify-center bg-[repeating-linear-gradient(135deg,transparent,transparent_3px,color-mix(in_oklab,var(--color-border)_50%,transparent)_3px,color-mix(in_oklab,var(--color-border)_50%,transparent)_4px)]">
        <div className="flex h-4 w-3/4 items-center gap-1 rounded-full border border-border bg-background/90 px-1 font-mono text-[7px] leading-none shadow-[0_2px_4px_-1px_rgba(0,0,0,0.15)] backdrop-blur">
          <span className="inline-flex size-2.5 items-center justify-center rounded-full bg-(--color-bg-subtle) font-semibold text-foreground">
            H
          </span>
          <span className="rounded-full bg-(--color-accent)/20 px-1 text-foreground">tab</span>
          <span className="text-muted-foreground">tab</span>
          <span className="ml-auto text-muted-foreground">⌘K</span>
        </div>
      </div>
    );
  }

  if (id === "brutalist") {
    // Loud editorial — inverted wordmark block + thick borders
    return (
      <div className="flex h-full items-stretch border-b-[2px] border-foreground">
        <div className="flex items-center bg-foreground px-1 font-mono text-[8px] font-bold uppercase leading-none tracking-tighter text-background">
          GITHUT<span className="text-(--color-accent)">_</span>
        </div>
        <div className="flex flex-1 items-center gap-1 border-r-[2px] border-foreground px-1">
          <span className="border-[1.5px] border-(--color-accent) bg-(--color-accent) px-0.5 font-mono text-[7px] font-bold uppercase leading-none text-(--color-accent-fg) shadow-[2px_2px_0_0_var(--color-foreground)]">
            tab
          </span>
          <span className="font-mono text-[8px] font-bold text-(--color-fg-faint)">/</span>
          <span className="border-[1.5px] border-foreground px-0.5 font-mono text-[7px] font-bold uppercase leading-none text-foreground">
            tab
          </span>
        </div>
        <div className="flex items-center px-1 font-mono text-[6px] uppercase tracking-widest text-muted-foreground">
          ⌘K
        </div>
      </div>
    );
  }

  return null;
}
