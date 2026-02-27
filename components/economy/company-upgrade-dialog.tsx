"use client";

import * as React from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Loader2, TrendingUp, Coins } from "lucide-react";
import { cn } from "@/lib/utils";

interface CompanyUpgradeDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => Promise<void>;
  level: number;
  goldCost: number;
  companyName: string;
  maxLevel: number;
}

export function CompanyUpgradeDialog({
  isOpen,
  onClose,
  onConfirm,
  level,
  goldCost,
  companyName,
  maxLevel,
}: CompanyUpgradeDialogProps) {
  const [isUpgrading, setIsUpgrading] = React.useState(false);

  const handleConfirm = async () => {
    setIsUpgrading(true);
    try {
      await onConfirm();
      onClose();
    } catch (error) {
      console.error("Upgrade failed:", error);
    } finally {
      setIsUpgrading(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-xl">
            <TrendingUp className="h-5 w-5 text-green-500" />
            Upgrade Company
          </DialogTitle>
          <DialogDescription>
            Are you sure you want to upgrade <span className="font-semibold text-foreground">{companyName}</span> to level {level + 1}?
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Current vs New Level */}
          <div className="flex items-center justify-center gap-4">
            <div className="text-center">
              <div className="text-sm text-muted-foreground">Current</div>
              <div className="text-3xl font-bold">{level}</div>
            </div>
            <div className="text-2xl text-muted-foreground">→</div>
            <div className="text-center">
              <div className="text-sm text-muted-foreground">New</div>
              <div className="text-3xl font-bold text-green-500">{level + 1}</div>
            </div>
          </div>

          {/* Cost */}
          <div className="rounded-lg border-2 border-amber-500/30 bg-amber-500/10 p-4">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">Upgrade Cost</span>
              <div className="flex items-center gap-2">
                <Coins className="h-5 w-5 text-amber-500" />
                <span className="text-lg font-bold text-amber-500">
                  {goldCost.toLocaleString()}
                </span>
              </div>
            </div>
          </div>

          {/* Benefits */}
          <div className="space-y-2 rounded-lg border border-border/40 bg-card/50 p-4">
            <div className="text-sm font-semibold text-foreground">Benefits:</div>
            <ul className="space-y-1 text-sm text-muted-foreground">
              <li className="flex items-center gap-2">
                <span className="text-green-500">✓</span>
                Higher quality resource output
              </li>
              <li className="flex items-center gap-2">
                <span className="text-green-500">✓</span>
                Increased production yield
              </li>
              <li className="flex items-center gap-2">
                <span className="text-green-500">✓</span>
                Better resource quality distribution
              </li>
            </ul>
          </div>

          {level + 1 === maxLevel && (
            <div className="rounded-lg border-2 border-purple-500/30 bg-purple-500/10 p-3 text-center">
              <span className="text-sm font-semibold text-purple-400">
                🏆 This will be your MAX LEVEL!
              </span>
            </div>
          )}
        </div>

        <DialogFooter className="gap-2">
          <Button
            variant="outline"
            onClick={onClose}
            disabled={isUpgrading}
            className="flex-1"
          >
            Cancel
          </Button>
          <Button
            onClick={handleConfirm}
            disabled={isUpgrading}
            className={cn(
              "flex-1 bg-gradient-to-br from-green-600 via-green-700 to-green-800 text-white hover:from-green-500 hover:via-green-600 hover:to-green-700",
              isUpgrading && "opacity-50"
            )}
          >
            {isUpgrading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Upgrading...
              </>
            ) : (
              <>
                <TrendingUp className="mr-2 h-4 w-4" />
                Upgrade
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
