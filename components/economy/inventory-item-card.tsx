"use client";

import { useState } from "react";
import { Star, DollarSign } from "lucide-react";
import type { InventoryItem } from "@/lib/types/economy";
import { getQualityStars } from "@/lib/economy-config";
import { getResourceIconComponent } from "@/lib/economy/resource-icons";
import { cn } from "@/lib/utils";
import { getBreadIcon } from "@/components/ui/food-quality-icon";
import { getWeaponIcon } from "@/components/ui/weapon-quality-icon";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { createProductListing } from "@/app/actions/market";

interface InventoryItemCardProps {
  item: InventoryItem;
  communityId?: string | null;
}

export function InventoryItemCard({ item, communityId }: InventoryItemCardProps) {
  const stars = getQualityStars(item.quality_level);
  const isEmpty = item.quantity === 0;
  const isLow = item.quantity > 0 && item.quantity < 5;
  const Icon = getResourceIconComponent(item.resource_icon);
  const [showSellDialog, setShowSellDialog] = useState(false);
  const [sellQuantity, setSellQuantity] = useState(1);
  const [sellPriceGold, setSellPriceGold] = useState(10);
  const [creating, setCreating] = useState(false);

  const handleSell = async () => {
    if (!communityId) {
      toast.error("You must join a community to sell items");
      return;
    }

    if (sellQuantity <= 0 || sellQuantity > item.quantity) {
      toast.error(`Invalid quantity. Max: ${item.quantity}`);
      return;
    }

    setCreating(true);
    try {
      const result = await createProductListing({
        communityId,
        resourceId: item.resource_id,
        qualityId: item.quality_id,
        quantity: sellQuantity,
        pricePerUnitGold: sellPriceGold,
      });

      if (result.success) {
        toast.success("Listing created successfully");
        setShowSellDialog(false);
        setSellQuantity(1);
        setSellPriceGold(10);
        // Reload page to update inventory
        window.location.reload();
      } else {
        toast.error(result.error || "Failed to create listing");
      }
    } catch (error) {
      console.error("Error creating listing:", error);
      toast.error("Failed to create listing");
    } finally {
      setCreating(false);
    }
  };

  return (
    <>
      <div
        className={cn(
          "relative flex flex-col items-center p-3 rounded-lg border transition-colors group cursor-pointer",
          isEmpty
            ? "border-border/40 bg-muted/20 opacity-50"
            : "border-border bg-card hover:bg-accent/50"
        )}
        onClick={() => !isEmpty && setShowSellDialog(true)}
      >
      {/* Square icon */}
      <div
        className={cn(
          "relative w-16 h-16 mb-2 rounded-lg flex items-center justify-center",
          isEmpty ? "bg-muted/50 text-muted-foreground/30" : "bg-muted text-foreground/70"
        )}
      >
        {item.resource_key === "food" ? (
          <span className="text-3xl">{getBreadIcon(item.quality_level)}</span>
        ) : item.resource_key === "weapon" ? (
          <span className="text-3xl">{getWeaponIcon(item.quality_level)}</span>
        ) : (
          <Icon className="h-8 w-8" />
        )}

        {/* Quantity badge */}
        {!isEmpty && (
          <div
            className={cn(
              "absolute -top-1 -right-1 min-w-[1.5rem] h-6 px-1.5 rounded-md text-xs font-bold flex items-center justify-center",
              isLow
                ? "bg-warning/20 text-warning border border-warning/30"
                : "bg-primary text-primary-foreground"
            )}
          >
            {item.quantity >= 1000
              ? `${(item.quantity / 1000).toFixed(1)}k`
              : item.quantity.toFixed(0)}
          </div>
        )}
        {isEmpty && (
          <div className="absolute -top-1 -right-1 min-w-[1.5rem] h-6 px-1.5 rounded-md bg-muted border border-border/40 text-xs font-bold flex items-center justify-center text-muted-foreground/50">
            0
          </div>
        )}
      </div>

      {/* Item name */}
      <p
        className={cn(
          "text-sm font-semibold text-center line-clamp-1 w-full",
          isEmpty ? "text-muted-foreground/50" : "text-foreground"
        )}
      >
        {item.resource_name}
      </p>

      {/* Quality stars */}
      <div className="flex items-center gap-0.5 mt-1">
        {[...Array(stars.filled)].map((_, i) => (
          <Star
            key={`filled-${i}`}
            className={cn(
              "w-3 h-3",
              isEmpty ? "text-muted-foreground/40" : "text-warning"
            )}
            fill={isEmpty ? "none" : "currentColor"}
          />
        ))}
        {[...Array(stars.empty)].map((_, i) => (
          <Star
            key={`empty-${i}`}
            className="w-3 h-3 text-muted-foreground/40"
            fill="none"
          />
        ))}
      </div>

      {/* Quality name */}
      <p
        className={cn(
          "text-xs font-medium mt-0.5",
          isEmpty && "text-muted-foreground/40"
        )}
        style={{ color: isEmpty ? undefined : item.quality_color }}
      >
        {item.quality_name}
      </p>

      {/* Sell button (visible on hover) */}
      {!isEmpty && (
        <div className="absolute bottom-2 left-0 right-0 flex justify-center opacity-0 group-hover:opacity-100 transition-opacity">
          <Button
            size="sm"
            variant="outline"
            className="gap-1 h-7 text-xs"
            onClick={(e) => {
              e.stopPropagation();
              setShowSellDialog(true);
            }}
          >
            <DollarSign className="h-3 w-3" />
            Sell
          </Button>
        </div>
      )}
    </div>

      {/* Sell Dialog */}
      <Dialog open={showSellDialog} onOpenChange={setShowSellDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create Market Listing</DialogTitle>
            <DialogDescription>
              List {item.resource_name} ({item.quality_name}) for sale
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                Quantity (Max: {item.quantity})
              </label>
              <input
                type="number"
                min="1"
                max={item.quantity}
                value={sellQuantity}
                onChange={(e) => setSellQuantity(parseInt(e.target.value) || 1)}
                className="w-full px-3 py-2 text-sm border border-border/60 rounded-lg bg-card text-foreground"
              />
            </div>

            <div className="space-y-2">
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                Price Per Unit (Gold)
              </label>
              <input
                type="number"
                min="0.01"
                step="0.01"
                value={sellPriceGold}
                onChange={(e) => setSellPriceGold(parseFloat(e.target.value) || 0)}
                className="w-full px-3 py-2 text-sm border border-border/60 rounded-lg bg-card text-foreground"
              />
            </div>

            <div className="rounded-lg border border-border/60 bg-card/50 p-4">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Total Earnings:</span>
                <span className="font-bold text-foreground">
                  {(sellQuantity * sellPriceGold).toFixed(2)} Gold
                </span>
              </div>
            </div>
          </div>

          <div className="flex gap-2">
            <Button onClick={handleSell} disabled={creating} className="flex-1">
              {creating ? "Creating..." : "Create Listing"}
            </Button>
            <Button variant="outline" onClick={() => setShowSellDialog(false)}>
              Cancel
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
