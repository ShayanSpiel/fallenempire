"use client";

import { useState, useEffect } from "react";
import { BattlePassBannerSlider } from "./battle-pass-banner-slider";
import { RewardUnlockModal } from "./reward-unlock-modal";
import { BattlePassData, BattlePassTier } from "./types";
import { getBattlePassData, checkDailyLoginXP } from "@/app/actions/battlepass";

export function BattlePassWrapper() {
  const [data, setData] = useState<BattlePassData | null>(null);
  const [loading, setLoading] = useState(true);
  const [claimingTier, setClaimingTier] = useState<{
    tier: BattlePassTier;
    tierNumber: number;
  } | null>(null);

  useEffect(() => {
    loadBattlePassData();
    checkDailyLogin();
  }, []);

  const loadBattlePassData = async () => {
    setLoading(true);
    const battlePassData = await getBattlePassData();
    setData(battlePassData);
    setLoading(false);
  };

  const checkDailyLogin = async () => {
    const result = await checkDailyLoginXP();
    if (result.success && result.xp_awarded) {
      // Reload battle pass data to show updated progress
      await loadBattlePassData();
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

        // Reload data
        await loadBattlePassData();
      } else {
        alert(result.error || "Failed to claim reward");
      }
    } catch (error) {
      console.error("Error claiming reward:", error);
      alert("Failed to claim reward");
    }
  };

  if (loading || !data) {
    return null; // Don't show anything while loading
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
