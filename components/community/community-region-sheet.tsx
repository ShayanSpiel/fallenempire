"use client";

import React, { useCallback, useState } from "react";
import Link from "next/link";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Shield, Hammer, Map as MapIcon, Globe, Edit2, Check, X } from "lucide-react";
import { RegionName } from "@/components/ui/region-name";
import { toast } from "sonner";

export type CommunityRegion = {
  hexId: string;
  customName?: string | null;
  provinceName?: string | null;
  resourceYield: number;
  fortificationLevel: number;
  conqueredAt: string | null;
};

type CommunityRegionSheetProps = {
  communityId: string;
  communityName: string;
  regions: CommunityRegion[];
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  communityColor?: string | null;
  isFounder?: boolean;
};

export function CommunityRegionSheet({
  communityId,
  communityName,
  regions,
  isOpen,
  onOpenChange,
  communityColor,
  isFounder = false,
}: CommunityRegionSheetProps) {
  const [editingHexId, setEditingHexId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState<string>("");
  const [loadingHexId, setLoadingHexId] = useState<string | null>(null);
  const [customNames, setCustomNames] = useState<Record<string, string | null>>(() =>
    regions.reduce((acc, r) => ({ ...acc, [r.hexId]: r.customName || null }), {})
  );

  const handleEditClick = useCallback((region: CommunityRegion) => {
    setEditingHexId(region.hexId);
    setEditingName(customNames[region.hexId] || region.provinceName || "");
  }, [customNames]);

  const handleSave = useCallback(
    async (hexId: string) => {
      const trimmedName = editingName.trim();
      const nextName = trimmedName || null;
      const previousName = customNames[hexId];

      setCustomNames((prev) => ({ ...prev, [hexId]: nextName }));
      setEditingHexId(null);
      setLoadingHexId(hexId);

      try {
        const response = await fetch("/api/community/regions", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            communityId,
            hexId,
            regionName: nextName,
          }),
        });

        if (!response.ok) {
          const error = await response.json();
          console.error("Failed to update region name:", error);
          setCustomNames((prev) => ({ ...prev, [hexId]: previousName }));
          toast.error("Failed to update region name");
          return;
        }

        toast.success("Region name updated successfully");
      } catch (error) {
        console.error("Error updating region name:", error);
        setCustomNames((prev) => ({ ...prev, [hexId]: previousName }));
        toast.error("Failed to update region name");
      } finally {
        setLoadingHexId(null);
        setEditingName("");
      }
    },
    [communityId, editingName, customNames]
  );

  const handleCancel = useCallback(() => {
    setEditingHexId(null);
    setEditingName("");
  }, []);

  return (
    <Sheet open={isOpen} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-md p-0 gap-0 flex flex-col bg-background/95 backdrop-blur-xl">
        <SheetHeader className="px-6 py-6 border-b border-border/60">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-muted text-muted-foreground">
              <Globe size={18} />
            </div>
            <div className="flex-1">
              <SheetTitle className="text-base font-bold">Territory Control</SheetTitle>
              <SheetDescription className="mt-1 text-[11px] text-muted-foreground">
                Manage and rename your controlled regions.
              </SheetDescription>
              <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-[0.1em] mt-1">
                {regions.length} {regions.length === 1 ? "Region" : "Regions"} • {communityName}
              </p>
            </div>
          </div>
        </SheetHeader>

        <ScrollArea className="flex-1 px-6">
          <div className="py-6 space-y-2">
            {regions.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-center opacity-50">
                <Globe className="h-10 w-10 text-muted-foreground/30 mb-2" />
                <p className="text-sm font-medium text-muted-foreground">No territory claimed yet.</p>
                <p className="text-[11px] text-muted-foreground/70 mt-1">Deploy forces to expand control.</p>
              </div>
            ) : (
              regions.map((region) => (
                <RegionRow
                  key={region.hexId}
                  region={region}
                  customName={customNames[region.hexId]}
                  isEditing={editingHexId === region.hexId}
                  editingName={editingName}
                  onEditingNameChange={setEditingName}
                  onEdit={handleEditClick}
                  onSave={handleSave}
                  onCancel={handleCancel}
                  isLoading={loadingHexId === region.hexId}
                  isFounder={isFounder}
                  communityColor={communityColor}
                />
              ))
            )}
          </div>
        </ScrollArea>
      </SheetContent>
    </Sheet>
  );
}

