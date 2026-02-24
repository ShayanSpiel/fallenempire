import { createSupabaseServerClient } from "@/lib/supabase-server";
import { NextRequest, NextResponse } from "next/server";
import { NotificationCategory, NotificationType } from "@/lib/types/notifications";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

// ==================== Category Type Mapping ====================

const CATEGORY_TYPES: Record<NotificationCategory, NotificationType[]> = {
  [NotificationCategory.MESSAGES]: [
    NotificationType.DIRECT_MESSAGE,
    NotificationType.GROUP_MESSAGE,
  ],
  [NotificationCategory.WORLD]: [
    NotificationType.LAW_PROPOSAL,
    NotificationType.HEIR_PROPOSAL,
    NotificationType.GOVERNANCE_CHANGE,
    NotificationType.WAR_DECLARATION,
    NotificationType.ANNOUNCEMENT,
    NotificationType.FEED_SUMMARY,
  ],
  [NotificationCategory.COMMUNITY]: [
    NotificationType.LAW_PASSED,
    NotificationType.LAW_REJECTED,
    NotificationType.LAW_EXPIRED,
    NotificationType.KING_CHANGED,
    NotificationType.KING_LEFT,
    NotificationType.HEIR_APPOINTED,
    NotificationType.SECRETARY_APPOINTED,
    NotificationType.SECRETARY_REMOVED,
    NotificationType.REVOLUTION_STARTED,
    NotificationType.CIVIL_WAR_STARTED,
    NotificationType.BATTLE_STARTED,
    NotificationType.BATTLE_WON,
    NotificationType.BATTLE_LOST,
    NotificationType.BATTLE_MOMENTUM,
    NotificationType.BATTLE_DISARRAY,
    NotificationType.BATTLE_EXHAUSTION,
    NotificationType.BATTLE_RAGE,
    NotificationType.COMMUNITY_UPDATE,
  ],
  [NotificationCategory.SOCIAL]: [
    NotificationType.MENTION,
    NotificationType.FOLLOW_REQUEST,
    NotificationType.COMMUNITY_INVITE,
    NotificationType.FOLLOW_ACCEPTED,
    NotificationType.POST_COMMENT,
    NotificationType.POST_LIKE,
    NotificationType.POST_DISLIKE,
  ],
};

async function computeCounts(admin: typeof supabaseAdmin, profileId: string) {
  const { data, error } = await admin
    .from("user_notification_counts")
    .select("total, messages, world, community, social, last_notification_at")
    .eq("user_id", profileId)
    .maybeSingle();

  if (error) {
    console.error("[computeCounts] Error fetching from view:", error);
    throw error;
  }

  console.log("[computeCounts] Raw data from view:", data);

  const result = {
    total: data?.total ?? 0,
    messages: data?.messages ?? 0,
    world: data?.world ?? 0,
    community: data?.community ?? 0,
    social: data?.social ?? 0,
    lastNotificationAt: data?.last_notification_at ?? null,
  };

  console.log("[computeCounts] Computed result:", result);
  return result;
}

// ==================== GET Handler ====================

