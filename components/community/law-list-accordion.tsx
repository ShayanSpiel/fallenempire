"use client";

import { ChevronDown, Crown, Zap } from "lucide-react";
import { useTheme } from "next-themes";
import { Card } from "@/components/ui/card";
import { LAW_REGISTRY, type LawType } from "@/lib/governance/laws";
import { cn } from "@/lib/utils";

interface LawListAccordionProps {
  governanceType: string;
  userRank: number;
  onSelectLaw: (lawType: LawType) => void;
  isExpanded: boolean;
  onToggle: (expanded: boolean) => void;
}

export function LawListAccordion({
  governanceType,
  userRank,
  onSelectLaw,
  isExpanded,
  onToggle,
}: LawListAccordionProps) {
  // Get available laws for this governance type and user rank
  const lawEntries = Object.entries(LAW_REGISTRY) as [LawType, (typeof LAW_REGISTRY)[LawType]][];
  const availableLaws = lawEntries
    .filter(([, definition]) => definition.governanceRules[governanceType])
    .filter(([, definition]) => {
      const rules = definition.governanceRules[governanceType];
      const allowedRanks = Array.isArray(rules.proposeRank)
        ? rules.proposeRank
        : [rules.proposeRank];
      return allowedRanks.includes(userRank);
    });

  const isLeader = userRank <= 1; // Rank 0 (King) or Rank 1 (Minister/Secretary)

  const { theme, systemTheme } = useTheme();
  const resolvedTheme = theme === "system" ? systemTheme ?? "light" : theme ?? "light";
  const isDarkMode = resolvedTheme === "dark";

  const leaderContainerClasses = isDarkMode
    ? "border-sky-500/30 bg-gradient-to-br from-sky-500/10 to-cyan-500/5 hover:border-sky-500/50 hover:from-sky-500/20 hover:to-cyan-500/10 hover:shadow-sm hover:shadow-sky-500/10"
    : "border-amber-500/30 bg-gradient-to-br from-amber-500/10 to-orange-500/5 hover:border-amber-500/50 hover:from-amber-500/15 hover:to-orange-500/10 hover:shadow-sm hover:shadow-amber-500/10";

  const headerTitleClass = isLeader
    ? isDarkMode
      ? "text-sky-500"
      : "text-amber-600"
    : "text-muted-foreground";

  const headerDescriptionClass = isLeader
    ? isDarkMode
      ? "text-sky-300/80"
      : "text-amber-700/70"
    : "text-muted-foreground";

  return (
    <Card
      variant="subtle"
      className={cn(
        "space-y-3 border p-4 rounded-xl transition-all duration-300",
        isLeader ? leaderContainerClasses : "border-border/40 bg-muted/10 hover:border-border/60"
      )}
    >
      {/* Accordion Header */}
      <button
        onClick={() => onToggle(!isExpanded)}
        className="w-full flex items-start justify-between gap-3 text-left group transition-all duration-200"
      >
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <p className={cn("text-sm font-semibold", headerTitleClass)}>Propose a Law</p>
            {isLeader && (
              <Crown className={cn("h-4 w-4", isDarkMode ? "text-sky-400" : "text-amber-600")} />
            )}
          </div>
          <p className={cn("text-xs mt-1", headerDescriptionClass)}>
            {isLeader
              ? isExpanded
                ? "Select a law to shape your community’s destiny"
                : "Wield your power—tap to propose laws"
              : "Reach the throne to influence your community"}
          </p>
        </div>
        <ChevronDown
          className={cn(
            "h-5 w-5 transition-all duration-300 flex-shrink-0",
            isLeader
              ? isDarkMode
                ? "text-sky-400 group-hover:translate-y-0.5"
                : "text-amber-600 group-hover:translate-y-0.5"
              : "text-muted-foreground",
            isExpanded && "rotate-180"
          )}
        />
      </button>

      {/* Accordion Content - Laws List (Leaders Only) */}
      {isExpanded && isLeader && (
        <div
          className={cn(
            "space-y-2 pt-3 border-t",
            isDarkMode ? "border-sky-500/20" : "border-amber-500/20"
          )}
        >
          {availableLaws.length === 0 ? (
            <p className="text-xs text-muted-foreground py-3 text-center italic">
              No laws available for your rank
            </p>
          ) : (
            availableLaws.map(([lawType, definition]) => {
              const rules = definition.governanceRules[governanceType];
              const isAnnouncement = lawType === "MESSAGE_OF_THE_DAY";
              const buttonClasses = cn(
                "w-full text-left p-3 rounded-lg border transition-all duration-200 group",
                isAnnouncement
                  ? isDarkMode
                    ? "border-sky-400/40 bg-gradient-to-r from-sky-500/10 to-transparent hover:border-sky-500/60 hover:from-sky-500/20 hover:to-cyan-500/10 hover:shadow-sm hover:shadow-sky-500/10"
                    : "border-purple-400/40 bg-gradient-to-r from-purple-500/10 to-transparent hover:border-purple-500/60 hover:from-purple-500/20 hover:to-purple-500/10 hover:shadow-sm hover:shadow-purple-500/10"
                  : isDarkMode
                    ? "border-sky-400/40 bg-gradient-to-r from-sky-500/10 to-transparent hover:border-sky-500/60 hover:from-sky-500/20 hover:to-cyan-500/10 hover:shadow-sm hover:shadow-sky-500/10"
                    : "border-amber-400/40 bg-gradient-to-r from-amber-500/10 to-transparent hover:border-amber-500/60 hover:from-amber-500/20 hover:to-orange-500/10 hover:shadow-sm hover:shadow-amber-500/10"
              );

              const labelClasses = cn(
                "text-sm font-semibold transition-colors text-foreground",
                isAnnouncement
                  ? isDarkMode
                    ? "group-hover:text-sky-200"
                    : "group-hover:text-purple-700 dark:group-hover:text-purple-300"
                  : isDarkMode
                    ? "group-hover:text-sky-200"
                    : "group-hover:text-amber-700 dark:group-hover:text-amber-300"
              );

              return (
                <button
                  key={lawType}
                  onClick={() => onSelectLaw(lawType)}
                  className={buttonClasses}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1">
                      <p className={labelClasses}>
                        {definition.label}
                      </p>
                      <p className="text-xs text-muted-foreground line-clamp-1">
                        {definition.description}
                      </p>
                      <p className="text-[10px] text-muted-foreground/70 mt-1.5">
                        ⏱ {rules.timeToPass === "0h" ? "Instant" : rules.timeToPass}
                        {rules.canFastTrack && " • ⚡ Can fast-track"}
                      </p>
                    </div>
                  </div>
                </button>
              );
            })
          )}
        </div>
      )}

      {/* Motivational Message for Non-Leaders */}
      {!isLeader && (
        <div className="pt-3 border-t border-border/40 space-y-3">
          <div className="rounded-lg bg-gradient-to-br from-slate-500/10 to-slate-600/5 p-4 border border-slate-400/20 space-y-2">
            <div className="flex items-center gap-2">
              <Zap className="h-5 w-5 text-slate-600 dark:text-slate-400" />
              <p className="font-semibold text-slate-700 dark:text-slate-300 text-sm">
                Claim Your Power
              </p>
            </div>
            <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
              Only the <span className={cn("font-bold", isDarkMode ? "text-sky-400" : "text-amber-600")}>King</span> or{" "}
              <span className={cn("font-bold", isDarkMode ? "text-sky-400" : "text-amber-600")}>Minister</span> can propose laws.
              <span className="block mt-2 text-slate-700 dark:text-slate-300">
                Rise through the ranks, seize leadership, and shape your community's destiny. The throne awaits the worthy.
              </span>
            </p>
          </div>
        </div>
      )}
    </Card>
  );
}
