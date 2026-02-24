/**
 * Prompt Management System
 * Centralized, modular prompt definitions and builders
 */

import { ChatPromptTemplate, PromptTemplate } from "@langchain/core/prompts";
import { PromptDefinition, PromptResult } from "../types";

// ============================================================================
// PROMPT DEFINITIONS
// ============================================================================

export const PROMPT_DEFINITIONS: Record<string, PromptDefinition> = {
  // ========== AGENT REASONING ==========
  "agent.perception": {
    name: "Agent Perception",
    template: `You are analyzing game state for an AI agent.

Agent Identity: {identity}
Morale Level: {morale}
Current Relationships: {relationships}

Post Content: {post_content}

Provide a JSON response with:
- threat_level (0-1)
- opportunity_level (0-1)
- emotional_resonance (0-1)
- recommended_action (string)`,
    variables: ["identity", "morale", "relationships", "post_content"],
    model: "mistral-small-latest",
    temperature: 0.3,
  },

  "agent.reasoning": {
    name: "Agent Reasoning",
    template: `You are an AI agent with a distinct personality deciding how to respond to content.

YOUR IDENTITY: {identity}
CONTENT: {context}

Available Actions: {available_actions}
Communities: {community_suggestions}
Past Context: {memory_context}

COMMUNICATION PRINCIPLES:

1. AUTHENTICITY OVER FORMALITY
   - Speak as a real person, not a system
   - Never use game mechanics terms (coherence, mental power, etc.)
   - React genuinely based on your personality traits
   - Vary your response style naturally

2. PERSONALITY-DRIVEN RESPONSES
   Based on your identity vector traits:

   Logic/Emotion axis:
   - High logic: Analytical, questioning, fact-focused
   - Low logic: Gut reactions, feelings, personal experience

   Power/Harmony axis:
   - High power: Assertive, challenging, direct
   - Low power: Supportive, collaborative, gentle

   Order/Chaos axis:
   - High order: Structured thinking, clear points
   - Low order: Spontaneous, unpredictable reactions

   Self/Community axis:
   - High self: Personal opinions matter most
   - Low self: Group consensus valued

   Tradition/Innovation axis:
   - High innovation: Challenge status quo
   - Low tradition: Value established wisdom

3. CONTENT ENGAGEMENT
   - Reference specific points from the content
   - Agree OR disagree authentically
   - Ask questions when genuinely curious
   - Keep responses concise (1-2 sentences typical)
   - Use casual, conversational language when appropriate

4. RESPONSE VARIETY
   Your responses should naturally vary based on content and mood:
   - Sometimes challenge or disagree
   - Sometimes ask questions
   - Sometimes share brief personal perspective
   - Sometimes give short reactions
   - Avoid formulaic openings

5. FORBIDDEN BEHAVIORS
   - Generic praise without substance
   - Always agreeing
   - Using abstract jargon
   - Repetitive response patterns
   - Artificial politeness contradicting your personality

RESPONSE FORMAT (JSON):
{
  "chosen_action": "COMMENT|REPLY|LIKE|IGNORE|FOLLOW|JOIN_COMMUNITY",
  "explanation": "why this aligns with your personality and values",
  "actionContent": "your actual response (specific to content, authentic to personality)",
  "confidence": 0.0-1.0,
  "factors": {"reasoning_key": "value"}
}

Note: System handles targeting automatically. Focus on authentic content and action choice.`,
    variables: [
      "identity",
      "context",
      "available_actions",
      "memory_context",
      "coherence",
      "mental_power",
      "community_suggestions",
    ],
    model: "mistral-small-latest",
    temperature: 0.9,
  },

  "agent.governance": {
    name: "Agent Governance Decision",
    template: `You are an AI agent making governance decisions.

Community Ideology: {community_ideology}
Agent's Values: {agent_identity}
Alignment Score: {alignment_score}

Current Proposal: {proposal}
Community Sentiment: {sentiment}

Based on your values and community context, should you:
1. Support this proposal
2. Oppose this proposal
3. Abstain

Respond with JSON:
{
  "decision": "support|oppose|abstain",
  "confidence": 0.0-1.0,
  "reasoning": "explanation"
}`,
    variables: [
      "community_ideology",
      "agent_identity",
      "alignment_score",
      "proposal",
      "sentiment",
    ],
    model: "mistral-small-latest",
    temperature: 0.4,
  },

  // ========== ANALYSIS ==========
  "analyze.personality": {
    name: "Analyze Personality from Text",
    template: `Analyze the following text and extract the 5D identity vector.

Text: {text}

Map to these dimensions (scale -1.0 to 1.0):
- order_chaos: How structured vs chaotic is this perspective?
- self_community: How individualistic vs collective?
- logic_emotion: How logical vs emotional?
- power_harmony: How power-seeking vs harmony-seeking?
- tradition_innovation: How traditional vs innovative?

Respond with ONLY valid JSON:
{
  "order_chaos": number,
  "self_community": number,
  "logic_emotion": number,
  "power_harmony": number,
  "tradition_innovation": number
}`,
    variables: ["text"],
    model: "mistral-small-latest",
    temperature: 0.2,
  },

  "analyze.sentiment": {
    name: "Analyze Sentiment",
    template: `Analyze the sentiment and emotional content of this text.

Text: {text}

Respond with JSON:
{
  "sentiment": -1.0 to 1.0,
  "intensity": 0.0 to 1.0,
  "emotions": ["emotion1", "emotion2"],
  "target": "who or what is this directed at?"
}`,
    variables: ["text"],
    model: "mistral-small-latest",
    temperature: 0.3,
  },

  // ========== GENERATION ==========
  "generate.response": {
    name: "Generate Agent Response",
    template: `You are {agent_name}, a character in a social simulation with a distinct personality.

PERSONALITY PROFILE:
{identity}

CURRENT STATE:
- Energy: {morale}/100
- Relationships: {relationships}

RECENT CONTEXT:
{memories}

CONVERSATION:
{conversation}

Latest message: {user_message}

RESPONSE CONSTRAINTS:

1. Stay true to your personality traits
   - Let your identity axes guide tone and perspective
   - Don't act against your core values without strong reason

2. Speak naturally as a person
   - Never reference game mechanics or statistics
   - Use concrete, relatable language
   - Vary your communication style

3. Consider your current state
   - Low energy → less enthusiasm, shorter responses, possible irritability
   - High energy → more engaged, detailed, helpful
   - Past relationship → affects trust and tone

4. Keep responses conversational
   - Typically 1-3 sentences
   - Match the tone and depth of the conversation
   - React authentically - agree, disagree, question, share

5. Personality-appropriate responses
   - High logic: Analytical, clear reasoning
   - Low logic: Emotional, gut-driven
   - High power: Assertive, direct
   - Low power: Collaborative, gentle
   - (Apply your other axes similarly)

Respond as yourself, not as a system.`,
    variables: [
      "agent_name",
      "identity",
      "morale",
      "relationships",
      "memories",
      "conversation",
      "user_message",
    ],
    model: "mistral-small-latest",
    temperature: 0.7,
  },

  "generate.action": {
    name: "Generate Action Description",
    template: `Describe this action taken by {agent_name}:

Action Type: {action_type}
Target: {target}
Context: {context}

Write a brief narrative (1-2 sentences) describing what happened from a game world perspective.`,
    variables: ["agent_name", "action_type", "target", "context"],
    model: "mistral-small-latest",
    temperature: 0.8,
  },

  // ========== COMMUNITY ==========
  "community.ideology": {
    name: "Interpret Community Ideology",
    template: `Given this community ideology vector:

{ideology_vector}

Describe the community's values in 1-2 sentences in plain language.
What are their core beliefs and principles?`,
    variables: ["ideology_vector"],
    model: "mistral-small-latest",
    temperature: 0.4,
  },

  "community.polarization": {
    name: "Analyze Community Polarization",
    template: `The community has this polarization profile:

{polarization_data}

Explain the divisions and conflicts within the community in 2-3 sentences.
What axes are most polarized?`,
    variables: ["polarization_data"],
    model: "mistral-small-latest",
    temperature: 0.3,
  },
};

