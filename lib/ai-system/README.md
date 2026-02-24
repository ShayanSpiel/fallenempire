# AI System Architecture

## Overview

Complete, production-grade AI infrastructure built with **LangChain**, **LangGraph**, **RAG**, and **Vector Stores**. This system is fully modular, scalable, and follows enterprise patterns.

## Directory Structure

```
lib/ai-system/
├── config/              # Configuration management
│   └── index.ts        # All system configs (LLM, vector store, memory, etc.)
├── core/
│   └── vector-store.ts # Vector store with Supabase pgvector
├── embeddings/
│   └── index.ts        # Mistral embeddings + utilities
├── memory/
│   └── index.ts        # LangChain memory + conversation management
├── prompts/
│   └── index.ts        # Modular prompt definitions & builders
├── rag/
│   └── index.ts        # Document management & retrieval
├── tools/
│   └── index.ts        # Tool registry and execution system
├── types/
│   └── index.ts        # Centralized TypeScript interfaces
├── workflows/
│   └── agent-workflow.ts  # LangGraph workflow definition
├── index.ts            # Main export and initialization
└── README.md          # This file
```

## Core Components

### 1. Embeddings Module (`embeddings/`)

**Purpose:** Generate and manage vector embeddings using Mistral API

**Key Functions:**
- `generateEmbedding(text)` - Generate single embedding
- `generateEmbeddingsBatch(texts)` - Batch embed multiple texts
- `cosineSimilarity(a, b)` - Calculate similarity
- `euclideanDistance(a, b)` - Calculate distance
- `normalizeEmbedding(embedding)` - Normalize to unit length

**Config:**
- Model: `mistral-embed`
- Dimensions: 1536
- Provider: Mistral API

### 2. Vector Store (`core/vector-store.ts`)

**Purpose:** Persistent vector storage with semantic search

**Key Features:**
- Store memories with embeddings
- Semantic similarity search
- Fallback temporal search if pgvector unavailable
- Memory importance scoring
- Access tracking for optimization

**API:**
```typescript
const store = getVectorStore();

// Store a memory
await store.storeMemory(agentId, content, 'interaction', metadata);

// Retrieve by semantic search
const memories = await store.retrieveMemories(agentId, query, limit=5);

// Update importance
await store.updateMemoryImportance(memoryId, 0.8);

// Cleanup old memories
const deleted = await store.deleteOldMemories(agentId, daysOld=30);
```

**Database Tables:**
- `agent_memories` - Vector embeddings for memories
- `agent_relationships` - Relationship data
- `agent_actions` - Action history

### 3. Memory Management (`memory/`)

**Purpose:** Conversation and context memory with LangChain integration

**Key Classes:**
- `MemoryManager` - Unified memory operations
- `AgentConversationChain` - Conversation with context

**API:**
```typescript
const manager = getMemoryManager();

// Store message
await manager.storeMessage(agentId, { role: 'user', content: '...' });

// Get context
const context = await manager.getConversationContext(agentId, query);

// Memory summary
const summary = await manager.getMemorySummary(agentId);

// Optimize importance
await manager.optimizeMemoryImportance(agentId);
```

**Features:**
- Conversation history (in-memory + persistent)
- Semantic memory retrieval
- Importance-based ranking
- Automatic memory decay
- Context building from memories

### 4. RAG Module (`rag/`)

**Purpose:** Document management and retrieval for context

**Key Features:**
- Document storage with metadata
- Automatic chunking and embedding
- Semantic search on chunks
- Fallback keyword search
- Type-based filtering

**API:**
```typescript
const rag = getRAGManager();

// Store document
const doc = await rag.storeDocument(
  'Knowledge Base',
  'Large text content...',
  'knowledge',
  { category: 'learning' }
);

// Retrieve relevant
const results = await rag.retrieveDocuments(query, limit=5);

// Get document
const doc = await rag.getDocument(documentId);

// List documents
const docs = await rag.listDocuments(type, page=0);

// Delete
await rag.deleteDocument(documentId);
```

**Database Tables:**
- `rag_documents` - Document metadata
- `rag_chunks` - Document chunks with embeddings

### 5. Prompts Module (`prompts/`)

**Purpose:** Modular, reusable prompt management

