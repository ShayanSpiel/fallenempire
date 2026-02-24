/**
 * ECONOMIC TRANSACTION SERVICE
 *
 * Single Source of Truth for ALL economic operations in the game.
 * Every gold/currency transaction MUST go through this service.
 *
 * NO DIRECT WALLET UPDATES ALLOWED - Always use this service.
 */

import { createSupabaseBrowserClient } from "@/lib/supabase-browser";
// Note: This service is for future use - current implementation uses RPC functions directly

// Transaction types (must match database constraint)
export type TransactionType =
  // Original types
  | "transfer"
  | "exchange"
  | "reward"
  | "tax"
  | "purchase"
  | "sale"
  // Battle system
  | "battle_cost"
  | "battle_reward"
  | "medal_reward"
  // Training system
  | "training_cost"
  | "training_reward"
  // Company/Production system
  | "company_creation"
  | "production_cost"
  | "wage_payment"
  // Future features
  | "loan_disbursement"
  | "loan_repayment"
  | "interest_payment"
  | "interest_earned"
  // Admin operations
  | "admin_grant"
  | "admin_deduction"
  | "admin_burn";

// Transaction scope for analytics
export type TransactionScope = "personal" | "community" | "inter_community" | "global";

// Metadata interface for type safety
export interface TransactionMetadata {
  battle_id?: string;
  company_id?: string;
  listing_id?: string;
  recipe_id?: string;
  work_day?: number;
  exchange_rate?: number;
  resource_id?: string;
  quality_id?: string;
  quantity?: number;
  [key: string]: any; // Allow additional fields
}

// Service response interface
export interface TransactionResult {
  success: boolean;
  transaction_id?: string;
  amount?: number;
  new_balance?: number;
  error?: string;
  current_balance?: number;
  required?: number;
}

class EconomicTransactionService {
  private supabase;

  constructor() {
    this.supabase = createSupabaseBrowserClient();
  }

  /**
   * AUTO-DETERMINE SCOPE
   * Automatically sets scope based on transaction type
   */
  private determineScope(
    type: TransactionType,
    explicitScope?: TransactionScope
  ): TransactionScope {
    // If explicitly provided, use that
    if (explicitScope) return explicitScope;

    // Otherwise, determine from type
    switch (type) {
      // Global/System operations
      case "reward":
      case "medal_reward":
      case "battle_reward":
      case "admin_grant":
      case "admin_deduction":
      case "admin_burn":
        return "global";

      // Community operations
      case "tax":
      case "wage_payment":
      case "production_cost":
        return "community";

      // Inter-community (exchange, etc.)
      case "exchange":
        return "inter_community";

      // Default to personal
      default:
        return "personal";
    }
  }

  /**
   * CREDIT (Add money to a user)
   * Used for: rewards, wages, sales, etc.
   */
  async credit(
    userId: string,
    amount: number,
    type: TransactionType,
    metadata: TransactionMetadata = {},
    description?: string,
    scope?: TransactionScope
  ): Promise<TransactionResult> {
    const finalScope = this.determineScope(type, scope);

    try {
      const { data, error } = await this.supabase.rpc("add_gold_enhanced", {
        p_user_id: userId,
        p_amount: amount,
        p_transaction_type: type,
        p_description: description || null,
        p_metadata: metadata as any,
        p_scope: finalScope,
      });

      if (error) {
        console.error("Transaction credit error:", error);
        return {
          success: false,
          error: error.message,
        };
      }

      return data as TransactionResult;
    } catch (err) {
      console.error("Transaction credit exception:", err);
      return {
        success: false,
        error: err instanceof Error ? err.message : "Unknown error",
      };
    }
  }

  /**
   * DEBIT (Remove money from a user)
   * Used for: purchases, costs, fees, etc.
   */
  async debit(
    userId: string,
    amount: number,
    type: TransactionType,
    metadata: TransactionMetadata = {},
    description?: string,
    scope?: TransactionScope
  ): Promise<TransactionResult> {
    const finalScope = this.determineScope(type, scope);

    try {
      const { data, error } = await this.supabase.rpc("deduct_gold_enhanced", {
        p_user_id: userId,
        p_amount: amount,
        p_transaction_type: type,
        p_description: description || null,
        p_metadata: metadata as any,
        p_scope: finalScope,
      });

      if (error) {
        console.error("Transaction debit error:", error);
        return {
          success: false,
          error: error.message,
        };
      }

      return data as TransactionResult;
    } catch (err) {
      console.error("Transaction debit exception:", err);
      return {
        success: false,
        error: err instanceof Error ? err.message : "Unknown error",
      };
    }
  }

