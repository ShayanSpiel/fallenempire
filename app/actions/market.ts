'use server';

import { createSupabaseServerClient } from '@/lib/supabase-server';
import { revalidatePath } from 'next/cache';
import type {
  CreateOrderResult,
  AcceptOrderResult,
  CancelOrderResult,
  OrderBookData,
  OrderBookLevel,
  OrderBookIndividual,
  UserExchangeOrder,
  ExchangeRateSnapshot,
  OrderType,
  SourceAccount,
} from '@/lib/types/economy';

// ============================================================================
// HELPER: Get public user ID from auth user
// ============================================================================
async function getPublicUserId(supabase: any): Promise<string | null> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: profile } = await supabase
    .from('users')
    .select('id')
    .eq('auth_id', user.id)
    .single();

  return profile?.id || null;
}

// ============================================================================
// TYPES
// ============================================================================

export interface MarketListing {
  id: string;
  listing_type: 'product' | 'job' | 'exchange';
  status: 'active' | 'filled' | 'cancelled' | 'expired';
  created_at: string;
  expires_at: string | null;

  // Product fields
  seller_id?: string;
  seller_username?: string;
  resource_id?: string;
  resource_key?: string;
  resource_name?: string;
  quality_id?: string;
  quality_key?: string;
  quality_name?: string;
  quality_stars?: number;
  quantity?: number;
  price_per_unit_gold?: number;
  price_per_unit_community_coin?: number;

  // Job fields
  company_id?: string;
  company_name?: string;
  company_owner_id?: string;
  company_owner_username?: string;
  position_title?: string;
  positions_available?: number;
  wage_per_day_community_coin?: number;
  requirements?: Record<string, unknown>;

  // Exchange fields
  exchanger_id?: string;
  exchanger_username?: string;
  offer_currency_type?: string;
  offer_amount?: number;
  want_currency_type?: string;
  want_amount?: number;
  exchange_rate?: number;

  // Common
  community_id: string;
  community_name?: string;
}

export interface TradeResult {
  success: boolean;
  quantity_purchased?: number;
  gold_paid?: number;
  community_coin_paid?: number;
  tariff_paid?: number;
  error?: string;
}

export interface JobApplicationResult {
  success: boolean;
  company_id?: string;
  position?: string;
  wage_cc?: number;
  error?: string;
}

// ============================================================================
// MARKET LISTINGS (Products)
// ============================================================================

export async function getMarketListings(params: {
  communityIds?: string[];
  resourceIds?: string[];
  qualityIds?: string[];
  limit?: number;
  offset?: number;
}): Promise<MarketListing[]> {
  const supabase = await createSupabaseServerClient();

  const { data, error } = await supabase.rpc('get_market_listings', {
    p_listing_type: 'product',
    p_community_ids: params.communityIds || null,
    p_resource_ids: params.resourceIds || null,
    p_quality_ids: params.qualityIds || null,
    p_limit: params.limit || 50,
    p_offset: params.offset || 0,
  });

  if (error) {
    console.error('Error fetching market listings:', error);
    throw error;
  }

  return data as MarketListing[];
}

export async function createProductListing(params: {
  communityId: string;
  resourceId: string;
  qualityId: string;
  quantity: number;
  pricePerUnitGold?: number;
  pricePerUnitCommunityCoin?: number;
}): Promise<{ success: boolean; listingId?: string; error?: string }> {
  const supabase = await createSupabaseServerClient();

  // Get current user
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { success: false, error: 'Not authenticated' };
  }

  // Get public user ID
  const { data: profile } = await supabase
    .from('users')
    .select('id')
    .eq('auth_id', user.id)
    .single();

  if (!profile) {
    return { success: false, error: 'User profile not found' };
  }

  try {
    const { data, error } = await supabase.rpc('create_product_listing', {
      p_seller_id: profile.id,
      p_community_id: params.communityId,
      p_resource_id: params.resourceId,
      p_quality_id: params.qualityId,
      p_quantity: params.quantity,
      p_price_per_unit_gold: params.pricePerUnitGold || null,
      p_price_per_unit_community_coin: params.pricePerUnitCommunityCoin || null,
    });

    if (error) throw error;

    revalidatePath('/market');
    revalidatePath('/inventory');

    return { success: true, listingId: data };
  } catch (error) {
    console.error('Error creating product listing:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to create listing',
    };
  }
}

