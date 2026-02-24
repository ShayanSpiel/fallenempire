"use client";

import React from "react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  MapPin,
  Shield,
  Filter,
  ChevronDown,
  ExternalLink,
  Globe,
} from "lucide-react";
import Link from "next/link";
import {
  getResourceIcon,
  getResourceColor,
  type HexResourceBonus,
} from "@/lib/economy/hex-resource-distribution";
import { getResourceIconComponent } from "@/lib/economy/resource-icons";
import { RegionName } from "@/components/ui/region-name";
import { cn } from "@/lib/utils";

export interface RegionWithBonus {
  hex_id: string;
  custom_name: string | null;
  province_name?: string | null;
  fortification_level: number;
  last_conquered_at: string;
  bonus: HexResourceBonus | null;
  biome: string;
  resourceKey?: string | null;
  resourceValueText?: string | null;
  resourceValueClassName?: string;
  resourceBonusValue?: number;
}

interface RegionsDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  regions: RegionWithBonus[];
  communityName: string;
}

export function RegionsDrawer({
  open,
  onOpenChange,
  regions,
  communityName,
}: RegionsDrawerProps) {
  const [filteredRegions, setFilteredRegions] = React.useState<RegionWithBonus[]>(regions);
  const [resourceFilter, setResourceFilter] = React.useState<string>("all");
  const [sortBy, setSortBy] = React.useState<"name" | "bonus" | "date">("date");

  // Filter and sort
  React.useEffect(() => {
    let filtered = [...regions];

    // Apply resource filter
    if (resourceFilter !== "all") {
      filtered = filtered.filter(
        (r) => (r.resourceKey ?? r.bonus?.resourceKey) === resourceFilter
      );
    }

    // Apply sort
    filtered.sort((a, b) => {
      if (sortBy === "name") {
        const aName = a.custom_name || a.province_name || a.hex_id;
        const bName = b.custom_name || b.province_name || b.hex_id;
        return aName.localeCompare(bName);
      } else if (sortBy === "bonus") {
        const aBonus = a.resourceBonusValue ?? a.bonus?.bonus ?? 0;
        const bBonus = b.resourceBonusValue ?? b.bonus?.bonus ?? 0;
        return bBonus - aBonus; // Highest bonus first
      } else {
        // date
        return (
          new Date(b.last_conquered_at).getTime() -
          new Date(a.last_conquered_at).getTime()
        );
      }
    });

    setFilteredRegions(filtered);
  }, [regions, resourceFilter, sortBy]);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-2xl lg:max-w-3xl xl:max-w-4xl h-[100dvh] max-h-[100dvh] p-0 gap-0 flex flex-col overflow-hidden bg-background/95 backdrop-blur-xl">
        {/* Header */}
        <SheetHeader className="px-6 py-6 border-b border-border/60">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-muted text-muted-foreground">
              <Globe size={18} />
            </div>
            <div className="flex-1">
              <SheetTitle className="text-base font-bold">Economy & Resources</SheetTitle>
              <SheetDescription className="mt-1 text-[11px] text-muted-foreground">
                View production bonuses and resource distribution across controlled territories.
              </SheetDescription>
              <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-[0.1em] mt-1">
                {filteredRegions.length} of {regions.length} Regions • {communityName}
              </p>
            </div>
          </div>
        </SheetHeader>

        {/* Filters */}
        <div className="px-6 py-4 border-b border-border/40 bg-muted/10">
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
            <div className="flex items-center gap-2 w-full sm:w-auto">
              <Select value={resourceFilter} onValueChange={setResourceFilter}>
                <SelectTrigger className="w-full sm:w-[160px] h-9 text-xs">
                  <Filter className="h-3.5 w-3.5 mr-1.5" />
                  <SelectValue placeholder="Filter" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Resources</SelectItem>
                  <SelectItem value="grain">Grain Only</SelectItem>
                  <SelectItem value="iron">Iron Only</SelectItem>
                  <SelectItem value="oil">Oil Only</SelectItem>
                </SelectContent>
              </Select>

              <Select value={sortBy} onValueChange={(v) => setSortBy(v as any)}>
                <SelectTrigger className="w-full sm:w-[150px] h-9 text-xs">
                  <ChevronDown className="h-3.5 w-3.5 mr-1.5" />
                  <SelectValue placeholder="Sort" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="date">Latest First</SelectItem>
                  <SelectItem value="bonus">Highest Bonus</SelectItem>
                  <SelectItem value="name">Name A-Z</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>

        {/* Regions List */}
        <ScrollArea className="flex-1 px-6">
          <div className="py-6 space-y-2">
            {filteredRegions.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-center opacity-50">
                <MapPin className="h-10 w-10 text-muted-foreground/30 mb-2" />
                <p className="text-sm font-medium text-muted-foreground">No regions match the selected filter</p>
                <p className="text-[11px] text-muted-foreground/70 mt-1">Try adjusting your filters.</p>
              </div>
            ) : (
              filteredRegions.map((region) => {
                const bonus = region.bonus;
                const resourceKey = region.resourceKey ?? bonus?.resourceKey ?? null;
                const IconComponent = resourceKey
                  ? getResourceIconComponent(getResourceIcon(resourceKey))
                  : null;
                const resourceColor = resourceKey
                  ? getResourceColor(resourceKey)
                  : null;
                const resourceValueText =
                  region.resourceValueText ??
                  (bonus ? `+${bonus.percentage}` : "Standard");
                const resourceValueClassName = region.resourceValueClassName;

                return (
                  <div
                    key={region.hex_id}
                    className="flex items-center gap-3 p-3 rounded-lg border border-border/40 bg-card hover:bg-muted/30 transition-colors"
                  >
                    {/* Region Name */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-0.5">
                        <MapPin className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />
                        <RegionName
                          hexId={region.hex_id}
                          customName={region.custom_name}
                          variant="compact"
                          nameClassName="truncate"
                        />
                      </div>
                      <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <Shield className="h-3 w-3" />
                          {region.fortification_level}
                        </span>
                        <span>•</span>
                        <span>{new Date(region.last_conquered_at).toLocaleDateString()}</span>
                      </div>
                    </div>

                    {/* Bonus Display */}
                    {resourceKey && IconComponent && resourceColor ? (
                      <div className="flex items-center gap-2 flex-shrink-0">
                        <div
                          className="p-1.5 rounded"
                          style={{
                            backgroundColor: `${resourceColor}15`,
                            color: resourceColor,
                          }}
                        >
                          <IconComponent className="h-3.5 w-3.5" />
                        </div>
                        <div className="flex flex-col items-end">
                          <span
                            className={cn("text-xs font-bold tabular-nums", resourceValueClassName)}
                            style={!resourceValueClassName ? { color: resourceColor } : undefined}
                          >
                            {resourceValueText}
                          </span>
                          <span className="text-[9px] text-muted-foreground uppercase tracking-wide">
                            {resourceKey}
                          </span>
                        </div>
                      </div>
                    ) : (
                      <div className="flex items-center gap-2 flex-shrink-0 opacity-40">
                        <span className="text-[10px] text-muted-foreground">Standard</span>
                      </div>
                    )}

                    {/* Map Link */}
                    <Link
                      href={`/map?region=${region.hex_id}`}
                      className="flex-shrink-0"
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-8 w-8 p-0"
                        title="View on map"
                      >
                        <ExternalLink className="h-3.5 w-3.5" />
                      </Button>
                    </Link>
                  </div>
                );
              })
            )}
          </div>
        </ScrollArea>
      </SheetContent>
    </Sheet>
  );
}
