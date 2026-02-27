"use client";

import { motion } from "framer-motion";
import { Lock, Check, Coins, Utensils, Ticket } from "lucide-react";
import { BattlePassTier, ClaimedReward } from "./types";
import { cn } from "@/lib/utils";

interface TierRewardCardProps {
  tier: BattlePassTier;
  isUnlocked: boolean;
  isClaimed: boolean;
  isKeeperLocked: boolean;
  onClick?: () => void;
  index?: number;
}

function getRewardIcon(rewardType: string) {
  switch (rewardType) {
    case "gold":
      return Coins;
    case "food":
      return Utensils;
    case "ticket":
      return Ticket;
    default:
      return Coins;
  }
}

function getQualityColor(qualityKey?: string) {
  switch (qualityKey) {
    case "common":
      return "text-gray-400";
    case "uncommon":
      return "text-green-500";
    case "rare":
      return "text-blue-500";
    case "epic":
      return "text-purple-500";
    case "legendary":
      return "text-amber-500";
    default:
      return "text-gray-400";
  }
}

export function TierRewardCard({
  tier,
  isUnlocked,
  isClaimed,
  isKeeperLocked,
  onClick,
  index = 0,
}: TierRewardCardProps) {
  const Icon = getRewardIcon(tier.reward_type);
  const qualityColor = getQualityColor(tier.reward_data?.quality_key);

  const isLocked = !isUnlocked || isKeeperLocked;
  const isClickable = isUnlocked && !isClaimed && !isKeeperLocked;

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ delay: index * 0.02, duration: 0.2 }}
      whileHover={isClickable ? { scale: 1.05 } : {}}
      onClick={isClickable ? onClick : undefined}
      className={cn(
        "relative flex flex-col items-center gap-1 p-2 rounded-lg transition-all duration-300 min-w-[60px]",
        isClickable && "cursor-pointer hover:bg-amber-500/10",
        isLocked && "opacity-40 grayscale",
        isClaimed && "bg-gradient-to-br from-amber-500/10 to-yellow-500/10",
        !isLocked && !isClaimed && isUnlocked && "animate-pulse"
      )}
    >
      {/* Tier number */}
      <div className="absolute -top-1 -left-1 w-5 h-5 rounded-full bg-gradient-to-br from-amber-500 to-yellow-500 text-white text-xs font-bold flex items-center justify-center shadow-lg">
        {tier.tier_number}
      </div>

      {/* Reward icon container */}
      <div
        className={cn(
          "relative w-12 h-12 rounded-lg flex items-center justify-center border-2 transition-all duration-300",
          isLocked
            ? "border-gray-600 bg-gray-900/50"
            : isClaimed
            ? "border-green-500 bg-green-500/20"
            : "border-amber-500 bg-gradient-to-br from-amber-500/20 to-yellow-500/20 shadow-lg shadow-amber-500/20"
        )}
      >
        {/* Glow effect for unlocked unclaimed */}
        {!isLocked && !isClaimed && (
          <motion.div
            className="absolute inset-0 rounded-lg bg-gradient-to-r from-amber-500/30 via-yellow-500/30 to-amber-500/30"
            animate={{
              opacity: [0.5, 1, 0.5],
            }}
            transition={{
              duration: 2,
              repeat: Infinity,
              ease: "easeInOut",
            }}
          />
        )}

        {/* Reward icon */}
        <Icon className={cn("w-6 h-6 z-10", isLocked ? "text-gray-500" : qualityColor)} />

        {/* Lock overlay */}
        {isLocked && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/60 rounded-lg">
            <Lock className="w-4 h-4 text-gray-400" />
          </div>
        )}

        {/* Claimed check */}
        {isClaimed && (
          <div className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-green-500 flex items-center justify-center">
            <Check className="w-3 h-3 text-white" />
          </div>
        )}

        {/* Shine animation for unclaimed unlocked */}
        {!isLocked && !isClaimed && (
          <motion.div
            className="absolute inset-0 bg-gradient-to-r from-transparent via-white/30 to-transparent rounded-lg"
            initial={{ x: "-100%" }}
            animate={{ x: "200%" }}
            transition={{
              duration: 2,
              repeat: Infinity,
              repeatDelay: 3,
              ease: "easeInOut",
            }}
          />
        )}
      </div>

      {/* Reward amount */}
      <div
        className={cn(
          "text-xs font-bold",
          isLocked ? "text-gray-500" : "text-amber-600 dark:text-amber-400"
        )}
      >
        {tier.reward_type === "gold" ? (
          <span className="flex items-center gap-0.5">
            <Coins className="w-3 h-3" />
            {tier.reward_amount}
          </span>
        ) : (
          <span>×{tier.reward_amount}</span>
        )}
      </div>

      {/* Keeper badge */}
      {tier.tier_type === "keeper" && (
        <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 px-1.5 py-0.5 rounded-full bg-gradient-to-r from-amber-500 to-amber-600 text-[10px] font-bold text-white shadow-lg">
          K
        </div>
      )}
    </motion.div>
  );
}