export async function purchaseProduct(params: {
  listingId: string;
  quantity: number;
}): Promise<TradeResult> {
  const supabase = await createSupabaseServerClient();

  // Get current user
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { success: false, error: 'Not authenticated' };
  }

  // Get public user ID
  const { data: profile } = await supabase
    .from('users')
    .select('id')
    .eq('auth_id', user.id)
    .single();

  if (!profile) {
    return { success: false, error: 'User profile not found' };
  }

  try {
    // Use the location-aware purchase function
    const { data, error } = await supabase.rpc('purchase_product_with_location_check', {
      p_buyer_id: profile.id,
      p_listing_id: params.listingId,
      p_quantity: params.quantity,
    });

    if (error) throw error;

    // Check if the function returned an error
    if (data && typeof data === 'object' && 'success' in data && !data.success) {
      return data as TradeResult;
    }

    revalidatePath('/market');
    revalidatePath('/inventory');

    return data as TradeResult;
  } catch (error) {
    console.error('Error purchasing product:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to purchase product',
    };
  }
}

export async function cancelListing(listingId: string): Promise<{
  success: boolean;
  error?: string;
}> {
  const supabase = await createSupabaseServerClient();

  // Get current user
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { success: false, error: 'Not authenticated' };
  }

  // Get public user ID
  const { data: profile } = await supabase
    .from('users')
    .select('id')
    .eq('auth_id', user.id)
    .single();

  if (!profile) {
    return { success: false, error: 'User profile not found' };
  }

  try {
    const { error } = await supabase.rpc('cancel_market_listing', {
      p_listing_id: listingId,
      p_user_id: profile.id,
    });

    if (error) throw error;

    revalidatePath('/market');
    revalidatePath('/inventory');

    return { success: true };
  } catch (error) {
    console.error('Error cancelling listing:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to cancel listing',
    };
  }
}

// ============================================================================
// JOB LISTINGS
// ============================================================================

export async function getJobListings(params: {
  communityIds?: string[];
  limit?: number;
  offset?: number;
}): Promise<MarketListing[]> {
  const supabase = await createSupabaseServerClient();

  const { data, error } = await supabase.rpc('get_market_listings', {
    p_listing_type: 'job',
    p_community_ids: params.communityIds || null,
    p_resource_ids: null,
    p_quality_ids: null,
    p_limit: params.limit || 50,
    p_offset: params.offset || 0,
  });

  if (error) {
    console.error('Error fetching job listings:', error);
    throw error;
  }

  return data as MarketListing[];
}

