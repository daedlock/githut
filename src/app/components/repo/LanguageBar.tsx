import type { LanguageShare } from "@/app/hooks/useRepoLanguages";
import { cn } from "@/app/lib/cn";

const SLOT_VARS = [
  "var(--chart-slot-1)",
  "var(--chart-slot-2)",
  "var(--chart-slot-3)",
  "var(--chart-slot-4)",
  "var(--chart-slot-5)",
  "var(--chart-slot-6)",
];

function slotColor(index: number): string {
  return (index < SLOT_VARS.length ? SLOT_VARS[index] : undefined) ?? "var(--chart-other)";
}

export function LanguageBar({
  languages,
  className,
}: {
  languages: LanguageShare[];
  className?: string;
}) {
  if (languages.length === 0) return null;

  const displayed = languages.slice(0, 6);
  const otherPct = languages.slice(6).reduce((sum, l) => sum + l.percentage, 0);

  return (
    <div className={cn("flex flex-col gap-3", className)}>
      {/* stacked bar */}
      <div className="flex h-2 w-full overflow-hidden rounded-full gap-px">
        {displayed.map((lang, i) => (
          <div
            key={lang.name}
            title={`${lang.name} ${lang.percentage.toFixed(1)}%`}
            style={{
              width: `${lang.percentage}%`,
              backgroundColor: slotColor(i),
            }}
          />
        ))}
        {otherPct > 0 && (
          <div
            title={`Other ${otherPct.toFixed(1)}%`}
            style={{ width: `${otherPct}%`, backgroundColor: "var(--chart-other)" }}
          />
        )}
      </div>

      {/* legend */}
      <div className="flex flex-wrap gap-x-3 gap-y-1.5">
        {displayed.map((lang, i) => (
          <div key={lang.name} className="flex items-center gap-1.5">
            <span
              className="inline-block h-2.5 w-2.5 rounded-full flex-shrink-0"
              style={{ backgroundColor: slotColor(i) }}
            />
            <span className="font-mono text-[11px] text-[var(--color-fg-muted)]">{lang.name}</span>
            <span className="font-mono text-[11px] text-[var(--color-fg-faint)]">
              {lang.percentage.toFixed(1)}%
            </span>
          </div>
        ))}
        {otherPct > 0 && (
          <div className="flex items-center gap-1.5">
            <span
              className="inline-block h-2.5 w-2.5 rounded-full flex-shrink-0"
              style={{ backgroundColor: "var(--chart-other)" }}
            />
            <span className="font-mono text-[11px] text-[var(--color-fg-muted)]">Other</span>
            <span className="font-mono text-[11px] text-[var(--color-fg-faint)]">
              {otherPct.toFixed(1)}%
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
