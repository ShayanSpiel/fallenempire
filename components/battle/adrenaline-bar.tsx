"use client";

import React from "react";
import { cn } from "@/lib/utils";

interface AdrenalineBarProps {
  bonusRage: number; // 0-33 (or whatever max is configured)
  percentElapsed: number; // 0-100 (progress through final stand window)
  isActive: boolean; // Whether condition is currently met
  maxRage?: number; // Maximum rage for percentage calculation (default: 33)
  className?: string;
}

function AdrenalineBarComponent({
  bonusRage,
  percentElapsed,
  isActive,
  maxRage = 33,
  className,
}: AdrenalineBarProps) {
  const fillPercentage = Math.max(0, Math.min(100, (bonusRage / maxRage) * 100));

  // Position emoji at the tip of the rage fill
  const emojiPosition = fillPercentage;

  return (
    <div
      className={cn(
        "relative w-full transition-all duration-500",
        isActive ? "opacity-100 scale-100" : "opacity-0 scale-95 h-0 overflow-hidden",
        className
      )}
    >
      {/* Thin adrenaline bar */}
      <div className="relative h-8 rounded-lg overflow-hidden bg-slate-900/90 backdrop-blur-md border border-yellow-500/40 shadow-lg shadow-yellow-500/20">
        {/* Progress fill with amber/red gradient */}
        <div
          className={cn(
            "absolute inset-y-0 left-0 transition-all duration-300",
            "bg-gradient-to-r from-amber-600 via-red-500 to-red-700",
            isActive && "animate-pulse-slow"
          )}
          style={{ width: `${fillPercentage}%` }}
        />

        {/* Shimmer effect */}
        <div
          className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent animate-shimmer"
          style={{
            backgroundSize: "200% 100%",
          }}
        />

        {/* Content layer */}
        <div className="relative h-full flex items-center px-2">
          {/* Steaming emoji with pinging red dot */}
          <div
            className="absolute left-0 transition-all duration-500 ease-out"
            style={{
              left: `${emojiPosition}%`,
              transform: "translateX(-50%)",
            }}
          >
            <div className="relative">
              {/* Pinging red dot background */}
              <div className="absolute inset-0 flex items-center justify-center">
              <div className="w-7 h-7 bg-red-500/40 rounded-full animate-ping" />
            </div>

            {/* Steaming face emoji with blinking animation */}
            <div
              className={cn(
                "relative text-2xl select-none",
                isActive && "animate-blink-fade"
              )}
            >
              😡
            </div>
          </div>
        </div>

          {/* Center label */}
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
            <span
              className={cn(
                "text-sm font-black uppercase tracking-wider text-red-700",
                isActive && "animate-pulse"
              )}
              style={{ WebkitTextStroke: "0.6px #ffffff", textShadow: "0 0 0.5px #ffffff" }}
            >
              2x Damage Difference!!
            </span>
          </div>

          {/* Bonus rage display */}
          <div className="ml-auto flex items-center gap-1 bg-black/30 px-2 py-0.5 rounded backdrop-blur-sm">
            <span className="text-xs font-bold text-amber-300">+{bonusRage}</span>
            <span className="text-[10px] font-semibold text-amber-400/80">RAGE</span>
          </div>
        </div>
      </div>

      {/* Bottom glow effect when active */}
      {isActive && (
        <div className="absolute -bottom-1 left-0 right-0 h-1 bg-gradient-to-r from-transparent via-yellow-500/50 to-transparent blur-sm" />
      )}
    </div>
  );
}

export const AdrenalineBar = React.memo(AdrenalineBarComponent);

// Add custom animations to globals.css or Tailwind config:
// @keyframes blink-fade {
//   0%, 100% { opacity: 1; }
//   50% { opacity: 0.6; }
// }
// @keyframes pulse-slow {
//   0%, 100% { opacity: 1; }
//   50% { opacity: 0.85; }
// }
// @keyframes shimmer {
//   0% { background-position: -200% 0; }
//   100% { background-position: 200% 0; }
// }
// .animate-blink-fade { animation: blink-fade 1.5s ease-in-out infinite; }
// .animate-pulse-slow { animation: pulse-slow 2s ease-in-out infinite; }
// .animate-shimmer { animation: shimmer 3s linear infinite; }
