import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { enqueuePostForProcessing } from "@/lib/worker";
import { updateMissionProgress } from "@/app/actions/missions";
import { extractMentionedUsernames, detectAgentMentions } from "@/lib/utils/mention-utils";
import { handleMentionEvent } from "@/lib/ai-system/triggers/event-handler";
import { HeatMiddleware } from "@/lib/heat-middleware";
import { recordCoherence } from "@/lib/ai-system/services/influence";
import { calculateCoherence, getPsychologyContext } from "@/lib/psychology";

// Regex to find @mentions
const MENTION_REGEX = /@(\w+)/g;

export async function POST(request: Request) {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json().catch(() => null);
  const content = typeof body?.content === "string" ? body.content.trim() : "";
  if (!content) return NextResponse.json({ error: "Content is required" }, { status: 400 });

  // Extract feed_type and community_id from request body
  const feed_type = typeof body?.feed_type === "string" ? body.feed_type : "world";
  const community_id = typeof body?.community_id === "string" ? body.community_id : null;

  // Validate feed_type
  const validFeedTypes = ["world", "community", "followers"];
  if (!validFeedTypes.includes(feed_type)) {
    return NextResponse.json({ error: "Invalid feed_type" }, { status: 400 });
  }

  // Validate community posts have community_id
  if (feed_type === "community" && !community_id) {
    return NextResponse.json({ error: "community_id required for community posts" }, { status: 400 });
  }

  const { data: profile } = await supabase.from("users").select("id, username").eq("auth_id", user.id).maybeSingle();
  if (!profile) return NextResponse.json({ error: "Profile not found" }, { status: 404 });

  // If community post, verify user is a member
  if (feed_type === "community" && community_id) {
    const { data: membership } = await supabase
      .from("community_members")
      .select("id")
      .eq("user_id", profile.id)
      .eq("community_id", community_id)
      .maybeSingle();

    if (!membership) {
      return NextResponse.json({ error: "Not a member of this community" }, { status: 403 });
    }
  }

  // Check heat before allowing post
  const heatCheck = await HeatMiddleware.checkHeat(profile.id);
  if (!heatCheck.allowed) {
    return NextResponse.json(
      { error: `Too many posts recently (heat: ${heatCheck.currentHeat}/100). Please wait ${Math.ceil(heatCheck.cooldownMinutes || 0)} minutes.` },
      { status: 429 }
    );
  }

  // Insert post with proper feed_type and community_id
  const { data: post, error } = await supabase
    .from("posts")
    .insert({
      content,
      user_id: profile.id,
      feed_type,
      community_id,
    })
    .select("id")
    .single();

  if (error || !post) {
    console.error("Post insert error:", error);
    return NextResponse.json({ error: "Unable to publish" }, { status: 400 });
  }

  try {
    await enqueuePostForProcessing(post.id, profile.id);
  } catch (error) {
    console.error("Enqueue worker error:", error);
  }

  // Apply psychology tracking for post
  try {
    // Apply heat
    await HeatMiddleware.applyHeat(profile.id, "POST", post.id);

    // Get user identity and psychology context
    const { data: userIdentity } = await supabaseAdmin
      .from("users")
      .select("identity_json")
      .eq("id", profile.id)
      .single();

    if (userIdentity?.identity_json) {
      const psychologyContext = await getPsychologyContext(profile.id);

      // For posts, we use the content to calculate coherence
      const coherence = calculateCoherence(userIdentity.identity_json, {
        action: "POST",
        activityScore: psychologyContext.activityScore,
        morale: psychologyContext.morale,
      });

      await recordCoherence(profile.id, coherence, "POST", {
        postId: post.id,
        contentLength: content.length,
      });
    }
  } catch (psychErr) {
    console.error("Psychology tracking error:", psychErr);
    // Don't fail the request if psychology tracking fails
  }

  // Process @mentions and create notifications
  try {
    const mentionMatches = Array.from(content.matchAll(MENTION_REGEX)) as RegExpExecArray[];
    if (mentionMatches.length > 0) {
      const usernames = mentionMatches.map((m) => m[1] as string);
      const uniqueUsernames = Array.from(new Set(usernames));

      // Find user IDs for mentioned usernames
      const { data: mentionedUsers } = await supabase
        .from("users")
        .select("id, username, is_bot")
        .in("username", uniqueUsernames);

      if (mentionedUsers && mentionedUsers.length > 0) {
        // Create notifications for each mentioned user
        const notifications = mentionedUsers
          .filter((mentionedUser) => mentionedUser.id !== profile.id) // Don't notify self
          .map((mentionedUser) => ({
            user_id: mentionedUser.id,
            type: "mention",
            title: `@${profile.username} mentioned you in a post`,
            body: content.substring(0, 100),
            mentioned_by_user_id: profile.id,
            action_url: `/feed`,
            metadata: {
              post_id: post.id,
              mentioned_by_username: profile.username,
              message_preview: content.substring(0, 80),
            },
            is_read: false,
            is_archived: false,
          }));

        // Insert notifications using admin client (bypasses RLS)
        if (notifications.length > 0) {
          const { error: notificationError } = await supabaseAdmin
            .from("notifications")
            .insert(notifications);

          if (notificationError) {
            console.error("Failed to create mention notifications:", notificationError);
            console.error("Notification data:", notifications);
          } else {
            console.log(`✅ Created ${notifications.length} mention notifications for post ${post.id}`);
          }
        }

        // Trigger workflows for mentioned agents
        const mentionedAgents = mentionedUsers.filter((user) => user.is_bot && user.id !== profile.id);

        if (mentionedAgents.length > 0) {
          console.log(`[Posts] Detected ${mentionedAgents.length} agent mention(s) in post`);

          for (const agent of mentionedAgents) {
            console.log(`[Posts] Triggering mention workflow for @${agent.username}`);

            // Trigger mention event workflow (fire and forget, don't wait)
            handleMentionEvent({
              mentionedAgentId: agent.id,
              mentionerUserId: profile.id,
              postId: post.id,
              mentionText: content,
            }).catch((error) => {
              console.error(`[Posts] Error triggering mention for @${agent.username}:`, error);
            });
          }
        }
      }
    }
  } catch (mentionErr) {
    console.error("Error processing mentions:", mentionErr);
  }

  // Award XP for post (non-blocking - fire and forget)
  (async () => {
    try {
      await supabase.rpc("award_xp", {
        p_user_id: profile.id,
        p_xp_amount: 50,
        p_source: "post",
        p_metadata: { post_id: post.id },
      });
    } catch (err) {
      console.error("XP award error:", err);
    }
  })();

  // Update weekly post mission (non-blocking) - pass userId directly
  updateMissionProgress("weekly-post", 1, profile.id).catch((err) => {
    console.error("Mission update error:", err);
  });

  return NextResponse.json({ postId: post.id });
}