type RegionRowProps = {
  region: CommunityRegion;
  customName: string | null;
  isEditing: boolean;
  editingName: string;
  onEditingNameChange: (value: string) => void;
  onEdit: (region: CommunityRegion) => void;
  onSave: (hexId: string) => void;
  onCancel: () => void;
  isLoading: boolean;
  isFounder: boolean;
  communityColor?: string | null;
};

const RegionRow = React.memo(function RegionRow({
  region,
  customName,
  isEditing,
  editingName,
  onEditingNameChange,
  onEdit,
  onSave,
  onCancel,
  isLoading,
  isFounder,
  communityColor,
}: RegionRowProps) {
  return (
    <div className="group flex items-center justify-between p-3 rounded-lg border border-border/40 bg-muted/10 hover:bg-muted/20 hover:border-border/60 transition-all duration-200">
      <div className="flex flex-col gap-2 flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span
            className="h-2 w-2 rounded-full shadow-[0_0_6px_currentColor] flex-shrink-0"
            style={{ backgroundColor: communityColor ?? "currentColor" }}
          />
          {isEditing ? (
            <div className="flex items-center gap-2 flex-1">
              <Input
                type="text"
                value={editingName}
                onChange={(e) => onEditingNameChange(e.target.value)}
                placeholder={region.provinceName || region.hexId}
                className="h-6 text-xs px-2 flex-1"
                autoFocus
                onKeyDown={(e) => {
                  if (e.key === "Enter") onSave(region.hexId);
                  if (e.key === "Escape") onCancel();
                }}
              />
              <Button
                size="icon"
                variant="ghost"
                className="h-6 w-6"
                onClick={() => onSave(region.hexId)}
                disabled={isLoading}
              >
                <Check size={14} />
              </Button>
              <Button
                size="icon"
                variant="ghost"
                className="h-6 w-6"
                onClick={onCancel}
                disabled={isLoading}
              >
                <X size={14} />
              </Button>
            </div>
          ) : (
            <div className="flex-1 min-w-0">
              <RegionName
                hexId={region.hexId}
                customName={customName}
                variant="compact"
                className="text-xs font-bold font-mono tracking-wide"
              />
            </div>
          )}
        </div>

        <div className="flex items-center gap-4 text-[10px] font-medium text-muted-foreground uppercase tracking-[0.05em] pl-4">
          <div className="flex items-center gap-1.5" title="Resource Yield">
            <Hammer className="h-3.5 w-3.5 opacity-60" />
            <span>{region.resourceYield}</span>
          </div>
          <div className="flex items-center gap-1.5" title="Fortification Level">
            <Shield className="h-3.5 w-3.5 opacity-60" />
            <span>{(region.fortificationLevel / 10).toFixed(0)}%</span>
          </div>
        </div>
      </div>

      <div className="flex items-center gap-1 ml-2 flex-shrink-0">
        {isFounder && !isEditing && (
          <TooltipProvider delayDuration={0}>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 rounded-lg text-muted-foreground hover:bg-background hover:text-foreground opacity-0 group-hover:opacity-100 transition-opacity"
                  onClick={() => onEdit(region)}
                >
                  <Edit2 size={15} />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="left" className="text-[10px] font-semibold">
                Rename Region
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        )}
        <TooltipProvider delayDuration={0}>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                asChild
                variant="ghost"
                size="icon"
                className="h-8 w-8 rounded-lg text-muted-foreground hover:bg-background hover:text-foreground opacity-0 group-hover:opacity-100 transition-opacity"
              >
                <Link href={`/map?focus=${region.hexId}`}>
                  <MapIcon size={15} />
                </Link>
              </Button>
            </TooltipTrigger>
            <TooltipContent side="left" className="text-[10px] font-semibold">
              View on Map
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </div>
    </div>
  );
}, (prev, next) => {
  return (
    prev.region.hexId === next.region.hexId &&
    prev.region.resourceYield === next.region.resourceYield &&
    prev.region.fortificationLevel === next.region.fortificationLevel &&
    prev.customName === next.customName &&
    prev.isEditing === next.isEditing &&
    prev.editingName === next.editingName &&
    prev.isLoading === next.isLoading &&
    prev.isFounder === next.isFounder &&
    prev.communityColor === next.communityColor
  );
});

RegionRow.displayName = "RegionRow";
