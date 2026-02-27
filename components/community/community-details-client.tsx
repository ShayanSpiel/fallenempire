"use client";

import { formatCommunityColor, getCommunityAvatarUrl, getCommunityBannerUrl } from "@/lib/community-visuals";
import { hexToRgba, cn } from "@/lib/utils";
import { GOVERNANCE_TYPES } from "@/lib/governance";

import React, { useEffect, useRef, useState, useTransition, useMemo } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import {
  AlertCircle,
  Activity,
  Crown,
  Loader2,
  Lock,
  Users,
  Settings,
  Scale,
  Sparkles,
  Shield,
  Coins,
  ExternalLink,
  Building2,
  ScrollText,
} from "lucide-react";

import { borders } from "@/lib/design-system";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { CommunityFeedTab } from "@/components/community/community-feed-tab";
import { CommunityMemberSheet, type Member } from "./community-member-sheet";
import type { ChatSidebarEvent } from "@/lib/types/community";
import { PoliticsPanel } from "./politics-panel";
import { GovernanceHierarchy } from "./governance-hierarchy";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { H1 } from "@/components/ui/typography";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetClose,
} from "@/components/ui/sheet";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ColorPicker } from "@/components/ui/color-picker";
import { leaveCommunityAction, joinCommunityAction, updateCommunitySettingsAction } from "@/app/actions/community";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { showErrorToast, showCommunityToast } from "@/lib/toast-utils";
import { IdeologyDashboard } from "@/components/community/ideology-dashboard";
import type { IdeologySnapshot } from "@/lib/hooks/useIdeology";
import { RevolutionComponent } from "@/components/community/revolution-component";
import { MilitaryStatsPanel, type MilitaryMember } from "./military-stats-panel";
import { CommunityStatParts } from "./community-stat";
import { getRankLabel } from "@/lib/governance";
import { resolveAvatar } from "@/lib/avatar";
import { CommunityEconomyTab } from "./community-economy-tab";

const TAB_OPTIONS = ["Home", "Governance", "Politics", "Ideology", "Military", "Economy", "Buildings"] as const;
type CommunityTabOption = (typeof TAB_OPTIONS)[number];

const STANDARD_COMMUNITY_RADIUS = "rounded-[var(--tab-button-radius,var(--radius,0.75rem))]";

const COMMUNITY_TAB_LIST_CLASSES = cn(
  "grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-2 w-full",
  STANDARD_COMMUNITY_RADIUS
)

const COMMUNITY_TAB_TRIGGER_CLASSES = cn(
  "w-full text-xs sm:text-sm font-bold transition-all duration-200 whitespace-nowrap flex items-center justify-center gap-2",
  "hover:text-foreground",
  "last:col-span-2 md:last:col-span-1"
);

const COMMUNITY_TAB_ICONS: Record<CommunityTabOption, React.ReactNode> = {
  Home: <Building2 className="h-4 w-4" />,
  Governance: <Crown className="h-4 w-4" />,
  Politics: <Scale className="h-4 w-4" />,
  Ideology: <Sparkles className="h-4 w-4" />,
  Military: <Shield className="h-4 w-4" />,
  Economy: <Coins className="h-4 w-4" />,
  Buildings: <Building2 className="h-4 w-4" />,
};

const HEADER_STAT_BUTTON_CLASSES = cn(
  "group flex flex-col items-start px-3 py-2 rounded-lg bg-muted text-foreground transition-colors hover:bg-muted/80",
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-background focus-visible:ring-primary/50"
);

const formatGovernanceLabel = (type?: string | null) => {
  if (!type) {
    return "Governance";
  }

  const normalized = type.trim();
  if (!normalized) {
    return "Governance";
  }

  const normalizedKey = normalized.toLowerCase();
  const config = GOVERNANCE_TYPES[normalizedKey];
  if (config) {
    return config.label;
  }

  return normalized.charAt(0).toUpperCase() + normalized.slice(1);
};

type LatestAnnouncement = {
  title?: string | null;
  content?: string | null;
  metadata?: {
    title?: string | null;
    content?: string | null;
    message?: string | null;
  } | null;
} | null;

