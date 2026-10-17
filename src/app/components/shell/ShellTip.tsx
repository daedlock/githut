import { Children, type ComponentProps, Fragment, type ReactNode } from "react";
import { TooltipContent } from "@/app/components/ui/tooltip";
import { cn } from "@/app/lib/cn";

/**
 * The tooltip for islands and app chrome (tabs, sidebar rows): inverted to the
 * theme, a title line, then one quiet detail line whose parts are joined by
 * "·". Identifiers truncate on one line rather than wrap. Content previews
 * (#refs, @mentions) use `EntityHoverCard` instead.
 */
export function ShellTipContent({
  title,
  detail,
  className,
  ...props
}: { title: ReactNode; detail?: ReactNode[] } & Omit<
  ComponentProps<typeof TooltipContent>,
  "title" | "children"
>) {
  const parts = Children.toArray(detail?.filter(Boolean));
  return (
    <TooltipContent
      className={cn(
        "max-w-75 flex-col items-start gap-0.5 rounded-lg px-2.5 py-1.5 text-caption",
        className,
      )}
      {...props}
    >
      <span className="line-clamp-2 font-medium text-pretty">{title}</span>
      {parts.length > 0 && (
        <span
          data-shell-tip-detail
          className="flex max-w-full min-w-0 items-center gap-1.5 text-micro whitespace-nowrap text-background/65"
        >
          {parts.map((part, i) => (
            // biome-ignore lint/suspicious/noArrayIndexKey: parts are positional and short-lived
            <Fragment key={i}>
              {i > 0 && <span aria-hidden>·</span>}
              {part}
            </Fragment>
          ))}
        </span>
      )}
    </TooltipContent>
  );
}

/** A mono identifier in a tooltip's detail line (`owner/repo#12`); truncates. */
export function TipId({ children }: { children: ReactNode }) {
  return <span className="min-w-0 truncate font-mono">{children}</span>;
}

/** A state dot in a tooltip's detail line, coloured by a text-colour class. */
export function TipDot({ className }: { className: string }) {
  return (
    <span aria-hidden className={cn("size-1.5 shrink-0 rounded-full bg-current", className)} />
  );
}
