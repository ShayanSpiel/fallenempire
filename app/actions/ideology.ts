'use server'

/**
 * Server Actions for Ideology System
 *
 * API layer for frontend to interact with ideology calculations,
 * religion generation, and configuration.
 */

import { createSupabaseServerClient } from '@/lib/supabase-server'
import {
  calculateCommunityIdeology,
  calculatePolarization,
  interpretIdeology,
  calculateMemberAlignment,
  calculateMemberAlignmentSummary,
  IdentityVector,
  vectorFromJSON,
  CommunityIdeologyData,
  normalizePolarizationMetrics,
} from '@/lib/ideology'
import { generateReligion } from '@/lib/religion'
import type { CommunityReligion } from '@/lib/religion'

// ============================================================================
// GET COMMUNITY IDEOLOGY
// ============================================================================

/**
 * Fetch complete ideology data for a community
 */
export async function getCommunityIdeology(communityId: string): Promise<CommunityIdeologyData & {
  religion?: CommunityReligion | null
  memberCount: number
}> {
  const supabase = await createSupabaseServerClient()

  // Fetch community
  const { data: community, error: communityError } = await supabase
    .from('communities')
    .select(
      `
      id,
      name,
      governance_type,
      ideology_json,
      ideology_interpretation,
      ideology_polarization_metrics,
      last_ideology_update
    `
    )
    .eq('id', communityId)
    .single()

  if (communityError) throw communityError

  // Fetch members
  const { data: members, error: membersError } = await supabase
    .from('community_members')
    .select(
      `
      users:user_id (
        id,
        identity_json,
        identity_label
      ),
      rank_tier
    `
    )
    .eq('community_id', communityId)
    .is('left_at', null) // Active members only

  if (membersError) throw membersError

  // Fetch religion if exists
  const { data: religionRow } = await supabase
    .from('community_religions')
    .select('*')
    .eq('community_id', communityId)
    .single()

  // Parse ideologyJSON
  const ideology = vectorFromJSON((community.ideology_json || {}) as Record<string, number>)
  const interpretation =
    community.ideology_interpretation || interpretIdeology(ideology, community.governance_type)
  const polarizationMetrics = normalizePolarizationMetrics(
    community.ideology_polarization_metrics ?? null
  )

  return {
    ideology_json: ideology,
    interpretation,
    polarization_metrics: polarizationMetrics,
    last_ideology_update: community.last_ideology_update ? new Date(community.last_ideology_update) : new Date(),
    religion: religionRow ? mapReligionRow(religionRow) : undefined,
    memberCount: members?.length || 0,
  }
}

// ============================================================================
// GET MEMBER ALIGNMENT
// ============================================================================

/**
 * Calculate individual member alignment to community ideology
 */
export async function getMemberAlignment(userId: string, communityId: string) {
  const supabase = await createSupabaseServerClient()

  // Fetch member
  const { data: member, error: memberError } = await supabase
    .from('users')
    .select('identity_json')
    .eq('id', userId)
    .single()

  if (memberError) throw memberError

  // Fetch community ideology
  const { data: community, error: communityError } = await supabase
    .from('communities')
    .select('ideology_json')
    .eq('id', communityId)
    .single()

  if (communityError) throw communityError

  const memberIdentity = vectorFromJSON((member.identity_json || {}) as Record<string, number>)
  const communityIdeology = vectorFromJSON((community.ideology_json || {}) as Record<string, number>)

  const alignment = calculateMemberAlignment(memberIdentity, communityIdeology)

  return {
    userId,
    communityId,
    alignmentScore: alignment.alignmentScore,
    distance: alignment.distance,
    axisDetails: alignment.axisDetails,
  }
}

// ============================================================================
// GET ALL MEMBER ALIGNMENTS
// ============================================================================

/**
 * Get alignment scores for all members of a community
 */
