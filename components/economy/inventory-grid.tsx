"use client";

import type { InventoryByCategory, WalletDisplay } from "@/lib/types/economy";
import { getCategoryLabel } from "@/lib/economy-config";
import { InventoryItemCard } from "./inventory-item-card";
import { SectionHeading } from "@/components/ui/section-heading";

interface InventoryGridProps {
  inventory: InventoryByCategory[];
  communityId?: string | null;
  wallet?: WalletDisplay | null;
}

export function InventoryGrid({ inventory, communityId, wallet }: InventoryGridProps) {
  if (!inventory || inventory.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center">
        <p className="text-lg font-semibold text-muted-foreground">
          Your inventory is empty
        </p>
        <p className="text-sm text-muted-foreground mt-2">
          Resources and items you collect will appear here
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {inventory.map((category) => (
        <div key={category.category} className="space-y-4">
          <SectionHeading title={getCategoryLabel(category.category)} />

          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
            {category.items.map((item) => (
              <InventoryItemCard
                key={item.id}
                item={item}
                communityId={communityId}
                wallet={wallet}
              />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
