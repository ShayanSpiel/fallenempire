// Subscription System Types
// Centralized type definitions for the subscription system

// ============================================================================
// Database Enums (matching SQL migration)
// ============================================================================

export type SubscriptionTier = 'sigma' | 'omega';
export type UserTier = 'alpha' | 'sigma' | 'omega';
export type SubscriptionStatus = 'active' | 'cancelled' | 'expired' | 'pending';
export type PaymentProvider = 'buymeacoffee' | 'stripe' | 'manual' | 'other';

// ============================================================================
// Database Row Types
// ============================================================================

export interface Subscription {
  id: string;
  user_id: string;
  tier: SubscriptionTier;
  status: SubscriptionStatus;
  started_at: string;
  expires_at: string | null;
  last_payment_at: string | null;
  cancelled_at: string | null;
  months_subscribed: number;
  last_medal_awarded_at: string | null;
  payment_provider: PaymentProvider;
  provider_subscription_id: string | null;
  provider_customer_id: string | null;
  provider_metadata: Record<string, any>;
  created_at: string;
  updated_at: string;
}

export interface SubscriptionHistory {
  id: string;
  subscription_id: string;
  user_id: string;
  event_type: SubscriptionEventType;
  old_status: SubscriptionStatus | null;
  new_status: SubscriptionStatus | null;
  old_tier: SubscriptionTier | null;
  new_tier: SubscriptionTier | null;
  amount_paid: number | null;
  currency: string;
  notes: string | null;
  changed_by: string | null;
  created_at: string;
}

// ============================================================================
// Event Types
// ============================================================================

export type SubscriptionEventType =
  | 'created'
  | 'renewed'
  | 'cancelled'
  | 'expired'
  | 'upgraded'
  | 'downgraded'
  | 'medal_awarded';

// ============================================================================
// Tier Configuration
// ============================================================================

export interface TierConfig {
  tier: UserTier;
  name: string;
  displayName: string;
  price: number | null;
  currency: string;
  billingPeriod: 'monthly' | 'yearly';
  features: TierFeature[];
  badge: {
    color: string;
    gradient?: string;
    icon?: string;
  };
  medal: {
    key: 'sigma-supporter' | 'omega-supporter' | null;
    displayName: string;
  } | null;
}

export interface TierFeature {
  id: string;
  name: string;
  description: string;
  icon?: string;
  available: boolean;
  premium?: boolean;
}

// ============================================================================
// Tier Feature Constants
// ============================================================================

export const TIER_CONFIGS: Record<UserTier, TierConfig> = {
  alpha: {
    tier: 'alpha',
    name: 'Alpha',
    displayName: 'Alpha (Free)',
    price: null,
    currency: 'USD',
    billingPeriod: 'monthly',
    features: [
      {
        id: 'theme-cream',
        name: 'Cream Theme',
        description: 'Classic warm amber & orange theme',
        icon: 'palette',
        available: true,
      },
      {
        id: 'battlepass-free',
        name: 'Free Battle Pass',
        description: 'Access to free tier rewards',
        icon: 'trophy',
        available: true,
      },
      {
        id: 'theme-blue',
        name: 'Blue Theme',
        description: 'Cool blue dark theme',
        icon: 'palette',
        available: false,
        premium: true,
      },
      {
        id: 'theme-discord',
        name: 'Discord Theme',
        description: 'Neutral gray dark theme',
        icon: 'palette',
        available: false,
        premium: true,
      },
      {
        id: 'battlepass-keeper',
        name: 'Keeper Battle Pass',
        description: 'Premium rewards with 2x value',
        icon: 'crown',
        available: false,
        premium: true,
      },
      {
        id: 'supporter-medal',
        name: 'Supporter Medal',
        description: 'Exclusive monthly supporter medal',
        icon: 'shield',
        available: false,
        premium: true,
      },
    ],
    badge: {
      color: 'gray',
    },
    medal: null,
  },
  sigma: {
    tier: 'sigma',
    name: 'Sigma',
    displayName: 'Sigma',
    price: 9.9,
    currency: 'USD',
    billingPeriod: 'monthly',
    features: [
      {
        id: 'theme-cream',
        name: 'Cream Theme',
        description: 'Classic warm amber & orange theme',
        icon: 'palette',
        available: true,
      },
      {
        id: 'theme-blue',
        name: 'Blue Theme',
        description: 'Cool blue dark theme',
        icon: 'palette',
        available: true,
      },
      {
        id: 'battlepass-free',
        name: 'Free Battle Pass',
        description: 'Access to free tier rewards',
        icon: 'trophy',
        available: true,
      },
      {
        id: 'battlepass-keeper',
        name: 'Keeper Battle Pass',
        description: 'Premium rewards with 2x value',
        icon: 'crown',
        available: true,
        premium: true,
      },
      {
        id: 'sigma-badge',
        name: 'Sigma Badge',
        description: 'Blue verified badge shown on profile',
        icon: 'shield-check',
        available: true,
        premium: true,
      },
      {
        id: 'supporter-medal',
        name: 'Sigma Supporter Medal',
        description: 'Monthly supporter medal (grows with each month)',
        icon: 'shield',
        available: true,
        premium: true,
      },
      {
        id: 'theme-discord',
        name: 'Discord Theme',
        description: 'Neutral gray dark theme',
        icon: 'palette',
        available: false,
        premium: true,
      },
    ],
    badge: {
      color: 'blue',
      icon: 'shield-check',
    },
    medal: {
      key: 'sigma-supporter',
      displayName: 'Sigma Supporter',
    },
  },
  omega: {
    tier: 'omega',
    name: 'Omega',
    displayName: 'Omega',
    price: 14.9,
    currency: 'USD',
    billingPeriod: 'monthly',
    features: [
      {
        id: 'theme-cream',
        name: 'Cream Theme',
        description: 'Classic warm amber & orange theme',
        icon: 'palette',
        available: true,
      },
      {
        id: 'theme-blue',
        name: 'Blue Theme',
        description: 'Cool blue dark theme',
        icon: 'palette',
        available: true,
      },
      {
        id: 'theme-discord',
        name: 'Discord Theme',
        description: 'Neutral gray dark theme',
        icon: 'palette',
        available: true,
      },
      {
        id: 'battlepass-free',
        name: 'Free Battle Pass',
        description: 'Access to free tier rewards',
        icon: 'trophy',
        available: true,
      },
      {
        id: 'battlepass-keeper',
        name: 'Keeper Battle Pass',
        description: 'Premium rewards with 2x value',
        icon: 'crown',
        available: true,
        premium: true,
      },
      {
        id: 'omega-badge',
        name: 'Omega Badge',
        description: 'Golden premium badge with gradient',
        icon: 'crown',
        available: true,
        premium: true,
      },
      {
        id: 'supporter-medal',
        name: 'Omega Supporter Medal',
        description: 'Monthly supporter medal (grows with each month)',
        icon: 'shield',
        available: true,
        premium: true,
      },
    ],
    badge: {
      color: 'gold',
      gradient: 'from-yellow-400 to-orange-500',
      icon: 'crown',
    },
    medal: {
      key: 'omega-supporter',
      displayName: 'Omega Supporter',
    },
  },
};

