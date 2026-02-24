/**
 * Battle Mechanics Theme Configuration
 * Theme-aware colors and styles for battle readiness indicators
 * Uses CSS variables from the theme system for consistency across light/dark modes
 */

export const battleMechanicsTheme = {
  // Rage indicator colors (accumulates from defeats - critical hit chance)
  rage: {
    low: '#f59e0b', // Amber for low rage (warning color)
    high: '#ef4444', // Red for high rage (destructive color)
    background: 'hsl(var(--card))',
    border: 'hsl(var(--border) / 0.6)',
  },

  // Exhaustion indicator colors (recovery from conquests - energy regen penalty)
  exhaustion: {
    low: '#ef4444', // Red for low recovery (exhausted)
    high: '#22c55e', // Green for high recovery (rested - success color)
    background: 'hsl(var(--card))',
    border: 'hsl(var(--border) / 0.6)',
  },

  // Disarray indicator colors (recovery from defeat - energy cost penalty)
  disarray: {
    low: '#ef4444', // Red for low recovery (disarrayed)
    high: '#22c55e', // Green for high recovery (recovered)
    background: 'hsl(var(--card))',
    border: 'hsl(var(--border) / 0.6)',
  },

  // Common UI elements
  ui: {
    infoButton: {
      background: 'hsl(var(--background))',
      border: 'hsl(var(--border))',
      text: 'hsl(var(--muted-foreground))',
      hoverBackground: 'hsl(var(--muted))',
      hoverBorder: 'hsl(var(--foreground) / 0.2)',
    },
    percentageText: {
      color: 'hsl(var(--foreground))',
      shadow: 'drop-shadow(0 2px 4px hsl(var(--background) / 0.8))',
    },
    label: {
      primary: 'hsl(var(--foreground))',
      secondary: 'hsl(var(--foreground) / 0.9)',
      muted: 'hsl(var(--muted-foreground))',
    },
  },

  // Status-based icon colors
  status: {
    critical: 'hsl(var(--destructive))',
    active: 'hsl(var(--warning))',
    recovering: 'hsl(var(--info))',
    ready: 'hsl(var(--success))',
  },
} as const;

/**
 * Tailwind classes for battle mechanics components (theme-aware)
 */
export const battleMechanicsClasses = {
  // Container styles
  card: 'rounded-xl border border-border/60 bg-card',

  // Liquid indicator styles
  liquidBorder: 'border-2 border-border/60',
  liquidShadow: 'shadow-inner',

  // Info button styles
  infoButton: 'w-6 h-6 rounded-full bg-background border border-border shadow-sm flex items-center justify-center hover:bg-muted hover:border-foreground/20 transition-all',
  infoIcon: 'w-3.5 h-3.5 text-muted-foreground',

  // Label styles
  labelPrimary: 'text-xs font-bold uppercase tracking-wider text-foreground',
  labelSecondary: 'text-sm font-semibold text-foreground/90 leading-tight',
  labelMuted: 'text-xs font-medium text-muted-foreground',

  // Timer/clock icon styles
  timerContainer: 'flex items-center justify-center gap-1',
  clockIcon: 'w-3 h-3',
} as const;

/**
 * Get theme-aware colors for a specific indicator type
 */
export function getIndicatorColors(type: 'rage' | 'exhaustion' | 'disarray') {
  return battleMechanicsTheme[type];
}

/**
 * Get status color based on state
 */
export function getStatusColor(status: 'critical' | 'active' | 'recovering' | 'ready'): string {
  return battleMechanicsTheme.status[status];
}

/**
 * Helper to create gradient color for liquid based on percentage
 * Uses CSS color-mix for smooth transitions between low and high states
 */
export function getLiquidGradient(
  lowColor: string,
  highColor: string,
  percentage: number
): string {
  // Clamp percentage
  const p = Math.max(0, Math.min(100, percentage));

  // Use CSS color-mix for smooth gradient transition
  return `color-mix(in srgb, ${highColor} ${p}%, ${lowColor} ${100 - p}%)`;
}
