"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Flame, AlertTriangle, Clock, Users, Handshake } from "lucide-react";
import { createSupabaseBrowserClient } from "@/lib/supabase-browser";

import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { SectionHeading } from "@/components/ui/section-heading";
import { MoraleBar } from "@/components/ui/morale-bar";

import {
  startUprisingAction,
  supportUprisingAction,
  getActiveRebellionAction,
  getSupporterCountAction,
  exileUprisingLeaderAction,
  requestNegotiationAction,
  getActiveNegotiationAction,
  canStartRevolutionAction,
  type RevolutionData,
} from "@/app/actions/revolution";

import {
  REVOLUTION_COLOR_SCHEME,
  NEGOTIATION_COLOR_SCHEME,
  getRevolutionColorScheme,
  phaseStyles,
  progressStyles,
} from "@/lib/revolution-design-system";

import { cn } from "@/lib/utils";
import { NegotiationModal } from "./negotiation-modal";

interface RevolutionComponentProps {
  communityId: string;
  currentUserId: string;
  sovereignId?: string;
  communityName: string;
  isUserSovereign: boolean;
}

interface SupporterInfo {
  user_id: string;
  users?: {
    username: string;
    avatar_url?: string;
  };
}

export function RevolutionComponent({
  communityId,
  currentUserId,
  sovereignId,
  communityName,
  isUserSovereign,
}: RevolutionComponentProps) {
  const [rebellion, setRebellion] = useState<RevolutionData | null>(null);
  const [supporters, setSupporters] = useState<SupporterInfo[]>([]);
  const [supportCount, setSupportCount] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [canStart, setCanStart] = useState(false);
  const [isInitialLoad, setIsInitialLoad] = useState(true);
  const [showNegotiationModal, setShowNegotiationModal] = useState(false);
  const [activeNegotiation, setActiveNegotiation] = useState<any>(null);
  const [userHasSupported, setUserHasSupported] = useState(false);
  const [communityMorale, setCommunityMorale] = useState<number | null>(null);

  const supabase = createSupabaseBrowserClient();

  // =========================================================================
  // Load active rebellion
  // =========================================================================

  const loadRebellion = useCallback(async () => {
    const data = await getActiveRebellionAction(communityId);
    setRebellion(data);

    if (data) {
      // Load supporters
      const supporterData = await getSupporterCountAction(data.id);
      if (supporterData) {
        setSupportCount(supporterData.count);
        setSupporters(supporterData.supporters);
        setUserHasSupported(
          supporterData.supporters.some((s) => s.user_id === currentUserId)
        );
      }

      // Check for active negotiation
      if (isUserSovereign) {
        const neg = await getActiveNegotiationAction(data.id);
        setActiveNegotiation(neg);
      }
    }
  }, [communityId, currentUserId, isUserSovereign]);

  // Check if user can start revolution
  const checkCanStart = useCallback(async () => {
    const result = await canStartRevolutionAction(communityId);
    setCanStart(result.allowed);
  }, [communityId]);

  // Fetch community morale (average of all members' morale)
  const loadCommunityMorale = useCallback(async () => {
    try {
      const { data: members, error } = await supabase
        .from("community_members")
        .select("users(morale)")
        .eq("community_id", communityId);

      if (error || !members) {
        setCommunityMorale(null);
        return;
      }

      const morales = members
        .map((m: any) => m.users?.morale)
        .filter((m: any) => m !== null && m !== undefined);

      if (morales.length === 0) {
        setCommunityMorale(null);
        return;
      }

      const average = morales.reduce((a: number, b: number) => a + b, 0) / morales.length;
      // Convert from 0-100 to -100 to 100 range for MoraleBar (0 = -100, 50 = 0, 100 = 100)
      const normalized = (average - 50) * 2;
      setCommunityMorale(normalized);
    } catch (error) {
      console.error("Failed to load community morale:", error);
      setCommunityMorale(null);
    }
  }, [communityId, supabase]);

  useEffect(() => {
    let isActive = true;

    const initialize = async () => {
      setIsInitialLoad(true);
      try {
        await Promise.all([loadRebellion(), checkCanStart(), loadCommunityMorale()]);
      } finally {
        if (isActive) {
          setIsInitialLoad(false);
        }
      }
    };

    initialize();

    return () => {
      isActive = false;
    };
  }, [loadRebellion, checkCanStart, loadCommunityMorale]);

  // =========================================================================
  // Realtime subscription for live updates
  // =========================================================================

  useEffect(() => {
    if (!rebellion?.id) return;

    const channel = supabase
      .channel(`rebellion:${rebellion.id}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "rebellions",
          filter: `id=eq.${rebellion.id}`,
        },
        () => {
          loadRebellion();
        }
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "rebellion_supports",
          filter: `rebellion_id=eq.${rebellion.id}`,
        },
        () => {
          loadRebellion();
        }
      )
      .subscribe();

    return () => {
      supabase.removeAllChannels();
    };
  }, [rebellion?.id, supabase, loadRebellion]);

  // =========================================================================
  // Handlers
  // =========================================================================

  const handleStartUprisng = async () => {
    setIsLoading(true);
    try {
      const result = await startUprisingAction(communityId);
      if (result.error) {
        alert(result.error);
      } else {
        await loadRebellion();
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleSupportRevoltion = async () => {
    if (!rebellion) return;
    setIsLoading(true);
    try {
      const result = await supportUprisingAction(rebellion.id);
      if (result.error) {
        alert(result.error);
      } else {
        await loadRebellion();
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleExileLeader = async () => {
    if (!rebellion) return;
    if (
      !confirm(
        "Are you sure? This will exile the leader and trigger chaos in your community."
      )
    )
      return;

    setIsLoading(true);
    try {
      const result = await exileUprisingLeaderAction(rebellion.id);
      if (result.error) {
        alert(result.error);
      } else {
        await loadRebellion();
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleRequestNegotiation = async () => {
    if (!rebellion) return;
    setIsLoading(true);
    try {
      const result = await requestNegotiationAction(rebellion.id);
      if (result.error) {
        alert(result.error);
      } else {
        setShowNegotiationModal(true);
        await loadRebellion();
      }
    } finally {
      setIsLoading(false);
    }
  };

  // =========================================================================
  // Derived state
  // =========================================================================

  const progressPercent = rebellion
    ? (rebellion.current_supports / rebellion.required_supports) * 100
    : 0;

  const isAgitation = rebellion?.status === "agitation";
  const isBattle = rebellion?.status === "battle";

  const colorScheme = getRevolutionColorScheme("rebellion");
  const timeRemaining = useMemo(() => {
    if (!rebellion?.agitation_expires_at) return null;
    const now = new Date().getTime();
    const expires = new Date(rebellion.agitation_expires_at).getTime();
    const diff = expires - now;

    if (diff <= 0) return "Expired";
    const hours = Math.floor(diff / 3600000);
    const minutes = Math.floor((diff % 3600000) / 60000);
    return `${hours}h ${minutes}m`;
  }, [rebellion?.agitation_expires_at]);

  if (isInitialLoad) {
    return (
      <div
        className={cn(
          "rounded-xl border px-4 py-4 md:px-6 md:py-5 space-y-4 animate-pulse",
          colorScheme.bgLight,
          colorScheme.borderLight
        )}
      >
        <div className="flex items-center justify-between gap-3">
          <div className="h-3 w-32 rounded-full bg-muted-foreground/30 dark:bg-muted-foreground/20" />
          <div className="h-3 w-16 rounded-full bg-muted-foreground/30 dark:bg-muted-foreground/20" />
        </div>
        <div className="space-y-3 mt-2">
          <div className="h-2 w-2/3 rounded-full bg-muted-foreground/25 dark:bg-muted-foreground/15" />
          <div className="h-2 w-full rounded-full bg-muted-foreground/20 dark:bg-muted-foreground/10" />
          <div className="h-2 w-5/6 rounded-full bg-muted-foreground/25 dark:bg-muted-foreground/15" />
        </div>
        <div className="h-10 w-full rounded-lg bg-border/30 dark:bg-border/20" />
      </div>
    );
  }

  // No active rebellion
  if (!rebellion) {
    return (
      <div className={cn(
        "rounded-xl border px-4 py-4 md:px-6 md:py-5",
        colorScheme.bgLight,
        colorScheme.borderLight
      )}>
        <SectionHeading
          title="Revolution & Uprising"
          icon={Flame}
          actions={
            <span className="text-[10px] font-semibold uppercase tracking-[0.3em] text-muted-foreground">
              {communityMorale !== null && (communityMorale < 0 || communityMorale < 0) ? "alert" : "dormant"}
            </span>
          }
        />

        <div className="mt-4 space-y-4">
          {/* Mini Morale Bar */}
          {communityMorale !== null && (
            <div className="pt-2 pb-2">
              <MoraleBar
                morale={communityMorale}
                showLabel={true}
                showTooltip={true}
                compact={true}
              />
            </div>
          )}

          <p className="text-sm text-muted-foreground">
            High morale? No revolution needed. But when the people suffer...
          </p>

          <Button
            disabled={!canStart || isLoading}
            onClick={handleStartUprisng}
            className={cn(
              "w-full",
              colorScheme.buttonBg,
              colorScheme.buttonHover,
              colorScheme.buttonText
            )}
          >
            <Flame className="h-4 w-4" />
            {isLoading ? "Starting..." : "START REVOLUTION"}
          </Button>
        </div>
      </div>
    );
  }

  // =========================================================================
  // Active rebellion render
  // =========================================================================

  const sovereignName = rebellion.target_id
    ? `the Governor`
    : "the Government";

  return (
    <>
      <div
        className={cn(
          "rounded-xl border px-4 py-4 md:px-6 md:py-5",
          colorScheme.bgMedium,
          colorScheme.borderMedium
        )}
      >
        {/* Header */}
        <SectionHeading
          title="Revolution & Uprising"
          icon={isAgitation ? AlertTriangle : Flame}
          actions={
            <span
              className={cn(
                "text-[10px] font-semibold uppercase tracking-[0.3em]",
                isAgitation ? "text-amber-600 dark:text-amber-400" : "text-red-600 dark:text-red-400"
              )}
            >
              {rebellion.status}
            </span>
          }
        />

        {/* Leader info */}
        <div className="mt-4 space-y-4">
          {rebellion.is_leader_exiled ? (
            <div className="rounded-lg bg-red-950/30 border border-red-500/40 px-3 py-2">
              <p className="text-sm font-semibold text-red-200 dark:text-red-300">
                ⚠️ The Leader of the Revolution is exiled...
              </p>
              <p className="text-xs text-red-200/70 dark:text-red-300/70">
                Join him if someone invites him back to continue the uprising.
              </p>
            </div>
          ) : (
            <div className="space-y-1">
              <p className="text-sm font-semibold text-foreground">
                💥 {rebellion.leader_id ? "Revolution Started" : "Uprising Begins"}
              </p>
              <p className="text-xs text-muted-foreground">
                Against {sovereignName}
              </p>
            </div>
          )}

          {/* Progress bar */}
          {isAgitation || isBattle ? (
            <div className="space-y-2">
              <div className="flex items-center justify-between gap-2">
                <div className="flex-1">
                  <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    Supporters
                  </p>
                  <p className="text-sm font-bold text-foreground">
                    {supportCount} / {rebellion.required_supports}
                  </p>
                </div>
                {isAgitation && timeRemaining && (
                  <div className="flex items-center gap-1 text-xs text-muted-foreground">
                    <Clock className="h-3 w-3" />
                    {timeRemaining}
                  </div>
                )}
              </div>

              {/* Gradient progress bar */}
              <div className={progressStyles.container}>
                <div
                  className={cn(
                    progressStyles.fillGradient,
                    `${colorScheme.progressStart} ${colorScheme.progressEnd}`
                  )}
                  style={{ width: `${progressPercent}%` }}
                />
              </div>

              <p className="text-xs text-muted-foreground">
                {isAgitation
                  ? "Start a civil war against the government and take the power back."
                  : "Civil war is underway! The battle will determine the future."}
              </p>
            </div>
          ) : null}

          {/* Supporter avatars */}
          {supporters.length > 0 && (
            <div className="flex items-center gap-2">
              <Users className="h-4 w-4 text-muted-foreground" />
              <div className="flex -space-x-2">
                {supporters.slice(0, 5).map((supporter) => (
                  <div
                    key={supporter.user_id}
                    className={cn(
                      "h-6 w-6 rounded-full border-2 border-card flex items-center justify-center text-[10px] font-bold",
                      colorScheme.supporterBg
                    )}
                    title={supporter.users?.username}
                  >
                    {supporter.users?.username?.charAt(0).toUpperCase() || "?"}
                  </div>
                ))}
                {supporters.length > 5 && (
                  <div className="h-6 w-6 rounded-full border-2 border-card bg-muted flex items-center justify-center text-[10px] font-bold">
                    +{supporters.length - 5}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Actions */}
          <div className="flex flex-col gap-2 pt-2">
            {isAgitation && !userHasSupported && !isUserSovereign && (
              <Button
                onClick={handleSupportRevoltion}
                disabled={isLoading || isUserSovereign}
                className={cn(
                  "w-full",
                  colorScheme.buttonBg,
                  colorScheme.buttonHover,
                  colorScheme.buttonText
                )}
              >
                {isLoading ? "Supporting..." : "Support The Revolt"}
              </Button>
            )}

            {isUserSovereign && isAgitation && (
              <div className="flex gap-2">
                <Button
                  onClick={handleRequestNegotiation}
                  disabled={isLoading || !!activeNegotiation}
                  className={cn(
                    "flex-1",
                    NEGOTIATION_COLOR_SCHEME.buttonBg,
                    NEGOTIATION_COLOR_SCHEME.buttonHover,
                    NEGOTIATION_COLOR_SCHEME.buttonText
                  )}
                >
                  <Handshake className="h-4 w-4" />
                  Negotiate
                </Button>
                <Button
                  onClick={handleExileLeader}
                  disabled={isLoading || rebellion.is_leader_exiled}
                  className="flex-1 bg-red-900/40 hover:bg-red-900/50 border border-red-500/50 text-red-200"
                >
                  Exile Leader
                </Button>
              </div>
            )}

            {userHasSupported && isAgitation && (
              <p className="text-xs text-amber-600 dark:text-amber-400 font-semibold">
                ✓ You are supporting this uprising
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Negotiation Modal */}
      {showNegotiationModal && activeNegotiation && (
        <NegotiationModal
          negotiationId={activeNegotiation.id}
          rebellionId={rebellion.id}
          isLeader={rebellion.leader_id === currentUserId}
          onClose={() => {
            setShowNegotiationModal(false);
            loadRebellion();
          }}
        />
      )}
    </>
  );
}
