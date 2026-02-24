"use server";

import { createSupabaseServerClient } from "@/lib/supabase-server";
import { revalidatePath } from "next/cache";
import type {
  TransferGoldResult,
  TransferCommunityCoinResult,
  ExchangeCurrencyResult,
  AddGoldResult,
  DeductGoldResult,
  WalletDisplay,
  CurrencyTransaction,
  InventoryByCategory,
  InventoryItem,
} from "@/lib/types/economy";

// ============================================================================
// HELPER: Get public user ID from auth user
// ============================================================================
async function getPublicUserId(supabase: any): Promise<string | null> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: profile } = await supabase
    .from("users")
    .select("id")
    .eq("auth_id", user.id)
    .single();

  return profile?.id || null;
}

// ============================================================================
// WALLET QUERIES
// ============================================================================

/**
 * Get user's complete wallet information (gold + all community currencies)
 */
export async function getUserWallet(
  userId?: string
): Promise<WalletDisplay | null> {
  const supabase = await createSupabaseServerClient();

  // Get current user's public ID if not specified
  let targetUserId: string | null = userId || null;
  if (!targetUserId) {
    targetUserId = await getPublicUserId(supabase);
    if (!targetUserId) return null;
  }

  // Get all wallets for user (using PUBLIC user ID)
  const { data: wallets, error } = await supabase
    .from("user_wallets")
    .select(
      `
      *,
      community_currency:community_currencies(
        *,
        communities:community_id(color)
      )
    `
    )
    .eq("user_id", targetUserId);

  if (error || !wallets) {
    console.error("Error fetching wallets:", error);
    return null;
  }

  // Separate gold and community wallets
  const goldWallet = wallets.find((w) => w.currency_type === "gold");
  const communityWallets = wallets.filter(
    (w) => w.currency_type === "community"
  );

  return {
    goldCoins: goldWallet?.gold_coins || 0,
    communityWallets: communityWallets.map((w) => {
      const community = Array.isArray(w.community_currency?.communities)
        ? w.community_currency?.communities[0]
        : w.community_currency?.communities;

      return {
        currencyId: w.community_currency_id!,
        currencyName: w.community_currency?.currency_name || "Unknown",
        currencySymbol: w.community_currency?.currency_symbol || "?",
        amount: w.community_coins,
        exchangeRate: w.community_currency?.exchange_rate_to_gold || 1,
        communityColor: community?.color || null,
      };
    }),
  };
}

/**
 * Get user's gold balance
 */
export async function getGoldBalance(): Promise<number> {
  const supabase = await createSupabaseServerClient();

  const userId = await getPublicUserId(supabase);
  if (!userId) return 0;

  const { data: wallet } = await supabase
    .from("user_wallets")
    .select("gold_coins")
    .eq("user_id", userId)
    .eq("currency_type", "gold")
    .single();

  return wallet?.gold_coins || 0;
}

/**
 * Get user's transaction history
 */
export async function getTransactionHistory(
  limit: number = 50
): Promise<CurrencyTransaction[]> {
  const supabase = await createSupabaseServerClient();

  const userId = await getPublicUserId(supabase);
  if (!userId) return [];

  const { data: transactions, error } = await supabase
    .from("currency_transactions")
    .select(
      `
      *,
      from_user:users!currency_transactions_from_user_id_fkey(id, username),
      to_user:users!currency_transactions_to_user_id_fkey(id, username),
      community_currency:community_currencies(*)
    `
    )
    .or(`from_user_id.eq.${userId},to_user_id.eq.${userId}`)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) {
    console.error("Error fetching transaction history:", error);
    return [];
  }

  return transactions || [];
}

// ============================================================================
// GOLD OPERATIONS
// ============================================================================

/**
 * Transfer gold coins to another user
 */