export async function createJobListing(params: {
  companyId: string;
  positionTitle: string;
  positionsAvailable: number;
  wagePerDayCommunityCoin?: number;
  requirements?: Record<string, unknown>;
}): Promise<{ success: boolean; listingId?: string; error?: string }> {
  const supabase = await createSupabaseServerClient();

  // Get current user
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { success: false, error: 'Not authenticated' };
  }

  // Verify user owns the company
  const { data: profile } = await supabase
    .from('users')
    .select('id')
    .eq('auth_id', user.id)
    .single();

  if (!profile) {
    return { success: false, error: 'User profile not found' };
  }

  const { data: company } = await supabase
    .from('companies')
    .select('owner_id, hex_id, community_id')
    .eq('id', params.companyId)
    .single();

  if (!company || company.owner_id !== profile.id) {
    return { success: false, error: 'Not authorized to create job listing for this company' };
  }

  const wage = Number(params.wagePerDayCommunityCoin ?? 0);
  if (!Number.isFinite(wage) || wage < 0.01) {
    return { success: false, error: 'Wage must be at least 0.01 community coin per day' };
  }

  const openings = Number(params.positionsAvailable ?? 0);
  if (!Number.isFinite(openings) || openings < 1) {
    return { success: false, error: 'Openings must be at least 1' };
  }

  const companyHexId = (company.hex_id as string | null)?.trim?.() ?? null;

  let effectiveCommunityId: string | null = (company.community_id as string | null) ?? null;
  if (companyHexId) {
    const { data: region } = await supabase
      .from('world_regions')
      .select('owner_community_id')
      .eq('hex_id', companyHexId)
      .maybeSingle();

    effectiveCommunityId = (region?.owner_community_id as string | null) ?? effectiveCommunityId;

    if (effectiveCommunityId && effectiveCommunityId !== company.community_id) {
      await supabase
        .from('companies')
        .update({ community_id: effectiveCommunityId })
        .eq('id', params.companyId);
    }
  }

  if (!effectiveCommunityId) {
    return { success: false, error: 'Your company is in wilderness. No employees to hire here!' };
  }

  try {
    const { data, error } = await supabase.rpc('create_job_listing', {
      p_company_id: params.companyId,
      p_community_id: effectiveCommunityId,
      p_position_title: params.positionTitle,
      p_positions_available: openings,
      p_wage_per_day_community_coin: wage,
      p_requirements: params.requirements || {},
    });

    if (error) throw error;

    revalidatePath('/market');
    revalidatePath('/ventures');

    return { success: true, listingId: data };
  } catch (error) {
    console.error('Error creating job listing:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to create job listing',
    };
  }
}

export async function applyToJob(listingId: string): Promise<JobApplicationResult> {
  const supabase = await createSupabaseServerClient();

  // Get current user
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { success: false, error: 'Not authenticated' };
  }

  // Get public user ID
  const { data: profile } = await supabase
    .from('users')
    .select('id')
    .eq('auth_id', user.id)
    .single();

  if (!profile) {
    return { success: false, error: 'User profile not found' };
  }

  const { data: activeEmployment, error: employmentError } = await supabase
    .from('employment_contracts')
    .select('id')
    .eq('employee_id', profile.id)
    .eq('active', true)
    .limit(1)
    .maybeSingle();

  if (employmentError) {
    console.error('Error checking active employment:', employmentError);
    return { success: false, error: 'Failed to verify employment status' };
  }

  if (activeEmployment) {
    return {
      success: false,
      error: 'You already have a job. Leave it before applying to another.',
    };
  }

  try {
    const { data, error } = await supabase.rpc('apply_to_job', {
      p_applicant_id: profile.id,
      p_listing_id: listingId,
    });

    if (error) throw error;

    revalidatePath('/market');
    revalidatePath('/ventures');

    return data as JobApplicationResult;
  } catch (error) {
    console.error('Error applying to job:', error);
    const message =
      typeof error === 'string'
        ? error
        : error && typeof error === 'object' && 'message' in error
          ? String((error as { message?: unknown }).message)
          : 'Failed to apply to job';
    return {
      success: false,
      error: message,
    };
  }
}

// ============================================================================
// EXCHANGE LISTINGS (Future)
// ============================================================================

export async function getExchangeListings(params: {
  communityIds?: string[];
  limit?: number;
  offset?: number;
}): Promise<MarketListing[]> {
  const supabase = await createSupabaseServerClient();

  const { data, error } = await supabase.rpc('get_market_listings', {
    p_listing_type: 'exchange',
    p_community_ids: params.communityIds || null,
    p_resource_ids: null,
    p_quality_ids: null,
    p_limit: params.limit || 50,
    p_offset: params.offset || 0,
  });

  if (error) {
    console.error('Error fetching exchange listings:', error);
    throw error;
  }

  return data as MarketListing[];
}

// ============================================================================
// CURRENCY EXCHANGE ORDERS (P2P Market)
// ============================================================================

/**
 * Create a new exchange order (buy or sell offer)
 */
