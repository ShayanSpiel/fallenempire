"use client";

import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const progressVariants = cva(
  "relative w-full overflow-hidden rounded-full bg-muted",  // Already full rounded
  {
    variants: {
      size: {
        xs: "h-1",
        sm: "h-1.5",
        md: "h-2",
        lg: "h-3",
      },
      color: {
        default: "bg-muted [&_div]:bg-foreground",
        primary: "bg-primary/20 [&_div]:bg-primary",
        secondary: "bg-secondary/20 [&_div]:bg-secondary",
        success: "bg-success/20 [&_div]:bg-success",
        warning: "bg-warning/20 [&_div]:bg-warning",
        destructive: "bg-destructive/20 [&_div]:bg-destructive",
      },
    },
    defaultVariants: {
      size: "md",
      color: "default",
    },
  }
);

type ProgressProps = React.ComponentPropsWithoutRef<"div"> & {
  value?: number;
  size?: "xs" | "sm" | "md" | "lg";
  color?: "default" | "primary" | "secondary" | "success" | "warning" | "destructive";
};

const Progress = React.forwardRef<HTMLDivElement, ProgressProps>(
  ({ className, value = 0, size = "md", color = "default", ...props }, ref) => {
    const validSize = (size as "xs" | "sm" | "md" | "lg") || "md";
    const validColor = (color as "default" | "primary" | "secondary" | "success" | "warning" | "destructive") || "default";
    return (
    <div
      ref={ref}
      className={cn(progressVariants({ size: validSize, color: validColor }), className)}
      {...props}
    >
      <div
        className="h-full w-full rounded-full transition-all duration-300"
        style={{ transform: `translateX(-${100 - Math.min(100, Math.max(0, value))}%)` }}
      />
    </div>
  );
  }
);
Progress.displayName = "Progress";

export { Progress, progressVariants };
