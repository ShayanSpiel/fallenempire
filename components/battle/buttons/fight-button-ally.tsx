"use client";

import React from "react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Loader2, Shield } from "lucide-react";

export interface FightButtonProps {
  onFight: () => void;
  disabled: boolean;
  loading: boolean;
  userSide: "attacker" | "defender" | null;
}

/**
 * Ally Fight Button - For allied communities fighting for another community
 * Different styling to indicate ally status
 */
export function FightButtonAlly({ onFight, disabled, loading }: FightButtonProps) {
  return (
    <div className="mx-2 md:mx-4">
      <Button
        onClick={onFight}
        disabled={disabled}
        className={cn(
          "relative overflow-visible text-lg font-black uppercase tracking-widest h-12 md:h-16 rounded-2xl px-8 md:px-12 md:min-w-[180px] active:border-b-0 active:translate-y-1 transition-all min-w-fit border border-b-4 shadow-lg",
          // Ally-specific styling (blue theme)
          "bg-gradient-to-b from-blue-200 via-blue-400 to-blue-600",
          "text-white",
          "hover:from-blue-100 hover:via-blue-350 hover:to-blue-500",
          "border-blue-900/60 shadow-blue-900/30"
        )}
      >
        {loading ? (
          <Loader2 className="animate-spin h-5 md:h-8 w-5 md:w-8" />
        ) : (
          <span className="flex items-center gap-2">
            <Shield className="h-5 w-5" />
            FIGHT AS ALLY
          </span>
        )}
      </Button>
    </div>
  );
}
