import * as React from "react";

import { cn } from "@/lib/utils";

export const COMMUNITY_STAT_LABEL_CLASSES =
  "text-[9px] font-bold text-muted-foreground uppercase tracking-wider mb-0.5";

export const COMMUNITY_STAT_VALUE_CLASSES =
  "text-sm font-bold text-foreground tabular-nums flex items-center gap-1.5";

export type CommunityStatPartsProps = {
  label: string;
  icon?: React.ReactNode;
  value: React.ReactNode;
  labelClassName?: string;
  valueClassName?: string;
};

export function CommunityStatParts({
  label,
  icon,
  value,
  labelClassName,
  valueClassName,
}: CommunityStatPartsProps) {
  return (
    <>
      <span className={cn(COMMUNITY_STAT_LABEL_CLASSES, labelClassName)}>{label}</span>
      <span className={cn(COMMUNITY_STAT_VALUE_CLASSES, valueClassName)}>
        {icon}
        {value}
      </span>
    </>
  );
}

