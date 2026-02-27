"use server";

import type { SupabaseClient } from "@supabase/supabase-js";

import { createSupabaseServerClient } from "@/lib/supabase-server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import {
  getLawDefinition,
  getGovernanceRules,
  canProposeLaw,
  canVoteOnLaw,
  calculateExpiresAt,
  parseTimeToMilliseconds,
  shouldProposalPass,
  type GovernanceRules,
  type LawType,
} from "@/lib/governance/laws";
import { isSupabaseNetworkError } from "@/lib/utils";
import {
  notifyLawPassed,
  notifyLawRejected,
  notifyLawExpired,
  notifyLawProposed,
  notifyHeirAppointed,
  notifyBattleStarted,
} from "@/lib/services/community-notifications";

/**
 * Helper to get the authenticated user's profile ID
 */
async function getProfileId() {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");

  const { data: profile } = await supabase
    .from("users")
    .select("id")
    .eq("auth_id", user.id)
    .maybeSingle();

  if (!profile) throw new Error("Profile not found");
  return profile.id;
}

/**
 * Propose a new law in a community
 */
export async function proposeLawAction(
  communityId: string,
  lawType: LawType,
  metadata: Record<string, any>
) {
  const supabase = await createSupabaseServerClient();

  try {
    console.log("[proposeLawAction] Starting proposal:", { communityId, lawType, metadata });

    // Get current user's profile ID (not auth ID)
    const profileId = await getProfileId();
    console.log("[proposeLawAction] profileId:", profileId);

    // Get community and user's rank
    const { data: community, error: communityError } = await supabase
      .from("communities")
      .select("governance_type")
      .eq("id", communityId)
      .single();

    if (communityError) {
      console.error("[proposeLawAction] Community fetch error:", communityError);
      throw new Error(`Community not found: ${communityError.message}`);
    }

    if (!community) {
      throw new Error("Community not found");
    }

    console.log("[proposeLawAction] community:", community);

    const { data: member, error: memberError } = await supabase
      .from("community_members")
      .select("rank_tier")
      .eq("community_id", communityId)
      .eq("user_id", profileId)
      .maybeSingle();

    if (memberError) {
      console.error("[proposeLawAction] Member fetch error:", memberError);
      throw new Error(`Database error: ${memberError.message}`);
    }

    if (!member) {
      console.error("[proposeLawAction] User not a member");
      throw new Error("You are not a member of this community");
    }

    console.log("[proposeLawAction] member:", member);

    // Check if user can propose this law
    const canProp = canProposeLaw(lawType, community.governance_type, member.rank_tier);
    console.log("[proposeLawAction] canProposeLaw:", canProp, {
      lawType,
      governanceType: community.governance_type,
      rankTier: member.rank_tier
    });

    if (!canProp) {
      throw new Error(`You do not have permission to propose law: ${lawType}`);
    }

    // Validate metadata
    const lawDef = getLawDefinition(lawType);
    if (lawDef.requiresMetadata) {
      for (const field of lawDef.requiresMetadata) {
        if (!(field in metadata)) {
          throw new Error(`Missing required metadata field: ${field}`);
        }
      }
    }

    // MESSAGE_OF_THE_DAY cooldown window (one announcement per 24h)
    if (lawType === "MESSAGE_OF_THE_DAY") {
      const { data: recentAnnouncement } = await supabase
        .from("community_proposals")
        .select("created_at")
        .eq("community_id", communityId)
        .eq("law_type", "MESSAGE_OF_THE_DAY")
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      const lastCreatedAt = recentAnnouncement?.created_at
        ? new Date(recentAnnouncement.created_at).getTime()
        : null;
      const now = Date.now();
      const oneDayMs = 24 * 60 * 60 * 1000;
      if (lastCreatedAt && now - lastCreatedAt < oneDayMs) {
        throw new Error("Announcements can only be proposed once every 24 hours.");
      }
    }

    // Get governance rules
    const rules = getGovernanceRules(lawType, community.governance_type);
    const expiresAt = calculateExpiresAt(rules.timeToPass);
    const timeToPassMs = parseTimeToMilliseconds(rules.timeToPass);
    console.log("[proposeLawAction] expiresAt:", expiresAt);

    // Check for existing pending proposal of the same type
    // MESSAGE_OF_THE_DAY and DECLARE_WAR can have duplicates
    // Other laws cannot have duplicates
    if (lawType !== "MESSAGE_OF_THE_DAY" && lawType !== "DECLARE_WAR") {
      const { data: existingProposal } = await supabase
        .from("community_proposals")
        .select("id")
        .eq("community_id", communityId)
        .eq("law_type", lawType)
        .eq("status", "pending")
        .maybeSingle();

      if (existingProposal) {
        throw new Error(`A proposal for "${lawDef.label}" is already pending`);
      }
    }

    // Get proposer username for metadata (needed for CFC_ALLIANCE cross-community display)
    const { data: proposerData } = await supabase
      .from("users")
      .select("username")
      .eq("id", profileId)
      .maybeSingle();

    // Add proposer info to metadata for laws that need it
    const enrichedMetadata = {
      ...metadata,
      proposer_id: profileId,
      proposer_username: proposerData?.username || "Unknown",
    };

    // Create proposal
    console.log("[proposeLawAction] Creating proposal with:", {
      community_id: communityId,
      proposer_id: profileId,
      law_type: lawType,
      status: "pending",
      metadata: enrichedMetadata,
      expires_at: expiresAt.toISOString(),
    });

    const { data: proposal, error: proposalError } = await supabase
      .from("community_proposals")
      .insert({
        community_id: communityId,
        proposer_id: profileId,
        law_type: lawType,
        status: "pending",
        metadata: enrichedMetadata,
        expires_at: expiresAt.toISOString(),
      })
      .select("id")
      .single();

    if (proposalError) {
      console.error("[proposeLawAction] Proposal insert error:", proposalError);
      throw proposalError;
    }

    console.log("[proposeLawAction] Proposal created:", proposal);

    if (timeToPassMs === 0) {
      const nowIso = new Date().toISOString();
      const { error: autoResolveError } = await supabase
        .from("community_proposals")
        .update({
          status: "passed",
          resolved_at: nowIso,
          resolution_notes: "Instant rule auto-resolved",
        })
        .eq("id", proposal.id);

      if (autoResolveError) {
        console.error("[proposeLawAction] Instant resolution failed:", autoResolveError);
      } else {
        try {
          await executeLawAction(lawType, proposal.id, communityId);
        } catch (executionError) {
          console.error("[proposeLawAction] Failed to execute instant law:", executionError);
        }
      }
    }

    return proposal;
  } catch (error) {
    console.error("[proposeLawAction] Error:", error);
    throw error;
  }
}

