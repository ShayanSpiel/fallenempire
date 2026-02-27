"use client";

import React from "react";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import {
  WeaponQualityIcon,
  getQualityName,
  getWeaponDamageBonusPercent,
  getQualityColor,
  getQualityBgColor,
  getQualityBorderColor,
} from "@/components/ui/weapon-quality-icon";
import { Sword, X } from "lucide-react";

interface WeaponInventoryItem {
  id: string;
  quality_tier: number;
  quantity: number;
}

interface WeaponSelectionSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  weaponInventory: WeaponInventoryItem[];
  selectedWeaponQuality: number | null;
  onSelectWeapon: (weaponId: string, quality: number) => void;
  onClearWeapon: () => void;
}

export function WeaponSelectionSheet({
  open,
  onOpenChange,
  weaponInventory,
  selectedWeaponQuality,
  onSelectWeapon,
  onClearWeapon,
}: WeaponSelectionSheetProps) {
  // Sort weapons by quality tier (lowest to highest)
  const sortedWeapons = [...weaponInventory].sort((a, b) => a.quality_tier - b.quality_tier);

  const handleSelectWeapon = (weapon: WeaponInventoryItem) => {
    onSelectWeapon(weapon.id, weapon.quality_tier);
    onOpenChange(false);
  };

  const handleClearSelection = () => {
    onClearWeapon();
    onOpenChange(false);
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="h-[80vh] overflow-y-auto">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <Sword className="h-5 w-5" />
            Select Weapon
          </SheetTitle>
          <SheetDescription>
            Choose a weapon quality to use in battle. Higher quality weapons provide greater damage bonuses.
            Weapons are consumed after use.
          </SheetDescription>
        </SheetHeader>

        <div className="mt-6 space-y-3">
          {/* Option to fight without weapon */}
          <Card
            className={cn(
              "p-4 cursor-pointer transition-all border-2",
              selectedWeaponQuality === null
                ? "border-primary bg-primary/10"
                : "border-border/60 hover:bg-muted/50"
            )}
            onClick={handleClearSelection}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-muted text-muted-foreground">
                  <X className="h-6 w-6" />
                </div>
                <div>
                  <h4 className="text-sm font-bold text-foreground">No Weapon</h4>
                  <p className="text-xs text-muted-foreground">Fight with base damage</p>
                </div>
              </div>
              <Badge variant="outline" className="gap-1">
                +0% Damage
              </Badge>
            </div>
          </Card>

          {/* Weapon quality options */}
          {sortedWeapons.length === 0 ? (
            <Card className="p-6">
              <div className="flex flex-col items-center justify-center space-y-3">
                <Sword className="h-8 w-8 text-muted-foreground" />
                <p className="text-sm text-muted-foreground text-center">
                  No weapons in inventory. Produce weapons at a Smithy to use them in battle.
                </p>
              </div>
            </Card>
          ) : (
            sortedWeapons.map((weapon) => {
              const isSelected = selectedWeaponQuality === weapon.quality_tier;
              const qualityName = getQualityName(weapon.quality_tier);
              const damageBonus = getWeaponDamageBonusPercent(weapon.quality_tier);
              const colorClass = getQualityColor(weapon.quality_tier);
              const bgColorClass = getQualityBgColor(weapon.quality_tier);
              const borderColorClass = getQualityBorderColor(weapon.quality_tier);

              return (
                <Card
                  key={weapon.id}
                  className={cn(
                    "p-4 cursor-pointer transition-all border-2",
                    isSelected
                      ? `border-current ${colorClass} ${bgColorClass}`
                      : `${borderColorClass} hover:bg-muted/50`
                  )}
                  onClick={() => handleSelectWeapon(weapon)}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div
                        className={cn(
                          "flex h-12 w-12 items-center justify-center rounded-lg",
                          isSelected
                            ? bgColorClass
                            : "bg-muted"
                        )}
                      >
                        <WeaponQualityIcon tier={weapon.quality_tier} size="lg" />
                      </div>
                      <div>
                        <h4 className={cn("text-sm font-bold", isSelected && colorClass)}>
                          {qualityName} Weapon
                        </h4>
                        <p className="text-xs text-muted-foreground">
                          Quality {weapon.quality_tier} · {weapon.quantity} available
                        </p>
                      </div>
                    </div>
                    <Badge
                      variant="outline"
                      className={cn("gap-1 font-bold", isSelected && colorClass)}
                    >
                      {damageBonus} Damage
                    </Badge>
                  </div>
                </Card>
              );
            })
          )}
        </div>

        {/* Action button */}
        <div className="mt-6 flex gap-3">
          <Button
            variant="outline"
            size="lg"
            className="flex-1"
            onClick={() => onOpenChange(false)}
          >
            Cancel
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
