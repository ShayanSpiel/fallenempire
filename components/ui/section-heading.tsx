"use client";

import { Info } from "lucide-react";
import type { ElementType, ReactNode } from "react";

import { cn } from "@/lib/utils";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

type SectionHeadingProps = {
  title: ReactNode;
  icon?: ElementType;
  iconNode?: ReactNode;
  tooltip?: string;
  actions?: ReactNode;
  className?: string;
};

export function SectionHeading({
  title,
  icon: Icon,
  iconNode,
  tooltip,
  actions,
  className,
}: SectionHeadingProps) {
  const renderIcon = iconNode ? (
    <span className="inline-flex items-center">{iconNode}</span>
  ) : Icon ? (
    <Icon size={14} className="text-muted-foreground" />
  ) : null;

  return (
    <div
      className={cn(
        "flex items-center justify-between gap-3 border-b border-border/60 pb-3 mb-5",
        className
      )}
    >
      <div className="flex items-center gap-2">
        {renderIcon}
        <span className="text-xs font-bold uppercase tracking-[0.3em] text-muted-foreground font-nav flex items-center gap-2">
          {title}
        </span>
        {tooltip && (
          <TooltipProvider delayDuration={0}>
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  type="button"
                  className="inline-flex h-5 w-5 items-center justify-center rounded-full text-muted-foreground/70 hover:text-primary transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/70"
                >
                  <Info size={12} />
                </button>
              </TooltipTrigger>
              <TooltipContent className="max-w-[220px] text-xs text-foreground">
                {tooltip}
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        )}
      </div>
      {actions}
    </div>
  );
}
