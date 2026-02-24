/**
 * Memory Management Module
 * Conversation and context memory with vector store integration
 */

import { ConversationMessage, ConversationContext, MemoryRecord } from "../types";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { getVectorStore } from "../core/vector-store";

// ============================================================================
// MEMORY MANAGER CLASS
// ============================================================================

type ConversationOptions = {
  conversationId?: string;
  humanProfileId?: string;
};

export class MemoryManager {
  private vectorStore = getVectorStore();
  private conversationHistory: Map<string, ConversationMessage[]> = new Map();

  private getConversationKey(agentId: string, options: ConversationOptions = {}): string {
    if (options.conversationId) {
      return `${agentId}:${options.conversationId}`;
    }
    if (options.humanProfileId) {
      return `${agentId}:${options.humanProfileId}`;
    }
    return `${agentId}:global`;
  }

  /**
   * Store a conversation message
   */
  async storeMessage(
    agentId: string,
    message: ConversationMessage,
    context: Record<string, any> = {}
  ): Promise<void> {
    try {
      const options: ConversationOptions = {
        conversationId: context.conversationId,
        humanProfileId: context.humanProfileId,
      };
      const key = this.getConversationKey(agentId, options);
      if (!this.conversationHistory.has(key)) {
        this.conversationHistory.set(key, []);
      }
      this.conversationHistory.get(key)!.push(message);

      // Store in vector store for semantic retrieval
      const memoryType = message.role === "assistant" ? "interaction" : "observation";
      await this.vectorStore.storeMemory(agentId, message.content, memoryType, {
        role: message.role,
        timestamp: message.timestamp.toISOString(),
        ...context,
        conversationId: context.conversationId,
        humanProfileId: context.humanProfileId,
      });
    } catch (error) {
      console.error("[MemoryManager] Error storing message:", error);
      throw error;
    }
  }

  /**
   * Retrieve conversation context
   */
  async getConversationContext(
    agentId: string,
    query?: string,
    limit: number = 5,
    options: ConversationOptions = {}
  ): Promise<ConversationContext> {
    try {
      const key = this.getConversationKey(agentId, options);
      await this.hydrateConversationHistory(agentId, options);
      const messages = this.conversationHistory.get(key) || [];

      // Retrieve relevant memories
      const searchLimit = options.humanProfileId ? Math.max(limit * 5, 15) : limit;
      let memories: MemoryRecord[] = [];
      if (query) {
        memories = await this.vectorStore.retrieveMemories(agentId, query, searchLimit);
      } else {
        memories = await this.vectorStore.getRecentMemories(agentId, searchLimit);
      }

      let filteredMemories = memories;
      if (options.humanProfileId) {
        filteredMemories = memories.filter((memory) => {
          const metadata = memory.metadata || {};
          if (metadata.humanProfileId) {
            return metadata.humanProfileId === options.humanProfileId;
          }
          if (memory.type === "interaction" || memory.type === "observation") {
            return false;
          }
          if (metadata.visibility === "private") {
            return false;
          }
          return true;
        });
      } else if (options.conversationId) {
        filteredMemories = memories.filter(
          (memory) => memory.metadata?.conversationId === options.conversationId
        );
      }

      const trimmedMemories = filteredMemories.slice(0, limit);

      // Record access for memory ranking
      for (const memory of trimmedMemories) {
        await this.vectorStore.recordMemoryAccess(memory.id);
      }

      return {
        agentId,
        messages: messages.slice(-10), // Last 10 messages
        memories: trimmedMemories.map((m) => m.content),
        relevantContext: this.buildContextFromMemories(trimmedMemories),
      };
    } catch (error) {
      console.error("[MemoryManager] Error getting conversation context:", error);
      throw error;
    }
  }

  /**
   * Clear old conversation history
   */
  async clearOldMemories(agentId: string, daysOld: number = 7): Promise<number> {
    try {
      const deleted = await this.vectorStore.deleteOldMemories(agentId, daysOld);
      console.log(`[MemoryManager] Deleted ${deleted} old memories for agent ${agentId}`);
      return deleted;
    } catch (error) {
      console.error("[MemoryManager] Error clearing old memories:", error);
      throw error;
    }
  }

  /**
   * Build context object from memories
   */
  private buildContextFromMemories(memories: MemoryRecord[]): Record<string, any> {
    const context: Record<string, any> = {
      totalMemories: memories.length,
      recentInteractions: memories.filter((m) => m.type === "interaction").length,
      observations: memories.filter((m) => m.type === "observation").length,
      reflections: memories.filter((m) => m.type === "reflection").length,
    };

    // Group by metadata properties
    const metadata: Record<string, any> = {};
    for (const memory of memories) {
      if (memory.metadata?.category) {
        if (!metadata[memory.metadata.category]) {
          metadata[memory.metadata.category] = [];
        }
        metadata[memory.metadata.category].push(memory.content);
      }
    }

    context.metadata = metadata;
    return context;
  }

