"use client";

import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { ArrowUpDown, MapPin, Plane, ChevronDown, X, ChevronLeft, ChevronRight } from "lucide-react";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { GoldCoinIcon, CommunityCoinIcon } from "@/components/ui/coin-icon";
import { RegionName } from "@/components/ui/region-name";
import { resolveAvatar } from "@/lib/avatar";
import { cn } from "@/lib/utils";
import { EXCHANGE_CONFIG } from "./market-config";

import {
  createExchangeOrder,
  acceptExchangeOrder,
  getOrderBook,
  getIndividualOrders,
  cancelExchangeOrder,
} from "@/app/actions/market";
import type {
  OrderBookData,
  OrderBookIndividual,
  SourceAccount,
} from "@/lib/types/economy";

interface CurrencyExchangeP2PProps {
  data: {
    userId: string;
    userGold: number;
    userHex: string | null;
    userHexCustomName: string | null;
    userHexOwnerCommunityId: string | null;
    userMainCommunityId: string | null;
    userCommunityRole: string | null;
    communityCurrencies: Array<{
      currencyId: string;
      currencyName: string;
      currencySymbol: string;
      exchangeRate: number;
      amount: number;
      communityColor: string | null;
      communityId: string;
    }>;
  };
  selectedCommunities: string[];
}

// Pre-loaded order data for a price level
interface PriceLevelOrders {
  level: any;
  orders: OrderBookIndividual[];
  loading: boolean;
}

