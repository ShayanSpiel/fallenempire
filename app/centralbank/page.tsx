"use client";

import { useEffect, useState } from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { typography, borders } from "@/lib/design-system";
import { formatGold, formatTransactionType, getTransactionIcon } from "@/lib/economy-config";
import { createSupabaseBrowserClient } from "@/lib/supabase-browser";
import { GoldCoinIcon, CommunityCoinIcon } from "@/components/ui/coin-icon";
import * as Icons from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ChevronLeft, ChevronRight } from "lucide-react";

interface OverviewStats {
  total_gold_supply: number;
  community_currencies: {
    total_currencies: number;
    currencies: any[];
  };
  gold_flow: {
    today: { added: number; burnt: number; net_change: number };
    week: { added: number; burnt: number; net_change: number };
    month: { added: number; burnt: number; net_change: number };
  };
}

interface Transaction {
  id: string;
  from_user_id: string | null;
  to_user_id: string | null;
  currency_type: string;
  amount: number;
  transaction_type: string;
  description: string;
  metadata: any;
  scope: string;
  created_at: string;
}

export default function CentralBankPage() {
  const supabase = createSupabaseBrowserClient();
  const [loadingStats, setLoadingStats] = useState(true);
  const [overviewStats, setOverviewStats] = useState<OverviewStats | null>(null);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [isPremium, setIsPremium] = useState(false);

  // Separate state for each tab
  const [personalTransactions, setPersonalTransactions] = useState<Transaction[]>([]);
  const [communityTransactions, setCommunityTransactions] = useState<Transaction[]>([]);
  const [globalTransactions, setGlobalTransactions] = useState<Transaction[]>([]);

  // Separate loading states
  const [loadingPersonal, setLoadingPersonal] = useState(true);
  const [loadingCommunity, setLoadingCommunity] = useState(true);
  const [loadingGlobal, setLoadingGlobal] = useState(true);

  // Separate pagination state for each tab
  const [personalPage, setPersonalPage] = useState(1);
  const [personalPageSize, setPersonalPageSize] = useState(25);
  const [personalTotal, setPersonalTotal] = useState(0);

  const [communityPage, setCommunityPage] = useState(1);
  const [communityPageSize, setCommunityPageSize] = useState(25);
  const [communityTotal, setCommunityTotal] = useState(0);

  const [globalPage, setGlobalPage] = useState(1);
  const [globalPageSize, setGlobalPageSize] = useState(25);
  const [globalTotal, setGlobalTotal] = useState(0);

  useEffect(() => {
    loadUserData();
    loadOverviewStats();
  }, []);

  useEffect(() => {
    loadPersonalTransactions();
  }, [personalPage, personalPageSize]);

  useEffect(() => {
    loadCommunityTransactions();
  }, [communityPage, communityPageSize]);

  useEffect(() => {
    if (isPremium) {
      loadGlobalTransactions();
    }
  }, [globalPage, globalPageSize, isPremium]);

  async function loadUserData() {
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) return;

      const { data: profile } = await supabase
        .from("users")
        .select("id, username")
        .eq("auth_id", user.id)
        .single();

      if (profile) {
        setCurrentUserId(profile.id);
        // Unlock global reports for username "Shayan"
        setIsPremium(profile.username?.toLowerCase() === "shayan");
      }
    } catch (err) {
      console.error("Failed to load user data:", err);
    }
  }

  async function loadOverviewStats() {
    setLoadingStats(true);
    try {
      const overviewRes = await fetch("/api/centralbank?action=overview");
      if (overviewRes.ok) {
        const overviewData = await overviewRes.json();
        setOverviewStats(overviewData);
      }
    } catch (err) {
      console.error("Failed to load overview stats:", err);
    } finally {
      setLoadingStats(false);
    }
  }

  async function loadPersonalTransactions() {
    setLoadingPersonal(true);
    try {
      const offset = (personalPage - 1) * personalPageSize;
      const transactionsRes = await fetch(
        `/api/centralbank?action=transactions&scope=personal&limit=${personalPageSize}&offset=${offset}`
      );
      if (transactionsRes.ok) {
        const transactionsData = await transactionsRes.json();
        setPersonalTransactions(transactionsData.transactions || []);
        setPersonalTotal(transactionsData.total || 0);
      }
    } catch (err) {
      console.error("Failed to load personal transactions:", err);
    } finally {
      setLoadingPersonal(false);
    }
  }

  async function loadCommunityTransactions() {
    setLoadingCommunity(true);
    try {
      const offset = (communityPage - 1) * communityPageSize;
      const transactionsRes = await fetch(
        `/api/centralbank?action=transactions&scope=community&limit=${communityPageSize}&offset=${offset}`
      );
      if (transactionsRes.ok) {
        const transactionsData = await transactionsRes.json();
        setCommunityTransactions(transactionsData.transactions || []);
        setCommunityTotal(transactionsData.total || 0);
      }
    } catch (err) {
      console.error("Failed to load community transactions:", err);
    } finally {
      setLoadingCommunity(false);
    }
  }

  async function loadGlobalTransactions() {
    setLoadingGlobal(true);
    try {
      const offset = (globalPage - 1) * globalPageSize;
      const transactionsRes = await fetch(
        `/api/centralbank?action=transactions&scope=global&limit=${globalPageSize}&offset=${offset}`
      );
      if (transactionsRes.ok) {
        const transactionsData = await transactionsRes.json();
        setGlobalTransactions(transactionsData.transactions || []);
        setGlobalTotal(transactionsData.total || 0);
      }
    } catch (err) {
      console.error("Failed to load global transactions:", err);
    } finally {
      setLoadingGlobal(false);
    }
  }

  function refreshData() {
    loadOverviewStats();
    loadPersonalTransactions();
    loadCommunityTransactions();
    if (isPremium) {
      loadGlobalTransactions();
    }
  }

  return (
    <div className="p-8 space-y-6">
      {/* Header - Always visible */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className={`${typography.displayMd.size} ${typography.displayMd.weight}`}>
            Central Bank
          </h1>
          <p className={`${typography.bodySm.size} text-muted-foreground mt-1`}>
            Economic analytics and transaction monitoring
          </p>
        </div>
        <Button onClick={refreshData} variant="outline">
          Refresh Data
        </Button>
      </div>

      {/* Overview Stats Cards - Show immediately with skeletons */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Gold Supply */}
        <Card variant="compact">
          <CardHeader className="pb-3">
            <CardTitle className={typography.headingSm.size}>
              Total Gold Supply
            </CardTitle>
          </CardHeader>
          <CardContent>
            {loadingStats ? (
              <>
                <Skeleton className="h-8 w-32 mb-2" />
                <Skeleton className="h-4 w-20" />
              </>
            ) : (
              <>
                <div className={`${typography.displaySm.size} ${typography.displaySm.weight} flex items-center gap-2`}>
                  <GoldCoinIcon className="h-6 w-6" />
                  {formatGold(overviewStats?.total_gold_supply || 0)}
                </div>
                <p className={`${typography.bodySm.size} text-muted-foreground mt-1`}>
                  In circulation
                </p>
              </>
            )}
          </CardContent>
        </Card>

        {/* Community Currencies */}
        <Card variant="compact">
          <CardHeader className="pb-3">
            <CardTitle className={typography.headingSm.size}>
              Community Currencies
            </CardTitle>
          </CardHeader>
          <CardContent>
            {loadingStats ? (
              <>
                <Skeleton className="h-8 w-16 mb-2" />
                <Skeleton className="h-4 w-24" />
              </>
            ) : (
              <>
                <div className={`${typography.displaySm.size} ${typography.displaySm.weight} flex items-center gap-2`}>
                  <CommunityCoinIcon className="h-6 w-6" />
                  {overviewStats?.community_currencies.total_currencies || 0}
                </div>
                <p className={`${typography.bodySm.size} text-muted-foreground mt-1`}>
                  Active currencies
                </p>
              </>
            )}
          </CardContent>
        </Card>

        {/* Gold Added */}
        <Card variant="compact">
          <CardHeader className="pb-3">
            <CardTitle className={typography.headingSm.size}>
              Gold Added (Month)
            </CardTitle>
          </CardHeader>
          <CardContent>
            {loadingStats ? (
              <>
                <Skeleton className="h-8 w-32 mb-2" />
                <Skeleton className="h-4 w-20" />
              </>
            ) : (
              <>
                <div
                  className={`${typography.displaySm.size} ${typography.displaySm.weight} text-green-600 flex items-center gap-2`}
                >
                  <GoldCoinIcon className="h-6 w-6" />
                  +{formatGold(overviewStats?.gold_flow.month.added || 0)}
                </div>
                <p className={`${typography.bodySm.size} text-muted-foreground mt-1`}>
                  Last 30 days
                </p>
              </>
            )}
          </CardContent>
        </Card>

        {/* Gold Burnt */}
        <Card variant="compact">
          <CardHeader className="pb-3">
            <CardTitle className={typography.headingSm.size}>
              Gold Burnt (Month)
            </CardTitle>
          </CardHeader>
          <CardContent>
            {loadingStats ? (
              <>
                <Skeleton className="h-8 w-32 mb-2" />
                <Skeleton className="h-4 w-20" />
              </>
            ) : (
              <>
                <div
                  className={`${typography.displaySm.size} ${typography.displaySm.weight} text-red-600 flex items-center gap-2`}
                >
                  <GoldCoinIcon className="h-6 w-6" />
                  -{formatGold(overviewStats?.gold_flow.month.burnt || 0)}
                </div>
                <p className={`${typography.bodySm.size} text-muted-foreground mt-1`}>
                  Last 30 days
                </p>
              </>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Main Content Tabs - Always visible */}
      <Tabs defaultValue="personal" className="space-y-4">
        <TabsList className="grid grid-cols-3 w-full gap-2">
          <TabsTrigger value="personal">Personal</TabsTrigger>
          <TabsTrigger value="community">Community</TabsTrigger>
          <TabsTrigger value="global" disabled={!isPremium}>
            Global {!isPremium && "🔒"}
          </TabsTrigger>
        </TabsList>

        {/* Personal Tab */}
        <TabsContent value="personal" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className={typography.headingMd.size}>
                Your Transaction History
              </CardTitle>
              <p className={`${typography.bodySm.size} text-muted-foreground`}>
                Personal transactions (scope: personal)
              </p>
            </CardHeader>
            <CardContent>
              {loadingPersonal ? (
                <div className="space-y-2">
                  {[...Array(5)].map((_, i) => (
                    <div
                      key={i}
                      className={`p-3 rounded ${borders.hairline} ${borders.muted} flex justify-between items-center`}
                    >
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <Skeleton className="h-5 w-20" />
                          <Skeleton className="h-4 w-32" />
                        </div>
                        <Skeleton className="h-3 w-40 mt-2" />
                      </div>
                      <div className="text-right">
                        <Skeleton className="h-6 w-24 mb-1" />
                        <Skeleton className="h-3 w-16" />
                      </div>
                    </div>
                  ))}
                </div>
              ) : personalTransactions.length === 0 ? (
                <p className={`${typography.bodySm.size} text-muted-foreground`}>
                  No personal transactions yet
                </p>
              ) : (
                <>
                  <div className="space-y-2">
                    {personalTransactions.map((tx) => {
                      const iconName = getTransactionIcon(tx.transaction_type);
                      const IconComponent = (Icons as any)[iconName] || Icons.Circle;

                      return (
                        <div
                          key={tx.id}
                          className={`p-3 rounded ${borders.hairline} ${borders.muted} flex justify-between items-center`}
                        >
                          <div>
                            <div className="flex items-center gap-2">
                              <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-muted">
                                <IconComponent className="h-3.5 w-3.5" />
                                <span className="text-sm font-semibold">
                                  {formatTransactionType(tx.transaction_type)}
                                </span>
                              </div>
                              <span className={typography.bodySm.size}>
                                {tx.description || "No description"}
                              </span>
                            </div>
                            <p className={`${typography.bodySm.size} text-muted-foreground mt-1`}>
                              {new Date(tx.created_at).toLocaleString()}
                            </p>
                          </div>
                          <div className="text-right">
                            <div
                              className={`${typography.bodyMd.weight} ${
                                tx.to_user_id === currentUserId
                                  ? "text-green-600"
                                  : "text-red-600"
                              } flex items-center gap-1 justify-end`}
                            >
                              {tx.currency_type === "gold" ? (
                                <GoldCoinIcon className="h-4 w-4" />
                              ) : (
                                <CommunityCoinIcon className="h-4 w-4" />
                              )}
                              {tx.to_user_id === currentUserId ? "+" : "-"}
                              {formatGold(tx.amount)}
                            </div>
                            <p className={`${typography.bodySm.size} text-muted-foreground`}>
                              {tx.scope}
                            </p>
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {/* Pagination Controls */}
                  <div className="flex items-center justify-between mt-6 pt-4 border-t">
                    <div className="flex items-center gap-4">
                      <span className={`${typography.bodySm.size} text-muted-foreground`}>
                        Items per page:
                      </span>
                      <Select
                        value={personalPageSize.toString()}
                        onValueChange={(value) => {
                          setPersonalPageSize(parseInt(value));
                          setPersonalPage(1); // Reset to first page
                        }}
                      >
                        <SelectTrigger className="w-20">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="10">10</SelectItem>
                          <SelectItem value="25">25</SelectItem>
                          <SelectItem value="50">50</SelectItem>
                          <SelectItem value="100">100</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="flex items-center gap-4">
                      <span className={`${typography.bodySm.size} text-muted-foreground`}>
                        Page {personalPage} of {Math.ceil(personalTotal / personalPageSize) || 1}
                        <span className="ml-2">({personalTotal} total)</span>
                      </span>
                      <div className="flex gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setPersonalPage(Math.max(1, personalPage - 1))}
                          disabled={personalPage === 1}
                        >
                          <ChevronLeft className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setPersonalPage(personalPage + 1)}
                          disabled={personalPage >= Math.ceil(personalTotal / personalPageSize)}
                        >
                          <ChevronRight className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Community Tab */}
        <TabsContent value="community" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className={typography.headingMd.size}>
                Community Economics
              </CardTitle>
              <p className={`${typography.bodySm.size} text-muted-foreground`}>
                Community-level transactions (scope: community, inter_community)
              </p>
            </CardHeader>
            <CardContent>
              {loadingCommunity ? (
                <div className="space-y-2">
                  {[...Array(5)].map((_, i) => (
                    <div
                      key={i}
                      className={`p-3 rounded ${borders.hairline} ${borders.muted} flex justify-between items-center`}
                    >
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <Skeleton className="h-5 w-20" />
                          <Skeleton className="h-4 w-32" />
                        </div>
                        <Skeleton className="h-3 w-40 mt-2" />
                      </div>
                      <div className="text-right">
                        <Skeleton className="h-6 w-24 mb-1" />
                        <Skeleton className="h-3 w-16" />
                      </div>
                    </div>
                  ))}
                </div>
              ) : communityTransactions.length === 0 ? (
                <p className={`${typography.bodySm.size} text-muted-foreground`}>
                  No community transactions yet
                </p>
              ) : (
                <>
                  <div className="space-y-2">
                    {communityTransactions.map((tx) => {
                      const iconName = getTransactionIcon(tx.transaction_type);
                      const IconComponent = (Icons as any)[iconName] || Icons.Circle;

                      return (
                        <div
                          key={tx.id}
                          className={`p-3 rounded ${borders.hairline} ${borders.muted} flex justify-between items-center`}
                        >
                          <div>
                            <div className="flex items-center gap-2">
                              <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-muted">
                                <IconComponent className="h-3.5 w-3.5" />
                                <span className="text-sm font-semibold">
                                  {formatTransactionType(tx.transaction_type)}
                                </span>
                              </div>
                              <span className={typography.bodySm.size}>
                                {tx.description || "No description"}
                              </span>
                            </div>
                            <p className={`${typography.bodySm.size} text-muted-foreground mt-1`}>
                              {new Date(tx.created_at).toLocaleString()}
                            </p>
                          </div>
                          <div className="text-right">
                            <div
                              className={`${typography.bodyMd.weight} ${
                                tx.to_user_id === currentUserId
                                  ? "text-green-600"
                                  : "text-red-600"
                              } flex items-center gap-1 justify-end`}
                            >
                              {tx.currency_type === "gold" ? (
                                <GoldCoinIcon className="h-4 w-4" />
                              ) : (
                                <CommunityCoinIcon className="h-4 w-4" />
                              )}
                              {tx.to_user_id === currentUserId ? "+" : "-"}
                              {formatGold(tx.amount)}
                            </div>
                            <p className={`${typography.bodySm.size} text-muted-foreground`}>
                              {tx.scope}
                            </p>
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {/* Pagination Controls */}
                  <div className="flex items-center justify-between mt-6 pt-4 border-t">
                    <div className="flex items-center gap-4">
                      <span className={`${typography.bodySm.size} text-muted-foreground`}>
                        Items per page:
                      </span>
                      <Select
                        value={communityPageSize.toString()}
                        onValueChange={(value) => {
                          setCommunityPageSize(parseInt(value));
                          setCommunityPage(1);
                        }}
                      >
                        <SelectTrigger className="w-20">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="10">10</SelectItem>
                          <SelectItem value="25">25</SelectItem>
                          <SelectItem value="50">50</SelectItem>
                          <SelectItem value="100">100</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="flex items-center gap-4">
                      <span className={`${typography.bodySm.size} text-muted-foreground`}>
                        Page {communityPage} of {Math.ceil(communityTotal / communityPageSize) || 1}
                        <span className="ml-2">({communityTotal} total)</span>
                      </span>
                      <div className="flex gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setCommunityPage(Math.max(1, communityPage - 1))}
                          disabled={communityPage === 1}
                        >
                          <ChevronLeft className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setCommunityPage(communityPage + 1)}
                          disabled={communityPage >= Math.ceil(communityTotal / communityPageSize)}
                        >
                          <ChevronRight className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Global Tab (Premium Only) */}
        <TabsContent value="global" className="space-y-4">
          {!isPremium ? (
            <Card>
              <CardHeader>
                <CardTitle className={typography.headingMd.size}>
                  Premium Feature 🔒
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className={`${typography.bodyMd.size} mb-4`}>
                  Upgrade to premium to access global economic analytics:
                </p>
                <ul className={`${typography.bodySm.size} space-y-2 ml-4 list-disc text-muted-foreground`}>
                  <li>Inter-community transactions</li>
                  <li>Global market activity</li>
                  <li>Inflation/deflation indicators</li>
                  <li>Economic spike detection</li>
                  <li>Money supply trends</li>
                  <li>Advanced filtering and exports</li>
                </ul>
                <Button variant="default" className="mt-4">
                  Upgrade to Premium
                </Button>
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardHeader>
                <CardTitle className={typography.headingMd.size}>
                  Global Economics
                </CardTitle>
                <p className={`${typography.bodySm.size} text-muted-foreground`}>
                  System-wide transactions (scope: global)
                </p>
              </CardHeader>
              <CardContent>
                {loadingGlobal ? (
                  <div className="space-y-2">
                    {[...Array(5)].map((_, i) => (
                      <div
                        key={i}
                        className={`p-3 rounded ${borders.hairline} ${borders.muted} flex justify-between items-center`}
                      >
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <Skeleton className="h-5 w-20" />
                            <Skeleton className="h-4 w-32" />
                          </div>
                          <Skeleton className="h-3 w-40 mt-2" />
                        </div>
                        <div className="text-right">
                          <Skeleton className="h-6 w-24 mb-1" />
                          <Skeleton className="h-3 w-16" />
                        </div>
                      </div>
                    ))}
                  </div>
                ) : globalTransactions.length === 0 ? (
                  <p className={`${typography.bodySm.size} text-muted-foreground`}>
                    No global transactions yet
                  </p>
                ) : (
                  <>
                    <div className="space-y-2">
                      {globalTransactions.map((tx) => {
                        const iconName = getTransactionIcon(tx.transaction_type);
                        const IconComponent = (Icons as any)[iconName] || Icons.Circle;

                        return (
                          <div
                            key={tx.id}
                            className={`p-3 rounded ${borders.hairline} ${borders.muted} flex justify-between items-center`}
                          >
                            <div>
                              <div className="flex items-center gap-2">
                                <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-muted">
                                  <IconComponent className="h-3.5 w-3.5" />
                                  <span className="text-sm font-semibold">
                                    {formatTransactionType(tx.transaction_type)}
                                  </span>
                                </div>
                                <span className={typography.bodySm.size}>
                                  {tx.description || "No description"}
                                </span>
                              </div>
                              <p className={`${typography.bodySm.size} text-muted-foreground mt-1`}>
                                {new Date(tx.created_at).toLocaleString()}
                              </p>
                            </div>
                            <div className="text-right">
                              <div
                                className={`${typography.bodyMd.weight} ${
                                  tx.to_user_id === currentUserId
                                    ? "text-green-600"
                                    : "text-red-600"
                                } flex items-center gap-1 justify-end`}
                              >
                                {tx.currency_type === "gold" ? (
                                  <GoldCoinIcon className="h-4 w-4" />
                                ) : (
                                  <CommunityCoinIcon className="h-4 w-4" />
                                )}
                                {tx.to_user_id === currentUserId ? "+" : "-"}
                                {formatGold(tx.amount)}
                              </div>
                              <p className={`${typography.bodySm.size} text-muted-foreground`}>
                                {tx.scope}
                              </p>
                            </div>
                          </div>
                        );
                      })}
                    </div>

                    {/* Pagination Controls */}
                    <div className="flex items-center justify-between mt-6 pt-4 border-t">
                      <div className="flex items-center gap-4">
                        <span className={`${typography.bodySm.size} text-muted-foreground`}>
                          Items per page:
                        </span>
                        <Select
                          value={globalPageSize.toString()}
                          onValueChange={(value) => {
                            setGlobalPageSize(parseInt(value));
                            setGlobalPage(1);
                          }}
                        >
                          <SelectTrigger className="w-20">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="10">10</SelectItem>
                            <SelectItem value="25">25</SelectItem>
                            <SelectItem value="50">50</SelectItem>
                            <SelectItem value="100">100</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="flex items-center gap-4">
                        <span className={`${typography.bodySm.size} text-muted-foreground`}>
                          Page {globalPage} of {Math.ceil(globalTotal / globalPageSize) || 1}
                          <span className="ml-2">({globalTotal} total)</span>
                        </span>
                        <div className="flex gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setGlobalPage(Math.max(1, globalPage - 1))}
                            disabled={globalPage === 1}
                          >
                            <ChevronLeft className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setGlobalPage(globalPage + 1)}
                            disabled={globalPage >= Math.ceil(globalTotal / globalPageSize)}
                          >
                            <ChevronRight className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    </div>
                  </>
                )}
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
