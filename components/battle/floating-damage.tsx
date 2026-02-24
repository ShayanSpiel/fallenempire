"use client";

import React, { useEffect, useState } from "react";
import { cn } from "@/lib/utils";

export type FloatingDamageResult = "HIT" | "MISS" | "CRITICAL";

interface FloatingDamageProps {
  id: number;
  side: "attacker" | "defender";
  damage: number;
  result: FloatingDamageResult;
  theme: {
    attackerText: string;
    defenderText: string;
    shadow: string;
  };
}

function FloatingDamageComponent({
  side,
  damage,
  result,
  theme,
}: FloatingDamageProps) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    const t = requestAnimationFrame(() => setMounted(true));
    return () => cancelAnimationFrame(t);
  }, []);

  const baseLeft = side === "defender" ? "32%" : "68%";

  // Config based on result type
  const getConfig = () => {
    switch (result) {
      case "CRITICAL":
        return {
          text: damage.toLocaleString(),
          textClassName: cn(
            "text-4xl md:text-6xl font-black tabular-nums",
            "text-amber-400",
            "animate-shake",
            "[-webkit-text-stroke:2px_#ffffff]"
          ),
          animation: mounted
            ? "translate(-50%, -220%) scale(1.6)"
            : "translate(-50%, -120%) scale(1.05)",
        };
      case "MISS":
        return {
          text: "MISSED",
          textClassName: cn(
            "text-4xl md:text-6xl font-black uppercase",
            "text-muted-foreground/60",
            theme.shadow
          ),
          animation: mounted
            ? "translate(-50%, -150%) scale(1.2)"
            : "translate(-50%, -50%) scale(0.5)",
        };
      default:
        return {
          text: damage.toLocaleString(),
          textClassName: cn(
            "text-4xl md:text-6xl font-black tabular-nums",
            theme.shadow,
            side === "defender" ? theme.defenderText : theme.attackerText
          ),
          animation: mounted
            ? "translate(-50%, -150%) scale(1.2)"
            : "translate(-50%, -50%) scale(0.5)",
        };
    }
  };

  const config = getConfig();
  const prefix = result === "MISS" ? "" : side === "defender" ? "+" : "-";

  return (
    <div
      className="pointer-events-none absolute z-30"
      style={{
        top: "50%",
        left: baseLeft,
        transform: config.animation,
        opacity: mounted ? 0 : 1,
        transition:
          result === "CRITICAL"
            ? "transform 2.6s cubic-bezier(0.68, -0.55, 0.265, 1.55), opacity 2.6s ease-in"
            : "transform 0.6s cubic-bezier(0.175, 0.885, 0.32, 1.275), opacity 0.6s ease-in",
      }}
    >
      <span className={cn("inline-block", config.textClassName)}>
        {prefix}
        {config.text}
      </span>
    </div>
  );
}

export const FloatingDamage = React.memo(FloatingDamageComponent);