/**
 * Vote on a proposal
 */
export async function voteOnProposalAction(
  proposalId: string,
  vote: "yes" | "no"
) {
  const supabase = await createSupabaseServerClient();

  try {
    // Get current user's profile ID (not auth ID)
    const profileId = await getProfileId();
    console.log("[voteOnProposalAction] profileId:", profileId);

    // Get proposal details
    const { data: proposal, error: proposalError } = await supabase
      .from("community_proposals")
      .select("community_id, law_type, status")
      .eq("id", proposalId)
      .single();

    if (proposalError) {
      console.error("[voteOnProposalAction] Proposal fetch error:", proposalError);
      throw new Error(`Proposal not found: ${proposalError.message}`);
    }

    if (!proposal) {
      throw new Error("Proposal not found");
    }

    console.log("[voteOnProposalAction] proposal:", proposal);

    if (proposal.status !== "pending") {
      throw new Error("This proposal is no longer open for voting");
    }

    // Get community and user's rank (use let for CFC_ALLIANCE reassignment)
    const { data: initialCommunity, error: communityError } = await supabase
      .from("communities")
      .select("governance_type")
      .eq("id", proposal.community_id)
      .single();

    if (communityError) {
      console.error("[voteOnProposalAction] Community fetch error:", communityError);
      throw new Error(`Community not found: ${communityError.message}`);
    }

    if (!initialCommunity) {
      throw new Error("Community not found");
    }

    let community = initialCommunity;
    console.log("[voteOnProposalAction] community:", community);

    // For CFC_ALLIANCE, check if user is a member of either the initiator or target community
    let member: { rank_tier: number } | null = null;
    let userCommunity: string | null = null;

    if (proposal.law_type === "CFC_ALLIANCE") {
      // Check initiator community
      const { data: initiatorMember } = await supabase
        .from("community_members")
        .select("rank_tier")
        .eq("community_id", proposal.community_id)
        .eq("user_id", profileId)
        .maybeSingle();

      if (initiatorMember) {
        member = initiatorMember;
        userCommunity = proposal.community_id;
      } else {
        // Check target community
        const { data: proposalData } = await supabase
          .from("community_proposals")
          .select("metadata")
          .eq("id", proposalId)
          .single();

        const targetCommunityId = proposalData?.metadata?.target_community_id;

        if (targetCommunityId) {
          const { data: targetMember } = await supabase
            .from("community_members")
            .select("rank_tier")
            .eq("community_id", targetCommunityId)
            .eq("user_id", profileId)
            .maybeSingle();

          if (targetMember) {
            member = targetMember;
            userCommunity = targetCommunityId;

            // Get target community governance for vote permission check
            const { data: targetCommunity } = await supabase
              .from("communities")
              .select("governance_type")
              .eq("id", targetCommunityId)
              .single();

            if (targetCommunity) {
              community = targetCommunity;
            }
          }
        }
      }
    } else {
      // For non-CFC laws, check only the proposal's community
      const { data: regularMember, error: memberError } = await supabase
        .from("community_members")
        .select("rank_tier")
        .eq("community_id", proposal.community_id)
        .eq("user_id", profileId)
        .maybeSingle();

      if (memberError) {
        console.error("[voteOnProposalAction] Member fetch error:", memberError);
        throw new Error(`Member lookup failed: ${memberError.message}`);
      }

      member = regularMember;
      userCommunity = proposal.community_id;
    }

    if (!member) {
      console.error("[voteOnProposalAction] User not a member of any relevant community");
      throw new Error("You are not a member of this community or the target community");
    }

    console.log("[voteOnProposalAction] member:", member, "community:", userCommunity);

    // Check if user can vote on this law
    const canVote = canVoteOnLaw(proposal.law_type as LawType, community.governance_type, member.rank_tier);
    console.log("[voteOnProposalAction] canVote:", canVote, {
      lawType: proposal.law_type,
      governanceType: community.governance_type,
      rankTier: member.rank_tier
    });

    if (!canVote) {
      throw new Error("You do not have permission to vote on this proposal");
    }

    // Insert vote
    console.log("[voteOnProposalAction] Inserting vote:", { proposalId, profileId, vote });
    const { error: voteError } = await supabase
      .from("proposal_votes")
      .insert({
        proposal_id: proposalId,
        user_id: profileId,
        vote,
      });

    if (voteError) {
      console.error("[voteOnProposalAction] Vote insert error:", voteError);
      // Check if it's a unique constraint violation
      if (voteError.code === "23505") {
        throw new Error("You have already voted on this proposal");
      }
      throw new Error(`Failed to record vote: ${voteError.message}`);
    }

    console.log("[voteOnProposalAction] Vote recorded successfully");
    await maybeResolveProposalEarly(proposalId, supabase);
    return { success: true };
  } catch (error) {
    console.error("[voteOnProposalAction] Error:", error);
    throw error;
  }
}

