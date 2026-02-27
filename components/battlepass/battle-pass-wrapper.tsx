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

  // Only hide banner during initial load, not during refresh
  if (loading || !data) {
    return null;
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
