/**
 * PSYCHOLOGY UPDATER
 * Batch updates for Mental Power moving average
 */

import { supabaseAdmin } from "@/lib/supabaseAdmin";

/**
 * Update Mental Power moving average for a single user
 * Calls the database function get_mental_power_moving_average()
 */
export async function updateUserMentalPower(userId: string): Promise<number> {
  try {
    // Get MP moving average from database function
    const { data: mp, error } = await supabaseAdmin.rpc(
      "get_mental_power_moving_average",
      { p_user_id: userId }
    );

    if (error) {
      console.error(`Error calculating MP for user ${userId}:`, error);
      return 50; // Return default if calculation fails
    }

    const mentalPower = mp ?? 50;

    // Update user's canonical column
    const { error: updateError } = await supabaseAdmin
      .from("users")
      .update({ power_mental: mentalPower })
      .eq("id", userId);

    if (updateError) {
      console.error(`Error updating MP for user ${userId}:`, updateError);
      return mentalPower;
    }

    return mentalPower;
  } catch (error) {
    console.error(`Unexpected error updating MP for user ${userId}:`, error);
    return 50;
  }
}

/**
 * Batch update Mental Power for active users
 * "Active" = users with at least minActions actions in the last hoursBack hours
 */
export async function batchUpdateMentalPower(options: {
  minActions?: number;
  hoursBack?: number;
  limit?: number;
}): Promise<{
  success: boolean;
  usersUpdated: number;
  errors: number;
  results: Array<{ userId: string; mentalPower: number }>;
}> {
  const { minActions = 10, hoursBack = 1, limit = 1000 } = options;

  try {
    // Find active users (users with recent action_records)
    const cutoffTime = new Date();
    cutoffTime.setHours(cutoffTime.getHours() - hoursBack);

    const { data: activeUsers, error: queryError } = await supabaseAdmin
      .from("action_records")
      .select("user_id")
      .gte("created_at", cutoffTime.toISOString())
      .limit(limit * 10); // Over-fetch since we'll filter

    if (queryError) {
      console.error("Error querying active users:", queryError);
      return {
        success: false,
        usersUpdated: 0,
        errors: 1,
        results: [],
      };
    }

    if (!activeUsers || activeUsers.length === 0) {
      console.log("No active users found in the last hour");
      return {
        success: true,
        usersUpdated: 0,
        errors: 0,
        results: [],
      };
    }

    // Count actions per user and filter by minActions
    const userActionCounts = new Map<string, number>();
    for (const record of activeUsers) {
      const count = userActionCounts.get(record.user_id) || 0;
      userActionCounts.set(record.user_id, count + 1);
    }

    const eligibleUsers = Array.from(userActionCounts.entries())
      .filter(([, count]) => count >= minActions)
      .map(([userId]) => userId)
      .slice(0, limit);

    console.log(
      `Found ${eligibleUsers.length} eligible users with ${minActions}+ actions in last ${hoursBack}h`
    );

    // Update MP for each eligible user
    const results: Array<{ userId: string; mentalPower: number }> = [];
    let errors = 0;

    for (const userId of eligibleUsers) {
      const mp = await updateUserMentalPower(userId);
      if (mp === 50 && userActionCounts.get(userId)! >= minActions) {
        // If MP is still 50 despite activity, might be an error
        errors++;
      }
      results.push({ userId, mentalPower: mp });
    }

    console.log(
      `MP batch update complete: ${eligibleUsers.length} users, ${errors} errors`
    );

    return {
      success: true,
      usersUpdated: eligibleUsers.length,
      errors,
      results,
    };
  } catch (error) {
    console.error("Unexpected error in batch MP update:", error);
    return {
      success: false,
      usersUpdated: 0,
      errors: 1,
      results: [],
    };
  }
}

/**
 * Clean up old coherence_history records
 * Keeps only the last N records per user to prevent table bloat
 */
export async function cleanupCoherenceHistory(keepLastN: number = 50): Promise<{
  success: boolean;
  deletedCount: number;
}> {
  try {
    // Delete old coherence records, keeping only the last N per user
    const { error } = await supabaseAdmin.rpc("cleanup_old_coherence_history", {
      p_keep_last_n: keepLastN,
    });

    if (error) {
      // If RPC doesn't exist, create a simpler cleanup
      console.warn("cleanup_old_coherence_history RPC not found, skipping cleanup");
      return { success: false, deletedCount: 0 };
    }

    console.log(`Cleaned up old coherence history, keeping last ${keepLastN} per user`);
    return { success: true, deletedCount: 0 };
  } catch (error) {
    console.error("Error cleaning up coherence history:", error);
    return { success: false, deletedCount: 0 };
  }
}

// ============================================================================
// IDENTITY UPDATE SYSTEM
// ============================================================================

/**
 * Update identity for a single user based on recent observations
 * Aggregates AI observations and applies capped shifts
 */