/**
 * Fast-track a proposal (only for sovereign in monarchies)
 */
export async function fastTrackProposalAction(proposalId: string) {
  const supabase = await createSupabaseServerClient();

  // Get current user's profile ID (not auth ID)
  const profileId = await getProfileId();

  // Get proposal
  const { data: proposal, error: proposalError } = await supabase
    .from("community_proposals")
    .select("community_id, law_type, status")
    .eq("id", proposalId)
    .single();

  if (proposalError || !proposal) {
    throw new Error("Proposal not found");
  }

  if (proposal.status !== "pending") {
    throw new Error("Proposal is not pending");
  }

  // Get community and check user is sovereign
  const { data: community, error: communityError } = await supabase
    .from("communities")
    .select("governance_type")
    .eq("id", proposal.community_id)
    .single();

  if (communityError || !community) {
    throw new Error("Community not found");
  }

  const { data: member, error: memberError } = await supabase
    .from("community_members")
    .select("rank_tier")
    .eq("community_id", proposal.community_id)
    .eq("user_id", profileId)
    .single();

  if (memberError || !member || member.rank_tier !== 0) {
    throw new Error("Only the sovereign can fast-track proposals");
  }

  // Check if law allows fast-tracking
  const rules = getGovernanceRules(proposal.law_type as LawType, community.governance_type);
  if (!rules.canFastTrack) {
    throw new Error("This law cannot be fast-tracked");
  }

  // Resolve the proposal immediately as passed
  const { error: updateError } = await supabase
    .from("community_proposals")
    .update({
      status: "passed",
      resolved_at: new Date().toISOString(),
      resolution_notes: "Fast-tracked by sovereign",
    })
    .eq("id", proposalId);

  if (updateError) {
    throw updateError;
  }

  // Execute the law
  await executeLawAction(proposal.law_type as LawType, proposalId, proposal.community_id);

  // Get law definition for notifications
  const lawDef = getLawDefinition(proposal.law_type as LawType);
  const lawLabel = lawDef?.label || proposal.law_type;

  // Get proposal metadata for proposer ID
  const { data: proposalData } = await supabase
    .from("community_proposals")
    .select("proposer_id")
    .eq("id", proposalId)
    .single();

  // Notify community members
  await notifyLawPassed(
    proposal.community_id,
    lawLabel,
    proposalId,
    proposalData?.proposer_id
  );

  return { success: true };
}

/**
 * Resolve expired proposals (call periodically via cron)
 */