export function CurrencyExchangeP2P({ data, selectedCommunities }: CurrencyExchangeP2PProps) {
  const [orderBook, setOrderBook] = useState<OrderBookData | null>(null);
  const [selectedOrder, setSelectedOrder] = useState<OrderBookIndividual | null>(null);
  const [tradingAsset, setTradingAsset] = useState<"gold" | "currency">("gold");
  const [sourceAccount, setSourceAccount] = useState<SourceAccount>(() => {
    // Initialize from localStorage if available
    if (typeof window !== 'undefined') {
      const stored = localStorage.getItem('exchange-source-account');
      return (stored === 'treasury' || stored === 'personal') ? stored : 'personal';
    }
    return 'personal';
  });
  const [loading, setLoading] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);
  const [offerAmount, setOfferAmount] = useState("");
  const [wantAmount, setWantAmount] = useState("");
  const [isBuying, setIsBuying] = useState(false);
  const [isSelling, setIsSelling] = useState(false);
  const [priceLevelOrders, setPriceLevelOrders] = useState<Map<number, PriceLevelOrders>>(new Map());
  const [allCurrencies, setAllCurrencies] = useState(data.communityCurrencies);
  const [selectedCommunityRole, setSelectedCommunityRole] = useState<string | null>(data.userCommunityRole);
  const [communityTreasuryBalance, setCommunityTreasuryBalance] = useState<number>(0);
  const [currentPage, setCurrentPage] = useState(1);
  const lastFetchedCommunityId = useRef<string | null>(null);

  // IMPORTANT: Use selectedCommunities[0] directly, not state (avoids stale closure)
  const targetCommunityId = selectedCommunities?.[0];

  // Auto-fetch ALL community currencies on mount to support viewing any community's market
  useEffect(() => {
    const loadAllCurrencies = async () => {
      try {
        const { getCommunityCurrencies } = await import("@/app/actions/market");
        const allCurrs = await getCommunityCurrencies();
        if (allCurrs) {
          setAllCurrencies(allCurrs);
        }
      } catch (error) {
        console.warn("Could not load all currencies, using pre-loaded data", error);
      } finally {
        setInitialLoading(false);
      }
    };
    loadAllCurrencies();
  }, []);

  // PURE: Compute selected currency - strict logic, no fallbacks
  const selectedCurrency = useMemo(() => {
    // Only show currency for the explicitly selected community
    if (targetCommunityId && allCurrencies) {
      return allCurrencies.find(c => c.communityId === targetCommunityId) || null;
    }
    // No community selected = no currency (empty state)
    return null;
  }, [targetCommunityId, allCurrencies]);

  // Check if user is in the selected currency's community location
  const isInCommunityLocation = useMemo(() => {
    if (!selectedCurrency || !data.userHex) {
      console.log("[Location Check] Missing data - selectedCurrency:", !!selectedCurrency, "userHex:", !!data.userHex);
      return false;
    }
    const inLocation = selectedCurrency.communityId === data.userHexOwnerCommunityId;
    console.log("[Location Check] Community:", selectedCurrency.currencyName,
      "| Your Hex Owner:", data.userHexOwnerCommunityId,
      "| Selected Community:", selectedCurrency.communityId,
      "| In Location:", inLocation);
    return inLocation;
  }, [selectedCurrency?.communityId, data.userHexOwnerCommunityId, data.userHex]);

  // Fetch user's role in the selected community (for r0 treasury toggle)
  useEffect(() => {
    // Only fetch if community ID actually changed
    if (lastFetchedCommunityId.current === targetCommunityId) {
      return;
    }

    const fetchCommunityRole = async () => {
      console.log("[ExchangeComponent] Fetching r0 role for community:", targetCommunityId);

      if (!targetCommunityId) {
        console.log("[ExchangeComponent] No targetCommunityId, clearing role");
        setSelectedCommunityRole(null);
        lastFetchedCommunityId.current = null;
        return;
      }

      try {
        const { getUserCommunityRole } = await import("@/app/actions/community");
        console.log("[ExchangeComponent] Calling getUserCommunityRole for:", targetCommunityId);
        const role = await getUserCommunityRole(targetCommunityId);
        console.log("[ExchangeComponent] Got role:", role, "| isR0:", role === "r0");
        setSelectedCommunityRole(role);
        lastFetchedCommunityId.current = targetCommunityId;
      } catch (error) {
        console.warn("[ExchangeComponent] Could not fetch community role:", error);
        setSelectedCommunityRole(null);
      }
    };

    fetchCommunityRole();
  }, [targetCommunityId]);

  // Fetch community treasury balance when selected currency changes
  useEffect(() => {
    const fetchTreasuryBalance = async () => {
      if (!selectedCurrency) {
        setCommunityTreasuryBalance(0);
        return;
      }

      try {
        const { getCommunityTreasuryBalance } = await import("@/app/actions/market");
        const balance = await getCommunityTreasuryBalance(selectedCurrency.communityId);
        console.log("[ExchangeComponent] Community treasury balance for", selectedCurrency.currencyName, ":", balance);
        setCommunityTreasuryBalance(balance);
      } catch (error) {
        console.warn("[ExchangeComponent] Could not fetch treasury balance:", error);
        setCommunityTreasuryBalance(0);
      }
    };

    fetchTreasuryBalance();
  }, [selectedCurrency?.communityId]);

  // Auto-fill from selected order
  useEffect(() => {
    if (selectedOrder) {
      if (tradingAsset === "gold") {
        setOfferAmount(selectedOrder.remaining_gold_amount.toFixed(2));
        setWantAmount(selectedOrder.remaining_currency_amount.toFixed(2));
      } else {
        setOfferAmount(selectedOrder.remaining_currency_amount.toFixed(2));
        setWantAmount(selectedOrder.remaining_gold_amount.toFixed(2));
      }
    } else {
      setOfferAmount("");
      setWantAmount("");
    }
  }, [selectedOrder, tradingAsset]);

  const fetchOrderBook = useCallback(async (currency: typeof selectedCurrency, asset: typeof tradingAsset) => {
    if (!currency) return;

    setLoading(true);
    setPriceLevelOrders(new Map());
    try {
      const book = await getOrderBook({ communityCurrencyId: currency.currencyId });
      setOrderBook(book);

      // Load ALL individual orders for ALL price levels upfront
      const relevantOffers = asset === "gold" ? book.sells || [] : book.buys || [];
      const limitedOffers = relevantOffers.slice(0, EXCHANGE_CONFIG.offers.maxLevels);

      // Load all in parallel
      const ordersPromises = limitedOffers.map(async (level) => {
        const orders = await getIndividualOrders({
          communityCurrencyId: currency.currencyId,
          exchangeRate: level.exchange_rate,
          orderType: asset === "gold" ? "sell" : "buy",
        });
        return { level, orders };
      });

      const allOrders = await Promise.all(ordersPromises);

      // Store in map
      const ordersMap = new Map<number, PriceLevelOrders>();
      allOrders.forEach(({ level, orders }) => {
        ordersMap.set(level.exchange_rate, {
          level,
          orders,
          loading: false,
        });
      });

      setPriceLevelOrders(ordersMap);
    } catch (error) {
      console.error("Error fetching order book:", error);
      toast.error("Failed to load order book");
    } finally {
      setLoading(false);
    }
  }, []);


  // Persist source account selection to localStorage
  useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('exchange-source-account', sourceAccount);
    }
  }, [sourceAccount]);

  // Fetch order book when selected currency changes (not just when trading asset changes)
  useEffect(() => {
    if (!selectedCurrency) return;

    // Clear state when currency changes
    setSelectedOrder(null);
    setOfferAmount("");
    setWantAmount("");
    setCurrentPage(1);

    // Fetch new order book for this currency
    fetchOrderBook(selectedCurrency, tradingAsset);
  }, [selectedCurrency?.currencyId, selectedCurrency?.communityId, tradingAsset, fetchOrderBook]);

  const handleFlip = () => {
    setTradingAsset(tradingAsset === "gold" ? "currency" : "gold");
    const temp = offerAmount;
    setOfferAmount(wantAmount);
    setWantAmount(temp);
  };

  const handleBuy = async () => {
    if (!selectedOrder || !selectedCurrency) {
      toast.error("Please select an offer");
      return;
    }

    const offer = parseFloat(offerAmount);
    const want = parseFloat(wantAmount);

    if (isNaN(offer) || offer <= 0) {
      toast.error("Please enter a valid amount");
      return;
    }

    if (tradingAsset === "gold") {
      if (offer > data.userGold) {
        toast.error("Insufficient gold balance");
        return;
      }
    } else {
      if (offer > selectedCurrency.amount) {
        toast.error(`Insufficient ${selectedCurrency.currencySymbol} balance`);
        return;
      }
    }

    setIsBuying(true);
    try {
      const goldAmountInTrade = tradingAsset === "gold" ? offer : want;

      const result = await acceptExchangeOrder({
        orderId: selectedOrder.order_id,
        goldAmount: parseFloat(goldAmountInTrade.toFixed(2)),
      });

      if (result.success) {
        const boughtAsset = tradingAsset === "gold" ? selectedCurrency.currencySymbol : "Gold";
        const boughtAmount = tradingAsset === "gold" ? want : offer;
        toast.success(`Bought ${boughtAmount.toFixed(2)} ${boughtAsset}!`);
        setOfferAmount("");
        setWantAmount("");
        setSelectedOrder(null);
        await fetchOrderBook(selectedCurrency, tradingAsset);
      } else {
        toast.error(result.message || "Failed to accept offer");
      }
    } catch (error) {
      console.error("Buy error:", error);
      toast.error("Failed to accept offer");
    } finally {
      setIsBuying(false);
    }
  };

  const handleSell = async () => {
    if (!selectedCurrency) return;

    const offer = parseFloat(offerAmount);
    const want = parseFloat(wantAmount);

    if (isNaN(offer) || offer <= 0 || isNaN(want) || want <= 0) {
      toast.error("Please enter valid amounts");
      return;
    }

    if (tradingAsset === "gold") {
      if (offer > data.userGold) {
        toast.error("Insufficient gold balance");
        return;
      }
    } else {
      if (offer > selectedCurrency.amount) {
        toast.error(`Insufficient ${selectedCurrency.currencySymbol} balance`);
        return;
      }
    }

    const relevantOffers = tradingAsset === "gold" ? orderBook?.sells || [] : orderBook?.buys || [];

    // Auto-match best offer if no order selected
    if (!selectedOrder && relevantOffers.length > 0) {
      const bestOffer = relevantOffers[0];
      const goldAmountNeeded = tradingAsset === "gold" ? offer : want;
      const levelData = priceLevelOrders.get(bestOffer.exchange_rate);

      if (levelData && levelData.orders.length > 0) {
        setIsBuying(true);
        try {
          const result = await acceptExchangeOrder({
            orderId: levelData.orders[0].order_id,
            goldAmount: parseFloat(goldAmountNeeded.toFixed(2)),
          });

          if (result.success) {
            const boughtAsset = tradingAsset === "gold" ? selectedCurrency.currencySymbol : "Gold";
            const boughtAmount = tradingAsset === "gold" ? want : offer;
            toast.success(`Bought ${boughtAmount.toFixed(2)} ${boughtAsset} from best offer!`);
            setOfferAmount("");
            setWantAmount("");
            await fetchOrderBook(selectedCurrency, tradingAsset);
            setIsBuying(false);
            setIsSelling(false);
            return;
          }
        } catch (error) {
          console.error("Auto-match error:", error);
        }
        setIsBuying(false);
      }
    }

    // Post new order if no match or match failed
    setIsSelling(true);
    try {
      const exchangeRate = want / offer;
      const goldAmount = tradingAsset === "gold" ? offer : want;
      const currencyAmount = tradingAsset === "gold" ? want : offer;

      const result = await createExchangeOrder({
        communityCurrencyId: selectedCurrency.currencyId,
        orderType: tradingAsset === "gold" ? "buy" : "sell",
        goldAmount: parseFloat(goldAmount.toFixed(2)),
        currencyAmount: parseFloat(currencyAmount.toFixed(2)),
        sourceAccount,
      });

      if (result.success) {
        toast.success(
          `Posted new offer: ${offer} ${tradingAsset === "gold" ? "Gold" : selectedCurrency.currencySymbol} @ ${exchangeRate.toFixed(4)}`
        );
        setOfferAmount("");
        setWantAmount("");
        await fetchOrderBook(selectedCurrency, tradingAsset);
      } else {
        toast.error(result.message || "Failed to post offer");
      }
    } catch (error) {
      console.error("Sell error:", error);
      toast.error("Failed to post offer");
    } finally {
      setIsSelling(false);
    }
  };

  // Show skeleton while loading initial data
  if (initialLoading) {
    return (
      <div className={EXCHANGE_CONFIG.container.grid}>
        <Card className={cn(EXCHANGE_CONFIG.card.className, EXCHANGE_CONFIG.container.height)}>
          <div className={EXCHANGE_CONFIG.header.className}>
            <div className="p-4 space-y-3">
              {Array.from({ length: EXCHANGE_CONFIG.skeleton.offerRows }).map((_, i) => (
                <Skeleton key={i} className={cn("w-full", EXCHANGE_CONFIG.skeleton.height)} />
              ))}
            </div>
          </div>
        </Card>
        <Card className={cn(EXCHANGE_CONFIG.card.className, EXCHANGE_CONFIG.container.height)}>
          <div className={EXCHANGE_CONFIG.header.className}>
            <div className="p-4 space-y-3">
              {Array.from({ length: EXCHANGE_CONFIG.skeleton.offerRows }).map((_, i) => (
                <Skeleton key={i} className={cn("w-full", EXCHANGE_CONFIG.skeleton.height)} />
              ))}
            </div>
          </div>
        </Card>
      </div>
    );
  }

  const offerAsset = selectedCurrency ? (tradingAsset === "gold" ? "Gold" : selectedCurrency.currencySymbol) : "GOLD";
  const wantAsset = selectedCurrency ? (tradingAsset === "gold" ? selectedCurrency.currencySymbol : "Gold") : "GOLD";

  // Use treasury balance if trading with treasury account, otherwise use personal balance
  const offerBalance = selectedCurrency ? (tradingAsset === "gold"
    ? (sourceAccount === "treasury" ? data.userGold : data.userGold)  // Gold always from treasury if available
    : (sourceAccount === "treasury" ? communityTreasuryBalance : selectedCurrency.amount)
  ) : 0;

  console.log("[ExchangeComponent] Balance check - sourceAccount:", sourceAccount, "| offerBalance:", offerBalance, "| userBalance:", selectedCurrency?.amount, "| treasuryBalance:", communityTreasuryBalance);
  // User is sovereign (r0, founder, king, queen, etc) - allow treasury source account
  const isSovereign = selectedCommunityRole === "r0" || selectedCommunityRole === "founder";
  const isLeader = selectedCurrency && isSovereign;

  // Debug log
  if (selectedCurrency) {
    console.log("[ExchangeComponent] Treasury toggle check:", {
      selectedCurrency: selectedCurrency?.currencyName,
      selectedCommunityRole,
      isSovereign,
      showToggle: isLeader
    });
  }

  const relevantOffers = tradingAsset === "gold" ? orderBook?.sells || [] : orderBook?.buys || [];

  // Pagination logic - 5 offers per page
  const OFFERS_PER_PAGE = 5;
  const totalPages = Math.ceil(relevantOffers.length / OFFERS_PER_PAGE);
  const startIndex = (currentPage - 1) * OFFERS_PER_PAGE;
  const endIndex = startIndex + OFFERS_PER_PAGE;
  const paginatedOffers = relevantOffers.slice(startIndex, endIndex);

  // Show error state if no currency selected after loading
  if (!selectedCurrency) {
    return (
      <div className={EXCHANGE_CONFIG.container.grid}>
        <Card className={cn(EXCHANGE_CONFIG.card.className, EXCHANGE_CONFIG.container.height)}>
          <div className={cn(EXCHANGE_CONFIG.header.className, "flex items-center justify-center h-full")}>
            <div className="text-center p-6">
              <p className={cn(EXCHANGE_CONFIG.header.subtitle, "text-base")}>No community currency available</p>
              <p className={cn(EXCHANGE_CONFIG.header.subtitle, "mt-2")}>Join a community to start trading</p>
            </div>
          </div>
        </Card>
        <Card className={cn(EXCHANGE_CONFIG.card.className, EXCHANGE_CONFIG.container.height)}>
          <div className={cn(EXCHANGE_CONFIG.header.className, "flex items-center justify-center h-full")}>
            <div className="text-center p-6">
              <p className={cn(EXCHANGE_CONFIG.header.subtitle, "text-sm")}>Select a community from the filter above</p>
            </div>
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div className={EXCHANGE_CONFIG.container.grid}>
      {/* Left: Available Offers */}
      <Card className={cn(EXCHANGE_CONFIG.card.className, EXCHANGE_CONFIG.container.height)}>
        <div className={EXCHANGE_CONFIG.header.className}>
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className={EXCHANGE_CONFIG.header.title}>
              {tradingAsset === "gold" ? `Buy ${selectedCurrency.currencySymbol}` : `Buy GOLD`}
            </h3>
            <div className={cn("flex items-center gap-1", EXCHANGE_CONFIG.header.subtitle)}>
              <span>with</span>
              {tradingAsset === "gold" ? (
                <GoldCoinIcon className={EXCHANGE_CONFIG.header.iconSize} />
              ) : (
                <CommunityCoinIcon className={EXCHANGE_CONFIG.header.iconSize} color={selectedCurrency.communityColor || undefined} />
              )}
              <span>{tradingAsset === "gold" ? "GOLD" : selectedCurrency.currencySymbol}</span>
            </div>
          </div>

          {/* Contextual Location Message - Single Line */}
          <div className={EXCHANGE_CONFIG.header.locationContainer}>
            {isInCommunityLocation ? (
              <p className={cn(EXCHANGE_CONFIG.header.locationText, EXCHANGE_CONFIG.header.subtitle)}>
                You are in {selectedCurrency.currencyName} Lands. Trade safely.
              </p>
            ) : (
              <div className={cn(EXCHANGE_CONFIG.header.locationText, EXCHANGE_CONFIG.header.subtitle, "flex items-center gap-1 flex-wrap")}>
                <span>Travel to {selectedCurrency.currencyName} territory to trade.</span>
                {data.userHex && data.userHexCustomName && (
                  <>
                    <MapPin className="h-3 w-3 flex-shrink-0" />
                    <span className="text-xs text-muted-foreground">Location: {data.userHexCustomName}</span>
                    <span className="text-xs text-muted-foreground">•</span>
                    <Link
                      href="/map"
                      target="_blank"
                      className="inline-flex items-center gap-1 hover:text-foreground transition-colors text-xs"
                      title="Travel to different location"
                    >
                      <Plane className="h-3 w-3" />
                      <span>Travel</span>
                    </Link>
                  </>
                )}
              </div>
            )}
          </div>
        </div>

        <div className="flex flex-col flex-1 min-h-0">
          {loading ? (
            <div className="p-4 space-y-3">
              {Array.from({ length: EXCHANGE_CONFIG.skeleton.offerRows }).map((_, i) => (
                <Skeleton key={i} className={cn("w-full", EXCHANGE_CONFIG.skeleton.height)} />
              ))}
            </div>
          ) : relevantOffers.length === 0 ? (
            <div className="flex items-center justify-center flex-1 px-4 text-center">
              <div>
                <p className={EXCHANGE_CONFIG.header.subtitle}>No offers available</p>
                {data.userHex && data.userHexCustomName && (
                  <div className={cn(EXCHANGE_CONFIG.header.subtitle, "mt-1 text-xs text-muted-foreground flex items-center justify-center gap-1")}>
                    in {data.userHexCustomName}
                  </div>
                )}
              </div>
            </div>
          ) : (
            <>
              <ScrollArea className="flex-1 min-h-0">
                <div className={EXCHANGE_CONFIG.offers.divider}>
                  {paginatedOffers.map((level) => {
                    const levelData = priceLevelOrders.get(level.exchange_rate);
                    return (
                      <OfferLevel
                        key={level.exchange_rate}
                        level={level}
                        orders={levelData?.orders || []}
                        ordersLoading={levelData?.loading !== false}
                        currencySymbol={selectedCurrency.currencySymbol}
                        communityColor={selectedCurrency.communityColor}
                        tradingAsset={tradingAsset}
                        selectedOrder={selectedOrder}
                        onSelectOrder={setSelectedOrder}
                        disabled={!isInCommunityLocation}
                        currentUserId={data.userId}
                        onCancelOrder={async (orderId) => {
                          try {
                            const result = await cancelExchangeOrder(orderId);
                            if (result.success) {
                              toast.success("Order cancelled successfully");
                              await fetchOrderBook(selectedCurrency, tradingAsset);
                            } else {
                              toast.error(result.message || "Failed to cancel order");
                            }
                          } catch (error) {
                            console.error("Cancel order error:", error);
                            toast.error("Failed to cancel order");
                          }
                        }}
                      />
                    );
                  })}
                </div>
              </ScrollArea>
              {totalPages > 1 && (
                <div className="flex items-center justify-between px-4 py-2 border-t border-border/60 bg-muted/20 shrink-0">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                    disabled={currentPage === 1}
                    className="h-8"
                  >
                    <ChevronLeft className="h-4 w-4 mr-1" />
                    Previous
                  </Button>
                  <span className="text-xs text-muted-foreground">
                    Page {currentPage} of {totalPages}
                  </span>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                    disabled={currentPage === totalPages}
                    className="h-8"
                  >
                    Next
                    <ChevronRight className="h-4 w-4 ml-1" />
                  </Button>
                </div>
              )}
            </>
          )}
        </div>
      </Card>

      {/* Right: Exchange Form */}
      <Card className={cn(EXCHANGE_CONFIG.card.className, EXCHANGE_CONFIG.container.height)}>
        <div className={cn(EXCHANGE_CONFIG.header.className, "flex flex-col gap-3")}>
          <div className="flex items-center justify-between">
            <div>
              <h3 className={EXCHANGE_CONFIG.header.title}>Exchange</h3>
              <p className={EXCHANGE_CONFIG.header.subtitle}>Trade with {selectedCurrency.currencyName}</p>
            </div>
          </div>
          {isLeader && (
            <div className="flex items-center gap-2 pb-1">
              <span className="text-xs font-medium text-muted-foreground">Trading Account:</span>
              <div className="flex gap-1 p-1 bg-muted/50 rounded-lg">
                <button
                  onClick={() => setSourceAccount("personal")}
                  className={cn(
                    "px-4 py-1.5 rounded-md text-xs font-semibold transition-all flex items-center gap-2",
                    sourceAccount === "personal"
                      ? "bg-primary text-primary-foreground shadow-sm"
                      : "text-muted-foreground hover:text-foreground hover:bg-muted/70"
                  )}
                  title="Use your personal account"
                >
                  <span>Personal</span>
                  {sourceAccount === "personal" && <span className="h-1.5 w-1.5 rounded-full bg-primary-foreground" />}
                </button>
                <button
                  onClick={() => setSourceAccount("treasury")}
                  className={cn(
                    "px-4 py-1.5 rounded-md text-xs font-semibold transition-all flex items-center gap-2",
                    sourceAccount === "treasury"
                      ? "bg-emerald-600 text-white shadow-sm"
                      : "text-muted-foreground hover:text-foreground hover:bg-muted/70"
                  )}
                  title="Use community treasury account"
                >
                  <span>Treasury</span>
                  {sourceAccount === "treasury" && <span className="h-1.5 w-1.5 rounded-full bg-white" />}
                </button>
              </div>
            </div>
          )}
        </div>

        <div className="flex-1 p-4 space-y-4 overflow-y-auto">
          {/* Offer Input */}
          <div>
            <Label className={EXCHANGE_CONFIG.header.subtitle}>You Offer</Label>
            <div className="relative mt-1">
              <Input
                type="number"
                value={offerAmount}
                onChange={(e) => {
                  setOfferAmount(e.target.value);
                  if (e.target.value && !wantAmount) {
                    const rate = selectedOrder?.exchange_rate || selectedCurrency.exchangeRate;
                    const val = parseFloat(e.target.value);
                    if (tradingAsset === "gold") {
                      setWantAmount((val * rate).toFixed(2));
                    } else {
                      setWantAmount((val / rate).toFixed(2));
                    }
                  }
                }}
                placeholder="0.00"
                className={EXCHANGE_CONFIG.input.className}
              />
              <div className={EXCHANGE_CONFIG.input.iconContainer}>
                {tradingAsset === "gold" ? (
                  <GoldCoinIcon className="h-4 w-4" />
                ) : (
                  <CommunityCoinIcon className="h-4 w-4" color={selectedCurrency.communityColor || undefined} />
                )}
                <span className="text-sm font-medium">{offerAsset}</span>
              </div>
            </div>
            <p className={cn(EXCHANGE_CONFIG.header.subtitle, "mt-1")}>Balance: {offerBalance.toFixed(2)}</p>
          </div>

          {/* Flip Button */}
          <div className="flex justify-center">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleFlip}
              className="rounded-full"
            >
              <ArrowUpDown className="h-4 w-4" />
            </Button>
          </div>

          {/* Want Input */}
          <div>
            <Label className={EXCHANGE_CONFIG.header.subtitle}>You Receive</Label>
            <div className="relative mt-1">
              <Input
                type="number"
                value={wantAmount}
                onChange={(e) => {
                  setWantAmount(e.target.value);
                  if (e.target.value && !offerAmount) {
                    const rate = selectedOrder?.exchange_rate || selectedCurrency.exchangeRate;
                    const val = parseFloat(e.target.value);
                    if (tradingAsset === "gold") {
                      setOfferAmount((val / rate).toFixed(2));
                    } else {
                      setOfferAmount((val * rate).toFixed(2));
                    }
                  }
                }}
                placeholder="0.00"
                className={EXCHANGE_CONFIG.input.className}
              />
              <div className={EXCHANGE_CONFIG.input.iconContainer}>
                {tradingAsset === "currency" ? (
                  <GoldCoinIcon className="h-4 w-4" />
                ) : (
                  <CommunityCoinIcon className="h-4 w-4" color={selectedCurrency.communityColor || undefined} />
                )}
                <span className="text-sm font-medium">{wantAsset}</span>
              </div>
            </div>
            <div className="flex items-center justify-between mt-1">
              {selectedOrder && (
                <p className="text-xs text-primary">@ {selectedOrder.exchange_rate.toFixed(4)} (from selected offer)</p>
              )}
              {!selectedOrder && offerAmount && wantAmount && parseFloat(offerAmount) > 0 && parseFloat(wantAmount) > 0 && (
                <p className={EXCHANGE_CONFIG.header.subtitle}>
                  @ {(parseFloat(offerAmount) / parseFloat(wantAmount)).toFixed(4)} (custom rate)
                </p>
              )}
              {selectedOrder && (
                <button
                  type="button"
                  onClick={() => setSelectedOrder(null)}
                  className={cn(EXCHANGE_CONFIG.header.subtitle, "hover:text-foreground")}
                >
                  Clear
                </button>
              )}
            </div>
          </div>

          {/* Action Buttons */}
          <div className="space-y-2 pt-4">
            <Button
              onClick={handleBuy}
              disabled={isBuying || isSelling || !selectedOrder || !isInCommunityLocation}
              className="w-full bg-green-600 hover:bg-green-700 text-white disabled:bg-green-600/50 disabled:text-white/70"
              title={!isInCommunityLocation ? "Travel to community to accept offers" : ""}
            >
              {isBuying ? "Processing..." : selectedOrder ? "Buy! (Accept Offer)" : "Buy! (Select an Offer)"}
            </Button>
            <Button
              onClick={handleSell}
              disabled={isBuying || isSelling || !offerAmount || !wantAmount || !isInCommunityLocation}
              className="w-full bg-red-600 hover:bg-red-700 text-white disabled:bg-red-600/50 disabled:text-white/70"
              title={!isInCommunityLocation ? "Travel to community to post offers" : ""}
            >
              {isSelling ? "Processing..." : selectedOrder ? "Sell! (Match or Post)" : relevantOffers.length > 0 ? "Sell! (Match Best)" : "Sell! (Post New Offer)"}
            </Button>
          </div>

          <div className="text-[10px] text-muted-foreground text-center space-y-0.5 pt-2 border-t">
            <p><strong>Accept</strong> = Take existing offer immediately</p>
            <p><strong>Match/Post</strong> = Auto-match best or create new offer</p>
          </div>
        </div>
      </Card>
    </div>
  );
}