export async function createExchangeOrder(params: {
  communityCurrencyId: string;
  orderType: OrderType;
  goldAmount: number;
  currencyAmount: number;
  sourceAccount?: SourceAccount;
}): Promise<CreateOrderResult> {
  const supabase = await createSupabaseServerClient();

  // Get current user
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { order_id: null, success: false, message: 'Not authenticated' };
  }

  // Get public user ID
  const { data: profile } = await supabase
    .from('users')
    .select('id')
    .eq('auth_id', user.id)
    .single();

  if (!profile) {
    return { order_id: null, success: false, message: 'User profile not found' };
  }

  try {
    const { data, error } = await supabase.rpc('create_exchange_order', {
      p_user_id: profile.id,
      p_community_currency_id: params.communityCurrencyId,
      p_order_type: params.orderType,
      p_gold_amount: params.goldAmount,
      p_currency_amount: params.currencyAmount,
      p_source_account: params.sourceAccount || 'personal',
    });

    if (error) throw error;

    revalidatePath('/market');

    // RPC returns array, get first row
    return (data && data[0]) ? data[0] as CreateOrderResult : {
      order_id: null,
      success: false,
      message: 'No data returned from order creation',
    };
  } catch (error) {
    console.error('Error creating exchange order:', error);
    return {
      order_id: null,
      success: false,
      message: error instanceof Error ? error.message : 'Failed to create order',
    };
  }
}

/**
 * Accept an existing exchange order (partial or full fill)
 */
export async function acceptExchangeOrder(params: {
  orderId: string;
  goldAmount: number;
}): Promise<AcceptOrderResult> {
  const supabase = await createSupabaseServerClient();

  // Get current user
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { trade_id: null, success: false, message: 'Not authenticated' };
  }

  // Get public user ID
  const { data: profile } = await supabase
    .from('users')
    .select('id')
    .eq('auth_id', user.id)
    .single();

  if (!profile) {
    return { trade_id: null, success: false, message: 'User profile not found' };
  }

  try {
    const { data, error } = await supabase.rpc('accept_exchange_order', {
      p_taker_user_id: profile.id,
      p_order_id: params.orderId,
      p_gold_amount: params.goldAmount,
    });

    if (error) throw error;

    revalidatePath('/market');

    // RPC returns array, get first row
    return (data && data[0]) ? data[0] as AcceptOrderResult : {
      trade_id: null,
      success: false,
      message: 'No data returned from trade execution',
    };
  } catch (error) {
    console.error('Error accepting exchange order:', error);
    return {
      trade_id: null,
      success: false,
      message: error instanceof Error ? error.message : 'Failed to accept order',
    };
  }
}

/**
 * Cancel an existing exchange order
 */
export async function cancelExchangeOrder(orderId: string): Promise<CancelOrderResult> {
  const supabase = await createSupabaseServerClient();

  // Get current user
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { success: false, message: 'Not authenticated' };
  }

  // Get public user ID
  const { data: profile } = await supabase
    .from('users')
    .select('id')
    .eq('auth_id', user.id)
    .single();

  if (!profile) {
    return { success: false, message: 'User profile not found' };
  }

  try {
    const { data, error } = await supabase.rpc('cancel_exchange_order', {
      p_user_id: profile.id,
      p_order_id: orderId,
    });

    if (error) throw error;

    revalidatePath('/market');

    return data as CancelOrderResult;
  } catch (error) {
    console.error('Error cancelling exchange order:', error);
    return {
      success: false,
      message: error instanceof Error ? error.message : 'Failed to cancel order',
    };
  }
}

/**
 * Get aggregated order book for a community currency
 */
