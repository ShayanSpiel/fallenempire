/**
 * RAG (Retrieval Augmented Generation) Module
 * Document management, chunking, and retrieval
 */

import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { generateEmbedding, generateEmbeddingsBatch } from "../embeddings";
import { Document, DocumentChunk, DocumentType, RAGRetrievalResult } from "../types";

// ============================================================================
// CONFIGURATION
// ============================================================================

const CHUNK_SIZE = 500; // Characters per chunk
const CHUNK_OVERLAP = 100; // Overlap between chunks
const MIN_CHUNK_SIZE = 50; // Minimum chunk size

// ============================================================================
// RAG MANAGER CLASS
// ============================================================================

export class RAGManager {
  /**
   * Store a document with automatic chunking and embedding
   */
  async storeDocument(
    title: string,
    content: string,
    type: DocumentType,
    metadata: Record<string, any> = {}
  ): Promise<Document> {
    try {
      // Create document record
      const { data: docData, error: docError } = await supabaseAdmin
        .from("rag_documents")
        .insert({
          title,
          content,
          type,
          metadata,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .select()
        .single();

      if (docError) throw docError;
      const documentId = docData.id;

      // Chunk the document
      const chunks = this.chunkDocument(content, documentId);

      // Generate embeddings for all chunks
      const chunkTexts = chunks.map((c) => c.content);
      const embeddings = await generateEmbeddingsBatch(chunkTexts);

      // Store chunks with embeddings
      const chunkRecords = chunks.map((chunk, index) => ({
        document_id: documentId,
        content: chunk.content,
        chunk_index: chunk.chunkIndex,
        embedding: embeddings[index]?.embedding || [],
        metadata: chunk.metadata,
        created_at: new Date().toISOString(),
      }));

      const { error: chunksError } = await supabaseAdmin.from("rag_chunks").insert(chunkRecords);

      if (chunksError) throw chunksError;

      return {
        id: documentId,
        type,
        title,
        content,
        chunks: chunks.map((chunk, index) => ({
          ...chunk,
          embedding: embeddings[index]?.embedding || [],
        })),
        metadata,
        createdAt: new Date(docData.created_at),
        updatedAt: new Date(docData.updated_at),
      };
    } catch (error) {
      console.error("[RAGManager] Error storing document:", error);
      throw error;
    }
  }

  /**
   * Retrieve relevant documents for a query
   */
  async retrieveDocuments(
    query: string,
    limit: number = 5,
    threshold: number = 0.5
  ): Promise<RAGRetrievalResult> {
    try {
      const embedding = await generateEmbedding(query);

      // Use RPC for vector similarity search
      const { data, error } = await supabaseAdmin.rpc("match_rag_chunks", {
        query_embedding: embedding,
        match_count: limit,
        match_threshold: threshold,
      });

      if (error) {
        console.error("[RAGManager] RPC error:", error);
        // Fallback to keyword search
        return this.keywordSearch(query, limit);
      }

      const chunks = (data || []).map((item: any) => ({
        id: item.id,
        documentId: item.document_id,
        content: item.content,
        chunkIndex: item.chunk_index,
        embedding: item.embedding || [],
        metadata: item.metadata || {},
      }));

      const relevanceScores = (data || []).map((item: any) => item.similarity || 0);

      return {
        chunks,
        relevanceScores,
        totalRetrieved: chunks.length,
      };
    } catch (error) {
      console.error("[RAGManager] Error retrieving documents:", error);
      throw error;
    }
  }

  /**
   * Fallback keyword search
   */
  private async keywordSearch(query: string, limit: number): Promise<RAGRetrievalResult> {
    try {
      const { data, error } = await supabaseAdmin
        .from("rag_chunks")
        .select("*")
        .textSearch("content", query)
        .limit(limit);

      if (error) throw error;

      const chunks = (data || []).map((item: any) => ({
        id: item.id,
        documentId: item.document_id,
        content: item.content,
        chunkIndex: item.chunk_index,
        embedding: item.embedding || [],
        metadata: item.metadata || {},
      }));

      return {
        chunks,
        relevanceScores: chunks.map(() => 0.5),
        totalRetrieved: chunks.length,
      };
    } catch (error) {
      console.error("[RAGManager] Error in keyword search:", error);
      return { chunks: [], relevanceScores: [], totalRetrieved: 0 };
    }
  }

  /**
   * Get document by ID
   */
  async getDocument(documentId: string): Promise<Document | null> {
    try {
      const { data, error } = await supabaseAdmin
        .from("rag_documents")
        .select("*")
        .eq("id", documentId)
        .single();

      if (error) throw error;
      if (!data) return null;

      // Get chunks
      const { data: chunks, error: chunksError } = await supabaseAdmin
        .from("rag_chunks")
        .select("*")
        .eq("document_id", documentId)
        .order("chunk_index", { ascending: true });

      if (chunksError) throw chunksError;

      return {
        id: data.id,
        type: data.type,
        title: data.title,
        content: data.content,
        chunks: (chunks || []).map((chunk: any) => ({
          id: chunk.id,
          documentId: chunk.document_id,
          content: chunk.content,
          chunkIndex: chunk.chunk_index,
          embedding: chunk.embedding || [],
          metadata: chunk.metadata || {},
        })),
        metadata: data.metadata || {},
        createdAt: new Date(data.created_at),
        updatedAt: new Date(data.updated_at),
      };
    } catch (error) {
      console.error("[RAGManager] Error getting document:", error);
      throw error;
    }
  }

  /**
   * Delete document and its chunks
   */
  async deleteDocument(documentId: string): Promise<void> {
    try {
      // Delete chunks first (cascade)
      const { error: chunksError } = await supabaseAdmin.from("rag_chunks").delete().eq("document_id", documentId);

      if (chunksError) throw chunksError;

      // Delete document
      const { error: docError } = await supabaseAdmin.from("rag_documents").delete().eq("id", documentId);

      if (docError) throw docError;

      console.log(`[RAGManager] Deleted document ${documentId}`);
    } catch (error) {
      console.error("[RAGManager] Error deleting document:", error);
      throw error;
    }
  }

  /**
   * List all documents
   */
  async listDocuments(type?: DocumentType, page: number = 0, pageSize: number = 50): Promise<Document[]> {
    try {
      let query = supabaseAdmin.from("rag_documents").select("*");

      if (type) {
        query = query.eq("type", type);
      }

      const { data, error } = await query
        .order("created_at", { ascending: false })
        .range(page * pageSize, (page + 1) * pageSize - 1);

      if (error) throw error;

      return (data || []).map((doc: any) => ({
        id: doc.id,
        type: doc.type,
        title: doc.title,
        content: doc.content,
        chunks: [],
        metadata: doc.metadata || {},
        createdAt: new Date(doc.created_at),
        updatedAt: new Date(doc.updated_at),
      }));
    } catch (error) {
      console.error("[RAGManager] Error listing documents:", error);
      throw error;
    }
  }

  /**
   * Chunk document into overlapping segments
   */
  private chunkDocument(content: string, documentId: string): DocumentChunk[] {
    const chunks: DocumentChunk[] = [];
    const sentences = content.split(/(?<=[.!?])\s+/);
    let currentChunk = "";
    let chunkIndex = 0;

    for (const sentence of sentences) {
      if ((currentChunk + sentence).length > CHUNK_SIZE) {
        if (currentChunk.length >= MIN_CHUNK_SIZE) {
          chunks.push({
            id: `${documentId}-${chunkIndex}`,
            documentId,
            content: currentChunk.trim(),
            chunkIndex,
            embedding: [],
            metadata: { sentenceCount: currentChunk.split(".").length },
          });
          chunkIndex++;
          // Maintain overlap
          currentChunk = currentChunk.slice(-CHUNK_OVERLAP) + " " + sentence;
        } else {
          currentChunk += " " + sentence;
        }
      } else {
        currentChunk += " " + sentence;
      }
    }

    // Add final chunk
    if (currentChunk.length >= MIN_CHUNK_SIZE) {
      chunks.push({
        id: `${documentId}-${chunkIndex}`,
        documentId,
        content: currentChunk.trim(),
        chunkIndex,
        embedding: [],
        metadata: { isFinal: true },
      });
    }

    return chunks;
  }
}

// ============================================================================
// SINGLETON INSTANCE
// ============================================================================

let ragManagerInstance: RAGManager | null = null;

export function getRAGManager(): RAGManager {
  if (!ragManagerInstance) {
    ragManagerInstance = new RAGManager();
  }
  return ragManagerInstance;
}
