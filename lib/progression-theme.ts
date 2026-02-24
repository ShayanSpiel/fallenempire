/**
 * Theme-aware colors and styles for progression components
 * Uses CSS variables from the theme system for consistency
 * Light theme: Amber/Orange colors
 * Dark theme: Blue colors (auto-switched via CSS variables)
 */

export const progressionColors = {
  // Primary progression colors (tied to theme - uses CSS variables)
  pathColor: 'var(--primary)',                // Theme primary (amber light, blue dark)
  trailColor: 'var(--primary)',               // Trail uses primary with opacity

  // Gradient colors for progress bars
  gradientStart: 'var(--primary)',            // Primary color
  gradientEnd: 'var(--secondary)',            // Secondary color

  // Shadow colors
  shadowColor: 'var(--primary)',              // For glow effects

  // Text colors
  labelColor: 'var(--muted-foreground)',      // Muted text
  valueColor: 'var(--foreground)',            // Bright foreground
} as const;

/**
 * Tailwind classes for progression components (theme-aware)
 * These use CSS custom properties that automatically switch based on light/dark mode
 */
export const progressionClasses = {
  // Progress bar gradient - light: amber to orange, dark: sky blue
  barGradient: 'dark:bg-gradient-to-r dark:from-sky-500 dark:to-sky-400 light:bg-gradient-to-r light:from-amber-500 light:to-amber-400 bg-gradient-to-r from-[var(--primary)] to-[var(--secondary)]',
  barShadow: 'dark:shadow-lg dark:shadow-sky-500/20 light:shadow-lg light:shadow-amber-500/20 shadow-lg shadow-[var(--primary)]/20',

  // Badge styling
  badgeGradient: 'dark:bg-gradient-to-br dark:from-sky-500 dark:to-sky-600 light:bg-gradient-to-br light:from-amber-500 light:to-amber-600 bg-gradient-to-br from-[var(--primary)] to-[color-mix(in_srgb,var(--primary)_80%,black)]',
  badgeText: 'text-white font-bold',
  badgeBorder: 'border-2 border-background',
  badgeShadow: 'shadow-md',

  // Ring/circle styling
  ringStroke: 'dark:stroke-sky-500 light:stroke-amber-500 [stroke:var(--primary)]',
  ringTrail: 'dark:stroke-sky-500/20 light:stroke-amber-500/20 [stroke:color-mix(in_srgb,var(--primary)_20%,transparent)]',

  // Level badge in nav
  navBadge:
    'text-[18px] font-semibold leading-tight text-white pointer-events-none',
  navBadgeBackground:
    'block rounded-full bg-black/40',
} as const;

/**
 * Build styles object for react-circular-progressbar component
 * Returns theme-aware colors that will adapt to light/dark mode
 */
export function buildProgressbarStyles() {
  return {
    pathColor: 'var(--primary)',
    trailColor: 'color-mix(in srgb, var(--primary) 30%, transparent)',
    strokeLinecap: 'round' as const,
  };
}

/**
 * Get level badge sizing configuration
 */
export const levelBadgeSizes = {
  sm: { size: 16, fontSize: '9px' },
  md: { size: 20, fontSize: '10px' },
  lg: { size: 28, fontSize: '12px' },
} as const;

/**
 * Morale emoji sizing configuration
 */
export const moralEmojiBadgeSizes = {
  sm: { fontSize: '12px' },
  md: { fontSize: '16px' },
  lg: { fontSize: '24px' },
} as const;

/**
 * CSS variable names for theme colors
 */
export const themeVars = {
  primary: 'var(--primary)',
  secondary: 'var(--secondary)',
  muted: 'var(--muted)',
  mutedForeground: 'var(--muted-foreground)',
  foreground: 'var(--foreground)',
  background: 'var(--background)',
  border: 'var(--border)',
} as const;