export async function resolveExpiredProposalsAction() {
  const supabase = supabaseAdmin;

  // Get all expired pending proposals
  const { data: expiredProposals, error: fetchError } = await supabase
    .from("community_proposals")
    .select("id, community_id, law_type, metadata, status")
    .eq("status", "pending")
    .lte("expires_at", new Date().toISOString());

  if (fetchError) {
    throw fetchError;
  }

  if (!expiredProposals || expiredProposals.length === 0) {
    return { processed: 0 };
  }

  // For each proposal, check vote counts and resolve
  for (const proposal of expiredProposals) {
    // Get vote counts for this proposal
    const { data: votes, error: votesError } = await supabase
      .from("proposal_votes")
      .select("vote")
      .eq("proposal_id", proposal.id);

    if (votesError) continue;

    const yesVotes = votes?.filter((v: any) => v.vote === "yes").length || 0;
    const noVotes = votes?.filter((v: any) => v.vote === "no").length || 0;

    // Get community and governance type
    const { data: community } = await supabase
      .from("communities")
      .select("governance_type")
      .eq("id", proposal.community_id)
      .single();

    if (!community) continue;

    // Get number of eligible voters in this community
    const { data: members } = await supabase
      .from("community_members")
      .select("rank_tier")
      .eq("community_id", proposal.community_id);

    const rules = getGovernanceRules(proposal.law_type as LawType, community.governance_type);
    const eligibleVoters = members?.filter((m: any) =>
      rules.voteAccessRanks.includes(m.rank_tier)
    ).length || 0;

    // Check if proposal passes
    const passes = shouldProposalPass(
      yesVotes,
      noVotes,
      eligibleVoters,
      rules.passingCondition
    );

    // Determine if expired with no votes (true expiration) or just didn't pass
    const hasVotes = yesVotes > 0 || noVotes > 0;
    const status = passes ? "passed" : hasVotes ? "rejected" : "expired";
    const notes = passes
      ? `Proposal passed with ${yesVotes} yes votes`
      : hasVotes
      ? `Proposal rejected with ${yesVotes} yes votes and ${noVotes} no votes`
      : "Proposal expired with no votes";

    // Update proposal status
    const { error: updateError } = await supabase
      .from("community_proposals")
      .update({
        status,
        resolved_at: new Date().toISOString(),
        resolution_notes: notes,
      })
      .eq("id", proposal.id);

    if (updateError) continue;

    // Get law definition for notifications
    const lawDef = getLawDefinition(proposal.law_type as LawType);
    const lawLabel = lawDef?.label || proposal.law_type;

    // Execute law if passed
    if (passes) {
      try {
        await executeLawAction(
          proposal.law_type as LawType,
          proposal.id,
          proposal.community_id,
          supabase
        );

        // Notify community members
        await notifyLawPassed(
          proposal.community_id,
          lawLabel,
          proposal.id,
          proposal.metadata?.proposer_id
        );
      } catch (e) {
        // Log error but continue processing
        console.error(`Failed to execute law ${proposal.law_type}:`, e);
      }
    } else if (status === "rejected") {
      // Notify about rejection
      await notifyLawRejected(
        proposal.community_id,
        lawLabel,
        proposal.id,
        proposal.metadata?.proposer_id
      );
    } else {
      // Notify about expiration
      await notifyLawExpired(
        proposal.community_id,
        lawLabel,
        proposal.id,
        proposal.metadata?.proposer_id
      );
    }
  }

  return { processed: expiredProposals.length };
}

/**
 * Execute a law after it passes
 * This is called automatically when a proposal is resolved as "passed"
 */
