// ============================================================================
// MARKET TYPES
// ============================================================================

export interface MarketListing {
  id: string;
  seller_id: string;
  seller_username: string;
  resource_id: string;
  resource_key: string;
  resource_name: string;
  quality_id: string;
  quality_level: number;
  quantity: number;
  price_per_unit: number;
  currency_type: "gold" | "community";
  community_currency_id: string | null;
  community_id: string | null;
  hex_id: string | null;
  created_at: string;
  expires_at: string | null;
}

export interface JobListing {
  id: string;
  company_id: string;
  company_name: string;
  company_type_key: string;
  company_type_name: string;
  owner_id: string;
  owner_username: string;
  positions_available: number;
  wage_per_day_community_coin: number;
  community_currency_id: string;
  community_id: string;
  hex_id: string;
  requirements: string | null;
  created_at: string;
}

export interface CurrencyExchangeListing {
  id: string;
  seller_id: string;
  seller_username: string;
  from_currency_type: "gold" | "community";
  to_currency_type: "gold" | "community";
  from_amount: number;
  to_amount: number;
  exchange_rate: number;
  community_currency_id: string | null;
  community_id: string | null;
  created_at: string;
}

export interface CreateMarketListingInput {
  resource_key: string;
  quality_key: string;
  quantity: number;
  price_per_unit: number;
  currency_type: "gold" | "community";
  community_currency_id?: string | null;
}

export interface CreateJobListingInput {
  company_id: string;
  positions_available: number;
  wage_per_day_community_coin: number;
  requirements?: string | null;
}

export interface CreateExchangeListingInput {
  from_currency_type: "gold" | "community";
  to_currency_type: "gold" | "community";
  from_amount: number;
  to_amount: number;
  community_currency_id?: string | null;
}

export interface PurchaseMarketListingInput {
  listing_id: string;
  quantity: number;
}

export interface ApplyToJobInput {
  job_listing_id: string;
  company_id: string;
}

export interface AcceptExchangeInput {
  listing_id: string;
}
