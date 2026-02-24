// Economy Module Configuration
// Zero-hardcoding approach: All game constants defined here

export const ECONOMY_CONFIG = {
  // ============================================================================
  // RESOURCE SETTINGS
  // ============================================================================
  resources: {
    categories: {
      raw_material: {
        label: "Raw Materials",
        description: "Base resources harvested from hexes",
      },
      product: {
        label: "Products",
        description: "Crafted items made from raw materials",
      },
    },
  },

  // Quality tiers
  qualities: {
    levels: 5, // Q1-Q5
    starColor: "#FFD700", // Gold color for stars
    emptyStarColor: "#6B7280", // Gray color for empty stars
  },

  // ============================================================================
  // CURRENCY SETTINGS
  // ============================================================================
  currency: {
    // Starting gold for new users
    startingGold: 100,

    // Default exchange rate for new community currencies
    defaultExchangeRate: 1.0,

    // Minimum transaction amounts
    minTransferAmount: 0.01,
    minExchangeAmount: 0.01,

    // Transaction fees (future use)
    transferFeePercentage: 0, // 0% fee for now
    exchangeFeePercentage: 0, // 0% fee for now
  },

  // ============================================================================
  // DISPLAY SETTINGS
  // ============================================================================
  display: {
    // Currency symbol for universal gold
    goldSymbol: "", // Use SVG icon component instead
    goldName: "Gold Coins",

    // Decimal places to show
    decimalPlaces: 2,

    // Color coding for currency displays
    goldColor: "#FFD700", // Gold color
    communityColorDefault: "#3B82F6", // Blue for community currencies
  },

  // ============================================================================
  // EXCHANGE MARKET SETTINGS
  // ============================================================================
  exchangeMarket: {
    // Order limits
    minOrderGold: 1,
    minOrderCurrency: 100,
    orderExpiryDays: 30,

    // Precision
    ratePrecision: 2,
    quantityPrecision: 2,

    // UI Settings
    chartCollapsedHeight: 60, // px
    chartExpandedHeight: 300, // px
    pollInterval: 15000, // 15 seconds

    // Chart periods
    periods: [
      { value: "24h", label: "24 Hours", hours: 24 },
      { value: "7d", label: "7 Days", days: 7 },
      { value: "30d", label: "30 Days", days: 30 },
    ] as const,
  },

  // ============================================================================
  // LIMITS & RESTRICTIONS
  // ============================================================================
  limits: {
    // Max amount that can be transferred at once (anti-exploit)
    maxTransferAmount: 1_000_000,

    // Max amount that can be exchanged at once
    maxExchangeAmount: 100_000,

    // Transaction history pagination
    defaultHistoryLimit: 50,
    maxHistoryLimit: 200,
  },

  // ============================================================================
  // REWARDS & INCOME SOURCES (Future features will use these)
  // ============================================================================
  rewards: {
    // Daily work rewards (will be used in Feature 5)
    dailyWorkBaseGold: 10,

    // Trading rewards
    successfulTradeGold: 1,

    // Battle rewards (integration with existing battle system)
    battleVictoryGold: 50,
    battleParticipationGold: 10,

    // Social rewards
    firstPostGold: 5,
    popularPostGold: 10,
  },

  // ============================================================================
  // HELPER FUNCTIONS
  // ============================================================================
} as const;

/**
 * Format gold amount for display
 * NOTE: Use GoldCoinIcon component for visual display, this is just the number
 */
export function formatGold(amount: number): string {
  return amount.toFixed(ECONOMY_CONFIG.display.decimalPlaces);
}

/**
 * Format community currency for display
 */
export function formatCommunityCurrency(
  amount: number,
  symbol: string
): string {
  return `${amount.toFixed(ECONOMY_CONFIG.display.decimalPlaces)} ${symbol}`;
}

/**
 * Validate transaction amount
 */
export function isValidTransactionAmount(amount: number): {
  valid: boolean;
  error?: string;
} {
  if (amount <= 0) {
    return { valid: false, error: "Amount must be positive" };
  }

  if (amount < ECONOMY_CONFIG.currency.minTransferAmount) {
    return {
      valid: false,
      error: `Minimum transfer amount is ${ECONOMY_CONFIG.currency.minTransferAmount}`,
    };
  }

  if (amount > ECONOMY_CONFIG.limits.maxTransferAmount) {
    return {
      valid: false,
      error: `Maximum transfer amount is ${ECONOMY_CONFIG.limits.maxTransferAmount}`,
    };
  }

  return { valid: true };
}

