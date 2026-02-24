// Economy Module Types
// Corresponds to database schemas:
// - migrations/20270108_dual_currency_system.sql
// - migrations/20270109_resources_and_inventory.sql

// ============================================================================
// RESOURCE TYPES
// ============================================================================

export type ResourceCategory = 'raw_material' | 'product';

export interface ResourceQuality {
  id: string;
  key: string;
  name: string;
  quality_level: number; // 1-5
  stat_multiplier: number;
  drop_rate: number;
  color_hex: string;
  created_at: string;
}

export interface Resource {
  id: string;
  key: string;
  name: string;
  description: string;
  category: ResourceCategory;
  icon_name: string;
  tradeable: boolean;
  stackable: boolean;
  metadata: Record<string, unknown>;
  created_at: string;
}

export interface InventoryItem {
  id: string;
  resource_id: string;
  resource_key: string;
  resource_name: string;
  resource_icon: string;
  quality_id: string;
  quality_key: string;
  quality_name: string;
  quality_level: number;
  quality_color: string;
  quantity: number;
  stat_multiplier: number;
}

export interface UserInventoryItem {
  id: string;
  user_id: string;
  resource_id: string;
  quality_id: string;
  quantity: number;
  updated_at: string;
  // Expanded relations
  resource?: Resource;
  quality?: ResourceQuality;
}

export interface CommunityInventoryItem {
  id: string;
  community_id: string;
  resource_id: string;
  quality_id: string;
  quantity: number;
  updated_at: string;
  // Expanded relations
  resource?: Resource;
  quality?: ResourceQuality;
}

export interface InventoryByCategory {
  category: ResourceCategory;
  items: InventoryItem[];
}

// ============================================================================
// CURRENCY TYPES
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
}

export interface UserWallet {
  id: string;
  user_id: string;
  currency_type: 'gold' | 'community';
  gold_coins: number;
  community_currency_id: string | null;
  community_coins: number;
  created_at: string;
  updated_at: string;
  // Expanded relations
  community_currency?: CommunityCurrency;
}

export interface CurrencyTransaction {
  id: string;
  from_user_id: string | null;
  to_user_id: string | null;
  currency_type: 'gold' | 'community';
  community_currency_id: string | null;
  amount: number;
  transaction_type: 'transfer' | 'exchange' | 'reward' | 'tax' | 'purchase' | 'sale';
  description: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
  // Expanded relations
  from_user?: { id: string; username: string };
  to_user?: { id: string; username: string };
  community_currency?: CommunityCurrency;
}

// ============================================================================
// RPC RESPONSE TYPES
// ============================================================================

export interface TransferGoldResult {
  success: boolean;
  transaction_id?: string;
  amount?: number;
  from_user_id?: string;
  to_user_id?: string;
  error?: string;
  current_balance?: number;
  required?: number;
}

export interface TransferCommunityCoinResult {
  success: boolean;
  transaction_id?: string;
  amount?: number;
  from_user_id?: string;
  to_user_id?: string;
  community_currency_id?: string;
  error?: string;
  current_balance?: number;
  required?: number;
}

export interface ExchangeCurrencyResult {
  success: boolean;
  transaction_id?: string;
  exchange_rate?: number;
  gold_amount?: number;
  community_amount?: number;
  from_currency?: 'gold' | 'community';
  error?: string;
}

export interface AddGoldResult {
  success: boolean;
  transaction_id?: string;
  amount?: number;
  error?: string;
}

export interface DeductGoldResult {
  success: boolean;
  transaction_id?: string;
  amount?: number;
  error?: string;
  current_balance?: number;
  required?: number;
}

// ============================================================================
// EXCHANGE MARKET TYPES
// ============================================================================

export type OrderType = 'buy' | 'sell';
export type OrderStatus = 'active' | 'partially_filled' | 'filled' | 'cancelled' | 'expired';
export type SourceAccount = 'personal' | 'treasury';

export interface ExchangeOrder {
  id: string;
  user_id: string;
  community_currency_id: string;
  order_type: OrderType;
  gold_amount: number;
  currency_amount: number;
  exchange_rate: number;
  filled_gold_amount: number;
  status: OrderStatus;
  source_account: SourceAccount;
  created_at: string;
  updated_at: string;
  expires_at: string;
  metadata: Record<string, unknown>;
}

export interface ExchangeTrade {
  id: string;
  order_id: string;
  maker_user_id: string;
  taker_user_id: string;
  community_currency_id: string;
  gold_amount: number;
  currency_amount: number;
  exchange_rate: number;
  executed_at: string;
  metadata: Record<string, unknown>;
}

export interface ExchangeRateSnapshot {
  id: string;
  community_currency_id: string;
  snapshot_time: string;
  open_rate: number | null;
  high_rate: number | null;
  low_rate: number | null;
  close_rate: number | null;
  weighted_avg_rate: number | null;
  volume_gold: number;
  volume_currency: number;
  trade_count: number;
  metadata: Record<string, unknown>;
}

export interface OrderBookLevel {
  order_type: OrderType;
  exchange_rate: number;
  total_gold_amount: number;
  total_currency_amount: number;
  order_count: number;
}

export interface OrderBookIndividual {
  order_id: string;
  user_id: string;
  username: string;
  avatar_url: string | null;
  remaining_gold_amount: number;
  remaining_currency_amount: number;
  exchange_rate: number;
  source_account: SourceAccount;
  created_at: string;
  order_type: OrderType;
}

export interface OrderBookData {
  buys: OrderBookLevel[];
  sells: OrderBookLevel[];
  bestBid: number | null;
  bestAsk: number | null;
  spread: number | null;
  lastTradeRate: number | null;
}

export interface UserExchangeOrder {
  order_id: string;
  community_currency_id: string;
  community_name: string;
  currency_symbol: string;
  order_type: OrderType;
  gold_amount: number;
  currency_amount: number;
  filled_gold_amount: number;
  exchange_rate: number;
  status: OrderStatus;
  source_account: SourceAccount;
  created_at: string;
  expires_at: string;
}

export interface CreateOrderResult {
  order_id: string | null;
  success: boolean;
  message: string;
}

export interface AcceptOrderResult {
  trade_id: string | null;
  success: boolean;
  message: string;
}

export interface CancelOrderResult {
  success: boolean;
  message: string;
}

// ============================================================================
// UI DISPLAY TYPES
// ============================================================================

export interface WalletDisplay {
  goldCoins: number;
  communityWallets: Array<{
    currencyId: string;
    currencyName: string;
    currencySymbol: string;
    amount: number;
    exchangeRate: number;
    communityColor: string | null;
  }>;
}

export interface TransactionHistoryItem {
  id: string;
  date: string;
  type: 'sent' | 'received' | 'exchange' | 'reward' | 'tax' | 'purchase' | 'sale';
  amount: number;
  currency: 'gold' | string; // gold or community currency symbol
  otherParty?: {
    id: string;
    username: string;
  };
  description?: string;
}

// ============================================================================
// FORM TYPES
// ============================================================================

export interface TransferGoldFormData {
  recipientUserId: string;
  amount: number;
  description?: string;
}

export interface ExchangeCurrencyFormData {
  communityCurrencyId: string;
  fromCurrency: 'gold' | 'community';
  amount: number;
}
