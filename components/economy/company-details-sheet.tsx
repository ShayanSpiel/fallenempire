"use client";

import React, { useState, useEffect } from "react";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Building2,
  Users,
  UserX,
  Plus,
  Coins,
  MapPin,
  TrendingUp,
  Briefcase,
  X,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import { toast } from "sonner";
import { getCompanyIcon, getCompanyTypeByKey } from "@/lib/company-config";
import type { CompanyWithType, UserCompany } from "@/lib/types/companies";
import { RegionName } from "@/components/ui/region-name";
import { CompanyUpgradeDialog } from "@/components/economy/company-upgrade-dialog";
import { cn } from "@/lib/utils";
import { getBreadIcon, getQualityName } from "@/components/ui/food-quality-icon";

interface Employee {
  id: string;
  employee_id: string;
  employee_type: "player" | "ai";
  employee_name: string;
  position: string;
  wage_per_day_community_coin: number;
  total_work_days: number;
  hired_at: string;
}

interface JobListing {
  id: string;
  position_title: string;
  positions_available: number;
  wage_per_day_community_coin: number;
  requirements: Record<string, unknown>;
  created_at: string;
  community_name: string;
}

interface CompanyDetailsSheetProps {
  company: UserCompany | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onUpdate?: () => void;
}

export function CompanyDetailsSheet({
  company,
  open,
  onOpenChange,
  onUpdate,
}: CompanyDetailsSheetProps) {
  const [companyDetails, setCompanyDetails] = useState<CompanyWithType | null>(null);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [jobListings, setJobListings] = useState<JobListing[]>([]);
  const [loadingEmployees, setLoadingEmployees] = useState(false);
  const [loadingJobListings, setLoadingJobListings] = useState(false);
  const [loadingCompanyDetails, setLoadingCompanyDetails] = useState(false);
  const [firingEmployeeId, setFiringEmployeeId] = useState<string | null>(null);
  const [cancellingListingId, setCancellingListingId] = useState<string | null>(null);
  const [showJobForm, setShowJobForm] = useState(false);
  const [jobFormData, setJobFormData] = useState({
    positionTitle: "Worker",
    positionsAvailable: 1,
    wagePerDayCommunityCoin: 0.01,
  });
  const [creatingJob, setCreatingJob] = useState(false);
  const [showUpgradeDialog, setShowUpgradeDialog] = useState(false);
  const [selectedUpgradeLevel, setSelectedUpgradeLevel] = useState<number | null>(null);
  const [showUpgradeStages, setShowUpgradeStages] = useState(false);

  useEffect(() => {
    if (open && company) {
      void loadCompanyDetails();
      loadEmployees();
      loadJobListings();
    } else if (!open) {
      setCompanyDetails(null);
    }
  }, [open, company]);

  const loadCompanyDetails = async (): Promise<CompanyWithType | null> => {
    if (!company) return null;

    setLoadingCompanyDetails(true);
    try {
      const { getCompanyById } = await import("@/app/actions/companies");
      const data = await getCompanyById(company.id);
      setCompanyDetails(data);
      return data;
    } catch (error) {
      console.error("Error loading company details:", error);
      setCompanyDetails(null);
      return null;
    } finally {
      setLoadingCompanyDetails(false);
    }
  };

  const loadEmployees = async () => {
    if (!company) return;

    setLoadingEmployees(true);
    try {
      const { getCompanyEmployees } = await import("@/app/actions/companies");
      const employees = await getCompanyEmployees(company.id);
      setEmployees(employees);
    } catch (error) {
      console.error("Error loading employees:", error);
      toast.error("Failed to load employees");
    } finally {
      setLoadingEmployees(false);
    }
  };

  const loadJobListings = async () => {
    if (!company) return;

    setLoadingJobListings(true);
    try {
      const { getCompanyJobListings } = await import("@/app/actions/companies");
      const listings = await getCompanyJobListings(company.id);
      setJobListings(listings);
    } catch (error) {
      console.error("Error loading job listings:", error);
      toast.error("Failed to load job listings");
    } finally {
      setLoadingJobListings(false);
    }
  };

  const handleFireEmployee = async (contractId: string) => {
    if (!window.confirm("Are you sure you want to fire this employee?")) {
      return;
    }

    setFiringEmployeeId(contractId);
    try {
      const { fireEmployee } = await import("@/app/actions/companies");
      await fireEmployee(contractId);
      toast.success("Employee fired");
      loadEmployees();
      onUpdate?.();
    } catch (error) {
      console.error("Error firing employee:", error);
      toast.error("Failed to fire employee");
    } finally {
      setFiringEmployeeId(null);
    }
  };

  const handleCreateJobListing = async () => {
    if (!company) return;

    setCreatingJob(true);
    try {
      const { createJobListing } = await import("@/app/actions/market");

      const result = await createJobListing({
        companyId: company.id,
        positionTitle: jobFormData.positionTitle,
        positionsAvailable: jobFormData.positionsAvailable,
        wagePerDayCommunityCoin: jobFormData.wagePerDayCommunityCoin,
      });

      if (result.success) {
        toast.success("Job listing created");
        setShowJobForm(false);
        setJobFormData({
          positionTitle: "Worker",
          positionsAvailable: 1,
          wagePerDayCommunityCoin: 0.01,
        });
        loadJobListings(); // Reload job listings
      } else {
        toast.error(result.error || "Failed to create job listing");
      }
    } catch (error) {
      console.error("Error creating job listing:", error);
      toast.error("Failed to create job listing");
    } finally {
      setCreatingJob(false);
    }
  };

  const handleCancelListing = async (listingId: string) => {
    if (!window.confirm("Are you sure you want to cancel this job listing?")) {
      return;
    }

    setCancellingListingId(listingId);
    try {
      const { cancelListing } = await import("@/app/actions/market");
      const result = await cancelListing(listingId);

      if (result.success) {
        toast.success("Job listing cancelled");
        loadJobListings(); // Reload job listings
      } else {
        toast.error(result.error || "Failed to cancel listing");
      }
    } catch (error) {
      console.error("Error cancelling job listing:", error);
      toast.error("Failed to cancel listing");
    } finally {
      setCancellingListingId(null);
    }
  };

  const handleUpgradeCompany = async () => {
    if (!company) return;

    try {
      const response = await fetch("/api/companies/upgrade", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          company_id: company.id,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        toast.error(error.error || "Failed to upgrade company");
        return;
      }

      const result = await response.json();
      toast.success(`Company upgraded to level ${result.newLevel}!`);

      // Reload company details
      await loadCompanyDetails();
      onUpdate?.();
    } catch (error) {
      console.error("Error upgrading company:", error);
      toast.error("Failed to upgrade company");
    }
  };

  const calculateUpgradeCost = (level: number) => {
    return 1000 * Math.pow(level, 2);
  };

  if (!company) return null;

  const IconComponent = getCompanyIcon(company.company_type_key);
  const companyType = getCompanyTypeByKey(company.company_type_key);
  const regionName =
    companyDetails?.region?.custom_name ??
    companyDetails?.region?.province_name ??
    company.custom_name ??
    "Unknown region";

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-2xl overflow-y-auto">
        <SheetHeader>
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-muted text-muted-foreground">
              <IconComponent className="h-6 w-6" />
            </div>
            <div className="flex-1">
              <SheetTitle className="text-xl">{company.name}</SheetTitle>
              <SheetDescription>{company.company_type_name}</SheetDescription>
            </div>
          </div>
        </SheetHeader>

        <div className="mt-6 space-y-6">
          {/* Upgrade Section */}
          {companyType && company.level < companyType.max_level && (
            <div className="space-y-3">
              {/* Upgrade Button */}
              <Button
                onClick={() => setShowUpgradeStages(!showUpgradeStages)}
                className={cn(
                  "w-full h-10 font-semibold",
                  "bg-amber-500 hover:bg-amber-600 text-white",
                  "border border-amber-600/30",
                  "transition-colors duration-200"
                )}
              >
                <TrendingUp className="mr-2 h-4 w-4" />
                Upgrade Company
                {showUpgradeStages ? (
                  <ChevronUp className="ml-auto h-4 w-4" />
                ) : (
                  <ChevronDown className="ml-auto h-4 w-4" />
                )}
              </Button>

              {/* Upgrade Stages */}
              {showUpgradeStages && (
                <div className="grid grid-cols-4 gap-2 p-3 rounded-lg border border-border/60 bg-muted/30">
                  {Array.from({ length: companyType.max_level - 1 }, (_, i) => i + 1).map((fromLevel) => {
                    const toLevel = fromLevel + 1;
                    const cost = calculateUpgradeCost(fromLevel);
                    const isCurrentUpgrade = fromLevel === company.level;
                    const isPastUpgrade = fromLevel < company.level;
                    const isFutureUpgrade = fromLevel > company.level;

                    return (
                      <button
                        key={fromLevel}
                        onClick={() => {
                          if (isCurrentUpgrade) {
                            setSelectedUpgradeLevel(fromLevel);
                            setShowUpgradeDialog(true);
                          }
                        }}
                        disabled={!isCurrentUpgrade}
                        className={cn(
                          "flex flex-col items-center gap-1.5 p-2.5 rounded-lg border transition-all",
                          isCurrentUpgrade &&
                            "border-primary bg-primary/15 hover:bg-primary/20 cursor-pointer",
                          isPastUpgrade &&
                            "border-border/40 bg-muted/30 opacity-60 cursor-not-allowed",
                          isFutureUpgrade &&
                            "border-border/40 bg-card opacity-50 cursor-not-allowed"
                        )}
                      >
                        {/* Level Indicator */}
                        <div className="flex items-center gap-0.5">
                          <span className={cn(
                            "text-xs font-bold",
                            isCurrentUpgrade && "text-primary",
                            !isCurrentUpgrade && "text-muted-foreground"
                          )}>
                            {fromLevel}
                          </span>
                          <span className="text-xs text-muted-foreground">→</span>
                          <span className={cn(
                            "text-xs font-bold",
                            isCurrentUpgrade && "text-primary",
                            !isCurrentUpgrade && "text-muted-foreground"
                          )}>
                            {toLevel}
                          </span>
                        </div>

                        {/* Icon */}
                        <div className={cn(
                          "text-lg",
                          isPastUpgrade && "opacity-50"
                        )}>
                          {isPastUpgrade
                            ? "✓"
                            : company.company_type_key === "bakery"
                            ? getBreadIcon(toLevel)
                            : "⬆"
                          }
                        </div>

                        {/* Cost */}
                        <div className="flex items-center gap-0.5">
                          <Coins className={cn(
                            "h-3 w-3",
                            isCurrentUpgrade && "text-amber-600",
                            !isCurrentUpgrade && "text-muted-foreground"
                          )} />
                          <span className={cn(
                            "text-xs font-bold",
                            isCurrentUpgrade && "text-amber-600",
                            !isCurrentUpgrade && "text-muted-foreground"
                          )}>
                            {cost}
                          </span>
                        </div>

                        {/* Benefits */}
                        <div className="text-[9px] text-center text-muted-foreground leading-tight">
                          {company.company_type_key === "bakery"
                            ? getQualityName(toLevel)
                            : "Quality"
                          }
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* Company Stats */}
          <div className="grid grid-cols-3 gap-3">
            <div className="rounded-lg border border-border/60 bg-muted/20 p-3">
              <div className="flex items-center gap-2 text-muted-foreground mb-2">
                <TrendingUp className="h-3.5 w-3.5" />
                <span className="text-xs font-semibold uppercase tracking-wider">Level</span>
              </div>
              <p className="text-2xl font-bold text-foreground">{company.level}</p>
            </div>
            <div className="rounded-lg border border-border/60 bg-muted/20 p-3">
              <div className="flex items-center gap-2 text-muted-foreground mb-2">
                <Building2 className="h-3.5 w-3.5" />
                <span className="text-xs font-semibold uppercase tracking-wider">Health</span>
              </div>
              <p className="text-2xl font-bold text-foreground">{company.health}%</p>
            </div>
            <div className="rounded-lg border border-border/60 bg-muted/20 p-3">
              <div className="flex items-center gap-2 text-muted-foreground mb-2">
                <Users className="h-3.5 w-3.5" />
                <span className="text-xs font-semibold uppercase tracking-wider">Staff</span>
              </div>
              <p className="text-2xl font-bold text-foreground">{employees.length}</p>
            </div>
          </div>

          {/* Location */}
          <div className="rounded-lg border border-border/60 bg-muted/20 p-3">
            <div className="flex items-center gap-2 text-muted-foreground mb-2">
              <MapPin className="h-3.5 w-3.5" />
              <span className="text-xs font-semibold uppercase tracking-wider">Location</span>
            </div>
            <RegionName
              hexId={company.hex_id}
              customName={regionName}
              showId={false}
              fallbackToHex={false}
              variant="compact"
              className="text-sm"
            />
            <p className="mt-2 text-xs text-muted-foreground">
              {companyDetails?.community_name
                ? `Community: ${companyDetails.community_name}`
                : "Community: Wilderness (unclaimed territory)"}
            </p>
          </div>

          {/* Employees Section */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Users className="h-5 w-5 text-foreground" />
                <h3 className="text-lg font-bold text-foreground">Employees</h3>
              </div>
              <Button
                size="sm"
                variant="outline"
                onClick={async () => {
                  let details = companyDetails;
                  if (!details && !loadingCompanyDetails) {
                    details = await loadCompanyDetails();
                  }
                  if (!details) {
                    toast.error("Unable to load company details.");
                    return;
                  }
                  if (!details.community_id) {
                    toast.error("Your company is in wilderness. No employees to hire here!");
                    return;
                  }
                  setShowJobForm(!showJobForm);
                }}
                disabled={loadingCompanyDetails}
                className="gap-2"
              >
                <Plus className="h-4 w-4" />
                {loadingCompanyDetails ? "Loading..." : "Post Job"}
              </Button>
            </div>

            {/* Job Posting Form */}
            {showJobForm && (
              <div className="rounded-lg border border-border/60 bg-muted/20 p-4 space-y-3">
                <h4 className="text-sm font-bold text-foreground">Create Job Listing</h4>
                <div className="grid grid-cols-3 gap-3">
                  <div className="space-y-2">
                    <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                      Position Title
                    </label>
                    <input
                      type="text"
                      value={jobFormData.positionTitle}
                      onChange={(e) =>
                        setJobFormData({ ...jobFormData, positionTitle: e.target.value })
                      }
                      className="w-full h-9 px-3 text-sm border border-border/60 rounded-lg bg-card text-foreground"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                      Openings
                    </label>
                    <input
                      type="number"
                      min="1"
                      value={jobFormData.positionsAvailable}
                      onChange={(e) =>
                        setJobFormData({
                          ...jobFormData,
                          positionsAvailable: parseInt(e.target.value) || 1,
                        })
                      }
                      className="w-full h-9 px-3 text-sm border border-border/60 rounded-lg bg-card text-foreground"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                      Wage per Day
                    </label>
                    <input
                      type="number"
                      min="0.01"
                      step="0.01"
                      value={jobFormData.wagePerDayCommunityCoin}
                      onChange={(e) =>
                        setJobFormData({
                          ...jobFormData,
                          wagePerDayCommunityCoin: parseFloat(e.target.value) || 0.01,
                        })
                      }
                      className="w-full h-9 px-3 text-sm border border-border/60 rounded-lg bg-card text-foreground"
                    />
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button
                    onClick={handleCreateJobListing}
                    disabled={creatingJob}
                    className="flex-1 h-9 font-semibold"
                  >
                    {creatingJob ? "Creating..." : "Create Listing"}
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => setShowJobForm(false)}
                    className="h-9"
                  >
                    Cancel
                  </Button>
                </div>
              </div>
            )}

            {/* Employees List */}
            {loadingEmployees ? (
              <div className="space-y-2">
                <Skeleton className="h-14 w-full rounded-lg" />
                <Skeleton className="h-14 w-full rounded-lg" />
              </div>
            ) : employees.length === 0 ? (
              <div className="rounded-lg border border-border/60 bg-muted/20 p-6 text-center">
                <p className="text-sm text-muted-foreground">
                  No employees yet. Post a job listing to hire workers.
                </p>
              </div>
            ) : (
              <div className="space-y-2">
                {employees.map((employee) => (
                  <div
                    key={employee.id}
                    className="flex items-center gap-3 rounded-lg border border-border/60 bg-muted/10 p-3 hover:bg-muted/20 transition-colors"
                  >
                    <div className="flex h-9 w-9 items-center justify-center rounded-full bg-muted text-muted-foreground shrink-0">
                      <Users className="h-4 w-4" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h4 className="text-sm font-bold text-foreground truncate">
                        {employee.employee_name}
                      </h4>
                      <p className="text-xs text-muted-foreground truncate">
                        {employee.position} · {employee.total_work_days}d worked
                      </p>
                    </div>
                    <div className="flex items-center gap-1 text-xs font-semibold text-muted-foreground shrink-0">
                      <Coins className="h-3 w-3" />
                      <span>{employee.wage_per_day_community_coin}/day</span>
                    </div>
                    <Badge variant="outline" className="shrink-0 text-[9px] px-2 py-0.5">
                      {employee.employee_type}
                    </Badge>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleFireEmployee(employee.id)}
                      disabled={firingEmployeeId === employee.id}
                      className="h-8 px-2.5 gap-1.5 text-xs shrink-0"
                    >
                      <UserX className="h-3 w-3" />
                      {firingEmployeeId === employee.id ? "Firing..." : "Fire"}
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Active Job Listings Section */}
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <Briefcase className="h-5 w-5 text-foreground" />
              <h3 className="text-lg font-bold text-foreground">Active Job Listings</h3>
            </div>

            {loadingJobListings ? (
              <div className="space-y-2">
                <Skeleton className="h-14 w-full rounded-lg" />
                <Skeleton className="h-14 w-full rounded-lg" />
              </div>
            ) : jobListings.length === 0 ? (
              <div className="rounded-lg border border-border/60 bg-muted/20 p-6 text-center">
                <p className="text-sm text-muted-foreground">
                  No active job listings. Post a job listing to attract workers.
                </p>
              </div>
            ) : (
              <div className="space-y-2">
                {jobListings.map((listing) => (
                  <div
                    key={listing.id}
                    className="flex items-center gap-3 rounded-lg border border-border/60 bg-muted/10 p-3 hover:bg-muted/20 transition-colors"
                  >
                    <div className="flex-1 min-w-0">
                      <h4 className="text-sm font-bold text-foreground truncate">
                        {listing.position_title}
                      </h4>
                      <p className="text-xs text-muted-foreground truncate">
                        {listing.positions_available} opening{listing.positions_available !== 1 ? 's' : ''} · {listing.community_name}
                      </p>
                    </div>
                    <div className="flex items-center gap-1 text-xs font-semibold text-muted-foreground shrink-0 whitespace-nowrap">
                      <Coins className="h-3 w-3" />
                      <span>{listing.wage_per_day_community_coin}/day</span>
                    </div>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleCancelListing(listing.id)}
                      disabled={cancellingListingId === listing.id}
                      className="h-8 px-2.5 gap-1.5 text-xs shrink-0"
                    >
                      <X className="h-3 w-3" />
                      {cancellingListingId === listing.id ? "Cancelling..." : "Cancel"}
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </SheetContent>

      {/* Upgrade Dialog */}
      {selectedUpgradeLevel !== null && companyType && (
        <CompanyUpgradeDialog
          isOpen={showUpgradeDialog}
          onClose={() => {
            setShowUpgradeDialog(false);
            setSelectedUpgradeLevel(null);
          }}
          onConfirm={handleUpgradeCompany}
          level={selectedUpgradeLevel}
          goldCost={calculateUpgradeCost(selectedUpgradeLevel)}
          companyName={company?.name || ""}
          maxLevel={companyType.max_level}
        />
      )}
    </Sheet>
  );
}
