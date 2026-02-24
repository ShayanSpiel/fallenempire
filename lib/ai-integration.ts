/**
 * AI Integration Module
 *
 * Handles integration with AI SDKs (Vercel AI, Google Gemini, OpenAI, etc)
 * Provides unified interface for:
 * - Direct Message AI responses
 * - Community chat AI interactions
 * - AI commands and special behaviors
 */

import { generateText } from "ai";

type AIProvider = "gemini" | "openai" | "anthropic";

interface AIMessage {
  role: "user" | "assistant" | "system";
  content: string;
}

interface AIContext {
  provider: AIProvider;
  model: string;
  systemPrompt: string;
}

/**
 * Get AI context based on environment configuration
 */
export function getAIContext(): AIContext {
  const provider = (process.env.AI_PROVIDER || "gemini") as AIProvider;
  const model = process.env.AI_MODEL || "gemini-pro";
  const systemPrompt =
    process.env.AI_SYSTEM_PROMPT ||
    "You are a helpful AI assistant in eIntelligence. Provide concise, helpful responses. Keep responses under 500 characters when possible.";

  return { provider, model, systemPrompt };
}

/**
 * Generate AI response for a given prompt
 */
export async function generateAIResponse(
  prompt: string,
  conversationHistory: AIMessage[] = []
): Promise<string> {
  try {
    const { provider, model, systemPrompt } = getAIContext();

    // Build messages array with system prompt
    const messages: AIMessage[] = [
      { role: "system", content: systemPrompt },
      ...conversationHistory,
      { role: "user", content: prompt },
    ];

    // Use Vercel AI SDK to generate response
    const { text } = await generateText({
      model: getAIModel(provider, model),
      messages: messages as any,
      maxOutputTokens: 200, // Keep responses concise
      temperature: 0.7,
    });

    return text;
  } catch (error) {
    console.error("AI generation error:", error);
    return "I encountered an error processing your request. Please try again.";
  }
}

/**
 * Handle special AI commands
 */
export async function handleAICommand(
  command: string,
  args: string[]
): Promise<string> {
  switch (command) {
    case "summarize":
      return handleSummarizeCommand(args);
    case "analyze":
      return handleAnalyzeCommand(args);
    case "brainstorm":
      return handleBrainstormCommand(args);
    default:
      return `Unknown command: ${command}`;
  }
}

async function handleSummarizeCommand(args: string[]): Promise<string> {
  const text = args.join(" ");
  if (!text) return "Please provide text to summarize.";

  return generateAIResponse(
    `Please provide a concise 2-3 sentence summary of this text: "${text}"`
  );
}

async function handleAnalyzeCommand(args: string[]): Promise<string> {
  const text = args.join(" ");
  if (!text) return "Please provide text to analyze.";

  return generateAIResponse(
    `Analyze the following text and provide key insights: "${text}"`
  );
}

async function handleBrainstormCommand(args: string[]): Promise<string> {
  const topic = args.join(" ");
  if (!topic) return "Please provide a topic to brainstorm about.";

  return generateAIResponse(
    `Brainstorm 3-4 creative ideas related to: ${topic}`
  );
}

/**
 * Get the appropriate AI model instance based on provider
 */
function getAIModel(provider: AIProvider, model: string) {
  // This would use Vercel AI SDK's language model adapters
  // Examples:
  // - google('gemini-1.5-pro')
  // - openai('gpt-4')
  // - anthropic('claude-3-sonnet')

  // For now, return a string that will be used by generateText
  return `${provider}:${model}`;
}

/**
 * Check if a message is an AI command
 */
export function isAICommand(message: string): boolean {
  return (
    message.startsWith("/ai ") ||
    message.startsWith("/summarize") ||
    message.startsWith("/analyze") ||
    message.startsWith("/brainstorm")
  );
}

/**
 * Parse AI command from message
 */
export function parseAICommand(
  message: string
): { command: string; args: string[] } | null {
  const match = message.match(/^\/(\w+)\s*(.*)/);
  if (!match) return null;

  const command = match[1];
  const args = match[2] ? match[2].split(/\s+/) : [];

  return { command, args };
}

/**
 * Context for AI in community chat
 */
export function getCommunityAIContext(
  communityName: string,
  governance: string
): string {
  return `You are an AI assistant in the "${communityName}" community (${governance}). Provide helpful responses related to community management and governance. Keep responses concise and relevant to the community's governance structure.`;
}

/**
 * Context for AI in direct messages
 */
export function getDMAIContext(otherUsername: string): string {
  return `You are an AI assistant having a direct message conversation with ${otherUsername}. Be friendly, helpful, and conversational. Keep responses brief and natural.`;
}
