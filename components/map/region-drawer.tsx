"use client";

import React, { type ReactNode, memo, useCallback, useLayoutEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import {
  Flag,
  Shield,
  Sword,
  X,
  Edit2,
  Coins,
  Building2,
  Activity,
  TrendingUp,
  Handshake,
  Swords,
} from "lucide-react";
import type { RegionCommunitiesRow } from "@/components/map/region-types";
import { CommunityStatParts } from "@/components/community/community-stat";
import { cn } from "@/lib/utils";
import { isSovereign } from "@/lib/governance";
import { BattleMechanicsStatus } from "@/components/battle/battle-mechanics-status";
import { HexResourceBonuses } from "@/components/economy/hex-resource-bonuses";
import { HexVenturesTab } from "@/components/economy/hex-ventures-tab";
import { RegionName } from "@/components/ui/region-name";
import {
  getResourceColor,
  getResourceIcon,
  type HexResourceBonus,
} from "@/lib/economy/hex-resource-distribution";
import { getResourceIconComponent } from "@/lib/economy/resource-icons";
import { CompactTravelButton } from "@/components/map/compact-travel-button";
import { CompactAttackButton } from "@/components/map/compact-attack-button";

export type RelationStatus = "ally" | "enemy" | "neutral";

export type RegionInfo = {
  name?: string;
  customName?: string | null;
  owner?: string;
  biome?: string;
  danger?: "Low" | "Medium" | "High";
  subtitle?: string;
};

export type DrawerHex = {
  id: string;
  center: [number, number];
  region: RegionInfo;
  ownerCommunity: RegionCommunitiesRow | null;
  ownerCommunityId: string | null;
  relation?: RelationStatus;
  countryName?: string | null;
  provinceName?: string | null;
  countryCode?: string | null;
  countryEmoji?: string | null;
  isCapital?: boolean;
};

export type ActionMode = "CLAIM" | "ATTACK" | "MANAGE" | "HIDDEN";

export type RegionActionResult =
  | {
      kind: "firstClaim";
      targetLabel: string;
    }
  | {
      kind: "attack-unclaimed";
      targetLabel: string;
      battleId?: string;
    }
  | {
      kind: "attack-enemy";
      targetLabel: string;
      battleId?: string;
    };

type Props = {
  open: boolean;
  hex: DrawerHex | null;
  onClose: () => void;
  actionMode?: ActionMode;
  onFight?: () => Promise<{ battleId?: string }>;
  isLoading?: boolean;
  actionResult?: RegionActionResult | null;
  onReloadData?: () => void | Promise<void>;
  activeBattleId?: string | null;
  onUpdateRegionName?: (hexId: string, newName: string) => Promise<void>;
  userRankTier?: number | null;
  userId?: string | null;
  resourceBonus?: HexResourceBonus | null;
  resourceStat?: {
    bonus: HexResourceBonus;
    valueText: string;
    valueClassName?: string;
  } | null;
  onTravel?: (hexId: string) => Promise<void>;
  userCurrentHex?: string | null;
  userCurrentHexName?: string | null;
  userTicketCount?: number;
  userGold?: number;
  isFirstClaim?: boolean;
};

const relationMeta: Record<
  RelationStatus,
  {
    label: string;
    badgeVariant: "success" | "destructive" | "outline";
    icon: ReactNode;
  }
> = {
  ally: {
    label: "Ally",
    badgeVariant: "success",
    icon: <Handshake className="h-4 w-4" />,
  },
  enemy: {
    label: "Enemy",
    badgeVariant: "destructive",
    icon: <Swords className="h-4 w-4" />,
  },
  neutral: {
    label: "Neutral",
    badgeVariant: "outline",
    icon: <Shield className="h-4 w-4" />,
  },
};

type LocationValueProps = {
  countryName?: string | null;
  provinceName?: string | null;
};

function LocationValue({ countryName, provinceName }: LocationValueProps) {
  const country = countryName?.trim() ?? "";
  const province = provinceName?.trim() ?? "";
  const hasBoth = Boolean(country && province);
  const fullLabel = [country, province].filter(Boolean).join(" · ") || "Unknown";
  const compactLabel = province || country || "Unknown";
  const [mode, setMode] = useState<"full" | "compact">("full");
  const containerRef = useRef<HTMLSpanElement | null>(null);
  const fullRef = useRef<HTMLSpanElement | null>(null);
  const compactRef = useRef<HTMLSpanElement | null>(null);

  const updateMode = useCallback(() => {
    const container = containerRef.current;
    const fullEl = fullRef.current;
    const compactEl = compactRef.current;
    if (!container || !fullEl || !compactEl) return;
    const containerWidth = container.clientWidth;
    if (!containerWidth) return;
    const fullWidth = fullEl.scrollWidth;
    const nextMode =
      hasBoth && fullWidth > containerWidth ? "compact" : "full";
    setMode((prev) => (prev === nextMode ? prev : nextMode));
  }, [hasBoth, fullLabel, compactLabel]);

  useLayoutEffect(() => {
    updateMode();
  }, [updateMode]);

  useLayoutEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const observer = new ResizeObserver(() => updateMode());
    observer.observe(el);
    return () => observer.disconnect();
  }, [updateMode]);

  return (
    <span ref={containerRef} className="relative min-w-0 flex-1 overflow-hidden">
      <span className="block min-w-0 truncate whitespace-nowrap">
        {mode === "compact" ? compactLabel : fullLabel}
      </span>
      <span
        ref={fullRef}
        className="absolute left-0 top-0 invisible pointer-events-none whitespace-nowrap"
        aria-hidden="true"
      >
        {fullLabel}
      </span>
      <span
        ref={compactRef}
        className="absolute left-0 top-0 invisible pointer-events-none whitespace-nowrap"
        aria-hidden="true"
      >
        {compactLabel}
      </span>
    </span>
  );
}