export async function updateUserIdentity(
  userId: string,
  options: {
    minObservations?: number;
    hoursBack?: number;
    maxShift?: number;
  } = {}
): Promise<{
  success: boolean;
  updated: boolean;
  previousIdentity?: any;
  newIdentity?: any;
  observationCount?: number;
}> {
  const { minObservations = 5, hoursBack = 24, maxShift = 0.1 } = options;

  try {
    // Aggregate recent identity observations
    const { data: aggregation, error: aggregationError } = await supabaseAdmin.rpc(
      "aggregate_identity_observations",
      {
        p_user_id: userId,
        p_limit: 20,
        p_hours_back: hoursBack,
      }
    );

    if (aggregationError) {
      console.error(`Error aggregating observations for user ${userId}:`, aggregationError);
      return { success: false, updated: false };
    }

    const observationCount = aggregation?.count || 0;

    // Check if we have enough observations
    if (observationCount < minObservations) {
      console.log(
        `User ${userId}: Not enough observations (${observationCount}/${minObservations})`
      );
      return {
        success: true,
        updated: false,
        observationCount,
      };
    }

    const averagedVector = aggregation?.averaged_vector;
    if (!averagedVector) {
      console.log(`User ${userId}: No averaged vector available`);
      return { success: true, updated: false, observationCount };
    }

    // Apply identity update with capped shift
    const { data: updateResult, error: updateError } = await supabaseAdmin.rpc(
      "apply_identity_update",
      {
        p_user_id: userId,
        p_new_identity_vector: averagedVector,
        p_max_shift: maxShift,
      }
    );

    if (updateError) {
      console.error(`Error applying identity update for user ${userId}:`, updateError);
      return { success: false, updated: false, observationCount };
    }

    console.log(
      `User ${userId}: Identity updated based on ${observationCount} observations`
    );

    return {
      success: true,
      updated: true,
      previousIdentity: updateResult?.previous_identity,
      newIdentity: updateResult?.new_identity,
      observationCount,
    };
  } catch (error) {
    console.error(`Unexpected error updating identity for user ${userId}:`, error);
    return { success: false, updated: false };
  }
}

/**
 * Batch update identities for active users
 * "Active" = users with recent identity observations
 */
export async function batchUpdateIdentities(options: {
  minObservations?: number;
  hoursBack?: number;
  maxShift?: number;
  limit?: number;
}): Promise<{
  success: boolean;
  usersChecked: number;
  usersUpdated: number;
  errors: number;
  results: Array<{
    userId: string;
    updated: boolean;
    observationCount: number;
  }>;
}> {
  const { minObservations = 5, hoursBack = 24, maxShift = 0.1, limit = 100 } = options;

  try {
    // Find users with recent observations
    const cutoffTime = new Date();
    cutoffTime.setHours(cutoffTime.getHours() - hoursBack);

    const { data: recentObservations, error: queryError } = await supabaseAdmin
      .from("identity_observations")
      .select("observed_id")
      .gte("created_at", cutoffTime.toISOString())
      .limit(limit * 10); // Over-fetch since we'll filter

    if (queryError) {
      console.error("Error querying recent observations:", queryError);
      return {
        success: false,
        usersChecked: 0,
        usersUpdated: 0,
        errors: 1,
        results: [],
      };
    }

    if (!recentObservations || recentObservations.length === 0) {
      console.log("No recent identity observations found");
      return {
        success: true,
        usersChecked: 0,
        usersUpdated: 0,
        errors: 0,
        results: [],
      };
    }

    // Count observations per user
    const userObservationCounts = new Map<string, number>();
    for (const record of recentObservations) {
      const count = userObservationCounts.get(record.observed_id) || 0;
      userObservationCounts.set(record.observed_id, count + 1);
    }

    const eligibleUsers = Array.from(userObservationCounts.entries())
      .filter(([, count]) => count >= minObservations)
      .map(([userId]) => userId)
      .slice(0, limit);

    console.log(
      `Found ${eligibleUsers.length} users with ${minObservations}+ observations in last ${hoursBack}h`
    );

    // Update identity for each eligible user
    const results: Array<{
      userId: string;
      updated: boolean;
      observationCount: number;
    }> = [];
    let errors = 0;
    let usersUpdated = 0;

    for (const userId of eligibleUsers) {
      const updateResult = await updateUserIdentity(userId, {
        minObservations,
        hoursBack,
        maxShift,
      });

      if (!updateResult.success) {
        errors++;
      } else if (updateResult.updated) {
        usersUpdated++;
      }

      results.push({
        userId,
        updated: updateResult.updated,
        observationCount: updateResult.observationCount || 0,
      });
    }

    console.log(
      `Identity batch update complete: ${eligibleUsers.length} checked, ${usersUpdated} updated, ${errors} errors`
    );

    return {
      success: true,
      usersChecked: eligibleUsers.length,
      usersUpdated,
      errors,
      results,
    };
  } catch (error) {
    console.error("Unexpected error in batch identity update:", error);
    return {
      success: false,
      usersChecked: 0,
      usersUpdated: 0,
      errors: 1,
      results: [],
    };
  }
}

/**
 * Clean up old identity observations
 * Keeps only recent observations to prevent table bloat
 */
export async function cleanupIdentityObservations(
  keepLastN: number = 100,
  olderThanDays: number = 30
): Promise<{
  success: boolean;
  deletedCount: number;
}> {
  try {
    const { data: deletedCount, error } = await supabaseAdmin.rpc(
      "cleanup_old_identity_observations",
      {
        p_keep_last_n: keepLastN,
        p_older_than_days: olderThanDays,
      }
    );

    if (error) {
      console.error("Error cleaning up identity observations:", error);
      return { success: false, deletedCount: 0 };
    }

    console.log(
      `Cleaned up ${deletedCount || 0} old identity observations (keeping last ${keepLastN}, older than ${olderThanDays} days)`
    );
    return { success: true, deletedCount: deletedCount || 0 };
  } catch (error) {
    console.error("Unexpected error cleaning up identity observations:", error);
    return { success: false, deletedCount: 0 };
  }
}
