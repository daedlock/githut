import { cva, type VariantProps } from "class-variance-authority";
import { createContext, forwardRef, type HTMLAttributes, type Ref, useContext } from "react";
import { cn } from "@/app/lib/cn";

/**
 * Card — composable card primitive with explicit Header / Body / Footer slots.
 *
 * Why this exists:
 *   Inline "rounded + border + overflow-hidden" blocks kept clipping popovers
 *   that escape the Card bounds (mention dropdown, reaction picker, etc.).
 *   The fix — every time — was moving overflow-hidden off the wrapper and
 *   onto the header so the header's filled background still clips cleanly
 *   into the top corners. Card bakes that discipline in:
 *
 *     Card            → border + rounded, NO overflow-hidden
 *     CardHeader      → own overflow-hidden + rounded-top-{radius}
 *     CardBody        → plain padding slot, lets popovers escape
 *     CardFooter      → top border, bottom rounded
 *
 * Variants:
 *   radius: "md" | "lg"  — matches existing 4px / 6px usage
 *   tone:   "default"     — plain bg
 *           "subtle"      — bg-subtle (used for framed list surfaces)
 *   border: "soft" | "strong" — border vs border-strong
 *
 * Radius is passed through context so Header/Footer don't have to repeat it.
 */

const cardVariants = cva("flex flex-col", {
  variants: {
    radius: {
      md: "rounded-md",
      lg: "rounded-lg",
    },
    tone: {
      default: "bg-background",
      subtle: "bg-muted",
    },
    border: {
      soft: "border border-border",
      strong: "border border-input",
    },
  },
  defaultVariants: {
    radius: "md",
    tone: "default",
    border: "soft",
  },
});

type CardRadius = "md" | "lg";
const CardCtx = createContext<{ radius: CardRadius }>({ radius: "md" });

export type CardProps = HTMLAttributes<HTMLElement> &
  VariantProps<typeof cardVariants> & {
    /**
     * Semantic element. Defaults to "section". Use "article" for
     * standalone comments / PR reviews.
     */
    as?: "section" | "article" | "div";
  };

export const Card = forwardRef<HTMLElement, CardProps>(
  ({ className, radius = "md", tone, border, as = "section", children, ...props }, ref) => {
    const mergedClass = cn(cardVariants({ radius, tone, border }), className);
    return (
      <CardCtx.Provider value={{ radius: radius ?? "md" }}>
        {as === "article" ? (
          <article ref={ref as Ref<HTMLElement>} className={mergedClass} {...props}>
            {children}
          </article>
        ) : as === "div" ? (
          <div ref={ref as unknown as Ref<HTMLDivElement>} className={mergedClass} {...props}>
            {children}
          </div>
        ) : (
          <section ref={ref as Ref<HTMLElement>} className={mergedClass} {...props}>
            {children}
          </section>
        )}
      </CardCtx.Provider>
    );
  },
);
Card.displayName = "Card";

const headerRadius: Record<CardRadius, string> = {
  md: "rounded-t-[var(--radius-md)]",
  lg: "rounded-t-[var(--radius-lg)]",
};

const footerRadius: Record<CardRadius, string> = {
  md: "rounded-b-[var(--radius-md)]",
  lg: "rounded-b-[var(--radius-lg)]",
};

export type CardHeaderProps = HTMLAttributes<HTMLElement> & {
  /** Use subtle background (default). Pass false to inherit Card tone. */
  filled?: boolean;
};

export const CardHeader = forwardRef<HTMLElement, CardHeaderProps>(
  ({ className, filled = true, children, ...props }, ref) => {
    const { radius } = useContext(CardCtx);
    return (
      <header
        ref={ref}
        // overflow-hidden is kept ONLY on the header so the filled background
        // respects the rounded top corners — while the Card body stays
        // unconstrained, letting popovers/dropdowns escape without being
        // clipped.
        className={cn(
          "flex items-center gap-2.5 overflow-hidden border-b border-border px-4 py-2.5",
          headerRadius[radius],
          filled && "bg-muted",
          className,
        )}
        {...props}
      >
        {children}
      </header>
    );
  },
);
CardHeader.displayName = "CardHeader";

export type CardBodyProps = HTMLAttributes<HTMLElement> & {
  /** When true, removes default padding so consumers can lay out their own grid. */
  flush?: boolean;
};

export const CardBody = forwardRef<HTMLDivElement, CardBodyProps>(
  ({ className, flush = false, children, ...props }, ref) => (
    <div ref={ref} className={cn(!flush && "px-4 pb-3 pt-4", className)} {...props}>
      {children}
    </div>
  ),
);
CardBody.displayName = "CardBody";

export type CardFooterProps = HTMLAttributes<HTMLElement>;

export const CardFooter = forwardRef<HTMLElement, CardFooterProps>(
  ({ className, children, ...props }, ref) => {
    const { radius } = useContext(CardCtx);
    return (
      <footer
        ref={ref}
        className={cn(
          "border-t border-border px-3 py-2.5",
          footerRadius[radius],
          className,
        )}
        {...props}
      >
        {children}
      </footer>
    );
  },
);
CardFooter.displayName = "CardFooter";
