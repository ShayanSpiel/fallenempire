"use client"

import * as React from "react"
import * as SheetPrimitive from "@radix-ui/react-dialog"
import { cva } from "class-variance-authority"

import { cn } from "@/lib/utils"

const sheetVariants = cva(
  "fixed z-50 grid gap-4 border border-border/40 bg-card p-6 shadow-lg transition-all duration-200 data-[state=open]:animate-in data-[state=closed]:animate-out",
  {
    variants: {
      side: {
        top: "inset-x-0 top-0 h-auto w-full rounded-b-2xl md:rounded-none md:shadow-none",
        bottom: "inset-x-0 bottom-0 h-auto w-full rounded-t-2xl",
        left: "inset-y-0 left-0 h-full w-full max-w-xs rounded-r-2xl",
        right: "inset-y-0 right-0 h-full w-full max-w-xs rounded-l-2xl",
      },
    },
    defaultVariants: {
      side: "right",
    },
  }
)

const Sheet = SheetPrimitive.Root
const SheetTrigger = SheetPrimitive.Trigger
const SheetClose = SheetPrimitive.Close
const SheetPortal = SheetPrimitive.Portal

const SheetOverlay = React.forwardRef<
  React.ElementRef<typeof SheetPrimitive.Overlay>,
  React.ComponentPropsWithoutRef<typeof SheetPrimitive.Overlay>
>(({ className, ...props }, ref) => (
  <SheetPrimitive.Overlay
    ref={ref}
    className={cn(
      "fixed inset-0 z-40 bg-background/60 backdrop-blur-sm transition-opacity",
      className
    )}
    {...props}
  />
))
SheetOverlay.displayName = SheetPrimitive.Overlay.displayName

const SheetContent = React.forwardRef<
  React.ElementRef<typeof SheetPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof SheetPrimitive.Content> & {
    side?: "top" | "bottom" | "left" | "right"
  }
>(({ className, side = "right", ...props }, ref) => (
  <SheetPortal>
    <SheetOverlay />
    <SheetPrimitive.Content
      ref={ref}
      className={cn(sheetVariants({ side, className }))}
      {...props}
    />
  </SheetPortal>
))
SheetContent.displayName = SheetPrimitive.Content.displayName

const SheetTitle = React.forwardRef<
  React.ElementRef<typeof SheetPrimitive.Title>,
  React.ComponentPropsWithoutRef<typeof SheetPrimitive.Title>
>((props, ref) => (
  <SheetPrimitive.Title ref={ref} {...props} />
))
SheetTitle.displayName = SheetPrimitive.Title.displayName

const SheetHeader = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div ref={ref} className={cn("space-y-1 px-2", className)} {...props} />
))
SheetHeader.displayName = "SheetHeader"

const SheetDescription = React.forwardRef<
  React.ElementRef<typeof SheetPrimitive.Description>,
  React.ComponentPropsWithoutRef<typeof SheetPrimitive.Description>
>((props, ref) => (
  <SheetPrimitive.Description ref={ref} {...props} />
))
SheetDescription.displayName = SheetPrimitive.Description.displayName

const SheetFooter = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div ref={ref} className={cn("flex flex-row items-center justify-end p-2", className)} {...props} />
))
SheetFooter.displayName = "SheetFooter"

export {
  Sheet,
  SheetTrigger,
  SheetClose,
  SheetContent,
  SheetOverlay,
  SheetTitle,
  SheetHeader,
  SheetDescription,
  SheetFooter,
}
