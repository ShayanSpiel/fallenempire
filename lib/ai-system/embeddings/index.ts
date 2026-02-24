/**
 * Unified Embeddings Module
 * Handles all embedding generation with multiple provider support
 */

import { Mistral } from "@mistralai/mistralai";
import { EmbeddingResult, EmbeddingConfig } from "../types";

// ============================================================================
// CONFIGURATION
// ============================================================================

const DEFAULT_CONFIG: EmbeddingConfig = {
  model: "mistral-embed",
  dimension: 1536,
  provider: "mistral",
};

// ============================================================================
// SINGLETON INSTANCE
// ============================================================================

let mistralClient: Mistral | null = null;

function getMistralClient(): Mistral {
  if (!mistralClient) {
    mistralClient = new Mistral({
      apiKey: process.env.MISTRAL_API_KEY,
    });
  }
  return mistralClient;
}

// ============================================================================
// RATE LIMITING
// ============================================================================

interface RateLimiterConfig {
  requestsPerMinute: number;
  maxRetries: number;
  baseDelayMs: number;
}

class RateLimiter {
  private queue: Array<() => void> = [];
  private processing = false;
  private requestTimestamps: number[] = [];
  private config: RateLimiterConfig;

  constructor(config: RateLimiterConfig) {
    this.config = config;
  }

  async throttle<T>(fn: () => Promise<T>): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      this.queue.push(async () => {
        try {
          const result = await this.executeWithRetry(fn);
          resolve(result);
        } catch (error) {
          reject(error);
        }
      });
      this.processQueue();
    });
  }

  private async executeWithRetry<T>(
    fn: () => Promise<T>,
    retryCount = 0
  ): Promise<T> {
    try {
      return await fn();
    } catch (error: any) {
      const isRateLimitError =
        error?.statusCode === 429 ||
        error?.status === 429 ||
        (error?.message && error.message.includes("Rate limit"));

      if (isRateLimitError && retryCount < this.config.maxRetries) {
        const delay = this.config.baseDelayMs * Math.pow(2, retryCount);
        const jitter = Math.random() * 1000;
        const totalDelay = delay + jitter;

        console.warn(
          `[Embeddings] Rate limited. Retry ${retryCount + 1}/${this.config.maxRetries} after ${Math.round(totalDelay)}ms`
        );

        await this.sleep(totalDelay);
        return this.executeWithRetry(fn, retryCount + 1);
      }

      throw error;
    }
  }

  private async processQueue(): Promise<void> {
    if (this.processing) return;
    this.processing = true;

    while (this.queue.length > 0) {
      await this.waitForSlot();
      const task = this.queue.shift();
      if (task) {
        this.requestTimestamps.push(Date.now());
        await task();
      }
    }

    this.processing = false;
  }

  private async waitForSlot(): Promise<void> {
    this.cleanOldTimestamps();

    while (this.requestTimestamps.length >= this.config.requestsPerMinute) {
      const oldestRequest = this.requestTimestamps[0];
      const timeSinceOldest = Date.now() - oldestRequest;
      const timeToWait = Math.max(0, 60000 - timeSinceOldest);

      if (timeToWait > 0) {
        console.log(
          `[Embeddings] Rate limit approaching. Waiting ${Math.round(timeToWait)}ms...`
        );
        await this.sleep(timeToWait);
      }

      this.cleanOldTimestamps();
    }
  }

  private cleanOldTimestamps(): void {
    const oneMinuteAgo = Date.now() - 60000;
    this.requestTimestamps = this.requestTimestamps.filter(
      (timestamp) => timestamp > oneMinuteAgo
    );
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}

// Initialize rate limiter - conservative limit to avoid hitting 60/min
const rateLimiter = new RateLimiter({
  requestsPerMinute: 45, // Leave buffer below Mistral's 60/min limit
  maxRetries: 3,
  baseDelayMs: 2000, // 2s, 4s, 8s exponential backoff
});

// ============================================================================
// CORE EMBEDDING FUNCTIONS
// ============================================================================

/**
 * Generate embedding for a single text using Mistral
 */
export async function generateEmbedding(
  text: string,
  config: EmbeddingConfig = DEFAULT_CONFIG
): Promise<number[]> {
  if (!text || text.trim().length === 0) {
    throw new Error("Text cannot be empty");
  }

  return rateLimiter.throttle(async () => {
    try {
      const client = getMistralClient();
      const response = await client.embeddings.create({
        model: config.model,
        inputs: [text.replace(/\n/g, " ")],
      });

      const embedding = response.data[0]?.embedding;
      if (!embedding || embedding.length === 0) {
        throw new Error("No embedding returned from API");
      }

      return embedding;
    } catch (error) {
      console.error("[Embeddings] Error generating embedding:", error);
      throw error;
    }
  });
}

/**
 * Generate embeddings for multiple texts (batch)
 */
export async function generateEmbeddingsBatch(
  texts: string[],
  config: EmbeddingConfig = DEFAULT_CONFIG
): Promise<EmbeddingResult[]> {
  if (texts.length === 0) {
    return [];
  }

  return rateLimiter.throttle(async () => {
    try {
      const client = getMistralClient();
      const cleanedTexts = texts.map((t) => t.replace(/\n/g, " "));

      const response = await client.embeddings.create({
        model: config.model,
        inputs: cleanedTexts,
      });

      return response.data.map((item, index) => ({
        text: texts[index],
        embedding: item.embedding || [],
        model: config.model,
        tokens: Math.ceil((texts[index].length / 4) * 1.3), // Rough estimation
      }));
    } catch (error) {
      console.error("[Embeddings] Error generating batch embeddings:", error);
      throw error;
    }
  });
}

/**
 * Get embedding configuration
 */
export function getEmbeddingConfig(): EmbeddingConfig {
  return DEFAULT_CONFIG;
}

/**
 * Calculate cosine similarity between two embeddings
 */
export function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length) {
    throw new Error("Embeddings must have same dimension");
  }

  let dotProduct = 0;
  let magnitudeA = 0;
  let magnitudeB = 0;

  for (let i = 0; i < a.length; i++) {
    dotProduct += a[i] * b[i];
    magnitudeA += a[i] * a[i];
    magnitudeB += b[i] * b[i];
  }

  magnitudeA = Math.sqrt(magnitudeA);
  magnitudeB = Math.sqrt(magnitudeB);

  if (magnitudeA === 0 || magnitudeB === 0) {
    return 0;
  }

  return dotProduct / (magnitudeA * magnitudeB);
}

/**
 * Calculate euclidean distance between two embeddings
 */
export function euclideanDistance(a: number[], b: number[]): number {
  if (a.length !== b.length) {
    throw new Error("Embeddings must have same dimension");
  }

  let sum = 0;
  for (let i = 0; i < a.length; i++) {
    const diff = a[i] - b[i];
    sum += diff * diff;
  }

  return Math.sqrt(sum);
}

/**
 * Normalize embedding to unit length
 */
export function normalizeEmbedding(embedding: number[]): number[] {
  const magnitude = Math.sqrt(embedding.reduce((sum, val) => sum + val * val, 0));
  if (magnitude === 0) return embedding;
  return embedding.map((val) => val / magnitude);
}

/**
 * Validate embedding dimensions
 */
export function validateEmbeddingDimension(
  embedding: number[],
  expectedDimension: number = DEFAULT_CONFIG.dimension
): boolean {
  return embedding.length === expectedDimension && embedding.every((val) => typeof val === "number");
}
