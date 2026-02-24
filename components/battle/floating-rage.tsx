"use client";

import React, { useEffect, useState } from "react";
import { cn } from "@/lib/utils";

interface FloatingRageProps {
  id: number;
  rageGain: number;
}

function FloatingRageComponent({ rageGain }: FloatingRageProps) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    const t = requestAnimationFrame(() => setMounted(true));
    return () => cancelAnimationFrame(t);
  }, []);

  return (
    <div
      className={cn(
        "pointer-events-none absolute z-30",
        "text-4xl md:text-6xl font-black uppercase flex items-center gap-2",
        "text-amber-500",
        "[text-shadow:_0_0_1px_white,_0_0_2px_white,_-1px_-1px_0_white,_1px_-1px_0_white,_-1px_1px_0_white,_1px_1px_0_white]",
        "animate-shake"
      )}
      style={{
        top: "50%",
        left: "50%",
        transform: mounted
          ? "translate(-50%, -150%) scale(1.2)"
          : "translate(-50%, -50%) scale(0.5)",
        opacity: mounted ? 0 : 1,
        transition: "transform 0.6s cubic-bezier(0.175, 0.885, 0.32, 1.275), opacity 0.6s ease-in",
      }}
    >
      <span>🔥</span>
      <span>+{rageGain}</span>
    </div>
  );
}

export const FloatingRage = React.memo(FloatingRageComponent);
