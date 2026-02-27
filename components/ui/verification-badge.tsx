"use client";

import { Check } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

export type UserTier = "alpha" | "sigma" | "omega";

interface VerificationBadgeProps {
  tier: UserTier;
  size?: "xs" | "sm" | "md" | "lg";
  className?: string;
}

const sizeClasses = {
  xs: "h-3 w-3",
  sm: "h-3.5 w-3.5",
  md: "h-4 w-4",
  lg: "h-5 w-5",
};

const checkSizeClasses = {
  xs: "h-2 w-2",
  sm: "h-2 w-2",
  md: "h-2.5 w-2.5",
  lg: "h-3 w-3",
};

export function VerificationBadge({
  tier,
  size = "sm",
  className,
}: VerificationBadgeProps) {
  // Alpha tier has no badge
  if (tier === "alpha") {
    return null;
  }

  const badge = (
    <div
      className={cn(
        "inline-flex items-center justify-center rounded-full flex-shrink-0",
        sizeClasses[size],
        tier === "sigma" && "bg-blue-500",
        tier === "omega" &&
          "bg-gradient-to-br from-yellow-400 via-amber-500 to-yellow-600 shadow-sm shadow-amber-500/20",
        className
      )}
    >
      <Check
        className={cn(
          "text-white font-bold stroke-[3]",
          checkSizeClasses[size]
        )}
      />
    </div>
  );

  return (
    <Tooltip delayDuration={200}>
      <TooltipTrigger asChild>
        {badge}
      </TooltipTrigger>
      <TooltipContent
        className={cn(
          "animate-in fade-in-0 zoom-in-95 duration-200 rounded-lg",
          "flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold",
          tier === "sigma" && "bg-blue-500 text-white border-blue-600",
          tier === "omega" && "bg-gradient-to-r from-yellow-400 to-yellow-500 text-white border-yellow-600"
        )}
      >
        <Check className="h-3 w-3 stroke-[3]" />
        {tier === "sigma" ? "Verified Sigma" : "Verified Omega"}
      </TooltipContent>
    </Tooltip>
  );
}
