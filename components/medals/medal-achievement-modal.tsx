"use client";

import { useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { ArrowUp, Sword, Star } from "lucide-react";
import confetti from "canvas-confetti";

interface MedalAchievementModalProps {
  isOpen: boolean;
  medalName: string;
  medalKey: string;
  description?: string;
  onClose: () => void;
}

export function MedalAchievementModal({
  isOpen,
  medalName,
  medalKey,
  description,
  onClose,
}: MedalAchievementModalProps) {
  const [isAnimating, setIsAnimating] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setIsAnimating(true);
      // Trigger confetti animation
      triggerConfetti();
    }
  }, [isOpen]);

  const triggerConfetti = () => {
    // Burst from center
    confetti({
      particleCount: 100,
      spread: 70,
      origin: { x: 0.5, y: 0.5 },
    });

    // Burst from sides
    setTimeout(() => {
      confetti({
        particleCount: 50,
        angle: 60,
        spread: 55,
        origin: { x: 0, y: 0.5 },
      });
      confetti({
        particleCount: 50,
        angle: 120,
        spread: 55,
        origin: { x: 1, y: 0.5 },
      });
    }, 200);
  };

  const getMedalIcon = () => {
    switch (medalKey) {
      case "battle_hero":
        return <Sword className="w-24 h-24" />;
      default:
        return <Star className="w-24 h-24" />;
    }
  };

  const getMedalAccent = () => {
    switch (medalKey) {
      case "battle_hero":
        return { icon: "text-warning", glow: "bg-warning" };
      default:
        return { icon: "text-primary", glow: "bg-primary" };
    }
  };

  const getCelebrateButtonContent = () => {
    if (medalKey === "battle_hero") {
      return (
        <span className="flex flex-wrap items-center justify-center gap-2">
          <span>Celebrate</span>
          <span className="flex items-center gap-1 text-sm font-semibold text-primary-foreground/90">
            <ArrowUp className="h-4 w-4 text-primary-foreground/80" />
            +3 morale
          </span>
        </span>
      );
    }
    return "Celebrate";
  };

  const medalAccent = getMedalAccent();

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md p-0 overflow-hidden">
        <div className="flex flex-col items-center justify-center py-12 px-6 bg-gradient-to-br from-card via-card to-muted">
          {/* Medal Display */}
          <div
            className={`relative mb-8 ${isAnimating ? "animate-bounce" : ""}`}
          >
            <div
              className={`absolute inset-0 blur-2xl rounded-full animate-pulse ${medalAccent.glow} opacity-20`}
            />
            <div
              className={`relative ${medalAccent.icon} drop-shadow-lg`}
            >
              {getMedalIcon()}
            </div>
          </div>

          {/* Title */}
          <DialogTitle className="text-3xl font-bold text-center mb-2 bg-gradient-to-r from-foreground to-primary bg-clip-text text-transparent">
            Achievement Unlocked!
          </DialogTitle>

          {/* Medal Name */}
          <p className="text-2xl font-bold text-center mb-4 text-foreground">
            {medalName}
          </p>

          {/* Description */}
          {description && (
            <DialogDescription className="text-center text-sm mb-6 max-w-xs">
              {description}
            </DialogDescription>
          )}

          {/* Celebration Text */}
          <p className="text-center text-lg font-semibold text-muted-foreground mb-8">
            ✨ Amazing performance! ✨
          </p>

          {/* Close Button */}
          <Button
            onClick={onClose}
            className="px-6"
          >
            {getCelebrateButtonContent()}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
