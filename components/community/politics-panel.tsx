"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Gavel, Clock, CheckCircle2, XCircle } from "lucide-react";

import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { LawListAccordion } from "./law-list-accordion";
import { LawProposalDrawer } from "./law-proposal-drawer";
import { SectionHeading } from "@/components/ui/section-heading";
import {
  getCommunityActiveProposalsAction,
  getCommunityResolvedProposalsAction,
} from "@/app/actions/laws";
import { cn } from "@/lib/utils";
import { LAW_REGISTRY, getGovernanceRules, type LawType } from "@/lib/governance/laws";

interface PoliticsPanelProps {
  communityId: string;
  userRank: number;
  governanceType: string;
  communityColor?: string | null;
}

interface Proposal {
  id: string;
  law_type: string;
  status: string;
  created_at: string;
  expires_at: string;
  yesVotes: number;
  noVotes: number;
  proposer_id?: string;
  proposer_name?: string;
  metadata?: Record<string, unknown>;
  resolved_at?: string | null;
}

const PROPOSAL_SKELETON_COUNT = 3;
const RESOLVED_SKELETON_COUNT = 2;
const RESOLVED_PAGE_SIZE = 10;
const ACTIVE_PROPOSALS_CACHE = new Map<string, Proposal[]>();

export function PoliticsPanel({
  communityId,
  userRank,
  governanceType,
  communityColor,
}: PoliticsPanelProps) {
  const [isAccordionExpanded, setIsAccordionExpanded] = useState(false);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [selectedLaw, setSelectedLaw] = useState<LawType | null>(null);
  const [selectedProposalId, setSelectedProposalId] = useState<string | null>(null);
  const [activeProposals, setActiveProposals] = useState<Proposal[]>([]);
  const [resolvedProposals, setResolvedProposals] = useState<Proposal[]>([]);
  const [isInitialProposalsLoading, setIsInitialProposalsLoading] = useState(true);
  const [isRefreshingProposals, setIsRefreshingProposals] = useState(false);
  const hasLoadedProposalsRef = useRef(false);
  const [resolvedPage, setResolvedPage] = useState(1);
  const [resolvedTotalCount, setResolvedTotalCount] = useState(0);
  const [hasLoadedResolved, setHasLoadedResolved] = useState(false);
  const [isResolvedLoading, setIsResolvedLoading] = useState(false);

  // Load ACTIVE proposals (refresh every 30s)
  const loadActiveProposals = useCallback(async () => {
    const cacheEntry = ACTIVE_PROPOSALS_CACHE.get(communityId);
    const hasCachedData = Boolean(cacheEntry && cacheEntry.length > 0);
    const isFirstLoad = !hasLoadedProposalsRef.current;

    if (cacheEntry) {
      setActiveProposals(cacheEntry);
    }

    if (isFirstLoad) {
      setIsInitialProposalsLoading(!hasCachedData);
    } else {
      setIsRefreshingProposals(true);
    }

    try {
      const data = await getCommunityActiveProposalsAction(communityId);
      setActiveProposals(data);
      ACTIVE_PROPOSALS_CACHE.set(communityId, data);
    } catch (error) {
      console.error("Failed to load proposals:", error);
    } finally {
      if (isFirstLoad) {
        setIsInitialProposalsLoading(false);
      }
      setIsRefreshingProposals(false);
      hasLoadedProposalsRef.current = true;
    }
  }, [communityId]);

  useEffect(() => {
    loadActiveProposals();
    const interval = setInterval(loadActiveProposals, 30000); // Refresh every 30s
    return () => clearInterval(interval);
  }, [loadActiveProposals]);

  const loadResolvedProposals = useCallback(
    async (page: number) => {
      setIsResolvedLoading(true);
      try {
        const result = await getCommunityResolvedProposalsAction(
          communityId,
          page,
          RESOLVED_PAGE_SIZE
        );
        setResolvedProposals(result.items as Proposal[]);
        setResolvedTotalCount(result.totalCount);
        setResolvedPage(result.page);
        setHasLoadedResolved(true);
      } catch (error) {
        console.error("Failed to load resolved proposals:", error);
      } finally {
        setIsResolvedLoading(false);
      }
    },
    [communityId]
  );

  const handleSelectLaw = (lawType: LawType) => {
    setSelectedLaw(lawType);
    setSelectedProposalId(null);
    setIsDrawerOpen(true);
    setIsAccordionExpanded(false);
  };

  const handleSelectProposal = (proposalId: string) => {
    setSelectedProposalId(proposalId);
    setSelectedLaw(null);
    setIsDrawerOpen(true);
  };

  const handleProposalCreated = () => {
    loadActiveProposals();
    if (hasLoadedResolved) {
      void loadResolvedProposals(1);
    }
  };

  const handleDrawerClose = () => {
    setIsDrawerOpen(false);
    setSelectedLaw(null);
    setSelectedProposalId(null);
  };

  const pendingProposals = useMemo(() => activeProposals, [activeProposals]);
  const totalResolvedPages = Math.max(1, Math.ceil(resolvedTotalCount / RESOLVED_PAGE_SIZE));

  const lawHeadingActions = (
    <div className="flex flex-col items-end gap-1 text-right">
      <span className="text-[10px] font-semibold uppercase tracking-[0.3em] text-muted-foreground">
        {pendingProposals.length} active
      </span>
      {isRefreshingProposals && (
        <span className="text-[9px] uppercase tracking-[0.3em] text-muted-foreground/70">
          Refreshing...
        </span>
      )}
    </div>
  );

  return (
    <>
      <div className="space-y-6">
        <Card variant="default" className="h-full">
          <CardContent className="space-y-5">
            <SectionHeading
              title="Laws & Proposals"
              icon={Gavel}
              actions={lawHeadingActions}
            />

            {/* Inline Accordion - Law List */}
            <LawListAccordion
              governanceType={governanceType}
              userRank={userRank}
              onSelectLaw={handleSelectLaw}
              isExpanded={isAccordionExpanded}
              onToggle={setIsAccordionExpanded}
            />

            {/* Active Proposals */}
            <div className="space-y-3">
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Active Proposals
              </p>
              {isInitialProposalsLoading ? (
                <div className="space-y-3">
                  {Array.from({ length: PROPOSAL_SKELETON_COUNT }).map((_, index) => (
                    <Card
                      key={`active-proposal-skeleton-${index}`}
                      variant="compact"
                      className="animate-pulse border border-border/50 bg-muted/10 p-3"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1 space-y-2">
                          <div className="h-3 w-2/3 rounded bg-muted-foreground/20" />
                          <div className="h-2 w-1/3 rounded bg-muted-foreground/10" />
                        </div>
                        <div className="h-3 w-14 rounded bg-muted-foreground/10" />
                      </div>
                      <div className="mt-3 flex items-center gap-2 text-xs text-muted-foreground">
                        <div className="h-3 w-16 rounded bg-muted-foreground/10" />
                        <div className="h-3 w-10 rounded bg-muted-foreground/10" />
                      </div>
                      <div className="mt-3 flex items-center gap-2">
                        <div className="flex-1 h-1.5 rounded-full bg-border/40">
                          <div className="h-full w-full rounded-full bg-muted-foreground/30" />
                        </div>
                        <div className="h-3 w-10 rounded bg-muted-foreground/10" />
                      </div>
                      <div className="mt-2 h-2 w-1/2 rounded bg-muted-foreground/10" />
                    </Card>
                  ))}
                </div>
              ) : pendingProposals.length === 0 ? (
                <Card variant="compact" className="border border-border/50 bg-card/30 p-4">
                  <p className="text-sm font-semibold text-foreground">No active proposals.</p>
                  <p className="text-xs text-muted-foreground">
                    Proposals will appear here when someone proposes a law.
                  </p>
                </Card>
              ) : (
                pendingProposals.map((proposal) => {
                  const lawDef = LAW_REGISTRY[proposal.law_type as keyof typeof LAW_REGISTRY];
                  const rules = lawDef
                    ? getGovernanceRules(
                        proposal.law_type as keyof typeof LAW_REGISTRY,
                        governanceType
                      )
                    : null;

                  const totalVotes = proposal.yesVotes + proposal.noVotes;
                  const expiresIn = new Date(proposal.expires_at).getTime() - Date.now();
                  const hoursLeft = Math.ceil(expiresIn / 3600000);
                  const createdDate = new Date(proposal.created_at);
                  const formattedTime = createdDate.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" });

                  // Get target info for war declarations
                  let targetInfo = "";
                  if (proposal.law_type === "DECLARE_WAR" && proposal.metadata?.target_community_name) {
                    targetInfo = ` against ${proposal.metadata.target_community_name}`;
                  }

                  return (
                    <button
                      key={proposal.id}
                      onClick={() => handleSelectProposal(proposal.id)}
                      className="w-full text-left"
                    >
                      <Card
                        variant="compact"
                        className="border border-border/50 bg-muted/10 p-3 space-y-2 hover:bg-muted/20 transition-colors cursor-pointer"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-semibold text-foreground">
                              {lawDef?.label || proposal.law_type}
                              {targetInfo}
                            </p>
                            <p className="text-xs text-muted-foreground mt-0.5">
                              {proposal.proposer_name && (
                                <>Proposed by <span className="font-medium">{proposal.proposer_name}</span> at {formattedTime}</>
                              )}
                            </p>
                          </div>
                        </div>

                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                          <Clock className="h-3 w-3" />
                          <span>
                            {hoursLeft <= 0 ? "Ending soon" : `${hoursLeft}h remaining`}
                          </span>
                        </div>

                        {totalVotes > 0 && (
                          <div className="flex items-center gap-2">
                            <div className="flex-1 h-1.5 bg-border/40 rounded-full overflow-hidden">
                              <div
                                className="h-full bg-emerald-500"
                                style={{
                                  width: `${(proposal.yesVotes / totalVotes) * 100}%`,
                                }}
                              />
                            </div>
                            <span className="text-xs font-semibold text-foreground">
                              {proposal.yesVotes}/{totalVotes}
                            </span>
                          </div>
                        )}

                        {rules && (
                          <p className="text-[10px] text-muted-foreground/70">
                            {rules.passingCondition.replace(/_/g, " ")}
                          </p>
                        )}
                      </Card>
                    </button>
                  );
                })
              )}
            </div>
          </CardContent>
        </Card>

	        <Card variant="default" className="h-full">
	          <CardContent className="space-y-5">
	            <SectionHeading
	              title="Resolved Proposals"
	              icon={CheckCircle2}
	              actions={
	                hasLoadedResolved ? (
	                  <span className="text-[10px] font-semibold uppercase tracking-[0.3em] text-muted-foreground">
	                    {resolvedTotalCount} resolved
	                  </span>
	                ) : (
	                  <Button
	                    variant="outline"
	                    size="sm"
	                    onClick={() => void loadResolvedProposals(1)}
	                    disabled={isResolvedLoading}
	                  >
	                    {isResolvedLoading ? "Loading..." : "Load"}
	                  </Button>
	                )
	              }
	            />
	            <div className="space-y-3">
	              {isResolvedLoading ? (
	                <div className="space-y-3">
	                  {Array.from({ length: RESOLVED_SKELETON_COUNT }).map((_, index) => (
	                    <Card
	                      key={`resolved-skeleton-${index}`}
                      variant="compact"
                      className="animate-pulse border p-3 bg-muted/10"
                    >
                      <div className="flex items-start gap-2">
                        <div className="h-4 w-4 rounded-full bg-muted-foreground/20 flex-shrink-0" />
                        <div className="flex-1 min-w-0 space-y-1">
                          <div className="h-3 w-2/3 rounded bg-muted-foreground/20" />
                          <div className="h-3 w-1/4 rounded bg-muted-foreground/10" />
                        </div>
                      </div>
	                    </Card>
	                  ))}
	                </div>
	              ) : !hasLoadedResolved ? (
	                <Card variant="compact" className="border border-border/50 bg-card/30 p-4">
	                  <p className="text-sm font-semibold text-foreground">Resolved proposals are archived.</p>
	                  <p className="text-xs text-muted-foreground">
	                    Load them on demand to reduce server load.
	                  </p>
	                </Card>
	              ) : resolvedProposals.length === 0 ? (
	                <Card variant="compact" className="border border-border/50 bg-card/30 p-4">
	                  <p className="text-sm font-semibold text-foreground">No resolved laws yet.</p>
	                  <p className="text-xs text-muted-foreground">
	                    Resolutions will appear here when a proposal concludes.
	                  </p>
	                </Card>
	              ) : (
	                resolvedProposals.map((proposal) => {
	                  const lawDef = LAW_REGISTRY[proposal.law_type as keyof typeof LAW_REGISTRY];
	                  const isPassed = proposal.status === "passed";
	                  const isExpired = proposal.status === "expired";
	                  const resolvedAtRaw = proposal.resolved_at ?? proposal.expires_at ?? proposal.created_at;
	                  const resolvedDate = resolvedAtRaw
	                    ? new Date(resolvedAtRaw).toLocaleString("en-US", {
	                        dateStyle: "medium",
                        timeStyle: "short",
                      })
                    : "Unknown time";

                  return (
                    <Card
                      key={proposal.id}
                      variant="compact"
                      onClick={() => handleSelectProposal(proposal.id)}
                      className={cn(
                        "border p-3 cursor-pointer transition-all",
                        isPassed
                          ? "border-emerald-500/30 bg-emerald-500/5 hover:border-emerald-500/50 hover:bg-emerald-500/10"
                          : "border-red-500/30 bg-red-500/5 hover:border-red-500/50 hover:bg-red-500/10"
                      )}
                    >
                      <div className="flex items-start gap-2">
                        {isPassed ? (
                          <CheckCircle2 className="h-4 w-4 text-emerald-600 dark:text-emerald-400 flex-shrink-0 mt-0.5" />
                        ) : (
                          <XCircle className="h-4 w-4 text-red-600 dark:text-red-400 flex-shrink-0 mt-0.5" />
                        )}
                        <div className="flex-1 min-w-0 space-y-1">
                          <div>
                            <p className="text-sm font-semibold text-foreground">
                              {lawDef?.label || proposal.law_type}
                            </p>
                            <p
                              className={cn(
                                "text-xs",
                                isPassed
                                  ? "text-emerald-700 dark:text-emerald-300"
                                  : "text-red-700 dark:text-red-300"
	                              )}
	                            >
	                              {isPassed ? "Passed" : isExpired ? "Expired" : "Rejected"}
	                            </p>
	                          </div>
	                          <p className="text-[10px] text-muted-foreground/70">
	                            {resolvedDate}
                          </p>
                        </div>
                      </div>
                    </Card>
                  );
	                })
	              )}
	            </div>
	            {hasLoadedResolved && resolvedTotalCount > RESOLVED_PAGE_SIZE && (
	              <div className="flex flex-col gap-2 border-t border-border/30 pt-3 sm:flex-row sm:items-center sm:justify-between">
	                <p className="text-[10px] text-muted-foreground uppercase tracking-[0.3em]">
	                  Page {resolvedPage} of {totalResolvedPages}
	                </p>
	                <div className="flex gap-2">
	                  <Button
	                    variant="outline"
	                    size="sm"
	                    onClick={() => void loadResolvedProposals(Math.max(resolvedPage - 1, 1))}
	                    disabled={resolvedPage === 1 || isResolvedLoading}
	                  >
	                    Previous
	                  </Button>
	                  <Button
	                    variant="outline"
	                    size="sm"
	                    onClick={() => void loadResolvedProposals(Math.min(resolvedPage + 1, totalResolvedPages))}
	                    disabled={resolvedPage === totalResolvedPages || isResolvedLoading}
	                  >
	                    Next
	                  </Button>
	                </div>
	              </div>
	            )}
	          </CardContent>
	        </Card>
      </div>

      {/* Law Proposal Drawer - Modal */}
      <LawProposalDrawer
        isOpen={isDrawerOpen}
        onOpenChange={handleDrawerClose}
        communityId={communityId}
        governanceType={governanceType}
        userRank={userRank}
        lawType={selectedLaw || undefined}
        proposalId={selectedProposalId || undefined}
        communityColor={communityColor}
        onProposalCreated={handleProposalCreated}
      />
    </>
  );
}
