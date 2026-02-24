/**
 * ============================================================================
 * CURRENCY SYSTEM - SINGLE SOURCE OF TRUTH (Server-Side)
 * ============================================================================
 *
 * This module provides centralized currency management for the entire application.
 * All currency-related information (symbols, names, colors, formats) comes from here.
 *
 * Key Principles:
 * - Zero hardcoding: All currency info comes from database
 * - Centralized: One place for all currency logic
 * - Cached: Performance-optimized with in-memory cache
 * - Type-safe: Full TypeScript support
 * - Consistent: Same formatting everywhere
 *
 * Integration Points:
 * - Database: community_currencies table
 * - Central Bank: Transaction tracking
 * - UI: All currency displays
 * - Market: Product pricing, wages, exchanges
 *
 * NOTE: For client-side components, import from @/lib/currency-display instead
 */

import { createSupabaseServerClient } from "@/lib/supabase-server";

// ============================================================================
// RE-EXPORTS FROM CLIENT-SAFE MODULE
// ============================================================================

export type {
  CommunityCurrency,
  CurrencyDisplayInfo,
  CurrencyFormatOptions,
} from "@/lib/currency-display";

export {
  getCurrencyDisplayInfo,
  getGoldDisplayInfo,
  formatCurrency,
  formatGold,
  formatCommunityCurrency,
  isValidAmount,
} from "@/lib/currency-display";

// ============================================================================
// IMPORTS
// ============================================================================

import type { CommunityCurrency } from "@/lib/currency-display";
import {
  getCurrencyDisplayInfo as getCurrencyDisplayInfoImpl,
  getGoldDisplayInfo as getGoldDisplayInfoImpl,
  formatCurrency as formatCurrencyImpl,
  formatGold as formatGoldImpl,
  formatCommunityCurrency as formatCommunityCurrencyImpl,
  isValidAmount as isValidAmountImpl,
} from "@/lib/currency-display";

// Cache for community currencies (in-memory, server-side)
const currencyCache = new Map<string, CommunityCurrency>();
let lastCacheUpdate = 0;
const CACHE_TTL = 60000; // 1 minute

// ============================================================================
// CORE FUNCTIONS - Database Integration
// ============================================================================

/**
 * Fetch all community currencies from database
 * Used for initial load and cache refresh
 */
export async function getAllCommunityCurrencies(): Promise<CommunityCurrency[]> {
  const supabase = await createSupabaseServerClient();

  const { data, error } = await supabase
    .from("community_currencies")
    .select(`
      *,
      community:communities(name, color)
    `);

  if (error) {
    console.error("Error fetching community currencies:", error);
    return [];
  }

  return (data || []).map((item) => ({
    id: item.id,
    community_id: item.community_id,
    currency_name: item.currency_name,
    currency_symbol: item.currency_symbol,
    exchange_rate_to_gold: item.exchange_rate_to_gold,
    total_supply: item.total_supply,
    created_at: item.created_at,
    updated_at: item.updated_at,
    community_name: Array.isArray(item.community)
      ? item.community[0]?.name
      : item.community?.name,
    community_color: Array.isArray(item.community)
      ? item.community[0]?.color
      : item.community?.color,
  }));
}

/**
 * Get currency by community ID with caching
 */
export async function getCurrencyByCommunityId(
  communityId: string
): Promise<CommunityCurrency | null> {
  // Check cache first
  const now = Date.now();
  if (currencyCache.has(communityId) && now - lastCacheUpdate < CACHE_TTL) {
    return currencyCache.get(communityId) || null;
  }

  // Refresh cache if expired
  if (now - lastCacheUpdate >= CACHE_TTL) {
    await refreshCurrencyCache();
  }

  return currencyCache.get(communityId) || null;
}

/**
 * Get currency by currency ID with caching
 */
export async function getCurrencyById(
  currencyId: string
): Promise<CommunityCurrency | null> {
  const now = Date.now();

  // Refresh cache if expired
  if (now - lastCacheUpdate >= CACHE_TTL) {
    await refreshCurrencyCache();
  }

  // Search cache by currency ID
  for (const currency of currencyCache.values()) {
    if (currency.id === currencyId) {
      return currency;
    }
  }

  return null;
}

/**
 * Refresh the in-memory currency cache
 */
async function refreshCurrencyCache(): Promise<void> {
  const currencies = await getAllCommunityCurrencies();

  currencyCache.clear();
  currencies.forEach((currency) => {
    currencyCache.set(currency.community_id, currency);
  });

  lastCacheUpdate = Date.now();
}

// ============================================================================
// SERVER-SIDE DISPLAY FUNCTIONS (with caching)
// ============================================================================

/**
 * Get display info by community ID (async, with caching)
 */
