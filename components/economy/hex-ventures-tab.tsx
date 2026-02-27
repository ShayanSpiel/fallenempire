"use client";

import React, { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Building2, Plus, Coins, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  COMPANY_TYPES,
  RAW_MATERIAL_TYPES,
  PRODUCTION_TYPES,
  getCompanyIcon,
} from "@/lib/company-config";
import type { CompanyWithType } from "@/lib/types/companies";
import { getCompaniesByHex, createCompany } from "@/app/actions/companies";
import { toast } from "sonner";
import { useTheme } from "next-themes";

interface HexVenturesTabProps {
  hexId: string;
  userId: string | null;
  communityId?: string | null;
}

// Company card skeleton
function CompanySkeleton() {
  return (
    <Card
      variant="bare"
      aria-hidden="true"
      className="animate-pulse border border-border/50 bg-muted/10"
    >
      <CardContent className="p-3 space-y-3">
        <div className="flex items-start gap-3">
          <div className="h-10 w-10 rounded-lg bg-muted" />
          <div className="flex-1 space-y-2">
            <div className="h-3 w-3/5 rounded-full bg-muted" />
            <div className="h-2 w-1/3 rounded-full bg-muted" />
          </div>
          <div className="h-5 w-12 rounded-full bg-muted" />
        </div>
      </CardContent>
    </Card>
  );
}

