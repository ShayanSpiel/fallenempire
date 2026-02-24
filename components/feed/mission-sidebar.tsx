"use client";

import { useState, useTransition, useEffect, useRef } from "react";
import {
  ChevronDown,
  ChevronUp,
  Target,
  Users,
  Swords,
  MessageCircle,
  UserPlus,
  Trophy,
  Clock,
  CheckCircle2,
  Circle,
  Sparkles,
  TrendingUp,
  ThumbsUp,
  Dumbbell
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";
import { claimMissionReward } from "@/app/actions/missions";
import { toast } from "sonner";

type MissionStatus = "incomplete" | "complete" | "claimed";

export type Mission = {
  id: string;
  title: string;
  description: string;
  iconName: string;
  progress: number;
  goal: number;
  xpReward: number;
  status: MissionStatus;
  type: "daily" | "weekly";
};

type MissionSidebarProps = {
  missions?: Mission[];
};

// Default missions with updated structure
const DEFAULT_MISSIONS: Mission[] = [
  // Daily Missions
  {
    id: "daily-train",
    title: "Daily Training",
    description: "Complete your training session",
    iconName: "Dumbbell",
    progress: 0,
    goal: 1,
    xpReward: 30,
    status: "incomplete",
    type: "daily",
  },
  {
    id: "daily-battle",
    title: "Battle Participant",
    description: "Join 1 battle today",
    iconName: "Swords",
    progress: 0,
    goal: 1,
    xpReward: 50,
    status: "incomplete",
    type: "daily",
  },
  // Weekly Missions
  {
    id: "weekly-post",
    title: "Introduce Yourself",
    description: "Share your story with the community",
    iconName: "MessageCircle",
    progress: 0,
    goal: 1,
    xpReward: 100,
    status: "incomplete",
    type: "weekly",
  },
  {
    id: "join-community",
    title: "Join a Community",
    description: "Become part of a community",
    iconName: "Users",
    progress: 0,
    goal: 1,
    xpReward: 150,
    status: "incomplete",
    type: "weekly",
  },
  {
    id: "make-friend",
    title: "Make a Friend",
    description: "Follow another player",
    iconName: "UserPlus",
    progress: 0,
    goal: 1,
    xpReward: 75,
    status: "incomplete",
    type: "weekly",
  },
  {
    id: "weekly-battles",
    title: "Warrior's Path",
    description: "Fight in 3 battles this week",
    iconName: "Swords",
    progress: 0,
    goal: 3,
    xpReward: 200,
    status: "incomplete",
    type: "weekly",
  },
  {
    id: "grow-rank",
    title: "Climb the Ranks",
    description: "Gain 1 military rank level",
    iconName: "TrendingUp",
    progress: 0,
    goal: 1,
    xpReward: 250,
    status: "incomplete",
    type: "weekly",
  },
  {
    id: "weekly-engage",
    title: "Social Engagement",
    description: "React or comment 10 times",
    iconName: "ThumbsUp",
    progress: 0,
    goal: 10,
    xpReward: 150,
    status: "incomplete",
    type: "weekly",
  },
];

export function MissionSidebar({ missions = DEFAULT_MISSIONS }: MissionSidebarProps) {
  const [isOpen, setIsOpen] = useState(true);
  const prevMissionsRef = useRef<Mission[]>([]);

  // Show toast when mission completes
  useEffect(() => {
    missions.forEach((mission) => {
      const prevMission = prevMissionsRef.current.find((m) => m.id === mission.id);

      // If mission just completed
      if (prevMission && prevMission.status !== "complete" && mission.status === "complete") {
        toast.success(`${mission.title} Complete!`, {
          description: `Progress: ${mission.progress}/${mission.goal} • +${mission.xpReward} XP`,
          icon: <CheckCircle2 className="h-4 w-4 text-success" />,
        });
      }
    });

    prevMissionsRef.current = missions;
  }, [missions]);

  const dailyMissions = missions.filter((m) => m.type === "daily");
  const weeklyMissions = missions.filter((m) => m.type === "weekly");

  const dailyComplete = dailyMissions.filter((m) => m.status === "complete" || m.status === "claimed").length;
  const weeklyComplete = weeklyMissions.filter((m) => m.status === "complete" || m.status === "claimed").length;

  const totalComplete = dailyComplete + weeklyComplete;
  const totalMissions = missions.length;
  const completionPercent = Math.round((totalComplete / totalMissions) * 100);

  return (
    <aside className="rounded-3xl border border-border/60 bg-card/90 backdrop-blur overflow-hidden">
      {/* Header - Always Visible */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full p-5 flex items-center justify-between hover:bg-gradient-to-r hover:from-primary/5 hover:to-secondary/5 transition-all duration-300 group"
      >
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-muted/50 to-muted/30 flex items-center justify-center group-hover:scale-105 transition-all duration-300">
            <svg
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
              className="shrink-0"
            >
              <defs>
                <linearGradient id="target-gradient-light" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor="#f59e0b" />
                  <stop offset="100%" stopColor="#dc2626" />
                </linearGradient>
                <linearGradient id="target-gradient-dark" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor="#38bdf8" />
                  <stop offset="100%" stopColor="#3b82f6" />
                </linearGradient>
              </defs>
              <circle cx="12" cy="12" r="10" stroke="url(#target-gradient-light)" strokeWidth="2" className="dark:hidden" />
              <circle cx="12" cy="12" r="6" stroke="url(#target-gradient-light)" strokeWidth="2" className="dark:hidden" />
              <circle cx="12" cy="12" r="2" stroke="url(#target-gradient-light)" strokeWidth="2" className="dark:hidden" />
              <circle cx="12" cy="12" r="10" stroke="url(#target-gradient-dark)" strokeWidth="2" className="hidden dark:block" />
              <circle cx="12" cy="12" r="6" stroke="url(#target-gradient-dark)" strokeWidth="2" className="hidden dark:block" />
              <circle cx="12" cy="12" r="2" stroke="url(#target-gradient-dark)" strokeWidth="2" className="hidden dark:block" />
            </svg>
          </div>
          <div className="text-left">
            <h3 className="text-sm font-bold flex items-center gap-2">
              Missions
              <Sparkles className="h-3.5 w-3.5 text-primary animate-pulse" />
            </h3>
            <p className="text-[10px] text-muted-foreground font-semibold">
              {completionPercent}% Complete • {totalComplete}/{totalMissions}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <div className="px-2.5 py-1 rounded-lg bg-gradient-to-r from-primary/15 to-secondary/15 border border-primary/20 text-primary text-[10px] font-bold shadow-sm">
            {totalComplete}/{totalMissions}
          </div>
          {isOpen ? (
            <ChevronUp className="h-4 w-4 text-muted-foreground transition-transform group-hover:text-foreground" />
          ) : (
            <ChevronDown className="h-4 w-4 text-muted-foreground transition-transform group-hover:text-foreground" />
          )}
        </div>
      </button>

      {/* Collapsible Content */}
      <div
        className={cn(
          "transition-all duration-300 ease-in-out overflow-hidden",
          isOpen ? "max-h-[1000px] opacity-100" : "max-h-0 opacity-0"
        )}
      >
        <div className="px-5 pb-5 space-y-4">
          {/* Daily Missions */}
          {dailyMissions.length > 0 && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Clock className="h-3.5 w-3.5 text-primary" />
                  <h4 className="text-[11px] font-bold uppercase tracking-wider text-primary/80">
                    Daily Missions
                  </h4>
                </div>
                <span className="text-[9px] font-bold text-muted-foreground bg-muted/50 px-2 py-0.5 rounded-md">
                  Resets in 8h
                </span>
              </div>

              <div className="space-y-1.5">
                {dailyMissions.map((mission, index) => (
                  <MissionCard key={mission.id} mission={mission} index={index} />
                ))}
              </div>
            </div>
          )}

          {/* Weekly Missions */}
          {weeklyMissions.length > 0 && (
            <div className="space-y-2">
              <div className="flex items-center justify-between pt-1">
                <div className="flex items-center gap-2">
                  <Trophy className="h-3.5 w-3.5 text-secondary" />
                  <h4 className="text-[11px] font-bold uppercase tracking-wider text-secondary/80">
                    Weekly Missions
                  </h4>
                </div>
                <span className="text-[9px] font-bold text-muted-foreground bg-muted/50 px-2 py-0.5 rounded-md">
                  Resets in 3d
                </span>
              </div>

              <div className="space-y-1.5">
                {weeklyMissions.map((mission, index) => (
                  <MissionCard key={mission.id} mission={mission} index={index} />
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </aside>
  );
}

// Icon mapping helper
const ICON_MAP: Record<string, React.ComponentType<{ className?: string }>> = {
  Dumbbell,
  Swords,
  MessageCircle,
  Users,
  UserPlus,
  Trophy,
  TrendingUp,
  ThumbsUp,
};

function MissionCard({ mission, index }: { mission: Mission; index: number }) {
  const Icon = ICON_MAP[mission.iconName] || Trophy;
  const progressPercent = Math.min(100, (mission.progress / mission.goal) * 100);
  const isComplete = mission.status === "complete";
  const isClaimed = mission.status === "claimed";
  const [isPending, startTransition] = useTransition();
  const [showReward, setShowReward] = useState(false);

  const handleClaim = () => {
    startTransition(async () => {
      setShowReward(true);

      const result = await claimMissionReward(mission.id);

      if (result.error) {
        toast.error("Failed to claim reward", {
          description: result.error,
        });
        setShowReward(false);
      } else {
        toast.success("Mission Complete!", {
          description: `+${mission.xpReward} XP earned`,
          icon: <Sparkles className="h-4 w-4 text-primary" />,
        });

        // Keep animation visible for a moment
        setTimeout(() => setShowReward(false), 1000);
      }
    });
  };

  // Collapsed (claimed) state - single line
  if (isClaimed) {
    return (
      <div className="rounded-lg border border-border/30 bg-muted/20 px-3 py-2 transition-all duration-200 opacity-60">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 min-w-0 flex-1">
            <CheckCircle2 className="h-3.5 w-3.5 text-success shrink-0" />
            <span className="text-xs font-semibold text-muted-foreground truncate">
              {mission.title}
            </span>
          </div>
          <span className="text-[9px] font-bold text-success/60 shrink-0">
            +{mission.xpReward} XP
          </span>
        </div>
      </div>
    );
  }

  return (
    <div
      className={cn(
        "rounded-lg border p-2.5 transition-all duration-300 group relative overflow-hidden",
        isComplete
          ? "bg-gradient-to-r from-success/10 via-success/5 to-transparent border-success/40 hover:border-success/60 shadow-sm hover:shadow-md"
          : "bg-card/60 border-border/40 hover:border-border/60 hover:bg-card/80 animate-in fade-in slide-in-from-left-2",
        showReward && "animate-pulse"
      )}
      style={{
        animationDelay: `${index * 50}ms`,
        animationDuration: "400ms",
      }}
    >
      {/* Shine effect on incomplete - plays once on load */}
      {!isComplete && (
        <div
          className="absolute inset-0 bg-gradient-to-r from-transparent via-primary/10 to-transparent -translate-x-full pointer-events-none animate-in slide-in-from-left-full duration-1000"
          style={{
            animationDelay: `${index * 100}ms`,
            animationFillMode: 'forwards',
          }}
        />
      )}

      {/* Reward celebration overlay */}
      {showReward && (
        <div className="absolute inset-0 bg-gradient-to-r from-primary/20 via-secondary/20 to-primary/20 animate-pulse pointer-events-none" />
      )}

      <div className="flex items-center gap-2.5 relative">
        {/* Icon */}
        <div
          className={cn(
            "h-7 w-7 rounded-lg flex items-center justify-center shrink-0 transition-all duration-300",
            isClaimed
              ? "bg-muted/40"
              : isComplete
              ? "bg-gradient-to-br from-success/30 to-success/20 shadow-sm group-hover:scale-110"
              : "bg-gradient-to-br from-muted/60 to-muted/40 group-hover:from-primary/20 group-hover:to-secondary/20 group-hover:scale-105"
          )}
        >
          <Icon
            className={cn(
              "h-3.5 w-3.5 transition-colors",
              isClaimed
                ? "text-muted-foreground"
                : isComplete
                ? "text-success"
                : "text-muted-foreground group-hover:text-primary"
            )}
          />
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0 space-y-1.5">
          <div className="flex items-center justify-between gap-2">
            <h5 className="text-xs font-bold leading-tight truncate">
              {mission.title}
            </h5>
            {isComplete ? (
              <CheckCircle2 className="h-3.5 w-3.5 text-success shrink-0 animate-in zoom-in duration-300" />
            ) : (
              <Circle className="h-3.5 w-3.5 text-muted-foreground/30 shrink-0" />
            )}
          </div>

          {/* Progress */}
          <div className="space-y-1">
            <div className="flex items-center justify-between text-[9px] font-bold">
              <span className={cn(
                "font-mono",
                isComplete ? "text-success" : "text-muted-foreground"
              )}>
                {mission.progress}/{mission.goal}
              </span>
              <span className={cn(
                "flex items-center gap-1",
                isComplete ? "text-primary" : "text-muted-foreground/70"
              )}>
                <Sparkles className="h-2 w-2" />
                {mission.xpReward}
              </span>
            </div>
            <div className="relative">
              <Progress
                value={progressPercent}
                className={cn(
                  "h-1",
                  isComplete && "animate-pulse"
                )}
              />
            </div>
          </div>

          {/* Claim Button */}
          {isComplete && (
            <Button
              size="sm"
              onClick={handleClaim}
              disabled={isPending}
              className={cn(
                "w-full h-6 text-[10px] font-bold shadow-sm",
                "bg-gradient-to-r from-primary via-secondary to-primary bg-[length:200%_100%]",
                "hover:bg-[position:100%_0] transition-all duration-500",
                "animate-in slide-in-from-bottom-2 fade-in duration-300"
              )}
            >
              {isPending ? (
                <span className="flex items-center gap-1.5">
                  <svg className="animate-spin h-3 w-3" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Claiming...
                </span>
              ) : (
                <span className="flex items-center gap-1">
                  <Sparkles className="h-2.5 w-2.5" />
                  Claim Reward
                </span>
              )}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
