"use client";

import React from "react";
import { cn } from "@/lib/utils";
import { Battery } from "lucide-react";

interface ExhaustionIndicatorProps {
  active: boolean;
  regenMultiplier: number; // e.g., 0.5 = 50% regen
  hoursUntilClear?: number;
  className?: string;
}

export function ExhaustionIndicator({
  active,
  regenMultiplier,
  hoursUntilClear,
  className,
}: ExhaustionIndicatorProps) {
  if (!active || regenMultiplier >= 1.0) {
    return null;
  }

  const regenPenalty = Math.round((1.0 - regenMultiplier) * 100);
  const severity = regenMultiplier < 0.7 ? "severe" : "moderate";

  const getSeverityColor = () => {
    if (severity === "severe") return "bg-red-500/20 border-red-500/50 text-red-500";
    return "bg-orange-500/20 border-orange-500/50 text-orange-500";
  };

  return (
    <div
      className={cn(
        "flex items-center gap-2 px-3 py-1.5 rounded-lg border backdrop-blur-sm",
        getSeverityColor(),
        className
      )}
    >
      <Battery size={14} className="flex-shrink-0" />
      <div className="flex flex-col">
        <span className="text-[10px] font-bold uppercase tracking-wider">
          Exhausted
        </span>
        <span className="text-xs font-black tabular-nums">
          -{regenPenalty}% Energy Regen
        </span>
        {hoursUntilClear !== undefined && hoursUntilClear > 0 && (
          <span className="text-[9px] opacity-80">
            {hoursUntilClear.toFixed(1)}h until recovery
          </span>
        )}
      </div>
    </div>
  );
}
