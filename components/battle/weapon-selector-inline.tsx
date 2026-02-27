"use client";

import React, { useState } from "react";
import { cn } from "@/lib/utils";
import {
  WeaponQualityIcon,
  getWeaponDamageBonusPercent,
  getQualityColor,
} from "@/components/ui/weapon-quality-icon";
import { X } from "lucide-react";
import { Badge } from "@/components/ui/badge";

interface WeaponInventoryItem {
  id: string;
  quality_tier: number;
  quantity: number;
}

interface WeaponSelectorInlineProps {
  weaponInventory: WeaponInventoryItem[];
  selectedWeaponQuality: number | null;
  onSelectWeapon: (weaponId: string, quality: number) => void;
  onClearWeapon: () => void;
  className?: string;
}

export function WeaponSelectorInline({
  weaponInventory,
  selectedWeaponQuality,
  onSelectWeapon,
  onClearWeapon,
  className,
}: WeaponSelectorInlineProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  return (
    <div className={cn("relative", className)}>
      {/* Collapsed Button - Matches other control buttons */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className={cn(
          "rounded-2xl h-12 w-12 md:h-16 md:w-16 flex-shrink-0 relative group text-2xl md:text-3xl transition-all flex items-center justify-center border border-b-4",
          selectedWeaponQuality
            ? "bg-gradient-to-br from-orange-500/90 to-red-600/90 border-orange-400/60 shadow-lg shadow-orange-500/30"
            : "bg-gradient-to-br from-slate-700/80 via-slate-800/80 to-slate-900/80 border-slate-600 hover:from-slate-600/80 hover:via-slate-700/80 hover:to-slate-800/80 shadow-md",
        )}
      >
        {selectedWeaponQuality ? (
          <div className="flex flex-col items-center justify-center">
            <WeaponQualityIcon tier={selectedWeaponQuality} size="sm" />
            <Badge className={cn("absolute -bottom-1 -right-1 h-4 w-4 flex items-center justify-center text-[8px] p-0 border-2 border-background", getQualityColor(selectedWeaponQuality))}>
              {weaponInventory.find(w => w.quality_tier === selectedWeaponQuality)?.quantity || 0}
            </Badge>
          </div>
        ) : (
          "🔫"
        )}
      </button>

      {/* Expanded Panel - Absolutely positioned above */}
      {isExpanded && (
        <>
          {/* Backdrop */}
          <div
            className="fixed inset-0 z-[100]"
            onClick={() => setIsExpanded(false)}
          />

          {/* Panel - Positioned just above stat bars */}
          <div
            className={cn(
              "fixed bottom-[100px] md:bottom-[130px] left-1/2 -translate-x-1/2 z-[101]",
              "flex items-center gap-1 p-2 rounded-lg backdrop-blur-xl border border-white/20",
              "bg-gradient-to-b from-slate-900/95 to-slate-950/95 shadow-2xl",
              "animate-in fade-in slide-in-from-bottom-2 duration-200"
            )}
          >
            {/* Close button */}
            <button
              onClick={() => setIsExpanded(false)}
              className="absolute -top-2 -right-2 h-6 w-6 rounded-full bg-slate-800 border border-slate-600 flex items-center justify-center hover:bg-slate-700 transition-all z-10 shadow-lg"
            >
              <X className="h-3 w-3 text-white/70" />
            </button>

            {/* No weapon option */}
            <button
              onClick={() => {
                onClearWeapon();
                setIsExpanded(false);
              }}
              className={cn(
                "flex flex-col items-center justify-center h-12 w-12 md:h-14 md:w-14 rounded-lg transition-all relative group",
                selectedWeaponQuality === null
                  ? "bg-red-500/30 border-2 border-red-500/50"
                  : "bg-slate-800/40 border border-slate-700/30 hover:bg-slate-700/50"
              )}
            >
              <X className="h-4 w-4 text-white/70" />
              <span className="text-[8px] text-white/60 mt-0.5">None</span>
              {/* Tooltip */}
              <span className="absolute -top-7 left-1/2 -translate-x-1/2 opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none bg-black/90 text-white text-[10px] px-2 py-0.5 rounded">
                No weapon
              </span>
            </button>

            {/* Weapon quality options Q1-Q5 */}
            {[1, 2, 3, 4, 5].map((quality) => {
              const weapon = weaponInventory.find((w) => w.quality_tier === quality);
              const isSelected = selectedWeaponQuality === quality;
              const isAvailable = weapon && weapon.quantity > 0;
              const colorClass = getQualityColor(quality);
              const damageBonus = getWeaponDamageBonusPercent(quality);

              return (
                <button
                  key={quality}
                  onClick={() => {
                    if (weapon && isAvailable) {
                      onSelectWeapon(weapon.id, quality);
                      setIsExpanded(false);
                    }
                  }}
                  disabled={!isAvailable}
                  className={cn(
                    "flex flex-col items-center justify-center h-12 w-12 md:h-14 md:w-14 rounded-lg transition-all relative group",
                    isSelected && "bg-gradient-to-br from-orange-500/40 to-red-600/40 border-2 border-orange-400/60",
                    !isSelected && isAvailable && "bg-slate-800/40 border border-slate-700/30 hover:bg-slate-700/50",
                    !isAvailable && "bg-slate-900/30 border border-slate-800/20 opacity-40 cursor-not-allowed"
                  )}
                >
                  <WeaponQualityIcon tier={quality} size="sm" className={!isAvailable ? "opacity-30" : ""} />
                  <span className={cn("text-[9px] font-bold mt-0.5", isSelected ? "text-orange-400" : "text-white/60")}>
                    Q{quality}
                  </span>
                  {isAvailable && (
                    <span className={cn("absolute -top-1 -right-1 text-[9px] font-bold px-1 py-0.5 rounded bg-slate-900/90 border border-slate-700", colorClass)}>
                      {weapon.quantity}
                    </span>
                  )}
                  {/* Tooltip */}
                  {isAvailable && (
                    <span className="absolute -top-7 left-1/2 -translate-x-1/2 opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none bg-black/90 text-white text-[10px] px-2 py-0.5 rounded">
                      {damageBonus} dmg
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
