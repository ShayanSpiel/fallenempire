"use client";

import React, { useEffect, useState } from "react";
import { cn } from "@/lib/utils";

interface FloatingAdrenalineRageProps {
  id: number;
}

function FloatingAdrenalineRageComponent({ id }: FloatingAdrenalineRageProps) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    const t = requestAnimationFrame(() => setMounted(true));
    return () => cancelAnimationFrame(t);
  }, []);

  return (
    <div
      className={cn(
        "pointer-events-none absolute z-40",
        "text-3xl md:text-5xl font-black flex items-center gap-1.5",
        "text-amber-500",
        // White thick stroke (like critical numbers)
        "[-webkit-text-stroke:2px_#ffffff]"
      )}
      style={{
        // Position relative to adrenaline bar location
        bottom: "calc(100% + 8px)", // Just above the adrenaline bar
        left: "50%",
        transform: mounted
          ? "translate(-50%, -120px) scale(1.3)"
          : "translate(-50%, 0px) scale(0.8)",
        opacity: mounted ? 0 : 1,
        transition: "transform 1s cubic-bezier(0.175, 0.885, 0.32, 1.275), opacity 1s ease-in",
      }}
    >
      <span className="text-4xl md:text-5xl">🔥</span>
      <span className="tabular-nums">+1</span>
    </div>
  );
}

export const FloatingAdrenalineRage = React.memo(FloatingAdrenalineRageComponent);
