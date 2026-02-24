import { createSupabaseServerClient } from "@/lib/supabase-server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { NextRequest, NextResponse } from "next/server";
import { detectAgentMentions } from "@/lib/utils/mention-utils";
import { handleMentionEvent } from "@/lib/ai-system/triggers/event-handler";

export async function GET(request: NextRequest) {
  try {
    const supabase = await createSupabaseServerClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    const { data: profile } = await supabase
      .from("users")
      .select("id")
      .eq("auth_id", user.id)
      .maybeSingle();

    if (!profile) {
      return NextResponse.json(
        { error: "User profile not found" },
        { status: 404 }
      );
    }

    const { searchParams } = new URL(request.url);
    const action = searchParams.get("action");
    const groupId = searchParams.get("groupId");

    // List user's group conversations
    if (action === "list") {
      const { data: groups, error } = await supabase
        .from("group_conversation_participants")
        .select(`
          group_conversation_id,
          group_conversations:group_conversation_id(
            id, name, description, created_by, is_ai_enabled, created_at, updated_at
          ),
          group_conversation_participants(
            user_id,
            users:user_id(id, username, avatar_url)
          )
        `)
        .eq("user_id", profile.id)
        .order("updated_at", { ascending: false, foreignTable: "group_conversations" });

      if (error) {
        console.error("Failed to fetch groups:", error);
        return NextResponse.json(
          { error: "Failed to fetch groups" },
          { status: 500 }
        );
      }

      return NextResponse.json({ groups }, { status: 200 });
    }

    // Get specific group with messages
    if (action === "get" && groupId) {
      // Verify user is in group
      const { data: membership } = await supabase
        .from("group_conversation_participants")
        .select("id")
        .eq("group_conversation_id", groupId)
        .eq("user_id", profile.id)
        .maybeSingle();

      if (!membership) {
        return NextResponse.json(
          { error: "Access denied" },
          { status: 403 }
        );
      }

      // Fetch group details (include community info)
      const { data: group } = await supabase
        .from("group_conversations")
        .select(`
          id, name, description, created_by, is_ai_enabled, created_at, updated_at,
          is_community_chat, community_id
        `)
        .eq("id", groupId)
        .maybeSingle();

      // Fetch participants
      const { data: participants } = await supabase
        .from("group_conversation_participants")
        .select(`
          user_id, role, joined_at,
          users:user_id(id, username, avatar_url, is_bot)
        `)
        .eq("group_conversation_id", groupId);

      // Fetch messages (include role_metadata)
      const { data: messages } = await supabase
        .from("group_messages")
        .select(`
          id, user_id, content, created_at, role_metadata,
          users:user_id(id, username, avatar_url)
        `)
        .eq("group_conversation_id", groupId)
        .order("created_at", { ascending: true })
        .limit(50);

      return NextResponse.json({
        group,
        participants,
        messages,
      }, { status: 200 });
    }

    return NextResponse.json(
      { error: "Invalid action" },
      { status: 400 }
    );
  } catch (error) {
    console.error("GET /api/group-chat error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createSupabaseServerClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    const { data: profile } = await supabase
      .from("users")
      .select("id")
      .eq("auth_id", user.id)
      .maybeSingle();

    if (!profile) {
      return NextResponse.json(
        { error: "User profile not found" },
        { status: 404 }
      );
    }

    const { action, ...payload } = await request.json();

    // Create new group conversation
    if (action === "create") {
      const { name, description, participantIds, isAiEnabled } = payload;

      if (!name?.trim() || !Array.isArray(participantIds) || participantIds.length === 0) {
        return NextResponse.json(
          { error: "Invalid name or participants" },
          { status: 400 }
        );
      }

      // Create group
      const { data: group, error: groupError } = await supabaseAdmin
        .from("group_conversations")
        .insert({
          name: name.trim(),
          description: description?.trim() || null,
          created_by: profile.id,
          is_ai_enabled: isAiEnabled || false,
        })
        .select()
        .single();

      if (groupError) {
        console.error("Failed to create group:", groupError);
        console.error("Group error details:", JSON.stringify(groupError, null, 2));
        return NextResponse.json(
          {
            error: "Failed to create group",
            message: groupError.message,
            code: groupError.code
          },
          { status: 500 }
        );
      }

      const uniqueParticipantIds = Array.from(new Set([profile.id, ...participantIds]))
        .filter((id) => typeof id === "string" && id.length > 0);

      // Add creator as admin
      const { error: creatorError } = await supabaseAdmin
        .from("group_conversation_participants")
        .insert({
          group_conversation_id: group.id,
          user_id: profile.id,
          role: "admin",
        });

      if (creatorError) {
        console.error("Failed to add group creator:", creatorError);
        await supabaseAdmin
          .from("group_conversations")
          .delete()
          .eq("id", group.id);
        return NextResponse.json(
          {
            error: "Failed to add group creator",
            message: creatorError.message,
            code: creatorError.code,
          },
          { status: 500 }
        );
      }

      // Add other participants
      const otherParticipants = uniqueParticipantIds
        .filter((id: string) => id !== profile.id)
        .map((id: string) => ({
          group_conversation_id: group.id,
          user_id: id,
          role: "member",
        }));

      if (otherParticipants.length > 0) {
        const { error: participantsError } = await supabaseAdmin
          .from("group_conversation_participants")
          .insert(otherParticipants);
        if (participantsError) {
          console.error("Failed to add group participants:", participantsError);
          return NextResponse.json(
            {
              error: "Failed to add group participants",
              message: participantsError.message,
              code: participantsError.code,
            },
            { status: 500 }
          );
        }
      }

      return NextResponse.json({ group }, { status: 201 });
    }

    // Send message to group
    if (action === "sendMessage") {
      const { groupId, content } = payload;

      if (!groupId || !content?.trim()) {
        return NextResponse.json(
          { error: "Missing groupId or content" },
          { status: 400 }
        );
      }

      // Verify user is in group
      const { data: membership } = await supabase
        .from("group_conversation_participants")
        .select("id, role")
        .eq("group_conversation_id", groupId)
        .eq("user_id", profile.id)
        .maybeSingle();

      if (!membership) {
        return NextResponse.json(
          { error: "Not a member of this group" },
          { status: 403 }
        );
      }

      // Check if this is a community group chat
      const { data: groupInfo } = await supabase
        .from("group_conversations")
        .select("is_community_chat, community_id")
        .eq("id", groupId)
        .maybeSingle();

      const trimmedContent = content.trim();
      let finalContent = trimmedContent;
      let roleMetadata = null;

      // Handle community commands if this is a community chat
      if (groupInfo?.is_community_chat && groupInfo?.community_id) {
        // Handle /summary command
        if (trimmedContent === "/summary") {
          try {
            // Fetch summary data (reuse logic from /api/community/summary)
            const summaryUrl = new URL(`${request.url.split('/api/')[0]}/api/community/summary`);
            summaryUrl.searchParams.set("communityId", groupInfo.community_id);

            const summaryResponse = await fetch(summaryUrl.toString(), {
              headers: { cookie: request.headers.get("cookie") || "" }
            });

            if (summaryResponse.ok) {
              const summaryData = await summaryResponse.json();

              // Format summary as message
              const activeProposalsCount = summaryData.activeProposals?.length || 0;
              const recentEventsCount = summaryData.recentEvents?.length || 0;

              finalContent = `📊 **Community Summary**\n\n` +
                `**Active Proposals:** ${activeProposalsCount}\n` +
                `**Recent Events (24h):** ${recentEventsCount}\n\n` +
                `Use /summary in the community to see full details.`;

              roleMetadata = {
                role: "ai",
                commandType: "summary",
                summaryData
              };
            }
          } catch (error) {
            console.error("Failed to fetch summary:", error);
            finalContent = "❌ Failed to fetch community summary.";
            roleMetadata = { role: "ai", commandType: "summary", error: true };
          }
        }

        // Handle /kick command (leader only)
        else if (trimmedContent.startsWith("/kick ")) {
          const targetUsername = trimmedContent.substring(6).trim();

          if (!targetUsername) {
            return NextResponse.json(
              { error: "Usage: /kick <username>" },
              { status: 400 }
            );
          }

          // Check if user is community leader (Sovereign)
          const { data: memberData } = await supabase
            .from("community_members")
            .select("rank_tier")
            .eq("community_id", groupInfo.community_id)
            .eq("user_id", profile.id)
            .maybeSingle();

          if (!memberData || memberData.rank_tier !== 1) {
            return NextResponse.json(
              { error: "Only the Sovereign can use /kick command" },
              { status: 403 }
            );
          }

          // Find target user
          const { data: targetUser } = await supabase
            .from("users")
            .select("id")
            .eq("username", targetUsername)
            .maybeSingle();

          if (!targetUser) {
            return NextResponse.json(
              { error: `User '${targetUsername}' not found` },
              { status: 404 }
            );
          }

          // Remove from community
          const { error: kickError } = await supabaseAdmin
            .from("community_members")
            .delete()
            .eq("community_id", groupInfo.community_id)
            .eq("user_id", targetUser.id);

          if (kickError) {
            console.error("Failed to kick user:", kickError);
            return NextResponse.json(
              { error: "Failed to kick user" },
              { status: 500 }
            );
          }

          // Auto-remove from group chat (handled by trigger)
          finalContent = `🚫 ${targetUsername} has been removed from the community.`;
          roleMetadata = {
            role: "leader",
            commandType: "kick",
            targetUser: targetUsername
          };
        }

        // Get user's community role for regular messages
        else {
          const { data: memberData } = await supabase
            .from("community_members")
            .select("rank_tier")
            .eq("community_id", groupInfo.community_id)
            .eq("user_id", profile.id)
            .maybeSingle();

          if (memberData) {
            const role = memberData.rank_tier === 1 ? "leader" :
                        memberData.rank_tier === 2 ? "secretary" : "user";
            roleMetadata = { role };
          }
        }
      }

      // Insert message
      const { data: message, error } = await supabase
        .from("group_messages")
        .insert({
          group_conversation_id: groupId,
          user_id: profile.id,
          content: finalContent,
          role_metadata: roleMetadata,
        })
        .select()
        .single();

      if (error) {
        console.error("Failed to send message:", error);
        return NextResponse.json(
          { error: "Failed to send message" },
          { status: 500 }
        );
      }

      // Check for agent mentions in the message
      const mentionedAgents = await detectAgentMentions(finalContent);

      // Trigger mention workflows for any mentioned agents
      if (mentionedAgents.length > 0) {
        console.log(`[GroupChat] Detected ${mentionedAgents.length} agent mention(s) in message`);

        for (const mention of mentionedAgents) {
          console.log(`[GroupChat] Triggering mention workflow for @${mention.username}`);

          // Trigger mention event workflow (fire and forget, don't wait)
          handleMentionEvent({
            mentionedAgentId: mention.agentId,
            mentionerUserId: profile.id,
            groupConversationId: groupId,
            messageId: message.id,
            messageContent: finalContent,
          }).catch((error) => {
            console.error(`[GroupChat] Error triggering mention for @${mention.username}:`, error);
          });
        }
      }

      return NextResponse.json({ message }, { status: 201 });
    }

    // Add participant to group
    if (action === "addParticipant") {
      const { groupId, userId } = payload;

      if (!groupId || !userId) {
        return NextResponse.json(
          { error: "Missing groupId or userId" },
          { status: 400 }
        );
      }

      // Verify requester is admin
      const { data: admin } = await supabase
        .from("group_conversation_participants")
        .select("id")
        .eq("group_conversation_id", groupId)
        .eq("user_id", profile.id)
        .eq("role", "admin")
        .maybeSingle();

      if (!admin) {
        return NextResponse.json(
          { error: "Only admins can add participants" },
          { status: 403 }
        );
      }

      // Add participant
      const { data: participant, error } = await supabase
        .from("group_conversation_participants")
        .insert({
          group_conversation_id: groupId,
          user_id: userId,
          role: "member",
        })
        .select()
        .single();

      if (error) {
        console.error("Failed to add participant:", error);
        return NextResponse.json(
          { error: "Failed to add participant" },
          { status: 500 }
        );
      }

      return NextResponse.json({ participant }, { status: 201 });
    }

    // Remove participant from group
    if (action === "removeParticipant") {
      const { groupId, userId } = payload;

      if (!groupId || !userId) {
        return NextResponse.json(
          { error: "Missing groupId or userId" },
          { status: 400 }
        );
      }

      // Verify requester is admin or is the participant being removed
      const { data: admin } = await supabase
        .from("group_conversation_participants")
        .select("id")
        .eq("group_conversation_id", groupId)
        .eq("user_id", profile.id)
        .eq("role", "admin")
        .maybeSingle();

      const isSelf = userId === profile.id;

      if (!admin && !isSelf) {
        return NextResponse.json(
          { error: "Only admins can remove participants" },
          { status: 403 }
        );
      }

      // Remove participant
      const { error } = await supabase
        .from("group_conversation_participants")
        .delete()
        .eq("group_conversation_id", groupId)
        .eq("user_id", userId);

      if (error) {
        console.error("Failed to remove participant:", error);
        return NextResponse.json(
          { error: "Failed to remove participant" },
          { status: 500 }
        );
      }

      return NextResponse.json({ success: true }, { status: 200 });
    }

    if (action === "renameGroup") {
      const { groupId, name } = payload;

      if (!groupId || typeof name !== "string") {
        return NextResponse.json(
          { error: "Missing groupId or name" },
          { status: 400 }
        );
      }

      // Fetch group to confirm it exists and check creator
      const { data: group } = await supabase
        .from("group_conversations")
        .select("created_by")
        .eq("id", groupId)
        .maybeSingle();

      if (!group) {
        return NextResponse.json(
          { error: "Group not found" },
          { status: 404 }
        );
      }

      const isCreator = group.created_by === profile.id;
      let isAdmin = isCreator;

      if (!isAdmin) {
        const { data: membership } = await supabase
          .from("group_conversation_participants")
          .select("role")
          .eq("group_conversation_id", groupId)
          .eq("user_id", profile.id)
          .maybeSingle();

        isAdmin = membership?.role === "admin";
      }

      if (!isAdmin) {
        return NextResponse.json(
          { error: "Only admins can rename groups" },
          { status: 403 }
        );
      }

      const trimmedName = name.trim();
      if (!trimmedName) {
        return NextResponse.json(
          { error: "Group name cannot be empty" },
          { status: 400 }
        );
      }

      const { error: renameError } = await supabaseAdmin
        .from("group_conversations")
        .update({ name: trimmedName })
        .eq("id", groupId);

      if (renameError) {
        console.error("Failed to rename group:", renameError);
        return NextResponse.json(
          {
            error: "Failed to rename group",
            message: renameError.message,
            code: renameError.code,
          },
          { status: 500 }
        );
      }

      return NextResponse.json({ success: true, name: trimmedName }, { status: 200 });
    }

    return NextResponse.json(
      { error: "Invalid action" },
      { status: 400 }
    );
  } catch (error) {
    console.error("POST /api/group-chat error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
