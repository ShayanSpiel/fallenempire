"use client";

import React, { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogClose,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Building2, Plus, Coins, X, MapPin, ExternalLink } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  COMPANY_TYPES,
  RAW_MATERIAL_TYPES,
  PRODUCTION_TYPES,
} from "@/lib/company-config";
import { createCompany } from "@/app/actions/companies";
import { toast } from "sonner";
import { useTheme } from "next-themes";

interface CreateCompanyDialogProps {
  hexId: string;
  userId: string | null;
  communityId?: string | null;
  regionName?: string | null;
  onCompanyCreated?: () => void;
}

export function CreateCompanyDialog({
  hexId,
  userId,
  communityId,
  regionName,
  onCompanyCreated,
}: CreateCompanyDialogProps) {
  const { theme } = useTheme();
  const [open, setOpen] = useState(false);
  const [selectedTypeKey, setSelectedTypeKey] = useState<string | null>(null);
  const [companyName, setCompanyName] = useState("");
  const [isCreating, setIsCreating] = useState(false);

  const selectedType = selectedTypeKey
    ? COMPANY_TYPES.find((t) => t.key === selectedTypeKey)
    : null;

  const handleCreateCompany = async () => {
    if (!selectedTypeKey || !companyName.trim() || !userId || !hexId) return;

    setIsCreating(true);

    try {
      const { getCompanyTypes } = await import("@/app/actions/companies");
      const types = await getCompanyTypes();
      const typeId = types.find((t) => t.key === selectedTypeKey)?.id;

      if (!typeId) {
        toast("Company Type Missing", {
          description: `${selectedTypeKey} not found in database.`,
        });
        setIsCreating(false);
        return;
      }

      const result = await createCompany({
        company_type_id: typeId,
        hex_id: hexId,
        name: companyName.trim(),
        community_id: communityId,
      });

      if (result.success) {
        toast("Company Created", {
          description: `${companyName} has been established.`,
        });

        // Reset form
        setOpen(false);
        setSelectedTypeKey(null);
        setCompanyName("");

        // Callback
        onCompanyCreated?.();
      } else {
        toast("Creation Failed", {
          description: result.error || "Failed to create company",
        });
      }
    } catch (error) {
      console.error("[CreateCompanyDialog] Unexpected error:", error);
      toast("Error", {
        description: "An unexpected error occurred. Check console for details.",
      });
    }

    setIsCreating(false);
  };

  if (!userId || !hexId) {
    return null;
  }

  const isDarkMode = theme === "dark";
  const buttonClassName = isDarkMode
    ? "bg-blue-600 hover:bg-blue-700 text-white border-blue-600"
    : "bg-amber-500 hover:bg-amber-600 text-white border-amber-500";

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <Button
        onClick={() => setOpen(true)}
        className={cn("gap-2 font-semibold", buttonClassName)}
      >
        <Plus className="h-4 w-4" />
        New Company
      </Button>

      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        {/* Header with location info and close button */}
        <div className="flex items-start justify-between gap-4 pb-4 border-b border-border/60">
          <div className="space-y-3 flex-1">
            <div className="flex items-center gap-2">
              <Building2 className="h-5 w-5" />
              <h2 className="text-lg font-bold text-foreground">
                Establish New Company
              </h2>
            </div>

            {/* Current Location Display */}
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-muted/30 border border-border/60">
                <MapPin className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm font-semibold text-foreground">
                  {regionName || "Unknown Location"}
                </span>
              </div>
              <Button
                variant="ghost"
                size="sm"
                className="h-9 gap-1.5 text-xs"
                onClick={() => window.open("/map", "_blank")}
              >
                <ExternalLink className="h-3.5 w-3.5" />
                Open Map
              </Button>
            </div>

            <p className="text-xs text-muted-foreground">
              Building a company in your current location. Use the map to change
              regions.
            </p>
          </div>

          <DialogClose asChild>
            <Button variant="ghost" size="sm" className="h-6 w-6 p-0 shrink-0 mt-1">
              <X className="h-4 w-4" />
            </Button>
          </DialogClose>
        </div>

        {/* Form content */}
        <div className="space-y-4">
          {/* Company Name Input */}
          <div className="space-y-2">
            <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              Company Name
            </label>
            <Input
              value={companyName}
              onChange={(e) => setCompanyName(e.target.value)}
              placeholder="Enter company name"
              className="h-9"
              autoFocus
            />
          </div>

          {/* RAW MATERIALS Section */}
          <div className="space-y-2">
            <label className="text-xs font-semibold text-foreground uppercase tracking-wider">
              Raw Materials
            </label>
            <p className="text-[10px] text-muted-foreground">
              Extract resources from the environment
            </p>
            <div className="grid grid-cols-1 gap-2">
              {RAW_MATERIAL_TYPES.map((type) => {
                const isSelected = selectedTypeKey === type.key;
                const IconComponent = type.icon;

                return (
                  <button
                    key={type.key}
                    type="button"
                    onClick={() => setSelectedTypeKey(type.key)}
                    className={cn(
                      "flex items-start gap-3 p-3 rounded-lg border transition-all text-left",
                      isSelected
                        ? "border-primary bg-primary/10"
                        : "border-border/60 bg-card hover:bg-muted/50"
                    )}
                  >
                    <div
                      className={cn(
                        "flex h-9 w-9 items-center justify-center rounded-lg shrink-0",
                        isSelected
                          ? "bg-primary text-primary-foreground"
                          : "bg-muted text-muted-foreground"
                      )}
                    >
                      <IconComponent className="h-4 w-4" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h4 className="text-sm font-bold text-foreground">
                        {type.name}
                      </h4>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {type.description}
                      </p>
                      <div className="flex items-center gap-1 text-xs mt-2">
                        <Coins className="h-3 w-3 text-yellow-500" />
                        <span className="font-semibold">
                          {type.build_cost_gold}
                        </span>
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* PRODUCTION Section */}
          <div className="space-y-2">
            <label className="text-xs font-semibold text-foreground uppercase tracking-wider">
              Production Facilities
            </label>
            <p className="text-[10px] text-muted-foreground">
              Process raw materials into finished goods
            </p>
            <div className="grid grid-cols-1 gap-2">
              {PRODUCTION_TYPES.map((type) => {
                const isSelected = selectedTypeKey === type.key;
                const hasResources =
                  Object.keys(type.build_cost_resources).length > 0;
                const IconComponent = type.icon;

                return (
                  <button
                    key={type.key}
                    type="button"
                    onClick={() => setSelectedTypeKey(type.key)}
                    className={cn(
                      "flex items-start gap-3 p-3 rounded-lg border transition-all text-left",
                      isSelected
                        ? "border-primary bg-primary/10"
                        : "border-border/60 bg-card hover:bg-muted/50"
                    )}
                  >
                    <div
                      className={cn(
                        "flex h-9 w-9 items-center justify-center rounded-lg shrink-0",
                        isSelected
                          ? "bg-primary text-primary-foreground"
                          : "bg-muted text-muted-foreground"
                      )}
                    >
                      <IconComponent className="h-4 w-4" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h4 className="text-sm font-bold text-foreground">
                        {type.name}
                      </h4>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {type.description}
                      </p>
                      <div className="flex items-center gap-2 mt-2">
                        <div className="flex items-center gap-1 text-xs">
                          <Coins className="h-3 w-3 text-yellow-500" />
                          <span className="font-semibold">
                            {type.build_cost_gold}
                          </span>
                        </div>
                        {hasResources && (
                          <Badge
                            variant="outline"
                            className="text-[9px] px-1.5 py-0"
                          >
                            +Materials
                          </Badge>
                        )}
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex gap-2 pt-2">
            <Button
              onClick={handleCreateCompany}
              disabled={!selectedTypeKey || !companyName.trim() || isCreating}
              className={cn("flex-1 gap-2 font-semibold", buttonClassName)}
            >
              {isCreating ? (
                <>Creating...</>
              ) : (
                <>
                  <Building2 className="h-4 w-4" />
                  Build {selectedType?.name || "Company"}
                </>
              )}
            </Button>
            <DialogClose asChild>
              <Button variant="outline">Cancel</Button>
            </DialogClose>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
