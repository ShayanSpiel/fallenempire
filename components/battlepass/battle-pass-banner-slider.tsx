"use client";

import { useState } from "react";
import { ChevronDown, ChevronUp, ChevronLeft, ChevronRight, Trophy, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { BattlePassData } from "./types";
import Link from "next/link";

interface BattlePassBannerSliderProps {
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

export function BattlePassBannerSlider({ data, onClaimReward }: BattlePassBannerSliderProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [currentPage, setCurrentPage] = useState(0);

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

  // Get all rewards sorted by tier
  const freeRewards = tiers
    .filter((t) => t.tier_type === "free")
    .sort((a, b) => a.tier_number - b.tier_number);

  const keeperRewards = tiers
    .filter((t) => t.tier_type === "keeper")
    .sort((a, b) => a.tier_number - b.tier_number);

  // Pagination - 10 items per page
  const itemsPerPage = 10;
  const totalPages = Math.ceil(freeRewards.length / itemsPerPage);

  const paginatedFreeRewards = freeRewards.slice(
    currentPage * itemsPerPage,
    (currentPage + 1) * itemsPerPage
  );

  const paginatedKeeperRewards = keeperRewards.slice(
    currentPage * itemsPerPage,
    (currentPage + 1) * itemsPerPage
  );

  const goToNextPage = () => {
    if (currentPage < totalPages - 1) {
      setCurrentPage(currentPage + 1);
    }
  };

  const goToPrevPage = () => {
    if (currentPage > 0) {
      setCurrentPage(currentPage - 1);
    }
  };

  return (
    <div className="rounded-xl border bg-gradient-to-br from-amber-500/20 via-yellow-500/15 to-amber-400/20 shadow-sm overflow-hidden">
      {/* Collapsed Header */}
      <div className="p-3 flex items-center gap-3 relative z-10">
        <Trophy className="w-4 h-4 text-amber-600 dark:text-amber-500 flex-shrink-0" />

        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2 mb-1.5">
            <div className="flex items-center gap-2 text-sm font-semibold truncate">
              <span className="text-amber-900 dark:text-amber-100">{season.name}</span>
              <span className="text-xs text-muted-foreground font-normal">
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
                className="text-xs text-amber-700 dark:text-amber-400 hover:text-amber-800 dark:hover:text-amber-300 font-medium"
              >
                View All
              </Link>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <div className="flex-1 h-2 bg-amber-900/30 rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-amber-500 to-yellow-500 transition-all duration-500 shadow-lg shadow-amber-500/50"
                style={{ width: `${progressPercent}%` }}
              />
            </div>
            <span className="text-xs text-amber-900 dark:text-amber-100 whitespace-nowrap font-semibold">
              {xpInCurrentTier}/{season.xp_per_tier}
            </span>
          </div>
        </div>

        <Button
          variant="ghost"
          size="sm"
          onClick={() => setIsExpanded(!isExpanded)}
          className="h-7 w-7 p-0 flex-shrink-0 hover:bg-amber-500/20"
        >
          {isExpanded ? (
            <ChevronUp className="h-4 w-4 text-amber-700 dark:text-amber-400" />
          ) : (
            <ChevronDown className="h-4 w-4 text-amber-700 dark:text-amber-400" />
          )}
        </Button>
      </div>

      {/* Expanded Content - Slider */}
      {isExpanded && (
        <div className="border-t border-amber-500/30 bg-gradient-to-b from-amber-500/5 to-background/95">
          <div className="p-4 space-y-3">
            {/* Free Pass */}
            <div className="space-y-2">
              <div className="text-xs font-semibold text-amber-900 dark:text-amber-100">
                Free Pass
              </div>
              <div className="relative">
                {/* Prev Button */}
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={goToPrevPage}
                  disabled={currentPage === 0}
                  className="absolute left-0 top-1/2 -translate-y-1/2 z-20 h-8 w-8 p-0 bg-background/80 hover:bg-background disabled:opacity-30"
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>

                {/* Rewards Grid */}
                <div className="grid grid-cols-10 gap-2 px-10">
                  {paginatedFreeRewards.map((tier) => {
                    const isUnlocked = tier.tier_number <= progress.current_tier;
                    const isClaimed = isRewardClaimed(tier.tier_number, "free");
                    const icon = getRewardIcon(tier.reward_type, tier.reward_data?.quality_key);

                    return (
                      <button
                        key={`free-${tier.tier_number}`}
                        onClick={() =>
                          isUnlocked && !isClaimed && handleClaimReward(tier.tier_number, "free")
                        }
                        disabled={!isUnlocked || isClaimed}
                        className={cn(
                          "relative aspect-square rounded-md flex flex-col items-center justify-center transition-all border",
                          !isUnlocked &&
                            "opacity-40 grayscale bg-muted border-muted-foreground/20",
                          isClaimed &&
                            "bg-green-500/20 border-green-500/50 shadow-sm",
                          isUnlocked &&
                            !isClaimed &&
                            "bg-gradient-to-br from-amber-400/40 to-yellow-400/40 border-amber-500/70 hover:border-amber-500 hover:shadow-lg hover:shadow-amber-500/30 cursor-pointer animate-pulse"
                        )}
                        style={{
                          boxShadow: isUnlocked && !isClaimed
                            ? "0 0 20px rgba(251, 191, 36, 0.4)"
                            : undefined,
                        }}
                      >
                        <span className="text-xl">{icon}</span>
                        <span className="text-[9px] font-bold mt-0.5 text-foreground">
                          {tier.reward_amount}
                        </span>
                        <div className="absolute -top-1.5 -left-1.5 w-4 h-4 rounded-full bg-amber-600 border border-background text-[8px] font-bold text-white flex items-center justify-center shadow-md z-10">
                          {tier.tier_number}
                        </div>
                        {isClaimed && (
                          <div className="absolute inset-0 flex items-center justify-center bg-background/70 rounded-md">
                            <div className="w-5 h-5 rounded-full bg-green-500 flex items-center justify-center text-white text-[10px] font-bold shadow-md">
                              ✓
                            </div>
                          </div>
                        )}
                      </button>
                    );
                  })}
                </div>

                {/* Next Button */}
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={goToNextPage}
                  disabled={currentPage === totalPages - 1}
                  className="absolute right-0 top-1/2 -translate-y-1/2 z-20 h-8 w-8 p-0 bg-background/80 hover:bg-background disabled:opacity-30"
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>

            {/* Keeper Pass */}
            <div className="space-y-2 opacity-50">
              <div className="flex items-center gap-2">
                <div className="text-xs font-semibold text-amber-900 dark:text-amber-100">
                  Keeper Pass
                </div>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-muted text-muted-foreground font-medium">
                  Coming Soon
                </span>
              </div>
              <div className="grid grid-cols-10 gap-2 px-10">
                {paginatedKeeperRewards.map((tier) => {
                  const icon = getRewardIcon(tier.reward_type, tier.reward_data?.quality_key);

                  return (
                    <div
                      key={`keeper-${tier.tier_number}`}
                      className="relative aspect-square rounded-md flex flex-col items-center justify-center bg-muted/50 border border-muted-foreground/20 grayscale"
                    >
                      <span className="text-xl">{icon}</span>
                      <span className="text-[9px] font-bold mt-0.5 text-muted-foreground">
                        {tier.reward_amount}
                      </span>
                      <div className="absolute -top-1.5 -left-1.5 w-4 h-4 rounded-full bg-muted border border-background text-[8px] font-bold text-muted-foreground flex items-center justify-center z-10">
                        {tier.tier_number}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Page indicator */}
            <div className="flex items-center justify-center gap-1 pt-2">
              {Array.from({ length: totalPages }).map((_, i) => (
                <button
                  key={i}
                  onClick={() => setCurrentPage(i)}
                  className={cn(
                    "w-1.5 h-1.5 rounded-full transition-all",
                    i === currentPage
                      ? "bg-amber-500 w-4"
                      : "bg-amber-500/30 hover:bg-amber-500/50"
                  )}
                />
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