export async function transferGold(
  toUserId: string,
  amount: number,
  description?: string
): Promise<TransferGoldResult> {
  const supabase = await createSupabaseServerClient();

  const userId = await getPublicUserId(supabase);
  if (!userId) {
    return { success: false, error: "Not authenticated" };
  }

  // Validate amount
  if (amount <= 0) {
    return { success: false, error: "Amount must be positive" };
  }

  if (userId === toUserId) {
    return { success: false, error: "Cannot transfer to yourself" };
  }

  // Call RPC function
  const { data, error } = await supabase.rpc("transfer_gold", {
    p_from_user_id: userId,
    p_to_user_id: toUserId,
    p_amount: amount,
    p_description: description || null,
  });

  if (error) {
    console.error("Error transferring gold:", error);
    return { success: false, error: error.message };
  }

  // Revalidate relevant pages
  revalidatePath("/profile");
  revalidatePath("/economy");

  return data as TransferGoldResult;
}

/**
 * Add gold to a user's wallet (admin/reward function)
 */
export async function addGoldToUser(
  userId: string,
  amount: number,
  transactionType: "reward" | "admin",
  description?: string
): Promise<AddGoldResult> {
  const supabase = await createSupabaseServerClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { success: false, error: "Not authenticated" };
  }

  // TODO: Add admin check here if needed
  // For now, anyone can call this (should be restricted in production)

  const { data, error } = await supabase.rpc("add_gold", {
    p_user_id: userId,
    p_amount: amount,
    p_transaction_type: transactionType,
    p_description: description || null,
  });

  if (error) {
    console.error("Error adding gold:", error);
    return { success: false, error: error.message };
  }

  revalidatePath("/profile");
  revalidatePath("/economy");

  return data as AddGoldResult;
}

/**
 * Deduct gold from user's wallet (purchase/tax function)
 */
export async function deductGoldFromUser(
  userId: string,
  amount: number,
  transactionType: "purchase" | "tax" | "other",
  description?: string
): Promise<DeductGoldResult> {
  const supabase = await createSupabaseServerClient();

  const { data, error } = await supabase.rpc("deduct_gold", {
    p_user_id: userId,
    p_amount: amount,
    p_transaction_type: transactionType,
    p_description: description || null,
  });

  if (error) {
    console.error("Error deducting gold:", error);
    return { success: false, error: error.message };
  }

  revalidatePath("/profile");
  revalidatePath("/economy");

  return data as DeductGoldResult;
}

// ============================================================================
// COMMUNITY CURRENCY OPERATIONS
// ============================================================================

/**
 * Transfer community coins to another user
 */
export async function transferCommunityCoin(
  toUserId: string,
  communityCurrencyId: string,
  amount: number,
  description?: string
): Promise<TransferCommunityCoinResult> {
  const supabase = await createSupabaseServerClient();

  const userId = await getPublicUserId(supabase);
  if (!userId) {
    return { success: false, error: "Not authenticated" };
  }

  if (amount <= 0) {
    return { success: false, error: "Amount must be positive" };
  }

  if (userId === toUserId) {
    return { success: false, error: "Cannot transfer to yourself" };
  }

  const { data, error } = await supabase.rpc("transfer_community_coin", {
    p_from_user_id: userId,
    p_to_user_id: toUserId,
    p_community_currency_id: communityCurrencyId,
    p_amount: amount,
    p_description: description || null,
  });

  if (error) {
    console.error("Error transferring community coin:", error);
    return { success: false, error: error.message };
  }

  revalidatePath("/profile");
  revalidatePath("/economy");
  revalidatePath("/community");

  return data as TransferCommunityCoinResult;
}

/**
 * Exchange between gold and community currency
 */
export async function exchangeCurrency(
  communityCurrencyId: string,
  fromCurrency: "gold" | "community",
  amount: number
): Promise<ExchangeCurrencyResult> {
  const supabase = await createSupabaseServerClient();

  const userId = await getPublicUserId(supabase);
  if (!userId) {
    return { success: false, error: "Not authenticated" };
  }

  if (amount <= 0) {
    return { success: false, error: "Amount must be positive" };
  }

  const { data, error } = await supabase.rpc("exchange_currency", {
    p_user_id: userId,
    p_community_currency_id: communityCurrencyId,
    p_from_currency: fromCurrency,
    p_amount: amount,
  });

  if (error) {
    console.error("Error exchanging currency:", error);
    return { success: false, error: error.message };
  }

  revalidatePath("/profile");
  revalidatePath("/economy");
  revalidatePath("/community");

  return data as ExchangeCurrencyResult;
}

