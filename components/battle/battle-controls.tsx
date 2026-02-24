"use client";

import React from "react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { BATTLE_THEME } from "@/lib/battle-theme";
import { BATTLE_ATTACK_ENERGY_COST } from "@/lib/gameplay/constants";
import { Flame, Target, TrendingUp } from "lucide-react";
import type { BattleSide, UserRole, UserStats } from "@/lib/battle/types";
import type { AdrenalineState } from "@/lib/battle-mechanics/types";
import { StatBar } from "./stat-bar";
import { AdrenalineBar } from "./adrenaline-bar";
import { FloatingAdrenalineRage } from "./floating-adrenaline-rage";
import { createFightButton } from "./buttons";

interface RankProgress {
  progressPercent: number;
  currentProgress: number;
}

interface BattleControlsProps {
  userRole: UserRole;
  userSide: BattleSide;
  currentUser: UserStats | null;
  isFinished: boolean;
  fightButtonLoading: boolean;
  onFight: () => void;
  onSelectSide: (side: "attacker" | "defender") => void;
  adrenalineState?: AdrenalineState;
  adrenalineConfig?: { max_rage: number; enabled: boolean } | null;
  userRage: number;
  userFocus: number;
  rankProgress: RankProgress;
  rankProgressLabel: string;
  nextRankLabel: string;
  damageBarGradient: string;
  floatingAdrenalineRageAnims?: Array<{ id: number }>;
}

