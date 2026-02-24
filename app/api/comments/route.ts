import { NextResponse } from "next/server";

import { createSupabaseServerClient } from "@/lib/supabase-server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { updateMissionProgress } from "@/app/actions/missions";
import { NotificationType } from "@/lib/types/notifications";
import { detectAgentMentions } from "@/lib/utils/mention-utils";
import { handleMentionEvent } from "@/lib/ai-system/triggers/event-handler";
import { HeatMiddleware } from "@/lib/heat-middleware";
import { recordCoherence } from "@/lib/ai-system/services/influence";
import { calculateCoherence, getPsychologyContext } from "@/lib/psychology";

const MAX_COMMENT_FETCH = 50;

// Regex to find @mentions
const MENTION_REGEX = /@(\w+)/g;

type CommentRow = {
  id: string;
  content: string;
  created_at: string;
  is_agent: boolean;
  user_id: string | null;
};

type CommentUser = {
  id: string;
  auth_id: string | null;
  username: string | null;
  identity_label: string | null;
  avatar_url: string | null;
};

function mergeUsersWithComments(
  rows: CommentRow[],
  usersById: Map<string, CommentUser>,
  usersByAuthId: Map<string, CommentUser>
) {
  return rows.map((row) => {
    const userInfo =
      (row.user_id ? usersById.get(row.user_id) : null) ??
      (row.user_id ? usersByAuthId.get(row.user_id) : null);
    return {
      id: row.id,
      content: row.content,
      created_at: row.created_at,
      is_agent: row.is_agent,
      user: row.user_id
        ? {
            id: userInfo?.id ?? row.user_id,
            username: userInfo?.username ?? null,
            identityLabel: userInfo?.identity_label ?? null,
            avatarUrl: userInfo?.avatar_url ?? null,
          }
        : null,
    };
  });
}

export async function GET(request: Request) {
  const supabase = await createSupabaseServerClient({ canSetCookies: true });
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const url = new URL(request.url);
  const postId = url.searchParams.get("postId");

  if (!postId) {
    return NextResponse.json({ error: "postId is required" }, { status: 400 });
  }

  const { data: comments, error } = await supabase
    .from("comments")
    .select(
      `
      id,
      content,
      created_at,
      is_agent,
      user_id
    `
    )
    .eq("post_id", postId)
    .order("created_at", { ascending: true })
    .limit(MAX_COMMENT_FETCH);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  const rows = (comments ?? []) as CommentRow[];
  const userIds = Array.from(
    new Set(rows.map((row) => row.user_id).filter((value): value is string => Boolean(value)))
  );

  const usersById = new Map<string, CommentUser>();
  const usersByAuthId = new Map<string, CommentUser>();

  if (userIds.length) {
      const { data: usersData } = await supabase
        .from("users")
        .select("id, auth_id, username, identity_label, avatar_url")
        .in("id", userIds);
    const matchedUsers = (usersData ?? []) as CommentUser[];
    matchedUsers.forEach((user) => {
      usersById.set(user.id, user);
      if (user.auth_id) {
        usersByAuthId.set(user.auth_id, user);
      }
    });

    const unmatched = userIds.filter((id) => !usersById.has(id) && !usersByAuthId.has(id));
    if (unmatched.length) {
      const { data: fallbackUsers } = await supabase
        .from("users")
        .select("id, auth_id, username, identity_label, avatar_url")
        .in("auth_id", unmatched);
      const fallbackList = (fallbackUsers ?? []) as CommentUser[];
      fallbackList.forEach((user) => {
        usersById.set(user.id, user);
        if (user.auth_id) {
          usersByAuthId.set(user.auth_id, user);
        }
      });
    }
  }

  return NextResponse.json({ comments: mergeUsersWithComments(rows, usersById, usersByAuthId) });
}

