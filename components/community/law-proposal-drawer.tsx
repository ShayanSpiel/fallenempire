"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { AlertTriangle, Clock, CheckCircle2, Hammer, Loader2, Megaphone, Podcast, XCircle, Gavel } from "lucide-react";
import { showGovernanceToast } from "@/lib/toast-utils";
import { GoldCoinIcon, CommunityCoinIcon } from "@/components/ui/coin-icon";
import {
  LAW_REGISTRY,
  getGovernanceRules,
  canVoteOnLaw,
  type LawType,
} from "@/lib/governance/laws";
import { getLawColorScheme } from "@/lib/law-design-system";
import { createSupabaseBrowserClient } from "@/lib/supabase-browser";
import { proposeLawAction, voteOnProposalAction } from "@/app/actions/laws";
import { cn, hexToRgba } from "@/lib/utils";
import { formatCommunityColor } from "@/lib/community-visuals";

interface LawProposalDrawerProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  communityId: string;
  governanceType: string;
  userRank: number;
  lawType?: LawType;
  proposalId?: string; // If viewing existing proposal
  communityColor?: string | null;
  onProposalCreated?: (proposalId?: string) => void;
}

interface ProposalData {
  id: string;
  law_type: string;
  status: string;
  metadata: Record<string, unknown>;
  yesVotes: number;
  noVotes: number;
  expires_at: string;
  resolved_at?: string | null;
  resolution_notes?: string | null;
  proposer_id: string;
  proposer_name?: string;
  voteRows: ProposalVoteRow[];
}

type ProposalVoteRow = {
  vote: string | null;
  user_id: string | null;
  community_id?: string | null; // For CFC alliances, tracks which community the voter belongs to
  user?: {
    username?: string | null;
  } | null;
};

type HeirCandidateRow = {
  user_id: string;
  user?: {
    username?: string | null;
  } | null;
};

// Component to fetch and display heir name
function HeirName({ userId }: { userId: string }) {
  const [username, setUsername] = useState<string>("Loading...");
  const supabase = useMemo(() => createSupabaseBrowserClient(), []);

  useEffect(() => {
    const fetchUsername = async () => {
      const { data } = await supabase
        .from("users")
        .select("username")
        .eq("id", userId)
        .maybeSingle();
      setUsername(data?.username || "Unknown");
    };
    fetchUsername();
  }, [userId, supabase]);

  return (
    <p className="text-lg font-bold text-foreground mt-1">
      {username}
    </p>
  );
}

