import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";
import { borders, radius } from "@/lib/design-system";

const inputVariants = cva(
  `flex w-full ${borders.hairline} ${borders.subtle} bg-card/50 transition-colors file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/70 disabled:cursor-not-allowed disabled:opacity-50`,
  {
    variants: {
      size: {
        sm: "h-8 px-3 py-1.5 text-xs rounded-md",
        md: "h-9 px-3 py-2 text-sm rounded-lg",
        lg: "h-10 px-4 py-2.5 text-base rounded-lg",
      },
    },
    defaultVariants: {
      size: "md",
    },
  }
);

type InputProps = React.InputHTMLAttributes<HTMLInputElement> & {
  size?: "sm" | "md" | "lg";
};

const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, type = "text", size = "md", ...props }, ref) => {
    const variantSize =
      size === "sm" || size === "md" || size === "lg" ? size : "md";
    return (
      <input
        type={type}
        className={cn(inputVariants({ size: variantSize }), className)}
        ref={ref}
        {...props}
      />
    );
  }
);
Input.displayName = "Input";

export { Input, inputVariants };
