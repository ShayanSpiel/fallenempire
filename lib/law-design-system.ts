/**
 * Law System Design System
 *
 * Provides theme-aware color and styling configurations for different law types.
 * Colors are based on semantic meaning and map to theme-defined CSS variables:
 * - DECLARE_WAR: Uses destructive colors (red - #dc2626 / #fb7185)
 * - PROPOSE_HEIR: Uses warning colors (amber - #f59e0b)
 * - CHANGE_GOVERNANCE: Uses info colors (gray - #71717a / #a1a5b4)
 */

export type LawType = "DECLARE_WAR" | "PROPOSE_HEIR" | "CHANGE_GOVERNANCE" | "MESSAGE_OF_THE_DAY" | "WORK_TAX" | "IMPORT_TARIFF" | "CFC_ALLIANCE" | "ISSUE_CURRENCY";

export interface LawColorScheme {
  // Background colors (semi-transparent)
  bgLight: string;      // Light background
  bgMedium: string;     // Medium background
  bgStrong: string;     // Strong background

  // Border colors (semi-transparent)
  borderLight: string;  // Light border
  borderMedium: string; // Medium border
  borderStrong: string; // Strong border

  // Text colors
  textLight: string;    // Light text
  textStrong: string;   // Strong text

  // Icon color (used for accent elements)
  iconColor: string;

  // Button variant colors
  selectedBg: string;   // Selected background
  selectedBorder: string; // Selected border
  selectedText: string; // Selected text
}

/**
 * Color scheme mapping for each law type
 *
 * Maps to Tailwind's red-500 (DECLARE_WAR), amber-500 (PROPOSE_HEIR), blue-500 (CHANGE_GOVERNANCE), purple-500 (MESSAGE_OF_THE_DAY)
 * These colors remain consistent across light/dark themes through dark: modifiers
 */
export const LAW_COLOR_SCHEMES: Record<LawType, LawColorScheme> = {
  DECLARE_WAR: {
    // Red color palette (destructive)
    bgLight: "bg-red-500/5",
    bgMedium: "bg-red-500/10",
    bgStrong: "bg-red-500/20",
    borderLight: "border-red-500/20",
    borderMedium: "border-red-500/30",
    borderStrong: "border-red-500/50",
    textLight: "text-red-600 dark:text-red-400",
    textStrong: "text-red-700 dark:text-red-400",
    iconColor: "text-red-500",
    selectedBg: "bg-red-500/10",
    selectedBorder: "border-red-500/50",
    selectedText: "text-red-700 dark:text-red-400",
  },

  PROPOSE_HEIR: {
    // Amber color palette (warning)
    bgLight: "bg-amber-500/5",
    bgMedium: "bg-amber-500/10",
    bgStrong: "bg-amber-500/20",
    borderLight: "border-amber-500/20",
    borderMedium: "border-amber-500/30",
    borderStrong: "border-amber-500/50",
    textLight: "text-amber-600 dark:text-amber-400",
    textStrong: "text-amber-700 dark:text-amber-400",
    iconColor: "text-amber-500",
    selectedBg: "bg-amber-500/10",
    selectedBorder: "border-amber-500/50",
    selectedText: "text-amber-700 dark:text-amber-400",
  },

  CHANGE_GOVERNANCE: {
    // Blue color palette (info)
    bgLight: "bg-blue-500/5",
    bgMedium: "bg-blue-500/10",
    bgStrong: "bg-blue-500/20",
    borderLight: "border-blue-500/20",
    borderMedium: "border-blue-500/30",
    borderStrong: "border-blue-500/50",
    textLight: "text-blue-600 dark:text-blue-400",
    textStrong: "text-blue-700 dark:text-blue-400",
    iconColor: "text-blue-500",
    selectedBg: "bg-blue-500/10",
    selectedBorder: "border-blue-500/50",
    selectedText: "text-blue-700 dark:text-blue-400",
  },

  MESSAGE_OF_THE_DAY: {
    // Purple color palette (royal/announcement)
    bgLight: "bg-purple-500/5",
    bgMedium: "bg-purple-500/10",
    bgStrong: "bg-purple-500/20",
    borderLight: "border-purple-500/20",
    borderMedium: "border-purple-500/30",
    borderStrong: "border-purple-500/50",
    textLight: "text-purple-600 dark:text-purple-400",
    textStrong: "text-purple-700 dark:text-purple-400",
    iconColor: "text-purple-500",
    selectedBg: "bg-purple-500/10",
    selectedBorder: "border-purple-500/50",
    selectedText: "text-purple-700 dark:text-purple-400",
  },

  WORK_TAX: {
    // Green color palette (economy/money)
    bgLight: "bg-emerald-500/5",
    bgMedium: "bg-emerald-500/10",
    bgStrong: "bg-emerald-500/20",
    borderLight: "border-emerald-500/20",
    borderMedium: "border-emerald-500/30",
    borderStrong: "border-emerald-500/50",
    textLight: "text-emerald-600 dark:text-emerald-400",
    textStrong: "text-emerald-700 dark:text-emerald-400",
    iconColor: "text-emerald-500",
    selectedBg: "bg-emerald-500/10",
    selectedBorder: "border-emerald-500/50",
    selectedText: "text-emerald-700 dark:text-emerald-400",
  },

  IMPORT_TARIFF: {
    // Orange color palette (trade/tariff)
    bgLight: "bg-orange-500/5",
    bgMedium: "bg-orange-500/10",
    bgStrong: "bg-orange-500/20",
    borderLight: "border-orange-500/20",
    borderMedium: "border-orange-500/30",
    borderStrong: "border-orange-500/50",
    textLight: "text-orange-600 dark:text-orange-400",
    textStrong: "text-orange-700 dark:text-orange-400",
    iconColor: "text-orange-500",
    selectedBg: "bg-orange-500/10",
    selectedBorder: "border-orange-500/50",
    selectedText: "text-orange-700 dark:text-orange-400",
  },

  CFC_ALLIANCE: {
    // Cyan color palette (alliance/cooperation)
    bgLight: "bg-cyan-500/5",
    bgMedium: "bg-cyan-500/10",
    bgStrong: "bg-cyan-500/20",
    borderLight: "border-cyan-500/20",
    borderMedium: "border-cyan-500/30",
    borderStrong: "border-cyan-500/50",
    textLight: "text-cyan-600 dark:text-cyan-400",
    textStrong: "text-cyan-700 dark:text-cyan-400",
    iconColor: "text-cyan-500",
    selectedBg: "bg-cyan-500/10",
    selectedBorder: "border-cyan-500/50",
    selectedText: "text-cyan-700 dark:text-cyan-400",
  },

  ISSUE_CURRENCY: {
    // Yellow color palette (gold/currency)
    bgLight: "bg-yellow-500/5",
    bgMedium: "bg-yellow-500/10",
    bgStrong: "bg-yellow-500/20",
    borderLight: "border-yellow-500/20",
    borderMedium: "border-yellow-500/30",
    borderStrong: "border-yellow-500/50",
    textLight: "text-yellow-600 dark:text-yellow-400",
    textStrong: "text-yellow-700 dark:text-yellow-400",
    iconColor: "text-yellow-500",
    selectedBg: "bg-yellow-500/10",
    selectedBorder: "border-yellow-500/50",
    selectedText: "text-yellow-700 dark:text-yellow-400",
  },
};

/**
 * Get color scheme for a law type
 */
export function getLawColorScheme(lawType: LawType): LawColorScheme {
  return LAW_COLOR_SCHEMES[lawType];
}
