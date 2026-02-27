"use client";

import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Trophy, Clock, Sparkles, ArrowLeft } from "lucide-react";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { TierRewardCard } from "@/components/battlepass/tier-reward-card";
import { RewardUnlockModal } from "@/components/battlepass/reward-unlock-modal";
import { BattlePassData, BattlePassTier } from "@/components/battlepass/types";
import { getBattlePassData } from "@/app/actions/battlepass";
import { useRouter } from "next/navigation";
import Link from "next/link";

export default function BattlePassPage() {
  const router = useRouter();
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
          <Trophy className="w-16 h-16 text-gray-400 mx-auto" />
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

  // Calculate time remaining
  const endDate = new Date(season.end_date);
  const now = new Date();
  const daysRemaining = Math.max(
    0,
    Math.ceil((endDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
  );

  // Group tiers by tier number
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
      <div className="sticky top-0 z-50 border-b bg-background/80 backdrop-blur-sm">
        <div className="container max-w-7xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Link href="/feed">
                <Button variant="ghost" size="sm">
                  <ArrowLeft className="w-4 h-4 mr-2" />
                  Back
                </Button>
              </Link>

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
                <h1 className="text-2xl font-bold bg-gradient-to-r from-amber-500 via-yellow-500 to-amber-500 bg-clip-text text-transparent">
                  {season.name}
                </h1>
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Clock className="w-3 h-3" />
                  <span>{daysRemaining} days remaining</span>
                </div>
              </div>
            </div>

            <div className="text-right">
              <div className="text-sm text-muted-foreground">Current Tier</div>
              <div className="text-3xl font-bold text-amber-500">
                {progress.current_tier} / {season.total_tiers}
              </div>
            </div>
          </div>

          {/* Progress bar */}
          <div className="mt-4 space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Tier Progress</span>
              <span className="font-medium text-amber-600 dark:text-amber-400">
                {xpInCurrentTier} / {season.xp_per_tier} XP
              </span>
            </div>
            <div className="relative">
              <Progress value={progressPercent} className="h-3 bg-amber-900/30" />
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
        </div>
      </div>

      {/* Rewards Grid */}
      <div className="container max-w-7xl mx-auto px-4 py-8">
        <div className="space-y-6">
          {/* Tier Type Headers */}
          <div className="grid grid-cols-[100px_1fr_1fr] gap-4 sticky top-[180px] z-40 bg-background/95 backdrop-blur-sm py-4 border-b">
            <div className="text-sm font-medium text-muted-foreground">Tier</div>
            <div className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-amber-500" />
              <span className="text-sm font-semibold text-amber-600 dark:text-amber-400">
                Free Pass
              </span>
            </div>
            <div className="flex items-center gap-2">
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
          </div>

          {/* All tiers */}
          {Object.entries(tierGroups)
            .sort(([a], [b]) => Number(a) - Number(b))
            .map(([tierNum, { free, keeper }], index) => {
              const tierNumber = Number(tierNum);
              const isUnlocked = tierNumber <= progress.current_tier;

              return (
                <motion.div
                  key={tierNum}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.02 }}
                  className="grid grid-cols-[100px_1fr_1fr] gap-4 items-center p-4 rounded-lg border border-border bg-card hover:border-amber-500/30 transition-colors"
                >
                  {/* Tier number */}
                  <div className="flex items-center gap-2">
                    <div className="w-12 h-12 rounded-full bg-gradient-to-br from-amber-500 to-yellow-500 text-white text-lg font-bold flex items-center justify-center shadow-lg">
                      {tierNumber}
                    </div>
                  </div>

                  {/* Free reward */}
                  <div className="flex justify-center">
                    {free ? (
                      <TierRewardCard
                        tier={free}
                        isUnlocked={isUnlocked}
                        isClaimed={isRewardClaimed(tierNumber, "free")}
                        isKeeperLocked={false}
                        onClick={() => handleClaimReward(tierNumber, "free")}
                        index={0}
                      />
                    ) : (
                      <div className="text-muted-foreground text-sm">No reward</div>
                    )}
                  </div>

                  {/* Keeper reward */}
                  <div className="flex justify-center relative">
                    {keeper ? (
                      <TierRewardCard
                        tier={keeper}
                        isUnlocked={isUnlocked}
                        isClaimed={isRewardClaimed(tierNumber, "keeper")}
                        isKeeperLocked={!progress.has_keeper_pass}
                        onClick={() => handleClaimReward(tierNumber, "keeper")}
                        index={0}
                      />
                    ) : (
                      <div className="text-muted-foreground text-sm">No reward</div>
                    )}
                    {!progress.has_keeper_pass && (
                      <div className="absolute inset-0 bg-black/20 backdrop-blur-[1px] rounded-lg pointer-events-none" />
                    )}
                  </div>
                </motion.div>
              );
            })}
        </div>
      </div>

      {/* Reward unlock modal */}
      <RewardUnlockModal
        isOpen={claimingTier !== null}
        onClose={() => setClaimingTier(null)}
        tier={claimingTier?.tier || null}
        tierNumber={claimingTier?.tierNumber || null}
      />
    </div>
  );
}
