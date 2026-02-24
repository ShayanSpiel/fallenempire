import { createSupabaseServerClient } from "@/lib/supabase-server";

const MENTION_REGEX = /@(\w+)/g;

export interface AgentMention {
  agentId: string;
  username: string;
}

/**
 * Extract mentions from text content and identify which are AI agents
 * @param content - Text content to scan for mentions
 * @returns Array of agent mentions (only bot users)
 */
export async function detectAgentMentions(
  content: string
): Promise<AgentMention[]> {
  const supabase = await createSupabaseServerClient();

  // Extract all @mentions from content
  const mentionMatches = Array.from(content.matchAll(MENTION_REGEX));
  const usernames = mentionMatches.map((match) => match[1]);

  if (usernames.length === 0) {
    return [];
  }

  // Look up users by username and filter for agents
  const { data: mentionedUsers, error } = await supabase
    .from("users")
    .select("id, username, is_bot")
    .in("username", usernames)
    .eq("is_bot", true); // Only return bot users (agents)

  if (error) {
    console.error("[mention-utils] Error fetching mentioned users:", error);
    return [];
  }

  if (!mentionedUsers || mentionedUsers.length === 0) {
    return [];
  }

  return mentionedUsers.map((user) => ({
    agentId: user.id,
    username: user.username,
  }));
}

/**
 * Extract all usernames mentioned in content (agents and non-agents)
 * @param content - Text content to scan
 * @returns Array of mentioned usernames
 */
export function extractMentionedUsernames(content: string): string[] {
  const mentionMatches = Array.from(content.matchAll(MENTION_REGEX));
  return mentionMatches.map((match) => match[1]);
}

/**
 * Check if content contains any mentions
 * @param content - Text content to check
 * @returns True if content contains at least one @mention
 */
export function hasMentions(content: string): boolean {
  return MENTION_REGEX.test(content);
}