// ============================================================================
// CURRENCY MANAGEMENT
// ============================================================================

/**
 * Get all community currencies
 */
export async function getAllCommunityCurrencies() {
  const supabase = await createSupabaseServerClient();

  const { data: currencies, error } = await supabase
    .from("community_currencies")
    .select("*")
    .order("currency_name");

  if (error) {
    console.error("Error fetching community currencies:", error);
    return [];
  }

  return currencies || [];
}

/**
 * Get currency for a specific community
 */
export async function getCommunityCurrency(communityId: string) {
  const supabase = await createSupabaseServerClient();

  const { data: currency, error } = await supabase
    .from("community_currencies")
    .select("*")
    .eq("community_id", communityId)
    .single();

  if (error) {
    console.error("Error fetching community currency:", error);
    return null;
  }

  return currency;
}

// ============================================================================
// INVENTORY OPERATIONS
// ============================================================================

const INVENTORY_CATEGORY_ORDER: InventoryByCategory["category"][] = [
  "product",
  "raw_material",
];

const INVENTORY_CATEGORY_OVERRIDES: Record<
  string,
  InventoryByCategory["category"]
> = {
  ticket: "product",
  oil: "raw_material",
};

function normalizeInventoryCategories(data: any[]): InventoryByCategory[] {
  const grouped: Record<InventoryByCategory["category"], InventoryItem[]> = {
    raw_material: [],
    product: [],
  };

  for (const category of data || []) {
    const categoryKey = category?.category;
    const items = Array.isArray(category?.items) ? category.items : [];

    for (const item of items) {
      const normalized =
        INVENTORY_CATEGORY_OVERRIDES[item?.resource_key] ??
        (categoryKey === "raw_material" || categoryKey === "product"
          ? categoryKey
          : "product");

      grouped[normalized].push(item);
    }
  }

  return INVENTORY_CATEGORY_ORDER.map((category) => ({
    category,
    items: grouped[category],
  })).filter((category) => category.items.length > 0);
}

/**
 * Get user's inventory grouped by category
 */
export async function getUserInventory(
  userId?: string
): Promise<InventoryByCategory[]> {
  const supabase = await createSupabaseServerClient();

  // Get current user's public ID if not specified
  let targetUserId: string | null = userId || null;
  if (!targetUserId) {
    targetUserId = await getPublicUserId(supabase);
    if (!targetUserId) return [];
  }

  const { data, error } = await supabase.rpc("get_user_inventory", {
    p_user_id: targetUserId,
  });

  if (error) {
    console.error("Error fetching user inventory:", error);
    return [];
  }

  return normalizeInventoryCategories(data || []);
}

/**
 * Get community's inventory (treasury) grouped by category
 */
export async function getCommunityInventory(
  communityId: string
): Promise<InventoryByCategory[]> {
  const supabase = await createSupabaseServerClient();

  const { data, error } = await supabase.rpc("get_community_inventory", {
    p_community_id: communityId,
  });

  if (error) {
    console.error("Error fetching community inventory:", error);
    return [];
  }

  return normalizeInventoryCategories(data || []);
}

/**
 * Add item to user's inventory
 */
export async function addToInventory(
  resourceKey: string,
  qualityKey: string,
  quantity: number
) {
  const supabase = await createSupabaseServerClient();

  const userId = await getPublicUserId(supabase);
  if (!userId) {
    return { success: false, error: "Not authenticated" };
  }

  const { data, error } = await supabase.rpc("add_to_user_inventory", {
    p_user_id: userId,
    p_resource_key: resourceKey,
    p_quality_key: qualityKey,
    p_quantity: quantity,
  });

  if (error) {
    console.error("Error adding to inventory:", error);
    return { success: false, error: error.message };
  }

  revalidatePath("/inventory");
  return data;
}

