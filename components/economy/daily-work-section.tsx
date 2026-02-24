"use client";

import React, { useMemo, useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { H2 } from "@/components/ui/typography";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  AlertCircle,
  Briefcase,
  CheckCircle2,
  Loader2,
  MapPin,
  UserX,
  Zap,
} from "lucide-react";
import { toast } from "sonner";
import type { UserEmployment } from "@/lib/types/companies";
import { getCompanyIcon } from "@/lib/company-config";
import { CommunityCoinIcon } from "@/components/ui/coin-icon";
import { cn } from "@/lib/utils";
import { pickPrimaryEmployment } from "@/lib/company-employment";

interface DailyWorkSectionProps {
  title: string;
  isLoading: boolean;
  employments: UserEmployment[];
  workingCompanyId: string | null;
  emptyState: React.ReactNode;
  onWork: (employment: UserEmployment) => Promise<void> | void;
  onLeave?: (employment: UserEmployment) => Promise<boolean> | boolean;
}

export function DailyWorkSection({
  title,
  isLoading,
  employments,
  workingCompanyId,
  emptyState,
  onWork,
  onLeave,
}: DailyWorkSectionProps) {
  const [leaveTarget, setLeaveTarget] = useState<UserEmployment | null>(null);
  const [isLeaveDialogOpen, setIsLeaveDialogOpen] = useState(false);
  const [isLeaving, setIsLeaving] = useState(false);
  const primaryEmployment = useMemo(
    () => pickPrimaryEmployment(employments),
    [employments]
  );
  const visibleEmployments = primaryEmployment ? [primaryEmployment] : [];

  const handleOpenLeave = (employment: UserEmployment) => {
    if (!onLeave) return;
    setLeaveTarget(employment);
    setIsLeaveDialogOpen(true);
  };

  const handleConfirmLeave = async () => {
    if (!leaveTarget || !onLeave) return;
    setIsLeaving(true);
    try {
      const result = await onLeave(leaveTarget);
      if (result === false) return;
      setIsLeaveDialogOpen(false);
      setLeaveTarget(null);
    } catch (error) {
      console.error("Error leaving company:", error);
      toast.error("Failed to leave company");
    } finally {
      setIsLeaving(false);
    }
  };

  return (
    <section className="space-y-4">
      <H2>
        <Briefcase className="h-5 w-5 text-foreground" />
        {title}
      </H2>

      {isLoading ? (
        <Skeleton className="h-16 w-full rounded-xl" />
      ) : visibleEmployments.length === 0 ? (
        <Card className="border-border/60">
          {emptyState}
        </Card>
      ) : (
        <div className="space-y-2">
          {visibleEmployments.map((employment) => {
            const IconComponent = getCompanyIcon(employment.company_type_key);
            const isWorking = workingCompanyId === employment.company_id;

            return (
              <Card
                key={employment.id}
                variant="compact"
                className="border-border/60 hover:bg-muted/30 transition-colors"
              >
                <div className="flex items-center justify-between gap-4">
                  <div className="flex items-center gap-3 flex-1 min-w-0">
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-muted text-muted-foreground shrink-0">
                      <IconComponent className="h-5 w-5" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="text-sm font-bold text-foreground truncate">
                        {employment.company_name}
                      </h3>
                      <p className="text-xs text-muted-foreground">
                        {employment.company_type_name} · Owner: {employment.owner_username}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-1 text-sm font-semibold shrink-0">
                    <CommunityCoinIcon className="h-4 w-4" />
                    <span>{employment.wage_per_day_community_coin}</span>
                  </div>

                  <div className="flex items-center gap-1 text-xs text-muted-foreground shrink-0">
                    <MapPin className="h-3.5 w-3.5" />
                    <span className="hidden sm:inline">
                      {employment.custom_name ?? "Unknown region"}
                    </span>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <Button
                      onClick={() => onWork(employment)}
                      disabled={!employment.can_work_today || isWorking}
                      size="sm"
                      variant={employment.can_work_today ? "default" : "outline"}
                      className={cn(
                        "gap-1.5 font-bold transition-all",
                        isWorking && "animate-pulse cursor-wait"
                      )}
                    >
                      {isWorking ? (
                        <>
                          <Loader2 className="size-3.5 animate-spin" />
                          Working...
                        </>
                      ) : employment.can_work_today ? (
                        <>
                          <Zap className="size-3.5" />
                          Work
                        </>
                      ) : (
                        <>
                          <CheckCircle2 className="size-3.5" />
                          Done
                        </>
                      )}
                    </Button>

                    {onLeave && (
                      <Button
                        onClick={() => handleOpenLeave(employment)}
                        disabled={isLeaving}
                        size="icon-sm"
                        variant="outline"
                        className="border-border/60"
                        aria-label="Leave company"
                      >
                        <UserX className="size-3.5" />
                      </Button>
                    )}
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {onLeave && (
        <AlertDialog
          open={isLeaveDialogOpen}
          onOpenChange={(open) => {
            setIsLeaveDialogOpen(open);
            if (!open) {
              setLeaveTarget(null);
            }
          }}
        >
          <AlertDialogContent className="max-w-sm">
            <AlertDialogHeader className="space-y-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-red-500/10 text-red-600">
                <AlertCircle size={20} />
              </div>
              <AlertDialogTitle className="text-lg font-bold">
                Leave {leaveTarget?.company_name}?
              </AlertDialogTitle>
              <AlertDialogDescription className="text-sm leading-relaxed">
                You will stop earning daily wages here and lose access to this company&apos;s work.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter className="gap-3 pt-6">
              <div className="flex w-full flex-col gap-3 sm:flex-row sm:justify-between sm:max-w-[340px] sm:mx-auto">
                <AlertDialogCancel asChild>
                  <Button variant="outline" size="sm" className="flex-1 font-semibold">
                    Keep job
                  </Button>
                </AlertDialogCancel>
                <AlertDialogAction asChild>
                  <Button
                    variant="destructive"
                    size="sm"
                    className="flex-1 font-semibold"
                    onClick={handleConfirmLeave}
                    disabled={isLeaving}
                  >
                    {isLeaving ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Leaving
                      </>
                    ) : (
                      "Leave company"
                    )}
                  </Button>
                </AlertDialogAction>
              </div>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      )}
    </section>
  );
}