export async function getOrderBook(params: {
  communityCurrencyId: string;
}): Promise<OrderBookData> {
  const supabase = await createSupabaseServerClient();
  const userId = await getPublicUserId(supabase);

  if (!userId) {
    throw new Error('User not authenticated');
  }

  try {
    const { data, error } = await supabase.rpc('get_order_book_aggregated', {
      p_community_currency_id: params.communityCurrencyId,
      p_requesting_user_id: userId,
    });

    if (error) throw error;

    const levels = data as OrderBookLevel[];

    // Separate buys and sells
    const buys = levels.filter((l) => l.order_type === 'buy');
    const sells = levels.filter((l) => l.order_type === 'sell');

    // Calculate best bid/ask
    const bestBid = buys.length > 0 ? buys[0].exchange_rate : null;
    const bestAsk = sells.length > 0 ? sells[0].exchange_rate : null;
    const spread =
      bestBid && bestAsk ? Number((bestAsk - bestBid).toFixed(4)) : null;

    // Get last trade rate (if any recent trades exist)
    const { data: recentTrade } = await supabase
      .from('currency_exchange_trades')
      .select('exchange_rate')
      .eq('community_currency_id', params.communityCurrencyId)
      .order('executed_at', { ascending: false })
      .limit(1)
      .single();

    return {
      buys,
      sells,
      bestBid,
      bestAsk,
      spread,
      lastTradeRate: recentTrade?.exchange_rate || null,
    };
  } catch (error) {
    console.error('Error fetching order book:', error);
    return {
      buys: [],
      sells: [],
      bestBid: null,
      bestAsk: null,
      spread: null,
      lastTradeRate: null,
    };
  }
}

/**
 * Get P2P exchange context data for current user
 */
export async function getP2PExchangeContext() {
  const supabase = await createSupabaseServerClient();
  const userId = await getPublicUserId(supabase);

  if (!userId) {
    throw new Error('User not authenticated');
  }

  try {
    // Get user's gold balance
    const { data: goldWallet } = await supabase
      .from('user_wallets')
      .select('gold_coins')
      .eq('user_id', userId)
      .eq('currency_type', 'gold')
      .single();

    // Get user's community currencies
    const { data: communityWallets } = await supabase
      .from('user_wallets')
      .select(`
        community_coins,
        community_currency:community_currencies (
          id,
          currency_name,
          currency_symbol,
          exchange_rate_to_gold,
          community:communities (
            id,
            name,
            color
          )
        )
      `)
      .eq('user_id', userId)
      .eq('currency_type', 'community')
      .not('community_currency_id', 'is', null);

    // Get user's location and community role
    const { data: userData } = await supabase
      .from('users')
      .select('current_hex, main_community_id')
      .eq('id', userId)
      .single();

    // Get user's role in their main community
    let userRole = null;
    if (userData?.main_community_id) {
      const { data: memberData } = await supabase
        .from('community_members')
        .select('role')
        .eq('user_id', userId)
        .eq('community_id', userData.main_community_id)
        .single();

      userRole = memberData?.role || null;
    }

    // Get custom region name, province name, and which community owns this hex
    const { data: regionData } = await supabase
      .from('world_regions')
      .select('custom_name, province_name, owner_community_id')
      .eq('hex_id', userData?.current_hex || '')
      .maybeSingle();

    return {
      userId,
      userGold: goldWallet?.gold_coins || 0,
      userHex: userData?.current_hex || null,
      userHexCustomName: regionData?.custom_name || regionData?.province_name || null,
      userHexOwnerCommunityId: regionData?.owner_community_id || null,
      userMainCommunityId: userData?.main_community_id || null,
      userCommunityRole: userRole,
      communityCurrencies: (communityWallets || []).map((w: any) => ({
        currencyId: w.community_currency.id,
        currencyName: w.community_currency.community.name,
        currencySymbol: w.community_currency.currency_symbol,
        exchangeRate: w.community_currency.exchange_rate_to_gold,
        amount: w.community_coins,
        communityColor: w.community_currency.community.color,
        communityId: w.community_currency.community.id,
      })),
    };
  } catch (error) {
    console.error('Error fetching P2P exchange context:', error);
    throw error;
  }
}

/**
 * Get individual orders at a specific price level
 */