export async function getCurrencyDisplayInfoByCommunityId(
  communityId: string
): Promise<import("@/lib/currency-display").CurrencyDisplayInfo> {
  const currency = await getCurrencyByCommunityId(communityId);
  const { getCurrencyDisplayInfo } = await import("@/lib/currency-display");
  return getCurrencyDisplayInfo(currency);
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Get currency symbol for a community
 * Convenience function for quick access
 */
export async function getCurrencySymbol(communityId: string): Promise<string> {
  const displayInfo = await getCurrencyDisplayInfoByCommunityId(communityId);
  return displayInfo.symbol;
}

/**
 * Get currency name for a community
 * Convenience function for quick access
 */
export async function getCurrencyName(communityId: string): Promise<string> {
  const displayInfo = await getCurrencyDisplayInfoByCommunityId(communityId);
  return displayInfo.fullName;
}

/**
 * Get currency color for a community
 * Useful for themed UI elements
 */
export async function getCurrencyColor(communityId: string): Promise<string> {
  const displayInfo = await getCurrencyDisplayInfoByCommunityId(communityId);
  return displayInfo.color;
}

// ============================================================================
// EXCHANGE RATE FUNCTIONS
// ============================================================================

/**
 * Convert amount between currencies
 */
export async function convertCurrency(
  amount: number,
  fromCommunityId: string | null,
  toCommunityId: string | null
): Promise<number> {
  // Gold to community
  if (fromCommunityId === null && toCommunityId !== null) {
    const toCurrency = await getCurrencyByCommunityId(toCommunityId);
    if (!toCurrency) return amount;
    return amount * toCurrency.exchange_rate_to_gold;
  }

  // Community to gold
  if (fromCommunityId !== null && toCommunityId === null) {
    const fromCurrency = await getCurrencyByCommunityId(fromCommunityId);
    if (!fromCurrency) return amount;
    return amount / fromCurrency.exchange_rate_to_gold;
  }

  // Community to community
  if (fromCommunityId !== null && toCommunityId !== null) {
    const fromCurrency = await getCurrencyByCommunityId(fromCommunityId);
    const toCurrency = await getCurrencyByCommunityId(toCommunityId);
    if (!fromCurrency || !toCurrency) return amount;

    // Convert to gold first, then to target currency
    const goldAmount = amount / fromCurrency.exchange_rate_to_gold;
    return goldAmount * toCurrency.exchange_rate_to_gold;
  }

  return amount; // Gold to gold
}

// ============================================================================
// CENTRAL BANK INTEGRATION
// ============================================================================

/**
 * Log currency transaction for central bank tracking
 * Integrates with existing currency_transactions table
 */
export interface CurrencyTransactionLog {
  from_user_id?: string | null;
  to_user_id?: string | null;
  currency_type: "gold" | "community";
  community_currency_id?: string | null;
  amount: number;
  transaction_type: string;
  description: string;
  metadata?: Record<string, unknown>;
  scope?: string;
}

export async function logCurrencyTransaction(
  log: CurrencyTransactionLog
): Promise<void> {
  const supabase = await createSupabaseServerClient();

  const { error } = await supabase
    .from("currency_transactions")
    .insert({
      from_user_id: log.from_user_id,
      to_user_id: log.to_user_id,
      currency_type: log.currency_type,
      community_currency_id: log.community_currency_id,
      amount: log.amount,
      transaction_type: log.transaction_type,
      description: log.description,
      metadata: log.metadata || {},
      scope: log.scope || "personal",
    });

  if (error) {
    console.error("Error logging currency transaction:", error);
  }
}

// ============================================================================
// VALIDATION FUNCTIONS (Server-Side)
// ============================================================================

/**
 * Validate if community has a currency configured
 */
export async function hasCurrency(communityId: string): Promise<boolean> {
  const currency = await getCurrencyByCommunityId(communityId);
  return currency !== null;
}

// ============================================================================
// EXPORTS
// ============================================================================

export const CurrencySystem = {
  // Database
  getAllCommunityCurrencies,
  getCurrencyByCommunityId,
  getCurrencyById,

  // Display
  getCurrencyDisplayInfo: getCurrencyDisplayInfoImpl,
  getGoldDisplayInfo: getGoldDisplayInfoImpl,
  getCurrencyDisplayInfoByCommunityId,

  // Formatting
  formatCurrency: formatCurrencyImpl,
  formatGold: formatGoldImpl,
  formatCommunityCurrency: formatCommunityCurrencyImpl,

  // Helpers
  getCurrencySymbol,
  getCurrencyName,
  getCurrencyColor,

  // Exchange
  convertCurrency,

  // Central Bank
  logCurrencyTransaction,

  // Validation
  isValidAmount: isValidAmountImpl,
  hasCurrency,
} as const;
