/**
 * MORALE ACHIEVEMENTS SYSTEM
 * Awards medals and achievements based on morale milestones and behavior
 */

import { supabaseAdmin } from "./supabaseAdmin";

// ==================== MORALE ACHIEVEMENT DEFINITIONS ====================

export const MORALE_MEDALS = {
  // Morale Tier Achievements
  ETERNALLY_HAPPY: {
    medal_key: "eternally_happy",
    title: "Eternally Happy",
    description: "Maintained morale above 90 for 7 days",
    icon: "😇",
    rarity: "legendary",
    morale_threshold: 90,
    days_required: 7,
  },
  OPTIMIST: {
    medal_key: "optimist",
    title: "Optimist",
    description: "Reached morale 75 or higher",
    icon: "🌟",
    rarity: "epic",
    morale_threshold: 75,
  },
  CONTENT: {
    medal_key: "content",
    title: "Content",
    description: "Maintained stable morale around 50",
    icon: "😌",
    rarity: "common",
    morale_threshold: 50,
  },
  STRUGGLING: {
    medal_key: "struggling",
    title: "Struggling",
    description: "Recovered from morale below 30",
    icon: "💪",
    rarity: "rare",
    morale_threshold: 30,
  },
  REBELLIOUS: {
    medal_key: "rebellious",
    title: "Rebellious",
    description: "Entered rebellion state (morale < 20) but recovered",
    icon: "🔥",
    rarity: "epic",
    morale_threshold: 20,
  },

  // Action-Based Achievements
  PHILANTHROPIST: {
    medal_key: "philanthropist",
    title: "Philanthropist",
    description: "Performed 50 positive actions (trades, follows, likes)",
    icon: "🤝",
    rarity: "uncommon",
  },
  WARRIOR: {
    medal_key: "warrior",
    title: "Warrior",
    description: "Won 100 battles",
    icon: "⚔️",
    rarity: "rare",
  },
  PACIFIST: {
    medal_key: "pacifist",
    title: "Pacifist",
    description: "Never attacked anyone (50+ days)",
    icon: "☮️",
    rarity: "epic",
  },
  INFLUENCER: {
    medal_key: "influencer",
    title: "Influencer",
    description: "Gained 500 followers",
    icon: "📢",
    rarity: "uncommon",
  },

  // Morale Arc Achievements
  COMEBACK_ARTIST: {
    medal_key: "comeback_artist",
    title: "Comeback Artist",
    description: "Went from morale < 20 to > 60",
    icon: "🎬",
    rarity: "epic",
  },
  STEADY_HAND: {
    medal_key: "steady_hand",
    title: "Steady Hand",
    description: "Had morale variance < 10 for 30 days",
    icon: "🎯",
    rarity: "rare",
  },
  MOOD_SWINGER: {
    medal_key: "mood_swinger",
    title: "Mood Swinger",
    description: "Experienced 100+ morale events in a month",
    icon: "🎢",
    rarity: "uncommon",
  },

  // Community-Based Achievements
  BELOVED: {
    medal_key: "beloved",
    title: "Beloved",
    description: "Received 1000+ positive morale from community interactions",
    icon: "💖",
    rarity: "legendary",
  },
  LEADER: {
    medal_key: "leader",
    title: "Leader",
    description: "Led a community with average member morale > 70",
    icon: "👑",
    rarity: "epic",
  },
  TEAM_PLAYER: {
    medal_key: "team_player",
    title: "Team Player",
    description: "Participated in 50 community events",
    icon: "🤲",
    rarity: "uncommon",
  },

  // Special Achievements
  IMMORTAL: {
    medal_key: "immortal",
    title: "Immortal",
    description: "Played for 100+ days",
    icon: "♾️",
    rarity: "legendary",
  },
  LEGEND: {
    medal_key: "legend",
    title: "Legend",
    description: "Reached level 100",
    icon: "👹",
    rarity: "legendary",
  },
};

// ==================== ACHIEVEMENT CHECKING ====================

/**
 * Check and award morale-based achievements
 */