const HEADER_STAT_BUTTON_CLASSES = cn(
  "group flex flex-col items-start gap-1.5 px-3 py-2 rounded-lg bg-muted/50 text-foreground transition-colors hover:bg-muted/70",
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-background focus-visible:ring-primary/50"
);

const STAT_ICON_WRAPPER_CLASSES =
  "flex h-7 w-7 items-center justify-center rounded-md bg-accent/15 text-foreground shrink-0";

const renderStatIcon = (icon: ReactNode, className?: string) => (
  <span className={cn(STAT_ICON_WRAPPER_CLASSES, className)}>{icon}</span>
);

export default memo(function RegionDrawer({
  open,
  hex,
  onClose,
  actionMode = "HIDDEN",
  onFight,
  isLoading = false,
  actionResult = null,
  onReloadData,
  activeBattleId = null,
  onUpdateRegionName,
  userRankTier = null,
  userId = null,
  resourceBonus = null,
  resourceStat = null,
  onTravel,
  userCurrentHex = null,
  userCurrentHexName = null,
  userTicketCount = 0,
  userGold = 0,
  isFirstClaim = false,
}: Props) {
  const [activeTab, setActiveTab] = useState("home");
  const [isEditingName, setIsEditingName] = useState(false);
  const [editedName, setEditedName] = useState("");
  const [isSavingName, setIsSavingName] = useState(false);

  const hasAction = actionMode === "CLAIM" || actionMode === "ATTACK";
  const ownerName =
    hex?.ownerCommunity?.name ?? (hex?.ownerCommunityId ? "Unknown" : "Unclaimed");
  const relation = hex?.relation ?? "neutral";
  const relationInfo = relationMeta[relation];

  const primaryResourceBonus = resourceBonus;
  const statBonus = resourceStat?.bonus ?? primaryResourceBonus;
  const ResourceIconComponent = statBonus
    ? getResourceIconComponent(getResourceIcon(statBonus.resourceKey))
    : TrendingUp;
  const resourceColor = statBonus
    ? getResourceColor(statBonus.resourceKey)
    : undefined;
  const ownerColor = hex?.ownerCommunity?.color ?? undefined;
  const ownerInitial = ownerName.charAt(0).toUpperCase();
  const resourceIcon = renderStatIcon(
    <span style={resourceColor ? { color: resourceColor } : undefined}>
      <ResourceIconComponent className="h-4 w-4" />
    </span>
  );
  const ownerIcon = renderStatIcon(
    <span
      className="text-[10px] font-semibold uppercase"
      style={ownerColor ? { color: ownerColor } : undefined}
    >
      {ownerInitial}
    </span>
  );
  const locationIcon = renderStatIcon(
    hex?.countryEmoji ? (
      <span className="text-sm leading-none">{hex.countryEmoji}</span>
    ) : (
      <Flag className="h-4 w-4" />
    )
  );
  const relationIcon = renderStatIcon(relationInfo.icon);
  const resourceValueText = resourceStat
    ? resourceStat.valueText
    : statBonus
      ? `${statBonus.resourceName} ${statBonus.percentage}`
      : "Standard Production";
  const resourceValueClassName = resourceStat?.valueClassName;

  const canEditRegionName = isSovereign(userRankTier) && Boolean(onUpdateRegionName);

  const handleEditName = () => {
    setEditedName(hex?.region.customName ?? "");
    setIsEditingName(true);
  };

  const handleSaveName = async () => {
    if (!hex || !onUpdateRegionName) return;
    setIsSavingName(true);
    try {
      await onUpdateRegionName(hex.id, editedName);
      setIsEditingName(false);
    } catch (error) {
      console.error("Failed to update region name:", error);
    } finally {
      setIsSavingName(false);
    }
  };

  const handleCancelEdit = () => {
    setIsEditingName(false);
    setEditedName("");
  };

  const getSuccessMessage = (result: RegionActionResult) => {
    if (result.kind === "firstClaim") {
      return "First territory claimed. The foundation of your empire begins.";
    }
    return "The battle started... you have no choice than to crush the walls, or enemy will take the priority!";
  };

  if (!open) {
    return null;
  }

  // Show loading state while data is being fetched
  if (!hex) {
    return (
      <div className="pointer-events-none absolute left-6 top-6 bottom-6 z-40 flex w-[min(32rem,70vw)] max-w-[32rem]">
      <div
        className="pointer-events-auto flex h-full w-full flex-col gap-4 overflow-hidden rounded-xl border border-border/70 bg-card p-5 shadow-[0_30px_60px_rgba(0,0,0,0.35)]"
          style={{ maxHeight: "calc(100vh - 4rem)" }}
        >
          <div className="flex items-center justify-center py-12">
            <div className="text-center space-y-2">
              <div className="inline-block animate-spin">
                <div className="h-8 w-8 border-4 border-muted-foreground border-t-foreground rounded-full" />
              </div>
              <p className="text-sm text-muted-foreground">Loading region...</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const locationValue = (
    <LocationValue countryName={hex.countryName} provinceName={hex.provinceName} />
  );

  return (
    <div className="pointer-events-none absolute left-6 top-6 bottom-6 z-40 flex w-[min(32rem,70vw)] max-w-[32rem]">
      <div
        className="pointer-events-auto relative flex h-full w-full flex-col gap-4 overflow-hidden rounded-xl border border-border/70 bg-card p-5 shadow-[0_30px_60px_rgba(0,0,0,0.35)]"
        style={{ maxHeight: "calc(100vh - 4rem)" }}
      >
        <div
          className="pointer-events-none absolute inset-x-0 bottom-0 h-32 sm:h-40 md:h-48 bg-center bg-no-repeat opacity-90"
          style={{
            backgroundImage: "url('https://i.ibb.co/fdhTQPPp/townbg.png')",
            backgroundSize: "100% auto",
            backgroundPosition: "top center",
            zIndex: 0,
          }}
        />
        <div className="relative z-10 flex items-start justify-between gap-3">
          <div className="flex-1">
            <p className="text-[9px] font-bold uppercase tracking-wider text-muted-foreground mb-1">
              <span>Region</span>
              {hex.isCapital ? (
                <span className="text-[#d6ba76]">
                  {" "}
                  · Capital
                </span>
              ) : null}
            </p>
            {isEditingName ? (
              <div className="flex items-center gap-2">
                <Input
                  value={editedName}
                  onChange={(e) => setEditedName(e.target.value)}
                  className="h-8 text-base font-bold"
                  placeholder={hex.provinceName || "Region name"}
                  autoFocus
                />
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleSaveName}
                  disabled={isSavingName}
                  className="h-8"
                >
                  {isSavingName ? "..." : "Save"}
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleCancelEdit}
                  className="h-8"
                >
                  Cancel
                </Button>
              </div>
            ) : (
              <div className="flex items-baseline gap-2">
                <div className="flex items-baseline gap-2">
                  <h2 className="text-lg font-bold text-foreground">
                    {hex.region.customName?.trim() || hex.provinceName?.trim() || hex.id}
                  </h2>
                  {canEditRegionName && (
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={handleEditName}
                      className="h-6 w-6 text-muted-foreground hover:text-foreground"
                      title="Edit region name"
                    >
                      <Edit2 className="h-3 w-3" />
                    </Button>
                  )}
                </div>
                <RegionName
                  hexId={hex.id}
                  showId={true}
                  variant="compact"
                  className="opacity-70"
                  nameClassName="hidden"
                />
              </div>
            )}
          </div>
          <Button variant="ghost" size="icon" onClick={onClose} className="text-muted-foreground">
            <X className="h-4 w-4" />
          </Button>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="relative z-10 flex flex-1 flex-col overflow-hidden">
          <TabsList className="w-full grid grid-cols-4 gap-2">
            <TabsTrigger value="home" className="text-xs font-semibold">
              <Activity className="h-3 w-3 mr-1.5" />
              Home
            </TabsTrigger>
            <TabsTrigger value="military" className="text-xs font-semibold">
              <Sword className="h-3 w-3 mr-1.5" />
              Military
            </TabsTrigger>
            <TabsTrigger value="economy" className="text-xs font-semibold">
              <Coins className="h-3 w-3 mr-1.5" />
              Economy
            </TabsTrigger>
            <TabsTrigger value="ventures" className="text-xs font-semibold">
              <Building2 className="h-3 w-3 mr-1.5" />
              Ventures
            </TabsTrigger>
          </TabsList>

          <TabsContent value="home" className="flex-1 overflow-y-auto mt-4 space-y-4">
            <div className="sticky top-0 z-10 -mx-1 bg-card/90 px-1 pt-1 pb-3 backdrop-blur-sm">
              <div className="grid grid-cols-2 gap-3">
                <div className={HEADER_STAT_BUTTON_CLASSES}>
                  <CommunityStatParts
                    label="Owner"
                    icon={ownerIcon}
                    value={ownerName}
                  />
                </div>
                <div className={HEADER_STAT_BUTTON_CLASSES}>
                  <CommunityStatParts
                    label="Location"
                    icon={locationIcon}
                    value={locationValue}
                    valueClassName="min-w-0 overflow-hidden"
                  />
                </div>
                <div className={HEADER_STAT_BUTTON_CLASSES}>
                  <CommunityStatParts
                    label="Relation"
                    icon={relationIcon}
                    value={relationInfo.label}
                  />
                </div>
                <div className={HEADER_STAT_BUTTON_CLASSES}>
                  <CommunityStatParts
                    label="Resource"
                    icon={resourceIcon}
                    value={resourceValueText}
                    valueClassName={resourceValueClassName}
                  />
                </div>
              </div>
            </div>
            {onTravel && hex && (
              <CompactTravelButton
                hexId={hex.id}
                hexName={hex.region.customName?.trim() || hex.provinceName?.trim() || hex.id}
                userCurrentHex={userCurrentHex}
                userCurrentHexName={userCurrentHexName}
                userTicketCount={userTicketCount}
                onTravel={onTravel}
              />
            )}

            {onFight && hex && (hasAction || activeBattleId) && (actionMode === "ATTACK" || actionMode === "CLAIM") && (
              <CompactAttackButton
                key={`attack-${hex.id}-${activeBattleId || 'idle'}`}
                mode={actionMode}
                regionName={hex.region.customName?.trim() || hex.provinceName?.trim() || hex.id}
                onAction={onFight}
                goldCost={10}
                userGold={userGold}
                activeBattleId={activeBattleId}
                isFirstClaim={isFirstClaim}
              />
            )}
          </TabsContent>

          <TabsContent value="military" className="flex-1 overflow-y-auto mt-4">
            {hex?.ownerCommunityId ? (
              <BattleMechanicsStatus
                communityId={hex.ownerCommunityId}
                communityName={hex.ownerCommunity?.name || "This community"}
                averageRage={0}
                showHeading={false}
              />
            ) : (
              <Card className="rounded-xl border border-border/60 bg-card p-6">
                <div className="flex flex-col items-center justify-center py-8 space-y-4">
                  <div className="rounded-full bg-muted p-4">
                    <Shield className="h-8 w-8 text-muted-foreground" />
                  </div>
                  <div className="text-center space-y-2">
                    <h3 className="text-sm font-bold text-foreground">Unclaimed Territory</h3>
                    <p className="text-xs text-muted-foreground max-w-[240px]">
                      This region has no owner. Claim it to view military status.
                    </p>
                  </div>
                </div>
              </Card>
            )}
          </TabsContent>

          <TabsContent value="economy" className="flex-1 overflow-y-auto mt-4">
            <Card className="rounded-xl border border-border/60 bg-card p-4">
              {hex && hex.region.biome && (
                <HexResourceBonuses
                  bonus={primaryResourceBonus}
                  resourceStat={resourceStat}
                />
              )}
              {(!hex || !hex.region.biome) && (
                <div className="flex flex-col items-center justify-center py-8 space-y-4">
                  <div className="rounded-full bg-muted p-4">
                    <Coins className="h-8 w-8 text-muted-foreground" />
                  </div>
                  <div className="text-center space-y-2">
                    <h3 className="text-sm font-bold text-foreground">Loading Economy Data</h3>
                    <p className="text-xs text-muted-foreground max-w-[240px]">
                      Fetching resource information...
                    </p>
                  </div>
                </div>
              )}
            </Card>
          </TabsContent>

          <TabsContent value="ventures" className="flex-1 overflow-y-auto mt-4">
            {hex && (
              <HexVenturesTab
                hexId={hex.id}
                userId={userId}
                communityId={hex.ownerCommunityId}
              />
            )}
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
});
