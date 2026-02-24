"use client";

import { toast } from "sonner";
import { Zap, Star } from "lucide-react";

interface LevelUpToastProps {
  level: number;
  levelUps: number;
  totalXp?: number;
}

/**
 * Display celebration toast when player levels up
 */
export function showLevelUpToast({ level, levelUps, totalXp }: LevelUpToastProps) {
  const message = levelUps === 1 ? `You're now Level ${level}` : `Level Up x${levelUps}! Now Level ${level}`;
  const description = totalXp ? `Total XP: ${totalXp.toLocaleString()}` : undefined;

  // Create custom icon with animation
  const CustomIcon = () => (
    <div className="flex items-center justify-center">
      <div className="relative">
        <Zap className="h-6 w-6 text-amber-500 animate-pulse" />
        <Star className="h-3 w-3 text-amber-400 absolute -top-1 -right-1 animate-bounce" />
      </div>
    </div>
  );

  toast.success(message, {
    icon: <CustomIcon />,
    duration: 4000,
    description: description,
    className: "group bg-gradient-to-r from-amber-50/95 to-orange-50/95 dark:from-amber-950/95 dark:to-orange-950/95 border border-amber-200/60 dark:border-amber-800/60 shadow-lg shadow-amber-500/20",
  });
}

export default showLevelUpToast;
