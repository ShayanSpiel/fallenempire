import { NextResponse } from "next/server";

import { createSupabaseServerClient } from "@/lib/supabase-server";
import { updateMissionProgress } from "@/app/actions/missions";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { NotificationType } from "@/lib/types/notifications";
import { HeatMiddleware } from "@/lib/heat-middleware";
import { recordCoherence } from "@/lib/ai-system/services/influence";
import { calculateCoherence, getPsychologyContext } from "@/lib/psychology";
import { applyActionMorale } from "@/lib/morale";
import { addRage } from "@/lib/battle-mechanics/rage";

export async function POST(request: Request) {
  const supabase = await createSupabaseServerClient({ canSetCookies: true });
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const postId = typeof body?.postId === "string" ? body.postId : null;
  const newType = typeof body?.type === "string" ? body.type : "like";

  if (!postId || (newType !== "like" && newType !== "dislike")) {
    return NextResponse.json({ error: "postId and a valid reaction type (like/dislike) are required" }, { status: 400 });
  }

  const { data: profile, error: profileError } = await supabase
    .from("users")
    .select("id, username")
    .eq("auth_id", user.id)
    .maybeSingle();

  if (profileError) {
    return NextResponse.json({ error: profileError.message }, { status: 400 });
  }

  if (!profile) {
    return NextResponse.json({ error: "Profile not found" }, { status: 404 });
  }

  // Check heat before allowing reaction
  const heatCheck = await HeatMiddleware.checkHeat(profile.id);
  if (!heatCheck.allowed) {
    return NextResponse.json(
      { error: `Too many reactions recently (heat: ${heatCheck.currentHeat}/100). Please wait ${Math.ceil(heatCheck.cooldownMinutes || 0)} minutes.` },
      { status: 429 }
    );
  }

  const { data: existingReaction } = await supabase
    .from("post_reactions")
    .select("id, type")
    .eq("post_id", postId)
    .eq("user_id", profile.id)
    .maybeSingle();

  let liked = false;
  let disliked = false;
  let shouldCountForMission = false;

  if (existingReaction) {
    if (existingReaction.type === newType) {
      // User is toggling OFF the same reaction (like -> none, or dislike -> none)
      await supabase.from("post_reactions").delete().eq("id", existingReaction.id);
      // Don't count this as engagement
    } else {
      // User is switching reactions (like -> dislike, or dislike -> like)
      await supabase.from("post_reactions").update({ type: newType }).eq("id", existingReaction.id);
      if (newType === "like") liked = true;
      if (newType === "dislike") disliked = true;
      // Count this as engagement since it's a new action
      shouldCountForMission = true;
    }
  } else {
    // User is adding a NEW reaction
    const { error: insertError } = await supabase.from("post_reactions").insert({
      post_id: postId,
      user_id: profile.id,
      type: newType,
    });

    if (insertError) {
      return NextResponse.json({ error: insertError.message }, { status: 400 });
    }
    if (newType === "like") liked = true;
    if (newType === "dislike") disliked = true;
    // Count this as engagement
    shouldCountForMission = true;
  }

  // Update engagement mission for ANY new action (non-blocking) - pass userId directly
  if (shouldCountForMission) {
    updateMissionProgress("weekly-engage", 1, profile.id).catch((err) => {
      console.error("Mission update error:", err);
    });
  }

  // Apply psychology tracking for new reactions
  if (shouldCountForMission) {
    try {
      // Apply heat
      await HeatMiddleware.applyHeat(profile.id, newType === "like" ? "LIKE" : "DISLIKE", postId);

      // Get user identity and psychology context
      const { data: userIdentity } = await supabaseAdmin
        .from("users")
        .select("identity_json")
        .eq("id", profile.id)
        .single();

      if (userIdentity?.identity_json) {
        const psychologyContext = await getPsychologyContext(profile.id);
        const coherence = calculateCoherence(userIdentity.identity_json, {
          action: newType === "like" ? "LIKE" : "DISLIKE",
          activityScore: psychologyContext.activityScore,
          morale: psychologyContext.morale,
        });

        await recordCoherence(profile.id, coherence, newType === "like" ? "LIKE" : "DISLIKE", {
          postId,
          reactionType: newType,
        });
      }

      if (liked || disliked) {
        await applyActionMorale(profile.id, liked ? "LIKE" : "DISLIKE");
      }

      if (disliked) {
        await addRage(profile.id, "dislike", { post_id: postId });
      }
    } catch (psychErr) {
      console.error("Psychology tracking error:", psychErr);
      // Don't fail the request if psychology tracking fails
    }
  }

  // Notify post author when receiving a new reaction (exclude self-reactions)
  try {
    if (shouldCountForMission && (liked || disliked)) {
      const { data: post } = await supabase
        .from("posts")
        .select("id, user_id, content")
        .eq("id", postId)
        .maybeSingle();

      if (post?.user_id && post.user_id !== profile.id) {
        const notifType = liked ? NotificationType.POST_LIKE : NotificationType.POST_DISLIKE;
        const actionVerb = liked ? "liked" : "disliked";

        const { error: notifError } = await supabaseAdmin.from("notifications").insert([
          {
            user_id: post.user_id,
            type: notifType,
            title: `${profile.username ?? "Someone"} ${actionVerb} your post`,
            body: typeof post.content === "string" ? post.content.substring(0, 160) : null,
            triggered_by_user_id: profile.id,
            action_url: "/feed",
            metadata: {
              post_id: postId,
              reactor_username: profile.username,
            },
            is_read: false,
            is_archived: false,
          },
        ]);

        if (notifError) {
          console.error("Failed to create reaction notification:", notifError);
        }
      }
    }
  } catch (notifErr) {
    console.error("Error creating reaction notification:", notifErr);
  }

  const { count: likeCount } = await supabase
    .from("post_reactions")
    .select("id", { count: "exact", head: true })
    .eq("post_id", postId)
    .eq("type", "like");

  const { count: dislikeCount } = await supabase
    .from("post_reactions")
    .select("id", { count: "exact", head: true })
    .eq("post_id", postId)
    .eq("type", "dislike");

  return NextResponse.json({
    liked,
    disliked,
    likeCount: likeCount ?? 0,
    dislikeCount: dislikeCount ?? 0,
  });
}