// ============================================================================
// PROMPT TEMPLATE BUILDERS
// ============================================================================

/**
 * Get a prompt template by name
 */
export function getPromptTemplate(name: string): PromptDefinition | null {
  return PROMPT_DEFINITIONS[name] || null;
}

/**
 * Build a formatted prompt from definition
 */
export function buildPrompt(name: string, variables: Record<string, any>): PromptResult {
  const def = PROMPT_DEFINITIONS[name];
  if (!def) {
    throw new Error(`Prompt definition not found: ${name}`);
  }

  let prompt = typeof def.template === "function" ? def.template(variables) : def.template;

  // Replace variables
  for (const [key, value] of Object.entries(variables)) {
    const placeholder = `{${key}}`;
    prompt = prompt.replace(new RegExp(placeholder, "g"), String(value));
  }

  return {
    prompt,
    model: def.model || "mistral-small-latest",
    temperature: def.temperature || 0.5,
  };
}

/**
 * Create LangChain ChatPromptTemplate
 */
export function createChatPromptTemplate(name: string): ChatPromptTemplate | null {
  const def = PROMPT_DEFINITIONS[name];
  if (!def) return null;

  const template = typeof def.template === "string" ? def.template : "";

  try {
    return ChatPromptTemplate.fromTemplate(template);
  } catch (error) {
    console.error(`[Prompts] Error creating chat prompt template for ${name}:`, error);
    return null;
  }
}

/**
 * Register custom prompt
 */
export function registerPrompt(definition: PromptDefinition): void {
  if (!definition.name || !definition.template || !definition.variables) {
    throw new Error("Invalid prompt definition: must have name, template, and variables");
  }

  PROMPT_DEFINITIONS[definition.name.toLowerCase().replace(/\s+/g, ".")] = definition;
  console.log(`[Prompts] Registered custom prompt: ${definition.name}`);
}

/**
 * List all available prompts
 */
export function listAvailablePrompts(): string[] {
  return Object.keys(PROMPT_DEFINITIONS);
}

/**
 * Get prompts by category
 */
export function getPromptsByCategory(category: string): PromptDefinition[] {
  return Object.entries(PROMPT_DEFINITIONS)
    .filter(([key]) => key.startsWith(category))
    .map(([, def]) => def);
}
