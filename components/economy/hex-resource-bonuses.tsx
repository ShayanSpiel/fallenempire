"use client";

import React from "react";
import {
  RESOURCE_DISTRIBUTION_RULES,
  getResourceColor,
  getResourceIcon,
  type HexResourceBonus,
} from "@/lib/economy/hex-resource-distribution";
import { TrendingUp } from "lucide-react";
import { getResourceIconComponent } from "@/lib/economy/resource-icons";
import { cn } from "@/lib/utils";

interface HexResourceBonusesProps {
  bonus?: HexResourceBonus | null;
  resourceStat?: {
    bonus: HexResourceBonus;
    valueText: string;
    valueClassName?: string;
  } | null;
}

export function HexResourceBonuses({
  bonus,
  resourceStat,
}: HexResourceBonusesProps) {
  const shouldUseStat =
    Boolean(resourceStat) &&
    (resourceStat?.valueText === "Buffer Zone" ||
      resourceStat?.valueText.includes("Buffered"));
  const activeBonus = shouldUseStat
    ? resourceStat?.bonus ?? null
    : bonus ?? resourceStat?.bonus ?? null;
  if (!activeBonus) {
    return (
      <div className="flex flex-col items-center justify-center py-6 text-center space-y-2">
        <div className="p-3 rounded-full bg-muted/30">
          <TrendingUp className="h-5 w-5 text-muted-foreground/40" />
        </div>
        <p className="text-xs font-medium text-muted-foreground">
          Standard Production
        </p>
        <p className="text-[10px] text-muted-foreground/60 max-w-[200px]">
          No base resource nodes detected in this region
        </p>
      </div>
    );
  }

  const IconComponent = getResourceIconComponent(
    getResourceIcon(activeBonus.resourceKey)
  );
  const resourceColor = getResourceColor(activeBonus.resourceKey);
  const maxZoneBonus =
    RESOURCE_DISTRIBUTION_RULES.bonusZoneSteps[
      RESOURCE_DISTRIBUTION_RULES.bonusZoneSteps.length - 1
    ]?.bonus ?? activeBonus.bonus;
  const maxZonePercentage = `${(maxZoneBonus * 100).toFixed(0)}%`;
  const statusText = shouldUseStat
    ? resourceStat!.valueText
    : `Base ${activeBonus.percentage}`;
  const valueText = shouldUseStat
    ? resourceStat!.valueText
    : `+${activeBonus.percentage}`;
  const valueClassName = shouldUseStat
    ? resourceStat?.valueClassName
    : undefined;
  const isBufferZone = shouldUseStat && resourceStat?.valueText === "Buffer Zone";
  const isBuffered = shouldUseStat && resourceStat?.valueText.includes("Buffered");
  const labelText = isBufferZone
    ? "Buffer Zone"
    : isBuffered
      ? "Buffered Bonus"
      : activeBonus.label;
  const footerText = isBufferZone
    ? "Capture the resource center to activate bonuses"
    : `Capture neighboring buffer hexes to scale this bonus up to ${maxZonePercentage}`;

  return (
    <div className="space-y-3 py-2">
      <div className="flex items-center justify-between px-1">
        <h4 className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
          Production Bonus
        </h4>
        <div className="text-[10px] text-muted-foreground/60 tabular-nums">
          {statusText}
        </div>
      </div>

      <div className="space-y-1.5">
        <div className="flex items-center gap-2.5 px-2 py-2 rounded-md bg-muted/30 hover:bg-muted/50 transition-colors">
          <div
            className="p-1.5 rounded"
            style={{
              backgroundColor: `${resourceColor}15`,
              color: resourceColor,
            }}
          >
            <IconComponent className="h-3.5 w-3.5" />
          </div>

          <div className="flex-1 min-w-0">
            <p className="text-xs font-semibold text-foreground">
              {activeBonus.resourceName}
            </p>
            <p className="text-[10px] text-muted-foreground truncate">
              {labelText}
            </p>
          </div>

          <div className="flex flex-col items-end gap-0.5">
            <span
              className={cn("text-xs font-bold tabular-nums", valueClassName)}
              style={!valueClassName ? { color: resourceColor } : undefined}
            >
              {valueText}
            </span>
            <span className="text-[9px] uppercase tracking-wide text-muted-foreground/70">
              {isBufferZone ? "Zone" : isBuffered ? "Buffered" : "Base"}
            </span>
          </div>
        </div>
      </div>

      <div className="pt-2 px-1 border-t border-border/30">
        <p className="text-[9px] text-muted-foreground/50 text-center max-w-[220px] mx-auto">
          {footerText}
        </p>
      </div>
    </div>
  );
}
