/**
 * Shared community-related types
 */

export type CommunityEvent = {
  id: string;
  title: string;
  description: string;
  time: string;
  tone?: "info" | "success" | "warn";
};

// Legacy alias for backwards compatibility during migration
export type ChatSidebarEvent = CommunityEvent;