export async function getCommunityMemberAlignments(
  communityId: string,
  options?: { limit?: number; offset?: number; includeAxisDetails?: boolean }
): Promise<{
  items: Array<{
    user_id: string
    username: string | null
    avatar_url: string | null
    rank_tier?: number | null
    alignmentScore: number
    distance: number
    axisDetails?: Record<string, unknown>
  }>
  totalCount: number
  offset: number
  limit: number
  hasMore: boolean
}> {
  try {
    const supabase = await createSupabaseServerClient()
    const limit = Math.max(1, Math.min(options?.limit ?? 10, 200))
    const offset = Math.max(0, options?.offset ?? 0)
    const includeAxisDetails = options?.includeAxisDetails ?? false

    // Fetch community ideology
    const { data: community, error: communityError } = await supabase
      .from('communities')
      .select('ideology_json')
      .eq('id', communityId)
      .single()

    if (communityError) {
      console.error("[getCommunityMemberAlignments] Community fetch error:", communityError)
      throw communityError
    }

    if (!community) {
      console.error("[getCommunityMemberAlignments] Community not found")
      return { items: [], totalCount: 0, offset, limit, hasMore: false }
    }

    // Fetch members with their identities and ranks (paginated)
    const {
      data: memberships,
      error: membershipsError,
      count: membershipsCount,
    } = await supabase
      .from('community_members')
      .select(
        `
        user_id,
        rank_tier,
        users:user_id (
          id,
          username,
          identity_json,
          avatar_url
        )
      `,
        { count: 'exact' }
      )
      .eq('community_id', communityId)
      .is('left_at', null)
      .order('rank_tier', { ascending: true })
      .range(offset, offset + limit - 1)

    if (membershipsError) {
      console.error("[getCommunityMemberAlignments] Members fetch error:", membershipsError)
      throw membershipsError
    }

    if (!memberships || memberships.length === 0) {
      console.warn("[getCommunityMemberAlignments] No members found for community:", communityId)
      return { items: [], totalCount: membershipsCount ?? 0, offset, limit, hasMore: false }
    }

    const communityIdeology = vectorFromJSON((community.ideology_json || {}) as Record<string, number>)

    const alignments = memberships
      .map(m => {
        const user = (m as any).users
        if (!user) {
          console.warn("[getCommunityMemberAlignments] User data missing for member:", m.user_id)
          return null
        }

        const memberIdentity = vectorFromJSON((user.identity_json || {}) as Record<string, number>)
        const alignment = includeAxisDetails
          ? calculateMemberAlignment(memberIdentity, communityIdeology)
          : calculateMemberAlignmentSummary(memberIdentity, communityIdeology)

        return {
          user_id: user.id,
          username: user.username,
          avatar_url: user.avatar_url,
          rank_tier: m.rank_tier,
          ...alignment,
        }
      })
      .filter(a => a !== null)
      .sort((a, b) => b.alignmentScore - a.alignmentScore) // Sort by alignment descending

    return {
      items: alignments,
      totalCount: membershipsCount ?? alignments.length,
      offset,
      limit,
      hasMore: membershipsCount != null ? offset + alignments.length < membershipsCount : false,
    }
  } catch (error) {
    console.error("[getCommunityMemberAlignments] Error:", error)
    // Return empty object instead of throwing - allows page to load
    return { items: [], totalCount: 0, offset: 0, limit: 0, hasMore: false }
  }
}

// ============================================================================
// RECALCULATE IDEOLOGY
// ============================================================================

/**
 * Force recalculation of community ideology
 * Called manually by sovereign or automatically on member changes
 */