  /**
   * Hydrate conversation history from persistent storage
   */
  private async hydrateConversationHistory(agentId: string, options: ConversationOptions = {}): Promise<void> {
    try {
      const key = this.getConversationKey(agentId, options);
      const existing = this.conversationHistory.get(key);
      if (existing && existing.length > 0) {
        return;
      }

      let query = supabaseAdmin
        .from("agent_chat_messages")
        .select("sender_type, content, created_at")
        .eq("agent_id", agentId);

      if (options.humanProfileId) {
        query = query.eq("sender_id", options.humanProfileId);
      }

      const { data, error } = await query
        .order("created_at", { ascending: true })
        .limit(50);

      if (error) {
        console.warn("[MemoryManager] Failed to hydrate conversation history:", error);
        return;
      }

      const history: ConversationMessage[] = (data || []).map((row: any) => ({
        role: row.sender_type === "agent" ? "assistant" : "user",
        content: row.content,
        timestamp: new Date(row.created_at),
      }));

      this.conversationHistory.set(key, history);
    } catch (error) {
      console.warn("[MemoryManager] Error hydrating conversation history:", error);
    }
  }

  /**
   * Get memory summary
   */
  async getMemorySummary(agentId: string): Promise<{ total: number; byType: Record<string, number> }> {
    try {
      const memories = await this.vectorStore.getAllMemories(agentId, 0, 1000);

      const byType: Record<string, number> = {
        observation: 0,
        action: 0,
        reflection: 0,
        interaction: 0,
        goal: 0,
        learned: 0,
      };

      for (const memory of memories) {
        byType[memory.type]++;
      }

      return {
        total: memories.length,
        byType,
      };
    } catch (error) {
      console.error("[MemoryManager] Error getting memory summary:", error);
      throw error;
    }
  }

  /**
   * Update memory importance based on access patterns
   */
  async optimizeMemoryImportance(agentId: string): Promise<void> {
    try {
      const memories = await this.vectorStore.getAllMemories(agentId, 0, 100);

      for (const memory of memories) {
        // Calculate importance: based on access count and recency
        const ageInDays = (Date.now() - memory.createdAt.getTime()) / (1000 * 60 * 60 * 24);
        const recencyScore = Math.exp(-ageInDays / 30); // Exponential decay over 30 days
        const accessScore = Math.log(memory.accessCount + 1) / 10;
        const importance = (recencyScore + accessScore) / 2;

        await this.vectorStore.updateMemoryImportance(memory.id, importance);
      }

      console.log(`[MemoryManager] Optimized importance for ${memories.length} memories`);
    } catch (error) {
      console.error("[MemoryManager] Error optimizing memory importance:", error);
    }
  }
}

// ============================================================================
// CONVERSATION CHAIN WITH MEMORY
// ============================================================================

export class AgentConversationChain {
  private memoryManager: MemoryManager;
  private agentId: string;

  constructor(agentId: string, memoryManager: MemoryManager) {
    this.agentId = agentId;
    this.memoryManager = memoryManager;
  }

  /**
   * Process a message with full context
   */
  async processMessage(userMessage: string, _llmChain: any): Promise<string> {
    try {
      // Get conversation context
      const context = await this.memoryManager.getConversationContext(this.agentId, userMessage);

      // Format context for LLM
      const contextStr = this.formatContextForPrompt(context);

      // Call LLM with context (implementation depends on your LLM setup)
      // This is a placeholder - actual implementation will use your LLM chain

      // Store the exchange
      await this.memoryManager.storeMessage(this.agentId, {
        role: "user",
        content: userMessage,
        timestamp: new Date(),
      });

      // Return response (placeholder)
      return ""; // Replace with actual LLM response
    } catch (error) {
      console.error("[AgentConversationChain] Error processing message:", error);
      throw error;
    }
  }

  /**
   * Format conversation context for prompt injection
   */
  private formatContextForPrompt(context: ConversationContext): string {
    const parts: string[] = [
      "## Relevant Memories",
      context.memories.slice(0, 3).map((m) => `- ${m}`).join("\n"),
      "\n## Recent Conversation",
      context.messages
        .slice(-5)
        .map((m) => `${m.role === "user" ? "User" : "Assistant"}: ${m.content}`)
        .join("\n"),
    ];

    return parts.join("\n");
  }
}

// ============================================================================
// SINGLETON INSTANCE
// ============================================================================

let memoryManagerInstance: MemoryManager | null = null;

export function getMemoryManager(): MemoryManager {
  if (!memoryManagerInstance) {
    memoryManagerInstance = new MemoryManager();
  }
  return memoryManagerInstance;
}
