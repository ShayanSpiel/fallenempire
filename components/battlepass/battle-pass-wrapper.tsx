"use client";

import { useState, useEffect } from "react";
import { BattlePassBannerSlider } from "./battle-pass-banner-slider";
import { RewardUnlockModal } from "./reward-unlock-modal";
import { BattlePassData, BattlePassTier } from "./types";
import { getBattlePassData, checkDailyLoginXP } from "@/app/actions/battlepass";

export function BattlePassWrapper() {
  const [data, setData] = useState<BattlePassData | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [claimingTier, setClaimingTier] = useState<{
    tier: BattlePassTier;
    tierNumber: number;
  } | null>(null);

  useEffect(() => {
    loadBattlePassData(true);
    checkDailyLogin();
  }, []);

  const loadBattlePassData = async (isInitialLoad = false) => {
    if (isInitialLoad) {
      setLoading(true);
    } else {
      setRefreshing(true);
    }
    const battlePassData = await getBattlePassData();
    setData(battlePassData);
    if (isInitialLoad) {
      setLoading(false);
    } else {
      setRefreshing(false);
    }
  };

  const checkDailyLogin = async () => {
    const result = await checkDailyLoginXP();
    if (result.success && result.xp_awarded) {
      // Reload battle pass data to show updated progress
      await loadBattlePassData(false);
    }
  };

  const handleClaimReward = async (tierNumber: number, tierType: "free" | "keeper") => {
    if (!data) return;

    try {
      const response = await fetch("/api/battlepass/claim", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tier_number: tierNumber, tier_type: tierType }),
      });

      const result = await response.json();

      if (result.success) {
        // Find the tier that was claimed
        const claimedTier = data.tiers.find(
          (t) => t.tier_number === tierNumber && t.tier_type === tierType
        );

        if (claimedTier) {
          setClaimingTier({ tier: claimedTier, tierNumber });
        }

        // Reload data without hiding the banner
        await loadBattlePassData(false);
      } else {
        alert(result.error || "Failed to claim reward");
      }
    } catch (error) {
      console.error("Error claiming reward:", error);
      alert("Failed to claim reward");
    }
  };

  // Show skeleton during initial load - minimized bar only
  if (loading || !data) {
    return (
      <div className="rounded-xl border border-amber-300/50 dark:border-amber-600/50 bg-gradient-to-br from-amber-50 via-yellow-50 to-amber-100/80 dark:from-zinc-800/80 dark:via-zinc-900/80 dark:to-zinc-800/60 shadow-sm overflow-hidden animate-pulse">
        <div className="w-full p-3 flex items-center gap-3">
          {/* Icon skeleton */}
          <div className="w-8 h-8 rounded-lg bg-amber-400/40 dark:bg-amber-600/30 border border-amber-500/20 dark:border-amber-500/20 flex-shrink-0" />

          {/* Content skeleton */}
          <div className="flex-1 min-w-0 space-y-2">
            {/* Title row skeleton */}
            <div className="flex items-center justify-between gap-2">
              <div className="h-3.5 bg-amber-300/40 dark:bg-zinc-600/50 rounded w-48" />
              <div className="h-3 bg-amber-300/30 dark:bg-zinc-600/40 rounded w-16 flex-shrink-0" />
            </div>

            {/* Progress bar skeleton */}
            <div className="flex items-center gap-2">
              <div className="flex-1 h-2 bg-amber-200/40 dark:bg-zinc-700/50 rounded-full border border-amber-300/20 dark:border-amber-600/20" />
              <div className="h-3 bg-amber-300/30 dark:bg-zinc-600/40 rounded w-12 flex-shrink-0" />
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <>
      <BattlePassBannerSlider data={data} onClaimReward={handleClaimReward} />

      <RewardUnlockModal
        isOpen={claimingTier !== null}
        onClose={() => setClaimingTier(null)}
        tier={claimingTier?.tier || null}
        tierNumber={claimingTier?.tierNumber || null}
      />
    </>
  );
}
