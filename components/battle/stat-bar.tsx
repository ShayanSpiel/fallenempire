"use client";

import React from "react";
import { cn } from "@/lib/utils";
import { LucideIcon } from "lucide-react";

interface StatBarProps {
  label?: string;
  value: number; // 0-100
  icon?: LucideIcon;
  barColor: string; // Tailwind gradient class
  iconColor?: string; // Tailwind text color class
  textColor?: string; // Tailwind text color class
  className?: string;
  children?: React.ReactNode; // Custom content to replace default label/icon/percentage
}

function StatBarComponent({
  label,
  value,
  icon: Icon,
  barColor,
  iconColor,
  textColor = "text-white",
  className,
  children,
}: StatBarProps) {
  const percentage = Math.max(0, Math.min(100, value));

  return (
    <div className={cn("flex-1 min-w-0", className)}>
      <div className="relative h-10 rounded-xl overflow-hidden bg-slate-900/70 dark:bg-slate-900/70 light:bg-slate-800/80 backdrop-blur-[22px] border border-white/20 dark:border-white/20 light:border-white/30">
        {/* Progress fill */}
        <div
          className={cn(
            "absolute inset-y-0 left-0 transition-all duration-300",
            barColor
          )}
          style={{ width: `${percentage}%` }}
        />

        {/* Content */}
        <div className="relative h-full flex items-center justify-between px-3 gap-2">
          {children ? (
            children
          ) : (
            <>
              <div className="flex items-center gap-1.5 flex-shrink-0">
                {Icon && <Icon className={cn("w-4 h-4", iconColor)} />}
                {label && (
                  <span className={cn("text-xs font-bold uppercase tracking-wider", textColor)}>
                    {label}
                  </span>
                )}
              </div>
              <span className={cn("text-sm font-black tabular-nums", textColor)}>
                {Math.round(percentage)}%
              </span>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

export const StatBar = React.memo(StatBarComponent);
