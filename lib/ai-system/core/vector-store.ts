/**
 * Vector Store Module
 * Handles persistent vector storage with Supabase pgvector
 */

import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { VectorStoreConfig, VectorSearchQuery, VectorSearchResult, MemoryRecord, MemoryType } from "../types";
import { generateEmbedding } from "../embeddings";

// ============================================================================
// CONFIGURATION
// ============================================================================

const DEFAULT_CONFIG: VectorStoreConfig = {
  provider: "supabase",
  tableName: "agent_memories",
  dimensions: 1536,
  similarityThreshold: 0.5,
};

// ============================================================================
// VECTOR STORE CLASS
// ============================================================================

export class VectorStore {
  private config: VectorStoreConfig;
  private columnCache: Record<string, boolean>;

  constructor(config: Partial<VectorStoreConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.columnCache = {};
  }

  private async columnExists(column: string): Promise<boolean> {
    if (this.columnCache[column] !== undefined) {
      return this.columnCache[column];
    }

    const fallbackCheck = async (): Promise<boolean> => {
      try {
        const { error } = await supabaseAdmin
          .from(this.config.tableName)
          .select(column)
          .limit(1);

        if (error) {
          const message = typeof error.message === "string" ? error.message : "";
          if (message.includes("column") && message.includes("does not exist")) {
            this.columnCache[column] = false;
            return false;
          }
          console.warn(`[VectorStore] Column check fallback failed for ${column}:`, error.message || error);
          this.columnCache[column] = false;
          return false;
        }

        this.columnCache[column] = true;
        return true;
      } catch (error) {
        console.warn(`[VectorStore] Column check fallback error for ${column}:`, error);
        this.columnCache[column] = false;
        return false;
      }
    };

    try {
      const { data, error } = await supabaseAdmin.rpc("has_table_column", {
        p_schema: "public",
        p_table: this.config.tableName,
        p_column: column,
      });

      if (error) {
        const message = typeof error.message === "string" ? error.message : "";
        const code = typeof (error as any).code === "string" ? (error as any).code : "";
        if (code === "PGRST202" || message.includes("schema cache") || message.includes("has_table_column")) {
          return fallbackCheck();
        }
        console.warn(`[VectorStore] Failed to check column ${column}:`, error.message || error);
        this.columnCache[column] = false;
        return false;
      }

      const exists = Array.isArray(data)
        ? Boolean(data[0]?.found ?? data[0])
        : Boolean(data);

      this.columnCache[column] = exists;
      return exists;
    } catch (error) {
      console.warn(`[VectorStore] Error checking column ${column}:`, error);
      this.columnCache[column] = false;
      return false;
    }
  }

  /**
   * Store a memory with embedding
   */
  async storeMemory(
    userId: string,
    content: string,
    type: MemoryType,
    metadata: Record<string, any> = {},
    importance: number = 0.5
  ): Promise<MemoryRecord> {
    try {
      let embedding: number[] | null = null;

      try {
        embedding = await generateEmbedding(content);
      } catch (embeddingError: any) {
        const isRateLimitError =
          embeddingError?.statusCode === 429 ||
          embeddingError?.status === 429 ||
          (embeddingError?.message && embeddingError.message.includes("Rate limit"));

        if (isRateLimitError) {
          console.warn(
            "[VectorStore] Embedding generation failed due to rate limit. Storing memory without embedding."
          );
        } else {
          console.error("[VectorStore] Embedding generation failed:", embeddingError);
        }
      }

      const now = new Date().toISOString();
      const importanceSupported = await this.columnExists("importance");
      const accessCountSupported = await this.columnExists("access_count");
      const lastAccessedSupported = await this.columnExists("last_accessed_at");

      const payload: Record<string, any> = {
        user_id: userId,
        content,
        type,
        metadata,
        created_at: now,
      };

      if (embedding) {
        payload.embedding = embedding;
      }

      if (importanceSupported) {
        payload.importance = importance;
      }

      if (accessCountSupported) {
        payload.access_count = 0;
      }

      if (lastAccessedSupported) {
        payload.last_accessed_at = now;
      }

      const { data, error } = await supabaseAdmin
        .from(this.config.tableName)
        .insert(payload)
        .select();

      if (error) throw error;

      const insertedRow = (data as any[] | null)?.[0] || {};
      return {
        id: insertedRow.id || "",
        userId,
        content,
        type,
        embedding: embedding || [],
        metadata,
        createdAt: new Date(insertedRow.created_at || now),
        importance: insertedRow.importance ?? importance,
        accessCount: insertedRow.access_count ?? 0,
        lastAccessedAt: insertedRow.last_accessed_at
          ? new Date(insertedRow.last_accessed_at)
          : new Date(insertedRow.created_at || now),
      };
    } catch (error) {
      console.error("[VectorStore] Error storing memory:", error);
      throw error;
    }
  }

  /**
   * Retrieve memories by semantic similarity
   */
  async retrieveMemories(
    userId: string,
    query: string,
    limit: number = 5,
    threshold?: number
  ): Promise<MemoryRecord[]> {
    try {
      const embedding = await generateEmbedding(query);
      return this.semanticSearch(userId, embedding, limit, threshold);
    } catch (error: any) {
      const isRateLimitError =
        error?.statusCode === 429 ||
        error?.status === 429 ||
        (error?.message && error.message.includes("Rate limit"));

      if (isRateLimitError) {
        console.warn(
          "[VectorStore] Embedding generation rate limited. Falling back to temporal retrieval."
        );
      } else {
        console.error("[VectorStore] Error retrieving memories:", error);
      }

      // Fallback to temporal retrieval
      return this.getRecentMemories(userId, limit);
    }
  }