/**
 * Remove item from user's inventory
 */
export async function removeFromInventory(
  resourceKey: string,
  qualityKey: string,
  quantity: number
) {
  const supabase = await createSupabaseServerClient();

  const userId = await getPublicUserId(supabase);
  if (!userId) {
    return { success: false, error: "Not authenticated" };
  }

  const { data, error } = await supabase.rpc("remove_from_user_inventory", {
    p_user_id: userId,
    p_resource_key: resourceKey,
    p_quality_key: qualityKey,
    p_quantity: quantity,
  });

  if (error) {
    console.error("Error removing from inventory:", error);
    return { success: false, error: error.message };
  }

  revalidatePath("/inventory");
  return data;
}

/**
 * Get all resources
 */
export async function getAllResources() {
  const supabase = await createSupabaseServerClient();

  const { data: resources, error } = await supabase
    .from("resources")
    .select("*")
    .order("category")
    .order("name");

  if (error) {
    console.error("Error fetching resources:", error);
    return [];
  }

  return resources || [];
}

/**
 * Get all quality tiers
 */
export async function getAllQualities() {
  const supabase = await createSupabaseServerClient();

  const { data: qualities, error } = await supabase
    .from("resource_qualities")
    .select("*")
    .order("quality_level");

  if (error) {
    console.error("Error fetching qualities:", error);
    return [];
  }

  return qualities || [];
}

// ============================================================================
// USER COMMUNITY
// ============================================================================

/**
 * Get current user's public ID and location
 */
export async function getCurrentUserData(): Promise<{
  userId: string;
  currentHex: string | null;
} | null> {
  const supabase = await createSupabaseServerClient();

  const userId = await getPublicUserId(supabase);
  if (!userId) return null;

  const { data: user } = await supabase
    .from("users")
    .select("current_hex")
    .eq("id", userId)
    .single();

  return {
    userId,
    currentHex: user?.current_hex || null,
  };
}

/**
 * Get the user's community ID (for selling items on marketplace)
 * Checks main_community_id first, then falls back to community_members
 */
export async function getUserCommunityId(): Promise<string | null> {
  const supabase = await createSupabaseServerClient();

  const userId = await getPublicUserId(supabase);
  if (!userId) return null;

  // First check main_community_id
  const { data: user } = await supabase
    .from("users")
    .select("main_community_id")
    .eq("id", userId)
    .single();

  if (user?.main_community_id) {
    return user.main_community_id;
  }

  // Fallback: check community_members
  const { data: membership } = await supabase
    .from("community_members")
    .select("community_id")
    .eq("user_id", userId)
    .limit(1)
    .maybeSingle();

  return membership?.community_id || null;
}

// ============================================================================
// CURRENCY EXCHANGE MARKET
// ============================================================================

export interface CurrencyMarketRate {
  currencyId: string;
  currencyName: string;
  currencySymbol: string;
  communityId: string;
  communityName: string;
  communitySlug: string;
  communityColor: string | null;
  exchangeRate: number;
  totalSupply: number;
  trend: "up" | "down" | "stable";
  change24h: number; // Percentage change
  isAccessible: boolean; // Can user trade this currency based on location?
}

export interface CurrencyExchangeContext {
  userHex: string | null;
  userHexCustomName: string | null;
  userGold: number;
  userCommunityCurrencies: Array<{
    currencyId: string;
    currencyName: string;
    currencySymbol: string;
    amount: number;
    exchangeRate: number;
  }>;
  marketRates: CurrencyMarketRate[];
}

/**
 * Get comprehensive currency exchange market data
 */