export async function recalculateIdeology(communityId: string) {
  const supabase = await createSupabaseServerClient()
  const startTime = Date.now()

  // Verify user is sovereign of this community
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser()

  if (userError || !user) throw new Error('Not authenticated')

  // Convert auth ID to profile ID
  const { data: userProfile } = await supabase
    .from('users')
    .select('id')
    .eq('auth_id', user.id)
    .maybeSingle()

  if (!userProfile) throw new Error('User profile not found')

  const { data: membership, error: membershipError } = await supabase
    .from('community_members')
    .select('rank_tier')
    .eq('community_id', communityId)
    .eq('user_id', userProfile.id)
    .is('left_at', null)
    .maybeSingle()

  if (!membership || membership.rank_tier !== 0) {
    throw new Error('Only community sovereign can recalculate ideology')
  }

  // Fetch community and members
  const { data: community, error: communityError } = await supabase
    .from('communities')
    .select('id, name, governance_type, ideology_json, last_ideology_update')
    .eq('id', communityId)
    .single()

  if (communityError) throw communityError

  const { data: members, error: membersError } = await supabase
    .from('community_members')
    .select(
      `
      users:user_id (
        id,
        identity_json
      ),
      rank_tier
    `
    )
    .eq('community_id', communityId)
    .is('left_at', null)

  if (membersError) throw membersError

  // Prepare member data
  const memberData = (members || []).map((m: any) => ({
    id: m.users.id,
    identity_json: m.users.identity_json || {},
    rank_tier: m.rank_tier,
  }))

  // Fetch custom ideology calculation weights from community_ideology_inputs
  const { data: ideologyInputs } = await supabase
    .from('community_ideology_inputs')
    .select('inertia_weight, member_weight, action_weight, text_weight, event_weight')
    .eq('community_id', communityId)
    .maybeSingle()

  // Build weights object (use custom weights if available, otherwise defaults)
  const customWeights = ideologyInputs
    ? {
        inertia: ideologyInputs.inertia_weight,
        members: ideologyInputs.member_weight,
        actions: ideologyInputs.action_weight,
        text: ideologyInputs.text_weight,
      }
    : undefined

  // Calculate new ideology
  const previousIdeology = vectorFromJSON((community.ideology_json || {}) as Record<string, number>)

  const newIdeology = calculateCommunityIdeology({
    communityId,
    currentMembers: memberData,
    previousIdeology,
    governanceType: community.governance_type,
    weights: customWeights, // ✅ NOW PASSING CUSTOM WEIGHTS!
  })

  // Calculate polarization
  const memberVectors = memberData.map(m => vectorFromJSON(m.identity_json))
  const polarizationMetrics = calculatePolarization(memberVectors)

  // Generate interpretation
  const interpretation = interpretIdeology(newIdeology, community.governance_type)

  // Update database
  const { error: updateError } = await supabase
    .from('communities')
    .update({
      ideology_json: newIdeology,
      ideology_interpretation: interpretation,
      ideology_polarization_metrics: polarizationMetrics,
      last_ideology_update: new Date().toISOString(),
      last_ideology_recalc: new Date().toISOString(), // ✅ UPDATE DEBOUNCE TIMESTAMP
    })
    .eq('id', communityId)

  if (updateError) throw updateError

  const timeMs = Date.now() - startTime

  return {
    success: true,
    newIdeology,
    interpretation,
    polarization: polarizationMetrics,
    timeMs,
  }
}

// ============================================================================
// REGENERATE RELIGION
// ============================================================================

/**
 * Regenerate community religion (AI call)
 * Only sovereign can call this
 */
export async function regenerateReligion(communityId: string) {
  const supabase = await createSupabaseServerClient()

  // Verify user is sovereign
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser()

  if (userError || !user) throw new Error('Not authenticated')

  // Convert auth ID to profile ID
  const { data: userProfile } = await supabase
    .from('users')
    .select('id')
    .eq('auth_id', user.id)
    .maybeSingle()

  if (!userProfile) throw new Error('User profile not found')

  const { data: membership, error: membershipError } = await supabase
    .from('community_members')
    .select('rank_tier')
    .eq('community_id', communityId)
    .eq('user_id', userProfile.id)
    .is('left_at', null)
    .maybeSingle()

  if (!membership || membership.rank_tier !== 0) {
    throw new Error('Only community sovereign can regenerate religion')
  }

  // Fetch community
  const { data: community, error: communityError } = await supabase
    .from('communities')
    .select('id, name, governance_type, ideology_json')
    .eq('id', communityId)
    .single()

  if (communityError) throw communityError

  // Count members
  const { count: memberCount, error: countError } = await supabase
    .from('community_members')
    .select('id', { count: 'exact' })
    .eq('community_id', communityId)
    .is('left_at', null)

  if (countError) throw countError

  // Fetch existing religion
  const { data: existingReligion } = await supabase
    .from('community_religions')
    .select('*')
    .eq('community_id', communityId)
    .single()

  // Generate new religion
  const ideology = vectorFromJSON((community.ideology_json || {}) as Record<string, number>)

  const newReligion = await generateReligion({
    community_id: communityId,
    community_name: community.name,
    ideology_vector: ideology,
    governance_type: community.governance_type,
    member_count: memberCount || 0,
    previous_religion: existingReligion ? {
      ...existingReligion,
      ideology_snapshot: existingReligion.ideology_snapshot || {},
      created_at: new Date(existingReligion.created_at),
      last_updated: new Date(existingReligion.last_updated),
    } : undefined,
  })

  // Save to database
  const timestamp = new Date().toISOString()
  let savedReligionRow: Record<string, any> | null = null

  if (existingReligion) {
    const { data: updatedReligion, error: updateError } = await supabase
      .from('community_religions')
      .update({
        name: newReligion.name,
        short_description: newReligion.short_description,
        long_description: newReligion.long_description,
        ideology_snapshot: newReligion.ideology_snapshot,
        core_tenets: newReligion.core_tenets,
        sacred_values: newReligion.sacred_values,
        forbidden_actions: newReligion.forbidden_actions,
        last_updated: timestamp,
      })
      .eq('community_id', communityId)
      .select('*')
      .single()

    if (updateError || !updatedReligion) {
      throw updateError ?? new Error('Failed to update religion')
    }

    savedReligionRow = updatedReligion
  } else {
    const { data: insertedReligion, error: insertError } = await supabase
      .from('community_religions')
      .insert({
        community_id: communityId,
        name: newReligion.name,
        short_description: newReligion.short_description,
        long_description: newReligion.long_description,
        ideology_snapshot: newReligion.ideology_snapshot,
        core_tenets: newReligion.core_tenets,
        sacred_values: newReligion.sacred_values,
        forbidden_actions: newReligion.forbidden_actions,
        created_at: timestamp,
        last_updated: timestamp,
      })
      .select('*')
      .single()

    if (insertError || !insertedReligion) {
      throw insertError ?? new Error('Failed to create religion')
    }

    savedReligionRow = insertedReligion
  }

  if (!savedReligionRow) {
    throw new Error('Failed to save religion')
  }

  const finalReligion = mapReligionRow(savedReligionRow)

  return {
    success: true,
    religion: finalReligion,
  }
}

