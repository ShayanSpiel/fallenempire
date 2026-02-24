/**
 * UNIFIED CHAT TRIGGER ENDPOINT
 * New endpoint using Observe > Reason > Act > Loop pattern
 * Uses universal workflow for intelligent autonomous agents
 */

import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import { executeUniversalWorkflow, createInitialState, ensureInitialized } from "@/lib/ai-system";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { detectAgentMentions } from "@/lib/utils/mention-utils";
import { handleMentionEvent } from "@/lib/ai-system/triggers/event-handler";

// Initialize workflow system once
ensureInitialized();

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { agent_id, message, get_history = false } = body;

    if (!agent_id || !message) {
      return NextResponse.json(
        { error: "Missing required fields: agent_id, message" },
        { status: 400 }
      );
    }

    // Get authenticated user
    const supabase = await createSupabaseServerClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Get user profile
    const { data: profile } = await supabase
      .from("users")
      .select("id")
      .eq("auth_id", user.id)
      .maybeSingle();

    if (!profile?.id) {
      return NextResponse.json({ error: "User profile not found" }, { status: 404 });
    }

    // Get or create conversation
    let conversationId = `${agent_id}:${profile.id}`;
    const { data: existingConv } = await supabaseAdmin
      .from("conversations")
      .select("id")
      .or(
        `and(user1_id.eq.${agent_id},user2_id.eq.${profile.id}),and(user1_id.eq.${profile.id},user2_id.eq.${agent_id})`
      )
      .maybeSingle();

    if (existingConv) {
      conversationId = existingConv.id;
    } else {
      const { data: newConv } = await supabaseAdmin
        .from("conversations")
        .insert({ user1_id: agent_id, user2_id: profile.id })
        .select()
        .single();
      if (newConv) conversationId = newConv.id;
    }

    // Store message in database
    const { data: storedMessage } = await supabase
      .from("messages")
      .insert({
        conversation_id: conversationId,
        sender_id: profile.id,
        receiver_id: agent_id,
        sender_type: "user",
        content: message,
      })
      .select()
      .single();

    // Check for agent mentions in the message
    const mentionedAgents = await detectAgentMentions(message);

    // Trigger mention workflows for any mentioned agents (except the recipient)
    if (mentionedAgents.length > 0) {
      console.log(`[Chat] Detected ${mentionedAgents.length} agent mention(s) in message`);

      for (const mention of mentionedAgents) {
        // Skip if the mentioned agent is the same as the recipient (already handled by chat workflow)
        if (mention.agentId === agent_id) {
          continue;
        }

        console.log(`[Chat] Triggering mention workflow for @${mention.username}`);

        // Trigger mention event workflow (fire and forget, don't wait)
        handleMentionEvent({
          mentionedAgentId: mention.agentId,
          mentionerUserId: profile.id,
          conversationId,
          messageId: storedMessage?.id,
          messageContent: message,
        }).catch((error) => {
          console.error(`[Chat] Error triggering mention for @${mention.username}:`, error);
        });
      }
    }

    // Process chat through universal workflow
    console.log(`[Chat] Processing message from ${profile.id} to agent ${agent_id}`);

    const scope = {
      trigger: {
        type: "event" as const,
        event: "chat" as const,
        timestamp: new Date(),
      },
      actor: {
        id: agent_id,
        type: "agent" as const,
      },
      subject: {
        id: profile.id,
        type: "user" as const,
        data: {
          content: message,
          sender_id: profile.id,
        },
      },
      dataScope: {},
      conversationId,
    };

    const workflowResult = await executeUniversalWorkflow(createInitialState(scope));

    // Get history if requested
    let history = [];
    if (get_history) {
      const { data: messages } = await supabase
        .from("messages")
        .select("*")
        .eq("conversation_id", conversationId)
        .order("created_at", { ascending: true })
        .limit(20);

      history = messages || [];
    }

    return NextResponse.json({
      success: workflowResult.errors.length === 0,
      message: storedMessage,
      actions: workflowResult.executedActions,
      duration: new Date().getTime() - workflowResult.startTime.getTime(),
      workflow_iterations: workflowResult.loop.iteration,
      history: get_history ? history : undefined,
      errors: workflowResult.errors.length > 0 ? workflowResult.errors : undefined,
    });
  } catch (error: any) {
    console.error("[Chat] Route error:", error);
    return NextResponse.json(
      { error: error.message || "Internal server error" },
      { status: 500 }
    );
  }
}

/**
 * Example request:
 * POST /api/triggers/chat
 * {
 *   "agent_id": "agent_123",
 *   "message": "Join my community",
 *   "get_history": true
 * }
 *
 * Example response:
 * {
 *   "success": true,
 *   "message": { "id": "msg_123", "content": "Join my community", ... },
 *   "actions": ["REPLY"],
 *   "duration": 2341,
 *   "history": [...]
 * }
 */