export function HexVenturesTab({
  hexId,
  userId,
  communityId,
}: HexVenturesTabProps) {
  const { theme } = useTheme();
  const [isLoadingCompanies, setIsLoadingCompanies] = useState(true);
  const [hexCompanies, setHexCompanies] = useState<CompanyWithType[]>([]);
  const [showCreate, setShowCreate] = useState(false);
  const [showCompaniesList, setShowCompaniesList] = useState(false);
  const [selectedTypeKey, setSelectedTypeKey] = useState<string | null>(null);
  const [companyName, setCompanyName] = useState("");
  const [isCreating, setIsCreating] = useState(false);

  // Load companies on this hex (ONLY DATA)
  useEffect(() => {
    let mounted = true;
    const loadCompanies = async () => {
      setIsLoadingCompanies(true);
      const companies = await getCompaniesByHex(hexId);
      if (mounted) {
        setHexCompanies(companies);
        setIsLoadingCompanies(false);
      }
    };
    loadCompanies();
    return () => {
      mounted = false;
    };
  }, [hexId]);

  const handleCreateCompany = async () => {
    if (!selectedTypeKey || !companyName.trim() || !userId) return;

    setIsCreating(true);

    try {
      // Get DB ID for this company type
      console.log(`[HexVenturesTab] Looking up company type: ${selectedTypeKey}`);
      const { getCompanyTypes } = await import("@/app/actions/companies");
      const types = await getCompanyTypes();
      console.log(`[HexVenturesTab] Found ${types.length} company types in DB:`, types.map(t => t.key));

      const typeId = types.find((t) => t.key === selectedTypeKey)?.id;

      if (!typeId) {
        console.error(`[HexVenturesTab] Company type "${selectedTypeKey}" not found in database!`);
        toast("Company Type Missing", {
          description: `${selectedTypeKey} not found in database. Run migrations first.`
        });
        setIsCreating(false);
        return;
      }

      console.log(`[HexVenturesTab] Creating company with type ID: ${typeId}`);
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

        // Reload companies
        const companies = await getCompaniesByHex(hexId);
        setHexCompanies(companies);

        // Reset form
        setShowCreate(false);
        setSelectedTypeKey(null);
        setCompanyName("");
      } else {
        console.error("[HexVenturesTab] Creation failed:", result.error);
        toast("Creation Failed", {
          description: result.error || "Failed to create company",
        });
      }
    } catch (error) {
      console.error("[HexVenturesTab] Unexpected error:", error);
      toast("Error", {
        description: "An unexpected error occurred. Check console for details.",
      });
    }

    setIsCreating(false);
  };

  const selectedType = selectedTypeKey
    ? COMPANY_TYPES.find((t) => t.key === selectedTypeKey)
    : null;

  if (!userId) {
    return (
      <Card className="rounded-xl border border-border/60 bg-card p-6">
        <div className="flex flex-col items-center justify-center py-8 space-y-4">
          <div className="rounded-full bg-muted p-4">
            <Building2 className="h-8 w-8 text-muted-foreground" />
          </div>
          <div className="text-center space-y-2">
            <h3 className="text-sm font-bold text-foreground">
              Sign In Required
            </h3>
            <p className="text-xs text-muted-foreground max-w-[240px]">
              You must be signed in to create and manage companies.
            </p>
          </div>
        </div>
      </Card>
    );
  }

  const isDarkMode = theme === "dark";
  const buttonClassName = isDarkMode
    ? "bg-blue-600 hover:bg-blue-700 text-white border-blue-600"
    : "bg-amber-500 hover:bg-amber-600 text-white border-amber-500";

  return (
    <div className="space-y-4">
      {/* Company Creation Button - ALWAYS ON TOP */}
      <Button
        onClick={() => setShowCreate(!showCreate)}
        className={cn("w-full gap-2 font-semibold", buttonClassName)}
      >
        <Plus className="h-4 w-4" />
        Establish New Company
      </Button>

      {/* Company Creation Form - BELOW BUTTON */}
      {showCreate && (
        <Card className="rounded-xl border border-border/60 bg-card p-4 space-y-4 animate-in fade-in slide-in-from-top-2 duration-200">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-foreground">New Company</h3>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setShowCreate(false);
                setSelectedTypeKey(null);
                setCompanyName("");
              }}
              className="text-xs"
            >
              Cancel
            </Button>
          </div>

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

          {/* Create Button */}
          <Button
            onClick={handleCreateCompany}
            disabled={!selectedTypeKey || !companyName.trim() || isCreating}
            className={cn("w-full gap-2 font-semibold", buttonClassName)}
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
        </Card>
      )}

      {/* Expandable Companies List - BELOW FORM */}
      {(hexCompanies.length > 0 || isLoadingCompanies) && (
        <div className="space-y-2">
          <button
            onClick={() => setShowCompaniesList(!showCompaniesList)}
            className="w-full flex items-center justify-between p-3 rounded-lg border border-border/60 bg-card hover:bg-muted/50 transition-colors"
          >
            <h3 className="text-xs font-bold text-foreground uppercase tracking-wider">
              Companies on this Hex
            </h3>
            <ChevronDown
              className={cn(
                "h-4 w-4 text-muted-foreground transition-transform",
                showCompaniesList && "rotate-180"
              )}
            />
          </button>

          {showCompaniesList && (
            <div className="space-y-2 animate-in fade-in slide-in-from-top-2 duration-200">
              {isLoadingCompanies ? (
                <>
                  <CompanySkeleton />
                  <CompanySkeleton />
                </>
              ) : hexCompanies.length > 0 ? (
                <>
                  {hexCompanies.map((company) => {
                    const IconComponent = getCompanyIcon(company.company_type.key);
                    return (
                      <Card
                        key={company.id}
                        className="rounded-lg border border-border/60 bg-card p-3 hover:bg-muted/30 transition-colors"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex items-start gap-3 flex-1">
                            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-muted text-muted-foreground">
                              <IconComponent className="h-4 w-4" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <h4 className="text-sm font-bold text-foreground truncate">
                                {company.name}
                              </h4>
                              <p className="text-xs text-muted-foreground">
                                {company.company_type.name}
                              </p>
                              {company.owner_username && (
                                <p className="text-[10px] text-muted-foreground mt-1">
                                  Owner: {company.owner_username}
                                </p>
                              )}
                            </div>
                          </div>
                          <div className="flex flex-col items-end gap-1">
                            <Badge
                              variant={
                                company.owner_id === userId ? "default" : "outline"
                              }
                              className="text-[9px] px-1.5 py-0.5"
                            >
                              Lv{company.level}
                            </Badge>
                            {company.owner_id === userId && (
                              <span className="text-[9px] text-primary font-semibold">
                                Your Company
                              </span>
                            )}
                          </div>
                        </div>
                      </Card>
                    );
                  })}
                </>
              ) : (
                <p className="text-xs text-muted-foreground py-4 text-center">
                  No companies on this hex yet.
                </p>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
