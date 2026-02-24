"use client";

import { useState } from "react";
import { X, Handshake } from "lucide-react";

import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

import { respondToNegotiationAction } from "@/app/actions/revolution";
import { NEGOTIATION_COLOR_SCHEME } from "@/lib/revolution-design-system";
import { cn } from "@/lib/utils";

interface NegotiationModalProps {
  negotiationId: string;
  rebellionId: string;
  isLeader: boolean;
  onClose: () => void;
}

export function NegotiationModal({
  negotiationId,
  rebellionId,
  isLeader,
  onClose,
}: NegotiationModalProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [responded, setResponded] = useState(false);
  const [accepted, setAccepted] = useState(false);

  const handleRespond = async (acceptNegotiation: boolean) => {
    setIsLoading(true);
    try {
      const result = await respondToNegotiationAction(negotiationId, acceptNegotiation);
      if (!result.error) {
        setAccepted(acceptNegotiation);
        setResponded(true);
        setTimeout(() => {
          onClose();
        }, 2000);
      } else {
        alert(result.error);
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog open={true} onOpenChange={onClose}>
      <DialogContent
        className={cn(
          "max-w-sm rounded-xl border-2",
          NEGOTIATION_COLOR_SCHEME.borderMedium,
          NEGOTIATION_COLOR_SCHEME.bgMedium
        )}
      >
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-amber-600 dark:text-amber-400">
            <Handshake className="h-5 w-5" />
            Negotiation Request
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {!responded ? (
            <>
              <div className="rounded-lg bg-amber-500/10 border border-amber-500/30 px-4 py-3">
                <p className="text-sm font-semibold text-foreground mb-2">
                  {isLeader
                    ? "The Governor offers peace..."
                    : "A negotiation is in progress..."}
                </p>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  {isLeader
                    ? "The government proposes to end the conflict. Both sides would reset to neutral morale (50). There will be a 72-hour cooldown before another revolution can be attempted."
                    : "The revolution leader is considering your offer. Await their response."}
                </p>
              </div>

              {isLeader && (
                <div className="flex gap-2">
                  <Button
                    onClick={() => handleRespond(true)}
                    disabled={isLoading}
                    className={cn(
                      "flex-1",
                      NEGOTIATION_COLOR_SCHEME.buttonBg,
                      NEGOTIATION_COLOR_SCHEME.buttonHover,
                      NEGOTIATION_COLOR_SCHEME.buttonText
                    )}
                  >
                    {isLoading ? "Processing..." : "Accept Peace"}
                  </Button>
                  <Button
                    onClick={() => handleRespond(false)}
                    disabled={isLoading}
                    variant="outline"
                    className="flex-1"
                  >
                    {isLoading ? "..." : "Reject & Continue"}
                  </Button>
                </div>
              )}
            </>
          ) : (
            <div
              className={cn(
                "rounded-lg px-4 py-3 text-center",
                accepted
                  ? "bg-green-500/10 border border-green-500/30"
                  : "bg-red-500/10 border border-red-500/30"
              )}
            >
              <p
                className={cn(
                  "text-sm font-semibold",
                  accepted ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400"
                )}
              >
                {accepted
                  ? "✓ Peace Agreed! Both sides reset to neutral morale."
                  : "✗ Negotiation Rejected. Revolution continues!"}
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                {accepted
                  ? "72-hour cooldown activated."
                  : "Battle will determine the outcome."}
              </p>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