export async function checkMoraleAchievements(userId: string) {
  try {
    // Get user data
    const { data: user, error: userError } = await supabaseAdmin
      .from("users")
      .select("id, username, morale, current_level")
      .eq("id", userId)
      .single();

    if (userError || !user) return { awarded: 0 };

    let awarded = 0;

    // ETERNALLY_HAPPY: Check if morale has been > 90 for 7 days
    const { data: happyDays } = await supabaseAdmin
      .from("morale_events")
      .select("count")
      .eq("user_id", userId)
      .gt("morale_change", 0)
      .gt("created_at", new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString());

    if (user.morale >= 90) {
      if (await awardMedal(userId, "eternally_happy")) awarded++;
    }

    // OPTIMIST: Morale >= 75
    if (user.morale >= 75) {
      if (await awardMedal(userId, "optimist")) awarded++;
    }

    // STRUGGLING: Recovered from low morale
    const { data: hadLowMorale } = await supabaseAdmin
      .from("morale_events")
      .select("id")
      .eq("user_id", userId)
      .lt("new_morale", 30)
      .limit(1);

    if (hadLowMorale && hadLowMorale.length > 0 && user.morale >= 50) {
      if (await awardMedal(userId, "struggling")) awarded++;
    }

    // REBELLIOUS: Entered rebellion and recovered
    const { data: hadRebellion } = await supabaseAdmin
      .from("morale_events")
      .select("id")
      .eq("user_id", userId)
      .lt("new_morale", 20)
      .limit(1);

    if (hadRebellion && hadRebellion.length > 0 && user.morale >= 60) {
      if (await awardMedal(userId, "rebellious")) awarded++;
    }

    // LEGEND: Level 100
    if (user.current_level >= 100) {
      if (await awardMedal(userId, "legend")) awarded++;
    }

    return { awarded };
  } catch (error) {
    console.error("Failed to check morale achievements:", error);
    return { awarded: 0, error: String(error) };
  }
}

/**
 * Check and award action-based achievements
 */
export async function checkActionAchievements(userId: string) {
  try {
    // Get user victory count
    const { data: victories, error: victError } = await supabaseAdmin
      .from("morale_events")
      .select("count", { count: "exact" })
      .eq("user_id", userId)
      .eq("event_type", "battle_victory");

    if (!victError && victories && victories[0]?.count >= 100) {
      await awardMedal(userId, "warrior");
    }

    // Get positive actions count
    const { data: positiveActions, error: posError } = await supabaseAdmin
      .from("morale_events")
      .select("count", { count: "exact" })
      .eq("user_id", userId)
      .gt("morale_change", 0);

    if (!posError && positiveActions && positiveActions[0]?.count >= 50) {
      await awardMedal(userId, "philanthropist");
    }

    return { awarded: 0 };
  } catch (error) {
    console.error("Failed to check action achievements:", error);
    return { awarded: 0, error: String(error) };
  }
}

/**
 * Award a medal to a user (idempotent)
 */
export async function awardMedal(userId: string, medalKey: string): Promise<boolean> {
  try {
    // Check if user already has this medal
    const { data: existing } = await supabaseAdmin
      .from("user_medals")
      .select("id")
      .eq("user_id", userId)
      .eq("medal_key", medalKey)
      .single();

    if (existing) {
      return false; // Already awarded
    }

    // Award the medal
    const { error } = await supabaseAdmin.from("user_medals").insert({
      user_id: userId,
      medal_key: medalKey,
      awarded_at: new Date().toISOString(),
    });

    if (error) {
      // Check if table structure matches expected columns
      console.error("Failed to award medal:", error);
      return false;
    }

    return true;
  } catch (error) {
    console.error("Failed to award medal:", error);
    return false;
  }
}

/**
 * Get all medals for a user
 */
export async function getUserMedals(userId: string) {
  try {
    const { data: medals } = await supabaseAdmin
      .from("user_medals")
      .select("medal_key, awarded_at")
      .eq("user_id", userId)
      .order("awarded_at", { ascending: false });

    return medals || [];
  } catch (error) {
    console.error("Failed to get user medals:", error);
    return [];
  }
}

