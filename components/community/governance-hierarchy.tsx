"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Crown, UserCog, Plus, Loader2 } from "lucide-react";
import { borders } from "@/lib/design-system";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { UserAvatar } from "@/components/ui/user-avatar";
import { UserNameDisplay } from "@/components/ui/user-name-display";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { SectionHeading } from "@/components/ui/section-heading";
import { Input } from "@/components/ui/input";
import { getGovernanceType, getRankLabel } from "@/lib/governance";
import { assignRankAction, claimThroneAction } from "@/app/actions/community";
import { showGovernanceToast, showErrorToast } from "@/lib/toast-utils";
import type { ChatSidebarEvent } from "@/lib/types/community";

interface HierarchyMember {
  user_id: string;
  username: string;
  avatar_url?: string | null;
  user_tier?: string | null;
  rank_tier: number;
}

interface GovernanceHierarchyProps {
  communityId: string;
  governanceType: string;
  members: HierarchyMember[];
  isUserSovereign: boolean;
  currentUserId: string;
  onGovernanceEvent?: (event: ChatSidebarEvent) => void;
}

/**
 * Displays the governance hierarchy for a community
 * Shows ranks visually with avatars and allows sovereign to assign ranks
 */
export function GovernanceHierarchy({
  communityId,
  governanceType,
  members,
  isUserSovereign,
  currentUserId,
  onGovernanceEvent,
}: GovernanceHierarchyProps) {
  const [isPending, startTransition] = useTransition();
  const [selectingMinisterSlot, setSelectingMinisterSlot] = useState<number | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const router = useRouter();

  const config = getGovernanceType(governanceType);
  const sovereign = members.find((m) => m.rank_tier === 0);
  const hasNoSovereign = !sovereign;
  const isCurrentUserSovereign = sovereign?.user_id === currentUserId;

  const assignedSecretaries = members.filter((m) => m.rank_tier === 1);
  const availableMembers = members.filter((m) => m.rank_tier !== 0 && m.rank_tier !== 1);

  const pushGovernanceEvent = (
    title: string,
    description: string,
    tone: ChatSidebarEvent["tone"] = "info"
  ) => {
    onGovernanceEvent?.({
      id: `governance-${Date.now()}`,
      title,
      description,
      time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      tone,
    });
  };

  const handleClaimThrone = () => {
    if (!hasNoSovereign) return;
    startTransition(async () => {
      try {
        const result = await claimThroneAction(communityId);
        if (result.error) {
          showGovernanceToast(result.error, "error");
          return;
        }
        showGovernanceToast(result.message || "Throne claimed!", "success");
        router.refresh();
      } catch (error) {
        showGovernanceToast("Failed to claim throne", "error");
      }
    });
  };

  const handleAssignRank = (targetUserId: string, rankTier: number, username: string) => {
    if (!isUserSovereign) return;
    startTransition(async () => {
      try {
        const result = await assignRankAction(communityId, targetUserId, rankTier);
        if (result.error) {
          showGovernanceToast(result.error, "error");
          return;
        }

        const secretaryLabel = config.roles.find((r) => r.rank === 1)?.label ?? "Secretary";
        const isDemotion = rankTier !== 1;
        const roleLabel = isDemotion ? secretaryLabel : getRankLabel(governanceType, rankTier);
        const description = isDemotion
          ? `${username} has been removed from the ${secretaryLabel} team.`
          : `${username} was promoted to ${roleLabel}.`;
        pushGovernanceEvent(
          isDemotion ? `${secretaryLabel} removed` : `${roleLabel} assigned`,
          description,
          isDemotion ? "warn" : "success"
        );
        showGovernanceToast(
          result.message ||
            (isDemotion
              ? `${username} has been demoted.`
              : `${username} is now a ${roleLabel}.`),
          "success"
        );
        handleClearSelection();
        router.refresh();
      } catch (error) {
        showGovernanceToast("Failed to assign rank", "error");
      }
    });
  };

  const handleClearSelection = () => {
    setSelectingMinisterSlot(null);
    setSearchTerm("");
  };

  const handleOpenSelection = (index: number) => {
    setSearchTerm("");
    setSelectingMinisterSlot(index);
  };

  const renderSelectionPanel = (index: number) => {
    if (!isUserSovereign || selectingMinisterSlot !== index) return null;
    const normalizedTerm = searchTerm.trim().toLowerCase();
    const filteredMembers = normalizedTerm
      ? availableMembers.filter((member) => member.username.toLowerCase().includes(normalizedTerm))
      : availableMembers;
    return (
      <div className="space-y-2 w-full">
        <Input
          size={"sm" as any}
          value={searchTerm}
          onChange={(event) => setSearchTerm(event.target.value)}
          placeholder="Search members"
          className="text-xs"
          autoComplete="off"
        />
        <div className="space-y-1 max-h-40 overflow-y-auto">
          {filteredMembers.length > 0 ? (
            filteredMembers.map((member) => (
              <Button
                key={member.user_id}
                onClick={() => handleAssignRank(member.user_id, 1, member.username)}
                variant="ghost"
                size="sm"
                className="w-full justify-start text-[10px] sm:text-xs h-8"
                disabled={isPending}
              >
                {member.username}
              </Button>
            ))
          ) : (
            <p className="text-[10px] text-muted-foreground p-2">
              No members available
            </p>
          )}
        </div>
        <Button
          onClick={handleClearSelection}
          variant="ghost"
          size="sm"
          className="w-full text-[10px] h-7"
        >
          Cancel
        </Button>
      </div>
    );
  };

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Sovereign Section */}
      <Card variant="default">
        <CardContent className="space-y-4">
          <SectionHeading
            title={`${config.roles[0]?.label || "Sovereign"}`}
            icon={Crown}
            actions={
              <Badge variant="secondary" className="text-xs">
                Rank {config.roles[0]?.rank}
              </Badge>
            }
          />

          <div className={`flex items-center justify-center min-h-40 sm:min-h-48 rounded-lg ${borders.thin} border-dashed border-border/50 bg-muted/20 p-4 sm:p-6`}>
            {sovereign ? (
              <div className="flex flex-col items-center gap-3 sm:gap-4">
                <div className="relative">
                  <UserAvatar
                    username={sovereign.username}
                    avatarUrl={sovereign.avatar_url}
                    size="xl"
                  />
                  <div className="absolute -top-1 -right-1 bg-gradient-to-r from-amber-500 to-amber-400 dark:from-sky-500 dark:to-sky-400 rounded-full p-1.5 shadow-md dark:shadow-sky-500/30 shadow-amber-500/30">
                    <Crown className="h-4 w-4 text-white" />
                  </div>
                </div>
                <div className="text-center">
                  <UserNameDisplay
                    username={sovereign.username}
                    userTier={sovereign.user_tier as "alpha" | "sigma" | "omega" | null}
                    showLink={false}
                    badgeSize="sm"
                    className="font-semibold text-xs sm:text-sm"
                  />
                  <p className="text-[10px] sm:text-xs text-muted-foreground">
                    {config.roles[0]?.label}
                  </p>
                </div>
              </div>
            ) : (
              <div className="text-center space-y-3 sm:space-y-4 w-full">
                <div>
                  <p className="text-xs sm:text-sm font-semibold text-muted-foreground mb-1 sm:mb-2">
                    No {config.roles[0]?.label}
                  </p>
                  <p className="text-[10px] sm:text-xs text-muted-foreground">
                    The throne is vacant
                  </p>
                </div>
                <Button
                  onClick={handleClaimThrone}
                  disabled={isPending || !hasNoSovereign}
                  variant="default"
                  size="lg"
                  className="w-auto"
                >
                  {isPending ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Claiming...
                    </>
                  ) : (
                    <>
                      <Crown className="h-4 w-4 mr-2" />
                      Claim the Throne
                    </>
                  )}
                </Button>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Secretary Positions (Rank 1) */}
      {config.roles.some((r) => r.rank === 1) && (
        <Card variant="default">
          <CardContent className="space-y-4">
            <SectionHeading
              title={`${config.roles.find((r) => r.rank === 1)?.label || "Secretaries"}`}
              icon={UserCog}
              actions={
                <Badge variant="secondary" className="text-xs">
                  Rank 1
                </Badge>
              }
            />

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 sm:gap-3">
              {Array.from({ length: config.roles.find((r) => r.rank === 1)?.maxCount || 3 }).map(
                (_, index) => {
                  const assignedMember = assignedSecretaries[index];

                  return (
                    <div
                      key={index}
                      className="flex flex-col items-center gap-2 p-2 sm:p-3 rounded-lg border border-border/50 bg-card hover:bg-muted/50 transition-colors"
                    >
                      {assignedMember ? (
                        <>
                          <UserAvatar
                            username={assignedMember.username}
                            avatarUrl={assignedMember.avatar_url}
                            size="lg"
                          />
                          <UserNameDisplay
                            username={assignedMember.username}
                            userTier={assignedMember.user_tier as "alpha" | "sigma" | "omega" | null}
                            showLink={false}
                            badgeSize="xs"
                            className="text-[10px] sm:text-xs font-semibold text-center line-clamp-1"
                          />
                          {isUserSovereign && (
                            <div className="flex w-full flex-col space-y-1">
                              <Button
                                onClick={() => handleOpenSelection(index)}
                                variant="ghost"
                                size="sm"
                                className="w-full h-8 text-[10px] sm:text-xs"
                                disabled={isPending}
                              >
                                Replace
                              </Button>
                              <Button
                                onClick={() => handleAssignRank(assignedMember.user_id, 10, assignedMember.username)}
                                variant="outline"
                                size="sm"
                                className="w-full h-8 text-[10px] sm:text-xs"
                                disabled={isPending}
                              >
                                Remove
                              </Button>
                            </div>
                          )}
                        </>
                      ) : isUserSovereign ? (
                        <Button
                          onClick={() => handleOpenSelection(index)}
                          variant="ghost"
                          size="sm"
                          className="w-full h-10 sm:h-12"
                          disabled={isPending || availableMembers.length === 0}
                        >
                          <Plus className="h-4 sm:h-5 w-4 sm:w-5 text-muted-foreground" />
                        </Button>
                      ) : (
                        <div className="h-10 sm:h-12 w-10 sm:w-12 rounded-full bg-muted/50 flex items-center justify-center">
                          <Plus className="h-4 sm:h-5 w-4 sm:w-5 text-muted-foreground/50" />
                        </div>
                      )}
                      {renderSelectionPanel(index)}
                    </div>
                  );
                }
              )}
            </div>

            {isUserSovereign && (
              <p className="text-[10px] sm:text-xs text-muted-foreground text-center">
                Use the search below to find a member before assigning them a rank
              </p>
            )}
          </CardContent>
        </Card>
      )}

    </div>
  );
}
