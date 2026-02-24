import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"
import { borders } from "@/lib/design-system"

const textareaVariants = cva(
  `flex w-full rounded-lg ${borders.hairline} ${borders.subtle} bg-card/50 px-3 py-2 text-sm placeholder:text-muted-foreground transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/70 disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:ring-destructive/20 aria-invalid:border-destructive`,
  {
    variants: {
      size: {
        sm: "min-h-16",
        md: "min-h-24",
        lg: "min-h-32",
      },
    },
    defaultVariants: {
      size: "md",
    },
  }
)

interface TextareaProps extends React.ComponentProps<"textarea">, VariantProps<typeof textareaVariants> {}

const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ className, size, ...props }, ref) => (
    <textarea
      ref={ref}
      data-slot="textarea"
      className={cn(textareaVariants({ size }), className)}
      {...props}
    />
  )
)
Textarea.displayName = "Textarea"

export { Textarea, textareaVariants }
