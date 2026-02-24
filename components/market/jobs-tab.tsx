"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import { toast } from "sonner";
import { Loader2, Briefcase } from "lucide-react";
import { Button } from "@/components/ui/button";
import { H2, P } from "@/components/ui/typography";
import { getJobListings } from "@/app/actions/market";
import { showErrorToast, showLocationAccessError, showTravelRequiredToast } from "@/lib/toast-utils";
import { TableSkeleton } from "./market-skeletons";
import { DailyWorkSection } from "@/components/economy/daily-work-section";
import { normalizeEmployments, pickPrimaryEmployment } from "@/lib/company-employment";
import { CommunityCoinIcon } from "@/components/ui/coin-icon";
import { getCurrencyDisplayInfo, type CommunityCurrency } from "@/lib/currency-display";
import type { UserEmployment } from "@/lib/types/companies";
import { MARKET_TABLE_CONFIG, JOB_TABLE_COLUMNS } from "./market-config";
import type { BaseTabProps, MarketListing } from "./types";

interface JobsTabProps extends BaseTabProps {
  communityCurrencies: CommunityCurrency[];
}

export function JobsTab({ selectedCommunities, communityCurrencies }: JobsTabProps) {
  const [listings, setListings] = useState<MarketListing[]>([]);
  const [loading, setLoading] = useState(true);
  const [employments, setEmployments] = useState<UserEmployment[]>([]);
  const [loadingEmployments, setLoadingEmployments] = useState(true);
  const [applying, setApplying] = useState<Record<string, boolean>>({});
  const [workingCompanyId, setWorkingCompanyId] = useState<string | null>(null);
  const primaryEmployment = useMemo(
    () => pickPrimaryEmployment(employments),
    [employments]
  );
  const hasActiveEmployment = Boolean(primaryEmployment);
  const currencyLookup = useMemo(
    () => new Map(communityCurrencies.map((c) => [c.community_id, c])),
    [communityCurrencies]
  );

  const isTravelRequiredError = (message?: string | null) =>
    Boolean(message && message.toLowerCase().includes("travel to this community"));

  const loadEmployments = useCallback(async () => {
    setLoadingEmployments(true);
    try {
      const { getUserEmployments } = await import("@/app/actions/companies");
      const data = await getUserEmployments();
      setEmployments(normalizeEmployments(data));
    } catch (error) {
      console.error("Error loading employments:", error);
      toast.error("Failed to load employment data");
    } finally {
      setLoadingEmployments(false);
    }
  }, []);

  useEffect(() => {
    const loadListings = async () => {
      setLoading(true);
      try {
        const data = await getJobListings({
          communityIds: selectedCommunities.length > 0 ? selectedCommunities : undefined,
        });
        setListings(data);
      } catch (error) {
        console.error("Error loading job listings:", error);
        toast.error("Failed to load job listings");
      } finally {
        setLoading(false);
      }
    };

    loadListings();
  }, [selectedCommunities]);

  useEffect(() => {
    loadEmployments();
  }, [loadEmployments]);

  const handleWork = useCallback(
    async (employment: UserEmployment) => {
      const recipeId =
        Array.isArray(employment.available_recipes) && employment.available_recipes.length > 0
          ? employment.available_recipes[0]
          : null;

      if (!recipeId) {
        toast("No Recipes Available", {
          description: "This company has no production recipes configured",
        });
        return;
      }

      setWorkingCompanyId(employment.company_id);

      try {
        const { performWork } = await import("@/app/actions/companies");
        const result = await performWork({
          company_id: employment.company_id,
          recipe_id: recipeId,
        });

        if (result.success) {
          toast("Work Complete", {
            description: result.work_type === "manager"
              ? "Production completed as manager"
              : `Work completed. Earned wage: ${result.wage_earned || 0}`,
          });

          await loadEmployments();
        } else {
          if (isTravelRequiredError(result.error)) {
            showTravelRequiredToast({
              description: result.error || "Travel to this community to work as an employee here.",
            });
          } else {
            showErrorToast("Work Failed", {
              description: result.error || "Failed to complete work",
            });
          }
        }
      } catch (error) {
        showErrorToast("Work Failed", {
          description: "Failed to complete work",
        });
      } finally {
        setWorkingCompanyId(null);
      }
    },
    [loadEmployments]
  );

  const handleApply = async (listing: MarketListing) => {
    if (hasActiveEmployment) {
      showErrorToast("Already hired", {
        description: "Leave your current job before applying to another.",
      });
      return;
    }

    setApplying((prev) => ({ ...prev, [listing.id]: true }));
    try {
      const { applyToJob } = await import("@/app/actions/market");
      const result = await applyToJob(listing.id);

      if (result.success) {
        toast.success(
          `Successfully hired! Position: ${result.position}, Wage: ${result.wage_cc} currency/day`
        );

        // Reload listings
        const data = await getJobListings({
          communityIds: selectedCommunities.length > 0 ? selectedCommunities : undefined,
        });
        setListings(data);
        await loadEmployments();
      } else {
        if (isTravelRequiredError(result.error)) {
          // Use unified location error toast
          if (listing.community_name) {
            showLocationAccessError({
              communityName: listing.community_name,
              action: "apply",
            });
          } else {
            showTravelRequiredToast({
              description: result.error || "Travel to this community to accept this job.",
            });
          }
        } else {
          showErrorToast("Application failed", {
            description: result.error || "Failed to apply",
          });
        }
      }
    } catch (error) {
      showErrorToast("Application failed", {
        description: "Failed to apply to job",
      });
    } finally {
      setApplying((prev) => ({ ...prev, [listing.id]: false }));
    }
  };

  const handleLeave = useCallback(async (employment: UserEmployment) => {
    try {
      const { leaveEmployment } = await import("@/app/actions/companies");
      const result = await leaveEmployment(employment.id);
      if (result.success) {
        toast.success("You left the company.");
        setEmployments((prev) =>
          prev.filter(
            (item) =>
              item.id !== employment.id &&
              item.company_id !== employment.company_id
          )
        );
        await loadEmployments();
        return true;
      } else {
        toast.error(result.error || "Failed to leave company");
        return false;
      }
    } catch (error) {
      toast.error("Failed to leave company");
      return false;
    }
  }, [loadEmployments]);

  return (
    <div className="space-y-6">
      <DailyWorkSection
        title="Hired"
        isLoading={loadingEmployments}
        employments={employments}
        workingCompanyId={workingCompanyId}
        onWork={handleWork}
        onLeave={handleLeave}
        emptyState={
          <p className="text-sm text-muted-foreground text-center">
            You're not employed at any companies yet.
          </p>
        }
      />

      <section className="space-y-4">
        <H2>
          <Briefcase className="h-5 w-5 text-foreground" />
          Job Offers
        </H2>
        {hasActiveEmployment && (
          <P className="text-xs">
            Leave your current job to apply for a new offer.
          </P>
        )}
        {loading ? (
          <TableSkeleton rows={5} />
        ) : listings.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-sm text-muted-foreground">No job openings available.</p>
          </div>
        ) : (
          <div className={MARKET_TABLE_CONFIG.container}>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className={MARKET_TABLE_CONFIG.headerRow}>
                  <tr className={MARKET_TABLE_CONFIG.headerCell}>
                    <th className={`px-4 py-3 text-${JOB_TABLE_COLUMNS.company.align}`}>Company</th>
                    <th className={`px-4 py-3 text-${JOB_TABLE_COLUMNS.position.align}`}>Position</th>
                    <th className={`px-4 py-3 text-${JOB_TABLE_COLUMNS.owner.align}`}>Owner</th>
                    <th className={`px-4 py-3 text-${JOB_TABLE_COLUMNS.wage.align}`}>Wage/Day</th>
                    <th className={`px-4 py-3 text-${JOB_TABLE_COLUMNS.location.align}`}>Location</th>
                    <th className={`px-4 py-3 text-${JOB_TABLE_COLUMNS.openings.align}`}>Openings</th>
                    <th className={`px-4 py-3 text-${JOB_TABLE_COLUMNS.action.align}`}>Action</th>
                  </tr>
                </thead>
                <tbody className={MARKET_TABLE_CONFIG.divider}>
                  {listings.map((listing) => {
                    const currency = currencyLookup.get(listing.community_id);
                    const currencyInfo = getCurrencyDisplayInfo(currency || null);

                    return (
                      <tr key={listing.id} className={MARKET_TABLE_CONFIG.bodyRow}>
                        <td className="px-4 py-3 text-center">
                          <span className="text-sm font-medium text-foreground">
                            {listing.company_name}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-center">
                          <span className="text-sm text-foreground">{listing.position_title}</span>
                        </td>
                        <td className="px-4 py-3 text-center">
                          <span className="text-sm text-muted-foreground">
                            {listing.company_owner_username}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center justify-center gap-1">
                            <span className="text-sm font-semibold text-foreground tabular-nums">
                              {listing.wage_per_day_community_coin?.toFixed(2)}
                            </span>
                            <CommunityCoinIcon className="h-4 w-4" color={currencyInfo.color} />
                            <span className="text-xs font-medium text-muted-foreground">
                              {currencyInfo.symbol}
                            </span>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-center">
                          <a
                            href="/map"
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-sm text-primary hover:underline truncate block"
                          >
                            {listing.community_name}
                          </a>
                        </td>
                        <td className="px-4 py-3 text-center">
                          <span className="text-sm font-medium text-foreground">
                            {listing.positions_available}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-center">
                          <Button
                            size="sm"
                            onClick={() => handleApply(listing)}
                            disabled={applying[listing.id] || hasActiveEmployment}
                            className="gap-1.5 font-bold transition-all"
                          >
                            {applying[listing.id] ? (
                              <>
                                <Loader2 className="size-3.5 animate-spin" />
                                Applying...
                              </>
                            ) : (
                              <>
                                <Briefcase className="size-3.5" />
                                Apply
                              </>
                            )}
                          </Button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </section>
    </div>
  );
}