async function executeLawAction(
  lawType: LawType,
  proposalId: string,
  communityId: string,
  supabaseClient?: SupabaseClient
) {
  const supabase = supabaseClient ?? (await createSupabaseServerClient());

  // Get proposal metadata
  const { data: proposal } = await supabase
    .from("community_proposals")
    .select("metadata")
    .eq("id", proposalId)
    .single();

  if (!proposal) {
    throw new Error("Proposal not found");
  }

  // Execute based on law type
  switch (lawType) {
    case "MESSAGE_OF_THE_DAY": {
      const title = proposal.metadata?.title ?? "Community Message";
      const content = proposal.metadata?.content ?? proposal.metadata?.message;
      if (!content) {
        throw new Error("Invalid metadata for MESSAGE_OF_THE_DAY");
      }

      // Update community with announcement
      const { error } = await supabase
        .from("communities")
        .update({
          announcement_title: title,
          announcement_content: content,
          announcement_updated_at: new Date().toISOString(),
        })
        .eq("id", communityId);

      if (error) {
        throw error;
      }
      break;
    }

    case "DECLARE_WAR": {
      const targetCommunityId = proposal.metadata?.target_community_id;
      if (!targetCommunityId) {
        throw new Error("Invalid metadata for DECLARE_WAR");
      }

      // Create community_conflict record
      const { error } = await supabase.from("community_conflicts").insert({
        initiator_community_id: communityId,
        target_community_id: targetCommunityId,
        status: "active",
        started_at: new Date().toISOString(),
      });

      if (error) {
        throw error;
      }

      // TODO: When actual battle is created (likely via RPC or trigger),
      // call notifyBattleStarted() with the battle ID and target community name.
      // This may need to be added in the battle creation logic (RPC function or
      // map attack handler) rather than here.

      break;
    }

    case "PROPOSE_HEIR": {
      const targetUserId = proposal.metadata?.target_user_id;
      if (!targetUserId) {
        throw new Error("Invalid metadata for PROPOSE_HEIR");
      }

      // Update heir designation (you'd need to add this field to communities table)
      const { error } = await supabase
        .from("communities")
        .update({ heir_id: targetUserId })
        .eq("id", communityId);

      if (error) {
        throw error;
      }

      // Get heir username for notification
      const { data: heirUser } = await supabase
        .from("users")
        .select("username")
        .eq("id", targetUserId)
        .single();

      if (heirUser) {
        await notifyHeirAppointed(
          communityId,
          heirUser.username,
          targetUserId,
          proposal.metadata?.proposer_id
        );
      }
      break;
    }

    case "CHANGE_GOVERNANCE": {
      const newGovernanceType = proposal.metadata?.new_governance_type;
      if (!newGovernanceType) {
        throw new Error("Invalid metadata for CHANGE_GOVERNANCE");
      }

      const { error } = await supabase
        .from("communities")
        .update({ governance_type: newGovernanceType })
        .eq("id", communityId);

      if (error) {
        throw error;
      }
      break;
    }

    case "WORK_TAX": {
      const taxRate = proposal.metadata?.tax_rate;
      if (typeof taxRate !== "number" || taxRate < 0 || taxRate > 1) {
        throw new Error("Invalid tax rate. Must be between 0 and 1 (e.g., 0.10 for 10%)");
      }

      const { error } = await supabase
        .from("communities")
        .update({ work_tax_rate: taxRate })
        .eq("id", communityId);

      if (error) {
        throw error;
      }
      break;
    }

    case "IMPORT_TARIFF": {
      const tariffRate = proposal.metadata?.tariff_rate;
      if (typeof tariffRate !== "number" || tariffRate < 0 || tariffRate > 1) {
        throw new Error("Invalid tariff rate. Must be between 0 and 1 (e.g., 0.15 for 15%)");
      }

      const { error } = await supabase
        .from("communities")
        .update({ import_tariff_rate: tariffRate })
        .eq("id", communityId);

      if (error) {
        throw error;
      }
      break;
    }

    case "CFC_ALLIANCE": {
      const targetCommunityId = proposal.metadata?.target_community_id;
      if (!targetCommunityId) {
        throw new Error("Invalid metadata for CFC_ALLIANCE");
      }

      // Check if alliance already exists
      const { data: existingAlliance } = await supabase
        .from("community_alliances")
        .select("id, status")
        .or(
          `and(initiator_community_id.eq.${communityId},target_community_id.eq.${targetCommunityId}),` +
          `and(initiator_community_id.eq.${targetCommunityId},target_community_id.eq.${communityId})`
        )
        .maybeSingle();

      if (existingAlliance && existingAlliance.status === "active") {
        throw new Error("Alliance already active with this community");
      }

      // Check max alliances limit (5) for initiator
      const { count: initiatorAlliances } = await supabase
        .from("community_alliances")
        .select("id", { count: "exact", head: true })
        .eq("status", "active")
        .or(`initiator_community_id.eq.${communityId},target_community_id.eq.${communityId}`);

      if (initiatorAlliances && initiatorAlliances >= 5) {
        throw new Error("Maximum of 5 active alliances reached");
      }

      // Check max alliances limit (5) for target
      const { count: targetAlliances } = await supabase
        .from("community_alliances")
        .select("id", { count: "exact", head: true })
        .eq("status", "active")
        .or(`initiator_community_id.eq.${targetCommunityId},target_community_id.eq.${targetCommunityId}`);

      if (targetAlliances && targetAlliances >= 5) {
        throw new Error("Target community has reached maximum of 5 active alliances");
      }

      // Get community names
      const { data: targetCommunity } = await supabase
        .from("communities")
        .select("name")
        .eq("id", targetCommunityId)
        .single();

      const { data: initiatorCommunity } = await supabase
        .from("communities")
        .select("name")
        .eq("id", communityId)
        .single();

      // Create alliance record in pending state (use admin client to bypass RLS)
      const { error: allianceError } = await supabaseAdmin
        .from("community_alliances")
        .insert({
          initiator_community_id: communityId,
          target_community_id: targetCommunityId,
          status: "pending_mutual_approval",
          initiator_proposal_id: proposalId,
        });

      if (allianceError) {
        console.error("[CFC_ALLIANCE] Failed to create pending alliance:", allianceError);
        throw allianceError;
      }

      // When both communities approve (determined by determineEarlyResolution), activate the alliance
      // Update the pending alliance to active status
      const { error: activationError } = await supabaseAdmin
        .from("community_alliances")
        .update({
          status: "active",
          activated_at: new Date().toISOString(),
        })
        .eq("initiator_community_id", communityId)
        .eq("target_community_id", targetCommunityId)
        .eq("status", "pending_mutual_approval");

      if (activationError) {
        console.error("[CFC_ALLIANCE] Failed to activate alliance:", activationError);
        throw activationError;
      }

      // Notify both communities
      await notifyLawPassed(
        communityId,
        `Alliance with ${targetCommunity?.name || "Unknown"} Activated`,
        proposalId,
        proposal.metadata?.proposer_id
      );

      await notifyLawPassed(
        targetCommunityId,
        `Alliance with ${initiatorCommunity?.name || "Unknown"} Activated`,
        proposalId,
        proposal.metadata?.proposer_id
      );
      break;
    }

    case "ISSUE_CURRENCY": {
      const goldAmount = proposal.metadata?.gold_amount;
      const conversionRate = proposal.metadata?.conversion_rate;

      if (typeof goldAmount !== "number" || goldAmount <= 0) {
        throw new Error("Invalid gold amount. Must be greater than 0");
      }

      if (typeof conversionRate !== "number" || conversionRate <= 0) {
        throw new Error("Invalid conversion rate. Must be greater than 0");
      }

      if (goldAmount > 1000000) {
        throw new Error("Gold amount cannot exceed 1,000,000");
      }

      // Call the issue_community_currency RPC function
      const { data: issuanceResult, error: issuanceError } = await supabase.rpc(
        "issue_community_currency",
        {
          p_community_id: communityId,
          p_gold_amount: goldAmount,
          p_conversion_rate: conversionRate,
          p_law_id: proposalId
        }
      );

      if (issuanceError || !issuanceResult?.success) {
        console.error("Currency issuance error:", issuanceError);
        throw new Error(issuanceError?.message || issuanceResult?.error || "Failed to issue currency");
      }

      // Get currency info for notification
      const { data: currencyInfo } = await supabase
        .from("community_currencies")
        .select("currency_symbol, currency_name")
        .eq("community_id", communityId)
        .single();

      // Notify community members about currency issuance
      await notifyLawPassed(
        communityId,
        `Currency Issued: ${issuanceResult.currency_issued} ${currencyInfo?.currency_symbol || "coins"}`,
        proposalId,
        proposal.metadata?.proposer_id
      );

      break;
    }
  }
}

