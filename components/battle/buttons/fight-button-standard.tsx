"use client";

import React from "react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";
import { BATTLE_THEME } from "@/lib/battle-theme";

export interface FightButtonProps {
  onFight: () => void;
  disabled: boolean;
  loading: boolean;
  userSide: "attacker" | "defender" | null;
}

export function FightButtonStandard({ onFight, disabled, loading }: FightButtonProps) {
  return (
    <div className="mx-2 md:mx-4">
      <Button
        onClick={onFight}
        disabled={disabled}
        className={cn(
          "relative overflow-visible text-lg font-black uppercase tracking-widest h-12 md:h-16 rounded-2xl px-8 md:px-12 md:min-w-[180px] active:border-b-0 active:translate-y-1 transition-all min-w-fit border border-b-4 border-amber-900/60 shadow-lg shadow-amber-900/30",
          BATTLE_THEME.ui.buttons.fight.bg,
          BATTLE_THEME.ui.buttons.fight.text,
          BATTLE_THEME.ui.buttons.fight.hover
        )}
      >
        {loading ? <Loader2 className="animate-spin h-5 md:h-8 w-5 md:w-8" /> : "FIGHT"}
      </Button>
    </div>
  );
}
