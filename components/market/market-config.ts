/**
 * Market Component Configuration
 * Single source of truth for market-related constants, styling, and configuration
 */

// ============================================================================
// TAB STYLING
// ============================================================================

export const MARKET_TAB_CONFIG = {
  list: {
    className: "w-full flex gap-2 flex-wrap",
  },
  trigger: {
    className: "",
    size: "lg" as const,
  },
} as const;

// ============================================================================
// TABLE STYLING
// ============================================================================

export const MARKET_TABLE_CONFIG = {
  container: "border border-border/60 rounded-xl overflow-hidden",
  headerRow: "bg-muted/50",
  headerCell: "text-xs font-semibold text-muted-foreground uppercase tracking-wider",
  bodyRow: "hover:bg-muted/30 transition-colors",
  divider: "divide-y divide-border/60",
} as const;

// ============================================================================
// FILTER STYLING
// ============================================================================

export const MARKET_FILTER_CONFIG = {
  container: "space-y-4",
  label: "text-xs font-semibold text-muted-foreground uppercase tracking-wider",
  buttonGroup: "flex flex-wrap gap-2",
} as const;

// ============================================================================
// SKELETON CONFIGURATION
// ============================================================================

export const SKELETON_CONFIG = {
  table: {
    defaultRows: 5,
    columns: 7,
  },
  filters: {
    chipCount: 6,
    starCount: 5,
  },
} as const;

// ============================================================================
// PRODUCT TABLE COLUMNS
// ============================================================================

export const PRODUCT_TABLE_COLUMNS = {
  item: { width: "20%", align: "center" as const },
  seller: { width: "12%", align: "center" as const },
  quality: { width: "11%", align: "center" as const },
  supply: { width: "9%", align: "center" as const },
  price: { width: "13%", align: "center" as const },
  location: { width: "12%", align: "center" as const },
  action: { width: "23%", align: "center" as const },
} as const;

// ============================================================================
// JOB TABLE COLUMNS
// ============================================================================

export const JOB_TABLE_COLUMNS = {
  company: { align: "center" as const },
  position: { align: "center" as const },
  owner: { align: "center" as const },
  wage: { align: "center" as const },
  location: { align: "center" as const },
  openings: { align: "center" as const },
  action: { align: "center" as const },
} as const;

// ============================================================================
// RESOURCE TYPES
// ============================================================================

export const MARKET_RESOURCE_TYPES = [
  "grain",
  "iron",
  "oil",
  "food",
  "weapon",
  "ticket",
] as const;

// ============================================================================
// QUALITY LEVELS
// ============================================================================

export const QUALITY_LEVELS = [1, 2, 3, 4, 5] as const;

// ============================================================================
// P2P EXCHANGE CONFIGURATION
// ============================================================================

export const EXCHANGE_CONFIG = {
  container: {
    height: "h-[600px]",
    grid: "grid gap-6 lg:grid-cols-[1fr_400px]",
  },
  card: {
    className: "flex flex-col",
  },
  header: {
    className: "border-b border-border/60 bg-card px-4 py-2.5 shrink-0",
    title: "text-sm font-semibold text-foreground",
    subtitle: "text-xs text-muted-foreground",
    iconSize: "h-3 w-3",
    locationContainer: "flex items-center gap-2 flex-wrap",
    locationText: "flex items-center gap-1",
    travelLink: "flex items-center gap-1 text-amber-600 dark:text-blue-400 hover:text-amber-700 dark:hover:text-blue-300 transition-colors font-medium",
    warningBanner: "p-2 rounded-md bg-warning/10 border border-warning/20 space-y-1",
  },
  offers: {
    maxLevels: 20,
    maxAvatarsInGroup: 3,
    avatarSize: "h-8 w-8",
    avatarSpacing: "-space-x-3",
    divider: "divide-y divide-border/60",
  },
  offerLevel: {
    button: "w-full px-4 py-3 text-left transition-all flex items-center gap-4",
    selectedBg: "bg-primary/10 border-l-2 border-primary",
    hoverBg: "hover:bg-muted/30",
    expandedBg: "bg-muted/10",
  },
  expandedOrder: {
    button: "w-full px-4 pl-8 py-2 text-left transition-all flex items-center gap-3",
    selectedBg: "bg-primary/20",
    hoverBg: "hover:bg-muted/40",
    avatarSize: "h-6 w-6",
    maxHeight: "max-h-[300px]",
  },
  input: {
    className: "pr-20",
    iconContainer: "absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-1",
  },
  skeleton: {
    offerRows: 5,
    height: "h-16",
  },
  location: {
    inLocation: "text-emerald-600 dark:text-emerald-400",
    needsTravel: "text-amber-600 dark:text-amber-400",
  },
} as const;

// ============================================================================
// DEFAULTS
// ============================================================================

export const MARKET_DEFAULTS = {
  listingsLimit: 50,
  listingsOffset: 0,
  maxCommunityFilters: 2,
  purchaseQuantity: 1,
} as const;
