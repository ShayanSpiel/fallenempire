"use client";

import React, { useEffect, useState } from "react";
import { cn } from "@/lib/utils";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { resolveAvatar } from "@/lib/avatar";

interface FloatingTauntProps {
  id: string;
  username: string;
  avatarUrl?: string | null;
  position: { x: number; y: number };
  onComplete: () => void;
}

function FloatingTauntComponent({
  username,
  avatarUrl,
  position,
  onComplete,
}: FloatingTauntProps) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    // Start animation
    const t = requestAnimationFrame(() => setMounted(true));

    // Remove after animation completes (5 seconds - longer to show middle finger more)
    const timer = setTimeout(() => {
      onComplete();
    }, 5000);

    return () => {
      cancelAnimationFrame(t);
      clearTimeout(timer);
    };
  }, [onComplete]);

  const getUserAvatar = (name: string, url?: string | null) =>
    resolveAvatar({ avatarUrl: url, seed: name });

  return (
    <div
      className="pointer-events-none absolute z-40"
      style={{
        left: `${position.x}%`,
        top: `${position.y}%`,
        transform: mounted ? "translateY(-250px)" : "translateY(0)",
        opacity: mounted ? 0 : 1,
        transition: "transform 5s cubic-bezier(0.25, 0.46, 0.45, 0.94), opacity 5s ease-in 2s",
      }}
    >
      <div className="flex flex-col items-center gap-2 animate-pulse">
        {/* Middle Finger Emoji - Large */}
        <div className="text-6xl md:text-8xl drop-shadow-lg" style={{
          textShadow: "0 0 10px rgba(255,255,255,0.5)",
          animation: "wiggle 0.5s ease-in-out infinite",
        }}>
          🖕
        </div>

        {/* User Avatar + Username */}
        <div className="flex items-center gap-2 bg-black/80 backdrop-blur-sm px-3 py-1.5 rounded-full">
          <Avatar className="h-6 w-6">
            <AvatarImage src={getUserAvatar(username, avatarUrl)} />
            <AvatarFallback>{username.slice(0, 2).toUpperCase()}</AvatarFallback>
          </Avatar>
          <span className="text-white text-xs font-bold">{username}</span>
        </div>
      </div>

      <style jsx>{`
        @keyframes wiggle {
          0%, 100% {
            transform: rotate(-5deg);
          }
          50% {
            transform: rotate(5deg);
          }
        }
      `}</style>
    </div>
  );
}

export const FloatingTaunt = React.memo(FloatingTauntComponent);
