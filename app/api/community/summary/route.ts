import { NextResponse } from "next/server";

import { createSupabaseServerClient } from "@/lib/supabase-server";
import { getLawDefinition } from "@/lib/governance/laws";

type SummaryEvent = {
  id: string;
  title: string;
  description?: string | null;
  createdAt: string;
  category: "proposal" | "announcement" | "community" | "notification";
};

type SummaryProposal = {
  id: string;
  lawType: string;
  label: string;
  createdAt: string;
  expiresAt: string | null;
  proposerName: string | null;
  status: string;
};

export async function GET(request: Request) {
  const supabase = await createSupabaseServerClient();
  const { searchParams } = new URL(request.url);
  const communityId = searchParams.get("communityId");

  if (!communityId) {
    return NextResponse.json({ error: "Missing communityId" }, { status: 400 });
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data: profile } = await supabase
    .from("users")
    .select("id")
    .eq("auth_id", user.id)
    .maybeSingle();

  if (!profile) {
    return NextResponse.json({ error: "Profile not found" }, { status: 404 });
  }

  const { data: membership } = await supabase
    .from("community_members")
    .select("id")
    .eq("community_id", communityId)
    .eq("user_id", profile.id)
    .maybeSingle();

  if (!membership) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const now = new Date().toISOString();
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

  const { data: activeProposals } = await supabase
    .from("community_proposals")
    .select(
      `
        id,
        law_type,
        status,
        created_at,
        expires_at,
        proposer:users(username)
      `
    )
    .eq("community_id", communityId)
    .eq("status", "pending")
    .order("created_at", { ascending: false })
    .limit(25);

  // Filter out expired proposals on client side
  const filteredActiveProposals = (activeProposals ?? []).filter((proposal: any) => {
    if (!proposal.expires_at) return true; // No expiry, keep it
    return new Date(proposal.expires_at) > new Date(now); // Keep if not expired
  });

  const { data: recentProposals } = await supabase
    .from("community_proposals")
    .select(
      `
        id,
        law_type,
        status,
        created_at,
        proposer:users(username)
      `
    )
    .eq("community_id", communityId)
    .gte("created_at", since)
    .order("created_at", { ascending: false })
    .limit(25);

  const { data: recentAnnouncements } = await supabase
    .from("community_announcements")
    .select("id, title, content, created_at")
    .eq("community_id", communityId)
    .gte("created_at", since)
    .order("created_at", { ascending: false })
    .limit(10);

  // Removed activeNotifications query - we'll use recentNotifications which properly filters by 24h

  const { data: recentNotifications } = await supabase
    .from("notifications")
    .select("id, type, title, body, created_at, is_archived")
    .eq("user_id", profile.id)
    .eq("community_id", communityId)
    .gte("created_at", since)
    .order("created_at", { ascending: false })
    .limit(50);

  const activeProposalList: SummaryProposal[] = filteredActiveProposals.map((proposal: any) => {
    const lawDef = getLawDefinition(proposal.law_type as any);
    return {
      id: proposal.id,
      lawType: proposal.law_type,
      label: lawDef?.label ?? proposal.law_type,
      createdAt: proposal.created_at,
      expiresAt: proposal.expires_at ?? null,
      proposerName: proposal.proposer?.username ?? null,
      status: proposal.status,
    };
  });

  const events: SummaryEvent[] = [];

  (recentProposals ?? []).forEach((proposal: any) => {
    const lawDef = getLawDefinition(proposal.law_type as any);
    const label = lawDef?.label ?? proposal.law_type;
    events.push({
      id: `proposal-${proposal.id}`,
      title: `${label} proposed`,
      description: proposal.proposer?.username
        ? `Proposed by ${proposal.proposer.username}`
        : "New proposal submitted",
      createdAt: proposal.created_at,
      category: "proposal",
    });
  });

  (recentAnnouncements ?? []).forEach((announcement: any) => {
    events.push({
      id: `announcement-${announcement.id}`,
      title: announcement.title || "Announcement posted",
      description: announcement.content ?? null,
      createdAt: announcement.created_at,
      category: "announcement",
    });
  });

  const notificationCategoryMap: Record<string, SummaryEvent["category"]> = {
    law_proposal: "proposal",
    heir_proposal: "proposal",
    law_passed: "proposal",
    law_rejected: "proposal",
    law_expired: "proposal",
    governance_change: "community",
    king_changed: "community",
    king_left: "community",
    heir_appointed: "community",
    secretary_appointed: "community",
    secretary_removed: "community",
    revolution_started: "community",
    civil_war_started: "community",
    battle_started: "community",
    battle_won: "community",
    battle_lost: "community",
    battle_momentum: "community",
    battle_disarray: "community",
    battle_exhaustion: "community",
    battle_rage: "community",
    war_declaration: "community",
    announcement: "announcement",
    community_update: "community",
  };

  // Use only recentNotifications which is filtered to last 24 hours
  (recentNotifications ?? []).forEach((notification: any) => {
    const category = notificationCategoryMap[notification.type] ?? "notification";
    events.push({
      id: `notification-${notification.id}`,
      title: notification.title ?? "Community update",
      description: notification.body ?? null,
      createdAt: notification.created_at,
      category,
    });
  });

  events.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  return NextResponse.json({
    generatedAt: new Date().toISOString(),
    activeProposals: activeProposalList,
    recentEvents: events,
  });
}