type CommunityRegion = {
  hex_id: string;
  custom_name?: string | null;
  resource_yield: number;
  fortification_level: number;
  last_conquered_at?: string | null;
};

type CommunityDetailsClientProps = {
  communityId: string;
  communityName: string;
  communitySlug: string;
  initialMembers: Member[];
  membersCount: number;
  averageMorale?: number | null;
  occupiedRegions?: CommunityRegion[];
  communityDescription?: string | null;
  communityColor?: string | null;
  communityGroupId?: string | null;
  showMembers?: boolean;
  onMembersChange?: (open: boolean) => void;
  isUserFounder: boolean;
  isUserMember?: boolean;
  governanceType?: string;
  currentUserId?: string | null;
  currentUsername?: string | null;
  currentAvatarUrl?: string | null;
  currentUserRankTier?: number | null;
  initialIdeology?: IdeologySnapshot | null;
  latestAnnouncement?: LatestAnnouncement;
  workTaxRate?: number | null;
  importTariffRate?: number | null;
};

export function CommunityDetailsClient({
  communityId,
  communityName,
  communitySlug,
  initialMembers,
  membersCount,
  averageMorale = null,
  occupiedRegions = [],
  communityDescription,
  communityColor,
  communityGroupId,
  showMembers,
  onMembersChange,
  isUserFounder,
  isUserMember = false,
  governanceType = "monarchy",
  currentUserId,
  currentUsername,
  currentAvatarUrl,
  initialIdeology,
  latestAnnouncement = null,
  workTaxRate = 0,
  importTariffRate = 0,
}: CommunityDetailsClientProps) {
  const [internalShowMembers, setInternalShowMembers] = useState(false);
  const [events, setEvents] = useState<ChatSidebarEvent[]>([]);
  const [isMember, setIsMember] = useState(isUserMember);
  const [isLeaveDialogOpen, setIsLeaveDialogOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [joinNotification, setJoinNotification] = useState<string | null>(null);
  const [autoOpenRegionsDrawer, setAutoOpenRegionsDrawer] = useState(false);
  const router = useRouter();
  const searchParams = useSearchParams();

  // Settings State - only initialize if user is founder
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [editName, setEditName] = useState(communityName);
  const [editBio, setEditBio] = useState(communityDescription || "");
  const [editColor, setEditColor] = useState(communityColor ?? "#3b82f6");
  const [isSaving, setIsSaving] = useState(false);

  const displayColor = formatCommunityColor(communityColor);
  const heroBannerImage = getCommunityBannerUrl({
    communityId,
    color: communityColor,
    seedSource: communityName,
  });
  const heroBannerStyle = heroBannerImage
    ? {
        backgroundColor: displayColor,
        backgroundImage: `url("${heroBannerImage}")`,
        backgroundSize: "cover",
        backgroundPosition: "center",
        backgroundRepeat: "no-repeat",
      }
    : {
        backgroundImage: `linear-gradient(135deg, ${displayColor} 0%, var(--card) 100%)`,
      };
  const governanceLabel = formatGovernanceLabel(governanceType);
  const announcementColor = displayColor;
  const communityAvatarUrl = getCommunityAvatarUrl({
    communityId,
    color: communityColor,
    seedSource: communityName,
  });
  const announcementBorderColor =
    hexToRgba(announcementColor, 0.45) ?? "rgba(124, 58, 237, 0.45)";
  const announcementBackgroundColor =
    hexToRgba(announcementColor, 0.12) ?? "rgba(124, 58, 237, 0.12)";
  const announcementAccentColor =
    hexToRgba(announcementColor, 0.9) ?? "rgba(124, 58, 237, 0.9)";
  const announcementGradient = `linear-gradient(135deg, ${
    hexToRgba(announcementColor, 0.24) ?? "rgba(124, 58, 237, 0.24)"
  } 0%, rgba(255, 255, 255, 0) 100%)`;
  const announcementTitle =
    latestAnnouncement?.metadata?.title ?? latestAnnouncement?.title ?? null;
  const announcementContent =
    latestAnnouncement?.metadata?.content ??
    latestAnnouncement?.metadata?.message ??
    latestAnnouncement?.content ??
    null;
  const hasAnnouncement = Boolean(announcementTitle || announcementContent);

  const handleLeaveCommunity = () => {
    startTransition(async () => {
      try {
        await leaveCommunityAction();
        router.refresh();
        setIsMember(false);
        setIsLeaveDialogOpen(false);
        showCommunityToast("You have left the community.", "success");
      } catch (error) {
        console.error("Leave failed", error);
        const message = (error as Error)?.message ?? "Please try again.";
        showCommunityToast(message, "error");
      }
    });
  };

  const handleJoinCommunity = () => {
    startTransition(async () => {
      setJoinNotification(null);
      try {
        const formData = new FormData();
        formData.append("communityId", communityId);
        const result = await joinCommunityAction(formData);

        if (result?.error) {
          const errorMessage = result.error;
          const isMemberOfAnother = errorMessage.toLowerCase().includes("another community");
          if (isMemberOfAnother) {
            setJoinNotification("You are already a member of another community. Leave it first to join this one.");
            showCommunityToast("Cannot join community", "error");
          } else {
            showErrorToast("Failed to join community", { description: errorMessage });
          }
          return;
        }

        router.refresh();
        setIsMember(true);
        showCommunityToast("Successfully joined community!", "success");
      } catch (error) {
        console.error("Join failed", error);
        const errorMessage = (error as Error)?.message ?? "Please try again.";
        showCommunityToast(errorMessage, "error");
      }
    });
  };

  const handleSidebarEvent = (event: ChatSidebarEvent) => {
    setEvents((prev) => [event, ...prev.filter((e) => e.id !== event.id)].slice(0, 6));
  };

  const [activeTab, setActiveTab] = useState("home");
  const validTabs = useMemo(() => new Set(TAB_OPTIONS.map((tab) => tab.toLowerCase())), []);
  const tabParam = searchParams.get("tab");
  const tabsListRef = useRef<HTMLDivElement | null>(null);
  const hasScrolledOnTabChange = useRef(false);

  const scrollToTabs = () => {
    const node = tabsListRef.current;
    if (!node) return;
    const scrollContainer = node.closest<HTMLElement>(".overflow-y-auto");
    const scrollPadding = 0;

    if (scrollContainer) {
      let offsetTop = 0;
      let current: HTMLElement | null = node;
      while (current && current !== scrollContainer) {
        offsetTop += current.offsetTop;
        current = current.offsetParent as HTMLElement | null;
      }
      if (current !== scrollContainer) {
        const containerTop = scrollContainer.getBoundingClientRect().top;
        const nodeTop = node.getBoundingClientRect().top;
        offsetTop = nodeTop - containerTop + scrollContainer.scrollTop;
      }
      const targetScroll = Math.max(offsetTop - scrollPadding, 0);

      scrollContainer.scrollTo({
        top: targetScroll,
        behavior: "smooth",
      });
      return;
    }

    node.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  const goToMoraleTab = () => {
    setActiveTab("ideology");
    scrollToTabs();
  };

  useEffect(() => {
    if (!hasScrolledOnTabChange.current) {
      hasScrolledOnTabChange.current = true;
      return;
    }
    const rafId = window.requestAnimationFrame(() => {
      scrollToTabs();
    });
    return () => window.cancelAnimationFrame(rafId);
  }, [activeTab]);

  useEffect(() => {
    if (!tabParam) return;
    const normalized = tabParam.toLowerCase();
    if (validTabs.has(normalized)) {
      setActiveTab(normalized);
    }
  }, [tabParam, validTabs]);

  const handleTabChange = (value: string) => {
    setActiveTab(value);
    const params = new URLSearchParams(searchParams.toString());
    if (value === "home") {
      params.delete("tab");
    } else {
      params.set("tab", value);
    }
    const query = params.toString();
    const path = `/community/${encodeURIComponent(communitySlug)}${query ? `?${query}` : ""}`;
    router.replace(path, { scroll: false });
  };

  const showMembersValue = showMembers ?? internalShowMembers;
  const updateShowMembers = (next: boolean) => {
    if (onMembersChange) {
      onMembersChange(next);
    } else {
      setInternalShowMembers(next);
    }
  };

  const activeMoraleValue =
    typeof averageMorale === "number" ? Math.round(averageMorale) : null;
  const moraleDisplayText = activeMoraleValue != null ? `${activeMoraleValue}%` : "—";
  const moraleTooltipText =
    activeMoraleValue != null
      ? `Community morale ${activeMoraleValue}%`
      : "Community morale unavailable";

  const handleSlugChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setEditName(e.target.value);
  };

  const saveSettings = async () => {
    if (!editName.trim()) {
      showErrorToast("Community name is required.");
      return;
    }

    if (!isUserFounder) {
      showErrorToast("Only community founders can modify settings.");
      return;
    }

    setIsSaving(true);
    try {
      const result = await updateCommunitySettingsAction(communityId, {
        name: editName,
        description: editBio,
        color: editColor
      });

      if (result.error) {
        showErrorToast("Failed to save settings", { description: result.error });
      } else {
        showCommunityToast("Community settings updated successfully!", "success");
        setIsSettingsOpen(false);
      }
    } catch (e) {
      console.error(e);
      showErrorToast("Failed to save settings", { description: "Please try again." });
    } finally {
      setIsSaving(false);
    }
  };

  const OfflineContent = ({ tab }: { tab: string }) => (
    <div className={`h-96 flex flex-col items-center justify-center ${borders.thin} border-dashed border-border/50 bg-muted/10 mt-6 ${STANDARD_COMMUNITY_RADIUS}`}>
      <Lock className="h-10 w-10 text-muted-foreground/30 mb-3" />
      <span className="text-muted-foreground font-mono text-sm uppercase tracking-widest">
        {tab} System Offline
      </span>
      <p className="text-xs text-muted-foreground mt-2">Module requires Level 2 clearance.</p>
    </div>
  );

  return (
    <>
      <div className="space-y-6">
        <Card className="overflow-hidden border-border/60 shadow-[var(--surface-shadow)]">
          <div className="relative h-[180px] sm:h-[200px] w-full overflow-hidden">
            <div className="h-full w-full" style={heroBannerStyle} />
            <div className="absolute inset-0 bg-gradient-to-t from-background/90 via-background/20 to-transparent" />
            <div className="absolute inset-x-0 bottom-0 h-20 bg-gradient-to-t from-background/95 via-background/80 to-transparent dark:from-card/95 dark:via-card/80" />
          </div>
          <CardContent className="pt-0 pb-6">
            <div className="flex flex-col md:flex-row items-start md:items-end gap-6 -mt-16 relative">
              <div className="shrink-0">
                <Avatar className="w-32 h-32 rounded-2xl border-[3px] border-background shadow-lg bg-gradient-to-br from-primary/80 to-primary dark:from-blue-600 dark:to-blue-500 text-white">
                  <AvatarImage
                    src={communityAvatarUrl}
                    alt={`${communityName ?? "Community"} emblem`}
                  />
                  <AvatarFallback className="text-2xl font-bold rounded-2xl">
                    {communityName?.[0] ?? "C"}
                  </AvatarFallback>
                </Avatar>
              </div>
              <div className="flex-1 flex flex-col gap-4 w-full min-w-0">
                <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4 w-full">
                  <div className="flex-1 min-w-0 w-full">
                    <div className="flex flex-col gap-2">
                      <div className="flex items-center gap-3 flex-wrap">
                        <H1 className="text-2xl lg:text-3xl font-bold tracking-tight">{communityName}</H1>
                        <Badge
                          variant="minimal"
                          className="flex items-center gap-1.5 text-[10px] uppercase tracking-[0.25em] text-muted-foreground px-2.5 py-1"
                        >
                          <Crown className="h-3 w-3 text-amber-500" />
                          {governanceLabel}
                        </Badge>
                      </div>
                      <p className="text-sm text-muted-foreground leading-relaxed line-clamp-2">
                        {communityDescription?.trim() || "No manifesto established."}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {isUserFounder && (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-10 w-10 p-0 text-muted-foreground hover:text-foreground transition-colors"
                        onClick={() => setIsSettingsOpen(true)}
                        title="Community settings (founder only)"
                      >
                        <Settings className="h-4 w-4" />
                      </Button>
                    )}
                    {isMember ? (
                      <Button
                        variant="destructive"
                        size="xl"
                        className="min-w-[140px]"
                        onClick={() => setIsLeaveDialogOpen(true)}
                        disabled={isPending}
                      >
                        {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Leave"}
                      </Button>
                    ) : (
                      <Button
                        variant="follow"
                        size="xl"
                        className="min-w-[140px]"
                        onClick={handleJoinCommunity}
                        disabled={isPending}
                      >
                        {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Join"}
                      </Button>
                    )}
                  </div>
                </div>
                <div className="flex items-start gap-3 flex-wrap">
                  <button
                    type="button"
                    onClick={() => updateShowMembers(true)}
                    className={HEADER_STAT_BUTTON_CLASSES}
                  >
                    <CommunityStatParts
                      label="Members"
                      icon={<Users size={12} className="text-muted-foreground" />}
                      value={membersCount.toLocaleString()}
                    />
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setAutoOpenRegionsDrawer(true);
                      handleTabChange("economy");
                    }}
                    className={HEADER_STAT_BUTTON_CLASSES}
                  >
                    <CommunityStatParts
                      label="Regions"
                      icon={<Shield size={12} className="text-muted-foreground" />}
                      value={occupiedRegions.length.toLocaleString()}
                    />
                  </button>
                  <button
                    type="button"
                    onClick={goToMoraleTab}
                    className={HEADER_STAT_BUTTON_CLASSES}
                    title={moraleTooltipText}
                  >
                    <CommunityStatParts
                      label="Morale"
                      icon={<Activity size={12} className="text-muted-foreground" />}
                      value={moraleDisplayText}
                    />
                  </button>
                  {communityGroupId && isMember && (
                    <Link
                      href={`/messages/group/${communityGroupId}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className={HEADER_STAT_BUTTON_CLASSES}
                    >
                      <CommunityStatParts
                        label="Chat"
                        icon={<ExternalLink size={12} className="text-muted-foreground" />}
                        value="Open"
                      />
                    </Link>
                  )}
                  {(() => {
                    const leader = initialMembers.find((m) => m.rank_tier === 0);
                    if (!leader) return null;

                    const leaderTitle = getRankLabel(governanceType, 0);
                    const leaderUsername = leader.username || "Unknown";
                    const leaderAvatarUrl = leader.avatar_url;

                    return (
                      <Link
                        href={`/profile/${leaderUsername}`}
                        className={cn(
                          "group flex flex-col items-end px-3 py-2 rounded-lg bg-muted text-foreground transition-colors hover:bg-muted/80",
                          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-background focus-visible:ring-primary/50"
                        )}
                      >
                        <span className="text-[9px] font-bold text-muted-foreground uppercase tracking-wider mb-0.5">
                          {leaderTitle}
                        </span>
                        <span className="text-sm font-bold text-foreground tabular-nums flex items-center gap-1.5">
                          <Avatar className="h-4 w-4 rounded-sm">
                            <AvatarImage
                              src={resolveAvatar({ avatarUrl: leaderAvatarUrl, seed: leaderUsername })}
                              alt={leaderUsername}
                            />
                            <AvatarFallback className="text-[10px] rounded-sm">
                              {leaderUsername[0]?.toUpperCase() || "?"}
                            </AvatarFallback>
                          </Avatar>
                          {leaderUsername}
                        </span>
                      </Link>
                    );
                  })()}
                </div>
              </div>
            </div>
         </CardContent>
        </Card>

        {/* MESSAGE_OF_THE_DAY Announcement Banner */}
        {hasAnnouncement && (
          <Card
            className="mt-6 border p-0 overflow-hidden"
            style={{
              borderColor: announcementBorderColor,
              backgroundColor: announcementBackgroundColor,
              backgroundImage: announcementGradient,
            }}
          >
            <CardContent className="space-y-3 px-6 py-6">
              <div className="flex items-start gap-3">
                <div
                  className="mt-2 flex-shrink-0 h-2 w-2 rounded-full"
                  style={{ backgroundColor: announcementAccentColor }}
                />
                <div className="flex-1 min-w-0">
                  <h3
                    className="text-lg font-bold"
                    style={{ color: announcementAccentColor }}
                  >
                    {announcementTitle ?? "Message of the Day"}
                  </h3>
                </div>
              </div>
              <p className="text-sm leading-relaxed ml-5 text-foreground/80">
                {announcementContent ?? "An announcement has been issued."}
              </p>
              <p className="text-xs ml-5 mt-3 text-muted-foreground">
                Posted by the Sovereign
              </p>
            </CardContent>
          </Card>
        )}

        {/* Join Notification */}
        {joinNotification && (
          <Card
            variant="subtle"
            className="border-amber-200/60 bg-amber-50/80 p-4"
          >
            <div className="flex items-start gap-3">
              <AlertCircle className="h-5 w-5 text-amber-600 flex-shrink-0 mt-0.5" />
              <p className="text-sm font-medium text-amber-900">{joinNotification}</p>
            </div>
          </Card>
        )}

      </div>

      {isUserMember && (
        <div className="w-full mt-6">
          <Tabs value={activeTab} onValueChange={handleTabChange} className="w-full space-y-6">
            <TabsList ref={tabsListRef} className={COMMUNITY_TAB_LIST_CLASSES}>
              {TAB_OPTIONS.map((tab) => (
                <TabsTrigger
                  key={tab}
                  value={tab.toLowerCase()}
                  size="lg"
                  className={COMMUNITY_TAB_TRIGGER_CLASSES}
                >
                  {COMMUNITY_TAB_ICONS[tab]}
                  <span>{tab}</span>
                </TabsTrigger>
              ))}
            </TabsList>

            <TabsContent
              value="home"
              className="outline-none mt-6 animate-in fade-in slide-in-from-bottom-2 duration-300"
            >
            <div className="grid grid-cols-1 gap-8 lg:grid-cols-[minmax(0,1fr)_320px] lg:gap-10">
                <CommunityFeedTab
                  communityId={communityId}
                  communityName={communityName}
                  communityGroupId={communityGroupId ?? null}
                  viewerProfile={{
                    id: currentUserId || "",
                    username: currentUsername ?? null,
                    identityLabel: null,
                    avatarUrl: currentAvatarUrl ?? null,
                  }}
                />
                <div className="lg:flex lg:flex-col lg:justify-start">
                  <div className="space-y-4">
                    <div className="bg-card border border-border/50 rounded-2xl p-6 shadow-[var(--surface-shadow)]">
                      <div className="flex items-center justify-between mb-6 pb-4 border-b border-border/60">
                        <h3 className="text-xs font-bold uppercase tracking-widest flex items-center gap-2 text-muted-foreground">
                          <ScrollText size={14} />
                          Events
                        </h3>
                      </div>
                      <div className="space-y-3">
                        {events.length === 0 ? (
                          <div className="text-center py-8">
                            <ScrollText className="h-10 w-10 mx-auto text-muted-foreground/30 mb-3" />
                            <p className="text-xs text-muted-foreground">No recent events</p>
                          </div>
                        ) : (
                          events.map((event) => (
                            <div
                              key={event.id}
                              className="p-3 rounded-lg border border-border/40 bg-card transition-colors hover:bg-muted/40"
                            >
                              <div className="flex items-start gap-2">
                                <div className="flex-1 min-w-0">
                                  <p className="text-xs font-semibold text-foreground line-clamp-2">
                                    {event.title}
                                  </p>
                                  <p className="text-[10px] text-muted-foreground mt-1">
                                    {event.time}
                                  </p>
                                </div>
                              </div>
                            </div>
                          ))
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </TabsContent>

            <TabsContent value="governance" className="outline-none mt-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
              <div className="space-y-6">
                {/* Governance Hierarchy */}
                {(() => {
                  const governanceMembers = initialMembers
                    .filter((m) => m.user_id)
                    .map((m) => ({
                      user_id: m.user_id!,
                      username: m.username || "Unknown",
                      avatar_url: m.avatar_url,
                      user_tier: m.user_tier ?? null,
                      rank_tier: m.rank_tier ?? 10,
                    }));
                  return (
                  <GovernanceHierarchy
                    communityId={communityId}
                    governanceType={governanceType}
                    members={governanceMembers}
                    isUserSovereign={isUserFounder}
                    currentUserId={currentUserId || ""}
                    onGovernanceEvent={handleSidebarEvent}
                  />
                  );
                })()}

                {/* Revolution Component - Last Component */}
                {isMember && currentUserId && (
                  <RevolutionComponent
                    communityId={communityId}
                    currentUserId={currentUserId}
                    sovereignId={
                      initialMembers.find((m) => m.rank_tier === 0)?.user_id
                    }
                    communityName={communityName}
                    isUserSovereign={isUserFounder}
                  />
                )}
              </div>
            </TabsContent>

            <TabsContent
              value="politics"
              className="outline-none mt-6 animate-in fade-in slide-in-from-bottom-2 duration-300"
            >
              <PoliticsPanel
                communityId={communityId}
                userRank={
                  isUserFounder
                    ? 0 // Founder is always rank 0 (sovereign)
                    : initialMembers.find((m) => m.user_id === currentUserId)?.rank_tier ?? 10
                }
                governanceType={governanceType}
                communityColor={communityColor}
              />
            </TabsContent>

	            <TabsContent value="ideology" className="outline-none mt-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
	              <IdeologyDashboard
	                communityId={communityId}
	                communityName={communityName}
	                governanceType={governanceType}
	                isSovereign={isUserFounder}
	                initialIdeology={initialIdeology}
	              />
	            </TabsContent>

            <TabsContent value="military" className="outline-none mt-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
              <div className="space-y-6">
                {(() => {
                  const militaryMembers: MilitaryMember[] = initialMembers
                    .filter((m) => m.user_id)
                    .map((m) => ({
                      user_id: m.user_id!,
                      username: m.username || "Unknown",
                      avatar_url: m.avatar_url,
                      user_tier: m.user_tier ?? null,
                      military_rank_score: m.military_rank_score ?? 0,
                      battles_fought: m.battles_fought ?? 0,
                      battles_won: m.battles_won ?? 0,
                      total_damage_dealt: m.total_damage_dealt ?? 0,
                      strength: m.strength ?? 0,
                      win_streak: m.win_streak ?? 0,
                      last_battle_at: m.updated_at,
                    }));
                  return (
                    <MilitaryStatsPanel
                      communityId={communityId}
                      communityName={communityName}
                      members={militaryMembers}
                    />
                  );
                })()}
              </div>
            </TabsContent>

            <TabsContent value="economy" className="outline-none mt-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
              <CommunityEconomyTab
                communityId={communityId}
                communityName={communityName ?? "Community"}
                autoOpenDrawer={autoOpenRegionsDrawer}
                workTaxRate={workTaxRate}
                importTariffRate={importTariffRate}
              />
            </TabsContent>

            <TabsContent value="buildings" className="outline-none mt-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
              <div className="flex flex-col items-center justify-center py-20">
                <Building2 className="h-16 w-16 text-muted-foreground/30 mb-4" />
                <h3 className="text-xl font-bold text-foreground mb-2">Buildings</h3>
                <p className="text-sm text-muted-foreground">Coming soon</p>
              </div>
            </TabsContent>
          </Tabs>
        </div>
      )}

      {/* Settings Sheet - Founder Only */}
      {isUserFounder && (
        <Sheet open={isSettingsOpen} onOpenChange={setIsSettingsOpen}>
          <SheetContent className="w-full sm:max-w-md p-0 flex flex-col gap-0 bg-background/95 backdrop-blur-xl">
            {/* Header */}
            <SheetHeader className="px-6 py-6 border-b border-border/60">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-muted text-muted-foreground">
                  <Settings size={18} />
                </div>
                <div className="flex-1">
                  <SheetTitle className="text-base font-bold">Community Settings</SheetTitle>
                  <SheetDescription className="text-[11px] font-medium text-muted-foreground uppercase tracking-[0.1em] mt-1">
                    Founder access only
                  </SheetDescription>
                </div>
              </div>
            </SheetHeader>

            {/* Content */}
            <div className="flex-1 overflow-y-auto">
              <div className="px-6 py-6 space-y-8">
                {/* Community Name */}
                <div className="space-y-3">
                  <Label htmlFor="community-name" className="text-xs font-semibold uppercase tracking-[0.1em] text-muted-foreground">
                    Community Name
                  </Label>
                  <Input
                    id="community-name"
                    value={editName}
                    onChange={handleSlugChange}
                    placeholder="Enter community name..."
                    className="h-11 rounded-lg bg-muted/30 border-border/60 text-sm font-medium"
                  />
                  <p className="text-[11px] font-mono text-muted-foreground/70">
                    URL: {editName.toLowerCase().replace(/\s+/g, "-") || "community"}
                  </p>
                </div>

                {/* Manifesto / Bio */}
                <div className="space-y-3">
                  <Label htmlFor="community-bio" className="text-xs font-semibold uppercase tracking-[0.1em] text-muted-foreground">
                    Manifesto
                  </Label>
                  <Textarea
                    id="community-bio"
                    value={editBio}
                    onChange={(e) => setEditBio(e.target.value)}
                    placeholder="Define your community's purpose and values..."
                    className="min-h-[100px] resize-none rounded-lg bg-muted/30 border-border/60 text-sm leading-relaxed"
                  />
                  <p className="text-[11px] text-muted-foreground/70">
                    {editBio.length} / 500 characters
                  </p>
                </div>

                {/* Signal Color */}
                <div className="space-y-3">
                  <Label className="text-xs font-semibold uppercase tracking-[0.1em] text-muted-foreground">
                    Signal Color
                  </Label>
                  <div className="p-4 rounded-lg border border-border/60 bg-muted/20">
                    <div className="flex items-center gap-4">
                      <div
                        className="h-14 w-14 rounded-lg border border-border/60 shadow-sm"
                        style={{ backgroundColor: editColor }}
                      />
                      <div className="flex-1">
                        <ColorPicker value={editColor} onChange={setEditColor} />
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Footer */}
            <div className="px-6 py-6 border-t border-border/60 bg-muted/10 space-y-3">
              <div className="flex gap-3">
                <SheetClose asChild>
                  <Button
                    variant="outline"
                    className="flex-1 rounded-lg font-semibold text-xs uppercase tracking-[0.1em]"
                    disabled={isSaving}
                  >
                    Cancel
                  </Button>
                </SheetClose>
                <Button
                  onClick={saveSettings}
                  disabled={isSaving}
                  className="flex-1 rounded-lg font-semibold text-xs uppercase tracking-[0.1em]"
                >
                  {isSaving ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      SAVING
                    </>
                  ) : (
                    "SAVE CHANGES"
                  )}
                </Button>
              </div>
            </div>
          </SheetContent>
        </Sheet>
      )}

      {/* Drawers */}
      <CommunityMemberSheet
        communityName={communityName}
        members={initialMembers}
        isOpen={showMembersValue}
        onOpenChange={updateShowMembers}
        governanceType={governanceType}
      />

      {/* Leave Community Dialog */}
      <AlertDialog open={isLeaveDialogOpen} onOpenChange={setIsLeaveDialogOpen}>
      <AlertDialogContent
        className={`max-w-sm ${STANDARD_COMMUNITY_RADIUS}`}
        overlayProps={{
          onPointerDown: () => setIsLeaveDialogOpen(false),
        }}
      >
          <AlertDialogHeader className="space-y-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-red-500/10 text-red-600 mb-2">
              <AlertCircle size={20} />
            </div>
            <AlertDialogTitle className="text-lg font-bold">Leave {communityName}?</AlertDialogTitle>
	            <AlertDialogDescription className="text-sm leading-relaxed">
	              You will lose access to this community&apos;s channels, chat, and member-only features. You can rejoin anytime.
	            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="gap-3 pt-6">
            <div className="flex w-full flex-col gap-3 sm:flex-row sm:justify-between sm:max-w-[340px] sm:mx-auto">
              <AlertDialogCancel asChild>
                <Button variant="outline" size="sm" className="flex-1 font-semibold">
                  Keep membership
                </Button>
              </AlertDialogCancel>
              <AlertDialogAction asChild>
                <Button
                  variant="destructive"
                  size="sm"
                  className="flex-1 font-semibold"
                  onClick={handleLeaveCommunity}
                  disabled={isPending}
                >
                  {isPending ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Leaving
                    </>
                  ) : (
                    "Leave Community"
                  )}
                </Button>
              </AlertDialogAction>
            </div>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
