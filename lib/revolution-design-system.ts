/**
 * Revolution & Uprising Design System
 *
 * Provides theme-aware color and styling configurations for revolution mechanics.
 * Uses red/amber gradient to convey urgency and political upheaval.
 * Scales for future additions: different uprising types, faction colors, etc.
 */

export type RevolutionPhase = "spark" | "agitation" | "battle" | "success" | "failed" | "negotiated";

export interface RevolutionColorScheme {
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

  // Icon color
  iconColor: string;

  // Button variant colors
  buttonBg: string;     // Button background
  buttonHover: string;  // Button hover state
  buttonText: string;   // Button text

  // Progress bar colors (gradient or solid)
  progressStart: string;  // Progress bar start color
  progressEnd: string;    // Progress bar end color

  // State-specific colors
  leaderBg: string;     // Leader avatar/badge background
  supporterBg: string;  // Supporter badge background
}

/**
 * Main revolution color scheme (Red/Amber for upheaval)
 * Maps to Tailwind's red-500 and amber-500 palette
 * Dark theme compatible through dark: modifiers
 */
export const REVOLUTION_COLOR_SCHEME: RevolutionColorScheme = {
  // Background colors - subtle red
  bgLight: "bg-red-500/5",
  bgMedium: "bg-red-500/10",
  bgStrong: "bg-red-500/20",

  // Border colors - red accent
  borderLight: "border-red-500/20",
  borderMedium: "border-red-500/30",
  borderStrong: "border-red-500/50",

  // Text colors - red theme
  textLight: "text-red-600 dark:text-red-400",
  textStrong: "text-red-700 dark:text-red-300",

  // Icon color
  iconColor: "text-red-500 dark:text-red-400",

  // Button colors - red primary with hover state
  buttonBg: "bg-red-600 dark:bg-red-700",
  buttonHover: "hover:bg-red-700 dark:hover:bg-red-600",
  buttonText: "text-white",

  // Progress bar - red to amber gradient
  progressStart: "from-red-600 dark:from-red-500",
  progressEnd: "to-amber-500 dark:to-amber-400",

  // State-specific
  leaderBg: "bg-red-600/20 dark:bg-red-500/20",
  supporterBg: "bg-amber-500/10 dark:bg-amber-500/10",
};

/**
 * Governor's negotiation button theme (Yellow/Amber for diplomacy)
 */
export const NEGOTIATION_COLOR_SCHEME: RevolutionColorScheme = {
  bgLight: "bg-amber-500/5",
  bgMedium: "bg-amber-500/10",
  bgStrong: "bg-amber-500/20",
  borderLight: "border-amber-500/20",
  borderMedium: "border-amber-500/30",
  borderStrong: "border-amber-500/50",
  textLight: "text-amber-600 dark:text-amber-400",
  textStrong: "text-amber-700 dark:text-amber-300",
  iconColor: "text-amber-500",
  buttonBg: "bg-amber-600 dark:bg-amber-700",
  buttonHover: "hover:bg-amber-700 dark:hover:bg-amber-600",
  buttonText: "text-white",
  progressStart: "from-amber-600 dark:from-amber-500",
  progressEnd: "to-amber-400 dark:to-amber-300",
  leaderBg: "bg-amber-600/20",
  supporterBg: "bg-amber-500/10",
};

/**
 * Component spacing and layout tokens (use design-system.ts spacing)
 */
export const revolutionSpacing = {
  container: "px-4 py-4 md:px-6 md:py-5",
  gap: "gap-4",
  stack: "gap-3",
} as const;

/**
 * Typography tokens for revolution components
 */
export const revolutionTypography = {
  title: "text-lg font-semibold",
  subtitle: "text-sm font-medium",
  label: "text-xs font-semibold uppercase tracking-wide",
  body: "text-sm font-normal",
  meta: "text-[10px] font-medium uppercase tracking-wide",
} as const;

/**
 * Border radius for revolution components
 */
export const revolutionRadius = {
  card: "rounded-xl",
  button: "rounded-md",
  badge: "rounded",
} as const;

/**
 * Phase-specific styling (future: can add different color schemes per phase)
 */
export const phaseStyles: Record<RevolutionPhase, { label: string; icon: string }> = {
  spark: {
    label: "Revolution Sparked",
    icon: "Flame",
  },
  agitation: {
    label: "Rising Tensions",
    icon: "AlertTriangle",
  },
  battle: {
    label: "Civil War",
    icon: "Swords",
  },
  success: {
    label: "New Sovereign",
    icon: "Crown",
  },
  failed: {
    label: "Revolution Failed",
    icon: "XCircle",
  },
  negotiated: {
    label: "Peace Agreed",
    icon: "Handshake",
  },
};

/**
 * Get color scheme based on context
 * Extensible for future: different upheaval types, faction colors, etc.
 */
export function getRevolutionColorScheme(context: "rebellion" | "negotiation" = "rebellion"): RevolutionColorScheme {
  return context === "negotiation" ? NEGOTIATION_COLOR_SCHEME : REVOLUTION_COLOR_SCHEME;
}

/**
 * Build className from color scheme (helper function)
 */
export function buildRevolutionClassName(
  scheme: RevolutionColorScheme,
  variant: "bg" | "border" | "text" | "button" = "bg"
): string {
  switch (variant) {
    case "bg":
      return scheme.bgMedium;
    case "border":
      return scheme.borderMedium;
    case "text":
      return scheme.textLight;
    case "button":
      return `${scheme.buttonBg} ${scheme.buttonHover} ${scheme.buttonText}`;
    default:
      return scheme.bgMedium;
  }
}

/**
 * Notification banner styling
 */
export const notificationStyles = {
  banner: "bg-red-950/30 border border-red-500/40 rounded-lg px-4 py-3",
  bannerText: "text-sm text-red-200 dark:text-red-300",
  bannerIcon: "text-red-500",
} as const;

/**
 * Progress bar styling
 */
export const progressStyles = {
  container: "h-3 w-full rounded-full bg-muted overflow-hidden",
  fillGradient: "h-full bg-gradient-to-r transition-all duration-300",
} as const;
