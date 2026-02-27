"use client";

import { motion, AnimatePresence } from "framer-motion";
import { X, Sparkles, Coins, Utensils, Ticket, Check } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { BattlePassTier } from "./types";
import { cn } from "@/lib/utils";

interface RewardUnlockModalProps {
  isOpen: boolean;
  onClose: () => void;
  tier: BattlePassTier | null;
  tierNumber: number | null;
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
      return "from-gray-400 to-gray-500";
    case "uncommon":
      return "from-green-400 to-green-600";
    case "rare":
      return "from-blue-400 to-blue-600";
    case "epic":
      return "from-purple-400 to-purple-600";
    case "legendary":
      return "from-amber-400 to-amber-600";
    default:
      return "from-gray-400 to-gray-500";
  }
}

function getQualityName(qualityKey?: string) {
  if (!qualityKey) return "";
  return qualityKey.charAt(0).toUpperCase() + qualityKey.slice(1);
}

export function RewardUnlockModal({
  isOpen,
  onClose,
  tier,
  tierNumber,
}: RewardUnlockModalProps) {
  if (!tier || tierNumber === null) return null;

  const Icon = getRewardIcon(tier.reward_type);
  const qualityGradient = getQualityColor(tier.reward_data?.quality_key);
  const qualityName = getQualityName(tier.reward_data?.quality_key);

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-md overflow-hidden border-amber-500/30 bg-gradient-to-br from-amber-900/30 via-yellow-900/30 to-amber-900/30">
        {/* Animated background particles */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          {[...Array(20)].map((_, i) => (
            <motion.div
              key={i}
              className="absolute w-1 h-1 bg-amber-400 rounded-full"
              initial={{
                x: "50%",
                y: "50%",
                opacity: 0,
              }}
              animate={{
                x: `${Math.random() * 100}%`,
                y: `${Math.random() * 100}%`,
                opacity: [0, 1, 0],
              }}
              transition={{
                duration: 1.5,
                delay: i * 0.05,
                ease: "easeOut",
              }}
            />
          ))}
        </div>

        <DialogHeader>
          <DialogTitle className="text-center text-2xl font-bold bg-gradient-to-r from-amber-500 via-yellow-500 to-amber-500 bg-clip-text text-transparent">
            Reward Unlocked!
          </DialogTitle>
        </DialogHeader>

        <div className="relative py-8 flex flex-col items-center gap-6">
          {/* Tier number badge */}
          <motion.div
            initial={{ scale: 0, rotate: -180 }}
            animate={{ scale: 1, rotate: 0 }}
            transition={{ type: "spring", duration: 0.6, delay: 0.2 }}
            className="absolute top-0 right-8 w-10 h-10 rounded-full bg-gradient-to-br from-amber-500 to-yellow-500 text-white text-lg font-bold flex items-center justify-center shadow-2xl"
          >
            {tierNumber}
          </motion.div>

          {/* Main reward display */}
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{
              type: "spring",
              stiffness: 260,
              damping: 20,
              delay: 0.3,
            }}
            className="relative"
          >
            {/* Glow effect */}
            <motion.div
              className={cn(
                "absolute inset-0 rounded-full blur-2xl opacity-50",
                `bg-gradient-to-r ${qualityGradient}`
              )}
              animate={{
                scale: [1, 1.2, 1],
                opacity: [0.5, 0.8, 0.5],
              }}
              transition={{
                duration: 2,
                repeat: Infinity,
                ease: "easeInOut",
              }}
            />

            {/* Reward icon container */}
            <motion.div
              className={cn(
                "relative w-32 h-32 rounded-2xl flex items-center justify-center border-4 shadow-2xl",
                `bg-gradient-to-br ${qualityGradient}`
              )}
              animate={{
                rotate: [0, 5, -5, 0],
              }}
              transition={{
                duration: 2,
                repeat: Infinity,
                ease: "easeInOut",
              }}
            >
              <Icon className="w-16 h-16 text-white drop-shadow-lg" />

              {/* Shine animation */}
              <motion.div
                className="absolute inset-0 bg-gradient-to-r from-transparent via-white/40 to-transparent rounded-2xl"
                initial={{ x: "-100%" }}
                animate={{ x: "200%" }}
                transition={{
                  duration: 1.5,
                  repeat: Infinity,
                  repeatDelay: 2,
                  ease: "easeInOut",
                }}
              />
            </motion.div>

            {/* Sparkles around icon */}
            {[...Array(8)].map((_, i) => (
              <motion.div
                key={i}
                className="absolute"
                style={{
                  left: "50%",
                  top: "50%",
                }}
                initial={{
                  x: 0,
                  y: 0,
                  opacity: 0,
                }}
                animate={{
                  x: Math.cos((i / 8) * Math.PI * 2) * 80,
                  y: Math.sin((i / 8) * Math.PI * 2) * 80,
                  opacity: [0, 1, 0],
                }}
                transition={{
                  duration: 1,
                  delay: 0.5 + i * 0.1,
                  ease: "easeOut",
                }}
              >
                <Sparkles className="w-4 h-4 text-amber-400" />
              </motion.div>
            ))}
          </motion.div>

          {/* Reward details */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.6 }}
            className="text-center space-y-2"
          >
            <h3 className="text-3xl font-bold text-amber-600 dark:text-amber-400">
              {tier.reward_type === "gold" ? (
                <span className="flex items-center justify-center gap-2">
                  <Coins className="w-6 h-6" />
                  {tier.reward_amount} Gold
                </span>
              ) : (
                <span>×{tier.reward_amount}</span>
              )}
            </h3>

            {tier.reward_data?.icon_name && (
              <p className="text-lg font-medium text-muted-foreground">
                {tier.reward_data.icon_name}
              </p>
            )}

            {qualityName && (
              <div className={cn("inline-block px-3 py-1 rounded-full text-sm font-semibold text-white", `bg-gradient-to-r ${qualityGradient}`)}>
                {qualityName} Quality
              </div>
            )}

            {tier.tier_type === "keeper" && (
              <div className="inline-block px-3 py-1 rounded-full text-sm font-bold bg-gradient-to-r from-amber-500 to-amber-600 text-white shadow-lg">
                Keeper Pass
              </div>
            )}
          </motion.div>

          {/* Success icon */}
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{
              type: "spring",
              stiffness: 260,
              damping: 20,
              delay: 0.8,
            }}
            className="w-12 h-12 rounded-full bg-green-500 flex items-center justify-center shadow-lg"
          >
            <Check className="w-7 h-7 text-white" />
          </motion.div>

          {/* Close button */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 1 }}
          >
            <Button
              onClick={onClose}
              size="lg"
              className="bg-gradient-to-r from-amber-500 to-yellow-500 hover:from-amber-600 hover:to-yellow-600 text-white font-bold shadow-lg"
            >
              Awesome!
            </Button>
          </motion.div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