interface EarlyResolutionResult {
  status?: "passed" | "rejected";
  reason?: string;
}

async function determineEarlyResolution(
  yesVotes: number,
  noVotes: number,
  eligibleVoters: number,
  rules: GovernanceRules,
  votes: any[],
  communityId: string,
  supabaseClient: SupabaseClient,
  lawType?: LawType,
  proposalMetadata?: any
): Promise<EarlyResolutionResult> {
  // Special handling for CFC_ALLIANCE - requires both communities to approve
  if (lawType === "CFC_ALLIANCE" && proposalMetadata?.target_community_id) {
    const targetCommunityId = proposalMetadata.target_community_id;

    // Get votes from both communities
    const initiatorVotes: any[] = [];
    const targetVotes: any[] = [];

    for (const vote of votes) {
      if (!vote.user_id) continue;

      // Check which community this voter belongs to
      const { data: initiatorMember } = await supabaseClient
        .from("community_members")
        .select("rank_tier")
        .eq("community_id", communityId)
        .eq("user_id", vote.user_id)
        .maybeSingle();

      if (initiatorMember) {
        initiatorVotes.push({ ...vote, rank_tier: initiatorMember.rank_tier });
        continue;
      }

      const { data: targetMember } = await supabaseClient
        .from("community_members")
        .select("rank_tier")
        .eq("community_id", targetCommunityId)
        .eq("user_id", vote.user_id)
        .maybeSingle();

      if (targetMember) {
        targetVotes.push({ ...vote, rank_tier: targetMember.rank_tier });
      }
    }

    // Get governance rules for both communities
    const { data: targetCommunity } = await supabaseClient
      .from("communities")
      .select("governance_type")
      .eq("id", targetCommunityId)
      .single();

    if (!targetCommunity) return {};

    const targetRules = getGovernanceRules("CFC_ALLIANCE", targetCommunity.governance_type);

    // Check if initiator community approved
    let initiatorApproved = false;
    let initiatorRejected = false;

    if (rules.passingCondition === "sovereign_only") {
      const sovereignVote = initiatorVotes.find(v => v.rank_tier === 0);
      if (sovereignVote?.vote === "yes") initiatorApproved = true;
      if (sovereignVote?.vote === "no") initiatorRejected = true;
    }

    // Check if target community approved
    let targetApproved = false;
    let targetRejected = false;

    if (targetRules.passingCondition === "sovereign_only") {
      const targetSovereignVote = targetVotes.find(v => v.rank_tier === 0);
      if (targetSovereignVote?.vote === "yes") targetApproved = true;
      if (targetSovereignVote?.vote === "no") targetRejected = true;
    }

    // Both communities must approve for alliance to pass
    if (initiatorApproved && targetApproved) {
      return {
        status: "passed",
        reason: "Both communities approved the alliance."
      };
    }

    // If either community rejected, alliance is rejected
    if (initiatorRejected || targetRejected) {
      return {
        status: "rejected",
        reason: "One or both communities rejected the alliance."
      };
    }

    return {};
  }

  // Handle sovereign_only for non-CFC laws
  if (rules.passingCondition === "sovereign_only") {
    // Check if the sovereign (rank 0) has voted
    let sovereignVote: "yes" | "no" | null = null;

    for (const vote of votes) {
      if (!vote.user_id) continue;

      // Get the user's rank in the community
      const { data: member } = await supabaseClient
        .from("community_members")
        .select("rank_tier")
        .eq("community_id", communityId)
        .eq("user_id", vote.user_id)
        .maybeSingle();

      if (member && member.rank_tier === 0) {
        sovereignVote = vote.vote;
        break;
      }
    }

    if (sovereignVote === "yes") {
      return { status: "passed", reason: "Sovereign vote approved the law." };
    }
    if (sovereignVote === "no") {
      return { status: "rejected", reason: "Sovereign rejected the law." };
    }
    return {};
  }

  // For other voting types, we need eligible voters
  if (eligibleVoters <= 0) {
    return {};
  }

  const majorityThreshold = Math.ceil(eligibleVoters / 2);
  const supermajorityThreshold = Math.ceil((eligibleVoters * 2) / 3);

  switch (rules.passingCondition) {

    case "majority_vote": {
      if (majorityThreshold <= 0) {
        return {};
      }
      if (yesVotes >= majorityThreshold) {
        return {
          status: "passed",
          reason: `Majority of eligible voters reached (${yesVotes}/${eligibleVoters}).`,
        };
      }
      const rejectionThreshold = eligibleVoters - majorityThreshold + 1;
      if (noVotes >= rejectionThreshold) {
        return {
          status: "rejected",
          reason: `Not enough remaining votes to reach majority (${noVotes} opposed).`,
        };
      }
      return {};
    }

    case "supermajority_vote": {
      if (supermajorityThreshold <= 0) {
        return {};
      }
      if (yesVotes >= supermajorityThreshold) {
        return {
          status: "passed",
          reason: `Supermajority reached (${yesVotes}/${eligibleVoters}).`,
        };
      }
      const rejectionThreshold = eligibleVoters - supermajorityThreshold + 1;
      if (noVotes >= rejectionThreshold) {
        return {
          status: "rejected",
          reason: "Opponents locked in a rejection before the timer expired.",
        };
      }
      return {};
    }

    case "unanimous":
      if (noVotes >= 1) {
        return {
          status: "rejected",
          reason: "A single opposing vote blocks unanimous passage.",
        };
      }
      if (yesVotes === eligibleVoters) {
        return {
          status: "passed",
          reason: "All eligible voters approved the law.",
        };
      }
      return {};

    default:
      return {};
  }
}

