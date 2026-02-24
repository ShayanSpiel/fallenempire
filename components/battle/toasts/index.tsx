"use client";

import React from "react";
import { BattleResultType } from "@/lib/battle/types";
import { ToastMiss } from "./toast-miss";
import { ToastCritical } from "./toast-critical";
import { ToastNormal } from "./toast-normal";

export interface BattleToastFactoryProps {
  username: string;
  avatarUrl?: string | null;
  damage: number;
  result: BattleResultType;
  side: "attacker" | "defender";
}

/**
 * Toast Factory - Creates the appropriate toast based on result type
 * Supports: MISS, CRITICAL, and normal HIT toasts
 */
export function BattleToastFactory({
  username,
  avatarUrl,
  damage,
  result,
  side,
}: BattleToastFactoryProps) {
  const isAttacker = side === "attacker";

  switch (result) {
    case "MISS":
      return <ToastMiss username={username} avatarUrl={avatarUrl} isAttacker={isAttacker} />;

    case "CRITICAL":
      return <ToastCritical username={username} avatarUrl={avatarUrl} damage={damage} isAttacker={isAttacker} />;

    case "HIT":
    default:
      return <ToastNormal username={username} avatarUrl={avatarUrl} damage={damage} isAttacker={isAttacker} />;
  }
}

// Export individual toast components for direct use if needed
export { ToastMiss, ToastCritical, ToastNormal };
