"use client";

import React from "react";
import { cn } from "@/lib/utils";
import { Flame } from "lucide-react";
import { BaseToast } from "./base-toast";

interface ToastCriticalProps {
  username: string;
  avatarUrl?: string | null;
  damage: number;
  isAttacker: boolean;
}

export function ToastCritical({ username, avatarUrl, damage, isAttacker }: ToastCriticalProps) {
  const toastBg = "bg-gradient-to-r from-amber-600 via-orange-500 to-red-500";
  const toastShadow = "shadow-lg shadow-amber-500/30";
  const toastText = "text-white";
  const damageTextClass = cn("text-2xl font-black tabular-nums leading-none", toastText);
  const critLabelClass = "text-[10px] font-bold uppercase tracking-widest text-white/85";

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
        <div className="flex flex-col items-end gap-0.5">
          <span className={cn("flex items-center gap-1", critLabelClass)}>
            <Flame className="h-3.5 w-3.5 text-amber-200" />
            CRIT x3
          </span>
          <span className={damageTextClass}>{damage.toLocaleString()}</span>
        </div>
      </div>
    </BaseToast>
  );
}
