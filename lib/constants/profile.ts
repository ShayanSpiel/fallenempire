import type { ComponentType } from "react";
import { Activity, Brain, CircleDollarSign, Swords } from "lucide-react";

export type ProfileStatKey = "mentalPower" | "freewill" | "militaryPower" | "economyPower";

export type ProfileStatDefinition = {
  key: ProfileStatKey;
  label: string;
  tooltip: string;
  icon: ComponentType<{ className?: string }>;
  formatValue?: (value?: number | null) => string;
};

const formatNumber = (value?: number | null) => {
  if (value == null || Number.isNaN(value)) {
    return "—";
  }
  return value.toLocaleString();
};

const formatPercent = (value?: number | null) => {
  const numeric = typeof value === "number" ? value : 0;
  const bounded = Math.min(100, Math.max(0, Math.round(numeric)));
  return `${bounded}%`;
};

export const PROFILE_STAT_DEFINITIONS: ProfileStatDefinition[] = [
  {
    key: "mentalPower",
    label: "Mental Power",
    tooltip: "Mental Power fuels psionic actions and strategic abilities.",
    icon: Brain,
    formatValue: formatNumber,
  },
  {
    key: "freewill",
    label: "Free Will",
    tooltip: "Free Will reflects autonomy and resistance to influence.",
    icon: Activity,
    formatValue: formatPercent,
  },
  {
    key: "militaryPower",
    label: "Military Power",
    tooltip: "Military readiness (placeholder metric).",
    icon: Swords,
    formatValue: formatNumber,
  },
  {
    key: "economyPower",
    label: "Economy Power",
    tooltip: "Economic output (mock data).",
    icon: CircleDollarSign,
    formatValue: formatNumber,
  },
];

export function formatStatValue(key: ProfileStatKey, value?: number | null) {
  const definition = PROFILE_STAT_DEFINITIONS.find((stat) => stat.key === key);
  const formatter = definition?.formatValue ?? formatNumber;
  return formatter(value);
}
