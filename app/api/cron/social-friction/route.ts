/**
 * SOCIAL FRICTION CRON JOB
 * Runs daily to apply morale impacts based on community ideology alignment
 *
 * This makes community ideology have REAL mechanical weight:
 * - Misaligned members lose morale over time
 * - Aligned members gain morale over time
 * - Leaders resist friction more than regular members
 */

import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { calculateSocialFriction } from "@/lib/ideology";
import { recordMoraleEvent } from "@/lib/morale";
import { IDEOLOGY_CONFIG } from "@/lib/ideology-config";

// Type definitions
interface CommunityMember {
  user_id: string;
  community_id: string;
  rank_tier: number;
  user: {
    identity_json: Record<string, number> | null;
    username: string;
  };
  community: {
    ideology_json: Record<string, number> | null;
    ideology_polarization_metrics: Record<string, any> | null;
    name: string;
  };
}

interface FrictionResult {
  userId: string;
  username: string;
  communityId: string;
  communityName: string;
  friction: number;
  moraleImpact: number;
  applied: boolean;
  error?: string;
}

export async function GET(request: Request) {
  const startTime = Date.now();

  try {
    // Verify authorization (cron secret)
    const authHeader = request.headers.get("authorization");
    if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    console.log("[Social Friction Cron] Starting...");

    // Fetch all active community members with identity and ideology data
    const { data: members, error: fetchError } = await supabaseAdmin
      .from("community_members")
      .select(`
        user_id,
        community_id,
        rank_tier,
        user:users!inner (
          identity_json,
          username
        ),
        community:communities!inner (
          ideology_json,
          ideology_polarization_metrics,
          name
        )
      `)
      .is("left_at", null) // Only active members
      .not("user.identity_json", "is", null) // Must have identity
      .not("community.ideology_json", "is", null); // Must have ideology

    if (fetchError) {
      console.error("[Social Friction Cron] Fetch error:", fetchError);
      return NextResponse.json(
        {
          success: false,
          error: "Failed to fetch community members",
          details: fetchError.message
        },
        { status: 500 }
      );
    }

    if (!members || members.length === 0) {
      console.log("[Social Friction Cron] No eligible members found");
      return NextResponse.json({
        success: true,
        communitiesProcessed: 0,
        membersProcessed: 0,
        moralImpactsApplied: 0,
        durationMs: Date.now() - startTime,
      });
    }

    console.log(`[Social Friction Cron] Processing ${members.length} members`);

    // Process each member
    const results: FrictionResult[] = [];
    let moralImpactsApplied = 0;

    for (const member of members as unknown as CommunityMember[]) {
      try {
        // Calculate social friction for this member
        const frictionMetrics = calculateSocialFriction(
          member.user.identity_json! as any,
          member.community.ideology_json! as any,
          (member.community.ideology_polarization_metrics || { overall: 0 }) as any,
          member.rank_tier
        );

        const result: FrictionResult = {
          userId: member.user_id,
          username: member.user.username,
          communityId: member.community_id,
          communityName: member.community.name,
          friction: frictionMetrics.friction,
          moraleImpact: frictionMetrics.moraleImpact,
          applied: false,
        };

        // Only apply morale changes if impact is non-zero
        if (Math.abs(frictionMetrics.moraleImpact) > 0.1) {
          // Round to integer for morale system
          const moraleChange = Math.round(frictionMetrics.moraleImpact);

          // Record the morale event
          const moraleResult = await recordMoraleEvent({
            userId: member.user_id,
            eventType: "community",
            eventTrigger: "social_friction",
            moraleChange,
            sourceCommunityId: member.community_id,
            metadata: {
              friction: frictionMetrics.friction,
              community_name: member.community.name,
              rank_tier: member.rank_tier,
              reason:
                frictionMetrics.friction < IDEOLOGY_CONFIG.socialFriction.wellAligned
                  ? "well_aligned"
                  : frictionMetrics.friction > IDEOLOGY_CONFIG.socialFriction.misaligned
                  ? "misaligned"
                  : "neutral",
            },
          });

          result.applied = moraleResult.success;
          if (moraleResult.success) {
            moralImpactsApplied++;
          } else {
            result.error = moraleResult.error;
          }
        }

        results.push(result);
      } catch (memberError) {
        console.error(
          `[Social Friction Cron] Error processing member ${member.user_id}:`,
          memberError
        );
        results.push({
          userId: member.user_id,
          username: member.user.username,
          communityId: member.community_id,
          communityName: member.community.name,
          friction: 0,
          moraleImpact: 0,
          applied: false,
          error: String(memberError),
        });
      }
    }

    // Calculate summary statistics
    const communitiesProcessed = new Set(results.map((r) => r.communityId)).size;
    const avgFriction =
      results.reduce((sum, r) => sum + r.friction, 0) / results.length;
    const avgMoraleImpact =
      results.reduce((sum, r) => sum + r.moraleImpact, 0) / results.length;

    const durationMs = Date.now() - startTime;

    console.log(`[Social Friction Cron] Complete:`, {
      communitiesProcessed,
      membersProcessed: results.length,
      moralImpactsApplied,
      avgFriction: avgFriction.toFixed(3),
      avgMoraleImpact: avgMoraleImpact.toFixed(2),
      durationMs,
    });

    return NextResponse.json({
      success: true,
      communitiesProcessed,
      membersProcessed: results.length,
      moralImpactsApplied,
      avgFriction: parseFloat(avgFriction.toFixed(3)),
      avgMoraleImpact: parseFloat(avgMoraleImpact.toFixed(2)),
      durationMs,
      // Include detailed results in development
      results: process.env.NODE_ENV === "development" ? results : undefined,
    });
  } catch (error) {
    console.error("[Social Friction Cron] Fatal error:", error);
    return NextResponse.json(
      {
        success: false,
        error: "Internal server error",
        details: String(error),
        durationMs: Date.now() - startTime,
      },
      { status: 500 }
    );
  }
}
