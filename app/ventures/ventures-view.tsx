"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { PageSection } from "@/components/layout/page-section";
import { H1, H2, P } from "@/components/ui/typography";
import {
  Building2,
  Briefcase,
  MapPin,
  Zap,
  TrendingUp,
  CheckCircle2,
  Settings,
  Loader2,
} from "lucide-react";
import type {
  UserCompany,
  UserEmployment,
} from "@/lib/types/companies";
import {
  getUserCompanies,
  getUserEmployments,
  performWork,
} from "@/app/actions/companies";
import { toast } from "sonner";
import { showErrorToast, showTravelRequiredToast } from "@/lib/toast-utils";
import { getCompanyIcon } from "@/lib/company-config";
import { CompanyDetailsSheet } from "@/components/economy/company-details-sheet";
import { DailyWorkSection } from "@/components/economy/daily-work-section";
import { cn } from "@/lib/utils";
import { normalizeEmployments } from "@/lib/company-employment";

interface VenturesViewProps {
  userId: string;
}

export function VenturesView({ userId }: VenturesViewProps) {
  const [isLoadingCompanies, setIsLoadingCompanies] = useState(true);
  const [isLoadingEmployments, setIsLoadingEmployments] = useState(true);
  const [companies, setCompanies] = useState<UserCompany[]>([]);
  const [employments, setEmployments] = useState<UserEmployment[]>([]);
  const [workingCompanyId, setWorkingCompanyId] = useState<string | null>(null);
  const [selectedCompany, setSelectedCompany] = useState<UserCompany | null>(null);
  const [detailsSheetOpen, setDetailsSheetOpen] = useState(false);

  // Load user's companies
  useEffect(() => {
    const loadCompanies = async () => {
      setIsLoadingCompanies(true);
      const data = await getUserCompanies(userId);
      setCompanies(data);
      setIsLoadingCompanies(false);
    };
    loadCompanies();
  }, [userId]);

  // Load user's employments
  useEffect(() => {
    const loadEmployments = async () => {
      setIsLoadingEmployments(true);
      const data = await getUserEmployments(userId);
      setEmployments(normalizeEmployments(data));
      setIsLoadingEmployments(false);
    };
    loadEmployments();
  }, [userId]);

  const handleWork = async (
    companyId: string,
    availableRecipes: string[],
    isManager: boolean
  ) => {
    // Auto-select first available recipe
    const recipeId = Array.isArray(availableRecipes) && availableRecipes.length > 0
      ? availableRecipes[0]
      : null;

    if (!recipeId) {
      toast("No Recipes Available", {
        description: "This company has no production recipes configured",
      });
      return;
    }

    setWorkingCompanyId(companyId);

    const result = await performWork({
      worker_id: userId,
      company_id: companyId,
      recipe_id: recipeId,
    });

    if (result.success) {
      toast("Work Complete", {
        description: result.work_type === "manager"
          ? "Production completed as manager"
          : `Work completed. Earned wage: ${result.wage_earned || 0}`,
      });

      // Reload data
      const [companiesData, employmentsData] = await Promise.all([
        getUserCompanies(userId),
        getUserEmployments(userId),
      ]);
      setCompanies(companiesData);
      setEmployments(employmentsData);
    } else {
      if (result.error?.toLowerCase().includes("travel to this community")) {
        showTravelRequiredToast({
          description: result.error || "Travel to this community to work as an employee here.",
        });
      } else {
        showErrorToast("Work Failed", {
          description: result.error || "Failed to complete work",
        });
      }
    }

    setWorkingCompanyId(null);
  };

  return (
    <PageSection>
      <div className="space-y-8">
        {/* Header */}
        <div>
          <H1>Ventures</H1>
          <P className="mt-1 font-medium">
            Manage your companies and work contracts
          </P>
        </div>

        <DailyWorkSection
          title="Daily Work"
          isLoading={isLoadingEmployments}
          employments={employments}
          workingCompanyId={workingCompanyId}
          onWork={(employment) =>
            handleWork(employment.company_id, employment.available_recipes, false)
          }
          emptyState={
            <p className="text-sm text-muted-foreground text-center">
              You're not employed at any companies. Apply for jobs in the{" "}
              <Link
                href="/market?tab=jobs"
                className="inline-flex items-baseline gap-1 text-sm text-primary hover:underline"
              >
                <Briefcase className="h-3 w-3" />
                Job Market
              </Link>
              .
            </p>
          }
        />

        {/* My Companies Section */}
        <section className="space-y-4">
          <H2>
            <Building2 className="h-5 w-5 text-foreground" />
            My Companies ({companies.length})
          </H2>

          {isLoadingCompanies ? (
            <div className="space-y-2">
              <Skeleton className="h-16 w-full rounded-xl" />
              <Skeleton className="h-16 w-full rounded-xl" />
              <Skeleton className="h-16 w-full rounded-xl" />
            </div>
          ) : companies.length === 0 ? (
            <Card className="p-12 border-border/60">
              <div className="flex flex-col items-center justify-center space-y-4">
                <div className="rounded-full bg-muted p-6">
                  <Building2 className="h-12 w-12 text-muted-foreground" />
                </div>
                <div className="text-center space-y-2">
                  <h3 className="text-lg font-bold text-foreground">
                    No Companies Yet
                  </h3>
                  <p className="text-sm text-muted-foreground max-w-md">
                    You haven't founded any companies. Visit the map and use the
                    Ventures tab on any hex to establish your first venture.
                  </p>
                </div>
                <Button onClick={() => (window.location.href = "/map")} variant="outline">
                  <MapPin className="h-4 w-4 mr-2" />
                  Go to Map
                </Button>
              </div>
            </Card>
          ) : (
            <div className="space-y-2">
              {companies.map((company) => {
                const IconComponent = getCompanyIcon(company.company_type_key);
                const isWorking = workingCompanyId === company.id;

                return (
                  <Card
                    key={company.id}
                    variant="compact"
                    className="border-border/60 hover:bg-muted/30 transition-colors"
                  >
                    <div className="flex items-center justify-between gap-4">
                      {/* Company Info */}
                      <div className="flex items-center gap-3 flex-1 min-w-0">
                        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-muted text-muted-foreground shrink-0">
                          <IconComponent className="h-5 w-5" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <h3 className="text-sm font-bold text-foreground truncate">
                            {company.name}
                          </h3>
                          <p className="text-xs text-muted-foreground">
                            {company.company_type_name}
                          </p>
                        </div>
                      </div>

                      {/* Level */}
                      <Badge variant="default" className="text-xs shrink-0">
                        Lv{company.level}
                      </Badge>

                      {/* Health */}
                      <div className="flex items-center gap-1 text-xs text-muted-foreground shrink-0">
                        <TrendingUp className="h-3.5 w-3.5" />
                        <span className="hidden sm:inline">{company.health}%</span>
                      </div>

                      {/* Location */}
                      <div className="flex items-center gap-1 text-xs text-muted-foreground shrink-0">
                        <MapPin className="h-3.5 w-3.5" />
                        <span className="hidden sm:inline">
                          {company.custom_name ?? "Unknown region"}
                        </span>
                      </div>

                      {/* Manage Button */}
                      <Button
                        onClick={() => {
                          setSelectedCompany(company);
                          setDetailsSheetOpen(true);
                        }}
                        size="sm"
                        variant="ghost"
                        className="gap-2 shrink-0"
                      >
                        <Settings className="h-3.5 w-3.5" />
                        <span className="hidden sm:inline">Manage</span>
                      </Button>

                      {/* Work as Manager Button */}
                      <Button
                        onClick={() => handleWork(
                          company.id,
                          company.available_recipes,
                          true
                        )}
                        disabled={!company.can_work_today || isWorking}
                        size="sm"
                        variant={company.can_work_today ? "default" : "outline"}
                        className={cn(
                          "gap-1.5 font-bold transition-all shrink-0",
                          isWorking && "animate-pulse cursor-wait"
                        )}
                      >
                        {isWorking ? (
                          <>
                            <Loader2 className="size-3.5 animate-spin" />
                            Working...
                          </>
                        ) : company.can_work_today ? (
                          <>
                            <Zap className="size-3.5" />
                            Work as Manager
                          </>
                        ) : (
                          <>
                            <CheckCircle2 className="size-3.5" />
                            Worked Today
                          </>
                        )}
                      </Button>
                    </div>
                  </Card>
                );
              })}
            </div>
          )}
        </section>

        {/* Company Details Sheet */}
        <CompanyDetailsSheet
          company={selectedCompany}
          open={detailsSheetOpen}
          onOpenChange={setDetailsSheetOpen}
          onUpdate={async () => {
            const data = await getUserCompanies(userId);
            setCompanies(data);
          }}
        />
      </div>
    </PageSection>
  );
}