  /**
   * Semantic search on stored memories
   */
  async semanticSearch(
    userId: string,
    embedding: number[],
    limit: number = 5,
    threshold: number = this.config.similarityThreshold
  ): Promise<MemoryRecord[]> {
    try {
      const { data, error } = await supabaseAdmin.rpc("match_agent_memories", {
        query_embedding: embedding,
        match_count: limit,
        match_threshold: threshold,
        p_user_id: userId,
      });

      if (error) {
        console.error("[VectorStore] RPC error:", error);
        throw error;
      }

      return (data || []).map((item: any) => ({
        id: item.id,
        userId: item.user_id,
        content: item.content,
        type: item.type,
        embedding: item.embedding,
        metadata: item.metadata || {},
        createdAt: new Date(item.created_at),
        importance: item.importance || 0.5,
        accessCount: item.access_count || 0,
        lastAccessedAt: new Date(item.last_accessed_at),
      }));
    } catch (error) {
      console.error("[VectorStore] Error in semantic search:", error);
      throw error;
    }
  }

  /**
   * Get recent memories (fallback when pgvector unavailable)
   */
  async getRecentMemories(userId: string, limit: number = 5): Promise<MemoryRecord[]> {
    try {
      const { data, error } = await supabaseAdmin
        .from(this.config.tableName)
        .select("*")
        .eq("user_id", userId)
        .order("created_at", { ascending: false })
        .limit(limit);

      if (error) throw error;

      return (data || []).map((item: any) => ({
        id: item.id,
        userId: item.user_id,
        content: item.content,
        type: item.type,
        embedding: item.embedding || [],
        metadata: item.metadata || {},
        createdAt: new Date(item.created_at),
        importance: item.importance || 0.5,
        accessCount: item.access_count || 0,
        lastAccessedAt: new Date(item.last_accessed_at),
      }));
    } catch (error) {
      console.error("[VectorStore] Error retrieving recent memories:", error);
      throw error;
    }
  }

  /**
   * Update memory importance
   */
  async updateMemoryImportance(memoryId: string, importance: number): Promise<void> {
    try {
      const { error } = await supabaseAdmin
        .from(this.config.tableName)
        .update({ importance: Math.min(1, Math.max(0, importance)) })
        .eq("id", memoryId);

      if (error) throw error;
    } catch (error) {
      console.error("[VectorStore] Error updating memory importance:", error);
      throw error;
    }
  }

  /**
   * Update memory access stats
   */
  async recordMemoryAccess(memoryId: string): Promise<void> {
    try {
      const hasAccessCount = await this.columnExists("access_count");
      const hasLastAccess = await this.columnExists("last_accessed_at");

      if (!hasAccessCount && !hasLastAccess) {
        return;
      }

      let newCount: number | undefined;

      if (hasAccessCount) {
        const { data, error } = await supabaseAdmin
          .from(this.config.tableName)
          .select("access_count")
          .eq("id", memoryId)
          .single();

        if (error) {
          throw error;
        }

        newCount = (data?.access_count || 0) + 1;
      }

      const updatePayload: Record<string, any> = {};

      if (typeof newCount === "number") {
        updatePayload.access_count = newCount;
      }

      if (hasLastAccess) {
        updatePayload.last_accessed_at = new Date().toISOString();
      }

      if (Object.keys(updatePayload).length === 0) {
        return;
      }

      const { error } = await supabaseAdmin
        .from(this.config.tableName)
        .update(updatePayload)
        .eq("id", memoryId);

      if (error) throw error;
    } catch (error) {
      console.error("[VectorStore] Error recording memory access:", error);
    }
  }

  /**
   * Delete old memories (cleanup)
   */
  async deleteOldMemories(userId: string, daysOld: number = 30): Promise<number> {
    try {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - daysOld);

      const { error, count } = await supabaseAdmin
        .from(this.config.tableName)
        .delete({ count: "exact" })
        .eq("user_id", userId)
        .lt("created_at", cutoffDate.toISOString());

      if (error) throw error;

      return count || 0;
    } catch (error) {
      console.error("[VectorStore] Error deleting old memories:", error);
      throw error;
    }
  }

  /**
   * Get all memories for a user (paged)
   */
  async getAllMemories(userId: string, page: number = 0, pageSize: number = 50): Promise<MemoryRecord[]> {
    try {
      const { data, error } = await supabaseAdmin
        .from(this.config.tableName)
        .select("*")
        .eq("user_id", userId)
        .order("created_at", { ascending: false })
        .range(page * pageSize, (page + 1) * pageSize - 1);

      if (error) throw error;

      return (data || []).map((item: any) => ({
        id: item.id,
        userId: item.user_id,
        content: item.content,
        type: item.type,
        embedding: item.embedding || [],
        metadata: item.metadata || {},
        createdAt: new Date(item.created_at),
        importance: item.importance || 0.5,
        accessCount: item.access_count || 0,
        lastAccessedAt: new Date(item.last_accessed_at),
      }));
    } catch (error) {
      console.error("[VectorStore] Error getting all memories:", error);
      throw error;
    }
  }
}

// ============================================================================
// SINGLETON INSTANCE
// ============================================================================

let vectorStoreInstance: VectorStore | null = null;

export function getVectorStore(config?: Partial<VectorStoreConfig>): VectorStore {
  if (!vectorStoreInstance) {
    vectorStoreInstance = new VectorStore(config);
  }
  return vectorStoreInstance;
}
