"use client";

import { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Flag, Loader2, CheckCircle2, AlertCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import { GoldCoinIcon } from "@/components/ui/coin-icon";

// Modern warfare icon - using a crosshair/target icon for attack
const TankIcon = ({ className }: { className?: string }) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
  >
    <circle cx="12" cy="12" r="10" />
    <circle cx="12" cy="12" r="6" />
    <circle cx="12" cy="12" r="2" />
    <line x1="12" y1="2" x2="12" y2="6" />
    <line x1="12" y1="18" x2="12" y2="22" />
    <line x1="2" y1="12" x2="6" y2="12" />
    <line x1="18" y1="12" x2="22" y2="12" />
  </svg>
);

interface CompactAttackButtonProps {
  mode: "CLAIM" | "ATTACK";
  regionName: string;
  onAction: () => Promise<{ battleId?: string }>;
  onNavigateToBattle?: (battleId: string) => void;
  goldCost: number;
  userGold: number;
  activeBattleId?: string | null;
  isFirstClaim?: boolean;
}

type ButtonState = "idle" | "loading" | "success" | "insufficient" | "battle" | "error";

export function CompactAttackButton({
  mode,
  regionName,
  onAction,
  onNavigateToBattle,
  goldCost,
  userGold,
  activeBattleId = null,
  isFirstClaim = false,
}: CompactAttackButtonProps) {
  const canAfford = userGold >= goldCost;
  const isClaim = mode === "CLAIM";
  const isCapitalClaim = isClaim && isFirstClaim;

  // Calculate initial state - activeBattleId takes absolute priority
  const getInitialState = (): ButtonState => {
    if (activeBattleId) return "battle";
    return canAfford ? "idle" : "insufficient";
  };

  const [state, setState] = useState<ButtonState>(getInitialState);
  const [battleId, setBattleId] = useState<string | null>(activeBattleId);
  const [errorMessage, setErrorMessage] = useState<string>("");
  const successTimerRef = useRef<NodeJS.Timeout | null>(null);

  const handleAction = async () => {
    if (!canAfford || state === "loading") return;

    setState("loading");
    setErrorMessage("");

    try {
      const result = await onAction();
      const newBattleId = result?.battleId;
      if (newBattleId) {
        setBattleId(newBattleId);
      }
      setState("success");

      // Auto-transition to battle state after 3 seconds if we have a battleId
      if (newBattleId) {
        successTimerRef.current = setTimeout(() => {
          setState("battle");
        }, 3000);
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : "Action failed. Please try again.";
      setErrorMessage(message);
      setState("error");

      // Auto-reset to idle after 5 seconds
      setTimeout(() => {
        setState(canAfford ? "idle" : "insufficient");
        setErrorMessage("");
      }, 5000);
    }
  };

  const handleNavigateToBattle = () => {
    if (battleId && onNavigateToBattle) {
      onNavigateToBattle(battleId);
    } else if (battleId) {
      window.open(`/battle/${battleId}`, "_blank");
    }
  };

  // Clean up timer on unmount
  useEffect(() => {
    return () => {
      if (successTimerRef.current) {
        clearTimeout(successTimerRef.current);
      }
    };
  }, []);

  // Sync state with activeBattleId - only when not in transient states
  useEffect(() => {
    // Don't interrupt loading, success, or error states
    if (state === "loading" || state === "success" || state === "error") return;

    if (activeBattleId) {
      setBattleId(activeBattleId);
      setState("battle");
    } else {
      setBattleId(null);
      setState(canAfford ? "idle" : "insufficient");
    }
  }, [activeBattleId, canAfford, state]);

  // Error state
  if (state === "error") {
    return (
      <Card
        variant="default"
        className="rounded-xl border border-destructive/70 bg-destructive/10 overflow-hidden transition-all duration-300"
      >
        <div className="p-4 space-y-3">
          <div className="flex items-center gap-2">
            <AlertCircle className="size-4 text-destructive" />
            <h3 className="text-sm font-semibold text-destructive">
              {isClaim ? (isCapitalClaim ? "Capital Claim Failed" : "Claim Failed") : "Attack Failed"}
            </h3>
          </div>
          <p className="text-xs text-destructive leading-relaxed">
            {errorMessage}
          </p>
          <div className="space-y-2">
            <Button
              disabled
              size="lg"
              variant="destructive"
              className="w-full gap-2 font-bold transition-all duration-300 cursor-not-allowed opacity-60"
            >
              <AlertCircle className="size-4" />
              <span className="text-sm truncate flex-1">
                {errorMessage.length > 30 ? "Action Failed" : errorMessage}
              </span>
            </Button>
            <div className="flex items-center justify-center gap-1 text-xs text-destructive py-1">
              <AlertCircle className="size-3 shrink-0" />
              <span>Resetting in 5 seconds...</span>
            </div>
          </div>
        </div>
      </Card>
    );
  }

  // Insufficient gold state
  if (state === "insufficient") {
    return (
      <Card
        variant="default"
        className="rounded-xl border border-border/70 bg-card overflow-hidden transition-all duration-300"
      >
        <div className="p-4 space-y-3">
          <div className="flex items-center gap-2">
            {isClaim ? <Flag className="size-4 text-muted-foreground" /> : <TankIcon className="size-4 text-muted-foreground" />}
            <h3 className="text-sm font-semibold text-foreground">
              {isClaim ? (isCapitalClaim ? "Claim Capital" : "Claim Territory") : "Military Action"}
            </h3>
          </div>
          <p className="text-xs text-muted-foreground leading-relaxed">
            {isClaim
              ? (isCapitalClaim
                  ? `Establish your capital in ${regionName} and begin your empire. Requires ${goldCost} gold.`
                  : `Establish your presence in ${regionName}. Requires ${goldCost} gold.`)
              : `Launch an offensive strike to take control of ${regionName}. Requires ${goldCost} gold.`}
          </p>
          <div className="space-y-2">
            <Button
              disabled
              size="lg"
              variant="outline"
              className="w-full gap-2 font-bold border-destructive/40 bg-destructive/10 cursor-not-allowed transition-all duration-300"
            >
              <div className="flex items-center gap-1.5 flex-1 min-w-0">
                {isClaim ? <Flag className="size-4" /> : <TankIcon className="size-4" />}
                <span className="text-sm truncate">
                  {isClaim ? "Claim" : "Attack"} {regionName}
                </span>
              </div>
              <div className="flex items-center gap-1 text-destructive shrink-0">
                <GoldCoinIcon className="size-4" />
                <span className="text-sm font-bold">{goldCost}</span>
              </div>
            </Button>
            <div className="flex items-center justify-center gap-1 text-xs text-destructive py-1">
              <AlertCircle className="size-3 shrink-0" />
              <span>Need {goldCost - userGold} more gold</span>
            </div>
          </div>
        </div>
      </Card>
    );
  }

  // Success state
  if (state === "success") {
    return (
      <Card
        variant="default"
        className="rounded-xl border border-border/70 bg-card overflow-hidden transition-all duration-300"
      >
        <div className="p-4 space-y-3">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="size-4 text-green-600" />
            <h3 className="text-sm font-semibold text-foreground">
              {isClaim ? (isCapitalClaim ? "Capital Established" : "Territory Claimed") : "Attack Successful"}
            </h3>
          </div>
          <p className="text-xs text-muted-foreground leading-relaxed">
            {isClaim
              ? (isCapitalClaim
                  ? `${regionName} is now your capital. Your empire begins here.`
                  : `${regionName} is now under your control. Your empire grows.`)
              : `Battle has been initiated in ${regionName}. Join the fight to secure victory.`}
          </p>
          <div className="space-y-2">
            <Button
              onClick={(e) => {
                e.stopPropagation();
                if (!isClaim) {
                  handleNavigateToBattle();
                }
              }}
              disabled={isClaim}
              size="lg"
              className="w-full gap-2 font-bold transition-all duration-300 bg-green-600 hover:bg-green-700"
            >
              <CheckCircle2 className="size-4" />
              <span className="text-sm truncate flex-1">
                {isClaim ? "Successfully Claimed!" : "Successfully Attacked!"}
              </span>
              {!isClaim && <span className="text-xs shrink-0 font-bold">Fight Now!</span>}
            </Button>
            <div className="flex items-center justify-center gap-1 text-xs text-muted-foreground py-1">
              {isClaim ? <Flag className="size-3 shrink-0" /> : <TankIcon className="size-3 shrink-0" />}
              <span>{isClaim ? `Territory ${regionName} is now yours` : `Battle started in ${regionName}`}</span>
            </div>
          </div>
        </div>
      </Card>
    );
  }

  // Loading state
  if (state === "loading") {
    return (
      <Card
        variant="default"
        className="rounded-xl border border-border/70 bg-card overflow-hidden transition-all duration-300"
      >
        <div className="p-4 space-y-3">
          <div className="flex items-center gap-2">
            <Loader2 className="size-4 text-muted-foreground animate-spin" />
            <h3 className="text-sm font-semibold text-foreground">
              {isClaim ? (isCapitalClaim ? "Establishing Capital..." : "Claiming Territory...") : "Launching Attack..."}
            </h3>
          </div>
          <p className="text-xs text-muted-foreground leading-relaxed">
            {isClaim
              ? (isCapitalClaim
                  ? `Establishing your capital in ${regionName}. The foundation of your empire...`
                  : `Securing ${regionName} for your empire. Please wait...`)
              : `Initiating offensive strike on ${regionName}. Preparing forces...`}
          </p>
          <div className="space-y-2">
            <Button
              disabled
              size="lg"
              variant={isClaim ? "default" : "destructive"}
              className="w-full gap-2 font-bold transition-all duration-300 animate-pulse cursor-wait"
            >
              <Loader2 className="size-4 animate-spin" />
              <span className="text-sm">
                {isClaim ? "Claiming..." : "Launching attack..."}
              </span>
            </Button>
            <div className="flex items-center justify-center gap-1 text-xs text-muted-foreground py-1">
              {isClaim ? <Flag className="size-3 shrink-0" /> : <TankIcon className="size-3 shrink-0" />}
              <span>{isClaim ? "Processing your claim" : "Initiating battle sequence"}</span>
            </div>
          </div>
        </div>
      </Card>
    );
  }

  // Battle in progress state
  if (state === "battle") {
    return (
      <Card
        variant="default"
        className="rounded-xl border border-border/70 bg-card overflow-hidden transition-all duration-300"
      >
        <div className="p-4 space-y-3">
          <div className="flex items-center gap-2">
            <TankIcon className="size-4 text-destructive animate-pulse" />
            <h3 className="text-sm font-semibold text-foreground">
              Battle in Progress
            </h3>
          </div>
          <p className="text-xs text-muted-foreground leading-relaxed">
            {`Active battle in ${regionName}. Join now to fight.`}
          </p>
          <div className="space-y-2">
            <Button
              onClick={(e) => {
                e.stopPropagation();
                handleNavigateToBattle();
              }}
              size="lg"
              variant="destructive"
              className="w-full gap-2 font-bold transition-all duration-300"
            >
              <TankIcon className="size-4" />
              <span className="text-sm truncate flex-1">
                Battle in Progress
              </span>
              <span className="text-xs shrink-0 font-bold">Fight Now!</span>
            </Button>
            <div className="flex items-center justify-center gap-1 text-xs text-muted-foreground py-1">
              <TankIcon className="size-3 shrink-0" />
              <span>Battle is ongoing in {regionName}</span>
            </div>
          </div>
        </div>
      </Card>
    );
  }

  // Normal/idle state
  return (
    <Card
      variant="default"
      className="rounded-xl border border-border/70 bg-card overflow-hidden transition-all duration-300"
    >
      <div className="p-4 space-y-3">
        <div className="flex items-center gap-2">
          {isClaim ? <Flag className="size-4 text-muted-foreground" /> : <TankIcon className="size-4 text-muted-foreground" />}
          <h3 className="text-sm font-semibold text-foreground">
            {isClaim ? (isCapitalClaim ? "Claim Capital" : "Claim Territory") : "Military Action"}
          </h3>
        </div>
        <p className="text-xs text-muted-foreground leading-relaxed">
          {isClaim
            ? (isCapitalClaim
                ? `Establish your capital in ${regionName}. The foundation of your empire begins here.`
                : `Establish your presence in ${regionName} and expand your empire.`)
            : `Launch an offensive strike to take control of ${regionName}.`}
        </p>
        <div className="space-y-2">
          <Button
            onClick={(e) => {
              e.stopPropagation();
              handleAction();
            }}
            size="lg"
            variant={isClaim ? "default" : "destructive"}
            className="w-full gap-2 font-bold transition-all duration-300"
          >
            <div className="flex items-center gap-1.5 flex-1 min-w-0">
              {isClaim ? <Flag className="size-4" /> : <TankIcon className="size-4" />}
              <span className="text-sm truncate font-semibold">
                {isClaim ? "Claim" : "Attack"} {regionName}
              </span>
            </div>
            {goldCost > 0 && (
              <div className="flex items-center gap-0.5 shrink-0 text-foreground/80">
                <span className="text-xs">({goldCost}</span>
                <GoldCoinIcon className="size-3.5" />
                <span className="text-xs">)</span>
              </div>
            )}
          </Button>
          <div className="flex items-center justify-center gap-1 text-xs text-muted-foreground py-1">
            {isClaim ? <Flag className="size-3 shrink-0" /> : <TankIcon className="size-3 shrink-0" />}
            <span>{isClaim ? "Establish your presence in this region" : "Launch an offensive to take control"}</span>
          </div>
        </div>
      </div>
    </Card>
  );
}
