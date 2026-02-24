import { createSupabaseServerClient } from "@/lib/supabase-server";
import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

/**
 * Handle community invite acceptance/rejection
 * POST /api/social/community-invite
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

    // Get the notification to find the community
    const { data: notification, error: notifError } = await supabase
      .from("notifications")
      .select("community_id, triggered_by_user_id, type")
      .eq("id", notificationId)
      .eq("user_id", profile.id)
      .eq("type", "community_invite")
      .maybeSingle();

    if (notifError || !notification) {
      return NextResponse.json(
        { error: "Notification not found" },
        { status: 404 }
      );
    }

    const communityId = notification.community_id;
    const invitedByUserId = notification.triggered_by_user_id;

    if (!communityId) {
      return NextResponse.json(
        { error: "Invalid community invite notification" },
        { status: 400 }
      );
    }

    if (action === "accept") {
      // Add user to community_members table
      // Note: Implement actual community membership logic based on your data model
      // This is a placeholder that assumes a community_members table exists

      const { error: insertError } = await supabase
        .from("community_members")
        .insert({
          community_id: communityId,
          user_id: profile.id,
          role: "member", // Default role
          joined_at: new Date().toISOString(),
        });

      if (insertError && !insertError.message.includes("duplicate")) {
        // Ignore duplicate key errors
        console.error("Failed to add community member:", insertError);
        return NextResponse.json(
          { error: "Failed to join community" },
          { status: 500 }
        );
      }

      // Mark notification as read
      await supabase
        .from("notifications")
        .update({
          is_read: true,
          read_at: new Date().toISOString(),
        })
        .eq("id", notificationId);

      // Notify the inviter that the request was accepted
      if (invitedByUserId) {
        const now = new Date().toISOString();
        await supabaseAdmin.from("notifications").insert({
          user_id: invitedByUserId,
          type: "community_update",
          title: "Community Invite Accepted",
          body: `${profile.id} accepted your invite to the community`,
          community_id: communityId,
          triggered_by_user_id: profile.id,
          action_url: `/community/${communityId}`,
          is_read: false,
          is_archived: false,
          created_at: now,
          updated_at: now,
        });
      }

      return NextResponse.json(
        { success: true, message: "Community invite accepted" },
        { status: 200 }
      );
    }

    if (action === "reject") {
      // Just archive the notification
      await supabase
        .from("notifications")
        .update({ is_archived: true })
        .eq("id", notificationId);

      return NextResponse.json(
        { success: true, message: "Community invite rejected" },
        { status: 200 }
      );
    }

    return NextResponse.json(
      { error: "Invalid request" },
      { status: 400 }
    );
  } catch (error) {
    console.error("POST /api/social/community-invite error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
