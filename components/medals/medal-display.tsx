"use client";

import { Sword, Star, Trophy, Shield } from "lucide-react";
import { borders, layout } from "@/lib/design-system";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface MedalProps {
  key: string;
  name: string;
  description?: string;
  earnedAt?: string;
}

function getMedalIcon(medalKey: string) {
  switch (medalKey) {
    case "battle_hero":
      return Sword;
    case "champion":
      return Trophy;
    case "verified":
      return Shield;
    default:
      return Star;
  }
}

function getMedalColor(medalKey: string) {
  switch (medalKey) {
    case "battle_hero":
      return "border-amber-400/30 text-amber-400 bg-amber-950/20 hover:bg-amber-950/40";
    case "champion":
      return "border-yellow-400/30 text-yellow-400 bg-yellow-950/20 hover:bg-yellow-950/40";
    case "verified":
      return "border-blue-400/30 text-blue-400 bg-blue-950/20 hover:bg-blue-950/40";
    default:
      return "border-slate-400/30 text-slate-400 bg-slate-950/20 hover:bg-slate-950/40";
  }
}

export function MedalIcon({ key, name, description, earnedAt }: MedalProps) {
  const Icon = getMedalIcon(key);
  const colorClass = getMedalColor(key);

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
          <div
            className={`
              relative ${layout.sizes.avatar.lg} rounded-full ${borders.thin} flex items-center justify-center
              transition-all duration-200 cursor-pointer ${colorClass}
            `}
          >
            {/* Glow effect */}
            <div
              className={`absolute inset-0 rounded-full blur-sm opacity-0 group-hover:opacity-50 transition-opacity`}
            />

            {/* Medal icon */}
            <Icon className="w-8 h-8 relative z-10" />
          </div>
        </TooltipTrigger>
        <TooltipContent className="text-center">
          <p className="font-bold">{name}</p>
          {description && <p className="text-sm text-slate-300">{description}</p>}
          {formattedDate && (
            <p className="text-xs text-slate-400 mt-1">Earned {formattedDate}</p>
          )}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}