import type { ReactNode } from "react";

/**
 * SidebarSection — labeled section with mono-caps heading.
 * Used in issue detail sidebar (Labels, Assignees, future: Milestones).
 */
export function SidebarSection({
  icon,
  title,
  children,
}: {
  icon: ReactNode;
  title: string;
  children: ReactNode;
}) {
  return (
    <div>
      <div className="mb-2 flex items-center gap-1.5 border-b border-[var(--color-border)] pb-1.5">
        <span className="text-[var(--color-fg-faint)]">{icon}</span>
        <span className="font-mono text-[10px] font-medium uppercase tracking-widest text-[var(--color-fg-faint)]">
          {title}
        </span>
      </div>
      {children}
    </div>
  );
}
