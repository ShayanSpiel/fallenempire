"use client";

import { cn } from "@/lib/utils";

const WALL_MAX_POINTS = 100000;

type WallMeterProps = {
  value?: number | null;
  attackerScore?: number | null;
  defenderScore?: number | null;
  className?: string;
};

export function WallMeter({
  value = null,
  attackerScore = 0,
  defenderScore = 0,
  className,
}: WallMeterProps) {
  const rawValue = value ?? (attackerScore ?? 0) - (defenderScore ?? 0);
  const clamped = Math.max(-WALL_MAX_POINTS, Math.min(WALL_MAX_POINTS, rawValue));
  const normalized = Math.abs(clamped);
  const fillPercent = (normalized / WALL_MAX_POINTS) * 50;
  const negativeFill = clamped < 0 ? fillPercent : 0;
  const positiveFill = clamped > 0 ? fillPercent : 0;
  const minVisible = 4;
  const negativeWidth = negativeFill > 0 ? Math.min(50, Math.max(negativeFill, minVisible)) : 0;
  const positiveWidth = positiveFill > 0 ? Math.min(50, Math.max(positiveFill, minVisible)) : 0;

  return (
    <div
      className={cn(
        "relative h-1.5 w-full overflow-hidden rounded-full bg-muted/60",
        className
      )}
    >
      {negativeWidth > 0 && (
        <span
          className="absolute top-0 h-full bg-destructive/80 z-10"
          style={{
            left: `calc(50% - ${negativeWidth}%)`,
            width: `${negativeWidth}%`,
          }}
        />
      )}
      {positiveWidth > 0 && (
        <span
          className="absolute top-0 h-full bg-success/80 z-10"
          style={{
            left: "50%",
            width: `${positiveWidth}%`,
          }}
        />
      )}
      <span className="absolute inset-y-0 left-1/2 -translate-x-1/2 w-px bg-border/70 z-20" />
    </div>
  );
}
