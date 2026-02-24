"use client";

import Image from "next/image";
import Link from "next/link";
import React from "react";
import {
  Users,
  MapPin,
  Calendar,
  Share2,
  Medal,
  Shield,
  Target,
  Swords,
  Dumbbell,
  Flame,
  Dna,
  Activity,
  BrainCog,
  Brain,
  BrainCircuit,
  Info,
  Star,
  Package,
  Settings,
  Mail,
  Heart,
  HeartHandshake,
} from "lucide-react";
import { MilitaryService } from "@/components/profile/military-service";
import { AvatarUpload } from "@/components/profile/avatar-upload";
import { cn } from "@/lib/utils";
import { borders, layout } from "@/lib/design-system";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { resolveAvatar } from "@/lib/avatar";
import { toggleFollowUser } from "@/app/actions/follows";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
  TooltipProvider,
} from "@/components/ui/tooltip";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Progress } from "@/components/ui/progress";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { SectionHeading } from "@/components/ui/section-heading";
import { H1, H2, H3, Meta, Small } from "@/components/ui/typography";
import {
  Radar,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  ResponsiveContainer,
} from "recharts";
import { DEFAULT_IDENTITY_VECTOR, type IdentityVector, type TraitKey } from "@/lib/psychology";
import { calculateLevelFromXp } from "@/lib/progression";
import { LevelAvatarRing } from "@/components/progression/level-avatar-ring";
import { LevelProgressBar } from "@/components/progression/level-progress-bar";
import { MoraleAvatarRing } from "@/components/morale/morale-avatar-ring";
import type { ProfileViewModel } from "./profile-data";
import { PageSection } from "@/components/layout/page-section";
import { IdentityLabel } from "@/components/ui/identity-label";
import { MedalBadge } from "@/components/medals/medal-badge";
import { MoraleBar } from "@/components/ui/morale-bar";
import { SpectrumBar } from "@/components/ui/spectrum-bar";
import { getCommunityAvatarUrl } from "@/lib/community-visuals";
import { ENERGY_CAP } from "@/lib/gameplay/constants";
import { useOptionalUserVitals } from "@/components/layout/user-vitals";
import { useUserStats } from "@/lib/hooks/useUserStats";

function StatSpectrum({
  label,
  value,
  max = 100,
  color = "primary",
  icon: Icon,
  tooltip,
}: {
  label: string;
  value: number;
  max?: number;
  color?: "primary" | "secondary" | "success" | "warning" | "destructive";
  icon?: any;
  tooltip?: string;
}) {
  const percent = Math.min(100, Math.max(0, (value / max) * 100));

  return (
    <div className="flex-1 group min-w-0">
      <div className="flex justify-between items-center mb-3">
        <div className="flex items-center gap-2 text-muted-foreground">
          {Icon && <Icon size={16} />}
          <div className="flex items-center gap-1">
            <Small className="!text-foreground/80 font-bold">{label}</Small>
            {tooltip && (
              <TooltipProvider delayDuration={0}>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Info
                      size={10}
                      className="text-muted-foreground/40 hover:text-primary transition-colors cursor-help"
                    />
                  </TooltipTrigger>
                  <TooltipContent className="text-xs">{tooltip}</TooltipContent>
                </Tooltip>
              </TooltipProvider>
            )}
          </div>
        </div>
        <span className="text-xl font-black text-foreground tabular-nums">{value}</span>
      </div>

      <Progress value={percent} size="lg" color={color} className="mb-2" />
      <div className="flex justify-between text-[10px] font-medium text-muted-foreground/50 font-mono">
        <span>0</span>
        <span>{max}</span>
      </div>
    </div>
  );
}

