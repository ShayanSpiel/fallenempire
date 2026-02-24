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
} from "lucide-react";
import { toast } from "sonner";
import { getCompanyIcon } from "@/lib/company-config";
import type { CompanyWithType, UserCompany } from "@/lib/types/companies";
import { RegionName } from "@/components/ui/region-name";

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

  if (!company) return null;

  const IconComponent = getCompanyIcon(company.company_type_key);
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
          {/* Company Stats */}
          <div className="grid grid-cols-3 gap-4">
            <div className="rounded-lg border border-border/60 bg-card/50 p-4">
              <div className="flex items-center gap-2 text-muted-foreground mb-1">
                <TrendingUp className="h-4 w-4" />
                <span className="text-xs font-semibold uppercase tracking-wider">Level</span>
              </div>
              <p className="text-2xl font-bold text-foreground">{company.level}</p>
            </div>
            <div className="rounded-lg border border-border/60 bg-card/50 p-4">
              <div className="flex items-center gap-2 text-muted-foreground mb-1">
                <Building2 className="h-4 w-4" />
                <span className="text-xs font-semibold uppercase tracking-wider">Health</span>
              </div>
              <p className="text-2xl font-bold text-foreground">{company.health}%</p>
            </div>
            <div className="rounded-lg border border-border/60 bg-card/50 p-4">
              <div className="flex items-center gap-2 text-muted-foreground mb-1">
                <Users className="h-4 w-4" />
                <span className="text-xs font-semibold uppercase tracking-wider">Staff</span>
              </div>
              <p className="text-2xl font-bold text-foreground">{employees.length}</p>
            </div>
          </div>

          {/* Location */}
          <div className="rounded-lg border border-border/60 bg-card/50 p-4">
            <div className="flex items-center gap-2 text-muted-foreground mb-2">
              <MapPin className="h-4 w-4" />
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
              <div className="rounded-lg border border-border/60 bg-card/50 p-4 space-y-4">
                <h4 className="text-sm font-bold text-foreground">Create Job Listing</h4>
                <div className="grid grid-cols-2 gap-4">
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
                      className="w-full px-3 py-2 text-sm border border-border/60 rounded-lg bg-card text-foreground"
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
                      className="w-full px-3 py-2 text-sm border border-border/60 rounded-lg bg-card text-foreground"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                      Wage (Community Coin/Day)
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
                      className="w-full px-3 py-2 text-sm border border-border/60 rounded-lg bg-card text-foreground"
                    />
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button
                    onClick={handleCreateJobListing}
                    disabled={creatingJob}
                    className="flex-1"
                  >
                    {creatingJob ? "Creating..." : "Create Listing"}
                  </Button>
                  <Button variant="outline" onClick={() => setShowJobForm(false)}>
                    Cancel
                  </Button>
                </div>
              </div>
            )}

            {/* Employees List */}
            {loadingEmployees ? (
              <div className="space-y-2">
                <Skeleton className="h-16 w-full" />
                <Skeleton className="h-16 w-full" />
              </div>
            ) : employees.length === 0 ? (
              <div className="rounded-lg border border-border/60 bg-card/50 p-8 text-center">
                <p className="text-sm text-muted-foreground">
                  No employees yet. Post a job listing to hire workers.
                </p>
              </div>
            ) : (
              <div className="space-y-2">
                {employees.map((employee) => (
                  <div
                    key={employee.id}
                    className="flex items-center justify-between gap-4 rounded-lg border border-border/60 bg-card/50 p-4"
                  >
                    <div className="flex items-center gap-3 flex-1 min-w-0">
                      <div className="flex h-10 w-10 items-center justify-center rounded-full bg-muted text-muted-foreground shrink-0">
                        <Users className="h-5 w-5" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <h4 className="text-sm font-bold text-foreground truncate">
                          {employee.employee_name}
                        </h4>
                        <p className="text-xs text-muted-foreground">
                          {employee.position} · {employee.total_work_days} days worked
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-1 text-sm font-semibold shrink-0">
                      <Coins className="h-4 w-4" />
                      <span>{employee.wage_per_day_community_coin} currency/day</span>
                    </div>
                    <Badge variant="outline" className="shrink-0">
                      {employee.employee_type}
                    </Badge>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => handleFireEmployee(employee.id)}
                      disabled={firingEmployeeId === employee.id}
                      className="gap-2 shrink-0"
                    >
                      <UserX className="h-4 w-4" />
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
                <Skeleton className="h-16 w-full" />
                <Skeleton className="h-16 w-full" />
              </div>
            ) : jobListings.length === 0 ? (
              <div className="rounded-lg border border-border/60 bg-card/50 p-8 text-center">
                <p className="text-sm text-muted-foreground">
                  No active job listings. Post a job listing to attract workers.
                </p>
              </div>
            ) : (
              <div className="space-y-2">
                {jobListings.map((listing) => (
                  <div
                    key={listing.id}
                    className="flex items-center justify-between gap-4 rounded-lg border border-border/60 bg-card/50 p-4"
                  >
                    <div className="flex-1 min-w-0">
                      <h4 className="text-sm font-bold text-foreground truncate">
                        {listing.position_title}
                      </h4>
                      <p className="text-xs text-muted-foreground">
                        {listing.positions_available} opening{listing.positions_available !== 1 ? 's' : ''} ·
                        {listing.community_name}
                      </p>
                    </div>
                    <div className="flex items-center gap-1 text-sm font-semibold shrink-0">
                      <Coins className="h-4 w-4" />
                      <span>{listing.wage_per_day_community_coin} currency/day</span>
                    </div>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => handleCancelListing(listing.id)}
                      disabled={cancellingListingId === listing.id}
                      className="gap-2 shrink-0"
                    >
                      <X className="h-4 w-4" />
                      {cancellingListingId === listing.id ? "Cancelling..." : "Cancel"}
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