export async function GET(request: NextRequest) {
  try {
    const supabase = await createSupabaseServerClient({ canSetCookies: true });
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
    const limit = Math.min(parseInt(searchParams.get("limit") || "20"), 100);
    const offset = parseInt(searchParams.get("offset") || "0");
    const type = searchParams.get("type");
    const category = searchParams.get("category") as NotificationCategory | null;
    const unreadOnly = searchParams.get("unreadOnly") === "true";
    const search = searchParams.get("search");

    const applyListFilters = (query: any) => {
      let q = query
        .eq("user_id", profile.id)
        .eq("is_archived", false);

      if (unreadOnly) {
        q = q.eq("is_read", false);
      }

      if (type) {
        q = q.eq("type", type);
      }

      if (category && CATEGORY_TYPES[category]) {
        q = q.in("type", CATEGORY_TYPES[category]);
      }

      if (search && search.trim()) {
        const searchLower = search.toLowerCase();
        q = q.or(`title.ilike.%${searchLower}%,body.ilike.%${searchLower}%`);
      }

      return q;
    };

    // Handle list action
    if (!action || action === "list") {
      const countQuery = applyListFilters(
        supabase
          .from("notifications")
          .select("id", { count: "exact", head: true })
      ) as any;
      const { count: total, error: countError } = await countQuery;

      if (countError) {
        console.error("Failed to count notifications:", countError);
        return NextResponse.json(
          { error: "Failed to fetch notifications" },
          { status: 500 }
        );
      }

      const notificationsQuery = applyListFilters(
        supabase.from("notifications").select("*")
      ) as any;
      const { data: notifications, error } = await notificationsQuery
        .order("created_at", { ascending: false })
        .range(offset, offset + limit - 1);

      if (error) {
        console.error("Failed to fetch notifications:", error);
        return NextResponse.json(
          { error: "Failed to fetch notifications" },
          { status: 500 }
        );
      }

      const totalCount = total ?? 0;
      const hasMore = notifications
        ? offset + notifications.length < totalCount
        : false;

      return NextResponse.json(
        {
          notifications: notifications || [],
          total: totalCount,
          hasMore,
          nextOffset: hasMore ? offset + limit : undefined,
        },
        { status: 200 }
      );
    }

    // Handle counts action
    if (action === "counts") {
      const counts = await computeCounts(supabaseAdmin, profile.id);
      return NextResponse.json(
        counts,
        { status: 200, headers: { "Cache-Control": "no-store, max-age=0" } }
      );
    }

    return NextResponse.json(
      { error: "Invalid action" },
      { status: 400 }
    );
  } catch (error) {
    console.error("GET /api/notifications error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

// ==================== POST Handler ====================

export async function POST(request: NextRequest) {
  try {
    const supabase = await createSupabaseServerClient({ canSetCookies: true });
    const admin = supabaseAdmin;
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

    // Mark single notification as read
    if (action === "markAsRead") {
      const { notificationId, notificationType } = payload;

      if (!notificationId && !notificationType) {
        return NextResponse.json(
          { error: "Missing notificationId or notificationType" },
          { status: 400 }
        );
      }

      if (notificationId) {
        console.log("[POST markAsRead] Marking notification as read:", notificationId);
        const { error } = await admin
          .from("notifications")
          .update({ is_read: true, read_at: new Date().toISOString() })
          .eq("id", notificationId)
          .eq("user_id", profile.id);

        if (error) {
          console.error("[POST markAsRead] Error marking notification:", error);
          return NextResponse.json(
            { error: "Failed to mark notification as read" },
            { status: 500 }
          );
        }

        const counts = await computeCounts(admin, profile.id);
        console.log("[POST markAsRead] Returning counts:", counts);
        return NextResponse.json({ success: true, counts }, { status: 200 });
      }

      // Mark by type
      if (notificationType) {
        const { error } = await admin
          .from("notifications")
          .update({ is_read: true, read_at: new Date().toISOString() })
          .eq("user_id", profile.id)
          .eq("type", notificationType)
          .eq("is_read", false);

        if (error) {
          return NextResponse.json(
            { error: "Failed to mark notifications as read" },
            { status: 500 }
          );
        }

        const counts = await computeCounts(admin, profile.id);
        return NextResponse.json({ success: true, counts }, { status: 200 });
      }
    }

    // Mark all as read
    if (action === "markAllAsRead") {
      const { error } = await admin
        .from("notifications")
        .update({ is_read: true, read_at: new Date().toISOString() })
        .eq("user_id", profile.id)
        .eq("is_read", false)
        .eq("is_archived", false);

      if (error) {
        return NextResponse.json(
          { error: "Failed to mark all notifications as read" },
          { status: 500 }
        );
      }

      const counts = await computeCounts(admin, profile.id);
      return NextResponse.json({ success: true, counts }, { status: 200 });
    }

    // Archive single notification
    if (action === "archive") {
      const { notificationId } = payload;

      if (!notificationId) {
        return NextResponse.json(
          { error: "Missing notificationId" },
          { status: 400 }
        );
      }

      const { error } = await admin
        .from("notifications")
        .update({ is_archived: true })
        .eq("id", notificationId)
        .eq("user_id", profile.id);

      if (error) {
        return NextResponse.json(
          { error: "Failed to archive notification" },
          { status: 500 }
        );
      }

      const counts = await computeCounts(admin, profile.id);
      return NextResponse.json({ success: true, counts }, { status: 200 });
    }

    // Archive by type
    if (action === "archiveType") {
      const { notificationType } = payload;

      if (!notificationType) {
        return NextResponse.json(
          { error: "Missing notificationType" },
          { status: 400 }
        );
      }

      const { error } = await admin
        .from("notifications")
        .update({ is_archived: true })
        .eq("user_id", profile.id)
        .eq("type", notificationType)
        .eq("is_archived", false);

      if (error) {
        return NextResponse.json(
          { error: "Failed to archive notifications" },
          { status: 500 }
        );
      }

      const counts = await computeCounts(admin, profile.id);
      return NextResponse.json({ success: true, counts }, { status: 200 });
    }

    // Batch operations
    if (action === "batch") {
      const { ids, operation } = payload;

      if (!ids || !Array.isArray(ids) || ids.length === 0) {
        return NextResponse.json(
          { error: "Missing or invalid ids array" },
          { status: 400 }
        );
      }

      if (!operation || !["read", "archive", "delete"].includes(operation)) {
        return NextResponse.json(
          { error: "Invalid operation" },
          { status: 400 }
        );
      }

      if (operation === "read") {
        const { error } = await admin
          .from("notifications")
          .update({
            is_read: true,
            read_at: new Date().toISOString(),
          })
          .in("id", ids)
          .eq("user_id", profile.id);
        if (error) {
          return NextResponse.json(
            { error: "Batch operation failed" },
            { status: 500 }
          );
        }
      } else if (operation === "archive") {
        const { error } = await admin
          .from("notifications")
          .update({ is_archived: true })
          .in("id", ids)
          .eq("user_id", profile.id);
        if (error) {
          return NextResponse.json(
            { error: "Batch operation failed" },
            { status: 500 }
          );
        }
      } else if (operation === "delete") {
        const { error } = await admin
          .from("notifications")
          .delete()
          .in("id", ids)
          .eq("user_id", profile.id);
        if (error) {
          return NextResponse.json(
            { error: "Batch operation failed" },
            { status: 500 }
          );
        }
      }

      const counts = await computeCounts(admin, profile.id);
      return NextResponse.json({ success: true, counts }, { status: 200 });
    }

    return NextResponse.json(
      { error: "Invalid action" },
      { status: 400 }
    );
  } catch (error) {
    console.error("POST /api/notifications error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
