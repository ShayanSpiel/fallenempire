"use client";

import { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { MapPin, Plane, Ticket, Loader2, CheckCircle2, AlertCircle, ExternalLink } from "lucide-react";
import { calculateTravelCost } from "@/lib/travel";
import { cn } from "@/lib/utils";

interface CompactTravelButtonProps {
  hexId: string;
  hexName: string;
  userCurrentHex: string | null;
  userCurrentHexName?: string | null;
  userTicketCount: number;
  onTravel: (hexId: string) => Promise<void>;
}

type ButtonState = "idle" | "traveling" | "success" | "error" | "insufficient";

export function CompactTravelButton({
  hexId,
  hexName,
  userCurrentHex,
  userCurrentHexName,
  userTicketCount,
  onTravel,
}: CompactTravelButtonProps) {
  const [state, setState] = useState<ButtonState>("idle");
  const [errorMessage, setErrorMessage] = useState<string>("");
  const [successMessage, setSuccessMessage] = useState<string>("");
  const [pendingHexId, setPendingHexId] = useState<string | null>(null);
  const [pendingSuccessMessage, setPendingSuccessMessage] = useState<string>("");
  const successTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const travelCost = calculateTravelCost(userCurrentHex, hexId, userTicketCount);
  const isAtLocation = userCurrentHex === hexId;
  const isFirstTravel = !userCurrentHex;

  const clearSuccessTimeout = () => {
    if (successTimeoutRef.current) {
      clearTimeout(successTimeoutRef.current);
      successTimeoutRef.current = null;
    }
  };

  const triggerSuccess = (message: string) => {
    clearSuccessTimeout();
    setSuccessMessage(message);
    setState("success");
    successTimeoutRef.current = setTimeout(() => {
      setState("idle");
      setSuccessMessage("");
      setPendingHexId(null);
      setPendingSuccessMessage("");
      successTimeoutRef.current = null;
    }, 5000);
  };

  const handleTravel = async () => {
    if (!travelCost.canTravel || isAtLocation) return;

    setState("traveling");
    setErrorMessage("");
    setSuccessMessage("");

    try {
      await onTravel(hexId);
      const message = pendingSuccessMessage ||
        (isFirstTravel
          ? `Welcome to ${hexName}!`
          : `Traveled ${travelCost.distance} hexes to ${hexName}`);
      triggerSuccess(message);
      setPendingHexId(null);
      setPendingSuccessMessage("");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Travel failed";
      setErrorMessage(message);
      setState("error");
      setPendingHexId(null);
      setPendingSuccessMessage("");

      // Reset to idle after 5 seconds
      setTimeout(() => {
        setState("idle");
        setErrorMessage("");
      }, 5000);
    }
  };

  // Reset state when hex changes (but not during success/error states)
  useEffect(() => {
    // Don't reset if we're showing success or error messages
    setState((prev) => {
      if (prev === "success" || prev === "error") return prev;
      return "idle";
    });
    setErrorMessage("");
    setSuccessMessage("");
  }, [hexId]);

  useEffect(() => {
    if (!pendingHexId) return;
    if (userCurrentHex !== pendingHexId) return;
    if (state === "success") return;
    const message =
      pendingSuccessMessage ||
      (isFirstTravel
        ? `Welcome to ${hexName}!`
        : `Traveled ${travelCost.distance} hexes to ${hexName}`);
    triggerSuccess(message);
  }, [
    userCurrentHex,
    pendingHexId,
    pendingSuccessMessage,
    state,
    hexName,
    isFirstTravel,
    travelCost.distance,
  ]);

  useEffect(() => {
    return () => {
      clearSuccessTimeout();
    };
  }, []);

  // Handle insufficient tickets state
  if (!isAtLocation && !travelCost.canTravel && travelCost.reason?.includes("Insufficient")) {
    return (
      <div className="space-y-1">
        <Button
          onClick={(e) => {
            e.stopPropagation();
            window.open("/market", "_blank");
          }}
          size="lg"
          variant="outline"
          className="w-full gap-2 font-bold border-destructive/40 bg-destructive/10 hover:bg-destructive/20 transition-all group"
        >
          <div className="flex items-center gap-1.5 flex-1 min-w-0">
            <MapPin className="size-3.5 text-muted-foreground shrink-0" />
            <span className="text-xs truncate">{userCurrentHexName || "Current"}</span>
            <Plane className="size-3.5 text-muted-foreground shrink-0" />
            <span className="text-xs truncate">{hexName}</span>
          </div>
          <div className="flex items-center gap-1 text-destructive shrink-0">
            <Ticket className="size-4" />
            <span className="text-sm font-bold">{travelCost.ticketsNeeded}</span>
          </div>
        </Button>
        <div className="flex items-center justify-center gap-1 text-xs text-destructive py-1">
          <AlertCircle className="size-3 shrink-0" />
          <span>Need {travelCost.ticketsNeeded - userTicketCount} more • </span>
          <button
            onClick={(e) => {
              e.stopPropagation();
              window.open("/market", "_blank");
            }}
            className="inline-flex items-center gap-0.5 hover:text-destructive/80 transition-colors underline underline-offset-2"
          >
            Buy in Market
            <ExternalLink className="size-3" />
          </button>
        </div>
      </div>
    );
  }

  // Success state
  if (state === "success") {
    return (
      <div className="space-y-1">
        <Button
          disabled
          size="lg"
          className="w-full gap-2 font-bold bg-green-600 hover:bg-green-600 animate-in fade-in zoom-in duration-300 transition-all ease-out"
        >
          <CheckCircle2 className="size-4" />
          <span className="text-sm truncate">{successMessage}</span>
        </Button>
      </div>
    );
  }

  // Error state
  if (state === "error") {
    return (
      <div className="space-y-1">
        <Button
          disabled
          size="lg"
          variant="destructive"
          className="w-full gap-2 font-bold animate-in fade-in shake duration-300"
        >
          <AlertCircle className="size-4 animate-pulse" />
          <span className="text-xs truncate flex-1">{errorMessage}</span>
        </Button>
      </div>
    );
  }

  // Traveling state (override "current location" until success finishes)
  if (state === "traveling") {
    return (
      <Button
        disabled
        size="lg"
        variant="default"
        className="w-full gap-1.5 font-bold transition-all animate-pulse cursor-wait"
      >
        <Loader2 className="size-4 animate-spin" />
        <span className="text-sm">Traveling to {hexName}...</span>
      </Button>
    );
  }

  // Already at location
  if (isAtLocation) {
    return (
      <Button
        disabled
        size="lg"
        variant="outline"
        className="w-full gap-2 font-bold border-primary/70 bg-primary/15 text-foreground cursor-not-allowed"
      >
        <MapPin className="size-4 text-red-500" />
        <span className="text-sm font-semibold">Current Location: {hexName}</span>
      </Button>
    );
  }

  // Normal state (idle or insufficient handled above)
  return (
    <Button
      onClick={(e) => {
        e.stopPropagation();
        const message = isFirstTravel
          ? `Welcome to ${hexName}!`
          : `Traveled ${travelCost.distance} hexes to ${hexName}`;
        setPendingHexId(hexId);
        setPendingSuccessMessage(message);
        handleTravel();
      }}
      disabled={false}
      size="lg"
      variant="default"
      className="w-full gap-1.5 font-bold transition-all"
    >
      <div className="flex items-center gap-1.5 flex-1 min-w-0">
        <MapPin className="size-3.5 shrink-0" />
        <span className="text-xs truncate">{userCurrentHexName || (isFirstTravel ? "Starting Point" : "Current")}</span>
        <Plane className="size-3.5 shrink-0" />
        <span className="text-xs truncate font-semibold">{hexName}</span>
      </div>
      {travelCost.ticketsNeeded > 0 ? (
        <div className="flex items-center gap-0.5 shrink-0 text-foreground/80">
          <span className="text-xs">({travelCost.ticketsNeeded}</span>
          <Ticket className="size-3.5" />
          <span className="text-xs">)</span>
        </div>
      ) : (
        <span className="shrink-0 text-[10px] bg-green-600/30 text-green-300 px-1.5 py-0.5 rounded font-bold">
          FREE
        </span>
      )}
    </Button>
  );
}