// ============================================================================
// Helper Types
// ============================================================================

export interface UserSubscriptionStatus {
  hasActiveSubscription: boolean;
  tier: UserTier;
  subscriptionTier: SubscriptionTier | null;
  status: SubscriptionStatus | null;
  expiresAt: string | null;
  monthsSubscribed: number;
  canAccessKeeperPass: boolean;
  availableThemes: string[];
  supporterMedal: {
    hasMedal: boolean;
    medalKey: 'sigma-supporter' | 'omega-supporter' | null;
    monthCount: number;
  };
}

export interface CreateSubscriptionInput {
  userId: string;
  tier: SubscriptionTier;
  paymentProvider: PaymentProvider;
  providerSubscriptionId?: string;
  providerCustomerId?: string;
  amountPaid?: number;
  expiresAt?: string;
}

export interface UpdateSubscriptionInput {
  subscriptionId: string;
  status?: SubscriptionStatus;
  expiresAt?: string;
  tier?: SubscriptionTier;
  notes?: string;
  changedBy?: string;
}

export interface AwardMedalInput {
  userId: string;
  subscriptionId: string;
  tier: SubscriptionTier;
}

// ============================================================================
// Buy Me a Coffee Webhook Types
// ============================================================================

export interface BMCWebhookPayload {
  type: 'membership.started' | 'membership.renewed' | 'membership.cancelled';
  data: {
    supporter_name: string;
    supporter_email: string;
    support_id: string;
    membership_level_name: string;
    membership_level_id: string;
    amount: number;
    currency: string;
    timestamp: string;
    is_recurring: boolean;
  };
}

// ============================================================================
// Theme Access Helper
// ============================================================================

export const getAvailableThemes = (tier: UserTier): string[] => {
  const themeMap: Record<UserTier, string[]> = {
    alpha: ['cream-light'],
    sigma: ['cream-light', 'blue-dark'],
    omega: ['cream-light', 'blue-dark', 'discord-dark'],
  };
  return themeMap[tier] || themeMap.alpha;
};

// ============================================================================
// Tier Comparison Helper
// ============================================================================

export const getTierLevel = (tier: UserTier): number => {
  const levelMap: Record<UserTier, number> = {
    alpha: 0,
    sigma: 1,
    omega: 2,
  };
  return levelMap[tier] || 0;
};

export const canAccessFeature = (
  userTier: UserTier,
  requiredTier: UserTier
): boolean => {
  return getTierLevel(userTier) >= getTierLevel(requiredTier);
};
