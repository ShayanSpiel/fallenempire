"use client"

import * as React from "react"
import * as TabsPrimitive from "@radix-ui/react-tabs"

import { cn } from "@/lib/utils"

type TabSize = "sm" | "md" | "lg"

const buttonRadiusClass = "rounded-[var(--tab-button-radius,var(--button-radius,0.5rem))]"

const tabSizeClasses: Record<TabSize, string> = {
  sm: "px-3 py-1 text-[11px]",
  md: "px-3.5 py-1.5 text-sm",
  lg: "px-4 py-2 text-sm sm:text-base",
}

const triggerBaseClasses =
  "inline-flex items-center justify-center whitespace-nowrap font-bold border border-transparent bg-transparent text-muted-foreground transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-60 gap-2 data-[state=active]:bg-card/90 data-[state=active]:text-foreground data-[state=active]:border-border/60"

const Tabs = TabsPrimitive.Root

const TabsList = React.forwardRef<
  React.ElementRef<typeof TabsPrimitive.List>,
  React.ComponentProps<typeof TabsPrimitive.List>
>(({ className, ...props }, ref) => (
  <TabsPrimitive.List
    ref={ref}
    className={cn(
      "inline-flex items-center gap-2",
      buttonRadiusClass,
      className
    )}
    {...props}
  />
))
TabsList.displayName = TabsPrimitive.List.displayName

const TabsTrigger = React.forwardRef<
  React.ElementRef<typeof TabsPrimitive.Trigger>,
  React.ComponentProps<typeof TabsPrimitive.Trigger> & {
    size?: TabSize
  }
>(({ className, size = "md", ...props }, ref) => (
  <TabsPrimitive.Trigger
    ref={ref}
    className={cn(
      triggerBaseClasses,
      tabSizeClasses[size],
      buttonRadiusClass,
      className
    )}
    {...props}
  />
))
TabsTrigger.displayName = TabsPrimitive.Trigger.displayName

const TabsContent = React.forwardRef<
  React.ElementRef<typeof TabsPrimitive.Content>,
  React.ComponentProps<typeof TabsPrimitive.Content>
>(({ className, ...props }, ref) => (
  <TabsPrimitive.Content
    ref={ref}
    className={cn(
      "mt-2 ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
      className
    )}
    {...props}
  />
))
TabsContent.displayName = TabsPrimitive.Content.displayName

export { Tabs, TabsList, TabsTrigger, TabsContent }
