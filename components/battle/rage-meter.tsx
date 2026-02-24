"use client";

import React from "react";
import { cn } from "@/lib/utils";
import { Flame } from "lucide-react";

interface RageMeterProps {
  rage: number; // 0-100
  className?: string;
}

export function RageMeter({ rage, className }: RageMeterProps) {
  const percentage = Math.max(0, Math.min(100, rage));

  // Color based on rage level
  const getRageColor = (rage: number) => {
    if (rage >= 75) return "text-red-600";
    if (rage >= 50) return "text-orange-500";
    if (rage >= 25) return "text-yellow-500";
    return "text-gray-400";
  };

  const getRageBgColor = (rage: number) => {
    if (rage >= 75) return "from-red-600 to-red-500";
    if (rage >= 50) return "from-orange-600 to-orange-500";
    if (rage >= 25) return "from-yellow-600 to-yellow-500";
    return "from-gray-500 to-gray-400";
  };

  const getRageLabel = (rage: number) => {
    if (rage >= 75) return "ENRAGED";
    if (rage >= 50) return "FURIOUS";
    if (rage >= 25) return "ANGRY";
    return "CALM";
  };

  return (
    <div className={cn("flex flex-col gap-1", className)}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <Flame size={14} className={cn("transition-colors", getRageColor(percentage))} />
          <span className="text-[10px] font-bold uppercase tracking-wider text-foreground/70">
            Rage
          </span>
        </div>
        <span className={cn("text-xs font-black tabular-nums", getRageColor(percentage))}>
          {Math.round(percentage)}%
        </span>
      </div>

      {/* Rage Bar */}
      <div className="h-2 w-full rounded-full bg-foreground/10 overflow-hidden">
        <div
          className={cn(
            "h-full rounded-full transition-all duration-300 bg-gradient-to-r",
            getRageBgColor(percentage)
          )}
          style={{ width: `${percentage}%` }}
        />
      </div>

      {/* Rage Label */}
      {percentage > 0 && (
        <div className="text-[9px] font-bold uppercase tracking-widest text-center">
          <span className={cn("transition-colors", getRageColor(percentage))}>
            {getRageLabel(percentage)}
          </span>
        </div>
      )}
    </div>
  );
}
