/**
 * UNIFIED DESIGN SYSTEM - Single Source of Truth
 *
 * This file defines all design tokens, spacing, typography, and component variants
 * All UI components should use these tokens to ensure consistency across the app
 *
 * Philosophy: Minimalist Power
 * - Clean, information-dense layouts
 * - Subtle visual hierarchy without clutter
 * - Consistent use of whitespace and spacing
 */

/**
 * SPACING SCALE
 * All spacing should use these values for consistency
 */
export const spacing = {
  xs: '0.25rem',    // 4px
  sm: '0.5rem',     // 8px
  md: '1rem',       // 16px
  lg: '1.5rem',     // 24px
  xl: '2rem',       // 32px
  '2xl': '2.5rem',  // 40px
  '3xl': '3rem',    // 48px
} as const;

/**
 * BORDER RADIUS SCALE
 * Consistent rounding across all components - MORE rounded aesthetic
 */
export const radius = {
  none: '0',
  sm: '0.5rem',       // 8px
  md: '0.75rem',      // 12px
  lg: '1rem',         // 16px - default
  xl: '1.25rem',      // 20px
  '2xl': '1.5rem',    // 24px
  '3xl': '2rem',      // 32px
  full: '9999px',
} as const;

/**
 * TYPOGRAPHY SCALE
 * Semantic text sizes with consistent line heights
 */
export const typography = {
  // Display sizes (page titles)
  displayLg: {
    size: 'text-3xl',
    weight: 'font-extrabold',
    lineHeight: 'leading-tight',
  },
  displayMd: {
    size: 'text-2xl',
    weight: 'font-bold',
    lineHeight: 'leading-tight',
  },
  displaySm: {
    size: 'text-xl',
    weight: 'font-bold',
    lineHeight: 'leading-tight',
  },

  // Heading sizes (section headers)
  headingLg: {
    size: 'text-lg',
    weight: 'font-semibold',
    lineHeight: 'leading-snug',
  },
  headingMd: {
    size: 'text-base',
    weight: 'font-semibold',
    lineHeight: 'leading-snug',
  },
  headingSm: {
    size: 'text-sm',
    weight: 'font-semibold',
    lineHeight: 'leading-snug',
  },

  // Body text sizes
  bodyLg: {
    size: 'text-base',
    weight: 'font-normal',
    lineHeight: 'leading-relaxed',
  },
  bodyMd: {
    size: 'text-sm',
    weight: 'font-normal',
    lineHeight: 'leading-relaxed',
  },
  bodySm: {
    size: 'text-xs',
    weight: 'font-normal',
    lineHeight: 'leading-relaxed',
  },

  // Label/meta text
  label: {
    size: 'text-xs',
    weight: 'font-medium',
    lineHeight: 'leading-tight',
  },
  labelMuted: {
    size: 'text-xs',
    weight: 'font-medium',
    color: 'text-muted-foreground',
    lineHeight: 'leading-tight',
  },
  meta: {
    size: 'text-[10px]',
    weight: 'font-medium',
    lineHeight: 'leading-tight',
  },
  metaMuted: {
    size: 'text-[10px]',
    weight: 'font-medium',
    color: 'text-muted-foreground',
    lineHeight: 'leading-tight',
  },
} as const;

/**
 * ELEVATION & SHADOWS
 * Consistent shadow usage for depth
 */
export const shadows = {
  none: 'shadow-none',
  xs: 'shadow-xs',
  sm: 'shadow-sm',
  md: 'shadow-md',
  lg: 'shadow-lg',
} as const;

/**
 * BORDER STYLES
 * Consistent border usage
 */
export const borders = {
  // Width
  hairline: 'border',        // 1px
  thin: 'border-2',          // 2px
  thick: 'border-4',         // 4px

  // Color opacity variants
  default: 'border-border',
  subtle: 'border-border/60',
  muted: 'border-border/40',
  faint: 'border-border/20',
} as const;

/**
 * COMPONENT SPACING PATTERNS
 * Standard padding/margin combinations
 */
export const componentSpacing = {
  // Container padding
  containerPadding: {
    xs: 'px-3 py-2',
    sm: 'px-4 py-3',
    md: 'px-6 py-4',
    lg: 'px-8 py-6',
  },

  // Gap patterns
  gap: {
    xs: 'gap-1',
    sm: 'gap-2',
    md: 'gap-3',
    lg: 'gap-4',
    xl: 'gap-6',
  },

  // Stack gaps (vertical spacing)
  stack: {
    xs: 'gap-1',
    sm: 'gap-2',
    md: 'gap-3',
    lg: 'gap-4',
    xl: 'gap-6',
  },
} as const;

