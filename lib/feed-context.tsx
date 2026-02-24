import React, { createContext, useContext } from "react";
import type { FeedPost } from "@/lib/feed";

type FeedContextType = {
  addPostToFeed: (post: FeedPost) => void;
  updatePost: (postId: string, updates: Partial<FeedPost>) => void;
};

const FeedContext = createContext<FeedContextType | undefined>(undefined);

export function useFeedContext() {
  const context = useContext(FeedContext);
  if (!context) {
    throw new Error("useFeedContext must be used within FeedProvider");
  }
  return context;
}

export function FeedProvider({
  children,
  addPostToFeed,
  updatePost,
}: {
  children: React.ReactNode;
  addPostToFeed: (post: FeedPost) => void;
  updatePost: (postId: string, updates: Partial<FeedPost>) => void;
}) {
  return (
    <FeedContext.Provider value={{ addPostToFeed, updatePost }}>
      {children}
    </FeedContext.Provider>
  );
}
