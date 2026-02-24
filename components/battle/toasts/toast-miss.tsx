"use client";

import React from "react";
import { cn } from "@/lib/utils";
import { BaseToast } from "./base-toast";

interface ToastMissProps {
  username: string;
  avatarUrl?: string | null;
  isAttacker: boolean;
}

export function ToastMiss({ username, avatarUrl, isAttacker }: ToastMissProps) {
  const toastBg = "bg-muted/80 border border-border/60";
  const toastShadow = "shadow-none";
  const toastText = "text-muted-foreground";
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
        <div className={damageTextClass}>MISS</div>
      </div>
    </BaseToast>
  );
}
