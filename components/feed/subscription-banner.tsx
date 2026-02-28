"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Crown, X, Sparkles, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import Link from "next/link";

const BANNER_STORAGE_KEY = "subscription-banner-dismissed";

interface SubscriptionBannerProps {
  userTier?: "alpha" | "sigma" | "omega";
}

export function SubscriptionBanner({ userTier = "alpha" }: SubscriptionBannerProps) {
  const [isDismissed, setIsDismissed] = useState(false);
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
    // Check if banner was dismissed
    const dismissed = localStorage.getItem(BANNER_STORAGE_KEY);
    if (dismissed === "true") {
      setIsDismissed(true);
    }
  }, []);

  const handleDismiss = () => {
    setIsDismissed(true);
    localStorage.setItem(BANNER_STORAGE_KEY, "true");
  };

  // Don't show banner for Omega users (highest tier)
  if (!isMounted || isDismissed || userTier === "omega") {
    return null;
  }

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -10 }}
        transition={{ duration: 0.3 }}
        className="relative"
      >
        <Link href="/subscribe" className="block group">
          <div className="relative overflow-hidden rounded-xl border-2 border-amber-400/50 dark:border-amber-600/50 bg-gradient-to-br from-amber-50 via-orange-50 to-amber-100 dark:from-amber-950/40 dark:via-orange-950/40 dark:to-amber-950/30 shadow-md hover:shadow-lg transition-all duration-300 group-hover:scale-[1.02]">
            {/* Animated Background Pattern */}
            <div className="absolute inset-0 opacity-20">
              <motion.div
                animate={{
                  backgroundPosition: ["0% 0%", "100% 100%"],
                }}
                transition={{
                  duration: 20,
                  repeat: Infinity,
                  repeatType: "reverse",
                }}
                className="absolute inset-0"
                style={{
                  backgroundImage: `radial-gradient(circle at 2px 2px, currentColor 1px, transparent 0)`,
                  backgroundSize: "24px 24px",
                }}
              />
            </div>

            {/* Dismiss Button */}
            <button
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                handleDismiss();
              }}
              className="absolute top-2 right-2 z-10 p-1 rounded-full bg-background/80 hover:bg-background transition-colors"
            >
              <X className="w-3 h-3 text-muted-foreground" />
            </button>

            {/* Content */}
            <div className="relative p-4 space-y-3">
              {/* Icon Header */}
              <div className="flex items-center gap-2">
                <motion.div
                  animate={{
                    rotate: [0, -10, 10, -10, 0],
                    scale: [1, 1.1, 1],
                  }}
                  transition={{
                    duration: 3,
                    repeat: Infinity,
                    repeatDelay: 2,
                  }}
                  className="flex items-center justify-center w-8 h-8 rounded-lg bg-gradient-to-br from-amber-500 to-orange-500 shadow-md"
                >
                  <Crown className="w-4 h-4 text-white" />
                </motion.div>
                <div className="flex items-center gap-1.5">
                  <h3 className="text-sm font-bold text-amber-900 dark:text-amber-200">
                    {userTier === "alpha" ? "Become a Patron" : "Upgrade to Omega"}
                  </h3>
                  <motion.div
                    animate={{
                      opacity: [0.5, 1, 0.5],
                    }}
                    transition={{
                      duration: 2,
                      repeat: Infinity,
                    }}
                  >
                    <Sparkles className="w-3 h-3 text-amber-600 dark:text-amber-400" />
                  </motion.div>
                </div>
              </div>

              {/* Description */}
              <p className="text-xs text-amber-800 dark:text-amber-300 leading-relaxed">
                {userTier === "alpha"
                  ? "Support the game and gain recognition as a patron"
                  : "Upgrade to Omega for maximum prestige"}
              </p>

              {/* CTA */}
              <div className="flex items-center justify-between pt-1">
                <div className="flex items-center gap-1">
                  <span className="text-xs font-semibold text-amber-900 dark:text-amber-100">
                    Starting at $9.99/mo
                  </span>
                </div>
                <Button
                  size="sm"
                  className="h-7 px-3 text-xs bg-gradient-to-r from-amber-600 to-orange-600 hover:from-amber-700 hover:to-orange-700 text-white border-0 shadow-sm group-hover:shadow-md transition-all"
                  asChild
                >
                  <span className="flex items-center gap-1">
                    Learn More
                    <motion.div
                      animate={{
                        x: [0, 3, 0],
                      }}
                      transition={{
                        duration: 1.5,
                        repeat: Infinity,
                      }}
                    >
                      <ArrowRight className="w-3 h-3" />
                    </motion.div>
                  </span>
                </Button>
              </div>

              {/* Progress Dots */}
              <div className="flex justify-center gap-1 pt-1">
                <motion.div
                  animate={{
                    opacity: [0.3, 1, 0.3],
                  }}
                  transition={{
                    duration: 1.5,
                    repeat: Infinity,
                    delay: 0,
                  }}
                  className="w-1 h-1 rounded-full bg-amber-600 dark:bg-amber-400"
                />
                <motion.div
                  animate={{
                    opacity: [0.3, 1, 0.3],
                  }}
                  transition={{
                    duration: 1.5,
                    repeat: Infinity,
                    delay: 0.3,
                  }}
                  className="w-1 h-1 rounded-full bg-amber-600 dark:bg-amber-400"
                />
                <motion.div
                  animate={{
                    opacity: [0.3, 1, 0.3],
                  }}
                  transition={{
                    duration: 1.5,
                    repeat: Infinity,
                    delay: 0.6,
                  }}
                  className="w-1 h-1 rounded-full bg-amber-600 dark:bg-amber-400"
                />
              </div>
            </div>
          </div>
        </Link>
      </motion.div>
    </AnimatePresence>
  );
}