// Offer level component with pre-loaded orders
function OfferLevel({
  level,
  orders,
  ordersLoading,
  currencySymbol,
  communityColor,
  tradingAsset,
  selectedOrder,
  onSelectOrder,
  disabled,
  currentUserId,
  onCancelOrder,
}: {
  level: any;
  orders: OrderBookIndividual[];
  ordersLoading: boolean;
  currencySymbol: string;
  communityColor: string | null;
  tradingAsset: "gold" | "currency";
  selectedOrder: OrderBookIndividual | null;
  onSelectOrder: (order: OrderBookIndividual | null) => void;
  disabled?: boolean;
  currentUserId: string;
  onCancelOrder: (orderId: string) => Promise<void>;
}) {
  const [expanded, setExpanded] = useState(false);
  const [cancelingOrderId, setCancelingOrderId] = useState<string | null>(null);

  const firstOrder = orders[0];
  const isAnySelected = orders.some(o => o.order_id === selectedOrder?.order_id);
  const hasUserOrder = orders.some(o => o.user_id === currentUserId);

  if (ordersLoading) {
    return <Skeleton className={cn("w-full", EXCHANGE_CONFIG.skeleton.height)} />;
  }

  if (!firstOrder) return null;

  const displayRate = tradingAsset === "gold"
    ? level.exchange_rate
    : (1 / level.exchange_rate);

  const hasMultipleOrders = orders.length > 1;

  const selectRandomOrder = () => {
    if (disabled) return;
    const randomOrder = orders[Math.floor(Math.random() * orders.length)];
    onSelectOrder(isAnySelected ? null : randomOrder);
  };

  // Find user's order at this price level
  const userOrder = orders.find(o => o.user_id === currentUserId);

  return (
    <div className="border-b border-border/60 last:border-b-0">
      <div className="flex items-center relative group">
        <button
          type="button"
          onClick={selectRandomOrder}
          disabled={disabled || hasUserOrder}
          className={cn(
            EXCHANGE_CONFIG.offerLevel.button,
            "flex-1",
            isAnySelected ? EXCHANGE_CONFIG.offerLevel.selectedBg : EXCHANGE_CONFIG.offerLevel.hoverBg,
            disabled && "opacity-50 cursor-not-allowed",
            hasUserOrder && "cursor-default"
          )}
        >
          <div className={cn("flex shrink-0", EXCHANGE_CONFIG.offers.avatarSpacing)}>
            {orders.slice(0, EXCHANGE_CONFIG.offers.maxAvatarsInGroup).map((order, idx) => (
              <Avatar key={idx} className={cn(EXCHANGE_CONFIG.offers.avatarSize, "rounded-full border-2 border-background bg-card")}>
                <AvatarImage
                  src={resolveAvatar({ avatarUrl: order.avatar_url, seed: order.username })}
                  alt={order.username}
                />
                <AvatarFallback className="rounded-full text-xs">
                  {order.username.substring(0, 2).toUpperCase()}
                </AvatarFallback>
              </Avatar>
            ))}
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-0.5">
              <span className={cn(EXCHANGE_CONFIG.header.subtitle, "font-semibold")}>
                {orders.length} {orders.length === 1 ? "offer" : "offers"}
              </span>
              {hasUserOrder && (
                <span className="text-[9px] px-1.5 py-0.5 bg-primary/20 text-primary rounded font-bold">
                  YOUR ORDER
                </span>
              )}
            </div>

            <div className="flex items-center gap-1.5 text-sm font-bold text-primary">
              <span>1</span>
              {tradingAsset === "gold" ? (
                <GoldCoinIcon className="h-4 w-4" />
              ) : (
                <CommunityCoinIcon className="h-4 w-4" color={communityColor || undefined} />
              )}
              <span>=</span>
              <span>{displayRate.toFixed(4)}</span>
              {tradingAsset === "gold" ? (
                <CommunityCoinIcon className="h-4 w-4" color={communityColor || undefined} />
              ) : (
                <GoldCoinIcon className="h-4 w-4" />
              )}
            </div>

            <div className={cn("flex items-center gap-1 mt-0.5", EXCHANGE_CONFIG.header.subtitle)}>
              <span>Total:</span>
              <GoldCoinIcon className={EXCHANGE_CONFIG.header.iconSize} />
              <span>{level.total_gold_amount.toFixed(2)}</span>
              <span className="mx-0.5">⇄</span>
              <CommunityCoinIcon className={EXCHANGE_CONFIG.header.iconSize} color={communityColor || undefined} />
              <span>{level.total_currency_amount.toFixed(2)}</span>
            </div>
          </div>
        </button>

        {/* Cancel button for user's own order */}
        {hasUserOrder && userOrder && (
          <button
            type="button"
            onClick={async (e) => {
              e.stopPropagation();
              setCancelingOrderId(userOrder.order_id);
              await onCancelOrder(userOrder.order_id);
              setCancelingOrderId(null);
            }}
            disabled={cancelingOrderId === userOrder.order_id}
            className="absolute right-12 top-1/2 -translate-y-1/2 w-8 h-8 flex items-center justify-center rounded-md bg-red-500/10 hover:bg-red-500/20 text-red-600 dark:text-red-400 transition-colors"
            title="Cancel your order"
          >
            {cancelingOrderId === userOrder.order_id ? (
              <span className="text-xs">...</span>
            ) : (
              <X className="h-4 w-4" />
            )}
          </button>
        )}

        {hasMultipleOrders && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setExpanded(!expanded);
            }}
            disabled={disabled}
            className={cn(
              "px-3 py-3 transition-all",
              EXCHANGE_CONFIG.offerLevel.hoverBg,
              disabled && "opacity-50 cursor-not-allowed"
            )}
          >
            <ChevronDown className={cn("h-4 w-4 transition-transform", expanded && "rotate-180")} />
          </button>
        )}
      </div>

      {expanded && hasMultipleOrders && (
        <div className={cn(EXCHANGE_CONFIG.offerLevel.expandedBg, EXCHANGE_CONFIG.offers.divider)}>
          <ScrollArea className={EXCHANGE_CONFIG.expandedOrder.maxHeight}>
            {orders.map((order) => {
              const isThisOrderSelected = selectedOrder?.order_id === order.order_id;
              const isUserOrder = order.user_id === currentUserId;
              return (
                <div key={order.order_id} className="relative group">
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      if (!disabled && !isUserOrder) {
                        onSelectOrder(isThisOrderSelected ? null : order);
                        setExpanded(false);
                      }
                    }}
                    disabled={disabled || isUserOrder}
                    className={cn(
                      EXCHANGE_CONFIG.expandedOrder.button,
                      isThisOrderSelected ? EXCHANGE_CONFIG.expandedOrder.selectedBg : EXCHANGE_CONFIG.expandedOrder.hoverBg,
                      disabled && "opacity-50 cursor-not-allowed",
                      isUserOrder && "cursor-default"
                    )}
                  >
                    <Avatar className={cn(EXCHANGE_CONFIG.expandedOrder.avatarSize, "rounded-full border border-border bg-card shrink-0")}>
                      <AvatarImage
                        src={resolveAvatar({ avatarUrl: order.avatar_url, seed: order.username })}
                        alt={order.username}
                      />
                      <AvatarFallback className="rounded-full text-[10px]">
                        {order.username.substring(0, 2).toUpperCase()}
                      </AvatarFallback>
                    </Avatar>

                    <div className="flex-1 min-w-0">
                      <div className="text-xs font-medium text-foreground truncate">
                        {order.username}
                        {isUserOrder && <span className="text-[9px] ml-1 text-muted-foreground">(You)</span>}
                      </div>
                      <div className={cn("flex items-center gap-1 text-[10px]", EXCHANGE_CONFIG.header.subtitle)}>
                        <GoldCoinIcon className="h-2.5 w-2.5" />
                        <span>{order.remaining_gold_amount.toFixed(2)}</span>
                        <span className="mx-0.5">⇄</span>
                        <CommunityCoinIcon className="h-2.5 w-2.5" color={communityColor || undefined} />
                        <span>{order.remaining_currency_amount.toFixed(2)}</span>
                      </div>
                    </div>

                    {order.source_account === 'treasury' && (
                      <span className="text-[9px] px-1 py-0.5 bg-primary/30 text-primary rounded font-bold shrink-0">
                        TREASURY
                      </span>
                    )}
                  </button>
                  {isUserOrder && (
                    <button
                      type="button"
                      onClick={async (e) => {
                        e.stopPropagation();
                        setCancelingOrderId(order.order_id);
                        await onCancelOrder(order.order_id);
                        setCancelingOrderId(null);
                      }}
                      disabled={cancelingOrderId === order.order_id}
                      className="absolute right-2 top-1/2 -translate-y-1/2 w-6 h-6 flex items-center justify-center rounded-md bg-red-500/10 hover:bg-red-500/20 text-red-600 dark:text-red-400 transition-colors"
                      title="Cancel order"
                    >
                      {cancelingOrderId === order.order_id ? (
                        <span className="text-[10px]">...</span>
                      ) : (
                        <X className="h-3.5 w-3.5" />
                      )}
                    </button>
                  )}
                </div>
              );
            })}
          </ScrollArea>
        </div>
      )}
    </div>
  );
}