async function countEligibleVoters(
  communityId: string,
  rules: GovernanceRules,
  supabaseClient: SupabaseClient
): Promise<number> {
  if (!rules.voteAccessRanks || rules.voteAccessRanks.length === 0) {
    return 0;
  }

  const { count } = await supabaseClient
    .from("community_members")
    .select("rank_tier", { count: "exact", head: true })
    .eq("community_id", communityId)
    .in("rank_tier", rules.voteAccessRanks);

  return count ?? 0;
}

async function getProposalVoteCounts(
  proposalId: string,
  supabaseClient: SupabaseClient
): Promise<{ yesVotes: number; noVotes: number; votes: any[] }> {
  const { data: votes } = await supabaseClient
    .from("proposal_votes")
    .select("vote, user_id")
    .eq("proposal_id", proposalId);

  const yesVotes = votes?.filter((v: any) => v.vote === "yes").length || 0;
  const noVotes = votes?.filter((v: any) => v.vote === "no").length || 0;

  return { yesVotes, noVotes, votes: votes || [] };
}

async function maybeResolveProposalEarly(
  proposalId: string,
  supabaseClient: SupabaseClient
) {
  try {
    const { data: proposal, error: proposalError } = await supabaseClient
      .from("community_proposals")
      .select("community_id, law_type, status")
      .eq("id", proposalId)
      .single();

    if (proposalError || !proposal || proposal.status !== "pending") {
      return;
    }

    const { data: community, error: communityError } = await supabaseClient
      .from("communities")
      .select("governance_type")
      .eq("id", proposal.community_id)
      .single();

    if (communityError || !community) {
      return;
    }

    const rules = getGovernanceRules(
      proposal.law_type as LawType,
      community.governance_type
    );

    const eligibleVoters = await countEligibleVoters(
      proposal.community_id,
      rules,
      supabaseClient
    );

    if (eligibleVoters === 0 && rules.passingCondition !== "sovereign_only") {
      return;
    }

    const { yesVotes, noVotes, votes } = await getProposalVoteCounts(
      proposalId,
      supabaseClient
    );

    // Get proposal metadata for CFC alliance handling
    const { data: proposalWithMetadata } = await supabaseClient
      .from("community_proposals")
      .select("metadata")
      .eq("id", proposalId)
      .single();

    const resolution = await determineEarlyResolution(
      yesVotes,
      noVotes,
      eligibleVoters,
      rules,
      votes,
      proposal.community_id,
      supabaseClient,
      proposal.law_type as LawType,
      proposalWithMetadata?.metadata
    );

    if (!resolution.status) {
      return;
    }

    const resolvedAt = new Date().toISOString();

    const { error: updateError } = await supabaseClient
      .from("community_proposals")
      .update({
        status: resolution.status,
        resolved_at: resolvedAt,
        resolution_notes: resolution.reason ?? `Resolved early (${resolution.status}).`,
      })
      .eq("id", proposalId);

    if (updateError) {
      console.error("[maybeResolveProposalEarly] failed to update:", updateError);
      return;
    }

    // Get law definition for notifications
    const lawDef = getLawDefinition(proposal.law_type as LawType);
    const lawLabel = lawDef?.label || proposal.law_type;

    // Get proposal metadata for proposer ID
    const { data: proposalData } = await supabaseClient
      .from("community_proposals")
      .select("metadata, proposer_id")
      .eq("id", proposalId)
      .single();

    if (resolution.status === "passed") {
      // Try to execute law - if it fails, still notify but log error
      try {
        await executeLawAction(
          proposal.law_type as LawType,
          proposalId,
          proposal.community_id,
          supabaseClient
        );
      } catch (execError) {
        console.error("[maybeResolveProposalEarly] Law execution failed:", execError);
        // Continue to notify even if execution fails
        // The law can be executed manually later via cron or admin action
      }

      // Notify community members
      await notifyLawPassed(
        proposal.community_id,
        lawLabel,
        proposalId,
        proposalData?.proposer_id
      );
    } else if (resolution.status === "rejected") {
      // Notify about rejection
      await notifyLawRejected(
        proposal.community_id,
        lawLabel,
        proposalId,
        proposalData?.proposer_id
      );
    }
  } catch (err) {
    console.error("[maybeResolveProposalEarly] Error:", err);
  }
}

/**
 * Get proposal details with vote counts
 */