/**
 * Calculate exchange amount based on rate
 */
export function calculateExchange(
  amount: number,
  exchangeRate: number,
  fromGold: boolean
): number {
  if (fromGold) {
    // Gold → Community: multiply by rate
    return amount * exchangeRate;
  } else {
    // Community → Gold: divide by rate
    return amount / exchangeRate;
  }
}

/**
 * Format transaction type for display with user-friendly names
 */
export function formatTransactionType(type: string): string {
  const labels: Record<string, string> = {
    // Core transactions
    transfer: "Transfer",
    exchange: "Currency Exchange",
    exchange_order_locked: "Order Created",
    exchange_order_filled: "Order Filled",
    exchange_order_refunded: "Order Cancelled",
    reward: "Reward",
    tax: "Tax Payment",
    purchase: "Market Purchase",
    sale: "Market Sale",

    // Battle system
    battle_cost: "Battle Start",
    battle_reward: "Battle Victory",
    medal_reward: "Medal Earned",

    // Training system
    training_cost: "Training Session",
    training_reward: "Training Reward",

    // Company/Production
    company_creation: "Company Founded",
    production_cost: "Production Cost",
    wage_payment: "Wage Received",

    // Market
    tariff: "Trade Tax",

    // Loans
    loan_disbursement: "Loan Received",
    loan_repayment: "Loan Payment",
    interest_payment: "Interest Paid",
    interest_earned: "Interest Earned",

    // Admin operations
    admin_grant: "Admin Grant",
    admin_deduction: "Admin Deduction",
    admin_burn: "Currency Burn",
  };

  return labels[type] || type.split("_").map(word =>
    word.charAt(0).toUpperCase() + word.slice(1)
  ).join(" ");
}

/**
 * Get icon name for transaction type (lucide-react icon names)
 */
export function getTransactionIcon(type: string): string {
  const icons: Record<string, string> = {
    // Core transactions
    transfer: "ArrowLeftRight",
    exchange: "Repeat",
    exchange_order_locked: "Lock",
    exchange_order_filled: "CheckCircle",
    exchange_order_refunded: "XCircle",
    reward: "Gift",
    tax: "Receipt",
    purchase: "ShoppingCart",
    sale: "Store",

    // Battle system
    battle_cost: "Swords",
    battle_reward: "Trophy",
    medal_reward: "Award",

    // Training
    training_cost: "Dumbbell",
    training_reward: "TrendingUp",

    // Company/Production
    company_creation: "Building",
    production_cost: "Factory",
    wage_payment: "Coins",

    // Market
    tariff: "Percent",

    // Loans
    loan_disbursement: "HandCoins",
    loan_repayment: "HandCoins",
    interest_payment: "TrendingDown",
    interest_earned: "TrendingUp",

    // Admin operations
    admin_grant: "ShieldCheck",
    admin_deduction: "ShieldAlert",
    admin_burn: "Flame",
  };

  return icons[type] || "Circle";
}

/**
 * Get transaction display color
 */
export function getTransactionColor(
  type: "transfer" | "exchange" | "reward" | "tax" | "purchase" | "sale",
  isIncoming: boolean
): string {
  // Rewards are always green
  if (type === "reward") return "text-green-600";

  // Taxes and purchases are always red
  if (type === "tax" || type === "purchase") return "text-red-600";

  // Sales are always green
  if (type === "sale") return "text-green-600";

  // Transfers and exchanges depend on direction
  if (type === "transfer" || type === "exchange") {
    return isIncoming ? "text-green-600" : "text-red-600";
  }

  return "text-gray-600";
}

/**
 * Get category label for display
 */
export function getCategoryLabel(
  category: "raw_material" | "product"
): string {
  return ECONOMY_CONFIG.resources.categories[category]?.label || category;
}

/**
 * Generate quality stars array (for rendering)
 */
export function getQualityStars(qualityLevel: number): {
  filled: number;
  empty: number;
} {
  const maxStars = ECONOMY_CONFIG.qualities.levels;
  return {
    filled: Math.min(qualityLevel, maxStars),
    empty: Math.max(0, maxStars - qualityLevel),
  };
}

// Export type for TypeScript
export type EconomyConfig = typeof ECONOMY_CONFIG;
