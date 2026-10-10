import * as React from "react";
import { cn } from "@/app/lib/cn";

// `muted` is the standard card: a raised surface with a hairline edge and a
// soft shadow. `outline` is for documents (rendered markdown, tables).
const cardVariants = {
  default: "rounded-lg bg-card text-card-foreground",
  muted: "rounded-lg bg-muted text-card-foreground",
  outline: "rounded-lg border border-border bg-card text-card-foreground",
};

function Card({
  className,
  variant = "default",
  ...props
}: React.ComponentProps<"div"> & { variant?: keyof typeof cardVariants }) {
  return (
    <div
      data-slot="card"
      // Controls inside a raised panel step their hover to stay visible.
      data-surface={variant === "muted" ? "raised" : undefined}
      className={cn(
        "border border-border/60 shadow-sm dark:border-[rgba(255,255,255,.03)]",
        cardVariants[variant],
        className,
      )}
      {...props}
    />
  );
}

function CardHeader({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="card-header"
      className={cn("flex flex-col gap-1.5 p-4", className)}
      {...props}
    />
  );
}

function CardTitle({ className, ...props }: React.ComponentProps<"h3">) {
  return (
    <h3
      data-slot="card-title"
      className={cn("text-ui font-medium leading-none", className)}
      {...props}
    />
  );
}

function CardDescription({ className, ...props }: React.ComponentProps<"p">) {
  return (
    <p
      data-slot="card-description"
      className={cn("text-caption text-muted-foreground", className)}
      {...props}
    />
  );
}

function CardContent({ className, ...props }: React.ComponentProps<"div">) {
  return <div data-slot="card-content" className={cn("p-4 pt-0", className)} {...props} />;
}

function CardFooter({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="card-footer"
      className={cn("flex items-center p-4 pt-0", className)}
      {...props}
    />
  );
}

export { Card, CardHeader, CardFooter, CardTitle, CardDescription, CardContent };
