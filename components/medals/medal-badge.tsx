"use client";

import Image from "next/image";
import React from "react";
import { Medal } from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface MedalBadgeProps {
  medalKey: string;
  name: string;
  count: number;
  description?: string;
  earnedAt?: string;
}

function getMedalImageUrl(medalKey: string): string {
  switch (medalKey) {
    case "battle_hero":
      return "https://i.ibb.co/zTtkV0y4/battle-hero2.png";
    default:
      return "https://i.ibb.co/zTtkV0y4/battle-hero2.png";
  }
}

export function MedalBadge({
  medalKey,
  name,
  count,
  description,
  earnedAt,
}: MedalBadgeProps) {
  const imageUrl = getMedalImageUrl(medalKey);
  const hasEarned = count > 0;
  const [imageError, setImageError] = React.useState(false);

  const formattedDate = earnedAt
    ? new Date(earnedAt).toLocaleDateString("en-US", {
        year: "numeric",
        month: "short",
        day: "numeric",
      })
    : null;

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <div className="flex flex-col items-center gap-2 cursor-pointer">
            {/* Medal Icon with Badge */}
            <div
              className={`relative w-16 h-16 flex items-center justify-center transition-all duration-300 ${
                hasEarned ? "brightness-125" : "grayscale opacity-60"
              }`}
            >
              {!imageError ? (
                <Image
                  src={imageUrl}
                  alt={name}
                  width={64}
                  height={64}
                  className="w-full h-full object-contain"
                  unoptimized
                  onError={() => setImageError(true)}
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center bg-muted/40 rounded border border-border/40">
                  <Medal size={32} className="text-muted-foreground/40" />
                </div>
              )}
            </div>

            {/* Medal Count with Gradient Background */}
            <div
              className={`
                relative px-2 py-1 rounded-md text-xs font-bold
                transition-all duration-300
                ${
                  hasEarned
                    ? "bg-gradient-to-r from-amber-900 to-slate-900 text-amber-300"
                    : "bg-gradient-to-r from-slate-700 to-slate-800 text-slate-400"
                }
              `}
            >
              <span className="tabular-nums">{count}</span>
            </div>
          </div>
        </TooltipTrigger>
        <TooltipContent className="text-center">
          <p className="font-bold">{name}</p>
          {description && <p className="text-sm text-slate-300">{description}</p>}
          {formattedDate && (
            <p className="text-xs text-slate-400 mt-1">
              First earned {formattedDate}
            </p>
          )}
          <p className="text-xs text-slate-400 mt-1">Total: {count}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