/**
 * MINIMALIST COMPONENT TOKENS
 * These enforce the "minimalist power" philosophy
 */
export const minimalist = {
  // Tag/Badge styling (no borders, subtle background)
  tag: {
    base: 'inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium uppercase tracking-wide',
    background: 'bg-muted',
    text: 'text-muted-foreground',
  },

  // Minimal progress bar
  progressBar: {
    base: 'h-2 w-full rounded-full bg-muted overflow-hidden',
    fill: 'h-full rounded-full transition-all duration-300',
  },

  // Subtle card/container
  card: {
    base: 'bg-card border border-border/40 rounded-lg p-4',
    compact: 'bg-card border border-border/40 rounded-md p-3',
  },

  // Minimal divider
  divider: 'h-px bg-border/40 my-2',

  // Subtle input
  input: {
    base: 'h-10 px-3 py-2 rounded-lg border border-border/60 bg-card/50 text-sm',
    focus: 'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/70',
  },
} as const;

/**
 * COLOR SEMANTIC TOKENS
 * Purpose-based color usage
 */
export const semanticColors = {
  // Text hierarchy
  text: {
    primary: 'text-foreground',
    secondary: 'text-muted-foreground',
    tertiary: 'text-muted-foreground/70',
    inverted: 'text-card',
  },

  // Background hierarchy
  background: {
    primary: 'bg-background',
    secondary: 'bg-muted',
    tertiary: 'bg-muted/50',
    surface: 'bg-card',
  },

  // Interactive states
  interactive: {
    default: 'bg-primary text-primary-foreground hover:bg-primary/90',
    secondary: 'bg-secondary text-secondary-foreground hover:bg-secondary/80',
    accent: 'bg-accent text-accent-foreground hover:bg-accent/90',
    ghost: 'hover:bg-accent/10 hover:text-accent-foreground',
    destructive: 'bg-destructive text-destructive-foreground hover:bg-destructive/90',
  },

  // Status colors
  status: {
    success: 'bg-success text-success-foreground',
    info: 'bg-info text-info-foreground',
    warning: 'bg-warning text-warning-foreground',
    error: 'bg-destructive text-destructive-foreground',
  },
} as const;

/**
 * LAYOUT GRID & SIZING
 */
export const layout = {
  // Standard sizes for common components
  sizes: {
    // Avatar sizes
    avatar: {
      xs: 'size-6',
      sm: 'size-8',
      md: 'size-10',
      lg: 'size-12',
      xl: 'size-16',
    },

    // Icon sizes
    icon: {
      xs: 'size-3',
      sm: 'size-4',
      md: 'size-5',
      lg: 'size-6',
      xl: 'size-8',
    },

    // Button heights
    button: {
      sm: 'h-8',
      md: 'h-9',
      lg: 'h-10',
    },

    // Input heights
    input: {
      sm: 'h-8',
      md: 'h-9',
      lg: 'h-10',
    },
  },

  // Container max-widths
  container: {
    xs: 'max-w-xs',
    sm: 'max-w-sm',
    md: 'max-w-md',
    lg: 'max-w-lg',
    xl: 'max-w-xl',
    '2xl': 'max-w-2xl',
    '3xl': 'max-w-3xl',
    '4xl': 'max-w-4xl',
    full: 'max-w-full',
  },
} as const;

/**
 * TRANSITION SPEEDS
 * Consistent animation timing
 */
export const transitions = {
  fast: 'transition-all duration-150',
  normal: 'transition-all duration-300',
  slow: 'transition-all duration-500',
} as const;

/**
 * BUTTON STYLE PRESETS
 * Reusable button combinations
 */
