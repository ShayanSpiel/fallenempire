import { cn } from "@/lib/utils";
import React from "react";

// --- Display Sizes (Page Titles) ---
export function DisplayLg({ className, children, ...props }: React.HTMLAttributes<HTMLHeadingElement>) {
  return (
    <h1
      className={cn(
        "text-3xl font-extrabold tracking-tight leading-tight text-foreground",
        className
      )}
      {...props}
    >
      {children}
    </h1>
  );
}

export function DisplayMd({ className, children, ...props }: React.HTMLAttributes<HTMLHeadingElement>) {
  return (
    <h2
      className={cn(
        "text-2xl font-bold tracking-tight leading-tight text-foreground",
        className
      )}
      {...props}
    >
      {children}
    </h2>
  );
}

export function DisplaySm({ className, children, ...props }: React.HTMLAttributes<HTMLHeadingElement>) {
  return (
    <h3
      className={cn(
        "text-xl font-bold tracking-tight leading-tight text-foreground",
        className
      )}
      {...props}
    >
      {children}
    </h3>
  );
}

// --- Heading Sizes (Section Headers) ---
export function H1({ className, children, ...props }: React.HTMLAttributes<HTMLHeadingElement>) {
  return (
    <h1
      className={cn(
        "text-3xl font-extrabold tracking-tight leading-tight text-foreground",
        className
      )}
      {...props}
    >
      {children}
    </h1>
  );
}

export function H2({ className, children, ...props }: React.HTMLAttributes<HTMLHeadingElement>) {
  return (
    <h2
      className={cn(
        "text-lg font-semibold tracking-tight leading-snug flex items-center gap-2 text-foreground",
        className
      )}
      {...props}
    >
      {children}
    </h2>
  );
}

export function H3({ className, children, ...props }: React.HTMLAttributes<HTMLHeadingElement>) {
  return (
    <h3
      className={cn(
        "text-base font-semibold tracking-tight leading-snug text-foreground",
        className
      )}
      {...props}
    >
      {children}
    </h3>
  );
}

export function H4({ className, children, ...props }: React.HTMLAttributes<HTMLHeadingElement>) {
  return (
    <h4
      className={cn(
        "text-sm font-semibold tracking-tight leading-snug text-foreground",
        className
      )}
      {...props}
    >
      {children}
    </h4>
  );
}

// --- Body Text Sizes ---
export function P({ className, children, ...props }: React.HTMLAttributes<HTMLParagraphElement>) {
  return (
    <p
      className={cn("text-sm leading-relaxed text-muted-foreground", className)}
      {...props}
    >
      {children}
    </p>
  );
}

export function BodyLarge({ className, children, ...props }: React.HTMLAttributes<HTMLParagraphElement>) {
  return (
    <p
      className={cn("text-base leading-relaxed text-muted-foreground", className)}
      {...props}
    >
      {children}
    </p>
  );
}

export function BodySmall({ className, children, ...props }: React.HTMLAttributes<HTMLParagraphElement>) {
  return (
    <p
      className={cn("text-xs leading-relaxed text-muted-foreground", className)}
      {...props}
    >
      {children}
    </p>
  );
}

// --- Label/Meta Text ---
export function Label({ className, children, ...props }: React.HTMLAttributes<HTMLLabelElement>) {
  return (
    <label
      className={cn("text-xs font-medium leading-tight text-foreground", className)}
      {...props}
    >
      {children}
    </label>
  );
}

export function Meta({ className, children, ...props }: React.HTMLAttributes<HTMLSpanElement>) {
  return (
    <span
      className={cn("text-[10px] font-medium leading-tight text-muted-foreground uppercase tracking-wide", className)}
      {...props}
    >
      {children}
    </span>
  );
}

export function Small({ className, children, ...props }: React.HTMLAttributes<HTMLSpanElement>) {
  return (
    <small
      className={cn("text-xs font-medium leading-tight text-muted-foreground", className)}
      {...props}
    >
      {children}
    </small>
  );
}