export async function getIndividualOrders(params: {
  communityCurrencyId: string;
  exchangeRate: number;
  orderType: OrderType;
}): Promise<OrderBookIndividual[]> {
  const supabase = await createSupabaseServerClient();
  const userId = await getPublicUserId(supabase);

  if (!userId) {
    throw new Error('User not authenticated');
  }

  try {
    const { data, error } = await supabase.rpc('get_order_book_individual', {
      p_community_currency_id: params.communityCurrencyId,
      p_exchange_rate: params.exchangeRate,
      p_order_type: params.orderType,
      p_requesting_user_id: userId,
    });

    if (error) throw error;

    return data as OrderBookIndividual[];
  } catch (error) {
    console.error('Error fetching individual orders:', error);
    return [];
  }
}

/**
 * Get user's active exchange orders
 */
export async function getUserExchangeOrders(): Promise<UserExchangeOrder[]> {
  const supabase = await createSupabaseServerClient();

  // Get current user
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return [];
  }

  // Get public user ID
  const { data: profile } = await supabase
    .from('users')
    .select('id')
    .eq('auth_id', user.id)
    .single();

  if (!profile) {
    return [];
  }

  try {
    const { data, error } = await supabase.rpc('get_user_exchange_orders', {
      p_user_id: profile.id,
    });

    if (error) throw error;

    return data as UserExchangeOrder[];
  } catch (error) {
    console.error('Error fetching user exchange orders:', error);
    return [];
  }
}

/**
 * Get exchange rate history for charting
 */
export async function getExchangeRateHistory(params: {
  communityCurrencyId: string;
  period: '24h' | '7d' | '30d';
}): Promise<ExchangeRateSnapshot[]> {
  const supabase = await createSupabaseServerClient();

  // Calculate start time based on period
  const now = new Date();
  let startTime: Date;
  switch (params.period) {
    case '24h':
      startTime = new Date(now.getTime() - 24 * 60 * 60 * 1000);
      break;
    case '7d':
      startTime = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      break;
    case '30d':
      startTime = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      break;
  }

  try {
    const { data, error } = await supabase.rpc('get_exchange_rate_history', {
      p_community_currency_id: params.communityCurrencyId,
      p_start_time: startTime.toISOString(),
      p_end_time: now.toISOString(),
    });

    if (error) throw error;

    return data as ExchangeRateSnapshot[];
  } catch (error) {
    console.error('Error fetching exchange rate history:', error);
    return [];
  }
}

/**
 * Get ALL community currencies (for exchange market filter support)
 * Returns all community currencies regardless of whether user has wallets
 */
export async function getCommunityCurrencies() {
  const supabase = await createSupabaseServerClient();

  try {
    const { data, error } = await supabase
      .from('community_currencies')
      .select(`
        id,
        currency_name,
        currency_symbol,
        exchange_rate_to_gold,
        community:community_id (
          id,
          name,
          color
        )
      `);

    if (error) throw error;

    // Map to expected format
    return (data || []).map((curr: any) => {
      const community = Array.isArray(curr.community) ? curr.community[0] : curr.community;
      return {
        currencyId: curr.id,
        currencyName: community?.name || 'Unknown',
        currencySymbol: curr.currency_symbol,
        exchangeRate: curr.exchange_rate_to_gold,
        communityId: community?.id || '',
        communityColor: community?.color || null,
        amount: 0, // User's amount not fetched here
      };
    });
  } catch (error) {
    console.error('Error fetching all community currencies:', error);
    return [];
  }
}

/**
 * Get the community's treasury balance for a specific currency
 * Used for checking available treasury funds when trading with community account
 */
export async function getCommunityTreasuryBalance(communityId: string): Promise<number> {
  const supabase = await createSupabaseServerClient();

  try {
    const { data, error } = await supabase
      .from('user_wallets')
      .select('community_coins')
      .eq('user_id', communityId)
      .eq('currency_type', 'community')
      .maybeSingle();

    if (error) {
      console.error('[getCommunityTreasuryBalance] Error fetching treasury:', error);
      return 0;
    }

    const balance = data?.community_coins || 0;
    console.log('[getCommunityTreasuryBalance] Community', communityId, 'treasury balance:', balance);
    return balance;
  } catch (error) {
    console.error('[getCommunityTreasuryBalance] Exception:', error);
    return 0;
  }
}