// ============================================================================
// UPDATE IDEOLOGY INPUTS
// ============================================================================

/**
 * Configure which data sources and weights feed into ideology calculation
 * Only sovereign can call this
 */
export async function updateIdeologyInputs(
  communityId: string,
  inputs: {
    include_member_vectors?: boolean
    include_leader_weight?: boolean
    include_action_history?: boolean
    include_community_bio?: boolean
    include_chat_history?: boolean
    include_law_proposals?: boolean
    inertia_weight?: number
    member_weight?: number
    action_weight?: number
    text_weight?: number
  }
) {
  const supabase = await createSupabaseServerClient()

  // Verify user is sovereign
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser()

  if (userError || !user) throw new Error('Not authenticated')

  // Convert auth ID to profile ID
  const { data: userProfile } = await supabase
    .from('users')
    .select('id')
    .eq('auth_id', user.id)
    .maybeSingle()

  if (!userProfile) throw new Error('User profile not found')

  const { data: membership, error: membershipError } = await supabase
    .from('community_members')
    .select('rank_tier')
    .eq('community_id', communityId)
    .eq('user_id', userProfile.id)
    .single()

  if (membershipError || !membership || membership.rank_tier !== 0) {
    throw new Error('Only community sovereign can update ideology inputs')
  }

  // Validate weights sum to approximately 1.0
  const weights = [inputs.inertia_weight, inputs.member_weight, inputs.action_weight, inputs.text_weight].filter(
    w => w !== undefined
  ) as number[]

  if (weights.length > 0) {
    const sum = weights.reduce((a, b) => a + b, 0)
    if (sum < 0.99 || sum > 1.01) {
      throw new Error('Weights must sum to approximately 1.0')
    }
  }

  // Update in database
  const { error: updateError } = await supabase
    .from('community_ideology_inputs')
    .update({
      ...inputs,
      updated_at: new Date().toISOString(),
    })
    .eq('community_id', communityId)

  if (updateError) throw updateError

  return { success: true }
}

// ============================================================================
// GET IDEOLOGY INPUTS
// ============================================================================

/**
 * Fetch current ideology calculation configuration for a community
 */
export async function getIdeologyInputs(communityId: string) {
  const supabase = await createSupabaseServerClient()

  const { data, error } = await supabase
    .from('community_ideology_inputs')
    .select('*')
    .eq('community_id', communityId)
    .single()

  if (error) {
    // Return defaults if not found
    return {
      community_id: communityId,
      include_member_vectors: true,
      include_leader_weight: true,
      include_action_history: true,
      include_community_bio: false,
      include_chat_history: false,
      include_law_proposals: false,
      inertia_weight: 0.4,
      member_weight: 0.3,
      action_weight: 0.2,
      text_weight: 0.1,
    }
  }

  return data
}

function mapReligionRow(row: Record<string, any>): CommunityReligion {
  return {
    id: row.id,
    community_id: row.community_id,
    name: row.name,
    short_description: row.short_description,
    long_description: row.long_description,
    core_tenets: row.core_tenets || [],
    sacred_values: row.sacred_values || [],
    forbidden_actions: row.forbidden_actions || [],
    ideology_snapshot: vectorFromJSON(row.ideology_snapshot || {}),
    created_at: row.created_at ? new Date(row.created_at) : new Date(),
    last_updated: row.last_updated ? new Date(row.last_updated) : new Date(),
  }
}

