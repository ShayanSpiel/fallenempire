"use client";

import { useState } from "react";
import { ChevronDown, ChevronUp, Trophy, Clock } from "lucide-react";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { BattlePassData } from "./types";
import Link from "next/link";

interface BattlePassBannerCompactProps {
  data: BattlePassData | null;
  onClaimReward?: (tierNumber: number, tierType: "free" | "keeper") => Promise<void>;
}

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

export function BattlePassBannerCompact({ data, onClaimReward }: BattlePassBannerCompactProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  if (!data || !data.success) return null;

  const { season, progress, tiers, claimed_rewards } = data;
  const xpInCurrentTier = progress.total_xp % season.xp_per_tier;
  const progressPercent = (xpInCurrentTier / season.xp_per_tier) * 100;

  const endDate = new Date(season.end_date);
  const now = new Date();
  const daysRemaining = Math.max(
    0,
    Math.ceil((endDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
  );

  const isRewardClaimed = (tierNum: number, tierType: "free" | "keeper") =>
    claimed_rewards.some((r) => r.tier_number === tierNum && r.tier_type === tierType);

  const handleClaimReward = async (tierNum: number, tierType: "free" | "keeper") => {
    if (onClaimReward) {
      await onClaimReward(tierNum, tierType);
    }
  };

  // Group tiers
  const tierGroups: { [key: number]: { free?: any; keeper?: any } } = {};
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

  return (
    <div className="rounded-lg border bg-gradient-to-r from-amber-500/5 via-yellow-500/5 to-amber-500/5 overflow-hidden">
      {/* Collapsed Header - Always Visible */}
      <div className="p-3 flex items-center gap-3">
        <Trophy className="w-4 h-4 text-amber-500 flex-shrink-0" />

        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2 mb-1">
            <div className="flex items-center gap-2 text-sm font-medium truncate">
              <span>{season.name}</span>
              <span className="text-xs text-muted-foreground">
                • Tier {progress.current_tier}/{season.total_tiers}
              </span>
            </div>
            <div className="flex items-center gap-2 flex-shrink-0">
              <div className="flex items-center gap-1 text-xs text-muted-foreground">
                <Clock className="w-3 h-3" />
                <span>{daysRemaining}d</span>
              </div>
              <Link
                href="/battlepass"
                className="text-xs text-muted-foreground hover:text-foreground"
              >
                View All
              </Link>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Progress value={progressPercent} className="h-1.5 flex-1" />
            <span className="text-xs text-muted-foreground whitespace-nowrap">
              {xpInCurrentTier}/{season.xp_per_tier}
            </span>
          </div>
        </div>

        <Button
          variant="ghost"
          size="sm"
          onClick={() => setIsExpanded(!isExpanded)}
          className="h-7 w-7 p-0 flex-shrink-0"
        >
          {isExpanded ? (
            <ChevronUp className="h-4 w-4" />
          ) : (
            <ChevronDown className="h-4 w-4" />
          )}
        </Button>
      </div>

      {/* Expanded Content - Scrollable Rewards */}
      {isExpanded && (
        <div className="border-t bg-background/50">
          <div className="p-4 space-y-4 max-h-[400px] overflow-y-auto">
            {/* Free Pass */}
            <div className="space-y-2">
              <div className="text-xs font-medium text-muted-foreground">Free Pass</div>
              <div className="grid grid-cols-8 gap-2">
                {Object.entries(tierGroups)
                  .sort(([a], [b]) => Number(a) - Number(b))
                  .map(([tierNum, { free }]) => {
                    if (!free) return null;
                    const tierNumber = Number(tierNum);
                    const isUnlocked = tierNumber <= progress.current_tier;
                    const isClaimed = isRewardClaimed(tierNumber, "free");
                    const icon = getRewardIcon(free.reward_type, free.reward_data?.quality_key);

                    return (
                      <button
                        key={`free-${tierNum}`}
                        onClick={() => isUnlocked && !isClaimed && handleClaimReward(tierNumber, "free")}
                        disabled={!isUnlocked || isClaimed}
                        className={cn(
                          "relative aspect-square rounded-lg border flex flex-col items-center justify-center transition-all",
                          !isUnlocked && "opacity-30",
                          isClaimed
                            ? "bg-green-500/10 border-green-500/30"
                            : isUnlocked
                            ? "bg-amber-500/10 border-amber-500/30 hover:bg-amber-500/20 cursor-pointer"
                            : "bg-muted/30 border-muted"
                        )}
                      >
                        <span className="text-lg">{icon}</span>
                        <span className="text-[9px] font-medium mt-0.5">{free.reward_amount}</span>
                        <div className="absolute -top-1 -left-1 w-4 h-4 rounded-full bg-background border text-[8px] font-bold flex items-center justify-center">
                          {tierNumber}
                        </div>
                        {isClaimed && (
                          <div className="absolute inset-0 flex items-center justify-center bg-background/60 rounded-lg">
                            <div className="w-4 h-4 rounded-full bg-green-500 flex items-center justify-center text-white text-[10px]">
                              ✓
                            </div>
                          </div>
                        )}
                      </button>
                    );
                  })}
              </div>
            </div>

            {/* Keeper Pass */}
            <div className="space-y-2 opacity-40">
              <div className="flex items-center gap-2">
                <div className="text-xs font-medium text-muted-foreground">Keeper Pass</div>
                <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-muted text-muted-foreground">
                  Coming Soon
                </span>
              </div>
              <div className="grid grid-cols-8 gap-2">
                {Object.entries(tierGroups)
                  .sort(([a], [b]) => Number(a) - Number(b))
                  .map(([tierNum, { keeper }]) => {
                    if (!keeper) return null;
                    const icon = getRewardIcon(keeper.reward_type, keeper.reward_data?.quality_key);
                    const tierNumber = Number(tierNum);

                    return (
                      <div
                        key={`keeper-${tierNum}`}
                        className="relative aspect-square rounded-lg border border-muted bg-muted/30 flex flex-col items-center justify-center"
                      >
                        <span className="text-lg grayscale">{icon}</span>
                        <span className="text-[9px] font-medium mt-0.5">{keeper.reward_amount}</span>
                        <div className="absolute -top-1 -left-1 w-4 h-4 rounded-full bg-background border text-[8px] font-bold flex items-center justify-center">
                          {tierNumber}
                        </div>
                      </div>
                    );
                  })}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