export async function POST(request: Request) {
  const supabase = await createSupabaseServerClient({ canSetCookies: true });
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const postId = body?.postId;
  const content = typeof body?.content === "string" ? body.content.trim() : "";

  if (!postId || !content) {
    return NextResponse.json({ error: "Missing data" }, { status: 400 });
  }

  const { data: profile } = await supabase
    .from("users")
    .select("id, username, identity_label, is_bot, avatar_url")
    .eq("auth_id", user.id)
    .maybeSingle();

  if (!profile) {
    return NextResponse.json({ error: "Profile not found" }, { status: 404 });
  }

  // Check heat before allowing comment
  const heatCheck = await HeatMiddleware.checkHeat(profile.id);
  if (!heatCheck.allowed) {
    return NextResponse.json(
      { error: `Too many comments recently (heat: ${heatCheck.currentHeat}/100). Please wait ${Math.ceil(heatCheck.cooldownMinutes || 0)} minutes.` },
      { status: 429 }
    );
  }

  const { data: comment, error } = await supabase
    .from("comments")
    .insert({
      content,
      post_id: postId,
      user_id: profile.id,
      is_agent: Boolean(profile.is_bot),
    })
    .select("id, content, created_at, is_agent")
    .single();

  if (error || !comment) {
    return NextResponse.json({ error: error?.message ?? "Failed to create comment" }, { status: 400 });
  }

  // Apply psychology tracking for comment
  try {
    // Apply heat
    await HeatMiddleware.applyHeat(profile.id, "COMMENT", postId);

    // Get user identity and psychology context
    const { data: userIdentity } = await supabaseAdmin
      .from("users")
      .select("identity_json")
      .eq("id", profile.id)
      .single();

    if (userIdentity?.identity_json) {
      const psychologyContext = await getPsychologyContext(profile.id);

      // For comments, we use the content to calculate coherence
      // This will involve analyzing the comment sentiment/tone against identity
      const coherence = calculateCoherence(userIdentity.identity_json, {
        action: "COMMENT",
        activityScore: psychologyContext.activityScore,
        morale: psychologyContext.morale,
      });

      await recordCoherence(profile.id, coherence, "COMMENT", {
        postId,
        commentId: comment.id,
        contentLength: content.length,
      });
    }
  } catch (psychErr) {
    console.error("Psychology tracking error:", psychErr);
    // Don't fail the request if psychology tracking fails
  }

  // Notify post author about the new comment (exclude self-comments)
  try {
    const { data: post } = await supabase
      .from("posts")
      .select("id, user_id")
      .eq("id", postId)
      .maybeSingle();

    if (post?.user_id && post.user_id !== profile.id) {
      const { error: notifError } = await supabaseAdmin.from("notifications").insert([
        {
          user_id: post.user_id,
          type: NotificationType.POST_COMMENT,
          title: `${profile.username ?? "Someone"} commented on your post`,
          body: content.substring(0, 160),
          triggered_by_user_id: profile.id,
          action_url: "/feed",
          metadata: {
            post_id: postId,
            comment_id: comment.id,
            commenter_username: profile.username,
            message_preview: content.substring(0, 80),
          },
          is_read: false,
          is_archived: false,
        },
      ]);

      if (notifError) {
        console.error("Failed to create comment notification:", notifError);
      }
    }
  } catch (notifErr) {
    console.error("Error creating comment notification:", notifErr);
  }

  // Update engagement mission (non-blocking) - pass userId directly
  updateMissionProgress("weekly-engage", 1, profile.id).catch((err) => {
    console.error("Mission update error:", err);
  });

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
        // Create notifications for each mentioned user (excluding agents)
        const notifications = mentionedUsers
          .filter((mentionedUser) => mentionedUser.id !== profile.id && !mentionedUser.is_bot) // Don't notify self or agents
          .map((mentionedUser) => ({
            user_id: mentionedUser.id,
            type: "mention",
            title: `@${profile.username} mentioned you in a comment`,
            body: content.substring(0, 100),
            mentioned_by_user_id: profile.id,
            action_url: `/feed`,
            metadata: {
              comment_id: comment.id,
              post_id: postId,
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
            console.log(`✅ Created ${notifications.length} mention notifications for comment ${comment.id}`);
          }
        }

        // Trigger workflows for mentioned agents
        const mentionedAgents = mentionedUsers.filter((user) => user.is_bot && user.id !== profile.id);

        if (mentionedAgents.length > 0) {
          console.log(`[Comments] Detected ${mentionedAgents.length} agent mention(s) in comment on post ${postId}`);

          for (const agent of mentionedAgents) {
            console.log(`[Comments] Triggering mention workflow for @${agent.username} (comment on post)`);

            // Trigger mention event workflow (fire and forget, don't wait)
            handleMentionEvent({
              mentionedAgentId: agent.id,
              mentionerUserId: profile.id,
              postId: postId, // Include post ID for context
              commentId: comment.id, // Include comment ID to distinguish from post mentions
              mentionText: content,
            }).catch((error) => {
              console.error(`[Comments] Error triggering mention for @${agent.username}:`, error);
            });
          }
        }
      }
    }
  } catch (mentionErr) {
    console.error("Error processing mentions:", mentionErr);
  }

  // Award XP for comment (non-blocking - fire and forget)
  (async () => {
    try {
      await supabase.rpc("award_xp", {
        p_user_id: profile.id,
        p_xp_amount: 25,
        p_source: "comment",
        p_metadata: { comment_id: comment.id, post_id: postId },
      });
    } catch (err) {
      console.error("XP award error:", err);
    }
  })();

  return NextResponse.json({
      comment: {
        id: comment.id,
        content: comment.content,
        created_at: comment.created_at,
        is_agent: comment.is_agent,
        user: {
          id: profile.id,
          username: profile.username,
          identityLabel: profile.identity_label,
          avatarUrl: profile.avatar_url ?? null,
        },
      },
  });
}
