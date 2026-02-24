"use client";

import React from "react";
import { cn } from "@/lib/utils";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { resolveAvatar } from "@/lib/avatar";
import { Flame } from "lucide-react";

export type BattleToastType = "attacker" | "defender";
export type BattleResultType = "HIT" | "MISS" | "CRITICAL";

interface BattleToastProps {
  type: BattleToastType;
  username: string;
  avatarUrl?: string | null;
  damage: number;
  result: BattleResultType;
  theme: {
    bg: string;
    shadow: string;
    textColor: string;
    textLighter: string;
  };
}

export function BattleToast({
  type,
  username,
  avatarUrl,
  damage,
  result,
  theme,
}: BattleToastProps) {
  const isAttacker = type === "attacker";
  const getUserAvatar = (name: string, url?: string | null) =>
    resolveAvatar({ avatarUrl: url, seed: name });

  // Override theme for MISS and CRITICAL
  let toastBg = theme.bg;
  let toastShadow = theme.shadow;
  let toastText = "text-white";

  if (result === "MISS") {
    toastBg = "bg-muted/80 border border-border/60";
    toastShadow = "shadow-none";
    toastText = "text-muted-foreground";
  } else if (result === "CRITICAL") {
    toastBg = "bg-gradient-to-r from-amber-600 via-orange-500 to-red-500";
    toastShadow = "shadow-lg shadow-amber-500/30";
  }

  const damageTextClass = cn("text-2xl font-black tabular-nums leading-none", toastText);
  const critLabelClass = "text-[10px] font-bold uppercase tracking-widest text-white/85";

  return (
    <div
      className={cn(
        "flex items-center gap-3 px-3 py-2 rounded-xl border border-transparent",
        isAttacker && "flex-row-reverse", // Reverse layout for attackers
        toastBg,
        toastShadow,
        "animate-in",
        isAttacker ? "slide-in-from-right-4" : "slide-in-from-left-4",
        "toast-fade-inout"
      )}
    >
      {/* Avatar */}
      <Avatar className="h-12 w-12 border border-border/60 flex-shrink-0">
        <AvatarImage src={getUserAvatar(username, avatarUrl)} />
        <AvatarFallback>{username.slice(0, 2).toUpperCase()}</AvatarFallback>
      </Avatar>

      {/* Username and Damage - Same layout as hero section */}
      <div className={cn("flex-1 min-w-0", isAttacker && "text-right")}>
        {/* Side Label */}
        <div className={cn("text-[10px] uppercase font-bold tracking-wide", result === "MISS" ? "text-muted-foreground" : "text-white/70")}>
          {isAttacker ? "Attacker" : "Defender"}
        </div>

        {/* Username */}
        <div className={cn("text-sm font-bold truncate", toastText)}>{username}</div>
      </div>

      {/* Damage/Result Number */}
      <div className="flex-shrink-0 min-w-[88px] text-right">
        {result === "MISS" ? (
          <div className={damageTextClass}>MISS</div>
        ) : result === "CRITICAL" ? (
          <div className="flex flex-col items-end gap-0.5">
            <span className={cn("flex items-center gap-1", critLabelClass)}>
              <Flame className="h-3.5 w-3.5 text-amber-200" />
              CRIT x3
            </span>
            <span className={damageTextClass}>{damage.toLocaleString()}</span>
          </div>
        ) : (
          <div className={damageTextClass}>{damage.toLocaleString()}</div>
        )}
      </div>
    </div>
  );
}