export function BattleControls({
  userRole,
  userSide,
  currentUser,
  isFinished,
  fightButtonLoading,
  onFight,
  onSelectSide,
  adrenalineState,
  adrenalineConfig,
  userRage,
  userFocus,
  rankProgress,
  rankProgressLabel,
  nextRankLabel,
  damageBarGradient,
  floatingAdrenalineRageAnims = [],
}: BattleControlsProps) {
  const FightButton = createFightButton(userRole);

  return (
    <div className="fixed bottom-2 md:bottom-4 left-1/2 -translate-x-1/2 z-50 w-full px-1">
      <div className="relative flex flex-col items-center gap-0.5 w-full">
        {userSide && currentUser && (
          <div className="pointer-events-auto absolute left-1/2 bottom-[calc(100%+5px)] -translate-x-1/2 z-40 w-full max-w-[min(400px,calc(100vw-16px))] md:max-w-[min(600px,calc(100vw-32px))]">
            {/* Adrenaline Bar (only for defenders when active) */}
            {userSide === "defender" && adrenalineConfig && adrenalineState && (
              <div className="mb-2 relative">
                <AdrenalineBar
                  bonusRage={adrenalineState.bonusRage}
                  percentElapsed={adrenalineState.percentElapsed}
                  isActive={adrenalineState.isInWindow && adrenalineState.conditionMet}
                  maxRage={adrenalineConfig.max_rage}
                />

                {/* Floating Adrenaline Rage Animations */}
                {floatingAdrenalineRageAnims.map((anim) => (
                  <FloatingAdrenalineRage key={anim.id} id={anim.id} />
                ))}
              </div>
            )}

            {/* Desktop: Horizontal layout [Rage] [Rank] [Focus] */}
            <div className="hidden md:flex items-center gap-2 w-full">
              <StatBar
                label="Rage"
                value={userRage}
                icon={Flame}
                barColor="bg-gradient-to-r from-amber-600 via-orange-500 to-red-500"
                iconColor="text-amber-300"
                className="flex-[0.7]"
              />

              <StatBar
                value={rankProgress.progressPercent}
                barColor={cn("bg-gradient-to-r", damageBarGradient)}
                className="flex-[1.2]"
              >
                <div className="flex items-center justify-between w-full">
                  <span className="text-[12px] font-black tracking-tight tabular-nums text-white">
                    {rankProgressLabel}
                  </span>
                  <span className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.3em] text-white/70">
                    <TrendingUp className="h-3 w-3" aria-hidden="true" />
                    {nextRankLabel}
                  </span>
                </div>
              </StatBar>

              <StatBar
                label="Focus"
                value={userFocus}
                icon={Target}
                barColor="bg-gradient-to-r from-blue-600 via-blue-500 to-cyan-400"
                iconColor="text-blue-300"
                className="flex-[0.7]"
              />
            </div>

            {/* Mobile: Stacked layout */}
            <div className="flex md:hidden flex-col gap-2 w-full">
              <div className="flex items-center gap-2 w-full">
                <StatBar
                  label="Rage"
                  value={userRage}
                  icon={Flame}
                  barColor="bg-gradient-to-r from-amber-600 via-orange-500 to-red-500"
                  iconColor="text-amber-300"
                  className="flex-1"
                />
                <StatBar
                  label="Focus"
                  value={userFocus}
                  icon={Target}
                  barColor="bg-gradient-to-r from-blue-600 via-blue-500 to-cyan-400"
                  iconColor="text-blue-300"
                  className="flex-1"
                />
              </div>

              <StatBar
                value={rankProgress.progressPercent}
                barColor={cn("bg-gradient-to-r", damageBarGradient)}
                className="w-full"
              >
                <div className="flex items-center justify-between w-full">
                  <span className="text-[12px] font-black tracking-tight tabular-nums text-white">
                    {rankProgressLabel}
                  </span>
                  <span className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.3em] text-white/70">
                    <TrendingUp className="h-3 w-3" aria-hidden="true" />
                    {nextRankLabel}
                  </span>
                </div>
              </StatBar>
            </div>
          </div>
        )}

        {!userSide && !isFinished ? (
          <div
            className={cn(
              "flex flex-col md:flex-row items-center gap-2 md:gap-4 px-2 py-2 rounded-xl backdrop-blur-xl w-full md:w-auto border border-white/20",
              BATTLE_THEME.ui.buttons.main.bg,
              BATTLE_THEME.ui.buttons.main.shadow
            )}
          >
            <Button
              onClick={() => onSelectSide("defender")}
              className={cn(
                "text-white text-sm md:text-lg font-black uppercase tracking-widest h-12 md:h-16 rounded-2xl px-4 md:px-8 shadow-lg active:border-b-0 active:translate-y-1 transition-all flex-1 md:flex-none",
                BATTLE_THEME.ui.buttons.helpDefenders.bg,
                BATTLE_THEME.ui.buttons.helpDefenders.hover,
                BATTLE_THEME.ui.buttons.helpDefenders.border
              )}
            >
              Help Defenders
            </Button>
            <Button
              onClick={() => onSelectSide("attacker")}
              className={cn(
                "text-white text-sm md:text-lg font-black uppercase tracking-widest h-12 md:h-16 rounded-2xl px-4 md:px-8 shadow-lg active:border-b-0 active:translate-y-1 transition-all flex-1 md:flex-none",
                BATTLE_THEME.ui.buttons.joinAttackers.bg,
                BATTLE_THEME.ui.buttons.joinAttackers.hover,
                BATTLE_THEME.ui.buttons.joinAttackers.border
              )}
            >
              Join Attackers
            </Button>
          </div>
        ) : (
          <div
            className={cn(
              "flex flex-wrap items-center justify-center gap-2 px-2 py-2 rounded-xl backdrop-blur-xl w-full max-w-[min(400px,calc(100vw-16px))] md:max-w-[min(600px,calc(100vw-32px))] border border-white/20",
              BATTLE_THEME.ui.buttons.main.bg,
              BATTLE_THEME.ui.buttons.main.shadow
            )}
          >
            {/* Left side buttons */}
            <Button
              size="icon"
              disabled
              className={cn(
                "rounded-2xl h-12 w-12 md:h-16 md:w-16 flex-shrink-0 relative group text-2xl md:text-3xl",
                BATTLE_THEME.ui.buttons.bomb.bg,
                BATTLE_THEME.ui.buttons.bomb.border,
                BATTLE_THEME.ui.buttons.bomb.disabled
              )}
            >
              💣
              <span
                className={cn(
                  "absolute -top-8 left-1/2 -translate-x-1/2 opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none",
                  BATTLE_THEME.ui.buttons.comingSoonTooltip.bg,
                  BATTLE_THEME.ui.buttons.comingSoonTooltip.text,
                  BATTLE_THEME.ui.buttons.comingSoonTooltip.size,
                  BATTLE_THEME.ui.buttons.comingSoonTooltip.padding,
                  BATTLE_THEME.ui.buttons.comingSoonTooltip.rounded
                )}
              >
                Coming Soon
              </span>
            </Button>
            <Button
              size="icon"
              disabled
              className={cn(
                "rounded-2xl h-12 w-12 md:h-16 md:w-16 flex-shrink-0 relative group text-2xl md:text-3xl",
                BATTLE_THEME.ui.buttons.food.bg,
                BATTLE_THEME.ui.buttons.food.border,
                BATTLE_THEME.ui.buttons.food.disabled
              )}
            >
              🍖
              <span
                className={cn(
                  "absolute -top-8 left-1/2 -translate-x-1/2 opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none",
                  BATTLE_THEME.ui.buttons.comingSoonTooltip.bg,
                  BATTLE_THEME.ui.buttons.comingSoonTooltip.text,
                  BATTLE_THEME.ui.buttons.comingSoonTooltip.size,
                  BATTLE_THEME.ui.buttons.comingSoonTooltip.padding,
                  BATTLE_THEME.ui.buttons.comingSoonTooltip.rounded
                )}
              >
                Coming Soon
              </span>
            </Button>

            {/* Center FIGHT button */}
            <FightButton
              onFight={onFight}
              disabled={fightButtonLoading || isFinished || (currentUser?.energy ?? 0) < BATTLE_ATTACK_ENERGY_COST}
              loading={fightButtonLoading}
              userSide={userSide}
            />

            {/* Right side buttons */}
            <Button
              size="icon"
              disabled
              className={cn(
                "rounded-2xl h-12 w-12 md:h-16 md:w-16 flex-shrink-0 relative group text-2xl md:text-3xl",
                BATTLE_THEME.ui.buttons.potion1.bg,
                BATTLE_THEME.ui.buttons.potion1.border,
                BATTLE_THEME.ui.buttons.potion1.disabled
              )}
            >
              💧
              <span
                className={cn(
                  "absolute -top-8 left-1/2 -translate-x-1/2 opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none",
                  BATTLE_THEME.ui.buttons.comingSoonTooltip.bg,
                  BATTLE_THEME.ui.buttons.comingSoonTooltip.text,
                  BATTLE_THEME.ui.buttons.comingSoonTooltip.size,
                  BATTLE_THEME.ui.buttons.comingSoonTooltip.padding,
                  BATTLE_THEME.ui.buttons.comingSoonTooltip.rounded
                )}
              >
                Coming Soon
              </span>
            </Button>
            <Button
              size="icon"
              disabled
              className={cn(
                "rounded-2xl h-12 w-12 md:h-16 md:w-16 flex-shrink-0 relative group text-2xl md:text-3xl",
                BATTLE_THEME.ui.buttons.potion2.bg,
                BATTLE_THEME.ui.buttons.potion2.border,
                BATTLE_THEME.ui.buttons.potion2.disabled
              )}
            >
              🖕
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
