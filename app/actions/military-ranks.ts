'use server';

import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { createSupabaseServerClient } from '@/lib/supabase-server';
import { calculateMilitaryRankScore, getRankByScore, updateWinStreak } from '@/lib/military-ranks';

export async function recordBattleParticipation(
  userId: string,
  battleId: string,
  side: 'attacker' | 'defender',
  damageDealt: number
) {
  const supabase = supabaseAdmin;

  try {
    const resolvedUserId = await resolveUserId(userId);
    if (!resolvedUserId) {
      return { success: false, error: "User profile not found" };
    }

    type ParticipationUpdate = {
      total_damage_dealt: number;
      highest_damage_battle: number;
      battles_fought: number;
      current_military_rank: string;
      military_rank_score: number;
    };

    // Call RPC to accumulate damage and return updated stats
    const { data, error } = await supabase.rpc('record_battle_participation' as any, {
      p_user_id: resolvedUserId,
      p_battle_id: battleId,
      p_side: side,
      p_damage: damageDealt
    });

    if (error) {
      console.error('Error recording battle participation:', error);
      return { success: false, error: error.message };
    }

    const stats = Array.isArray(data) ? data?.[0] : data;

    return {
      success: true,
      stats: stats
        ? {
            total_damage_dealt: Number(stats.total_damage_dealt ?? 0),
            highest_damage_battle: Number(stats.highest_damage_battle ?? 0),
            battles_fought: Number(stats.battles_fought ?? 0),
            current_military_rank: stats.current_military_rank || 'Recruit',
            military_rank_score: Number(stats.military_rank_score ?? 0)
          }
        : undefined
    };
  } catch (error) {
    console.error('Error in recordBattleParticipation:', error);
    return { success: false, error: String(error) };
  }
}

async function resolveUserId(candidateId: string): Promise<string | null> {
  const { data: existing } = await supabaseAdmin
    .from("users")
    .select("id")
    .or(`id.eq.${candidateId},auth_id.eq.${candidateId}`)
    .maybeSingle();

  if (existing?.id) {
    return existing.id;
  }

  const fallbackUsername = `player-${candidateId.slice(0, 5)}`;
  const { data: inserted, error: insertError } = await supabaseAdmin
    .from("users")
    .insert({
      username: fallbackUsername,
      auth_id: candidateId,
      email: null,
      is_bot: false,
    })
    .select("id")
    .single();

  if (insertError) {
    console.error("Failed to create missing user profile:", insertError);
    const { data: retry } = await supabaseAdmin
      .from("users")
      .select("id")
      .or(`id.eq.${candidateId},auth_id.eq.${candidateId}`)
      .maybeSingle();
    return retry?.id ?? null;
  }

  return inserted?.id ?? null;
}

export async function updateBattleStats(
  userId: string,
  battleId: string,
  damageDealt: number,
  won: boolean
) {
  const supabase = supabaseAdmin;

  try {
    const resolvedUserId = await resolveUserId(userId);
    if (!resolvedUserId) {
      return { success: false, error: "User profile not found" };
    }

    // Get current user stats
    const { data: user, error: userError } = await supabase
      .from('users')
      .select(
        'battles_fought, battles_won, total_damage_dealt, highest_damage_battle, win_streak, last_battle_win'
      )
      .eq('id', resolvedUserId)
      .single();

    if (userError) {
      console.error('Error fetching user stats:', userError);
      return { success: false, error: userError.message };
    }

    // Update battle participant record with battle outcome
    const { error: participantError } = await supabase
      .from('battle_participants')
      .update({ won })
      .eq('user_id', resolvedUserId)
      .eq('battle_id', battleId);

    if (participantError) {
      console.error('Error updating battle participant:', participantError);
    }

    // Calculate new stats
    const newBattlesFought = (user.battles_fought || 0) + 1;
    const newBattlesWon = (user.battles_won || 0) + (won ? 1 : 0);
    const newTotalDamage = (user.total_damage_dealt || 0) + damageDealt;
    const newHighestDamage = Math.max(user.highest_damage_battle || 0, damageDealt);

    // Update win streak
    const newWinStreak = updateWinStreak(won, user.win_streak || 0);

    // Get battle hero medals count for this user
    const battleHeroMedalId = await getMedalIdByKey('battle_hero');
    let battleHeroMedalCount = 0;

    if (battleHeroMedalId) {
      const { data: medals, error: medalError } = await supabase
        .from('user_medals')
        .select('id')
        .eq('user_id', userId)
        .eq('medal_id', battleHeroMedalId);

      if (medalError) {
        console.error('Error fetching battle hero medals:', medalError);
      }

      battleHeroMedalCount = medals?.length || 0;
    } else {
      console.warn('battle_hero medal not found in database');
    }

    // Calculate new military rank score
    const newRankScore = calculateMilitaryRankScore(
      newTotalDamage,
      newBattlesWon,
      battleHeroMedalCount,
      newWinStreak,
      newBattlesFought
    );

    const newRank = getRankByScore(newRankScore);

    // Get old rank for comparison
    const { data: userBefore } = await supabase
      .from('users')
      .select('current_military_rank')
      .eq('id', userId)
      .single();

    const oldRank = userBefore?.current_military_rank;
    const hasRankUp = oldRank !== newRank.rank;

    // Update user stats
    const { error: updateError } = await supabase
      .from('users')
      .update({
        battles_fought: newBattlesFought,
        battles_won: newBattlesWon,
        total_damage_dealt: newTotalDamage,
        highest_damage_battle: newHighestDamage,
        win_streak: newWinStreak,
        last_battle_win: won,
        current_military_rank: newRank.rank,
        military_rank_score: newRankScore
      })
      .eq('id', userId);

    if (updateError) {
      console.error('Error updating user stats:', updateError);
      return { success: false, error: updateError.message };
    }

    return {
      success: true,
      stats: {
        battles_fought: newBattlesFought,
        battles_won: newBattlesWon,
        total_damage_dealt: newTotalDamage,
        highest_damage_battle: newHighestDamage,
        win_streak: newWinStreak,
        current_military_rank: newRank.rank,
        military_rank_score: newRankScore,
        hasRankUp,
        oldRank,
        newRank: newRank.rank
      }
    };
  } catch (error) {
    console.error('Error in updateBattleStats:', error);
    return { success: false, error: String(error) };
  }
}

async function getMedalIdByKey(key: string): Promise<string | null> {
  const supabase = supabaseAdmin;
  const { data, error } = await supabase
    .from('medals')
    .select('id')
    .eq('key', key)
    .single();

  if (error) return null;
  return data?.id || null;
}

export async function getUserMilitaryStats(userId: string) {
  const supabase = await createSupabaseServerClient();

  try {
    const { data, error } = await supabase
      .from('users')
      .select(
        'battles_fought, battles_won, total_damage_dealt, highest_damage_battle, win_streak, current_military_rank, military_rank_score'
      )
      .eq('id', userId)
      .single();

    if (error) {
      console.error('Error fetching military stats:', error);
      return null;
    }

    return data;
  } catch (error) {
    console.error('Error in getUserMilitaryStats:', error);
    return null;
  }
}

export async function getBattleParticipants(battleId: string) {
  const supabase = await createSupabaseServerClient();

  try {
    const { data, error } = await supabase
      .from('battle_participants')
      .select('user_id, side, damage_dealt, won')
      .eq('battle_id', battleId);

    if (error) {
      console.error('Error fetching battle participants:', error);
      return [];
    }

    return data || [];
  } catch (error) {
    console.error('Error in getBattleParticipants:', error);
    return [];
  }
}