export const buttonStyles = {
  // Primary action
  primary: {
    base: 'inline-flex items-center justify-center gap-2 font-medium rounded-md whitespace-nowrap',
    variant: 'bg-primary text-primary-foreground hover:bg-primary/90',
    size: 'h-9 px-4',
    focus: 'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50',
  },

  // Secondary action
  secondary: {
    base: 'inline-flex items-center justify-center gap-2 font-medium rounded-md whitespace-nowrap',
    variant: 'bg-secondary text-secondary-foreground hover:bg-secondary/80',
    size: 'h-9 px-4',
    focus: 'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50',
  },

  // Outline/Ghost
  outline: {
    base: 'inline-flex items-center justify-center gap-2 font-medium rounded-md whitespace-nowrap',
    variant: 'border border-border bg-background hover:bg-accent/10',
    size: 'h-9 px-4',
    focus: 'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50',
  },

  // Ghost (minimal)
  ghost: {
    base: 'inline-flex items-center justify-center gap-2 font-medium rounded-md whitespace-nowrap',
    variant: 'hover:bg-accent/10 hover:text-accent-foreground',
    size: 'h-9 px-4',
    focus: 'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50',
  },

  // Destructive
  destructive: {
    base: 'inline-flex items-center justify-center gap-2 font-medium rounded-md whitespace-nowrap',
    variant: 'bg-destructive text-destructive-foreground hover:bg-destructive/90',
    size: 'h-9 px-4',
    focus: 'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50',
  },

  // Icon button
  icon: {
    base: 'inline-flex items-center justify-center rounded-md',
    variant: 'hover:bg-accent/10',
    size: 'size-9',
    focus: 'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50',
  },
} as const;

/**
 * CARD STYLE PRESETS
 */
export const cardStyles = {
  // Standard card
  default: {
    base: 'rounded-lg border bg-card text-card-foreground p-6 gap-6 flex flex-col',
    border: 'border-border/40',
    shadow: 'shadow-sm',
  },

  // Compact card
  compact: {
    base: 'rounded-md border bg-card text-card-foreground p-4 gap-3 flex flex-col',
    border: 'border-border/40',
    shadow: 'shadow-none',
  },

  // Subtle card (minimalist)
  subtle: {
    base: 'rounded-md bg-muted/30 text-foreground p-4 gap-3 flex flex-col',
    border: 'border-none',
    shadow: 'shadow-none',
  },

  // Elevated card
  elevated: {
    base: 'rounded-lg border bg-card text-card-foreground p-6 gap-6 flex flex-col',
    border: 'border-border',
    shadow: 'shadow-md',
  },
} as const;

/**
 * BADGE/TAG STYLE PRESETS
 */
export const badgeStyles = {
  // Default muted badge
  default: {
    base: 'inline-flex items-center gap-1 px-2 py-1 rounded text-xs font-medium uppercase tracking-wide',
    colors: 'bg-muted text-muted-foreground',
  },

  // Minimal tag (no visible border)
  minimal: {
    base: 'inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium uppercase tracking-wide',
    colors: 'bg-muted text-muted-foreground',
  },

  // Accent badge
  accent: {
    base: 'inline-flex items-center gap-1 px-2 py-1 rounded text-xs font-medium uppercase tracking-wide',
    colors: 'bg-accent text-accent-foreground',
  },

  // Status badges
  success: {
    base: 'inline-flex items-center gap-1 px-2 py-1 rounded text-xs font-medium uppercase tracking-wide',
    colors: 'bg-success/20 text-success',
  },
  warning: {
    base: 'inline-flex items-center gap-1 px-2 py-1 rounded text-xs font-medium uppercase tracking-wide',
    colors: 'bg-warning/20 text-warning',
  },
  error: {
    base: 'inline-flex items-center gap-1 px-2 py-1 rounded text-xs font-medium uppercase tracking-wide',
    colors: 'bg-destructive/20 text-destructive',
  },
} as const;

/**
 * LEADERBOARD STYLE PRESETS
 */
export const leaderboardStyles = {
  header: {
    iconBadge: 'p-3 bg-gradient-to-br from-amber-400 to-orange-500 rounded-lg',
  },
  tabs: {
    base: 'gap-2 font-semibold',
    active: {
      rank: 'bg-gradient-to-r from-amber-500 to-orange-500 border-0 text-white',
      level: 'bg-gradient-to-r from-blue-500 to-cyan-500 border-0 text-white',
      mental: 'bg-gradient-to-r from-emerald-500 to-teal-500 border-0 text-white',
      community: 'bg-gradient-to-r from-green-600 to-emerald-600 border-0 text-white',
    },
  },
  card: {
    hover: 'hover:border-amber-500/50 hover:bg-muted/50',
    rankValue: 'text-amber-400',
    levelValue: 'text-blue-400',
    mentalValue: 'text-emerald-500',
  },
  communityCard: {
    hover: 'hover:border-emerald-500/50 hover:bg-muted/50',
    moraleValue: 'text-emerald-500',
  },
} as const;

/**
 * FORM CONTROL PRESETS
 */