  /**
   * TRANSFER (Move money from one user to another)
   * Used for: P2P transfers, wages, etc.
   */
  async transfer(
    fromUserId: string,
    toUserId: string,
    amount: number,
    type: TransactionType,
    metadata: TransactionMetadata = {},
    description?: string,
    scope?: TransactionScope
  ): Promise<TransactionResult> {
    const finalScope = this.determineScope(type, scope);

    try {
      const { data, error } = await this.supabase.rpc("transfer_gold_enhanced", {
        p_from_user_id: fromUserId,
        p_to_user_id: toUserId,
        p_amount: amount,
        p_transaction_type: type,
        p_description: description || null,
        p_metadata: metadata as any,
        p_scope: finalScope,
      });

      if (error) {
        console.error("Transaction transfer error:", error);
        return {
          success: false,
          error: error.message,
        };
      }

      return data as TransactionResult;
    } catch (err) {
      console.error("Transaction transfer exception:", err);
      return {
        success: false,
        error: err instanceof Error ? err.message : "Unknown error",
      };
    }
  }

  /**
   * CREDIT COMMUNITY COIN
   * Add community currency to a user
   */
  async creditCommunityCoin(
    userId: string,
    communityCurrencyId: string,
    amount: number,
    type: TransactionType,
    metadata: TransactionMetadata = {},
    description?: string,
    scope?: TransactionScope
  ): Promise<TransactionResult> {
    const finalScope = this.determineScope(type, scope || "community");

    try {
      const { data, error } = await this.supabase.rpc("add_community_coin_enhanced", {
        p_user_id: userId,
        p_community_currency_id: communityCurrencyId,
        p_amount: amount,
        p_transaction_type: type,
        p_description: description || null,
        p_metadata: metadata as any,
        p_scope: finalScope,
      });

      if (error) {
        console.error("Community coin credit error:", error);
        return {
          success: false,
          error: error.message,
        };
      }

      return data as TransactionResult;
    } catch (err) {
      console.error("Community coin credit exception:", err);
      return {
        success: false,
        error: err instanceof Error ? err.message : "Unknown error",
      };
    }
  }

  /**
   * DEBIT COMMUNITY COIN
   * Remove community currency from a user
   */
  async debitCommunityCoin(
    userId: string,
    communityCurrencyId: string,
    amount: number,
    type: TransactionType,
    metadata: TransactionMetadata = {},
    description?: string,
    scope?: TransactionScope
  ): Promise<TransactionResult> {
    const finalScope = this.determineScope(type, scope || "community");

    try {
      const { data, error } = await this.supabase.rpc("deduct_community_coin_enhanced", {
        p_user_id: userId,
        p_community_currency_id: communityCurrencyId,
        p_amount: amount,
        p_transaction_type: type,
        p_description: description || null,
        p_metadata: metadata as any,
        p_scope: finalScope,
      });

      if (error) {
        console.error("Community coin debit error:", error);
        return {
          success: false,
          error: error.message,
        };
      }

      return data as TransactionResult;
    } catch (err) {
      console.error("Community coin debit exception:", err);
      return {
        success: false,
        error: err instanceof Error ? err.message : "Unknown error",
      };
    }
  }

  /**
   * GET USER BALANCE
   * Helper to get current gold balance
   */
  async getUserGoldBalance(userId: string): Promise<number> {
    try {
      const { data, error } = await this.supabase
        .from("user_wallets")
        .select("gold_coins")
        .eq("user_id", userId)
        .eq("currency_type", "gold")
        .single();

      if (error || !data) return 0;
      return Number(data.gold_coins);
    } catch {
      return 0;
    }
  }

  /**
   * GET USER COMMUNITY COIN BALANCE
   * Helper to get community currency balance
   */
  async getUserCommunityBalance(
    userId: string,
    communityCurrencyId: string
  ): Promise<number> {
    try {
      const { data, error } = await this.supabase
        .from("user_wallets")
        .select("community_coins")
        .eq("user_id", userId)
        .eq("community_currency_id", communityCurrencyId)
        .eq("currency_type", "community")
        .single();

      if (error || !data) return 0;
      return Number(data.community_coins);
    } catch {
      return 0;
    }
  }
}

// Export singleton instance
export const transactionService = new EconomicTransactionService();

// Export class for testing
export { EconomicTransactionService };
