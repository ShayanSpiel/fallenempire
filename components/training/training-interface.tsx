"use client";

import { useState, useTransition } from "react";
import { Timer, Dumbbell } from "lucide-react";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { trainAction } from "@/app/actions/training";
import { showLevelUpToast } from "@/components/progression/level-up-toast";
import { layout, transitions } from "@/lib/design-system";
import { showInfoToast } from "@/lib/toast-utils";
import {
  DAILY_STRENGTH_INCREMENT,
  normalizeStrength,
  STRENGTH_DISPLAY_PRECISION,
} from "@/lib/gameplay/strength";

interface TrainingInterfaceProps {
  strength: number;
  canTrain: boolean;
}

export function TrainingInterface({ strength: initialStrength, canTrain: initialCanTrain }: TrainingInterfaceProps) {
  const [strength, setStrength] = useState(() =>
    normalizeStrength(initialStrength, STRENGTH_DISPLAY_PRECISION),
  );
  const [canTrain, setCanTrain] = useState(initialCanTrain);
  const [isPending, startTransition] = useTransition();

  const clampStrength = (value: number) =>
    normalizeStrength(value, STRENGTH_DISPLAY_PRECISION);

  const handleTrain = () => {
    if (!canTrain) return;

    startTransition(async () => {
      setStrength((prev) => clampStrength(prev + DAILY_STRENGTH_INCREMENT));
      setCanTrain(false);

      const result = await trainAction();

      if (result.error) {
        console.error("Training failed:", result.error);
        showInfoToast(result.error);
        setStrength((prev) => clampStrength(prev - DAILY_STRENGTH_INCREMENT));
        setCanTrain(true);
      } else {
        if (result.levelUp && result.newLevel) {
          showLevelUpToast({
            level: result.newLevel,
            levelUps: 1,
          });
        }
      }
    });
  };

  return (
    <Card variant="default" className="w-full p-6">
      <div className="flex flex-col items-center justify-center gap-6">
        {/* Strength Display */}
        <div className="text-center space-y-1">
          <div className="flex items-center justify-center gap-2 text-muted-foreground">
            <Dumbbell size={18} />
            <span className="text-sm font-semibold uppercase tracking-wider">Strength</span>
          </div>
          <div className="text-8xl font-black tabular-nums text-foreground leading-none">
            {strength.toFixed(STRENGTH_DISPLAY_PRECISION)}
          </div>
        </div>

        {/* Training Button */}
        <div className="w-full max-w-xs pt-4">
          <Button
            size="lg"
            className={cn(
              "w-full h-16 text-base font-bold uppercase tracking-[0.25em] rounded-[var(--button-radius,0.5rem)]",
              transitions.normal,
              canTrain && !isPending
                ? "bg-success hover:bg-success/90 text-success-foreground shadow-md hover:shadow-lg"
                : "bg-muted text-muted-foreground cursor-not-allowed opacity-60"
            )}
            onClick={handleTrain}
            disabled={!canTrain || isPending}
          >
            <div className="flex items-center justify-center gap-2">
              {isPending ? (
                "In Progress..."
              ) : canTrain ? (
                <>
                  <Dumbbell size={20} className="flex-shrink-0" />
                  <span>Train</span>
                </>
              ) : (
                <>
                  <Timer size={20} className="flex-shrink-0" />
                  <span>Resting</span>
                </>
              )}
            </div>
          </Button>

          {!canTrain && (
            <div className="flex items-center justify-center gap-1.5 text-xs text-muted-foreground opacity-70 pt-3">
              <Timer size={14} className="flex-shrink-0" />
              <span>Available tomorrow (UTC)</span>
            </div>
          )}
        </div>
      </div>
    </Card>
  );
}
