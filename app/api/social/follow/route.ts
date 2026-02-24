import { createSupabaseServerClient } from "@/lib/supabase-server";
import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

/**
 * Handle follow request acceptance/rejection
 * POST /api/social/follow
 *
 * Request body:
 * {
 *   action: "accept" | "reject",
 *   notificationId: string
 * }
 */

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

    const { action, notificationId } = await request.json();

    if (!action || !["accept", "reject"].includes(action)) {
      return NextResponse.json(
        { error: "Invalid action. Must be 'accept' or 'reject'" },
        { status: 400 }
      );
    }

    if (!notificationId) {
      return NextResponse.json(
        { error: "Missing notificationId" },
        { status: 400 }
      );
    }

    // Get the notification to find who sent the follow request
    const { data: notification, error: notifError } = await supabase
      .from("notifications")
      .select("triggered_by_user_id, type")
      .eq("id", notificationId)
      .eq("user_id", profile.id)
      .eq("type", "follow_request")
      .maybeSingle();

    if (notifError || !notification) {
      return NextResponse.json(
        { error: "Notification not found" },
        { status: 404 }
      );
    }

    const followerUserId = notification.triggered_by_user_id;

    if (!followerUserId) {
      return NextResponse.json(
        { error: "Invalid follow request notification" },
        { status: 400 }
      );
    }

    if (action === "accept") {
      // Create follow relationship
      // Note: Implement actual follow logic based on your data model
      // This is a placeholder that assumes a follows table exists

      // Mark notification as read
      await supabase
        .from("notifications")
        .update({
          is_read: true,
          read_at: new Date().toISOString(),
        })
        .eq("id", notificationId);

      // Create follow_accepted notification for the requester
      await supabaseAdmin.from("notifications").insert({
        user_id: followerUserId,
        type: "follow_accepted",
        title: "Follow Accepted",
        body: `Your follow request was accepted`,
        triggered_by_user_id: profile.id,
        action_url: `/profile/${profile.id}`,
        is_read: false,
        is_archived: false,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      });

      return NextResponse.json(
        { success: true, message: "Follow request accepted" },
        { status: 200 }
      );
    }

    if (action === "reject") {
      // Just archive/delete the notification
      await supabase
        .from("notifications")
        .update({ is_archived: true })
        .eq("id", notificationId);

      return NextResponse.json(
        { success: true, message: "Follow request rejected" },
        { status: 200 }
      );
    }

    return NextResponse.json(
      { error: "Invalid request" },
      { status: 400 }
    );
  } catch (error) {
    console.error("POST /api/social/follow error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
