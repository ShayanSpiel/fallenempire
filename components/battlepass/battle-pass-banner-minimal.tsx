"use client";

import { Coins, Clock, Trophy, ChevronRight } from "lucide-react";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";
import { BattlePassData } from "./types";
import Link from "next/link";

interface BattlePassBannerMinimalProps {
  data: BattlePassData | null;
  onClaimReward?: (tierNumber: number, tierType: "free" | "keeper") => Promise<void>;
}

function getRewardIcon(rewardType: string, qualityKey?: string) {
  // Use emoji icons for consistency and simplicity
  if (rewardType === "gold") return "💰";
  if (rewardType === "food") {
    if (qualityKey === "rare") return "🍷";
    if (qualityKey === "uncommon") return "🥩";
    return "🍞";
  }
  if (rewardType === "ticket") return "🎫";
  return "🎁";
}

export function BattlePassBannerMinimal({ data, onClaimReward }: BattlePassBannerMinimalProps) {
  if (!data || !data.success) return null;

  const { season, progress, tiers, claimed_rewards } = data;
  const xpInCurrentTier = progress.total_xp % season.xp_per_tier;
  const progressPercent = (xpInCurrentTier / season.xp_per_tier) * 100;

  // Calculate time remaining
  const endDate = new Date(season.end_date);
  const now = new Date();
  const daysRemaining = Math.max(
    0,
    Math.ceil((endDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
  );

  // Get next 5 unclaimed tiers for each track
  const getNextRewards = (tierType: "free" | "keeper", limit: number = 5) => {
    return tiers
      .filter((t) => t.tier_type === tierType && t.tier_number <= progress.current_tier)
      .filter(
        (t) =>
          !claimed_rewards.some(
            (r) => r.tier_number === t.tier_number && r.tier_type === tierType
          )
      )
      .slice(0, limit);
  };

  const freeRewards = getNextRewards("free", 5);
  const keeperRewards = getNextRewards("keeper", 5);

  const isRewardClaimed = (tierNum: number, tierType: "free" | "keeper") =>
    claimed_rewards.some((r) => r.tier_number === tierNum && r.tier_type === tierType);

  const handleClaimReward = async (tierNum: number, tierType: "free" | "keeper") => {
    if (onClaimReward) {
      await onClaimReward(tierNum, tierType);
    }
  };

  return (
    <div className="rounded-lg border bg-card p-4 space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Trophy className="w-5 h-5 text-amber-500" />
          <div>
            <h3 className="font-semibold text-sm">{season.name}</h3>
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Clock className="w-3 h-3" />
              <span>{daysRemaining}d left</span>
              <span>•</span>
              <span>
                Tier {progress.current_tier}/{season.total_tiers}
              </span>
            </div>
          </div>
        </div>

        <Link
          href="/battlepass"
          className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1"
        >
          View All
          <ChevronRight className="w-3 h-3" />
        </Link>
      </div>

      {/* Progress Bar */}
      <div className="space-y-1">
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span>Progress to next tier</span>
          <span className="font-medium">
            {xpInCurrentTier}/{season.xp_per_tier} XP
          </span>
        </div>
        <Progress value={progressPercent} className="h-2" />
      </div>

      {/* Free Rewards */}
      {freeRewards.length > 0 && (
        <div className="space-y-1.5">
          <div className="text-xs font-medium text-muted-foreground">Free Pass</div>
          <div className="flex gap-1.5">
            {freeRewards.map((tier, idx) => {
              const isClaimed = isRewardClaimed(tier.tier_number, "free");
              const icon = getRewardIcon(tier.reward_type, tier.reward_data?.quality_key);

              return (
                <button
                  key={`${tier.tier_number}-free`}
                  onClick={() => !isClaimed && handleClaimReward(tier.tier_number, "free")}
                  disabled={isClaimed}
                  className={cn(
                    "relative flex flex-col items-center justify-center w-14 h-14 rounded border transition-all",
                    isClaimed
                      ? "bg-green-500/10 border-green-500/30 cursor-default"
                      : "bg-amber-500/10 border-amber-500/30 hover:bg-amber-500/20 cursor-pointer"
                  )}
                >
                  <span className="text-lg">{icon}</span>
                  <span className="text-[10px] font-medium mt-0.5">
                    {tier.reward_amount}
                  </span>
                  <div className="absolute -top-1 -left-1 w-4 h-4 rounded-full bg-background border text-[9px] font-bold flex items-center justify-center">
                    {tier.tier_number}
                  </div>
                  {isClaimed && (
                    <div className="absolute inset-0 flex items-center justify-center bg-background/60 rounded">
                      <div className="w-5 h-5 rounded-full bg-green-500 flex items-center justify-center">
                        <span className="text-white text-xs">✓</span>
                      </div>
                    </div>
                  )}
                </button>
              );
            })}
            {progress.current_tier < season.total_tiers && (
              <div className="flex items-center justify-center px-2 text-xs text-muted-foreground">
                +{season.total_tiers - progress.current_tier} more
              </div>
            )}
          </div>
        </div>
      )}

      {/* Tier Progress Dots */}
      <div className="flex items-center gap-1">
        {Array.from({ length: Math.min(season.total_tiers, 40) }).map((_, i) => {
          const tierNum = i + 1;
          const isUnlocked = tierNum <= progress.current_tier;
          const isCurrent = tierNum === progress.current_tier + 1;

          return (
            <div
              key={i}
              className={cn(
                "h-1 flex-1 rounded-full transition-all",
                isUnlocked
                  ? "bg-amber-500"
                  : isCurrent
                  ? "bg-amber-500/30"
                  : "bg-muted"
              )}
            />
          );
        })}
      </div>

      {/* Keeper Pass - Greyed Out */}
      <div className="space-y-1.5 opacity-40">
        <div className="flex items-center gap-2">
          <div className="text-xs font-medium text-muted-foreground">Keeper Pass</div>
          <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-muted text-muted-foreground">
            Coming Soon
          </span>
        </div>
        <div className="flex gap-1.5">
          {keeperRewards.length > 0 ? (
            keeperRewards.slice(0, 5).map((tier) => {
              const icon = getRewardIcon(tier.reward_type, tier.reward_data?.quality_key);
              return (
                <div
                  key={`${tier.tier_number}-keeper`}
                  className="relative flex flex-col items-center justify-center w-14 h-14 rounded border border-muted bg-muted/30"
                >
                  <span className="text-lg grayscale">{icon}</span>
                  <span className="text-[10px] font-medium mt-0.5">
                    {tier.reward_amount}
                  </span>
                  <div className="absolute -top-1 -left-1 w-4 h-4 rounded-full bg-background border text-[9px] font-bold flex items-center justify-center">
                    {tier.tier_number}
                  </div>
                </div>
              );
            })
          ) : (
            Array.from({ length: 5 }).map((_, i) => (
              <div
                key={i}
                className="w-14 h-14 rounded border border-muted bg-muted/30"
              />
            ))
          )}
        </div>
      </div>
    </div>
  );
}