export function LawProposalDrawer({
  isOpen,
  onOpenChange,
  communityId,
  governanceType,
  userRank,
  lawType,
  proposalId,
  onProposalCreated,
  communityColor,
}: LawProposalDrawerProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [proposalData, setProposalData] = useState<ProposalData | null>(null);
  const [hasVoted, setHasVoted] = useState(false);
  const [isProposalLoading, setIsProposalLoading] = useState(false);
  const [selectedProposalId, setSelectedProposalId] = useState<string | null>(null);

  // For DECLARE_WAR
  const [warTargetSearch, setWarTargetSearch] = useState("");
  const [warTargets, setWarTargets] = useState<Array<{ id: string; name: string }>>([]);
  const [selectedWarTarget, setSelectedWarTarget] = useState<{ id: string; name: string } | null>(null);
  const [warTargetsLoading, setWarTargetsLoading] = useState(false);

  // For PROPOSE_HEIR
  const [heirSearch, setHeirSearch] = useState("");
  const [heirCandidates, setHeirCandidates] = useState<Array<{ id: string; username: string }>>([]);
  const [selectedHeir, setSelectedHeir] = useState<{ id: string; username: string } | null>(null);
  const [heirLoading, setHeirLoading] = useState(false);

  // For CHANGE_GOVERNANCE
  const [selectedGovernanceType, setSelectedGovernanceType] = useState<string>("democracy");

  // For MESSAGE_OF_THE_DAY
  const [motdTitle, setMotdTitle] = useState("");
  const [motdContent, setMotdContent] = useState("");
  const [showSuccessModal, setShowSuccessModal] = useState(false);

  // For WORK_TAX
  const [workTaxRate, setWorkTaxRate] = useState<number>(0); // Default 0% - king must set it
  const [successProposalId, setSuccessProposalId] = useState<string | null>(null);
  const [currentVote, setCurrentVote] = useState<"yes" | "no" | null>(null);
  const [voteInProgress, setVoteInProgress] = useState<"yes" | "no" | null>(null);

  // For IMPORT_TARIFF
  const [importTariffRate, setImportTariffRate] = useState<number>(0); // Default 0% - king must set it

  // For ISSUE_CURRENCY
  const [goldAmount, setGoldAmount] = useState<number>(0);
  const [conversionRate, setConversionRate] = useState<number>(1); // Default 1:1

  // For CFC_ALLIANCE
  const [allianceTargetSearch, setAllianceTargetSearch] = useState("");
  const [allianceTargets, setAllianceTargets] = useState<Array<{ id: string; name: string }>>([]);
  const [selectedAllianceTarget, setSelectedAllianceTarget] = useState<{ id: string; name: string } | null>(null);
  const [allianceTargetsLoading, setAllianceTargetsLoading] = useState(false);

  const supabase = useMemo(() => createSupabaseBrowserClient(), []);

  const currentLawType = ((selectedProposalId || proposalId) ? proposalData?.law_type : lawType) as LawType;
  const definition = currentLawType ? LAW_REGISTRY[currentLawType] : null;
  const rules = currentLawType && definition ? getGovernanceRules(currentLawType, governanceType) : null;

  // Load proposal data if viewing existing
  const loadProposal = useCallback(async (forceReload = false) => {
    const idToLoad = selectedProposalId || proposalId;
    if (!idToLoad) return;

    // Don't reload if we already have data for this proposal and not forcing reload
    if (!forceReload && proposalData && proposalData.id === idToLoad) {
      console.log("[LawProposalDrawer] Skipping reload - data already loaded for:", idToLoad);
      return;
    }

    console.log("[LawProposalDrawer] Loading proposal:", idToLoad);

    setIsProposalLoading(true);
    setError(null);

    try {
      const { data, error: fetchError } = await supabase
        .from("community_proposals")
        .select(
          `*,
          proposal_votes(vote, user_id)`
        )
        .eq("id", idToLoad)
        .single();

      if (fetchError) throw fetchError;

      // Fetch proposer name
      let proposer_name = "Unknown";
      if (data.proposer_id) {
        const { data: proposerData } = await supabase
          .from("users")
          .select("username")
          .eq("id", data.proposer_id)
          .maybeSingle();
        if (proposerData?.username) {
          proposer_name = proposerData.username;
        }
      }

      // Fetch target community name for DECLARE_WAR and CFC_ALLIANCE
      const baseMetadata = (data.metadata ?? {}) as Record<string, unknown>;
      const enrichedMetadata: Record<string, unknown> = { ...baseMetadata };
      if (
        (data.law_type === "DECLARE_WAR" || data.law_type === "CFC_ALLIANCE") &&
        typeof baseMetadata.target_community_id === "string"
      ) {
        const { data: targetComm } = await supabase
          .from("communities")
          .select("name")
          .eq("id", baseMetadata.target_community_id)
          .maybeSingle();
        if (targetComm) {
          enrichedMetadata.target_community_name = targetComm.name;
        }
      }

      // Get current user's profile ID (not auth ID) for vote checking
      const { data: authData } = await supabase.auth.getUser();
      const authId = authData.user?.id;

      let profileId: string | null = null;
      if (authId) {
        const { data: profileData } = await supabase
          .from("users")
          .select("id")
          .eq("auth_id", authId)
          .maybeSingle();
        profileId = profileData?.id || null;
      }

      const voteRows = (data.proposal_votes ?? []) as ProposalVoteRow[];
      const yesVotes = voteRows.filter((v) => v.vote === "yes").length;
      const noVotes = voteRows.filter((v) => v.vote === "no").length;
      const userVoteRow = voteRows.find((v) => v.user_id === profileId);
      const userVote =
        userVoteRow?.vote === "yes"
          ? "yes"
          : userVoteRow?.vote === "no"
            ? "no"
            : null;

      let userMap: Record<string, string> = {};
      let communityMap: Record<string, string> = {};
      const uniqueUserIds = Array.from(
        new Set(voteRows.map((row) => row.user_id).filter(Boolean))
      ) as string[];
      if (uniqueUserIds.length > 0) {
        const { data: userRecords, error: userError } = await supabase
          .from("users")
          .select("id, username")
          .in("id", uniqueUserIds);
        if (userError) {
          console.error("Failed to load voter usernames:", userError);
        } else if (userRecords) {
          userMap = userRecords.reduce((acc: Record<string, string>, user: any) => {
            if (user.id) {
              acc[user.id] = user.username ?? user.id;
            }
            return acc;
          }, {} as Record<string, string>);
        }

        // For CFC alliances, determine which community each voter belongs to
        if (data.law_type === "CFC_ALLIANCE" && baseMetadata.target_community_id) {
          const initiatorCommunityId = data.community_id;
          const targetCommunityId = baseMetadata.target_community_id;

          // Check initiator community memberships
          const { data: initiatorMembers } = await supabase
            .from("community_members")
            .select("user_id")
            .eq("community_id", initiatorCommunityId)
            .in("user_id", uniqueUserIds);

          if (initiatorMembers) {
            initiatorMembers.forEach((m: any) => {
              if (m.user_id) communityMap[m.user_id] = initiatorCommunityId;
            });
          }

          // Check target community memberships
          const { data: targetMembers } = await supabase
            .from("community_members")
            .select("user_id")
            .eq("community_id", targetCommunityId)
            .in("user_id", uniqueUserIds);

          if (targetMembers) {
            targetMembers.forEach((m: any) => {
              if (m.user_id) communityMap[m.user_id] = targetCommunityId;
            });
          }
        }
      }

      const voteRowsWithUsers = voteRows.map((row) => ({
        ...row,
        community_id: row.user_id ? communityMap[row.user_id] : undefined,
        user:
          row.user ??
          (row.user_id && userMap[row.user_id]
            ? { username: userMap[row.user_id] }
            : undefined),
      }));

      setProposalData({
        ...data,
        metadata: enrichedMetadata,
        yesVotes,
        noVotes,
        proposer_name,
        voteRows: voteRowsWithUsers,
      });
      setHasVoted(!!userVoteRow);
      setCurrentVote(userVote);
    } catch (err) {
      console.error("Failed to load proposal:", err);
      setError(err instanceof Error ? err.message : "Failed to load proposal");
    } finally {
      setIsProposalLoading(false);
    }
  }, [proposalId, selectedProposalId, supabase]);

  // Search for war targets
  const handleWarTargetSearch = async (value: string) => {
    setWarTargetSearch(value);
    if (value.length < 2) {
      setWarTargets([]);
      return;
    }

    setWarTargetsLoading(true);
    const { data } = await supabase
      .from("communities")
      .select("id, name")
      .ilike("name", `%${value}%`)
      .neq("id", communityId)
      .limit(10);

    setWarTargets(data || []);
    setWarTargetsLoading(false);
  };

  // Search for heir candidates
  const handleHeirSearch = async (value: string) => {
    setHeirSearch(value);
    if (value.length < 2) {
      setHeirCandidates([]);
      return;
    }

    setHeirLoading(true);
    const { data } = await supabase
      .from("community_members")
      .select("user_id, user:users(id, username)")
      .eq("community_id", communityId)
      .ilike("user.username", `%${value}%`)
      .limit(10);

    const candidateRows = (data || []) as HeirCandidateRow[];
    const candidates = candidateRows.map((m) => ({
      id: m.user_id,
      username: m.user?.username || "Unknown",
    }));
    setHeirCandidates(candidates);
    setHeirLoading(false);
  };

  // Search for alliance targets
  const handleAllianceTargetSearch = async (value: string) => {
    setAllianceTargetSearch(value);
    if (value.length < 2) {
      setAllianceTargets([]);
      return;
    }

    setAllianceTargetsLoading(true);
    const { data } = await supabase
      .from("communities")
      .select("id, name")
      .ilike("name", `%${value}%`)
      .neq("id", communityId)
      .limit(10);

    setAllianceTargets(data || []);
    setAllianceTargetsLoading(false);
  };

  const handleProposeLaw = async () => {
    if (!lawType) return;

    let metadata: Record<string, unknown> = {};

    if (lawType === "DECLARE_WAR") {
      if (!selectedWarTarget) {
        setError("Please select a target community");
        return;
      }
      metadata = {
        target_community_id: selectedWarTarget.id,
      };
    } else if (lawType === "PROPOSE_HEIR") {
      if (!selectedHeir) {
        setError("Please select an heir");
        return;
      }
      metadata = {
        target_user_id: selectedHeir.id,
      };
    } else if (lawType === "CHANGE_GOVERNANCE") {
      if (!selectedGovernanceType) {
        setError("Please select a governance type");
        return;
      }
      metadata = {
        new_governance_type: selectedGovernanceType,
      };
    } else if (lawType === "MESSAGE_OF_THE_DAY") {
      if (!motdTitle || !motdContent) {
        setError("Please enter both title and message");
        return;
      }
      metadata = {
        title: motdTitle,
        content: motdContent,
      };
    } else if (lawType === "WORK_TAX") {
      if (workTaxRate < 0 || workTaxRate > 100) {
        setError("Tax rate must be between 0% and 100%");
        return;
      }
      metadata = {
        tax_rate: workTaxRate / 100, // Convert percentage to decimal
      };
    } else if (lawType === "IMPORT_TARIFF") {
      if (importTariffRate < 0 || importTariffRate > 100) {
        setError("Tariff rate must be between 0% and 100%");
        return;
      }
      metadata = {
        tariff_rate: importTariffRate / 100, // Convert percentage to decimal
      };
    } else if (lawType === "ISSUE_CURRENCY") {
      if (goldAmount <= 0 || goldAmount > 1000000) {
        setError("Gold amount must be between 1 and 1,000,000");
        return;
      }
      if (conversionRate <= 0) {
        setError("Conversion rate must be greater than 0");
        return;
      }
      metadata = {
        gold_amount: goldAmount,
        conversion_rate: conversionRate,
      };
    } else if (lawType === "CFC_ALLIANCE") {
      if (!selectedAllianceTarget) {
        setError("Please select a community to ally with");
        return;
      }
      metadata = {
        target_community_id: selectedAllianceTarget.id,
      };
    }

    setIsLoading(true);
    setError(null);

    try {
      const result = await proposeLawAction(communityId, lawType, metadata);
      const newProposalId = result.id;
      setSuccessProposalId(newProposalId);
      setShowSuccessModal(true);
      onProposalCreated?.();
      // Don't close drawer yet - let user see success modal
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : "Failed to propose law";
      setError(errorMsg);
      showGovernanceToast(errorMsg, "error");
    } finally {
      setIsLoading(false);
    }
  };

  const handleReviewProposal = useCallback(async () => {
    if (!successProposalId) return;

    // Close the success modal and entire modal
    setShowSuccessModal(false);
    onOpenChange(false);

    // Wait for modal to close smoothly
    await new Promise(resolve => setTimeout(resolve, 350));

    // Notify parent to reopen with the created proposal
    onProposalCreated?.(successProposalId);
  }, [successProposalId, onOpenChange, onProposalCreated]);

  const handleVote = async (vote: "yes" | "no") => {
    const idToVoteOn = selectedProposalId || proposalId;
    if (!idToVoteOn) return;

    setVoteInProgress(vote);
    setError(null);

    try {
      await voteOnProposalAction(idToVoteOn, vote);
      setHasVoted(true);
      setCurrentVote(vote);
      setVoteInProgress(null); // Clear loading state immediately after vote
      await loadProposal(true); // Force reload after voting to get updated vote counts
      showGovernanceToast(`Vote Recorded: ${vote.toUpperCase()}`, "success");
      onProposalCreated?.();
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : "Failed to vote";
      setError(errorMsg);
      showGovernanceToast(errorMsg, "error");
      setVoteInProgress(null);
    }
  };

  const resetState = () => {
    setError(null);
    setWarTargetSearch("");
    setWarTargets([]);
    setSelectedWarTarget(null);
    setHeirSearch("");
    setHeirCandidates([]);
    setSelectedHeir(null);
    setSelectedGovernanceType("democracy");
    setProposalData(null);
    setHasVoted(false);
    setMotdTitle("");
    setMotdContent("");
    setShowSuccessModal(false);
    setSuccessProposalId(null);
    setCurrentVote(null);
    setVoteInProgress(null);
    setWorkTaxRate(0);
    setImportTariffRate(0);
    setAllianceTargetSearch("");
    setAllianceTargets([]);
    setSelectedAllianceTarget(null);
    setSelectedProposalId(null);
  };

  useEffect(() => {
    if (isOpen && (proposalId || selectedProposalId)) {
      loadProposal();
    }
  }, [isOpen, proposalId, selectedProposalId, loadProposal]);

  const handleOpenChange = (open: boolean) => {
    if (!open) resetState();
    onOpenChange(open);
  };

  // Determine if user can vote
  const voteAccessAllowed = useMemo(() => {
    if (!currentLawType) return false;
    return canVoteOnLaw(currentLawType, governanceType, userRank);
  }, [currentLawType, governanceType, userRank]);


  const totalVotes = proposalData ? proposalData.yesVotes + proposalData.noVotes : 0;
  const votePercentage = totalVotes > 0 ? (proposalData!.yesVotes / totalVotes) * 100 : 0;
  const voteRows = proposalData?.voteRows ?? [];
  const yesVoters = voteRows.filter((row) => row.vote === "yes");
  const noVoters = voteRows.filter((row) => row.vote === "no");
  const getVoterLabel = (row: ProposalVoteRow) =>
    row.user?.username ?? row.user_id ?? "Unknown Member";

  // Get color scheme for this law type
  const colors = currentLawType ? getLawColorScheme(currentLawType) : null;
  const communityAccentColor = formatCommunityColor(communityColor);
  const announcementPreviewBorderColor =
    hexToRgba(communityAccentColor, 0.45) ?? communityAccentColor;
  const announcementPreviewBackgroundColor =
    hexToRgba(communityAccentColor, 0.12) ?? "transparent";
  const announcementPreviewAccentColor =
    hexToRgba(communityAccentColor, 0.9) ?? communityAccentColor;
  const announcementPreviewGradient = `linear-gradient(135deg, ${
    hexToRgba(communityAccentColor, 0.24) ?? communityAccentColor
  } 0%, rgba(255, 255, 255, 0) 100%)`;
  const announcementPreviewStyle = {
    borderColor: announcementPreviewBorderColor,
    backgroundColor: announcementPreviewBackgroundColor,
    backgroundImage: announcementPreviewGradient,
  };
  const isViewingExistingProposal = Boolean(selectedProposalId || proposalId);
  const showProposalSkeleton = isViewingExistingProposal && isProposalLoading && !proposalData;

  return (
    <Dialog open={isOpen} onOpenChange={handleOpenChange}>
      <DialogContent
        animation="fade"
        className="w-full max-w-none sm:max-w-4xl max-h-[90vh] p-0 gap-0 rounded-2xl border-border/60 bg-background/95 backdrop-blur-xl overflow-hidden flex flex-col"
      >
        {/* Header - Fixed */}
        <div className="px-5 py-5 border-b border-border/60 flex items-start justify-between flex-shrink-0">
          <div className="flex-1 pr-4">
            <p className="text-[9px] font-bold uppercase tracking-wider text-muted-foreground mb-1">
              {isViewingExistingProposal ? "Proposal" : "Propose Law"}
            </p>
            <DialogTitle className="text-lg font-bold">
              {definition?.label}
            </DialogTitle>
            <DialogDescription className="text-xs mt-1.5 leading-relaxed">
              {definition?.description}
            </DialogDescription>
          </div>
        </div>

        {/* Content - Scrollable */}
        <div className="flex-1 overflow-y-auto">
          <div className="px-5 py-4 space-y-4">
            {showProposalSkeleton ? (
              <div className="space-y-6 animate-pulse">
                <div className="grid sm:grid-cols-2 gap-4">
                  {Array.from({ length: 2 }).map((_, idx) => (
                    <div
                      key={`law-skeleton-${idx}`}
                      className="space-y-3 bg-muted/20 p-4 rounded-lg border border-border/30"
                    >
                      <div className="h-3 w-1/3 rounded bg-muted-foreground/20" />
                      <div className="h-2 w-1/2 rounded bg-muted-foreground/10" />
                      <div className="h-3 w-2/3 rounded bg-muted-foreground/15" />
                    </div>
                  ))}
                </div>
                <div className="space-y-3 bg-muted/20 p-4 rounded-lg border border-border/40">
                  <div className="h-3 w-1/3 rounded bg-muted-foreground/20" />
                  <div className="h-2 w-1/2 rounded bg-muted-foreground/10" />
                  <div className="h-3 w-1/4 rounded bg-muted-foreground/10" />
                </div>
                <div className="space-y-4 border border-border/40 rounded-lg p-4 bg-muted/20">
                  <div className="h-3 w-1/2 rounded bg-muted-foreground/20" />
                  <div className="h-2 w-1/3 rounded bg-muted-foreground/10" />
                  <div className="h-3 w-3/4 rounded bg-muted-foreground/15" />
                </div>
                <div className="space-y-4 border border-border/40 rounded-lg p-4 bg-muted/20">
                  <div className="h-3 w-3/4 rounded bg-muted-foreground/20" />
                  <div className="h-2 w-1/3 rounded bg-muted-foreground/10" />
                  <div className="h-10 rounded bg-muted-foreground/15" />
                </div>
              </div>
            ) : (
              <>
            {/* Law Details Grid */}
            <div className="grid sm:grid-cols-2 gap-4">
              {/* Voting Rules */}
              <div className="space-y-3 bg-muted/20 p-4 rounded-lg border border-border/40">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    Voting Period
                  </p>
                  <p className="text-lg font-semibold text-foreground mt-2">
                    {rules?.timeToPass === "0h" ? "Instant" : rules?.timeToPass}
                  </p>
                </div>

                <div className="border-t border-border/30 pt-3">
                  <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    Passes When
                  </p>
                  <p className="text-sm font-semibold text-foreground mt-2 capitalize">
                    {rules?.passingCondition === "sovereign_only"
                      ? "Sovereign Decrees"
                      : rules?.passingCondition === "majority_vote"
                      ? "Majority Votes Yes"
                      : rules?.passingCondition === "supermajority_vote"
                      ? "2/3 Vote Yes"
                      : "Unanimous Consent"}
                  </p>
                </div>

                {rules?.canFastTrack && (
                  <div className="border-t border-border/30 pt-3 bg-amber-500/5 -mx-4 -mb-4 px-4 py-3 rounded-b">
                    <p className="text-xs font-semibold uppercase tracking-wider text-amber-600 dark:text-amber-400">
                      ⚡ Sovereign Override
                    </p>
                    <p className="text-xs text-amber-600 dark:text-amber-400 mt-1.5">
                      Can be fast-tracked by the Sovereign
                    </p>
                  </div>
                )}
              </div>

              {/* Voting Access & Rules */}
              <div className="space-y-3 bg-muted/20 p-4 rounded-lg border border-border/40">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    Who Votes
                  </p>
                  <p className="text-sm font-semibold text-foreground mt-2 capitalize">
                    {rules?.voteAccessType === "sovereign_only"
                      ? "Sovereign Only"
                      : rules?.voteAccessType === "council_only"
                      ? "King & Council"
                      : "All Members"}
                  </p>
                </div>

                <div className="border-t border-border/30 pt-3">
                  <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    How It Works
                  </p>
                  <p className="text-xs text-muted-foreground mt-2 leading-relaxed">
                    {rules?.description}
                  </p>
                </div>
              </div>
            </div>

            {proposalData && (
              <div className="space-y-4 bg-muted/20 p-4 rounded-lg border border-border/40">
                <div className="flex items-center justify-between gap-2">
                  <div className="space-y-1">
                    <p className="text-xs font-semibold uppercase text-muted-foreground">Status</p>
                    <span className={cn(
                      "inline-block text-xs font-semibold uppercase px-3 py-1 rounded-full",
                      proposalData.status === "pending"
                        ? "bg-amber-500/20 text-amber-600 dark:text-amber-400"
                        : proposalData.status === "passed"
                        ? "bg-green-500/20 text-green-600 dark:text-green-400"
                        : "bg-red-500/20 text-red-600 dark:text-red-400"
                    )}>
                      {proposalData.status}
                    </span>
                  </div>
                  {proposalData.status === "pending" && (
                    <div className="flex items-center gap-2 text-sm font-semibold text-amber-600 dark:text-amber-400">
                      <Clock className="h-4 w-4" />
                      {Math.ceil(
                        (new Date(proposalData.expires_at).getTime() - Date.now()) / 3600000
                      )}h left
                    </div>
                  )}
                </div>

                {(proposalData?.proposer_name || (typeof proposalData?.metadata?.proposer_username === 'string' && proposalData?.metadata?.proposer_username)) ? (
                  <div className="border-t border-border/30 pt-3">
                    <p className="text-xs font-semibold uppercase text-muted-foreground">Proposed By</p>
                    <p className="text-sm font-medium text-foreground mt-1">
                      {(typeof proposalData.metadata?.proposer_username === 'string' ? proposalData.metadata.proposer_username : null) || proposalData.proposer_name}
                    </p>
                  </div>
                ) : null}

                {proposalData?.law_type === "DECLARE_WAR" && proposalData?.metadata?.target_community_name ? (
                  <div className="border-t border-border/30 pt-3">
                    <p className="text-xs font-semibold uppercase text-muted-foreground">Target</p>
                    <p className="text-sm font-medium text-foreground mt-1">{String(proposalData.metadata?.target_community_name)}</p>
                  </div>
                ) : null}

                {proposalData?.law_type === "CFC_ALLIANCE" && proposalData?.metadata?.target_community_name ? (
                  <div className="border-t border-border/30 pt-3">
                    <p className="text-xs font-semibold uppercase text-muted-foreground">
                      Alliance With
                    </p>
                    <p className="text-sm font-medium text-foreground mt-1">{String(proposalData.metadata?.target_community_name)}</p>
                    <p className="text-xs text-muted-foreground mt-1.5">
                      {proposalData.metadata?.is_response_to_proposal
                        ? "Counter-proposal - both communities must approve"
                        : "Awaiting approval from target community"}
                    </p>
                  </div>
                ) : null}

                {proposalData?.law_type === "WORK_TAX" && proposalData?.metadata?.tax_rate !== undefined ? (
                  <div className="border-t border-border/30 pt-3">
                    <p className="text-xs font-semibold uppercase text-muted-foreground">Proposed Tax Rate</p>
                    <p className="text-lg font-bold text-foreground mt-1">
                      {((proposalData.metadata.tax_rate as number) * 100).toFixed(0)}%
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">
                      Example: 100 coin salary → {100 - ((proposalData.metadata.tax_rate as number) * 100)} coins to worker, {((proposalData.metadata.tax_rate as number) * 100)} coins to treasury
                    </p>
                  </div>
                ) : null}

                {proposalData?.law_type === "IMPORT_TARIFF" && proposalData?.metadata?.tariff_rate !== undefined ? (
                  <div className="border-t border-border/30 pt-3">
                    <p className="text-xs font-semibold uppercase text-muted-foreground">Proposed Tariff Rate</p>
                    <p className="text-lg font-bold text-foreground mt-1">
                      {((proposalData.metadata.tariff_rate as number) * 100).toFixed(0)}%
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">
                      Applied to imports from other communities. Example: 100 gold item → seller receives {(100 - (100 * (proposalData.metadata.tariff_rate as number))).toFixed(0)} gold, treasury gets {(100 * (proposalData.metadata.tariff_rate as number)).toFixed(0)} gold
                    </p>
                  </div>
                ) : null}

                {proposalData?.law_type === "ISSUE_CURRENCY" && proposalData?.metadata?.gold_amount !== undefined && proposalData?.metadata?.conversion_rate !== undefined ? (
                  <div className="border-t border-border/30 pt-3 space-y-3">
                    <div>
                      <p className="text-xs font-semibold uppercase text-muted-foreground">Gold to Burn</p>
                      <p className="text-lg font-bold text-foreground mt-1">
                        {(proposalData.metadata.gold_amount as number).toLocaleString()} gold
                      </p>
                    </div>
                    <div>
                      <p className="text-xs font-semibold uppercase text-muted-foreground">Conversion Rate</p>
                      <p className="text-lg font-bold text-foreground mt-1">
                        1 gold = {(proposalData.metadata.conversion_rate as number).toLocaleString()} currency
                      </p>
                    </div>
                    <div>
                      <p className="text-xs font-semibold uppercase text-muted-foreground">Currency to Mint</p>
                      <p className="text-lg font-bold text-foreground mt-1">
                        {((proposalData.metadata.gold_amount as number) * (proposalData.metadata.conversion_rate as number)).toLocaleString()} currency
                      </p>
                    </div>
                    <p className="text-xs text-muted-foreground mt-2 p-2 bg-amber-500/10 border border-amber-500/20 rounded">
                      ⚠️ Gold will be permanently burned and currency will be minted to treasury
                    </p>
                  </div>
                ) : null}

                {proposalData?.law_type === "MESSAGE_OF_THE_DAY" && proposalData?.metadata?.title && proposalData?.metadata?.content ? (
                  <div className="border-t border-border/30 pt-3">
                    <p className="text-xs font-semibold uppercase text-muted-foreground">Announcement</p>
                    <div
                      className="mt-2 p-3 rounded-lg border"
                      style={{
                        borderColor: announcementPreviewBorderColor,
                        backgroundColor: announcementPreviewBackgroundColor,
                        backgroundImage: announcementPreviewGradient,
                      }}
                    >
                      <div className="flex items-start gap-3">
                        <Podcast
                          className="h-5 w-5 flex-shrink-0 mt-0.5"
                          style={{ color: announcementPreviewAccentColor }}
                        />
                        <div className="space-y-1 min-w-0">
                          <p
                            className="font-semibold text-sm"
                            style={{ color: announcementPreviewAccentColor }}
                          >
                            {String(proposalData.metadata.title)}
                          </p>
                          <p className="text-xs text-muted-foreground leading-relaxed">
                            {String(proposalData.metadata.content)}
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>
                ) : null}

                {proposalData?.law_type === "PROPOSE_HEIR" && proposalData?.metadata?.target_user_id ? (
                  <div className="border-t border-border/30 pt-3">
                    <p className="text-xs font-semibold uppercase text-muted-foreground">Proposed Heir</p>
                    <HeirName userId={String(proposalData.metadata.target_user_id)} />
                  </div>
                ) : null}

                {proposalData?.law_type === "CHANGE_GOVERNANCE" && proposalData?.metadata?.new_governance_type ? (
                  <div className="border-t border-border/30 pt-3">
                    <p className="text-xs font-semibold uppercase text-muted-foreground">New Governance Type</p>
                    <p className="text-lg font-bold text-foreground mt-1 capitalize">
                      {String(proposalData.metadata.new_governance_type)}
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">
                      {proposalData.metadata.new_governance_type === "monarchy"
                        ? "One sovereign rules, advisors vote on laws"
                        : "All members vote on major decisions"}
                    </p>
                  </div>
                ) : null}

                {proposalData.status === "pending" && proposalData.law_type !== "CFC_ALLIANCE" && (
                  <div className="space-y-2 border-t border-border/30 pt-3">
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Votes</span>
                      <span className="font-semibold">
                        {proposalData.yesVotes} yes, {proposalData.noVotes} no
                      </span>
                    </div>
                    <div className="h-3 bg-border/40 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-emerald-500 transition-all"
                        style={{ width: `${votePercentage}%` }}
                      />
                    </div>
                  </div>
                )}

                {/* Dual table for CFC Alliance votes */}
                {proposalData.law_type === "CFC_ALLIANCE" && proposalData.metadata?.target_community_id && (
                  <div className="space-y-3 border-t border-border/30 pt-4">
                    <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                      Mutual Approval Required - Both Communities Must Vote Yes
                    </p>
                    <div className="grid sm:grid-cols-2 gap-4">
                      {/* Initiator Community Votes */}
                      <div className="space-y-2 p-3 rounded-lg border border-border/40 bg-muted/20">
                        <p className="text-xs font-semibold uppercase text-muted-foreground">
                          {proposalData.metadata.target_community_name ? `Initiator Community` : "Your Community"}
                        </p>
                        {(() => {
                          const initiatorVotes = voteRows.filter(row => row.community_id === proposalData.community_id);
                          const initiatorYes = initiatorVotes.filter(row => row.vote === "yes");
                          const initiatorNo = initiatorVotes.filter(row => row.vote === "no");
                          return (
                            <>
                              <div className="space-y-1">
                                <p className="text-[10px] font-semibold uppercase text-emerald-600 dark:text-emerald-400">
                                  Yes ({initiatorYes.length})
                                </p>
                                {initiatorYes.length > 0 ? (
                                  initiatorYes.map((row, idx) => (
                                    <div key={`init-yes-${row.user_id ?? idx}`} className="flex items-center gap-1.5 text-xs">
                                      <CheckCircle2 className="h-3 w-3 text-emerald-500 flex-shrink-0" />
                                      <span className="truncate">{getVoterLabel(row)}</span>
                                    </div>
                                  ))
                                ) : (
                                  <p className="text-[10px] text-muted-foreground">None</p>
                                )}
                              </div>
                              <div className="space-y-1">
                                <p className="text-[10px] font-semibold uppercase text-destructive">
                                  No ({initiatorNo.length})
                                </p>
                                {initiatorNo.length > 0 ? (
                                  initiatorNo.map((row, idx) => (
                                    <div key={`init-no-${row.user_id ?? idx}`} className="flex items-center gap-1.5 text-xs">
                                      <XCircle className="h-3 w-3 text-destructive flex-shrink-0" />
                                      <span className="truncate">{getVoterLabel(row)}</span>
                                    </div>
                                  ))
                                ) : (
                                  <p className="text-[10px] text-muted-foreground">None</p>
                                )}
                              </div>
                            </>
                          );
                        })()}
                      </div>

                      {/* Target Community Votes */}
                      <div className="space-y-2 p-3 rounded-lg border border-border/40 bg-muted/20">
                        <p className="text-xs font-semibold uppercase text-muted-foreground">
                          {proposalData.metadata.target_community_name || "Target Community"}
                        </p>
                        {(() => {
                          const targetVotes = voteRows.filter(row => row.community_id === proposalData.metadata.target_community_id);
                          const targetYes = targetVotes.filter(row => row.vote === "yes");
                          const targetNo = targetVotes.filter(row => row.vote === "no");
                          return (
                            <>
                              <div className="space-y-1">
                                <p className="text-[10px] font-semibold uppercase text-emerald-600 dark:text-emerald-400">
                                  Yes ({targetYes.length})
                                </p>
                                {targetYes.length > 0 ? (
                                  targetYes.map((row, idx) => (
                                    <div key={`target-yes-${row.user_id ?? idx}`} className="flex items-center gap-1.5 text-xs">
                                      <CheckCircle2 className="h-3 w-3 text-emerald-500 flex-shrink-0" />
                                      <span className="truncate">{getVoterLabel(row)}</span>
                                    </div>
                                  ))
                                ) : (
                                  <p className="text-[10px] text-muted-foreground">None</p>
                                )}
                              </div>
                              <div className="space-y-1">
                                <p className="text-[10px] font-semibold uppercase text-destructive">
                                  No ({targetNo.length})
                                </p>
                                {targetNo.length > 0 ? (
                                  targetNo.map((row, idx) => (
                                    <div key={`target-no-${row.user_id ?? idx}`} className="flex items-center gap-1.5 text-xs">
                                      <XCircle className="h-3 w-3 text-destructive flex-shrink-0" />
                                      <span className="truncate">{getVoterLabel(row)}</span>
                                    </div>
                                  ))
                                ) : (
                                  <p className="text-[10px] text-muted-foreground">None</p>
                                )}
                              </div>
                            </>
                          );
                        })()}
                      </div>
                    </div>
                  </div>
                )}

                {/* Regular vote display for non-CFC laws */}
                {proposalData.law_type !== "CFC_ALLIANCE" && (
                  <div className="grid sm:grid-cols-2 gap-4 border-t border-border/30 pt-4">
                  <div className="space-y-2">
                    <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                      Yes Voters
                    </p>
                    <div className="space-y-1 max-h-32 overflow-y-auto pr-1">
                      {yesVoters.length > 0 ? (
                        yesVoters.map((row, idx) => (
                          <div
                            key={`yes-${row.user_id ?? idx}`}
                            className="flex items-center gap-2 text-sm text-foreground"
                          >
                            <CheckCircle2 className="h-4 w-4 text-emerald-500 flex-shrink-0" />
                            <span className="truncate">{getVoterLabel(row)}</span>
                          </div>
                        ))
                      ) : (
                        <p className="text-xs text-muted-foreground">No yes votes yet.</p>
                      )}
                    </div>
                  </div>
                  <div className="space-y-2">
                    <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                      No Voters
                    </p>
                    <div className="space-y-1 max-h-32 overflow-y-auto pr-1">
                      {noVoters.length > 0 ? (
                        noVoters.map((row, idx) => (
                          <div
                            key={`no-${row.user_id ?? idx}`}
                            className="flex items-center gap-2 text-sm text-foreground"
                          >
                            <XCircle className="h-4 w-4 text-destructive flex-shrink-0" />
                            <span className="truncate">{getVoterLabel(row)}</span>
                          </div>
                        ))
                      ) : (
                        <p className="text-xs text-muted-foreground">No no votes yet.</p>
                      )}
                    </div>
                  </div>
                </div>
                )}

                {proposalData.status === "passed" && (
                  <div className="flex items-center gap-2 text-green-600 dark:text-green-400 border-t border-border/30 pt-3">
                    <CheckCircle2 className="h-4 w-4 flex-shrink-0" />
                    <p className="text-sm font-semibold">Proposal passed and executed</p>
                  </div>
                )}

                {proposalData.status === "rejected" && (
                  <div className="flex items-center gap-2 text-red-600 dark:text-red-400 border-t border-border/30 pt-3">
                    <XCircle className="h-4 w-4 flex-shrink-0" />
                    <p className="text-sm font-semibold">Proposal was rejected</p>
                  </div>
                )}
              </div>
            )}

            {/* Law-specific inputs (Propose mode) */}
            {!proposalId && !selectedProposalId && lawType === "DECLARE_WAR" && colors && (
              <div className={cn("space-y-3 p-4 rounded-lg border", colors.bgLight, colors.borderLight)}>
                <p className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
                  Target Community
                </p>
                <Input
                  placeholder="Search for a community..."
                  value={warTargetSearch}
                  onChange={(e) => handleWarTargetSearch(e.target.value)}
                  className="h-11 rounded-lg bg-muted/30"
                  disabled={isLoading}
                  autoFocus
                />

                {warTargetsLoading && (
                  <div className="text-sm text-muted-foreground text-center py-3">
                    Searching...
                  </div>
                )}

                {warTargets.length > 0 && (
                  <div className="space-y-2 max-h-48 overflow-y-auto">
                    {warTargets.map((target) => (
                      <button
                        key={target.id}
                        type="button"
                        onClick={() => {
                          setSelectedWarTarget(target);
                          setWarTargetSearch("");
                          setWarTargets([]);
                        }}
                        className={cn(
                          "w-full text-left p-3 rounded-lg border transition-all",
                          selectedWarTarget?.id === target.id
                            ? cn(colors.selectedBg, colors.selectedBorder)
                            : "border-border/40 hover:bg-accent/40"
                        )}
                      >
                        {target.name}
                      </button>
                    ))}
                  </div>
                )}

                {selectedWarTarget && (
                  <div className={cn("p-3 rounded-lg text-sm space-y-1 border", colors.bgMedium, colors.borderMedium, colors.textStrong)}>
                    <p className="font-semibold">⚔️ War with {selectedWarTarget.name}</p>
                    <p className="text-xs">Hostilities will commence in 1 hour</p>
                  </div>
                )}
              </div>
            )}

            {/* PROPOSE_HEIR - Select heir */}
            {!proposalId && !selectedProposalId && lawType === "PROPOSE_HEIR" && colors && (
              <div className={cn("space-y-3 p-4 rounded-lg border", colors.bgLight, colors.borderLight)}>
                <p className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
                  Select Heir
                </p>
                <Input
                  placeholder="Search for a community member..."
                  value={heirSearch}
                  onChange={(e) => handleHeirSearch(e.target.value)}
                  className="h-11 rounded-lg bg-muted/30"
                  disabled={isLoading}
                  autoFocus
                />

                {heirLoading && (
                  <div className="text-sm text-muted-foreground text-center py-3">
                    Searching...
                  </div>
                )}

                {heirCandidates.length > 0 && (
                  <div className="space-y-2 max-h-48 overflow-y-auto">
                    {heirCandidates.map((candidate) => (
                      <button
                        key={candidate.id}
                        type="button"
                        onClick={() => {
                          setSelectedHeir(candidate);
                          setHeirSearch("");
                          setHeirCandidates([]);
                        }}
                        className={cn(
                          "w-full text-left p-3 rounded-lg border transition-all",
                          selectedHeir?.id === candidate.id
                            ? cn(colors.selectedBg, colors.selectedBorder)
                            : "border-border/40 hover:bg-accent/40"
                        )}
                      >
                        {candidate.username}
                      </button>
                    ))}
                  </div>
                )}

                {selectedHeir && (
                  <div className={cn("p-3 rounded-lg text-sm space-y-1 border", colors.bgMedium, colors.borderMedium, colors.textStrong)}>
                    <p className="font-semibold">👑 Heir: {selectedHeir.username}</p>
                    <p className="text-xs">Will succeed to the throne upon succession</p>
                  </div>
                )}
              </div>
            )}

            {/* CHANGE_GOVERNANCE - Select governance type */}
            {!proposalId && !selectedProposalId && lawType === "CHANGE_GOVERNANCE" && colors && (
              <div className={cn("space-y-3 p-4 rounded-lg border", colors.bgLight, colors.borderLight)}>
                <p className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
                  New Governance Type
                </p>
                <div className="space-y-2">
                  {["monarchy", "democracy"].map((type) => (
                    <button
                      key={type}
                      type="button"
                      onClick={() => setSelectedGovernanceType(type)}
                      className={cn(
                        "w-full text-left p-3 rounded-lg border transition-all capitalize font-medium",
                        selectedGovernanceType === type
                          ? cn(colors.selectedBg, colors.selectedBorder, colors.selectedText)
                          : "border-border/40 hover:bg-accent/40"
                      )}
                    >
                      {type}
                    </button>
                  ))}
                </div>
                {selectedGovernanceType && (
                  <div className={cn("p-3 rounded-lg text-sm space-y-1 border", colors.bgMedium, colors.borderMedium, colors.textStrong)}>
                    <p className="font-semibold">
                      ⚙️ Governance: {selectedGovernanceType}
                    </p>
                    <p className="text-xs">
                      {selectedGovernanceType === "monarchy"
                        ? "One sovereign rules, advisors vote on laws"
                        : "All members vote on major decisions"}
                    </p>
                  </div>
                )}
              </div>
            )}

            {/* MESSAGE_OF_THE_DAY - Post announcement */}
            {!proposalId && !selectedProposalId && lawType === "MESSAGE_OF_THE_DAY" && colors && (
              <div className={cn("space-y-3 p-4 rounded-lg border", colors.bgLight, colors.borderLight)}>
                <p className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
                  Announcement Title
                </p>
                <Input
                  placeholder="Battle order, strategy update, or proclamation..."
                  value={motdTitle}
                  onChange={(e) => setMotdTitle(e.target.value)}
                  className="h-11 rounded-lg bg-muted/30"
                  disabled={isLoading}
                  maxLength={80}
                />
                <p className="text-xs text-muted-foreground text-right">{motdTitle.length}/80</p>

                <p className="text-sm font-semibold uppercase tracking-wider text-muted-foreground mt-4">
                  Message
                </p>
                <Textarea
                  placeholder="Broadcast your message to all members..."
                  value={motdContent}
                  onChange={(e) => setMotdContent(e.target.value)}
                  className="rounded-lg bg-muted/30 min-h-24"
                  disabled={isLoading}
                  maxLength={500}
                />
                <p className="text-xs text-muted-foreground text-right">{motdContent.length}/500</p>

                {motdTitle && motdContent && (
                  <div
                    className="p-3 rounded-lg border"
                    style={announcementPreviewStyle}
                  >
                    <div className="flex items-start gap-3">
                      <Podcast
                        className="h-5 w-5 flex-shrink-0 mt-0.5"
                        style={{ color: announcementPreviewAccentColor }}
                      />
                      <div className="space-y-1">
                        <p
                          className="font-semibold"
                          style={{ color: announcementPreviewAccentColor }}
                        >
                          {motdTitle}
                        </p>
                        <p className="text-xs text-muted-foreground line-clamp-2">
                          {motdContent}
                        </p>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* WORK_TAX - Set tax rate */}
            {!proposalId && !selectedProposalId && lawType === "WORK_TAX" && colors && (
              <div className={cn("space-y-4 p-4 rounded-lg border", colors.bgLight, colors.borderLight)}>
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
                      Work Tax Rate
                    </p>
                    <span className="text-2xl font-bold text-foreground">{workTaxRate}%</span>
                  </div>

                  {/* Number input field */}
                  <div className="space-y-2">
                    <Input
                      type="number"
                      min="0"
                      max="100"
                      step="1"
                      value={workTaxRate}
                      onChange={(e) => {
                        const val = Number(e.target.value);
                        if (val >= 0 && val <= 100) {
                          setWorkTaxRate(val);
                        }
                      }}
                      className="text-lg font-semibold text-center"
                      disabled={isLoading}
                      placeholder="Enter tax rate (0-100)"
                    />
                    <p className="text-xs text-muted-foreground text-center">
                      Enter a value between 0% and 100%
                    </p>
                  </div>

                  {/* Slider for quick adjustment */}
                  <div className="space-y-2">
                    <Input
                      type="range"
                      min="0"
                      max="100"
                      step="1"
                      value={workTaxRate}
                      onChange={(e) => setWorkTaxRate(Number(e.target.value))}
                      className="w-full"
                      disabled={isLoading}
                    />
                    <div className="flex justify-between text-xs text-muted-foreground">
                      <span>0%</span>
                      <span>50%</span>
                      <span>100%</span>
                    </div>
                  </div>
                </div>

                <div className={cn("p-3 rounded-lg text-sm space-y-2 border", colors.bgMedium, colors.borderMedium)}>
                  <p className="font-semibold flex items-center gap-2">
                    <Megaphone className="h-4 w-4" />
                    Tax Impact
                  </p>
                  <div className="space-y-1 text-xs text-muted-foreground">
                    <p>
                      • If salary is <span className="font-semibold text-foreground">100 coins</span>,
                      worker receives <span className="font-semibold text-foreground">{100 - workTaxRate} coins</span>
                    </p>
                    <p>
                      • Community treasury collects <span className="font-semibold text-foreground">{workTaxRate} coins</span>
                    </p>
                    <p className="mt-2 text-amber-600 dark:text-amber-400">
                      Tax is deducted immediately when workers click the work button
                    </p>
                  </div>
                </div>

                {proposalData?.metadata?.tax_rate !== undefined && (
                  <div className="text-xs text-muted-foreground">
                    Current tax rate: {((proposalData.metadata.tax_rate as number) * 100).toFixed(0)}%
                  </div>
                )}
              </div>
            )}

            {/* IMPORT_TARIFF - Set tariff rate */}
            {!proposalId && !selectedProposalId && lawType === "IMPORT_TARIFF" && colors && (
              <div className={cn("space-y-4 p-4 rounded-lg border", colors.bgLight, colors.borderLight)}>
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
                      Import Tariff Rate
                    </p>
                    <span className="text-2xl font-bold text-foreground">{importTariffRate}%</span>
                  </div>

                  {/* Number input field */}
                  <div className="space-y-2">
                    <Input
                      type="number"
                      min="0"
                      max="100"
                      step="1"
                      value={importTariffRate}
                      onChange={(e) => {
                        const val = Number(e.target.value);
                        if (val >= 0 && val <= 100) {
                          setImportTariffRate(val);
                        }
                      }}
                      className="text-lg font-semibold text-center"
                      disabled={isLoading}
                      placeholder="Enter tariff rate (0-100)"
                      autoFocus
                    />
                    <p className="text-xs text-muted-foreground text-center">
                      Enter a value between 0% and 100%
                    </p>
                  </div>

                  {/* Slider for quick adjustment */}
                  <div className="space-y-2">
                    <Input
                      type="range"
                      min="0"
                      max="100"
                      step="1"
                      value={importTariffRate}
                      onChange={(e) => setImportTariffRate(Number(e.target.value))}
                      className="w-full"
                      disabled={isLoading}
                    />
                    <div className="flex justify-between text-xs text-muted-foreground">
                      <span>0%</span>
                      <span>50%</span>
                      <span>100%</span>
                    </div>
                  </div>
                </div>

                <div className={cn("p-3 rounded-lg text-sm space-y-2 border", colors.bgMedium, colors.borderMedium)}>
                  <p className="font-semibold flex items-center gap-2">
                    <Megaphone className="h-4 w-4" />
                    Tariff Impact
                  </p>
                  <div className="space-y-1 text-xs text-muted-foreground">
                    <p>
                      • Only applies when merchants from <span className="font-semibold text-foreground">other communities</span> sell in your market
                    </p>
                    <p>
                      • If item costs <span className="font-semibold text-foreground">100 gold</span>,
                      seller receives <span className="font-semibold text-foreground">{(100 - (100 * importTariffRate / 100)).toFixed(0)} gold</span>
                    </p>
                    <p>
                      • Community treasury collects <span className="font-semibold text-foreground">{(100 * importTariffRate / 100).toFixed(0)} gold</span> in tariff
                    </p>
                    <p className="mt-2 text-amber-600 dark:text-amber-400">
                      Tariff revenue goes directly to community treasury
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* ISSUE_CURRENCY - Convert gold to community currency */}
            {!proposalId && !selectedProposalId && lawType === "ISSUE_CURRENCY" && colors && (
              <div className={cn("space-y-4 p-4 rounded-lg border", colors.bgLight, colors.borderLight)}>
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
                      <GoldCoinIcon className="h-4 w-4" />
                      Gold Amount to Convert
                    </p>
                    <span className="text-2xl font-bold text-foreground flex items-center gap-1">
                      {goldAmount.toLocaleString()}
                      <GoldCoinIcon className="h-5 w-5" />
                    </span>
                  </div>

                  {/* Number input field */}
                  <div className="space-y-2">
                    <Input
                      type="number"
                      min="1"
                      max="1000000"
                      step="1"
                      value={goldAmount}
                      onChange={(e) => {
                        const val = Number(e.target.value);
                        if (val >= 0 && val <= 1000000) {
                          setGoldAmount(val);
                        }
                      }}
                      className="text-lg font-semibold text-center"
                      disabled={isLoading}
                      placeholder="Enter gold amount (1-1,000,000)"
                      autoFocus
                    />
                    <p className="text-xs text-muted-foreground text-center">
                      Maximum: 1,000,000 gold
                    </p>
                  </div>
                </div>

                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
                      <CommunityCoinIcon className="h-4 w-4" />
                      Conversion Rate (1 Gold = X Currency)
                    </p>
                    <span className="text-2xl font-bold text-foreground">{conversionRate.toLocaleString()}</span>
                  </div>

                  {/* Conversion rate input */}
                  <div className="space-y-2">
                    <Input
                      type="number"
                      min="0.001"
                      step="0.1"
                      value={conversionRate}
                      onChange={(e) => {
                        const val = Number(e.target.value);
                        if (val > 0) {
                          setConversionRate(val);
                        }
                      }}
                      className="text-lg font-semibold text-center"
                      disabled={isLoading}
                      placeholder="Enter conversion rate"
                    />
                    <p className="text-xs text-muted-foreground text-center">
                      1 gold will equal how many community coins
                    </p>
                  </div>
                </div>

                <div className={cn("p-3 rounded-lg text-sm space-y-2 border", colors.bgMedium, colors.borderMedium)}>
                  <p className="font-semibold flex items-center gap-2">
                    <Megaphone className="h-4 w-4" />
                    Currency Issuance Preview
                  </p>
                  <div className="space-y-1 text-xs text-muted-foreground">
                    <p className="flex items-center gap-1">
                      • <span className="font-semibold text-foreground">{goldAmount.toLocaleString()} gold</span> <GoldCoinIcon className="h-3 w-3" /> will be burned from treasury
                    </p>
                    <p className="flex items-center gap-1">
                      • <span className="font-semibold text-foreground">{(goldAmount * conversionRate).toLocaleString()}</span> <CommunityCoinIcon className="h-3 w-3" /> community currency will be minted
                    </p>
                    <p>
                      • New currency goes to <span className="font-semibold text-foreground">community treasury</span>
                    </p>
                    <p className="mt-2 text-amber-600 dark:text-amber-400">
                      ⚠️ Gold is permanently burned and cannot be recovered
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* CFC_ALLIANCE - Select community to ally with */}
            {!proposalId && !selectedProposalId && lawType === "CFC_ALLIANCE" && colors && (
              <div className={cn("space-y-3 p-4 rounded-lg border", colors.bgLight, colors.borderLight)}>
                <p className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
                  Select Community to Ally With
                </p>
                <Input
                  placeholder="Search for a community..."
                  value={allianceTargetSearch}
                  onChange={(e) => handleAllianceTargetSearch(e.target.value)}
                  className="h-11 rounded-lg bg-muted/30"
                  disabled={isLoading}
                  autoFocus
                />

                {allianceTargetsLoading && (
                  <div className="text-sm text-muted-foreground text-center py-3">
                    Searching...
                  </div>
                )}

                {allianceTargets.length > 0 && (
                  <div className="space-y-2 max-h-48 overflow-y-auto">
                    {allianceTargets.map((target) => (
                      <button
                        key={target.id}
                        type="button"
                        onClick={() => {
                          setSelectedAllianceTarget(target);
                          setAllianceTargetSearch("");
                          setAllianceTargets([]);
                        }}
                        className={cn(
                          "w-full text-left p-3 rounded-lg border transition-all",
                          selectedAllianceTarget?.id === target.id
                            ? cn(colors.selectedBg, colors.selectedBorder)
                            : "border-border/40 hover:bg-accent/40"
                        )}
                      >
                        {target.name}
                      </button>
                    ))}
                  </div>
                )}

                {selectedAllianceTarget && (
                  <div className={cn("p-3 rounded-lg text-sm space-y-1 border", colors.bgMedium, colors.borderMedium, colors.textStrong)}>
                    <p className="font-semibold">🤝 Alliance with {selectedAllianceTarget.name}</p>
                    <p className="text-xs">Target community must also approve to activate</p>
                    <div className="mt-2 space-y-1 text-xs">
                      <p className="font-semibold">Benefits:</p>
                      <p>• Allies can fight in each other&apos;s battles from home</p>
                      <p>• No travel required for allied battles</p>
                      <p>• Maximum 5 active alliances per community</p>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Error */}
            {error && (
              <div className={cn("p-4 rounded-lg text-sm font-medium flex items-center gap-3 border", "bg-destructive/10 border-destructive/20 text-destructive dark:text-destructive/80")}>
                <AlertTriangle size={18} className="flex-shrink-0" />
                {error}
              </div>
            )}
              </>
            )}
          </div>
        </div>

        {/* Footer - Fixed at bottom */}
        <div className="px-5 py-4 border-t border-border/60 bg-muted/10 flex-shrink-0 backdrop-blur-sm">
          {!proposalId && !selectedProposalId ? (
            <div className="space-y-2">
              <Button
                onClick={handleProposeLaw}
                disabled={
                  isLoading ||
                  (lawType === "DECLARE_WAR" && !selectedWarTarget) ||
                  (lawType === "PROPOSE_HEIR" && !selectedHeir) ||
                  (lawType === "CHANGE_GOVERNANCE" && !selectedGovernanceType) ||
                  (lawType === "MESSAGE_OF_THE_DAY" && (!motdTitle || !motdContent)) ||
                  (lawType === "WORK_TAX" && (workTaxRate < 0 || workTaxRate > 100)) ||
                  (lawType === "IMPORT_TARIFF" && (importTariffRate < 0 || importTariffRate > 100)) ||
                  (lawType === "ISSUE_CURRENCY" && (goldAmount <= 0 || goldAmount > 1000000 || conversionRate <= 0)) ||
                  (lawType === "CFC_ALLIANCE" && !selectedAllianceTarget)
                }
                size="lg"
                className="w-full gap-2 font-bold transition-all duration-300"
              >
                {isLoading ? (
                  <>
                    <Loader2 className="size-4 animate-spin" />
                    <span className="text-sm">Submitting...</span>
                  </>
                ) : (
                  <>
                    <Hammer className="size-4" />
                    <span className="text-sm truncate flex-1">
                      {lawType === "MESSAGE_OF_THE_DAY" ? "Broadcast Announcement" : lawType === "WORK_TAX" ? "Set Tax Rate" : lawType === "IMPORT_TARIFF" ? "Set Import Tariff" : lawType === "ISSUE_CURRENCY" ? "Issue Currency" : lawType === "CFC_ALLIANCE" ? "Propose Alliance" : "Propose Law"}
                    </span>
                  </>
                )}
              </Button>
              <div className="flex items-center justify-center gap-1 text-xs text-muted-foreground py-1">
                <Gavel className="size-3 shrink-0" />
                <span>{lawType === "MESSAGE_OF_THE_DAY" ? "Instant announcement to all members" : "Submit proposal for community vote"}</span>
              </div>
            </div>
          ) : (
            <>
              {proposalData ? (
                proposalData.status === "pending" ? (
                  <>
                    <div className="flex gap-3 flex-wrap sm:flex-nowrap w-full">
                      <Button
                        onClick={() => handleVote("yes")}
                        disabled={!voteAccessAllowed || hasVoted || voteInProgress !== null}
                        size="lg"
                        className={cn(
                          "flex-1 gap-2 font-bold transition-all rounded-xl",
                          currentVote === "yes"
                            ? "bg-emerald-500/20 border-emerald-500/40 text-emerald-600 dark:text-emerald-400"
                            : "bg-emerald-500 hover:bg-emerald-600 text-white border-emerald-600",
                          (!voteAccessAllowed || hasVoted || voteInProgress !== null) && "opacity-50 cursor-not-allowed"
                        )}
                      >
                        {voteInProgress === "yes" ? (
                          <>
                            <Loader2 className="size-4 animate-spin" />
                            Voting...
                          </>
                        ) : currentVote === "yes" ? (
                          <>
                            <CheckCircle2 className="size-4" />
                            Voted Yes
                          </>
                        ) : (
                          <>
                            <CheckCircle2 className="size-4" />
                            Vote Yes
                          </>
                        )}
                      </Button>
                      <Button
                        onClick={() => handleVote("no")}
                        disabled={!voteAccessAllowed || hasVoted || voteInProgress !== null}
                        size="lg"
                        className={cn(
                          "flex-1 gap-2 font-bold transition-all rounded-xl",
                          currentVote === "no"
                            ? "bg-red-500/20 border-red-500/40 text-red-600 dark:text-red-400"
                            : "bg-red-500 hover:bg-red-600 text-white border-red-600",
                          (!voteAccessAllowed || hasVoted || voteInProgress !== null) && "opacity-50 cursor-not-allowed"
                        )}
                      >
                        {voteInProgress === "no" ? (
                          <>
                            <Loader2 className="size-4 animate-spin" />
                            Voting...
                          </>
                        ) : currentVote === "no" ? (
                          <>
                            <XCircle className="size-4" />
                            Voted No
                          </>
                        ) : (
                          <>
                            <XCircle className="size-4" />
                            Vote No
                          </>
                        )}
                      </Button>
                    </div>
                    {!voteAccessAllowed && (
                      <div className="text-sm text-muted-foreground italic w-full text-center py-2">
                        You don't have voting access for this law
                      </div>
                    )}
                  </>
                ) : (
                  <div className="w-full space-y-3">
                    <div
                      className={cn(
                        "text-sm font-semibold text-center py-3 px-4 rounded-lg border",
                        proposalData.status === "passed"
                          ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-700 dark:text-emerald-300"
                          : proposalData.status === "rejected"
                          ? "bg-red-500/10 border-red-500/30 text-red-700 dark:text-red-300"
                          : "bg-muted/30 border-muted text-muted-foreground"
                      )}
                    >
                      {proposalData.status === "passed" && (
                        <span className="flex items-center justify-center gap-2">
                          <CheckCircle2 className="h-4 w-4" />
                          Finished - Passed
                        </span>
                      )}
                      {proposalData.status === "rejected" && (
                        <span className="flex items-center justify-center gap-2">
                          <XCircle className="h-4 w-4" />
                          Finished - Rejected
                        </span>
                      )}
                      {proposalData.status === "expired" && (
                        <span className="flex items-center justify-center gap-2">
                          <XCircle className="h-4 w-4" />
                          Finished - Expired
                        </span>
                      )}
                      {proposalData.status === "failed" && (
                        <span className="flex items-center justify-center gap-2">
                          <XCircle className="h-4 w-4" />
                          Finished - Failed
                        </span>
                      )}
                    </div>
                    {proposalData.resolved_at && (
                      <p className="text-xs text-muted-foreground text-center">
                        Resolved on{" "}
                        {new Date(proposalData.resolved_at).toLocaleString("en-US", {
                          dateStyle: "medium",
                          timeStyle: "short",
                        })}
                      </p>
                    )}
                    {proposalData.resolution_notes && (
                      <p className="text-xs text-muted-foreground text-center italic">
                        {proposalData.resolution_notes}
                      </p>
                    )}
                  </div>
                )
              ) : (
                <div className="text-sm text-muted-foreground italic w-full text-center py-2">
                  Loading proposal...
                </div>
              )}
            </>
          )}
        </div>

            {/* Success Modal */}
        {showSuccessModal && successProposalId && (
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm rounded-2xl flex items-center justify-center z-50 p-4">
            <div className="bg-card border border-border/60 rounded-xl p-8 max-w-sm w-full space-y-6 text-center animate-in fade-in scale-in-95 duration-300 shadow-lg">
              {/* Checkmark Animation */}
              <div className="flex justify-center">
                <div className="relative w-16 h-16">
                  <div className="absolute inset-0 bg-success/20 rounded-full animate-pulse" />
                  <div className="absolute inset-0 flex items-center justify-center">
                    <CheckCircle2 className="w-10 h-10 text-success" />
                  </div>
                </div>
              </div>

              {/* Success Message */}
              <div className="space-y-2">
                <h3 className="text-lg font-bold">Proposal Submitted</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  {lawType === "MESSAGE_OF_THE_DAY"
                    ? "Your announcement is now live. All members can see it on the community page."
                    : "Your proposal is now open for vote. Members can review and cast their votes."}
                </p>
              </div>

              {/* Action Buttons */}
              <div className="flex gap-3 flex-col">
                <Button
                  onClick={handleReviewProposal}
                  className="w-full font-semibold"
                  size="lg"
                >
                  <CheckCircle2 className="h-4 w-4 mr-2" />
                  Review The Proposal
                </Button>
              </div>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