/**
 * Get medal details
 */
export function getMedalDetails(medalKey: string) {
  for (const medal of Object.values(MORALE_MEDALS)) {
    if (medal.medal_key === medalKey) {
      return medal;
    }
  }
  return null;
}

/**
 * Calculate morale score with medal bonuses
 * Each medal gives a small morale boost
 */
export async function calculateMoraleWithBonuses(userId: string): Promise<number> {
  try {
    // Get base morale
    const { data: user } = await supabaseAdmin
      .from("users")
      .select("morale")
      .eq("id", userId)
      .single();

    if (!user) return 50;

    // Get medal count
    const { data: medals } = await supabaseAdmin
      .from("user_medals")
      .select("count", { count: "exact" })
      .eq("user_id", userId);

    const medalCount = medals ? medals[0]?.count || 0 : 0;
    const medalBonus = Math.min(20, medalCount * 2); // Max +20 from medals

    return Math.min(100, user.morale + medalBonus);
  } catch (error) {
    console.error("Failed to calculate morale with bonuses:", error);
    return 50;
  }
}

/**
 * Get morale milestone progress for a user
 */
export async function getMoraleMilestoneProgress(userId: string) {
  try {
    const { data: user } = await supabaseAdmin
      .from("users")
      .select("morale")
      .eq("id", userId)
      .single();

    if (!user) return {};

    return {
      currentMorale: user.morale,
      nextMilestone: Math.ceil(user.morale / 10) * 10, // Round up to nearest 10
      progressToNext: ((user.morale % 10) / 10) * 100,
      optimalRange: [40, 60],
      inOptimalRange: user.morale >= 40 && user.morale <= 60,
    };
  } catch (error) {
    console.error("Failed to get morale milestone progress:", error);
    return {};
  }
}

/**
 * Batch award medals based on criteria
 */
export async function batchAwardMedals(criteria: {
  minMorale?: number;
  minLevel?: number;
  daysActive?: number;
  medalKey: string;
}): Promise<{ awarded: number; failed: number }> {
  try {
    let query = supabaseAdmin
      .from("users")
      .select("id");

    if (criteria.minMorale !== undefined) {
      query = query.gte("morale", criteria.minMorale);
    }
    if (criteria.minLevel !== undefined) {
      query = query.gte("current_level", criteria.minLevel);
    }

    const { data: users } = await query;

    if (!users) return { awarded: 0, failed: 0 };

    let awarded = 0;
    let failed = 0;

    for (const user of users) {
      if (await awardMedal(user.id, criteria.medalKey)) {
        awarded++;
      } else {
        failed++;
      }
    }

    return { awarded, failed };
  } catch (error) {
    console.error("Failed to batch award medals:", error);
    return { awarded: 0, failed: 0 };
  }
}

/**
 * Suggest next achievements for a user
 */
export async function getSuggestedAchievements(userId: string): Promise<string[]> {
  try {
    const { data: user } = await supabaseAdmin
      .from("users")
      .select("morale, current_level")
      .eq("id", userId)
      .single();

    if (!user) return [];

    const suggestions: string[] = [];

    // Based on current morale
    if (user.morale < 30) {
      suggestions.push("Get morale above 50 to earn 'Struggling'");
    } else if (user.morale < 75) {
      suggestions.push("Reach morale 75 to earn 'Optimist'");
    } else if (user.morale < 90) {
      suggestions.push("Reach morale 90 to earn 'Eternally Happy'");
    }

    // Based on level
    if (user.current_level < 100) {
      suggestions.push(`Reach level 100 to earn 'Legend' (currently ${user.current_level})`);
    }

    // Get user medals count
    const { data: medals } = await supabaseAdmin
      .from("user_medals")
      .select("count", { count: "exact" })
      .eq("user_id", userId);

    if (!medals || medals[0]?.count < 5) {
      suggestions.push("Earn more medals to unlock achievement bonuses");
    }

    return suggestions;
  } catch (error) {
    console.error("Failed to get suggested achievements:", error);
    return [];
  }
}
