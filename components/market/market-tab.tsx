"use client";

import { useState, useEffect, useMemo } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { getResourceIconComponent } from "@/lib/economy/resource-icons";
import { getMarketListings, purchaseProduct } from "@/app/actions/market";
import { getAllResources, getAllQualities } from "@/app/actions/economy";
import { showErrorToast, showLocationAccessError, showTravelRequiredToast } from "@/lib/toast-utils";
import { TableSkeleton, MarketFiltersSkeleton } from "./market-skeletons";
import { CommunityCoinIcon } from "@/components/ui/coin-icon";
import { getCurrencyDisplayInfo, type CommunityCurrency } from "@/lib/currency-display";
import {
  MARKET_RESOURCE_TYPES,
  QUALITY_LEVELS,
  MARKET_DEFAULTS,
  PRODUCT_TABLE_COLUMNS,
  MARKET_TABLE_CONFIG,
  MARKET_FILTER_CONFIG,
} from "./market-config";
import type { BaseTabProps, Resource, Quality, MarketListing } from "./types";

interface MarketTabProps extends BaseTabProps {
  communityCurrencies: CommunityCurrency[];
}

export function MarketTab({ selectedCommunities, communityCurrencies }: MarketTabProps) {
  const [selectedResources, setSelectedResources] = useState<string[]>([]);
  const [selectedQuality, setSelectedQuality] = useState<number>(0); // 0 = all, 1-5 = specific
  const [hoverQuality, setHoverQuality] = useState<number>(0);
  const [listings, setListings] = useState<MarketListing[]>([]);
  const [resources, setResources] = useState<Resource[]>([]);
  const [qualities, setQualities] = useState<Quality[]>([]);
  const [loading, setLoading] = useState(true);
  const [purchaseQuantities, setPurchaseQuantities] = useState<Record<string, number>>({});
  const [purchasing, setPurchasing] = useState<Record<string, boolean>>({});
  const metadataReady = resources.length > 0 && qualities.length > 0;

  const resourceIds = useMemo(
    () =>
      selectedResources.length > 0
        ? resources.filter((r) => selectedResources.includes(r.key)).map((r) => r.id)
        : undefined,
    [selectedResources, resources]
  );

  const qualityIds = useMemo(
    () =>
      selectedQuality > 0
        ? qualities.filter((q) => q.quality_level === selectedQuality).map((q) => q.id)
        : undefined,
    [selectedQuality, qualities]
  );

  // Load resources and qualities on mount
  useEffect(() => {
    const loadMetadata = async () => {
      try {
        const [resourcesData, qualitiesData] = await Promise.all([
          getAllResources(),
          getAllQualities(),
        ]);
        setResources(resourcesData);
        setQualities(qualitiesData);
      } catch (error) {
        console.error("Error loading metadata:", error);
        toast.error("Failed to load resources");
      }
    };
    loadMetadata();
  }, []);

  // Load listings when filters change
  useEffect(() => {
    if (!metadataReady) return;

    const loadListings = async () => {
      setLoading(true);
      try {
        const data = await getMarketListings({
          communityIds: selectedCommunities.length > 0 ? selectedCommunities : undefined,
          resourceIds,
          qualityIds,
        });

        setListings(data);
      } catch (error) {
        console.error("Error loading listings:", error);
        toast.error("Failed to load market listings");
      } finally {
        setLoading(false);
      }
    };

    loadListings();
  }, [metadataReady, selectedCommunities, resourceIds, qualityIds]);

  const toggleResource = (key: string) => {
    setSelectedResources((prev) =>
      prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]
    );
  };

  const renderQualityStar = (level: number) => {
    const isFilled = (hoverQuality || selectedQuality) >= level;
    return (
      <button
        type="button"
        onClick={() => setSelectedQuality(selectedQuality === level ? 0 : level)}
        onMouseEnter={() => setHoverQuality(level)}
        onMouseLeave={() => setHoverQuality(0)}
        className="transition-colors"
        aria-label={`Filter by quality level ${level}`}
      >
        <svg
          className={cn(
            "h-5 w-5",
            isFilled ? "fill-current text-warning" : "fill-none text-muted-foreground"
          )}
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth="2"
        >
          <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
        </svg>
      </button>
    );
  };

  const handlePurchase = async (listingId: string, maxQuantity: number) => {
    const quantity = purchaseQuantities[listingId] || MARKET_DEFAULTS.purchaseQuantity;

    if (quantity <= 0 || quantity > maxQuantity) {
      toast.error(`Invalid quantity. Max: ${maxQuantity}`);
      return;
    }

    setPurchasing((prev) => ({ ...prev, [listingId]: true }));
    try {
      const result = await purchaseProduct({ listingId, quantity });

      if (result.success) {
        toast.success(
          `Purchased ${quantity} item(s) for ${result.community_coin_paid || 0} community coins${
            result.tariff_paid ? ` (+ ${result.tariff_paid} tariff)` : ""
          }`
        );

        // Reload listings
        const data = await getMarketListings({
          communityIds: selectedCommunities.length > 0 ? selectedCommunities : undefined,
          resourceIds,
          qualityIds,
        });
        setListings(data);
        setPurchaseQuantities((prev) => ({ ...prev, [listingId]: MARKET_DEFAULTS.purchaseQuantity }));
      } else {
        // Check if it's a location error
        const errorMessage = result.error || "";
        const isLocationError = errorMessage.toLowerCase().includes("travel to this community");

        if (isLocationError) {
          // Find the listing to get community name
          const listing = listings.find(l => l.id === listingId);
          if (listing && listing.community_name) {
            showLocationAccessError({
              communityName: listing.community_name,
              action: "purchase",
            });
          } else {
            showTravelRequiredToast({
              description: errorMessage,
            });
          }
        } else {
          showErrorToast("Purchase failed", {
            description: errorMessage,
          });
        }
      }
    } catch (error) {
      showErrorToast("Purchase failed", {
        description: "Failed to complete purchase",
      });
    } finally {
      setPurchasing((prev) => ({ ...prev, [listingId]: false }));
    }
  };

  const resourceTypes = useMemo(
    () => resources.filter((r) => MARKET_RESOURCE_TYPES.includes(r.key as any)),
    [resources]
  );
  const resourceIconByKey = useMemo(
    () => new Map(resources.map((resource) => [resource.key, resource.icon_name ?? null])),
    [resources]
  );
  const currencyLookup = useMemo(
    () => new Map(communityCurrencies.map((c) => [c.community_id, c])),
    [communityCurrencies]
  );

  const renderQualityStars = (stars: number) => {
    return (
      <div className="flex items-center gap-0.5">
        {Array.from({ length: 5 }, (_, i) => (
          <svg
            key={i}
            className={cn(
              "h-3.5 w-3.5",
              i < stars ? "fill-current text-warning" : "fill-none text-muted-foreground"
            )}
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth="2"
          >
            <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
          </svg>
        ))}
      </div>
    );
  };

  return (
    <div className="space-y-6">
      {/* Filters */}
      {metadataReady ? (
        <div className={MARKET_FILTER_CONFIG.container}>
          {/* Resource Type Filters */}
          <div className="space-y-2">
            <label className={MARKET_FILTER_CONFIG.label}>
              Product Type
            </label>
            <div className={MARKET_FILTER_CONFIG.buttonGroup}>
              {resourceTypes.map((resource) => {
                const Icon = getResourceIconComponent(resource.icon_name);
                const isSelected = selectedResources.includes(resource.key);
                return (
                  <Button
                    key={resource.key}
                    type="button"
                    size="sm"
                    variant={isSelected ? "default" : "outline"}
                    onClick={() => toggleResource(resource.key)}
                    className="gap-2"
                  >
                    <Icon className="h-4 w-4" />
                    {resource.name}
                  </Button>
                );
              })}
            </div>
          </div>

          {/* Quality Filter */}
          <div className="space-y-2">
            <label className={MARKET_FILTER_CONFIG.label}>
              Quality
            </label>
            <div className="flex items-center gap-1">
              {QUALITY_LEVELS.map((level) => (
                <div key={level}>{renderQualityStar(level)}</div>
              ))}
              {selectedQuality > 0 && (
                <button
                  type="button"
                  onClick={() => setSelectedQuality(0)}
                  className="ml-2 text-xs text-muted-foreground hover:text-foreground"
                >
                  Clear
                </button>
              )}
            </div>
          </div>
        </div>
      ) : (
        <MarketFiltersSkeleton />
      )}

      {/* Listings Table */}
      <div className="space-y-2">
        {loading ? (
          <TableSkeleton rows={6} />
        ) : listings.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-sm text-muted-foreground">No listings available in this market.</p>
          </div>
        ) : (
          <div className={MARKET_TABLE_CONFIG.container}>
            <div className="overflow-x-auto">
              <table className="w-full table-fixed">
                <colgroup>
                  <col style={{ width: PRODUCT_TABLE_COLUMNS.item.width }} />
                  <col style={{ width: PRODUCT_TABLE_COLUMNS.seller.width }} />
                  <col style={{ width: PRODUCT_TABLE_COLUMNS.quality.width }} />
                  <col style={{ width: PRODUCT_TABLE_COLUMNS.supply.width }} />
                  <col style={{ width: PRODUCT_TABLE_COLUMNS.price.width }} />
                  <col style={{ width: PRODUCT_TABLE_COLUMNS.location.width }} />
                  <col style={{ width: PRODUCT_TABLE_COLUMNS.action.width }} />
                </colgroup>
                <thead className={MARKET_TABLE_CONFIG.headerRow}>
                  <tr className={MARKET_TABLE_CONFIG.headerCell}>
                    <th className={`px-4 py-3 text-${PRODUCT_TABLE_COLUMNS.item.align}`}>Item</th>
                    <th className={`px-4 py-3 text-${PRODUCT_TABLE_COLUMNS.seller.align}`}>Seller</th>
                    <th className={`px-4 py-3 text-${PRODUCT_TABLE_COLUMNS.quality.align}`}>Quality</th>
                    <th className={`px-4 py-3 text-${PRODUCT_TABLE_COLUMNS.supply.align}`}>Supply</th>
                    <th className={`px-4 py-3 text-${PRODUCT_TABLE_COLUMNS.price.align}`}>Price</th>
                    <th className={`px-4 py-3 text-${PRODUCT_TABLE_COLUMNS.location.align}`}>Location</th>
                    <th className={`px-4 py-3 text-${PRODUCT_TABLE_COLUMNS.action.align}`}>Action</th>
                  </tr>
                </thead>
                <tbody className={MARKET_TABLE_CONFIG.divider}>
                  {listings.map((listing) => {
                    const iconName = resourceIconByKey.get(listing.resource_key || "") ?? null;
                    const Icon = getResourceIconComponent(iconName);
                    const quantity = purchaseQuantities[listing.id] || MARKET_DEFAULTS.purchaseQuantity;
                    const totalPrice = (listing.price_per_unit_community_coin || 0) * quantity;
                    const currency = currencyLookup.get(listing.community_id);
                    const currencyInfo = getCurrencyDisplayInfo(currency || null);

                    return (
                      <tr key={listing.id} className={MARKET_TABLE_CONFIG.bodyRow}>
                        <td className="px-4 py-3">
                          <div className="flex items-center justify-center gap-2.5">
                            <div className="h-8 w-8 rounded-lg bg-muted/50 flex items-center justify-center shrink-0">
                              <Icon className="h-5 w-5 text-foreground" />
                            </div>
                            <span className="text-sm font-medium text-foreground truncate">
                              {listing.resource_name}
                            </span>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-center">
                          <span className="text-sm text-foreground truncate block">{listing.seller_username}</span>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center justify-center">
                            {listing.quality_stars && renderQualityStars(listing.quality_stars)}
                          </div>
                        </td>
                        <td className="px-4 py-3 text-center">
                          <span className="text-sm font-medium text-foreground tabular-nums">
                            {listing.quantity?.toFixed(0)}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center justify-center gap-1">
                            <span className="text-sm font-semibold text-foreground tabular-nums">
                              {listing.price_per_unit_community_coin?.toFixed(2)}
                            </span>
                            <CommunityCoinIcon className="h-4 w-4" color={currencyInfo.color} />
                            <span className="text-xs font-medium text-muted-foreground">
                              {currencyInfo.symbol}
                            </span>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-center">
                          <a
                            href="/map"
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-sm text-primary hover:underline truncate block"
                          >
                            {listing.community_name}
                          </a>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center justify-center gap-2">
                            <Input
                              type="number"
                              min="1"
                              max={listing.quantity || 1}
                              value={quantity}
                              onChange={(e) =>
                                setPurchaseQuantities((prev) => ({
                                  ...prev,
                                  [listing.id]: Math.max(1, parseInt(e.target.value) || 1),
                                }))
                              }
                              className="w-16 h-8 text-center text-sm tabular-nums"
                              aria-label="Purchase quantity"
                            />
                            <Button
                              size="sm"
                              onClick={() => handlePurchase(listing.id, listing.quantity || 1)}
                              disabled={purchasing[listing.id]}
                              className="h-8 px-3"
                            >
                              {purchasing[listing.id] ? "..." : "Buy"}
                            </Button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