// ============================================================================
// DEBOUNCED IDEOLOGY RECALCULATION
// ============================================================================

/**
 * Recalculate community ideology with automatic debouncing
 * Prevents spam recalculations (max once per hour per community)
 * Used by automatic triggers (join/leave/rank change)
 *
 * @param communityId - Community ID to recalculate
 * @param force - Skip debouncing and force recalculation
 * @returns Result object or null if skipped due to debouncing
 */
export async function recalculateIdeologyDebounced(
  communityId: string,
  force: boolean = false
): Promise<{ success: boolean; skipped?: boolean; reason?: string } | null> {
  const supabase = await createSupabaseServerClient();

  try {
    // Check last recalculation time (debouncing)
    if (!force) {
      const { data: community } = await supabase
        .from('communities')
        .select('last_ideology_recalc')
        .eq('id', communityId)
        .single();

      if (community?.last_ideology_recalc) {
        const lastRecalc = new Date(community.last_ideology_recalc);
        const hoursSinceRecalc =
          (Date.now() - lastRecalc.getTime()) / (1000 * 60 * 60);

        // Skip if recalculated within last hour
        if (hoursSinceRecalc < 1) {
          console.log(
            `[Ideology] Skipping recalc for ${communityId} (${hoursSinceRecalc.toFixed(
              1
            )}h since last)`
          );
          return {
            success: true,
            skipped: true,
            reason: `Recalculated ${hoursSinceRecalc.toFixed(1)} hours ago`,
          };
        }
      }
    }

    // Perform background recalculation (no auth check needed for system triggers)
    const { data: community, error: communityError } = await supabase
      .from('communities')
      .select('id, name, governance_type, ideology_json, last_ideology_update')
      .eq('id', communityId)
      .single();

    if (communityError) throw communityError;

    const { data: members, error: membersError } = await supabase
      .from('community_members')
      .select(
        `
        users:user_id (
          id,
          identity_json
        ),
        rank_tier
      `
      )
      .eq('community_id', communityId)
      .is('left_at', null);

    if (membersError) throw membersError;

    // Prepare member data
    const memberData = (members || []).map((m: any) => ({
      id: m.users.id,
      identity_json: m.users.identity_json || {},
      rank_tier: m.rank_tier,
    }));

    // Fetch custom weights
    const { data: ideologyInputs } = await supabase
      .from('community_ideology_inputs')
      .select('inertia_weight, member_weight, action_weight, text_weight')
      .eq('community_id', communityId)
      .maybeSingle();

    const customWeights = ideologyInputs
      ? {
          inertia: ideologyInputs.inertia_weight,
          members: ideologyInputs.member_weight,
          actions: ideologyInputs.action_weight,
          text: ideologyInputs.text_weight,
        }
      : undefined;

    // Calculate new ideology
    const previousIdeology = vectorFromJSON(
      (community.ideology_json || {}) as Record<string, number>
    );

    const newIdeology = calculateCommunityIdeology({
      communityId,
      currentMembers: memberData,
      previousIdeology,
      governanceType: community.governance_type,
      weights: customWeights,
    });

    // Calculate polarization
    const memberVectors = memberData.map((m) => vectorFromJSON(m.identity_json));
    const polarizationMetrics = calculatePolarization(memberVectors);

    // Generate interpretation
    const interpretation = interpretIdeology(
      newIdeology,
      community.governance_type
    );

    // Update database with new recalc timestamp
    const { error: updateError } = await supabase
      .from('communities')
      .update({
        ideology_json: newIdeology,
        ideology_interpretation: interpretation,
        ideology_polarization_metrics: polarizationMetrics,
        last_ideology_update: new Date().toISOString(),
        last_ideology_recalc: new Date().toISOString(), // ✅ UPDATE DEBOUNCE TIMESTAMP
      })
      .eq('id', communityId);

    if (updateError) throw updateError;

    console.log(`[Ideology] Recalculated for ${community.name} (${communityId})`);

    return {
      success: true,
      skipped: false,
    };
  } catch (error) {
    console.error('[Ideology] Recalculation error:', error);
    return {
      success: false,
      reason: String(error),
    };
  }
}
