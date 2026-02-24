"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Navigation, Ticket, Loader2 } from "lucide-react";
import { calculateTravelCost } from "@/lib/travel";
import { cn } from "@/lib/utils";

interface TravelButtonProps {
  hexId: string;
  hexName: string;
  userCurrentHex: string | null;
  userTicketCount: number;
  onTravel: (hexId: string) => Promise<void>;
  className?: string;
}

export function TravelButton({
  hexId,
  hexName,
  userCurrentHex,
  userTicketCount,
  onTravel,
  className,
}: TravelButtonProps) {
  const [isTraveling, setIsTraveling] = useState(false);

  const travelCost = calculateTravelCost(userCurrentHex, hexId, userTicketCount);
  const isAtLocation = userCurrentHex === hexId;

  const handleTravel = async () => {
    if (!travelCost.canTravel) return;

    setIsTraveling(true);
    try {
      await onTravel(hexId);
    } catch (error) {
      console.error("Travel error:", error);
    } finally {
      setIsTraveling(false);
    }
  };

  // If user is already at this location, show current location indicator
  if (isAtLocation) {
    return (
      <Card
        variant="default"
        className={cn(
          "rounded-xl border border-primary/30 bg-primary/5 overflow-hidden",
          className
        )}
      >
        <div className="p-4 flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10">
            <Navigation className="h-5 w-5 text-primary" />
          </div>
          <div className="flex-1">
            <p className="text-sm font-bold text-foreground">Current Location</p>
            <p className="text-xs text-muted-foreground">
              You are currently at {hexName}
            </p>
          </div>
        </div>
      </Card>
    );
  }

  return (
    <Card
      variant="default"
      className={cn(
        "rounded-xl border border-border/70 bg-card overflow-hidden transition-all duration-300",
        className
      )}
    >
      <div className="flex items-center justify-between border-b border-border/60 px-4 py-3 bg-muted/30">
        <h3 className="text-sm font-bold flex items-center gap-2 text-foreground">
          <Navigation size={16} />
          Travel
        </h3>
      </div>
      <div className="p-4 space-y-4">
        <div className="space-y-2">
          <p className="text-sm text-muted-foreground leading-relaxed">
            Travel to {hexName} and explore this region.
          </p>
          {travelCost.distance > 0 && (
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <span>Distance: {travelCost.distance} hexes</span>
              <span className="text-border">•</span>
              <span className="flex items-center gap-1">
                <Ticket className="h-3 w-3" />
                Cost: {travelCost.ticketsNeeded} {travelCost.ticketsNeeded === 1 ? 'ticket' : 'tickets'}
              </span>
            </div>
          )}
          {!userCurrentHex && (
            <p className="text-xs text-primary">First-time travel is free!</p>
          )}
        </div>

        {!travelCost.canTravel && travelCost.reason && (
          <p className="text-xs text-destructive">{travelCost.reason}</p>
        )}

        <Button
          onClick={handleTravel}
          disabled={!travelCost.canTravel || isTraveling}
          size="lg"
          variant="secondary"
          className="w-full gap-2 font-bold transition-all"
        >
          {isTraveling ? (
            <>
              <Loader2 className="size-4 animate-spin" />
              Traveling...
            </>
          ) : (
            <>
              <Navigation className="size-4" />
              {travelCost.ticketsNeeded === 0 ? 'Set Starting Location' : 'Travel Here'}
            </>
          )}
        </Button>

        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span>Your tickets:</span>
          <span className="flex items-center gap-1 font-bold text-foreground">
            <Ticket className="h-3 w-3" />
            {userTicketCount}
          </span>
        </div>
      </div>
    </Card>
  );
}
