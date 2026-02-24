"use client";

import React from "react";
import { cn } from "@/lib/utils";
import { BATTLE_THEME } from "@/lib/battle-theme";
import { WALL_IMG_URL, WALL_CONTAINER_STYLE } from "@/lib/battle/constants";
import type { BattleStats, FloatingHit, FloatingTaunt, FloatingRageAnim, BattleLog } from "@/lib/battle/types";
import { FloatingDamage } from "./floating-damage";
import { FloatingTaunt as FloatingTauntComp } from "./floating-taunt";
import { FloatingRage } from "./floating-rage";
import { BattleToastFactory } from "./toasts";

interface BattleWallProps {
  battleStats: BattleStats;
  floatingHits: FloatingHit[];
  floatingTaunts: FloatingTaunt[];
  floatingRageAnims: FloatingRageAnim[];
  scoreBump: boolean;
  attackerLogs: BattleLog[];
  defenderLogs: BattleLog[];
}

export function BattleWall({
  battleStats,
  floatingHits,
  floatingTaunts,
  floatingRageAnims,
  scoreBump,
  attackerLogs,
  defenderLogs,
}: BattleWallProps) {
  return (
    <div className="flex-1 min-h-[400px] relative flex items-center justify-center" style={WALL_CONTAINER_STYLE}>
      <div className="relative inline-block">
        {/* Wall Image */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={WALL_IMG_URL} alt="Wall" className="block relative z-10" />

        {/* Wall Overlay (damage bars) */}
        <div
          className="absolute inset-0 z-20 pointer-events-none"
          style={{
            maskImage: `url(${WALL_IMG_URL})`,
            maskSize: "contain",
            maskRepeat: "no-repeat",
            maskPosition: "center",
            WebkitMaskImage: `url(${WALL_IMG_URL})`,
            WebkitMaskSize: "contain",
            WebkitMaskRepeat: "no-repeat",
            WebkitMaskPosition: "center",
          }}
        >
          {/* Defender (green) progress from bottom */}
          <div
            className={cn("absolute bottom-0 left-0 right-0 transition-all duration-300", BATTLE_THEME.ui.wall.defenseBar.emerald)}
            style={{ height: `${battleStats.greenHeightPct}%`, bottom: "50%" }}
          />
          {/* Attacker (red) progress from top */}
          <div
            className={cn("absolute top-0 left-0 right-0 transition-all duration-300", BATTLE_THEME.ui.wall.defenseBar.red)}
            style={{ height: `${battleStats.redHeightPct}%`, top: "50%" }}
          />
        </div>

        {/* Labels */}
        <div className="pointer-events-none absolute top-4 left-1/2 -translate-x-1/2 z-30">
          <span className={cn("px-3 py-0.5 rounded-full text-white text-[10px] uppercase font-bold", BATTLE_THEME.ui.wall.securedLabel)}>
            Secured
          </span>
        </div>
        <div className="pointer-events-none absolute bottom-4 left-1/2 -translate-x-1/2 z-30">
          <span className={cn("px-3 py-0.5 rounded-full text-white text-[10px] uppercase font-bold", BATTLE_THEME.ui.wall.conqueredLabel)}>
            Conquered
          </span>
        </div>

        {/* Score Display */}
        <div className="pointer-events-none absolute top-1/2 left-0 right-0 h-0.5 bg-white/10 z-30 flex items-center justify-center">
          <div
            className={cn(
              "px-6 py-2 rounded-2xl border border-white/10 bg-black/10 backdrop-blur-md transition-all",
              scoreBump ? "scale-110" : "scale-100"
            )}
          >
            <span className={cn("text-4xl md:text-5xl font-black tabular-nums tracking-tighter", battleStats.scoreColorClass)}>
              {battleStats.scoreText}
            </span>
          </div>
        </div>

        {/* Floating Hits */}
        {floatingHits.map((hit) => (
          <FloatingDamage
            key={hit.id}
            id={hit.id}
            side={hit.side}
            damage={hit.damage}
            result={hit.result}
            theme={{
              attackerText: BATTLE_THEME.ui.floatingHit.attackerText,
              defenderText: BATTLE_THEME.ui.floatingHit.defenderText,
              shadow: BATTLE_THEME.ui.floatingHit.shadow,
            }}
          />
        ))}

        {/* Floating Taunts */}
        {floatingTaunts.map((taunt) => (
          <FloatingTauntComp
            key={taunt.id}
            id={taunt.id}
            username={taunt.username}
            avatarUrl={taunt.avatar_url}
            position={taunt.position}
            onComplete={() => {
              // Handle taunt completion if needed
            }}
          />
        ))}

        {/* Floating Rage Animations */}
        {floatingRageAnims.map((rage) => (
          <FloatingRage key={rage.id} id={rage.id} rageGain={rage.rageGain} />
        ))}

        {/* Toast Logs - Desktop only */}
        <div className="hidden md:flex pointer-events-none absolute inset-y-0 right-full mr-4 flex-col justify-end items-end gap-2 w-60 pt-12">
          {defenderLogs.map((log) => (
            <BattleToastFactory
              key={log.id}
              username={log.user}
              avatarUrl={log.user_avatar}
              damage={log.damage}
              result={log.result || "HIT"}
              side="defender"
            />
          ))}
        </div>
        <div className="hidden md:flex pointer-events-none absolute inset-y-0 left-full ml-4 flex-col justify-start items-start gap-2 w-60 pt-12">
          {attackerLogs.map((log) => (
            <BattleToastFactory
              key={log.id}
              username={log.user}
              avatarUrl={log.user_avatar}
              damage={log.damage}
              result={log.result || "HIT"}
              side="attacker"
            />
          ))}
        </div>
      </div>
    </div>
  );
}