export const formStyles = {
  // Standard input
  input: {
    base: 'flex h-9 w-full rounded-lg border border-border/60 bg-card/50 px-3 py-2 text-sm',
    focus: 'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/70',
    placeholder: 'placeholder:text-muted-foreground',
  },

  // Compact input
  inputCompact: {
    base: 'flex h-8 w-full rounded-md border border-border/60 bg-card/50 px-2.5 py-1.5 text-xs',
    focus: 'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/70',
    placeholder: 'placeholder:text-muted-foreground',
  },

  // Large input
  inputLarge: {
    base: 'flex h-10 w-full rounded-lg border border-border/60 bg-card/50 px-4 py-3 text-base',
    focus: 'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/70',
    placeholder: 'placeholder:text-muted-foreground',
  },

  // Label
  label: {
    base: 'text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70',
  },

  // Helper text
  helper: {
    base: 'text-xs text-muted-foreground mt-1',
  },

  // Error text
  error: {
    base: 'text-xs text-destructive mt-1',
  },
} as const;

/**
 * LAYOUT PATTERNS
 * Common layout combinations
 */
export const layoutPatterns = {
  // Flex patterns
  flexCenter: 'flex items-center justify-center',
  flexBetween: 'flex items-center justify-between',
  flexStart: 'flex items-start justify-start',
  flexCol: 'flex flex-col',
  flexColCenter: 'flex flex-col items-center justify-center',

  // Grid patterns
  gridCols2: 'grid grid-cols-2 gap-4',
  gridCols3: 'grid grid-cols-3 gap-4',
  gridCols4: 'grid grid-cols-4 gap-4',

  // Responsive patterns
  responsiveCols: 'grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4',
} as const;

/**
 * NOTIFICATION STYLE PRESETS
 * Notification-specific component styles
 */
export const notificationStyles = {
  // Notification item styling
  item: {
    base: 'flex flex-col gap-0 border-b border-dashed border-border/40 transition-all',
    unread: {
      base: 'border-l-2 border-l-accent bg-accent/5',
      background: 'color-mix(in srgb, var(--accent) 5%, transparent)',
    },
    read: {
      base: 'border-l-2 border-l-transparent hover:bg-secondary',
      background: 'transparent',
    },
  },

  // Badge styling for notification types
  badge: {
    default: 'bg-muted text-muted-foreground text-xs',
    accent: 'bg-accent/20 text-accent text-xs',
    success: 'bg-success/20 text-success text-xs',
    warning: 'bg-warning/20 text-warning text-xs',
    destructive: 'bg-destructive/20 text-destructive text-xs',
  },

  // Notification container
  container: {
    dropdown: 'w-[420px] max-h-[500px] p-0',
    page: 'w-full space-y-4',
  },

  // Icon styling for notification types
  icon: {
    default: 'opacity-70',
    message: 'text-blue-500',
    governance: 'text-amber-500',
    social: 'text-green-500',
    announcement: 'text-purple-500',
    warning: 'text-red-500',
  },

  // Actions styling
  actions: {
    base: 'flex gap-2 px-3 pb-2 border-t border-dashed',
    inline: 'opacity-0 group-hover:opacity-100 transition-opacity',
    compact: 'flex gap-1',
  },

  // Empty state
  emptyState: {
    container: 'flex flex-col items-center justify-center py-12 px-4',
    icon: 'opacity-30 mb-3',
    title: 'text-sm font-medium mb-1',
    description: 'text-xs text-muted-foreground text-center max-w-xs',
  },

  // Tab content
  tabContent: {
    base: 'max-h-[500px] overflow-y-auto',
  },

  // Group label (date header)
  groupLabel: {
    base: 'sticky top-0 bg-background/80 backdrop-blur-sm z-10 px-4 py-2 border-b',
    text: 'text-xs font-medium text-muted-foreground uppercase tracking-wide',
  },

  // Unread indicator dot
  unreadDot: {
    base: 'flex-shrink-0 w-2 h-2 rounded-full',
    color: 'var(--accent)',
  },

  // Timestamp styling
  timestamp: {
    base: 'text-xs text-muted-foreground opacity-70',
  },

  // Notification header (dropdown)
  header: {
    base: 'p-3 border-b flex items-center justify-between',
    title: 'text-xs font-semibold text-muted-foreground uppercase',
  },

  // Notification footer
  footer: {
    base: 'border-t p-3 flex items-center justify-between',
  },

  // Inline actions for social
  socialActions: {
    base: 'flex gap-2 py-2 px-3 bg-muted/30 rounded-sm',
    button: 'text-xs font-medium px-2 py-1 hover:bg-background transition-colors',
  },
} as const;

/**
 * UTILITY FUNCTION: Combine design tokens
 */
export function buildClassName(...classes: (string | undefined | null)[]): string {
  return classes.filter(Boolean).join(' ');
}
