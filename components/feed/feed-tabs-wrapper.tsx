"use client";

import { useEffect, useState } from "react";
import { Globe, Users, UserPlus } from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { FeedStream } from "@/components/feed/feed-stream";
import { FeedPost, FEED_PAGE_SIZE } from "@/lib/feed";

type FeedTabsWrapperProps = {
  initialPosts: FeedPost[];
  initialHasMore: boolean;
  viewerProfile: {
    id: string;
    username: string | null;
    identityLabel: string | null;
    avatarUrl: string | null;
  };
  userCommunities: Array<{ id: string; name: string; slug: string | null }>;
  userCommunityIds: string[];
  followingIds: string[];
};

type FeedTab = "world" | "community" | "friends";

const VALID_TABS: FeedTab[] = ["world", "community", "friends"];

export function FeedTabsWrapper({
  initialPosts,
  initialHasMore,
  viewerProfile,
  userCommunities,
  userCommunityIds,
}: FeedTabsWrapperProps) {
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const [activeTab, setActiveTab] = useState<FeedTab>("world");
  const composerCommunityId = userCommunityIds.length === 1 ? userCommunityIds[0] : null;
  const [tabIsLoading, setTabIsLoading] = useState<Record<FeedTab, boolean>>({
    world: false,
    community: false,
    friends: false,
  });
  const [tabPosts, setTabPosts] = useState<Record<FeedTab, FeedPost[]>>({
    world: initialPosts,
    community: [],
    friends: [],
  });
  const [tabHasMore, setTabHasMore] = useState<Record<FeedTab, boolean>>({
    world: initialHasMore,
    community: false,
    friends: false,
  });

  useEffect(() => {
    const rawTab = searchParams.get("tab");
    if (!rawTab) return;
    const normalized = rawTab.toLowerCase();
    if (VALID_TABS.includes(normalized as FeedTab)) {
      setActiveTab(normalized as FeedTab);
    }
  }, [searchParams]);

  useEffect(() => {
    fetch("/api/feed/seen", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ scope: activeTab }),
    }).catch(() => {});
  }, [activeTab]);

  // Fetch posts when tab changes (except world which is already loaded)
  useEffect(() => {
    async function loadTabPosts() {
      // Skip if already loaded or if it's world tab (already have initial data)
      if (tabPosts[activeTab].length > 0 || activeTab === "world") {
        return;
      }

      try {
        setTabIsLoading((prev) => ({ ...prev, [activeTab]: true }));
        const response = await fetch(`/api/feed?limit=${FEED_PAGE_SIZE}&offset=0&feedType=${activeTab}`);
        const data = await response.json();

        if (data.posts) {
          setTabPosts((prev) => ({
            ...prev,
            [activeTab]: data.posts,
          }));
          setTabHasMore((prev) => ({
            ...prev,
            [activeTab]: Boolean(data.hasMore),
          }));
        }
      } catch (error) {
        console.error(`Failed to load ${activeTab} feed:`, error);
      } finally {
        setTabIsLoading((prev) => ({ ...prev, [activeTab]: false }));
      }
    }

    loadTabPosts();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab]); // Only depend on activeTab, not tabPosts - prevents infinite loop

  const handleTabChange = (value: FeedTab) => {
    setActiveTab(value);
    const params = new URLSearchParams(searchParams.toString());
    if (value === "world") {
      params.delete("tab");
    } else {
      params.set("tab", value);
    }
    const query = params.toString();
    router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false });
  };

  return (
    <div className="space-y-6">
      <Tabs
        value={activeTab}
        onValueChange={(value) => handleTabChange(value as FeedTab)}
        className="w-full"
      >
        <TabsList className="w-full flex gap-2 flex-wrap">
          <TabsTrigger value="world" size="lg">
            <Globe className="h-4 w-4" />
            <span>World</span>
          </TabsTrigger>
          <TabsTrigger value="community" size="lg">
            <Users className="h-4 w-4" />
            <span>Community</span>
          </TabsTrigger>
          <TabsTrigger value="friends" size="lg">
            <UserPlus className="h-4 w-4" />
            <span>Friends</span>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="world" className="mt-8">
          <FeedStream
            initialPosts={tabPosts.world}
            initialHasMore={tabHasMore.world}
            viewerProfile={viewerProfile}
            feedContext="world"
          />
        </TabsContent>

        <TabsContent value="community" className="mt-8">
          <FeedStream
            initialPosts={tabPosts.community}
            initialHasMore={tabHasMore.community}
            viewerProfile={viewerProfile}
            feedContext="community"
            externalInitialLoading={tabIsLoading.community}
            communityId={composerCommunityId}
            communityOptions={userCommunities}
          />
        </TabsContent>

        <TabsContent value="friends" className="mt-8">
          <FeedStream
            initialPosts={tabPosts.friends}
            initialHasMore={tabHasMore.friends}
            viewerProfile={viewerProfile}
            feedContext="friends"
            externalInitialLoading={tabIsLoading.friends}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}