export async function getCurrencyExchangeData(): Promise<CurrencyExchangeContext | null> {
  const supabase = await createSupabaseServerClient();

  const userId = await getPublicUserId(supabase);
  if (!userId) return null;

  // Get user's current location
  const { data: user } = await supabase
    .from("users")
    .select("current_hex")
    .eq("id", userId)
    .single();

  const userHex = user?.current_hex || null;

  // Get region custom name if user has a location
  let userHexCustomName: string | null = null;
  if (userHex) {
    const { data: region } = await supabase
      .from("world_regions")
      .select("custom_name, province_name")
      .eq("hex_id", userHex)
      .single();

    userHexCustomName = region?.custom_name || region?.province_name || null;
  }

  // Get user's wallet
  const wallet = await getUserWallet(userId);
  if (!wallet) return null;

  // Get all community currencies with community data
  const { data: currencies } = await supabase
    .from("community_currencies")
    .select(`
      id,
      currency_name,
      currency_symbol,
      exchange_rate_to_gold,
      total_supply,
      community_id,
      communities:community_id (
        id,
        name,
        slug,
        color
      )
    `)
    .order("currency_name");

  if (!currencies) return null;

  // Get hexes owned by each community to determine accessibility
  const { data: regions } = await supabase
    .from("world_regions")
    .select("hex_id, owner_community_id");

  // Create a map of community_id -> list of owned hexes
  const communityHexes = new Map<string, string[]>();
  regions?.forEach((region) => {
    if (region.owner_community_id) {
      const hexes = communityHexes.get(region.owner_community_id) || [];
      hexes.push(region.hex_id);
      communityHexes.set(region.owner_community_id, hexes);
    }
  });

  // Build market rates with accessibility check
  const marketRates: CurrencyMarketRate[] = currencies.map((currency) => {
    const community = Array.isArray(currency.communities)
      ? currency.communities[0]
      : currency.communities;

    const ownedHexes = communityHexes.get(currency.community_id) || [];
    const isAccessible = userHex ? ownedHexes.includes(userHex) : false;

    // TODO: Calculate real trend based on transaction history
    // For now, use a simple random trend
    const trend: "up" | "down" | "stable" =
      currency.exchange_rate_to_gold > 1.1 ? "up" :
      currency.exchange_rate_to_gold < 0.9 ? "down" : "stable";

    return {
      currencyId: currency.id,
      currencyName: currency.currency_name,
      currencySymbol: currency.currency_symbol,
      communityId: currency.community_id,
      communityName: community?.name || "Unknown",
      communitySlug: community?.slug || "",
      communityColor: community?.color || null,
      exchangeRate: currency.exchange_rate_to_gold,
      totalSupply: currency.total_supply,
      trend,
      change24h: (currency.exchange_rate_to_gold - 1.0) * 100,
      isAccessible,
    };
  });

  return {
    userHex,
    userHexCustomName,
    userGold: wallet.goldCoins,
    userCommunityCurrencies: wallet.communityWallets,
    marketRates,
  };
}

/**
 * Exchange currency with location validation
 */
export async function exchangeCurrencyWithLocationCheck(
  communityCurrencyId: string,
  fromCurrency: "gold" | "community",
  amount: number
): Promise<ExchangeCurrencyResult> {
  const supabase = await createSupabaseServerClient();

  const userId = await getPublicUserId(supabase);
  if (!userId) {
    return { success: false, error: "Not authenticated" };
  }

  if (amount <= 0) {
    return { success: false, error: "Amount must be positive" };
  }

  // Get user's current location
  const { data: user } = await supabase
    .from("users")
    .select("current_hex")
    .eq("id", userId)
    .single();

  const userHex = user?.current_hex;

  if (!userHex) {
    return {
      success: false,
      error: "You must be located in a community's territory to use their exchange market"
    };
  }

  // Get the community that owns this currency
  const { data: currency } = await supabase
    .from("community_currencies")
    .select("community_id")
    .eq("id", communityCurrencyId)
    .single();

  if (!currency) {
    return { success: false, error: "Currency not found" };
  }

  // Check if user is in a hex owned by this community
  const { data: region } = await supabase
    .from("world_regions")
    .select("owner_community_id")
    .eq("hex_id", userHex)
    .single();

  if (!region || region.owner_community_id !== currency.community_id) {
    return {
      success: false,
      error: "You must be in this community's territory to trade their currency",
    };
  }

  // Perform the exchange
  return await exchangeCurrency(communityCurrencyId, fromCurrency, amount);
}
