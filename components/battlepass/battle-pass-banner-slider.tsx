"use client";

import { useState, useMemo } from "react";
import { ChevronDown, ChevronUp, ChevronLeft, ChevronRight, Leaf, Clock, Crown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { BattlePassData } from "./types";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import { useRouter } from "next/navigation";

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
  const router = useRouter();

  if (!data || !data.success) return null;

  const { season, progress, tiers, claimed_rewards } = data;
  const hasKeeperPass = progress.has_keeper_pass || false;
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

  // Calculate if there are unclaimed rewards
  const hasUnclaimedRewards = useMemo(() => {
    return tiers.some((tier) => {
      const isUnlocked = tier.tier_number <= progress.current_tier;
      const isClaimed = isRewardClaimed(tier.tier_number, tier.tier_type);
      return tier.tier_type === "free" && isUnlocked && !isClaimed;
    });
  }, [tiers, progress.current_tier, claimed_rewards]);

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
    <div className="rounded-xl border border-amber-300/50 dark:border-amber-600/50 bg-gradient-to-br from-amber-50 via-yellow-50 to-amber-100/80 dark:from-zinc-800/80 dark:via-zinc-900/80 dark:to-zinc-800/60 shadow-sm overflow-hidden">
      {/* Collapsed Header */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full p-3 flex items-center gap-3 relative z-10 hover:bg-amber-100/50 dark:hover:bg-zinc-800/50 transition-colors cursor-pointer"
      >
        <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-amber-400/80 dark:bg-amber-600/60 border border-amber-500/40 dark:border-amber-500/30 shadow-sm flex-shrink-0">
          <Leaf className="w-4 h-4 text-amber-900 dark:text-amber-200" />
        </div>

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
                onClick={(e) => e.stopPropagation()}
                className="text-xs text-amber-600 dark:text-amber-400 hover:text-amber-700 dark:hover:text-amber-300 font-medium transition-colors"
              >
                View All
              </Link>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <div className="flex-1 h-2 bg-amber-200/60 dark:bg-zinc-700/60 rounded-full overflow-hidden border border-amber-300/40 dark:border-amber-600/30">
              <div
                className="h-full bg-gradient-to-r from-amber-400 via-yellow-400 to-amber-500 dark:from-amber-500 dark:via-amber-600 dark:to-amber-500 transition-all duration-500 shadow-sm"
                style={{ width: `${progressPercent}%` }}
              />
            </div>
            <span className="text-xs text-amber-900 dark:text-amber-200 whitespace-nowrap font-semibold">
              {xpInCurrentTier}/{season.xp_per_tier}
            </span>
          </div>

          {/* Unclaimed Rewards Indicator - Only show when collapsed */}
          {!isExpanded && hasUnclaimedRewards && (
            <div className="flex items-center gap-1.5 px-2 py-1 rounded-md bg-amber-400/60 dark:bg-amber-600/40 border border-amber-500/50 dark:border-amber-500/30 animate-pulse">
              <span className="text-xs font-semibold text-amber-900 dark:text-amber-100">
                Rewards Ready!
              </span>
            </div>
          )}
        </div>

        <div className="h-7 w-7 flex items-center justify-center flex-shrink-0">
          {isExpanded ? (
            <ChevronUp className="h-4 w-4 text-amber-700 dark:text-amber-400" />
          ) : (
            <ChevronDown className="h-4 w-4 text-amber-700 dark:text-amber-400" />
          )}
        </div>
      </button>

      {/* Expanded Content - Slider */}
      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.3, ease: "easeInOut" }}
            className="overflow-hidden"
          >
            <div className="border-t border-amber-300/40 dark:border-amber-700/40 bg-gradient-to-b from-amber-100/50 to-background dark:from-amber-900/20 dark:to-background">
              <div className="p-4 space-y-3">
            {/* Free Pass */}
            <div className="space-y-2">
              <div className="text-xs font-semibold text-amber-800 dark:text-amber-200">
                Free Pass
              </div>
              <div className="relative">
                {/* Prev Button */}
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={goToPrevPage}
                  disabled={currentPage === 0}
                  className="absolute left-0 top-1/2 -translate-y-1/2 z-20 h-8 w-8 p-0 bg-background/90 hover:bg-amber-100 dark:hover:bg-amber-900/50 disabled:opacity-30 border border-amber-300/40 dark:border-amber-600/30 transition-colors"
                >
                  <ChevronLeft className="h-4 w-4 text-amber-700 dark:text-amber-400" />
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
                            "bg-gradient-to-br from-amber-300/70 via-yellow-300/60 to-amber-400/70 dark:from-amber-500/60 dark:via-yellow-500/50 dark:to-amber-600/60 border-amber-400 dark:border-amber-500 hover:border-amber-500 dark:hover:border-amber-400 hover:shadow-lg hover:shadow-amber-400/40 cursor-pointer animate-pulse"
                        )}
                        style={{
                          boxShadow: isUnlocked && !isClaimed
                            ? "0 0 20px rgba(251, 191, 36, 0.5)"
                            : undefined,
                        }}
                      >
                        <span className="text-xl">{icon}</span>
                        <span className="text-[9px] font-bold mt-0.5 text-amber-900 dark:text-amber-100">
                          {tier.reward_amount}
                        </span>
                        <div className="absolute -top-1.5 -left-1.5 w-4 h-4 rounded-full bg-gradient-to-br from-amber-500 to-amber-600 border border-background text-[8px] font-bold text-white flex items-center justify-center shadow-md z-10">
                          {tier.tier_number}
                        </div>
                        {isClaimed && (
                          <div className="absolute inset-0 flex items-center justify-center bg-background/80 rounded-md">
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
                  className="absolute right-0 top-1/2 -translate-y-1/2 z-20 h-8 w-8 p-0 bg-background/90 hover:bg-amber-100 dark:hover:bg-amber-900/50 disabled:opacity-30 border border-amber-300/40 dark:border-amber-600/30 transition-colors"
                >
                  <ChevronRight className="h-4 w-4 text-amber-700 dark:text-amber-400" />
                </Button>
              </div>
            </div>

            {/* Keeper Pass */}
            <div className={cn("space-y-2", !hasKeeperPass && "opacity-50")}>
              <div className="flex items-center gap-2">
                <div className="flex items-center gap-1.5">
                  <Crown className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
                  <div className="text-xs font-semibold text-amber-800 dark:text-amber-200">
                    Keeper Pass
                  </div>
                </div>
                {!hasKeeperPass && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => router.push("/subscribe")}
                    className="h-5 text-[10px] px-2 py-0.5 rounded-full bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white font-medium border-0 shadow-sm"
                  >
                    Upgrade
                  </Button>
                )}
              </div>
              <div className="relative">
                <div className="grid grid-cols-10 gap-2 px-10">
                  {paginatedKeeperRewards.map((tier) => {
                    const isUnlocked = hasKeeperPass && tier.tier_number <= progress.current_tier;
                    const isClaimed = isRewardClaimed(tier.tier_number, "keeper");
                    const icon = getRewardIcon(tier.reward_type, tier.reward_data?.quality_key);

                    return (
                      <button
                        key={`keeper-${tier.tier_number}`}
                        onClick={() =>
                          hasKeeperPass && isUnlocked && !isClaimed && handleClaimReward(tier.tier_number, "keeper")
                        }
                        disabled={!hasKeeperPass || !isUnlocked || isClaimed}
                        className={cn(
                          "relative aspect-square rounded-md flex flex-col items-center justify-center transition-all border",
                          !hasKeeperPass && "opacity-50 grayscale bg-muted border-muted-foreground/20 cursor-pointer hover:opacity-70",
                          hasKeeperPass && !isUnlocked && "opacity-40 grayscale bg-muted border-muted-foreground/20",
                          hasKeeperPass && isClaimed && "bg-green-500/20 border-green-500/50 shadow-sm",
                          hasKeeperPass && isUnlocked && !isClaimed && "bg-gradient-to-br from-orange-300/70 via-amber-300/60 to-orange-400/70 dark:from-orange-500/60 dark:via-amber-500/50 dark:to-orange-600/60 border-orange-400 dark:border-orange-500 hover:border-orange-500 dark:hover:border-orange-400 hover:shadow-lg hover:shadow-orange-400/40 cursor-pointer animate-pulse"
                        )}
                        style={{
                          boxShadow: hasKeeperPass && isUnlocked && !isClaimed
                            ? "0 0 20px rgba(251, 146, 60, 0.5)"
                            : undefined,
                        }}
                      >
                        <span className="text-xl">{icon}</span>
                        <span className={cn(
                          "text-[9px] font-bold mt-0.5",
                          hasKeeperPass ? "text-orange-900 dark:text-orange-100" : "text-muted-foreground"
                        )}>
                          {tier.reward_amount}
                        </span>
                        <div className={cn(
                          "absolute -top-1.5 -left-1.5 w-4 h-4 rounded-full border border-background text-[8px] font-bold flex items-center justify-center shadow-md z-10",
                          hasKeeperPass ? "bg-gradient-to-br from-orange-500 to-orange-600 text-white" : "bg-muted text-muted-foreground"
                        )}>
                          {tier.tier_number}
                        </div>
                        {hasKeeperPass && isClaimed && (
                          <div className="absolute inset-0 flex items-center justify-center bg-background/80 rounded-md">
                            <div className="w-5 h-5 rounded-full bg-green-500 flex items-center justify-center text-white text-[10px] font-bold shadow-md">
                              ✓
                            </div>
                          </div>
                        )}
                      </button>
                    );
                  })}
                </div>
                {!hasKeeperPass && (
                  <div className="absolute inset-0 flex items-center justify-center bg-background/60 backdrop-blur-[1px] rounded-md cursor-pointer" onClick={() => router.push("/subscribe")}>
                    <div className="text-center space-y-1">
                      <Crown className="w-8 h-8 text-amber-600 dark:text-amber-400 mx-auto" />
                      <div className="text-xs font-semibold text-foreground">Unlock Keeper Pass</div>
                      <div className="text-[10px] text-muted-foreground">Get 2x rewards with Sigma or Omega</div>
                    </div>
                  </div>
                )}
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
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
