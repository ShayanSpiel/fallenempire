"use client";

import React, { useMemo } from "react";
import Link from "next/link";
import { User, Crown, ChevronRight, Users, UserCog } from "lucide-react";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { UserAvatar } from "@/components/ui/user-avatar";
import { UserNameDisplay } from "@/components/ui/user-name-display";
import { resolveAvatar } from "@/lib/avatar";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Sheet, SheetContent, SheetTitle, SheetHeader } from "@/components/ui/sheet";
import { IdentityLabel } from "@/components/ui/identity-label";
import { getRankLabel } from "@/lib/governance";

export type Member = {
  id?: string;
  user_id?: string;
  username: string | null;
  identity_label?: string | null;
  avatar_url: string | null;
  user_tier?: "alpha" | "sigma" | "omega" | null;
  role?: "founder" | "leader" | "member";
  rank_tier?: number;
  military_rank_score?: number;
  battles_fought?: number;
  battles_won?: number;
  total_damage_dealt?: number;
  win_streak?: number;
  updated_at?: string;
  morale?: number;
  strength?: number;
};

type CommunityMemberSheetProps = {
  communityName: string;
  members: Member[];
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  governanceType?: string;
};

function MemberListItem({ member }: { member: Member }) {
  const isLeader = member.role === "founder" || member.role === "leader";
  const username = member.username ?? "Unknown Entity";
  const profileSlug = member.username ?? "unknown";

  return (
    <Link
      href={`/profile/${profileSlug}`}
      className="group flex items-center justify-between p-2 pl-3 rounded-xl border border-transparent hover:border-border/50 hover:bg-accent/40 transition-all duration-200"
    >
      <div className="flex items-center gap-3">
        <div className="relative">
          <UserAvatar
            username={username}
            avatarUrl={member.avatar_url ?? null}
            size="md"
            className="rounded-xl border border-border/60 bg-background shadow-sm group-hover:scale-105 transition-transform"
          />
          {isLeader && (
            <div className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-background ring-2 ring-background">
              <Crown size={10} className="text-amber-500 fill-amber-500" />
            </div>
          )}
        </div>

        <div className="flex flex-col gap-0.5">
          <UserNameDisplay
            username={username}
            userTier={member.user_tier ?? "alpha"}
            showLink={false}
            badgeSize="sm"
            className="text-sm font-semibold text-foreground group-hover:text-primary transition-colors"
          />
          <IdentityLabel
            label={member.identity_label}
            className="text-[9px] uppercase tracking-wider opacity-70"
          />
        </div>
      </div>

      <div className="pr-2 opacity-0 -translate-x-2 group-hover:opacity-100 group-hover:translate-x-0 transition-all duration-300">
        <ChevronRight size={14} className="text-muted-foreground" />
      </div>
    </Link>
  );
}

export function CommunityMemberSheet({
  communityName,
  members,
  isOpen,
  onOpenChange,
  governanceType = "monarchy",
}: CommunityMemberSheetProps) {
  const { sovereigns, advisors, regularMembers } = useMemo(() => {
    const sorted = [...members].sort((a, b) => {
      // Sort by rank_tier (lower first), then by role for legacy data
      const aTier = a.rank_tier ?? (a.role === "founder" ? 0 : a.role === "leader" ? 1 : 10);
      const bTier = b.rank_tier ?? (b.role === "founder" ? 0 : b.role === "leader" ? 1 : 10);
      return aTier - bTier;
    });

    const sovereigns = sorted.filter((m) => (m.rank_tier ?? (m.role === "founder" ? 0 : 10)) === 0);
    const advisors = sorted.filter((m) => (m.rank_tier ?? (m.role === "leader" ? 1 : 10)) === 1);
    const regularMembers = sorted.filter((m) => {
      const tier = m.rank_tier ?? (m.role === "founder" ? 0 : m.role === "leader" ? 1 : 10);
      return tier !== 0 && tier !== 1;
    });
    return { sovereigns, advisors, regularMembers };
  }, [members]);

  return (
    <Sheet open={isOpen} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-md p-0 gap-0 flex flex-col bg-background/95 backdrop-blur-xl">
        {/* Header */}
        <SheetHeader className="px-6 py-6 border-b border-border/60">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-muted text-muted-foreground">
              <Users size={18} />
            </div>
            <div className="flex-1">
              <SheetTitle className="text-base font-bold">Community Members</SheetTitle>
              <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-[0.1em] mt-1">
                {members.length} {members.length === 1 ? "Member" : "Members"} • {communityName}
              </p>
            </div>
          </div>
        </SheetHeader>

        {/* Content */}
        <ScrollArea className="flex-1 px-6">
          <div className="py-6 space-y-6">
            {/* Sovereigns */}
            {sovereigns.length > 0 && (
              <div className="space-y-3">
                <div className="flex items-center gap-2 pb-2 border-b border-border/50">
                  <Crown size={13} className="text-amber-500" />
                  <span className="text-[11px] font-semibold uppercase tracking-[0.1em] text-muted-foreground">
                    {getRankLabel(governanceType, 0)} ({sovereigns.length})
                  </span>
                </div>
                <div className="space-y-1.5">
                  {sovereigns.map((member) => (
                    <MemberListItem key={member.id || member.user_id} member={member} />
                  ))}
                </div>
              </div>
            )}

            {/* Advisors/Secretaries */}
            {advisors.length > 0 && (
              <div className="space-y-3">
                <div className="flex items-center gap-2 pb-2 border-b border-border/50">
                  <UserCog size={13} className="text-blue-500" />
                  <span className="text-[11px] font-semibold uppercase tracking-[0.1em] text-muted-foreground">
                    {getRankLabel(governanceType, 1)} ({advisors.length})
                  </span>
                </div>
                <div className="space-y-1.5">
                  {advisors.map((member) => (
                    <MemberListItem key={member.id || member.user_id} member={member} />
                  ))}
                </div>
              </div>
            )}

            {/* Regular Members */}
            {regularMembers.length > 0 && (
              <div className="space-y-3">
                <div className="flex items-center gap-2 pb-2 border-b border-border/50">
                  <User size={13} className="text-muted-foreground" />
                  <span className="text-[11px] font-semibold uppercase tracking-[0.1em] text-muted-foreground">
                    Members ({regularMembers.length})
                  </span>
                </div>
                <div className="space-y-1.5">
                  {regularMembers.map((member) => (
                    <MemberListItem key={member.id || member.user_id} member={member} />
                  ))}
                </div>
              </div>
            )}

            {members.length === 0 && (
              <div className="flex flex-col items-center justify-center py-12 text-center opacity-50">
                <Users className="h-10 w-10 text-muted-foreground/30 mb-2" />
                <p className="text-sm font-medium text-muted-foreground">No members yet.</p>
              </div>
            )}
          </div>
        </ScrollArea>
      </SheetContent>
    </Sheet>
  );
}
