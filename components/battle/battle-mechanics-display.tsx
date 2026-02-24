"use client";

import React, { useEffect, useState } from "react";
import { cn } from "@/lib/utils";
import { RageMeter } from "./rage-meter";
import { DisarrayIndicator } from "./disarray-indicator";
import { MomentumIndicator } from "./momentum-indicator";
import { ExhaustionIndicator } from "./exhaustion-indicator";

interface BattleMechanicsState {
  // User stats
  morale: number;
  rage: number;
  energy: number;
  focus: number;

  // Community states
  disarray_active: boolean;
  disarray_multiplier: number;
  disarray_hours_remaining: number;

  momentum_active: boolean;
  momentum_morale_bonus: number;
  momentum_hours_remaining: number;

  exhaustion_active: boolean;
  exhaustion_regen_multiplier: number;
  exhaustion_hours_until_clear: number;
}

interface BattleMechanicsDisplayProps {
  userId: string;
  communityId?: string | null;
  className?: string;
  compact?: boolean;
}

export function BattleMechanicsDisplay({
  userId,
  communityId,
  className,
  compact = false,
}: BattleMechanicsDisplayProps) {
  const [state, setState] = useState<BattleMechanicsState | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchMechanicsState = async () => {
      try {
        setLoading(true);

        // Fetch user stats
        const userRes = await fetch(`/api/battle/mechanics/user?userId=${userId}`);
        const userData = await userRes.json();

        // Fetch community state if available
        let communityData: any = null;
        if (communityId) {
          const communityRes = await fetch(`/api/battle/mechanics/community?communityId=${communityId}`);
          communityData = await communityRes.json();
        }

        setState({
          morale: userData.morale ?? 50,
          rage: userData.rage ?? 0,
          energy: userData.energy ?? 100,
          focus: userData.focus ?? 50,

          disarray_active: communityData?.disarray_active ?? false,
          disarray_multiplier: communityData?.disarray_multiplier ?? 1.0,
          disarray_hours_remaining: communityData?.disarray_hours_remaining ?? 0,

          momentum_active: communityData?.momentum_active ?? false,
          momentum_morale_bonus: communityData?.momentum_morale_bonus ?? 0,
          momentum_hours_remaining: communityData?.momentum_hours_remaining ?? 0,

          exhaustion_active: communityData?.exhaustion_active ?? false,
          exhaustion_regen_multiplier: communityData?.exhaustion_regen_multiplier ?? 1.0,
          exhaustion_hours_until_clear: communityData?.exhaustion_hours_until_clear ?? 0,
        });
      } catch (err) {
        console.error("Failed to fetch battle mechanics state:", err);
      } finally {
        setLoading(false);
      }
    };

    if (userId) {
      fetchMechanicsState();

      // Refresh every 30 seconds
      const interval = setInterval(fetchMechanicsState, 30000);
      return () => clearInterval(interval);
    }
  }, [userId, communityId]);

  if (loading || !state) {
    return null;
  }

  if (compact) {
    return (
      <div className={cn("flex items-center gap-2 flex-wrap", className)}>
        {state.rage > 0 && (
          <div className="text-xs font-bold text-red-500 flex items-center gap-1">
            🔥 {Math.round(state.rage)}%
          </div>
        )}
        <DisarrayIndicator
          active={state.disarray_active}
          multiplier={state.disarray_multiplier}
        />
        <MomentumIndicator
          active={state.momentum_active}
          moraleBonus={state.momentum_morale_bonus}
        />
        <ExhaustionIndicator
          active={state.exhaustion_active}
          regenMultiplier={state.exhaustion_regen_multiplier}
        />
      </div>
    );
  }

  return (
    <div className={cn("flex flex-col gap-3", className)}>
      {/* Rage Meter */}
      <RageMeter rage={state.rage} />

      {/* Community States */}
      <div className="flex flex-wrap gap-2">
        <DisarrayIndicator
          active={state.disarray_active}
          multiplier={state.disarray_multiplier}
          hoursRemaining={state.disarray_hours_remaining}
        />
        <MomentumIndicator
          active={state.momentum_active}
          moraleBonus={state.momentum_morale_bonus}
          hoursRemaining={state.momentum_hours_remaining}
        />
        <ExhaustionIndicator
          active={state.exhaustion_active}
          regenMultiplier={state.exhaustion_regen_multiplier}
          hoursUntilClear={state.exhaustion_hours_until_clear}
        />
      </div>

      {/* Focus Display */}
      <div className="flex items-center justify-between text-xs">
        <span className="text-foreground/70 font-medium">Focus (Accuracy)</span>
        <span className="font-bold tabular-nums">{Math.round(state.focus)}%</span>
      </div>
    </div>
  );
}
