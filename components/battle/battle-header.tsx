"use client";

import React from "react";
import { cn } from "@/lib/utils";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { BATTLE_THEME } from "@/lib/battle-theme";
import type { CommunityInfo, BattleState } from "@/lib/battle/types";

interface BattleHeaderProps {
  battle: BattleState | null;
  attackerCommunity: CommunityInfo | null;
  defenderCommunity: CommunityInfo | null;
  regionLabel: string | null;
  timeLeft: string;
  isTimerCritical: boolean;
  isFinished: boolean;
  finalStatusText: string | null;
}

export function BattleHeader({
  battle,
  attackerCommunity,
  defenderCommunity,
  regionLabel,
  timeLeft,
  isTimerCritical,
  isFinished,
  finalStatusText,
}: BattleHeaderProps) {
  return (
    <div className="relative flex items-center justify-center w-full">
      {/* Defender Side - Desktop */}
      <div className="hidden md:flex absolute left-0 items-center gap-3 z-10">
        <Avatar className="h-10 w-10">
          <AvatarImage src={defenderCommunity?.logo_url} />
          <AvatarFallback>DEF</AvatarFallback>
        </Avatar>
        <div className="flex flex-col">
          <span className={cn("text-[10px] uppercase font-bold", BATTLE_THEME.sides.defender.colors.text)}>
            Defender
          </span>
          <span className="font-bold whitespace-nowrap">{defenderCommunity?.name || "Defenders"}</span>
        </div>
      </div>

      {/* Defender Side - Mobile (avatar only) */}
      <div className="md:hidden absolute left-0 flex items-center gap-2 z-10">
        <Avatar className="h-8 w-8">
          <AvatarImage src={defenderCommunity?.logo_url} />
          <AvatarFallback>D</AvatarFallback>
        </Avatar>
      </div>

      {/* Center: Region and Timer */}
      <div className="flex flex-col items-center justify-center gap-0.5">
        {isFinished ? (
          <div className="px-4 py-1 bg-muted/50 rounded-lg text-xs font-bold uppercase whitespace-nowrap">
            {finalStatusText || "Battle Ended"}
          </div>
        ) : (
          <>
            <div className="text-xs font-bold uppercase tracking-wider text-foreground/70 hidden md:block">
              {regionLabel || `#${battle?.target_hex_id}` || "Battle"}
            </div>
            <div
              className={cn(
                "text-3xl font-bold tabular-nums font-pixelated tracking-tight md:text-3xl text-2xl",
                isTimerCritical ? "text-red-500" : "text-foreground"
              )}
            >
              {timeLeft}
            </div>
          </>
        )}
      </div>

      {/* Attacker Side - Desktop */}
      <div className="hidden md:flex absolute right-0 items-center gap-3 justify-end z-10">
        <div className="flex flex-col text-right">
          <span className={cn("text-[10px] uppercase font-bold", BATTLE_THEME.sides.attacker.colors.text)}>
            Attacker
          </span>
          <span className="font-bold whitespace-nowrap">{attackerCommunity?.name || "Attackers"}</span>
        </div>
        <Avatar className="h-10 w-10">
          <AvatarImage src={attackerCommunity?.logo_url} />
          <AvatarFallback>ATK</AvatarFallback>
        </Avatar>
      </div>

      {/* Attacker Side - Mobile (avatar only) */}
      <div className="md:hidden absolute right-0 flex items-center gap-2 justify-end z-10">
        <Avatar className="h-8 w-8">
          <AvatarImage src={attackerCommunity?.logo_url} />
          <AvatarFallback>A</AvatarFallback>
        </Avatar>
      </div>
    </div>
  );
}