export async function getProposalDetailsAction(proposalId: string) {
  const supabase = await createSupabaseServerClient();

  const { data: proposal, error: proposalError } = await supabase
    .from("community_proposals")
    .select("*")
    .eq("id", proposalId)
    .single();

  if (proposalError || !proposal) {
    throw new Error("Proposal not found");
  }

  // Get vote counts
  const { data: votes } = await supabase
    .from("proposal_votes")
    .select("vote")
    .eq("proposal_id", proposalId);

  const yesVotes = votes?.filter((v) => v.vote === "yes").length || 0;
  const noVotes = votes?.filter((v) => v.vote === "no").length || 0;

  return {
    ...proposal,
    yesVotes,
    noVotes,
  };
}

/**
 * Get all proposals for a community
 */
export async function getCommunityActiveProposalsAction(communityId: string) {
  const supabase = await createSupabaseServerClient();

  try {
    // Fetch active proposals where:
    // 1. This community created the proposal, OR
    // 2. This community is the target of a CFC_ALLIANCE proposal
    const { data: proposals, error } = await supabase
      .from("community_proposals")
      .select(
        `*,
        users:proposer_id(username)`
      )
      .or(`community_id.eq.${communityId},and(law_type.eq.CFC_ALLIANCE,metadata->>target_community_id.eq.${communityId})`)
      .eq("status", "pending")
      .order("created_at", { ascending: false });

    if (error) {
      if (isSupabaseNetworkError(error)) {
        console.warn("[getCommunityActiveProposalsAction] Network error fetching proposals.");
        return [];
      }
      console.error("[getCommunityActiveProposalsAction] Fetch error:", error);
      return [];
    }

    if (!proposals || proposals.length === 0) return [];

    // Fetch votes for active proposals in one query (avoid nested vote arrays)
    const proposalIds = proposals.map((p: any) => p.id).filter(Boolean);
    const { data: votes, error: votesError } = await supabase
      .from("proposal_votes")
      .select("proposal_id, vote")
      .in("proposal_id", proposalIds);

    if (votesError && !isSupabaseNetworkError(votesError)) {
      console.warn("[getCommunityActiveProposalsAction] Vote fetch error:", votesError);
    }

    const voteCounts = new Map<string, { yesVotes: number; noVotes: number }>();
    for (const row of votes ?? []) {
      const key = (row as any).proposal_id as string;
      const vote = (row as any).vote as string;
      const current = voteCounts.get(key) ?? { yesVotes: 0, noVotes: 0 };
      if (vote === "yes") current.yesVotes += 1;
      if (vote === "no") current.noVotes += 1;
      voteCounts.set(key, current);
    }

    return proposals.map((proposal: any) => {
      const counts = voteCounts.get(proposal.id) ?? { yesVotes: 0, noVotes: 0 };
      const proposer_name = proposal.users?.username ?? "Unknown";

      return {
        ...proposal,
        yesVotes: counts.yesVotes,
        noVotes: counts.noVotes,
        proposer_name,
      };
    });
  } catch (error) {
    if (isSupabaseNetworkError(error as { message?: string; details?: string; code?: string })) {
      console.warn("[getCommunityActiveProposalsAction] Network error:", error);
      return [];
    }
    console.error("[getCommunityActiveProposalsAction] Error:", error);
    return [];
  }
}

export async function getCommunityResolvedProposalsAction(
  communityId: string,
  page: number = 1,
  pageSize: number = 10
): Promise<{
  items: any[]
  totalCount: number
  page: number
  pageSize: number
  hasMore: boolean
}> {
  const supabase = await createSupabaseServerClient();

  const safePageSize = Math.max(1, Math.min(pageSize, 50));
  const safePage = Math.max(1, page);
  const offset = (safePage - 1) * safePageSize;

  const { data, error, count } = await supabase
    .from("community_proposals")
    .select(
      `id, law_type, status, created_at, expires_at, resolved_at, proposer_id, metadata, users:proposer_id(username)`,
      { count: "exact" }
    )
    .eq("community_id", communityId)
    .in("status", ["passed", "rejected", "expired"])
    .order("resolved_at", { ascending: false, nullsFirst: false })
    .order("created_at", { ascending: false })
    .range(offset, offset + safePageSize - 1);

  if (error) {
    if (isSupabaseNetworkError(error)) {
      console.warn("[getCommunityResolvedProposalsAction] Network error:", error);
      return { items: [], totalCount: 0, page: safePage, pageSize: safePageSize, hasMore: false };
    }
    console.error("[getCommunityResolvedProposalsAction] Error:", error);
    return { items: [], totalCount: 0, page: safePage, pageSize: safePageSize, hasMore: false };
  }

  const totalCount = count ?? (data?.length ?? 0);
  const items = (data ?? []).map((proposal: any) => ({
    ...proposal,
    proposer_name: proposal.users?.username ?? "Unknown",
  }));

  return {
    items,
    totalCount,
    page: safePage,
    pageSize: safePageSize,
    hasMore: offset + items.length < totalCount,
  };
}

/**
 * Backwards-compatible wrapper (prefers active proposals only).
 */
export async function getCommunityProposalsAction(communityId: string) {
  return getCommunityActiveProposalsAction(communityId);
}
