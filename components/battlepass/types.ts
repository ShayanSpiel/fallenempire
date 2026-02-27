export interface BattlePassSeason {
  id: string;
  name: string;
  season_number: number;
  start_date: string;
  end_date: string;
  xp_per_tier: number;
  total_tiers: number;
}

export interface BattlePassTier {
  id: string;
  tier_number: number;
  tier_type: "free" | "keeper";
  reward_type: "gold" | "food" | "ticket" | "resource";
  reward_amount: number;
  reward_data: {
    resource_key?: string;
    quality_key?: string;
    icon_name?: string;
  };
}

export interface BattlePassProgress {
  total_xp: number;
  current_tier: number;
  has_keeper_pass: boolean;
  last_daily_login_date: string | null;
}

export interface ClaimedReward {
  tier_number: number;
  tier_type: "free" | "keeper";
  claimed_at: string;
}

export interface BattlePassData {
  success: boolean;
  season: BattlePassSeason;
  progress: BattlePassProgress;
  tiers: BattlePassTier[];
  claimed_rewards: ClaimedReward[];
}
