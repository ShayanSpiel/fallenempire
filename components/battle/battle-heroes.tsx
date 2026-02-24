"use client";

import React from "react";
import { cn } from "@/lib/utils";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Crown, ChevronDown } from "lucide-react";
import { BATTLE_THEME } from "@/lib/battle-theme";
import { getUserAvatar } from "@/lib/battle/utils";

interface HeroData {
  name: string;
  avatar?: string | null;
  damage: number;
}

interface BattleHeroesProps {
  attackerHero: HeroData | null;
  defenderHero: HeroData | null;
  attackerBump: boolean;
  defenderBump: boolean;
  onInfoClick: () => void;
}

function BattleHeroesComponent({
  attackerHero,
  defenderHero,
  attackerBump,
  defenderBump,
  onInfoClick,
}: BattleHeroesProps) {
  return (
    <>
      {/* Desktop Version */}
      <div className="hidden md:flex items-center justify-between mb-0.5 relative">
        <div className="flex items-center gap-4 flex-1">
          <div className="relative">
            <Avatar className="h-16 w-16 border border-border shadow-sm">
              <AvatarImage
                src={
                  defenderHero && defenderHero.damage > 0
                    ? getUserAvatar(defenderHero.name, defenderHero.avatar)
                    : undefined
                }
              />
              <AvatarFallback>DEF</AvatarFallback>
            </Avatar>
            {defenderHero && defenderHero.damage > 0 && (
              <div className="absolute -top-1 -right-1 bg-background rounded-full p-0.5">
                <Crown size={14} className="text-yellow-500 fill-yellow-500" />
              </div>
            )}
          </div>
          <div className="flex flex-col">
            <span className={cn("text-[10px] uppercase font-bold", BATTLE_THEME.sides.defender.colors.textDark)}>
              Defender
            </span>
            <span className="font-bold">
              {defenderHero && defenderHero.damage > 0 ? defenderHero.name : "Nobody"}
            </span>
          </div>
          <div
            className={cn(
              "ml-2 text-3xl font-black transition-transform",
              BATTLE_THEME.sides.defender.colors.text,
              defenderBump ? "scale-110" : "scale-100"
            )}
          >
            {defenderHero?.damage.toLocaleString() || 0}
          </div>
        </div>

        {/* Battle Info Button */}
        <div className="absolute left-1/2 -translate-x-1/2 z-20" style={{ top: "calc(var(--spacing) * -5.2)" }}>
          <button
            onClick={onInfoClick}
            className="group flex items-center gap-2 px-3.5 py-0.5 rounded-b-lg bg-card hover:bg-muted/50 border-b border-l border-r border-border transition-all shadow-sm"
          >
            <span className="text-xs font-bold uppercase tracking-[0.15em] text-muted-foreground group-hover:text-foreground transition-colors">
              Battle Info
            </span>
            <ChevronDown size={13} className="text-muted-foreground group-hover:text-foreground transition-colors" />
          </button>
        </div>

        <div className="flex items-center gap-4 flex-1 justify-end">
          <div
            className={cn(
              "mr-2 text-3xl font-black transition-transform",
              BATTLE_THEME.sides.attacker.colors.text,
              attackerBump ? "scale-110" : "scale-100"
            )}
          >
            {attackerHero?.damage.toLocaleString() || 0}
          </div>
          <div className="flex flex-col items-end">
            <span className={cn("text-[10px] uppercase font-bold", BATTLE_THEME.sides.attacker.colors.textDark)}>
              Attacker
            </span>
            <span className="font-bold">
              {attackerHero && attackerHero.damage > 0 ? attackerHero.name : "Nobody"}
            </span>
          </div>
          <div className="relative">
            <Avatar className="h-16 w-16 border border-border shadow-sm">
              <AvatarImage
                src={
                  attackerHero && attackerHero.damage > 0
                    ? getUserAvatar(attackerHero.name, attackerHero.avatar)
                    : undefined
                }
              />
              <AvatarFallback>ATK</AvatarFallback>
            </Avatar>
            {attackerHero && attackerHero.damage > 0 && (
              <div className="absolute -top-1 -left-1 bg-background rounded-full p-0.5">
                <Crown size={14} className="text-yellow-500 fill-yellow-500" />
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Mobile Version */}
      <div className="md:hidden flex items-center justify-between mb-0.5 relative gap-2">
        <div className="flex items-center gap-2 flex-1 min-w-0">
          <div className="relative flex-shrink-0">
            <Avatar className="h-12 w-12 border border-border shadow-sm">
              <AvatarImage
                src={
                  defenderHero && defenderHero.damage > 0
                    ? getUserAvatar(defenderHero.name, defenderHero.avatar)
                    : undefined
                }
              />
              <AvatarFallback>D</AvatarFallback>
            </Avatar>
            {defenderHero && defenderHero.damage > 0 && (
              <div className="absolute -top-1 -right-1 bg-background rounded-full p-0.5">
                <Crown size={10} className="text-yellow-500 fill-yellow-500" />
              </div>
            )}
          </div>
          <div className="flex-1 min-w-0">
            <div
              className={cn(
                "text-xl font-black transition-transform truncate",
                BATTLE_THEME.sides.defender.colors.text,
                defenderBump ? "scale-110" : "scale-100"
              )}
            >
              {defenderHero?.damage.toLocaleString() || 0}
            </div>
          </div>
        </div>

        {/* Battle Info Button - Mobile */}
        <button
          onClick={onInfoClick}
          className="group flex-shrink-0 p-1.5 rounded-lg bg-card/90 hover:bg-card border border-border backdrop-blur-sm transition-colors"
        >
          <ChevronDown
            size={14}
            className="text-muted-foreground group-hover:text-foreground transition-colors"
          />
        </button>

        <div className="flex items-center gap-2 flex-1 justify-end min-w-0">
          <div className="flex-1 min-w-0">
            <div
              className={cn(
                "text-xl font-black transition-transform text-right truncate",
                BATTLE_THEME.sides.attacker.colors.text,
                attackerBump ? "scale-110" : "scale-100"
              )}
            >
              {attackerHero?.damage.toLocaleString() || 0}
            </div>
          </div>
          <div className="relative flex-shrink-0">
            <Avatar className="h-12 w-12 border border-border shadow-sm">
              <AvatarImage
                src={
                  attackerHero && attackerHero.damage > 0
                    ? getUserAvatar(attackerHero.name, attackerHero.avatar)
                    : undefined
                }
              />
              <AvatarFallback>A</AvatarFallback>
            </Avatar>
            {attackerHero && attackerHero.damage > 0 && (
              <div className="absolute -top-1 -left-1 bg-background rounded-full p-0.5">
                <Crown size={10} className="text-yellow-500 fill-yellow-500" />
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
}

export const BattleHeroes = React.memo(BattleHeroesComponent);
