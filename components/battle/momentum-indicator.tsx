"use client";

import React from "react";
import { cn } from "@/lib/utils";
import { Zap } from "lucide-react";

interface MomentumIndicatorProps {
  active: boolean;
  moraleBonus: number; // e.g., 15
  hoursRemaining?: number;
  className?: string;
}

export function MomentumIndicator({
  active,
  moraleBonus,
  hoursRemaining,
  className,
}: MomentumIndicatorProps) {
  if (!active || moraleBonus <= 0) {
    return null;
  }

  const intensity = hoursRemaining && hoursRemaining <= 2 ? "fading" : hoursRemaining && hoursRemaining <= 6 ? "active" : "strong";

  const getIntensityColor = () => {
    if (intensity === "fading") return "bg-yellow-500/20 border-yellow-500/50 text-yellow-500";
    if (intensity === "active") return "bg-green-500/20 border-green-500/50 text-green-500";
    return "bg-blue-500/20 border-blue-500/50 text-blue-500";
  };

  return (
    <div
      className={cn(
        "flex items-center gap-2 px-3 py-1.5 rounded-lg border backdrop-blur-sm",
        getIntensityColor(),
        className
      )}
    >
      <Zap size={14} className="flex-shrink-0" />
      <div className="flex flex-col">
        <span className="text-[10px] font-bold uppercase tracking-wider">
          Momentum
        </span>
        <span className="text-xs font-black tabular-nums">
          +{moraleBonus} Morale
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
