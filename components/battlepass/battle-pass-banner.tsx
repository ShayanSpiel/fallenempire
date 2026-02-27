"use client";

import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Sparkles, Clock, Trophy, ArrowRight } from "lucide-react";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { TierRewardCard } from "./tier-reward-card";
import { BattlePassData, BattlePassTier } from "./types";
import { cn } from "@/lib/utils";
import Link from "next/link";

interface BattlePassBannerProps {
  data: BattlePassData | null;
  onClaimReward?: (tierNumber: number, tierType: "free" | "keeper") => Promise<void>;
}

export function BattlePassBanner({ data, onClaimReward }: BattlePassBannerProps) {
  const [visibleTiers, setVisibleTiers] = useState<number[]>([]);

  useEffect(() => {
    if (!data) return;

    // Show 8 tiers around the current tier
    const currentTier = data.progress.current_tier;
    const start = Math.max(1, currentTier - 3);
    const end = Math.min(data.season.total_tiers, currentTier + 4);
    const tiers = Array.from({ length: end - start + 1 }, (_, i) => start + i);
    setVisibleTiers(tiers);
  }, [data]);

  if (!data || !data.success) {
    return (
      <div className="w-full p-6 bg-gradient-to-r from-gray-800 to-gray-900 rounded-lg text-center">
        <p className="text-gray-400">Battle Pass unavailable</p>
      </div>
    );
  }

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

  // Get tiers by number and type
  const getFreeTier = (tierNum: number) =>
    tiers.find((t) => t.tier_number === tierNum && t.tier_type === "free");
  const getKeeperTier = (tierNum: number) =>
    tiers.find((t) => t.tier_number === tierNum && t.tier_type === "keeper");

  const isRewardClaimed = (tierNum: number, tierType: "free" | "keeper") =>
    claimed_rewards.some((r) => r.tier_number === tierNum && r.tier_type === tierType);

  const handleClaimReward = async (tierNum: number, tierType: "free" | "keeper") => {
    if (onClaimReward) {
      await onClaimReward(tierNum, tierType);
    }
  };

  return (
    <div className="w-full">
      <div className="relative overflow-hidden rounded-xl border border-amber-500/30 bg-gradient-to-br from-amber-900/20 via-yellow-900/20 to-amber-900/20 dark:from-amber-950/30 dark:via-yellow-950/30 dark:to-amber-950/30">
        {/* Animated background gradient */}
        <motion.div
          className="absolute inset-0 bg-gradient-to-r from-amber-500/5 via-yellow-500/10 to-amber-500/5"
          animate={{
            backgroundPosition: ["0% 50%", "100% 50%", "0% 50%"],
          }}
          transition={{
            duration: 10,
            repeat: Infinity,
            ease: "linear",
          }}
          style={{
            backgroundSize: "200% 100%",
          }}
        />

        {/* Content */}
        <div className="relative z-10 p-6 space-y-4">
          {/* Header */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <motion.div
                animate={{
                  rotate: [0, 10, -10, 10, 0],
                }}
                transition={{
                  duration: 2,
                  repeat: Infinity,
                  ease: "easeInOut",
                }}
              >
                <Trophy className="w-8 h-8 text-amber-500" />
              </motion.div>
              <div>
                <h2 className="text-2xl font-bold bg-gradient-to-r from-amber-500 via-yellow-500 to-amber-500 bg-clip-text text-transparent">
                  {season.name}
                </h2>
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Clock className="w-3 h-3" />
                  <span>{daysRemaining} days remaining</span>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <div className="text-right">
                <div className="text-sm text-muted-foreground">Tier</div>
                <div className="text-2xl font-bold text-amber-500">
                  {progress.current_tier} / {season.total_tiers}
                </div>
              </div>

              <Link href="/battlepass">
                <Button
                  variant="outline"
                  size="sm"
                  className="border-amber-500/50 hover:bg-amber-500/10"
                >
                  View All
                  <ArrowRight className="w-4 h-4 ml-1" />
                </Button>
              </Link>
            </div>
          </div>

          {/* XP Progress Bar */}
          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Tier Progress</span>
              <span className="font-medium text-amber-600 dark:text-amber-400">
                {xpInCurrentTier} / {season.xp_per_tier} XP
              </span>
            </div>
            <div className="relative">
              <Progress
                value={progressPercent}
                className="h-3 bg-amber-900/30"
              />
              <motion.div
                className="absolute inset-0 bg-gradient-to-r from-transparent via-amber-400/30 to-transparent rounded-full"
                animate={{
                  x: ["-100%", "200%"],
                }}
                transition={{
                  duration: 2,
                  repeat: Infinity,
                  repeatDelay: 1,
                  ease: "easeInOut",
                }}
              />
            </div>
          </div>

          {/* Rewards Grid */}
          <div className="space-y-3">
            {/* Free Rewards Row */}
            <div className="space-y-1">
              <div className="flex items-center gap-2 px-2">
                <Sparkles className="w-4 h-4 text-amber-500" />
                <span className="text-sm font-semibold text-amber-600 dark:text-amber-400">
                  Free Pass
                </span>
              </div>
              <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-thin scrollbar-thumb-amber-500/30 scrollbar-track-transparent">
                {visibleTiers.map((tierNum, index) => {
                  const tier = getFreeTier(tierNum);
                  if (!tier) return null;
                  return (
                    <TierRewardCard
                      key={`free-${tierNum}`}
                      tier={tier}
                      isUnlocked={tierNum <= progress.current_tier}
                      isClaimed={isRewardClaimed(tierNum, "free")}
                      isKeeperLocked={false}
                      onClick={() => handleClaimReward(tierNum, "free")}
                      index={index}
                    />
                  );
                })}
              </div>
            </div>

            {/* Keeper Rewards Row */}
            <div className="space-y-1 relative">
              <div className="flex items-center gap-2 px-2">
                <div className="w-4 h-4 rounded-full bg-gradient-to-r from-amber-500 to-yellow-500" />
                <span className="text-sm font-semibold bg-gradient-to-r from-amber-500 to-yellow-500 bg-clip-text text-transparent">
                  Keeper Pass
                </span>
                {!progress.has_keeper_pass && (
                  <Badge
                    variant="outline"
                    className="text-xs border-amber-500/50 text-amber-600 dark:text-amber-400"
                  >
                    Coming Soon
                  </Badge>
                )}
              </div>
              <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-thin scrollbar-thumb-amber-500/30 scrollbar-track-transparent">
                {visibleTiers.map((tierNum, index) => {
                  const tier = getKeeperTier(tierNum);
                  if (!tier) return null;
                  return (
                    <TierRewardCard
                      key={`keeper-${tierNum}`}
                      tier={tier}
                      isUnlocked={tierNum <= progress.current_tier}
                      isClaimed={isRewardClaimed(tierNum, "keeper")}
                      isKeeperLocked={!progress.has_keeper_pass}
                      onClick={() => handleClaimReward(tierNum, "keeper")}
                      index={index}
                    />
                  );
                })}
              </div>

              {/* Greyed overlay for keeper pass */}
              {!progress.has_keeper_pass && (
                <div className="absolute inset-0 bg-black/40 backdrop-blur-[1px] rounded-lg pointer-events-none" />
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
