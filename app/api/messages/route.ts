import { createSupabaseServerClient } from "@/lib/supabase-server";
import { NextRequest, NextResponse } from "next/server";

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

    const { recipientId, content } = await request.json();

    if (!recipientId || !content?.trim()) {
      return NextResponse.json(
        { error: "Missing recipientId or content" },
        { status: 400 }
      );
    }

    // Get current user's profile ID (not auth ID)
    const { data: sender } = await supabase
      .from("users")
      .select("id")
      .eq("auth_id", user.id)
      .maybeSingle();

    if (!sender) {
      return NextResponse.json(
        { error: "User profile not found" },
        { status: 404 }
      );
    }

    // Verify recipient exists
    const { data: recipient } = await supabase
      .from("users")
      .select("id")
      .eq("id", recipientId)
      .maybeSingle();

    if (!recipient) {
      return NextResponse.json(
        { error: "Recipient not found" },
        { status: 404 }
      );
    }

    // Prevent messaging yourself
    if (sender.id === recipientId) {
      return NextResponse.json(
        { error: "Cannot message yourself" },
        { status: 400 }
      );
    }

    // Insert message
    const { data: message, error } = await supabase
      .from("direct_messages")
      .insert({
        sender_id: sender.id,
        recipient_id: recipientId,
        content: content.trim(),
      })
      .select()
      .single();

    if (error) {
      console.error("Failed to insert message:", error);
      console.error("Error details:", JSON.stringify(error, null, 2));
      console.error("Error message:", error.message);
      console.error("Error code:", error.code);
      return NextResponse.json(
        {
          error: "Failed to send message",
          message: error.message,
          code: error.code,
          details: error
        },
        { status: 500 }
      );
    }

    return NextResponse.json({ message }, { status: 201 });
  } catch (error) {
    console.error("POST /api/messages error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

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

    // Get current user's profile ID
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

    // Get query parameters
    const { searchParams } = new URL(request.url);
    const otherUserId = searchParams.get("otherUserId");

    if (!otherUserId) {
      return NextResponse.json(
        { error: "Missing otherUserId parameter" },
        { status: 400 }
      );
    }

    // Fetch message thread
    const { data: messages, error } = await supabase
      .from("direct_messages")
      .select("*")
      .or(
        `and(sender_id.eq.${profile.id},recipient_id.eq.${otherUserId}),and(sender_id.eq.${otherUserId},recipient_id.eq.${profile.id})`
      )
      .order("created_at", { ascending: true })
      .limit(50);

    // Fetch sender details separately if needed
    let enrichedMessages = messages;
    if (messages && messages.length > 0) {
      const senderIds = [...new Set(messages.map(m => m.sender_id))];
      const { data: senders } = await supabase
        .from("users")
        .select("id, username, avatar_url")
        .in("id", senderIds);

      const senderMap = new Map(senders?.map(s => [s.id, s]) || []);
      enrichedMessages = messages.map(m => ({
        ...m,
        sender: senderMap.get(m.sender_id)
      }));
    }

    if (error) {
      console.error("Failed to fetch messages:", error);
      return NextResponse.json(
        { error: "Failed to fetch messages" },
        { status: 500 }
      );
    }

    return NextResponse.json({ messages: enrichedMessages }, { status: 200 });
  } catch (error) {
    console.error("GET /api/messages error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
