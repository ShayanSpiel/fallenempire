/**
 * ============================================================================
 * CURRENCY DISPLAY - CLIENT-SAFE UTILITIES
 * ============================================================================
 *
 * Pure functions for displaying currency information on the client side.
 * No server dependencies - safe to import in "use client" components.
 */

// ============================================================================
// TYPES
// ============================================================================

export interface CommunityCurrency {
  id: string;
  community_id: string;
  currency_name: string;
  currency_symbol: string;
  exchange_rate_to_gold: number;
  total_supply: number;
  created_at: string;
  updated_at: string;

  // Extended with community info
  community_name?: string;
  community_color?: string | null;
}

export interface CurrencyDisplayInfo {
  symbol: string;
  name: string;
  color: string;
  shortName: string; // e.g., "TEC" or "Gold"
  fullName: string; // e.g., "TestCommunity Coin" or "Universal Gold"
}

export interface CurrencyFormatOptions {
  decimals?: number;
  showSymbol?: boolean;
  showFullName?: boolean;
  compact?: boolean;
}

// ============================================================================
// CONSTANTS
// ============================================================================

const GOLD_CURRENCY: CurrencyDisplayInfo = {
  symbol: "G",
  name: "Gold",
  color: "#FFD700", // Gold color
  shortName: "Gold",
  fullName: "Universal Gold Currency",
};

const DEFAULT_COMMUNITY_CURRENCY: CurrencyDisplayInfo = {
  symbol: "CC",
  name: "Community Coin",
  color: "#3B82F6", // Blue
  shortName: "CC",
  fullName: "Community Currency",
};

// ============================================================================
// DISPLAY FUNCTIONS
// ============================================================================

/**
 * Get display information for a community currency
 * This is the SINGLE SOURCE OF TRUTH for how currency should be displayed
 */
export function getCurrencyDisplayInfo(
  currency: CommunityCurrency | null
): CurrencyDisplayInfo {
  if (!currency) {
    return DEFAULT_COMMUNITY_CURRENCY;
  }

  return {
    symbol: currency.currency_symbol,
    name: currency.currency_name,
    color: currency.community_color || DEFAULT_COMMUNITY_CURRENCY.color,
    shortName: currency.currency_symbol,
    fullName: currency.currency_name,
  };
}

/**
 * Get display information for gold currency
 */
export function getGoldDisplayInfo(): CurrencyDisplayInfo {
  return GOLD_CURRENCY;
}

// ============================================================================
// FORMATTING FUNCTIONS
// ============================================================================

/**
 * Format currency amount with symbol
 * This ensures ALL currency displays look the same
 */
export function formatCurrency(
  amount: number,
  displayInfo: CurrencyDisplayInfo,
  options: CurrencyFormatOptions = {}
): string {
  const {
    decimals = 2,
    showSymbol = true,
    showFullName = false,
    compact = false,
  } = options;

  const formattedAmount = compact
    ? formatCompactNumber(amount)
    : amount.toFixed(decimals);

  if (showFullName) {
    return `${formattedAmount} ${displayInfo.fullName}`;
  }

  if (showSymbol) {
    return `${formattedAmount} ${displayInfo.symbol}`;
  }

  return formattedAmount;
}

/**
 * Format gold amount
 */
export function formatGold(
  amount: number,
  options: CurrencyFormatOptions = {}
): string {
  return formatCurrency(amount, GOLD_CURRENCY, options);
}

/**
 * Format community currency amount
 */
export function formatCommunityCurrency(
  amount: number,
  currency: CommunityCurrency | null,
  options: CurrencyFormatOptions = {}
): string {
  const displayInfo = getCurrencyDisplayInfo(currency);
  return formatCurrency(amount, displayInfo, options);
}

/**
 * Format compact number (e.g., 1000 -> 1K, 1000000 -> 1M)
 */
function formatCompactNumber(num: number): string {
  if (num < 1000) return num.toFixed(2);
  if (num < 1000000) return (num / 1000).toFixed(1) + "K";
  if (num < 1000000000) return (num / 1000000).toFixed(1) + "M";
  return (num / 1000000000).toFixed(1) + "B";
}

// ============================================================================
// VALIDATION FUNCTIONS
// ============================================================================

/**
 * Validate currency amount
 */
export function isValidAmount(amount: number): boolean {
  return amount > 0 && Number.isFinite(amount);
}
