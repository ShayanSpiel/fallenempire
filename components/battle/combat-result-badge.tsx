"use client";

import React from "react";
import { cn } from "@/lib/utils";
import { Target, X, Flame } from "lucide-react";

interface CombatResultBadgeProps {
  result: "HIT" | "CRITICAL" | "MISS";
  damage?: number;
  className?: string;
}

export function CombatResultBadge({
  result,
  damage,
  className,
}: CombatResultBadgeProps) {
  const getResultConfig = () => {
    switch (result) {
      case "CRITICAL":
        return {
          icon: <Flame size={16} className="animate-pulse" />,
          bg: "bg-red-600/90",
          text: "text-white",
          border: "border-red-400",
          label: "CRITICAL",
          shadow: "shadow-red-500/50",
        };
      case "HIT":
        return {
          icon: <Target size={16} />,
          bg: "bg-green-600/90",
          text: "text-white",
          border: "border-green-400",
          label: "HIT",
          shadow: "shadow-green-500/50",
        };
      case "MISS":
        return {
          icon: <X size={16} />,
          bg: "bg-gray-600/90",
          text: "text-white",
          border: "border-gray-400",
          label: "MISS",
          shadow: "shadow-gray-500/50",
        };
    }
  };

  const config = getResultConfig();

  return (
    <div
      className={cn(
        "inline-flex items-center gap-2 px-3 py-1 rounded-full border-2 backdrop-blur-sm shadow-lg",
        config.bg,
        config.text,
        config.border,
        config.shadow,
        className
      )}
    >
      {config.icon}
      <span className="text-xs font-black uppercase tracking-wider">
        {config.label}
      </span>
      {damage !== undefined && damage > 0 && (
        <span className="text-xs font-bold tabular-nums">
          {damage.toLocaleString()}
        </span>
      )}
    </div>
  );
}
