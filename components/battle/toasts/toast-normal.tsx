"use client";

import React from "react";
import { cn } from "@/lib/utils";
import { BaseToast } from "./base-toast";
import { BATTLE_THEME } from "@/lib/battle-theme";

interface ToastNormalProps {
  username: string;
  avatarUrl?: string | null;
  damage: number;
  isAttacker: boolean;
}

export function ToastNormal({ username, avatarUrl, damage, isAttacker }: ToastNormalProps) {
  const toastBg = isAttacker ? BATTLE_THEME.ui.logs.attackerBg : BATTLE_THEME.ui.logs.defenderBg;
  const toastShadow = BATTLE_THEME.ui.logs.shadow;
  const toastText = "text-white";
  const damageTextClass = cn("text-2xl font-black tabular-nums leading-none", toastText);

  return (
    <BaseToast
      username={username}
      avatarUrl={avatarUrl}
      isAttacker={isAttacker}
      toastBg={toastBg}
      toastShadow={toastShadow}
      toastText={toastText}
    >
      <div className="flex-shrink-0 min-w-[88px] text-right">
        <div className={damageTextClass}>{damage.toLocaleString()}</div>
      </div>
    </BaseToast>
  );
}
