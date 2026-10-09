import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { Avatar as AvatarPrimitive } from "radix-ui"

import { cn } from "@/app/lib/cn"

// ─── Shadcn primitives ─────────────────────────────────────────────────────

function AvatarRoot({
  className,
  size = "default",
  ...props
}: React.ComponentProps<typeof AvatarPrimitive.Root> & {
  size?: "default" | "sm" | "lg"
}) {
  return (
    <AvatarPrimitive.Root
      data-slot="avatar"
      data-size={size}
      className={cn(
        "group/avatar relative flex size-8 shrink-0 rounded-full select-none after:absolute after:inset-0 after:rounded-full after:border after:border-border after:mix-blend-darken data-[size=lg]:size-10 data-[size=sm]:size-6 dark:after:mix-blend-lighten",
        className
      )}
      {...props}
    />
  )
}

function AvatarImage({
  className,
  loading = "lazy",
  decoding = "async",
  ...props
}: React.ComponentProps<typeof AvatarPrimitive.Image>) {
  return (
    <AvatarPrimitive.Image
      data-slot="avatar-image"
      loading={loading}
      decoding={decoding}
      className={cn(
        "aspect-square size-full rounded-full object-cover",
        className
      )}
      {...props}
    />
  )
}

function AvatarFallback({
  className,
  ...props
}: React.ComponentProps<typeof AvatarPrimitive.Fallback>) {
  return (
    <AvatarPrimitive.Fallback
      data-slot="avatar-fallback"
      className={cn(
        "flex size-full items-center justify-center rounded-full bg-muted text-ui text-muted-foreground group-data-[size=sm]/avatar:text-caption",
        className
      )}
      {...props}
    />
  )
}

function AvatarBadge({ className, ...props }: React.ComponentProps<"span">) {
  return (
    <span
      data-slot="avatar-badge"
      className={cn(
        "absolute right-0 bottom-0 z-10 inline-flex items-center justify-center rounded-full bg-primary text-primary-foreground bg-blend-color ring-2 ring-background select-none",
        "group-data-[size=sm]/avatar:size-2 group-data-[size=sm]/avatar:[&>svg]:hidden",
        "group-data-[size=default]/avatar:size-2.5 group-data-[size=default]/avatar:[&>svg]:size-2",
        "group-data-[size=lg]/avatar:size-3 group-data-[size=lg]/avatar:[&>svg]:size-2",
        className
      )}
      {...props}
    />
  )
}

function AvatarGroup({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="avatar-group"
      className={cn(
        "group/avatar-group flex -space-x-2 *:data-[slot=avatar]:ring-2 *:data-[slot=avatar]:ring-background",
        className
      )}
      {...props}
    />
  )
}

function AvatarGroupCount({
  className,
  ...props
}: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="avatar-group-count"
      className={cn(
        "relative flex size-8 shrink-0 items-center justify-center rounded-full bg-muted text-ui text-muted-foreground ring-2 ring-background group-has-data-[size=lg]/avatar-group:size-10 group-has-data-[size=sm]/avatar-group:size-6 [&>svg]:size-4 group-has-data-[size=lg]/avatar-group:[&>svg]:size-5 group-has-data-[size=sm]/avatar-group:[&>svg]:size-3",
        className
      )}
      {...props}
    />
  )
}

// ─── Domain wrapper — GitHub user avatar ───────────────────────────────────
// Accepts GitHub-domain props (login + avatarUrl) and maps them to the
// shadcn AvatarRoot + AvatarImage + AvatarFallback composition.
// Size variants match app-specific needs (xs–lg), not shadcn's sm/default/lg.

const avatarVariants = cva(
  "relative flex shrink-0 rounded-full select-none after:absolute after:inset-0 after:rounded-full  after:mix-blend-darken",
  {
    variants: {
      size: {
        xs: "size-4 text-[8px]",
        sm: "size-5 text-[9px]",
        md: "size-6 text-[10px]",
        lg: "size-7 text-[11px]",
        xl: "size-16 text-title",
      },
    },
    defaultVariants: { size: "md" },
  },
)

export type AvatarProps = {
  login: string
  avatarUrl?: string | null
  className?: string
} & VariantProps<typeof avatarVariants>

const Avatar = React.forwardRef<HTMLSpanElement, AvatarProps>(
  ({ login, avatarUrl, size, className }, ref) => {
    const initial = login.slice(0, 1) || "?"
    return (
      <AvatarPrimitive.Root
        ref={ref as React.Ref<HTMLSpanElement>}
        className={cn(avatarVariants({ size }), className)}
      >
        {avatarUrl && <AvatarImage src={avatarUrl} alt={login} />}
        <AvatarFallback className="font-mono uppercase text-muted-foreground bg-[var(--color-bg-sunken)]">
          {initial}
        </AvatarFallback>
      </AvatarPrimitive.Root>
    )
  },
)
Avatar.displayName = "Avatar"

export {
  Avatar,
  AvatarRoot,
  AvatarImage,
  AvatarFallback,
  AvatarGroup,
  AvatarGroupCount,
  AvatarBadge,
}
