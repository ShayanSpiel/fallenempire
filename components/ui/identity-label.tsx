"use client";

import { cn } from "@/lib/utils";

type IdentityLabelProps = {
  label?: string | null;
  className?: string;
};

export function IdentityLabel({ label, className }: IdentityLabelProps) {
  return (
    <span
      className={cn(
        "text-[11px] text-accent/80 font-mono uppercase tracking-wide font-semibold",
        className
      )}
    >
      {label ?? "Operative"}
    </span>
  );
}
