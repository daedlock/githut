import { cn } from "@/app/lib/cn"

function Skeleton({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="skeleton"
      className={cn("rounded-[var(--radius-xs)] bg-[var(--color-bg-sunken)]", className)}
      {...props}
    />
  )
}

export { Skeleton }
