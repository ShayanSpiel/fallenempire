"use client";

import React from "react";
import { cn } from "@/lib/utils";
import { AlertTriangle } from "lucide-react";

interface DisarrayIndicatorProps {
  active: boolean;
  multiplier: number; // e.g., 3.0 = 3x energy cost
  hoursRemaining?: number;
  className?: string;
}

export function DisarrayIndicator({
  active,
  multiplier,
  hoursRemaining,
  className,
}: DisarrayIndicatorProps) {
  if (!active || multiplier <= 1.0) {
    return null;
  }

  const severity = multiplier >= 2.5 ? "severe" : multiplier >= 1.5 ? "moderate" : "mild";

  const getSeverityColor = () => {
    if (severity === "severe") return "bg-red-500/20 border-red-500/50 text-red-500";
    if (severity === "moderate") return "bg-orange-500/20 border-orange-500/50 text-orange-500";
    return "bg-yellow-500/20 border-yellow-500/50 text-yellow-500";
  };

  return (
    <div
      className={cn(
        "flex items-center gap-2 px-3 py-1.5 rounded-lg border backdrop-blur-sm",
        getSeverityColor(),
        className
      )}
    >
      <AlertTriangle size={14} className="flex-shrink-0" />
      <div className="flex flex-col">
        <span className="text-[10px] font-bold uppercase tracking-wider">
          Disarray
        </span>
        <span className="text-xs font-black tabular-nums">
          {multiplier.toFixed(1)}x Energy Cost
        </span>
        {hoursRemaining !== undefined && hoursRemaining > 0 && (
          <span className="text-[9px] opacity-80">
            {hoursRemaining.toFixed(1)}h remaining
          </span>
        )}
      </div>
    </div>
  );
}