function MedalIcon({
  icon: Icon,
  color,
  label,
  ringColor,
}: {
  icon: any;
  color: string;
  label: string;
  ringColor: string;
}) {
  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <div
            className={cn(
              `${layout.sizes.avatar.md} rounded-full flex items-center justify-center bg-card ${borders.thin} ${borders.subtle} transition-all hover:-translate-y-1 cursor-pointer`,
              ringColor
            )}
          >
            <Icon size={20} strokeWidth={2} className={color} />
          </div>
        </TooltipTrigger>
        <TooltipContent className="bg-primary text-primary-foreground text-xs font-bold border-0 py-1.5 px-3 rounded-md">
          {label}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

const decorationPlaceholders = [
  {
    id: "placeholder-keyboard",
    label: "Keyboard AI",
    imageUrl: "https://i.ibb.co/8DCncRL4/A-keyboard-AI.png",
    count: 0,
  },
  {
    id: "placeholder-commander",
    label: "Commander",
    imageUrl: "https://i.ibb.co/cXrL0W0W/Commander.png",
    count: 0,
  },
  {
    id: "placeholder-victory",
    label: "Victory Hand",
    imageUrl: "https://i.ibb.co/N6vL87KC/support.png",
    count: 0,
  },
];

function DecorationPlaceholder({
  imageUrl,
  label,
  count = 0,
}: {
  imageUrl: string;
  label: string;
  count?: number;
}) {
  const [imageError, setImageError] = React.useState(false);

  return (
    <div className="flex flex-col items-center gap-2">
      <div className="relative w-16 h-16 flex items-center justify-center">
        {!imageError ? (
          <Image
            src={imageUrl}
            alt={label}
            width={64}
            height={64}
            className="w-full h-full object-contain"
            unoptimized
            onError={() => setImageError(true)}
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center bg-muted/40 rounded border border-border/40">
            <Medal size={32} className="text-muted-foreground/40" />
          </div>
        )}
      </div>
      <div className="relative px-2 py-1 rounded-md text-xs font-bold bg-gradient-to-r from-amber-900 to-slate-900 text-amber-300">
        <span className="tabular-nums">{count}</span>
      </div>
      <span className="sr-only">{label}</span>
    </div>
  );
}

export function ProfileView({
  profile,
  followerCount,
  followingCount,
  isFollowing,
  isOwnProfile,
  community,
  activityLog,
  medals,
  medalSummary,
}: ProfileViewModel) {
  const vitals = useOptionalUserVitals();

  // Subscribe to real-time user stats
  const { stats: realtimeStats } = useUserStats(profile.id);

  // Get labels for identity trait axes
  const getTraitLabels = (key: TraitKey): { leftLabel: string; rightLabel: string } => {
    const labels: Record<TraitKey, { leftLabel: string; rightLabel: string }> = {
      order_chaos: { leftLabel: "Order", rightLabel: "Chaos" },
      self_community: { leftLabel: "Individual", rightLabel: "Collective" },
      logic_emotion: { leftLabel: "Logic", rightLabel: "Emotion" },
      power_harmony: { leftLabel: "Power", rightLabel: "Harmony" },
      tradition_innovation: { leftLabel: "Tradition", rightLabel: "Innovation" },
    };
    return labels[key] || { leftLabel: "Left", rightLabel: "Right" };
  };

  const identity: IdentityVector = profile.identity_json ?? DEFAULT_IDENTITY_VECTOR;

  const [following, setFollowing] = React.useState(isFollowing);
  const [isLoading, setIsLoading] = React.useState(false);
  const [avatarUrl, setAvatarUrl] = React.useState(profile.avatar_url ?? null);

  const handleFollowToggle = async () => {
    setIsLoading(true);
    try {
      const result = await toggleFollowUser(profile.id, following);
      if (result.success) {
        setFollowing((prev) => !prev);
      } else {
        console.error("Failed to toggle follow:", result.error);
      }
    } catch (error) {
      console.error("Error toggling follow:", error);
    } finally {
      setIsLoading(false);
    }
  };

  // Calculate progression data
  const totalXp = (profile as any).total_xp ?? 0;
  const progression = calculateLevelFromXp(totalXp);

  // Use real-time morale if available, fallback to profile data
  const currentMorale = realtimeStats?.morale ?? profile.morale;
  const resolvedMorale =
    typeof currentMorale === "number" && !Number.isNaN(currentMorale)
      ? Math.round(Math.max(0, Math.min(100, currentMorale)))
      : 50;
  const focusValue = resolvedMorale;
  const rageValue = 0; // Rage system deprecated in favor of morale
  const moraleBarValue = resolvedMorale * 2 - 100;

  const normalizeCoherenceToPercent = (coherence: number) => {
    if (!Number.isFinite(coherence)) return 50;
    if (coherence >= -1.01 && coherence <= 1.01) {
      return Math.round(((coherence + 1) / 2) * 100);
    }
    return Math.round(Math.max(0, Math.min(100, coherence)));
  };

  const coherencePercent = normalizeCoherenceToPercent(profile.coherence ?? 0);

  const resolvedEnergy =
    isOwnProfile && vitals?.userId === profile.id
      ? Math.max(0, Math.min(ENERGY_CAP, vitals.energy))
      : typeof profile.energy === "number" && !Number.isNaN(profile.energy)
        ? Math.max(0, Math.min(ENERGY_CAP, profile.energy))
        : ENERGY_CAP;
  const energyPercent = (resolvedEnergy / ENERGY_CAP) * 100;

  const radarData = [
    { subject: "Order", A: ((identity.order_chaos ?? 0) + 1) * 50, fullMark: 100 },
    { subject: "Tribe", A: ((identity.self_community ?? 0) + 1) * 50, fullMark: 100 },
    { subject: "Logic", A: ((identity.logic_emotion ?? 0) + 1) * 50, fullMark: 100 },
    { subject: "Power", A: ((identity.power_harmony ?? 0) + 1) * 50, fullMark: 100 },
    { subject: "Tradition", A: ((identity.tradition_innovation ?? 0) + 1) * 50, fullMark: 100 },
  ];

  const traitOrder: TraitKey[] = [
    "order_chaos",
    "self_community",
    "logic_emotion",
    "power_harmony",
    "tradition_innovation",
  ];
  const traits = traitOrder.map((key) => ({
    key,
    label: key.replace("_", " vs "),
    value: Math.round(((identity[key] ?? 0) + 1) * 50),
    color: "bg-foreground",
  }));

  const bannerStyle = profile.banner_url
    ? {
        backgroundImage: `url(${profile.banner_url})`,
        backgroundSize: "cover",
        backgroundPosition: "center",
      }
    : undefined;

  return (
    <PageSection>
      <div className="space-y-8">
      <section>
        <Card className="overflow-hidden">
          <div className="relative h-[220px] w-full">
            {bannerStyle ? (
              <div className="h-full w-full" style={bannerStyle} />
            ) : (
              <div className="h-full w-full bg-gradient-to-r from-muted/70 via-card to-muted/60" />
            )}
            <div className="absolute inset-0 bg-gradient-to-b from-transparent via-transparent to-background/40" />
            <div
              className="absolute inset-x-0 bottom-0 h-40 pointer-events-none"
              style={{
                backgroundImage:
                  "linear-gradient(180deg, rgba(255,255,255,0) 0%, var(--card) 65%, var(--card) 100%)",
              }}
            />
          </div>
          <CardContent className="pt-0 pb-8">
            {/* Avatar and header row */}
            <div className="flex flex-col md:flex-row items-center md:items-end gap-6 mb-4 -mt-3">
              <div className="shrink-0 mx-auto md:mx-0" style={{ marginTop: "-32px" }}>
                {profile.is_bot ? (
                  <MoraleAvatarRing morale={profile.morale ?? 50} size="lg">
                    <AvatarUpload
                      avatarUrl={avatarUrl}
                      seed={profile.username ?? "agent"}
                      fallback={profile.username?.[0] ?? "?"}
                      isOwn={isOwnProfile}
                      onUploadSuccess={setAvatarUrl}
                      size="lg"
                    />
                  </MoraleAvatarRing>
                ) : (
                  <LevelAvatarRing
                    level={progression.level}
                    progressPercent={progression.progressPercent}
                    size="lg"
                    showBadge
                  >
                    <AvatarUpload
                      avatarUrl={avatarUrl}
                      seed={profile.username ?? "agent"}
                      fallback={profile.username?.[0] ?? "?"}
                      isOwn={isOwnProfile}
                      onUploadSuccess={setAvatarUrl}
                      size="lg"
                    />
                  </LevelAvatarRing>
                )}
              </div>

              <div className="flex-1 flex flex-col justify-between gap-4 h-full mb-1">
                <div className="flex flex-col md:flex-row items-top justify-between gap-3 w-full">
                  <div className="w-full text-center md:text-left">
                    <h1 className="text-3xl font-extrabold text-foreground tracking-tight text-center md:text-left">
                      {profile.username ?? "Anonymous"}
                    </h1>
                    <IdentityLabel
                      label={profile.identity_label ?? "Unclassified Entity"}
                      className="block mt-1 text-center md:text-left"
                    />
                  </div>
                  <div className="flex w-full md:w-auto justify-center md:justify-end gap-2">
                    {isOwnProfile ? (
                      <>
                        <Link href="/inventory" className="w-full max-w-[260px] md:max-w-[none]">
                          <Button
                            type="button"
                            size="xl"
                            variant="ghost"
                            className="w-full"
                          >
                            <Package size={18} className="mr-2" />
                            Inventory
                          </Button>
                        </Link>
                        <Link href="/settings" className="w-full max-w-[260px] md:max-w-[none]">
                          <Button
                            type="button"
                            size="xl"
                            variant="ghost"
                            className="w-full"
                          >
                            <Settings size={18} className="mr-2" />
                            Settings
                          </Button>
                        </Link>
                      </>
                    ) : (
                      <>
                        <Link href={`/messages/${profile.id}`} className="w-full max-w-[260px] md:max-w-[none]">
                          <Button
                            type="button"
                            size="xl"
                            variant="ghost"
                            className="w-full"
                          >
                            <Mail size={18} className="mr-2" />
                            Message
                          </Button>
                        </Link>
                        <Button
                          type="button"
                          size="xl"
                          variant="follow"
                          className="w-full max-w-[260px] md:max-w-[none]"
                          onClick={handleFollowToggle}
                          disabled={isLoading}
                          aria-pressed={following}
                        >
                          {isLoading ? "..." : following ? "Unfollow" : "Follow"}
                        </Button>
                      </>
                    )}
                  </div>
                </div>

                <div className="flex flex-col md:flex-row items-center md:items-end justify-between gap-4 text-xs font-medium uppercase tracking-wide text-muted-foreground/70">
                  <div className="flex flex-wrap justify-center gap-4 md:justify-start items-center">
                    <span className="flex items-center gap-1.5">
                      <MapPin size={14} className="text-red-500" />{" "}
                      {(profile as any).current_location_name || "Uncharted Territory"}
                    </span>
                    <span className="flex items-center gap-1.5">
                      <Calendar size={14} />{" "}
                      {new Date(profile.created_at || Date.now()).toLocaleDateString()}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 text-xs font-semibold text-foreground/70 tracking-wide">
                    <span>{followerCount} Followers</span>
                    <span className="text-muted-foreground/70">|</span>
                    <span>{followingCount} Following</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Progress bar below avatar - minimal style */}
            <div>
              <LevelProgressBar
                level={progression.level}
                xpInLevel={progression.xpInLevel}
                xpForNextLevel={progression.xpForNextLevel}
                progressPercent={progression.progressPercent}
              />
            </div>
          </CardContent>
        </Card>
      </section>

      <section>
        <Card>
          <CardContent className="space-y-4">
            <SectionHeading
              title="Decorations"
              icon={Medal}
              actions={<Meta>{medals.length} Total</Meta>}
            />
            <div className="flex flex-wrap gap-8">
              {decorationPlaceholders.map((placeholder) => (
                <DecorationPlaceholder
                  key={placeholder.id}
                  imageUrl={placeholder.imageUrl}
                  label={placeholder.label}
                  count={placeholder.count}
                />
              ))}
              {medalSummary.length > 0 &&
                medalSummary.map((summary) => (
                  <MedalBadge
                    key={summary.key}
                    medalKey={summary.key}
                    name={summary.name}
                    count={summary.count}
                    description={summary.description}
                    earnedAt={summary.firstEarnedAt}
                  />
                ))}
            </div>
            {medalSummary.length === 0 && (
              <p className="text-sm text-muted-foreground">No medals earned yet. Keep playing to unlock achievements!</p>
            )}
          </CardContent>
        </Card>
      </section>

      {/* Military Service Section */}
      <section>
        <MilitaryService
          rank={profile.current_military_rank || 'Recruit'}
          battlesFought={profile.battles_fought || 0}
          battlesWon={profile.battles_won || 0}
          totalDamage={profile.total_damage_dealt || 0}
          highestDamage={profile.highest_damage_battle || 0}
          winStreak={profile.win_streak || 0}
          strength={profile.power_physical || 0}
          battleHeroMedals={(profile as any).battle_hero_medals || 0}
          focus={focusValue}
          rage={rageValue}
        />
      </section>

      <section className="grid grid-cols-1 lg:grid-cols-[2fr_1fr] gap-8">
        <div className="space-y-8">
          <Card>
            <CardContent className="space-y-6">
              <SectionHeading
                title="Physical Power"
                icon={Swords}
                tooltip="Combat strength and physical capabilities."
              />
              <div className="flex flex-col md:flex-row gap-8 md:gap-12">
                <StatSpectrum
                  label="Strength"
                  value={profile.power_physical ?? 0}
                  icon={Dumbbell}
                  color="primary"
                  tooltip="Your physical strength from training."
                />
                <div className="hidden md:block w-px bg-border/40 h-16 self-center" />
                <div className="flex-1 min-w-0">
                  <div className="flex justify-between items-center mb-3">
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <Heart size={16} />
                      <Small className="!text-foreground/80 font-bold">Energy</Small>
                    </div>
                    <span className="text-xl font-black text-green-500 tabular-nums">{resolvedEnergy}</span>
                  </div>
                  <Progress value={energyPercent} size="lg" color="success" className="mb-2" />
                  <div className="flex justify-between text-[10px] font-medium text-muted-foreground/50 font-mono">
                    <span>0</span>
                    <span>{ENERGY_CAP}</span>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="space-y-6">
              <SectionHeading
                title="Mental Power"
                icon={Brain}
                tooltip="Your psychological state, coherence, and influence metrics."
              />
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <StatSpectrum
                  label="Mental Power"
                  value={profile.power_mental ?? 50}
                  icon={Brain}
                  color="primary"
                  tooltip="Long term reputation and influence from structured thoughts and consistent behaviors."
                />
                <StatSpectrum
                  label="Freewill"
                  value={profile.freewill ?? 50}
                  icon={BrainCog}
                  color="success"
                  tooltip="Autonomy level from activity diversity + morale + coherence. Higher = You're not an NPC!"
                />
                <StatSpectrum
                  label="Coherence"
                  value={coherencePercent}
                  icon={BrainCircuit}
                  color="warning"
                  tooltip="Alignment between your identity and actions (Are you being what you claim to be?)"
                />
                <div className="flex-1 group min-w-0">
                  <MoraleBar
                    morale={moraleBarValue}
                    showLabel={true}
                    showTooltip={true}
                    compact={false}
                    barContainerClassName="h-3"
                    showSpectrumLabels={false}
                    label={
                      <span className="flex items-center gap-2">
                        <HeartHandshake className="h-4 w-4 text-amber-500" />
                        Morale
                      </span>
                    }
                    tooltipText="Your happiness/energy level - affects your quality of life!"
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="space-y-6">
              <SectionHeading
                title="Identity Profile"
                icon={Target}
                tooltip="Your position across 5 core personality dimensions."
              />
              <div className="flex flex-col md:flex-row gap-8 items-center">
                <div className="w-full md:w-1/2 h-[260px] relative">
                  <ResponsiveContainer width="100%" height="100%">
                    <RadarChart cx="50%" cy="50%" outerRadius="80%" data={radarData}>
                      <defs>
                        <linearGradient id="radarGradientLight" x1="0" y1="0" x2="1" y2="1">
                          <stop offset="0%" stopColor="hsl(45, 90%, 55%)" stopOpacity={0.8} />
                          <stop offset="100%" stopColor="hsl(35, 85%, 45%)" stopOpacity={0.4} />
                        </linearGradient>
                        <linearGradient id="radarGradientDark" x1="0" y1="0" x2="1" y2="1">
                          <stop offset="0%" stopColor="hsl(220, 85%, 65%)" stopOpacity={0.8} />
                          <stop offset="100%" stopColor="hsl(240, 90%, 55%)" stopOpacity={0.4} />
                        </linearGradient>
                      </defs>
                      <PolarGrid stroke="var(--border)" strokeOpacity={0.3} />
                      <PolarAngleAxis
                        dataKey="subject"
                        tick={{ fill: "var(--muted-foreground)", fontSize: 10, fontWeight: 700 }}
                      />
                      <PolarRadiusAxis angle={30} domain={[0, 100]} tick={false} axisLine={false} />
                      <Radar
                        name="Identity"
                        dataKey="A"
                        stroke="hsl(var(--primary))"
                        strokeWidth={2.5}
                        fill="url(#radarGradientLight)"
                        fillOpacity={1}
                        className="dark:fill-[url(#radarGradientDark)]"
                      />
                    </RadarChart>
                  </ResponsiveContainer>
                </div>

                <div className="w-full md:w-1/2 space-y-4">
                  {traits.map((trait) => {
                    const { leftLabel, rightLabel } = getTraitLabels(trait.key);
                    return (
                      <SpectrumBar
                        key={trait.key}
                        value={identity[trait.key] ?? 0}
                        leftLabel={leftLabel}
                        rightLabel={rightLabel}
                        showLabels={true}
                        showValue={false}
                        interactive={true}
                        tooltip={`Your position on the ${leftLabel}-${rightLabel} spectrum.`}
                      />
                    );
                  })}
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <aside className="space-y-8">
          <Card>
            <CardContent className="space-y-4">
              <SectionHeading
                title="Community"
                icon={Users}
                tooltip="The community you belong to and represent."
              />

              {community ? (
                <>
                  <Link
                    href={`/community/${community.slug || community.id}`}
                    className="flex items-center gap-3 p-3 rounded-lg border border-border/40 bg-card transition-colors hover:bg-muted/40 group"
                  >
                    <Avatar className="h-8 w-8 rounded-lg border border-border bg-card">
                      <AvatarImage
                        src={getCommunityAvatarUrl({
                          communityId: community.id,
                          color: community.color || null,
                          seedSource: community.name || undefined,
                        })}
                        alt={`${community.name || 'Community'} sigil`}
                      />
                      <AvatarFallback className="rounded-lg text-xs">
                        {(community.name || 'Co').substring(0, 2)}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <h3 className="text-sm font-bold text-foreground leading-none truncate">
                        {community.name}
                      </h3>
                      <p className="text-xs text-muted-foreground mt-1 truncate">{community.ideology_label}</p>
                    </div>
                  </Link>

                  <div className="flex items-center gap-4 pt-2">
                    <div className="flex flex-col flex-1">
                      <span className="text-[9px] font-bold text-muted-foreground uppercase tracking-wider mb-0.5">
                        Members
                      </span>
                      <span className="text-sm font-bold text-foreground tabular-nums flex items-center gap-1.5">
                        <Users size={12} className="text-muted-foreground" />
                        {community.members_count}
                      </span>
                    </div>
                    <div className="flex flex-col flex-1">
                      <span className="text-[9px] font-bold text-muted-foreground uppercase tracking-wider mb-0.5">
                        Regions
                      </span>
                      <span className="text-sm font-bold text-foreground tabular-nums flex items-center gap-1.5">
                        <Shield size={12} className="text-muted-foreground" />
                        {community.regions_count || 0}
                      </span>
                    </div>
                    <div className="flex flex-col flex-1">
                      <span className="text-[9px] font-bold text-muted-foreground uppercase tracking-wider mb-0.5">
                        Morale
                      </span>
                      <span className="text-sm font-bold text-foreground tabular-nums flex items-center gap-1.5">
                        <Activity size={12} className="text-muted-foreground" />
                        {community.average_morale?.toFixed(0) || 0}%
                      </span>
                    </div>
                  </div>
                </>
              ) : (
                <div className="text-center py-8 text-muted-foreground text-sm">No community.</div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardContent className="space-y-4">
              <SectionHeading title="Activity Log" icon={Share2} />
              <ScrollArea className="h-[420px]">
                <div className="space-y-4 pr-4">
                  {activityLog.length > 0 ? (
                    activityLog.map((log) => (
                      <div key={log.id} className="flex items-start gap-2.5">
                        <span
                          className={cn(
                            "mt-1 flex-shrink-0 inline-flex size-2 rounded-full ring-1 ring-offset-1 ring-offset-background transition-all",
                            log.type === "post"
                              ? "bg-primary ring-primary/60"
                              : "bg-muted-foreground/40 ring-border"
                          )}
                        />
                        <div className="space-y-0.5 flex-1 min-w-0">
                          <p className="text-sm font-medium text-foreground leading-relaxed">{log.content}</p>
                          <div className="flex flex-wrap items-center gap-1.5">
                            <Meta className="capitalize">{log.type}</Meta>
                            <span className="flex-shrink-0 size-0.5 rounded-full bg-border" />
                            <Meta>{log.dateLabel}</Meta>
                          </div>
                        </div>
                      </div>
                    ))
                  ) : (
                    <p className="text-sm text-muted-foreground">No recent activity.</p>
                  )}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>
        </aside>
      </section>
      </div>
    </PageSection>
  );
}
