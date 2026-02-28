"use client";

import { useState, useEffect } from "react";
import { Leaf, Clock, ArrowLeft, Check } from "lucide-react";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { RewardUnlockModal } from "@/components/battlepass/reward-unlock-modal";
import { BattlePassData, BattlePassTier } from "@/components/battlepass/types";
import { getBattlePassData } from "@/app/actions/battlepass";
import Link from "next/link";
import { cn } from "@/lib/utils";

function getRewardIcon(rewardType: string, qualityKey?: string) {
  if (rewardType === "gold") return "💰";
  if (rewardType === "food") {
    if (qualityKey === "rare") return "🍷";
    if (qualityKey === "uncommon") return "🥩";
    return "🍞";
  }
  if (rewardType === "ticket") return "🎫";
  return "🎁";
}

export default function BattlePassPage() {
  const [data, setData] = useState<BattlePassData | null>(null);
  const [loading, setLoading] = useState(true);
  const [claimingTier, setClaimingTier] = useState<{
    tier: BattlePassTier;
    tierNumber: number;
  } | null>(null);

  useEffect(() => {
    loadBattlePassData();
  }, []);

  const loadBattlePassData = async () => {
    setLoading(true);
    const battlePassData = await getBattlePassData();
    setData(battlePassData);
    setLoading(false);
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
        const claimedTier = data.tiers.find(
          (t) => t.tier_number === tierNumber && t.tier_type === tierType
        );

        if (claimedTier) {
          setClaimingTier({ tier: claimedTier, tierNumber });
        }

        await loadBattlePassData();
      } else {
        alert(result.error || "Failed to claim reward");
      }
    } catch (error) {
      console.error("Error claiming reward:", error);
      alert("Failed to claim reward");
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center space-y-4">
          <div className="w-16 h-16 border-4 border-amber-500 border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-muted-foreground">Loading Battle Pass...</p>
        </div>
      </div>
    );
  }

  if (!data || !data.success) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center space-y-4">
          <Leaf className="w-16 h-16 text-amber-400 mx-auto" />
          <p className="text-muted-foreground">Battle Pass unavailable</p>
          <Link href="/feed">
            <Button variant="outline">Back to Feed</Button>
          </Link>
        </div>
      </div>
    );
  }

  const { season, progress, tiers } = data;
  const xpInCurrentTier = progress.total_xp % season.xp_per_tier;
  const progressPercent = (xpInCurrentTier / season.xp_per_tier) * 100;

  const endDate = new Date(season.end_date);
  const now = new Date();
  const daysRemaining = Math.max(
    0,
    Math.ceil((endDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
  );

  const tierGroups: { [key: number]: { free?: BattlePassTier; keeper?: BattlePassTier } } = {};
  tiers.forEach((tier) => {
    if (!tierGroups[tier.tier_number]) {
      tierGroups[tier.tier_number] = {};
    }
    if (tier.tier_type === "free") {
      tierGroups[tier.tier_number].free = tier;
    } else {
      tierGroups[tier.tier_number].keeper = tier;
    }
  });

  const isRewardClaimed = (tierNum: number, tierType: "free" | "keeper") =>
    data.claimed_rewards.some((r) => r.tier_number === tierNum && r.tier_type === tierType);

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="sticky top-0 z-50 border-b border-amber-300/30 dark:border-amber-600/30 bg-gradient-to-r from-amber-50 via-yellow-50 to-amber-50 dark:from-amber-950/60 dark:via-amber-900/40 dark:to-amber-950/60">
        <div className="container max-w-5xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Link href="/feed">
                <Button variant="ghost" size="sm" className="hover:bg-amber-100 dark:hover:bg-amber-900/50">
                  <ArrowLeft className="w-4 h-4 mr-2" />
                  Back
                </Button>
              </Link>

              <div className="flex items-center gap-3">
                <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-amber-400/80 dark:bg-amber-500/70 border border-amber-500/40 dark:border-amber-400/30 shadow-sm">
                  <Leaf className="w-5 h-5 text-amber-900 dark:text-amber-100" />
                </div>
                <div>
                  <h1 className="text-xl font-bold text-amber-900 dark:text-amber-100">{season.name}</h1>
                  <div className="flex items-center gap-2 text-xs text-amber-700 dark:text-amber-300">
                    <Clock className="w-3 h-3" />
                    <span>{daysRemaining} days remaining</span>
                  </div>
                </div>
              </div>
            </div>

            <div className="text-right">
              <div className="text-xs text-amber-700 dark:text-amber-300">Current Tier</div>
              <div className="text-2xl font-bold text-amber-600 dark:text-amber-400">
                {progress.current_tier}/{season.total_tiers}
              </div>
            </div>
          </div>

          {/* Progress bar */}
          <div className="mt-3 space-y-1">
            <div className="flex items-center justify-between text-xs text-amber-700 dark:text-amber-300">
              <span>Tier Progress</span>
              <span className="font-medium">
                {xpInCurrentTier}/{season.xp_per_tier} XP
              </span>
            </div>
            <div className="h-2 bg-amber-200/60 dark:bg-amber-900/50 rounded-full overflow-hidden border border-amber-300/40 dark:border-amber-700/40">
              <div
                className="h-full bg-gradient-to-r from-amber-400 via-yellow-400 to-amber-500 transition-all duration-500"
                style={{ width: `${progressPercent}%` }}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="container max-w-5xl mx-auto px-4 py-6">
        <div className="space-y-3">
          {/* Header Row */}
          <div className="grid grid-cols-[80px_1fr_1fr] gap-4 text-sm font-medium text-amber-700 dark:text-amber-300 pb-2 border-b border-amber-300/30 dark:border-amber-700/30">
            <div>Tier</div>
            <div>Free Pass</div>
            <div className="flex items-center gap-2">
              Keeper Pass
              {!progress.has_keeper_pass && (
                <Link href="/subscribe">
                  <Badge className="text-xs bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white border-0 cursor-pointer transition-all shadow-sm">
                    Unlock
                  </Badge>
                </Link>
              )}
            </div>
          </div>

          {/* All Tiers */}
          {Object.entries(tierGroups)
            .sort(([a], [b]) => Number(a) - Number(b))
            .map(([tierNum, { free, keeper }]) => {
              const tierNumber = Number(tierNum);
              const isUnlocked = tierNumber <= progress.current_tier;

              return (
                <div
                  key={tierNum}
                  className={cn(
                    "grid grid-cols-[80px_1fr_1fr] gap-4 p-3 rounded-lg border transition-all",
                    isUnlocked
                      ? "bg-amber-50/50 dark:bg-amber-950/20 border-amber-200/40 dark:border-amber-800/40"
                      : "bg-muted/30 border-muted-foreground/20"
                  )}
                >
                  {/* Tier Number */}
                  <div className="flex items-center">
                    <div
                      className={cn(
                        "w-12 h-12 rounded-full flex items-center justify-center text-lg font-bold shadow-sm",
                        isUnlocked
                          ? "bg-gradient-to-br from-amber-400 to-amber-500 text-white"
                          : "bg-muted text-muted-foreground"
                      )}
                    >
                      {tierNumber}
                    </div>
                  </div>

                  {/* Free Reward */}
                  <div className="flex items-center">
                    {free ? (
                      <button
                        onClick={() =>
                          isUnlocked &&
                          !isRewardClaimed(tierNumber, "free") &&
                          handleClaimReward(tierNumber, "free")
                        }
                        disabled={!isUnlocked || isRewardClaimed(tierNumber, "free")}
                        className={cn(
                          "flex items-center gap-3 p-2 rounded-lg border transition-all",
                          !isUnlocked && "opacity-40",
                          isRewardClaimed(tierNumber, "free")
                            ? "bg-green-500/20 border-green-500/50"
                            : isUnlocked
                            ? "bg-gradient-to-br from-amber-300/70 via-yellow-300/60 to-amber-400/70 dark:from-amber-500/60 dark:via-yellow-500/50 dark:to-amber-600/60 border-amber-400 dark:border-amber-500 hover:border-amber-500 dark:hover:border-amber-400 cursor-pointer shadow-sm"
                            : "border-muted"
                        )}
                      >
                        <span className="text-2xl">
                          {getRewardIcon(free.reward_type, free.reward_data?.quality_key)}
                        </span>
                        <div className="text-left">
                          <div className="text-sm font-medium">
                            {free.reward_type === "gold"
                              ? `${free.reward_amount} Gold`
                              : `${free.reward_amount}x ${
                                  free.reward_data?.icon_name || free.reward_type
                                }`}
                          </div>
                          {free.reward_data?.quality_key && (
                            <div className="text-xs text-muted-foreground capitalize">
                              {free.reward_data.quality_key}
                            </div>
                          )}
                        </div>
                        {isRewardClaimed(tierNumber, "free") && (
                          <div className="ml-auto w-6 h-6 rounded-full bg-green-500 flex items-center justify-center">
                            <Check className="w-4 h-4 text-white" />
                          </div>
                        )}
                      </button>
                    ) : (
                      <div className="text-sm text-muted-foreground">No reward</div>
                    )}
                  </div>

                  {/* Keeper Reward */}
                  <div className={cn("flex items-center", !progress.has_keeper_pass && "opacity-40")}>
                    {keeper ? (
                      <button
                        onClick={() =>
                          progress.has_keeper_pass &&
                          isUnlocked &&
                          !isRewardClaimed(tierNumber, "keeper") &&
                          handleClaimReward(tierNumber, "keeper")
                        }
                        disabled={
                          !progress.has_keeper_pass ||
                          !isUnlocked ||
                          isRewardClaimed(tierNumber, "keeper")
                        }
                        className={cn(
                          "flex items-center gap-3 p-2 rounded-lg border transition-all",
                          !isUnlocked && "opacity-40",
                          !progress.has_keeper_pass && "cursor-not-allowed",
                          isRewardClaimed(tierNumber, "keeper")
                            ? "bg-green-500/20 border-green-500/50"
                            : isUnlocked && progress.has_keeper_pass
                            ? "bg-gradient-to-br from-amber-300/70 via-yellow-300/60 to-amber-400/70 dark:from-amber-500/60 dark:via-yellow-500/50 dark:to-amber-600/60 border-amber-400 dark:border-amber-500 hover:border-amber-500 dark:hover:border-amber-400 cursor-pointer shadow-sm"
                            : "border-muted"
                        )}
                      >
                        <span className="text-2xl">
                          {getRewardIcon(keeper.reward_type, keeper.reward_data?.quality_key)}
                        </span>
                        <div className="text-left">
                          <div className="text-sm font-medium">
                            {keeper.reward_type === "gold"
                              ? `${keeper.reward_amount} Gold`
                              : `${keeper.reward_amount}x ${
                                  keeper.reward_data?.icon_name || keeper.reward_type
                                }`}
                          </div>
                          {keeper.reward_data?.quality_key && (
                            <div className="text-xs text-muted-foreground capitalize">
                              {keeper.reward_data.quality_key}
                            </div>
                          )}
                        </div>
                        {isRewardClaimed(tierNumber, "keeper") && (
                          <div className="ml-auto w-6 h-6 rounded-full bg-green-500 flex items-center justify-center">
                            <Check className="w-4 h-4 text-white" />
                          </div>
                        )}
                      </button>
                    ) : (
                      <div className="text-sm text-muted-foreground">No reward</div>
                    )}
                  </div>
                </div>
              );
            })}
        </div>
      </div>

      {/* Reward Modal */}
      <RewardUnlockModal
        isOpen={claimingTier !== null}
        onClose={() => setClaimingTier(null)}
        tier={claimingTier?.tier || null}
        tierNumber={claimingTier?.tierNumber || null}
      />
    </div>
  );
}