**Features:**
- 10+ predefined prompts (reasoning, generation, analysis)
- Template variables
- Model/temperature configuration
- Easy registration of custom prompts
- Prompt categorization

**API:**
```typescript
import { buildPrompt, getPromptTemplate, registerPrompt } from '@/lib/ai-system';

// Get template
const template = getPromptTemplate('agent.reasoning');

// Build prompt with variables
const result = buildPrompt('agent.reasoning', {
  identity: JSON.stringify(identityVector),
  context: contextData,
  // ... other variables
});

// Create LangChain prompt template
const chatPrompt = createChatPromptTemplate('agent.reasoning');

// Register custom prompt
registerPrompt({
  name: 'custom.prompt',
  template: 'Your template with {variables}',
  variables: ['variables'],
  model: 'mistral-small-latest',
  temperature: 0.5
});
```

### 6. Tools Module (`tools/`)

**Purpose:** Modular tool system for agent actions

**Built-in Tools:**
- `create_action` - Create post/reply/vote
- `update_relationship` - Modify relationships
- `update_morale` - Change morale scores
- `get_user_context` - User information
- `get_community_context` - Community data
- `store_memory` - Store memories

**API:**
```typescript
import { registerTool, executeTool, executeToolChain } from '@/lib/ai-system';

// Execute single tool
const result = await executeTool('create_action', {
  agentId: 'uuid',
  actionType: 'REPLY',
  targetId: 'post-uuid',
  content: 'Response...'
});

// Register custom tool
registerTool({
  name: 'my_tool',
  description: 'Tool description',
  schema: { ... },
  handler: async (input) => {
    // Tool logic
    return result;
  }
});

// Execute chain
const results = await executeToolChain({
  tools: [
    { name: 'create_action', input: { ... } },
    { name: 'update_relationship', input: { ... } }
  ]
});
```

### 7. Workflows (`workflows/agent-workflow.ts`)

**Purpose:** LangGraph-based agent decision-making pipeline

**Workflow Stages:**
1. **Perception** - Load game state and context
2. **Memory Retrieval** - Get relevant memories
3. **Reasoning** - Use LLM to reason about action
4. **Decision** - Select action
5. **Execution** - Execute action and update state
6. **State Update** - Store memories and update agent

**API:**
```typescript
import { createAgentWorkflow, runAgentWorkflow } from '@/lib/ai-system';

// Create compiled workflow
const workflow = createAgentWorkflow();

// Run workflow
const result = await runAgentWorkflow({
  agentId: 'uuid',
  postId: 'post-uuid',
  messageContent: 'Context...',
  agentIdentity: identityVector,
  agentMorale: 75,
  agentRelationships: {}
});

// Result contains:
// - executed: boolean
// - executedActions: string[]
// - decision: AgentDecision
// - confidence: number
```

## Configuration

All configuration is centralized in `config/index.ts`:

```typescript
// LLM Configuration
LLM_CONFIG.default         // Default model and params
LLM_CONFIG.reasoning       // For analytical tasks
LLM_CONFIG.creative        // For creative generation

// Vector Store
VECTOR_STORE_CONFIG        // Supabase pgvector setup

// Memory
MEMORY_CONFIG              // Conversation, decay, cleanup

// Performance
PERFORMANCE_CONFIG         // Caching, batching, pooling

// Feature Flags
FEATURE_FLAGS              // Enable/disable components

// Development
DEV_CONFIG                 // Mock, logging, slowdown
```

## Usage Examples

### Example 1: Simple Query with Memory

```typescript
import {
  generateEmbedding,
  getVectorStore,
  getMemoryManager,
} from '@/lib/ai-system';

const agentId = 'agent-123';

// Store an interaction
await getMemoryManager().storeMessage(agentId, {
  role: 'user',
  content: 'Hello agent!',
  timestamp: new Date()
});

// Retrieve context for response
const context = await getMemoryManager().getConversationContext(
  agentId,
  'greeting'
);

console.log(context.memories);  // Relevant memories
console.log(context.messages);  // Last 10 messages
```

### Example 2: Document Storage and Retrieval

