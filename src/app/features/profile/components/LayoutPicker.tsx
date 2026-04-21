import { LayoutGrid } from "lucide-react";
import { Container } from "@/app/components/ui/Container";
import { cn } from "@/app/lib/cn";
import {
  type ProfileLayoutId,
  PROFILE_LAYOUTS,
  useProfileLayoutStore,
} from "@/app/stores/profileLayout";

/**
 * Compact strip at the top of the profile page — 4-way segmented control
 * that flips between layout variants. Persists the choice per-browser.
 *
 * Mono caps + tight borders keep it reading as a "dev tool" rather than
 * a feature bar, so it doesn't compete with the profile content below.
 */
export function LayoutPicker() {
  const current = useProfileLayoutStore((s) => s.layoutId);
  const set = useProfileLayoutStore((s) => s.setLayoutId);

  return (
    <div className="border-b border-border bg-(--color-bg-subtle)">
      <Container className="flex items-center gap-3 py-2">
        <div className="flex items-center gap-1.5 font-mono text-micro uppercase tracking-widest text-muted-foreground">
          <LayoutGrid className="size-3 text-(--color-fg-faint)" aria-hidden />
          <span>Layout</span>
        </div>
        <div
          role="tablist"
          aria-label="Profile layout"
          className="inline-flex rounded-[var(--radius-sm)] border border-border bg-(--color-bg) p-0.5"
        >
          {PROFILE_LAYOUTS.map((option) => (
            <LayoutOption
              key={option.id}
              id={option.id}
              label={option.name}
              description={option.description}
              active={current === option.id}
              onSelect={() => set(option.id)}
            />
          ))}
        </div>
        <span className="hidden font-mono text-micro italic text-(--color-fg-faint) sm:inline">
          {PROFILE_LAYOUTS.find((l) => l.id === current)?.description}
        </span>
      </Container>
    </div>
  );
}

function LayoutOption({
  id,
  label,
  description,
  active,
  onSelect,
}: {
  id: ProfileLayoutId;
  label: string;
  description: string;
  active: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={active}
      aria-controls={`profile-layout-${id}`}
      title={description}
      onClick={onSelect}
      className={cn(
        "rounded-[var(--radius-xs)] px-2.5 py-1 font-mono text-caption leading-none",
        "transition-colors",
        active
          ? "bg-(--color-bg-sunken) text-foreground shadow-[0_-1.5px_0_var(--color-accent)_inset]"
          : "text-muted-foreground hover:text-foreground",
      )}
    >
      {label}
    </button>
  );
}
