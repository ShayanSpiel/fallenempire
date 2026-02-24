import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

const badgeVariants = cva(
  "inline-flex items-center gap-1 font-medium uppercase tracking-wide transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50 disabled:pointer-events-none disabled:opacity-50",
  {
    variants: {
      variant: {
        default: "bg-muted text-muted-foreground px-2 py-1 rounded-full text-xs",
        minimal: "bg-muted text-muted-foreground px-1.5 py-0.5 rounded-full text-[10px]",
        secondary: "bg-secondary/20 text-secondary-foreground px-2 py-1 rounded-full text-xs",
        accent: "bg-accent text-accent-foreground px-2 py-1 rounded-full text-xs",
        outline: "border border-border bg-background/60 px-2 py-1 rounded-full text-xs",
        success: "bg-success/20 text-success px-2 py-1 rounded-full text-xs",
        warning: "bg-warning/20 text-warning px-2 py-1 rounded-full text-xs",
        destructive: "bg-destructive/20 text-destructive px-2 py-1 rounded-full text-xs",
        gradient: "bg-gradient-to-r from-amber-500 to-amber-400 dark:from-sky-500 dark:to-sky-400 text-white px-2 py-1 rounded-full text-xs font-bold shadow-md dark:shadow-sky-500/30 shadow-amber-500/30",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  },
)

const Badge = React.forwardRef<
  React.ElementRef<"span">,
  React.ComponentPropsWithoutRef<"span"> & VariantProps<typeof badgeVariants>
>(({ className, variant, ...props }, ref) => (
  <span ref={ref} className={cn(badgeVariants({ variant, className }))} {...props} />
))

Badge.displayName = "Badge"

export { Badge, badgeVariants }