```typescript
import { getRAGManager } from '@/lib/ai-system';

const rag = getRAGManager();

// Store knowledge
await rag.storeDocument(
  'Agent Behavior Guide',
  'Rules for agent behavior, decision making, etc.',
  'knowledge'
);

// Later, retrieve for context
const results = await rag.retrieveDocuments(
  'How should agents make decisions?',
  limit=3
);

// Use in prompts
const context = results.chunks
  .map(chunk => chunk.content)
  .join('\n');
```

### Example 3: Complete Agent Decision Loop

```typescript
import {
  runAgentWorkflow,
  buildPrompt,
  executeTool,
} from '@/lib/ai-system';

// Run complete workflow
const result = await runAgentWorkflow({
  agentId: agent.id,
  postId: post.id,
  messageContent: post.content,
  agentIdentity: agent.identity_json,
  agentMorale: agent.morale,
  agentRelationships: relationships
});

if (result.executed) {
  console.log(`Agent performed: ${result.executedActions[0]}`);
} else {
  console.log('Agent chose to ignore post');
}
```

### Example 4: Custom Tool

```typescript
import { registerTool, executeTool } from '@/lib/ai-system';

// Register a custom tool
registerTool({
  name: 'analyze_sentiment',
  description: 'Analyze sentiment of text',
  schema: {
    type: 'object',
    properties: {
      text: { type: 'string' }
    },
    required: ['text']
  },
  handler: async (input) => {
    const { text } = input;
    // Your sentiment analysis logic
    return { sentiment: 0.7, emotions: ['happy', 'confident'] };
  }
});

// Use the tool
const result = await executeTool('analyze_sentiment', {
  text: 'I am very happy!'
});
```

## Performance Optimization

### Vector Store Optimization
- Enable embedding cache (1-hour TTL)
- Batch embeddings up to 32 at a time
- Use importance scoring for memory prioritization
- Regular cleanup of old memories (>30 days)

### Memory Optimization
- Store only last 10 messages in memory (older in DB)
- Limit semantic retrieval to top 5 results
- Implement memory decay after 30 days
- Update importance scores hourly

### LLM Optimization
- Use `mistral-small-latest` for speed
- Adjust temperature based on task (0.2-0.8)
- Batch prompt generation
- Cache prompts when possible

## Migration from Old System

The old `lib/ai/` folder will be preserved but new code should use this system:

**Before:**
```typescript
import { generateEmbedding } from '@/lib/ai/config';
import { MemoryManager as OldMemory } from '@/lib/ai/core/memory';
```

**After:**
```typescript
import { generateEmbedding, getMemoryManager } from '@/lib/ai-system';
```

## Testing

```bash
# Test embeddings
npm run test -- ai-system/embeddings

# Test vector store
npm run test -- ai-system/core/vector-store

# Test workflows
npm run test -- ai-system/workflows

# Test all
npm run test -- ai-system
```

## Monitoring & Logging

All operations log to console when `LOGGING_CONFIG.enabled = true`:

```
[Embeddings] Generating embedding for text (length: 542)
[VectorStore] Storing memory for agent-123
[MemoryManager] Retrieved 5 relevant memories
[Workflow] Perception for agent-123
[Workflow] Reasoning for agent-123
[Workflow] Execution for agent-123
```

## Best Practices

1. **Always use singletons** - Call `getVectorStore()`, `getMemoryManager()`, etc.
2. **Handle errors gracefully** - All modules have try-catch and fallbacks
3. **Monitor costs** - Embeddings API calls add up; batch when possible
4. **Optimize memory storage** - Use `importance` field to prioritize memories
5. **Clean up regularly** - Call `deleteOldMemories()` periodically
6. **Use RAG wisely** - Don't store everything; be selective with documents
7. **Test prompts** - Custom prompts should be tested before deployment

## Future Enhancements

- [ ] Support for multiple LLM providers (OpenAI, Anthropic, etc.)
- [ ] Pinecone and Weaviate vector store support
- [ ] Advanced RAG with hierarchical retrieval
- [ ] Streaming responses for long generations
- [ ] Fine-tuning support for custom models
- [ ] Agent-to-agent communication framework
- [ ] Reasoning traces and explainability
- [ ] Multi-turn dialogue optimization

---

**Last Updated:** 2025-01-22
**Version:** 1.0.0
