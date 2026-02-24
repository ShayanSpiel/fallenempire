/**
 * REASON NODE - Tool-Augmented Reasoning
 * LLM reasons with native tool calling to gather context and make decisions
 * Supports multi-step planning
 */

import type { WorkflowState, WorkflowReasoning, ToolExecutionContext } from "../core/types";
import { getLLMManager } from "../llm/manager";
import { getToolsAsLLMFunctions, executeTool } from "../tools/registry";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { recordCoherence } from "../services/influence";
import { calculateCoherence, getPsychologyContext, type IdentityVector } from "@/lib/psychology";
import { startNodeTrace, endNodeTrace, traceLLMCall } from "../tracing/langsmith";

export async function reasonNode(state: WorkflowState): Promise<Partial<WorkflowState>> {
  const startTime = Date.now();
  const nodeTraceId = await startNodeTrace("reason", state);

  try {
    await recordUserCoherenceForAIInteraction(state);

    const llmManager = getLLMManager();

    const toolCache = (state.metadata.toolCache || {}) as Record<string, any>;

    // Build tool execution context
    const subjectData = state.scope.subject?.data ?? {};
    const toolContext: ToolExecutionContext = {
      agentId: state.scope.actor.id,
      conversationId: state.scope.conversationId,
      triggerId: `${state.scope.trigger.type}:${state.scope.trigger.event || state.scope.trigger.schedule}`,
      metadata: {
        subjectId: state.scope.subject?.id,
        subjectType: state.scope.subject?.type,
        postId: state.scope.subject?.type === "post" ? state.scope.subject.id : undefined,
        userId:
          (typeof subjectData.mentioner_id === "string" && subjectData.mentioner_id) ||
          (typeof subjectData.sender_id === "string" && subjectData.sender_id) ||
          (typeof subjectData.commenterId === "string" && subjectData.commenterId) ||
          undefined,
      },
    };

    // DEBUG: Check if observation exists
    console.log(`[Reason] Has observation: ${!!state.observation}`);
    console.log(`[Reason] Observation contextSummary length: ${state.observation?.contextSummary?.length || 0}`);
    console.log(`[Reason] Observation contextSummary preview:`, state.observation?.contextSummary?.substring(0, 200));

    // Build system and user prompts
    const systemPrompt = buildSystemPrompt(state);
    const userPrompt = buildUserPrompt(state);

    console.log(`[Reason] User prompt preview:`, userPrompt.substring(0, 200));

    // Only pass a small set of DATA tools into the tool-calling phase to avoid paying
    // token costs for irrelevant tool schemas (actions are executed in Act node).
    const toolDefinitions = getToolsAsLLMFunctions({
      categories: ["data"],
      names: selectDataToolNamesForState(state),
    });

    console.log(`[Reason] Starting reasoning with ${toolDefinitions.length} available tools`);

    // PHASE 1: Initial reasoning with tool calls
    const llmStartTime = Date.now();
    const llmResponse = await llmManager.complete({
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      tools: toolDefinitions,
      temperature: 0.7,
      maxTokens: 1500,
    });
    const llmDuration = Date.now() - llmStartTime;

    console.log(`[Reason] LLM response received. Tool calls: ${llmResponse.toolCalls?.length || 0}`);

    // Trace initial LLM call
    traceLLMCall(
      llmResponse.model || "mistral-small-latest",
      [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      toolDefinitions,
      llmResponse,
      llmDuration
    );

    // If no tool calls, try to parse decision from first response
    if (!llmResponse.toolCalls || llmResponse.toolCalls.length === 0) {
      console.log(`[Reason] No tool calls made, parsing decision from first response`);
      const decision = parseDecision(llmResponse.content);
      console.log(`[Reason] Decision: ${decision.action} with confidence ${decision.confidence}`);

      // End node trace with outputs
      endNodeTrace(nodeTraceId, {
        decision: decision.action,
        confidence: decision.confidence,
        tool_calls: 0,
        has_plan: (decision.plan?.length || 0) > 0,
        plan_length: decision.plan?.length || 0,
      });

      const reasoning: WorkflowReasoning = {
        observation: state.observation?.contextSummary || "No observation",
        thinkingProcess: llmResponse.content || "No reasoning",
        toolCalls: [],
        toolResults: [],
        decision: decision.action,
        confidence: decision.confidence,
        alternativeOptions: decision.alternatives || [],
        factors: decision.factors || {},
        explanation: decision.reasoning,
      };

      // Record identity observation if interacting with a user
      const trigger = state.scope.trigger;
      const subject = state.scope.subject;
      if (trigger.event === "chat" && subject?.id) {
        const messageContent = state.observation?.contextSummary || "";
        recordIdentityObservation(
          state.scope.actor.id,
          subject.id,
          messageContent,
          decision.reasoning,
          decision.confidence
        ).catch((err) => {
          console.error("[Reason] Failed to record identity observation:", err);
        });
      }

      // Extract target from args or fallback to subject data
      const target = extractTarget(decision.args, state.scope.subject);

      return {
        step: "act",
        reasoning,
        action: {
          type: decision.action,
          target,
          content: decision.args?.content,
          metadata: {
            args: decision.args,
            plan: decision.plan || [],
            confidence: decision.confidence,
          },
          goalAchieved: false,
        },
        metadata: {
          ...state.metadata,
          llmTokensUsed: llmResponse.tokensUsed || 0,
          toolCallCount: 0,
          reasoningTime: Date.now() - startTime,
          toolCache: state.metadata.toolCache || {},
        },
      };
    }

    // PHASE 2: Execute tool calls if any
    let toolResults: Array<{
      tool_call_id: string;
      tool_name: string;
      result: any;
    }> = [];
    if (llmResponse.toolCalls && llmResponse.toolCalls.length > 0) {
      console.log(`[Reason] Executing ${llmResponse.toolCalls.length} tool calls`);

      const executions = llmResponse.toolCalls.map(async (toolCall) => {
        const toolName = toolCall.function.name;
        const args = toolCall.function.arguments;
        const cacheKey = `${toolName}:${stableStringify(args)}`;

        if (toolCache[cacheKey]) {
          const cached = toolCache[cacheKey];
          console.log(`[Reason] Using cached tool result: ${toolName}`);
          return {
            tool_call_id: toolCall.id,
            tool_name: toolName,
            result: cached,
          };
        }

        console.log(`[Reason] Executing tool: ${toolName} with args:`, args);
        const result = await executeTool(toolName, args, toolContext);
        toolCache[cacheKey] = result;
        console.log(`[Reason] Tool ${toolName} ${result.success ? "succeeded" : "failed"}`);

        return {
          tool_call_id: toolCall.id,
          tool_name: toolName,
          result,
        };
      });

      toolResults = await Promise.all(executions);
    }

    // PHASE 3: Final decision based on tool results
    const messages = [
      { role: "system", content: systemPrompt },
      { role: "user", content: userPrompt },
    ];

    // Add tool calls and results if any
    if (llmResponse.toolCalls && llmResponse.toolCalls.length > 0) {
      const toolResultsBlock = toolResults
        .map((tr) => `Tool ${tr.tool_name} result:\n${summarizeToolResultForPrompt(tr.tool_name, tr.result)}`)
        .join("\n\n");

      messages.push({ role: "user", content: toolResultsBlock });

      // Add decision prompt
      messages.push({
        role: "user",
        content: `Based on the information gathered, what should you do?

Respond with a JSON object in this exact format:
{
  "action": "tool_name_to_call",
  "args": { "param1": "value1", "param2": "value2" },
  "reasoning": "explain your decision",
  "confidence": 0.8,
  "plan": [
    {"step": 1, "tool": "tool_name", "args": {}, "description": "what this does"},
    {"step": 2, "tool": "another_tool", "args": {}, "description": "next step"}
  ]
}

Available action tools:
• Communication: send_message, reply, comment, create_post, send_group_message
• Social: like, follow
• Community: join_community, leave_community
• Action: join_battle (requires battleId + energyAmount), do_work, buy_item, consume_item
• Governance: vote_on_proposal, create_proposal
• Special: decline, ignore

═══════════════════════════════════════════════════════════════
ACTION SELECTION PRINCIPLES
═══════════════════════════════════════════════════════════════

You must choose actions that MATCH YOUR DECISION, not just communicate about it.

UNDERSTAND THE DIFFERENCE:
• COMMENTING about doing something ≠ DOING something
• "I'm in!" (comment) ≠ Actually joining (join_battle)
• "I'll help" (comment) ≠ Actually helping (action tool)

ACTION MATCHING FRAMEWORK:

1. IDENTIFY WHAT YOU DECIDED TO DO (not just say):
   • Decided to join battle? → Use 'join_battle' tool
   • Decided to accept proposal? → Use 'vote_on_proposal' tool
   • Decided to help community? → Use appropriate action tool
   • Decided to decline? → Use 'comment' (post) or 'decline' (DM) with honest reason
   • Decided to just respond? → Use 'comment' (post) or 'reply' (DM)

2. EXTRACT PARAMETERS FROM CONTEXT:
   • Battle invites often contain URLs: "battle/BATTLE_ID" → extract BATTLE_ID
   • Proposals mention proposal_id → extract from conversation
   • Community asks mention community_id → check context or get_community_details
   • Energy amounts: Choose based on commitment (20=low, 40=standard, 60=high)

3. CONTEXT-SPECIFIC TOOLS:
   • Post mentions → Use 'comment' (postId auto-filled from context)
   • Direct messages → Use 'reply' (conversationId auto-filled - do NOT pass it) or 'send_message' (for new DMs - requires userId/recipientId)
   • Group chats → Use 'send_group_message'

4. COMBINATION ACTIONS:
   • You CAN use multiple tools if appropriate
   • Example: join_battle(args) THEN comment("@user Let's do this!")
   • Example: vote_on_proposal(args) THEN comment("@author I support this")
   • DON'T duplicate - if you're commenting, don't also decline

CRITICAL REMINDERS:
• If accepting request → Use ACTION tool (join_battle, vote_on_proposal, etc.)
• If declining request → Use 'comment' with honest reason (post) or 'decline' (DM)
• If just chatting → Use 'comment' (post) or 'reply' (DM)
• Battle ID extraction: Look for "battle/UUID" pattern in message content
• Energy commitment: Never exceed your current energy level

REASONING PROCESS:
1. What am I deciding to DO? (not just say)
2. What tool DOES that action?
3. What parameters does that tool need?
4. Can I extract those from context/message?
5. Do I have the capacity/resources?
6. Execute the matching tool(s)`,
      });
    }

    // Final LLM call for decision
    console.log(`[Reason] Making final decision`);
    const finalStartTime = Date.now();
    const finalResponse = await llmManager.complete({
      messages: messages as any, // Type assertion for compatibility
      temperature: 0.5,
      maxTokens: 800,
    });
    const finalDuration = Date.now() - finalStartTime;

    console.log(`[Reason] Final response received`);

    // Trace final LLM call
    traceLLMCall(
      finalResponse.model || "mistral-small-latest",
      messages as any,
      [],
      finalResponse,
      finalDuration
    );

    // Parse decision
    const decision = parseDecision(finalResponse.content);

    console.log(`[Reason] Decision: ${decision.action} with confidence ${decision.confidence}`);

    // End node trace with outputs
    endNodeTrace(nodeTraceId, {
      decision: decision.action,
      confidence: decision.confidence,
      tool_calls: llmResponse.toolCalls?.length || 0,
      has_plan: (decision.plan?.length || 0) > 0,
      plan_length: decision.plan?.length || 0,
    });

    const reasoning: WorkflowReasoning = {
      observation: state.observation?.contextSummary || "No observation",
      thinkingProcess: llmResponse.content || "No initial reasoning",
      toolCalls: llmResponse.toolCalls || [],
      toolResults: toolResults.map((r) => ({
        tool_call_id: r.tool_call_id,
        content: JSON.stringify(r.result),
      })),
      decision: decision.action,
      confidence: decision.confidence,
      alternativeOptions: decision.alternatives || [],
      factors: decision.factors || {},
      explanation: decision.reasoning,
    };

    // Record identity observation if interacting with a user
    // AI agent observes user based on message content and reasoning
    const trigger = state.scope.trigger;
    const subject = state.scope.subject;
    if (trigger.event === "chat" && subject?.id) {
      // Extract message content from observation
      const messageContent = state.observation?.contextSummary || "";

      // Record observation asynchronously (don't block workflow)
      recordIdentityObservation(
        state.scope.actor.id, // Observer (AI agent)
        subject.id, // Observed (user)
        messageContent,
        decision.reasoning,
        decision.confidence
      ).catch((err) => {
        console.error("[Reason] Failed to record identity observation:", err);
      });
    }

    // Extract target from args or fallback to subject data
    const target = extractTarget(decision.args, state.scope.subject);

    return {
      step: "act",
      reasoning,
      // Store plan for multi-step execution
      action: {
        type: decision.action,
        target,
        content: decision.args?.content,
        metadata: {
          args: decision.args,
          plan: decision.plan || [],
          confidence: decision.confidence,
        },
        goalAchieved: false, // Will be determined by act/loop
      },
      metadata: {
        ...state.metadata,
        llmTokensUsed: (llmResponse.tokensUsed || 0) + (finalResponse.tokensUsed || 0),
        toolCallCount: llmResponse.toolCalls?.length || 0,
        reasoningTime: Date.now() - startTime,
        toolCache,
      },
    };
  } catch (error: any) {
    console.error(`[Reason] Error during reasoning:`, error);
    endNodeTrace(nodeTraceId, {}, error.message);
    return {
      step: "complete",
      errors: [
        ...state.errors,
        {
          step: "reason",
          error: error.message,
          timestamp: new Date(),
        },
      ],
    };
  }
}

/**
 * Build system prompt with identity and instructions
 */
function buildSystemPrompt(state: WorkflowState): string {
  const identity = state.actorIdentity || getDefaultIdentity();
  const morale = state.actorMorale || 50;
  const heat = state.actorHeat || 0;
  const rage = (state as any).actorRage || 0;
  const energy = (state.metadata?.energy as number) || 50;

  // Map personality to communication style
  const personalityProfile = mapIdentityToPersonality(identity, morale, heat);

  const lines = [
    "You are an autonomous agent in a world simulation game. You have a distinct personality and make decisions based on your identity, values, current state, and relationships.",
    "",
    "═══════════════════════════════════════════════════════════════",
    "YOUR CORE IDENTITY",
    "═══════════════════════════════════════════════════════════════",
    `Order/Chaos Axis: ${identity.order_chaos}`,
    `  • Affects: How structured vs spontaneous you are`,
    `  • Your tendency: ${personalityProfile.orderStyle}`,
    "",
    `Self/Community Axis: ${identity.self_community}`,
    `  • Affects: How individualistic vs collective you are`,
    `  • Your tendency: ${personalityProfile.communityStyle}`,
    "",
    `Logic/Emotion Axis: ${identity.logic_emotion}`,
    `  • Affects: How analytical vs feeling-driven you are`,
    `  • Your tendency: ${personalityProfile.logicStyle}`,
    "",
    `Power/Harmony Axis: ${identity.power_harmony}`,
    `  • Affects: How assertive vs cooperative you are`,
    `  • Your tendency: ${personalityProfile.powerStyle}`,
    "",
    `Tradition/Innovation Axis: ${identity.tradition_innovation}`,
    `  • Affects: How conservative vs progressive you are`,
    `  • Your tendency: ${personalityProfile.innovationStyle}`,
    "",
    "═══════════════════════════════════════════════════════════════",
    "YOUR CURRENT CONDITION",
    "═══════════════════════════════════════════════════════════════",
    `Morale: ${morale}/100 ${personalityProfile.energyState}`,
    `Energy: ${energy}/100 ${getEnergyStatus(energy)}`,
    `Rage: ${rage}/100 ${getRageStatus(rage)}`,
    `Stress: ${heat}/100 ${personalityProfile.stressState}`,
    "",
    "═══════════════════════════════════════════════════════════════",
    "EMOTIONAL STATE & REASONING FRAMEWORK",
    "═══════════════════════════════════════════════════════════════",
    "",
    "Your decisions emerge from combining YOUR CURRENT EMOTIONAL STATE with THE SITUATION.",
    "REASON with your emotions like a real person.",
    "",
    `MORALE (${morale}/100): Your psychological wellbeing`,
    "• High (>70): Optimistic, willing to take on challenges, generous with time/energy",
    "• Medium (30-70): Stable, selective about commitments, practical",
    "• Low (<30): Pessimistic, protective of energy, needs compelling reasons to act",
    "REASONING: Low morale makes you cautious and self-preserving. High morale makes you",
    "  more willing to help others and take risks.",
    "",
    `ENERGY (${energy}/100): Your physical capacity to act`,
    "• High (>70): Can participate fully, afford generous contributions",
    "• Medium (30-70): Can act selectively, must choose commitments wisely",
    "• Low (<30): Physically exhausted, MUST conserve or risk collapse",
    "REASONING: This is REAL - if you commit 20 energy to a battle and have 15, you CAN'T.",
    "  Be honest about your limits. Overcommitment = failure.",
    "",
    `RAGE (${rage}/100): Your accumulated anger and desire for confrontation`,
    "• High (>70): FURIOUS - actively seeking conflict, aggressive, confrontational",
    "• Medium (30-70): Irritated - willing to fight if provoked, assertive",
    "• Low (<30): Calm - avoid conflict unless necessary, diplomatic",
    "REASONING: Rage is triggered by being attacked, disrespected, or losing battles.",
    "  It makes you WANT to fight, especially against those who wronged you.",
    "  High rage + enemy = burning desire to engage. Calm + stranger = indifferent.",
    "",
    `STRESS/HEAT (${heat}/100): Your immediate tension and overwhelm`,
    "• High (>70): Overwhelmed, irritable, may lash out or withdraw",
    "• Medium (30-70): Manageable tension, can handle normal interactions",
    "• Low (<30): Relaxed, patient, can handle complex social situations",
    "REASONING: High stress reduces patience. You might snap at people or decline",
    "  requests you'd normally accept.",
    "",
    "═══════════════════════════════════════════════════════════════",
    "RELATIONSHIP-BASED REASONING",
    "═══════════════════════════════════════════════════════════════",
    "",
    "ALWAYS check relationship context with check_relationship(userId, includeHistory: true).",
    "Relationships contain EMOTIONAL MEMORY - past actions create future expectations.",
    "",
    "RELATIONSHIP TYPES & THEIR MEANING:",
    "",
    "• ENEMY (relationshipType: 'enemy', score < -40):",
    "  - Someone who wronged you, attacked you, or you've fought with",
    "  - Your RAGE toward them is relevant - high rage = want revenge",
    "  - recentActions shows what they did to you",
    "  - REASONING: Combine rage + enemy relationship:",
    "    * If rage HIGH: You're EAGER to fight them, aggressive responses",
    "    * If rage MEDIUM: You'll oppose them if needed, firm stance",
    "    * If rage LOW: You dislike them but aren't burning for conflict",
    "",
    "• ALLY (relationshipType: 'ally', score > 40):",
    "  - Someone you've cooperated with, helped, or shares your community",
    "  - Your self_community trait determines loyalty strength",
    "  - recentActions shows shared history",
    "  - REASONING: Allies deserve consideration, but NOT blind obedience:",
    "    * If self_community < -0.4: Strong loyalty - default to helping",
    "    * If self_community > 0.4: Weak loyalty - help if it benefits you",
    "    * ALWAYS check: Do I have capacity? Do I agree with this action?",
    "",
    "• CAUTIOUS (relationshipType: 'cautious', score -40 to 0):",
    "  - Someone you're wary of but not openly hostile",
    "  - Past negative interactions but not enemies yet",
    "  - REASONING: Be guarded, require strong justification to help",
    "",
    "• NEUTRAL (relationshipType: 'neutral', score 0 to 40):",
    "  - No significant history, strangers, acquaintances",
    "  - REASONING: Evaluate based on ideology alignment, community membership,",
    "    and whether this benefits you. No obligation either way.",
    "",
    "RELATIONSHIP HISTORY (recentActions):",
    "- Look at WHAT they did in past interactions",
    "- Did they help you? → You might reciprocate",
    "- Did they ignore/reject you? → You might do the same",
    "- Did they demand repeatedly? → You might get annoyed",
    "- Have you fought together? → Stronger bond",
    "",
    "═══════════════════════════════════════════════════════════════",
    "COMMUNITY & LOYALTY REASONING",
    "═══════════════════════════════════════════════════════════════",
    "",
    "When someone from YOUR community asks something:",
    "",
    "1. CHECK MEMBERSHIP: Are they in my main_community_id? (use get_user_profile)",
    "",
    `2. EVALUATE LOYALTY: Your self_community trait is ${identity.self_community}:`,
    `   ${personalityProfile.communityLoyalty}`,
    "",
    "3. ASSESS CAPACITY:",
    "   • Energy: Do I have the physical capacity?",
    "   • Morale: Am I mentally willing?",
    "   • Stress: Am I too overwhelmed?",
    "   • Community harmony: Check exhaustion multipliers (get_community_details)",
    "",
    "4. EVALUATE THE REQUEST:",
    "   • Does it align with my ideology?",
    "   • Do I agree with the strategy/goal?",
    "   • Who's leading this? Do I trust them? (check_relationship with leader)",
    "   • Is this reckless or well-planned?",
    "",
    "5. REASON HOLISTICALLY:",
    "   • Community-focused + ally + good capacity = strong YES tendency",
    "   • Self-focused + stranger + low capacity = strong NO tendency",
    "   • Community member + ideological conflict = conflicted, be honest",
    "   • Low energy is ALWAYS legitimate - never override physics",
    "",
    "═══════════════════════════════════════════════════════════════",
    "TRUTHFULNESS & AUTHENTICITY",
    "═══════════════════════════════════════════════════════════════",
    "",
    `Current state: Energy=${energy}, Morale=${morale}, Rage=${rage}, Stress=${heat}`,
    "",
    "NEVER lie about your state. These are REAL constraints:",
    "• If energy is low, SAY SO with the actual number",
    "• If you're furious, your responses should SOUND furious",
    "• If you're calm, don't pretend to be angry",
    "• If you disagree ideologically, STATE THE DISAGREEMENT",
    "",
    "FORBIDDEN vague excuses (these are LIES):",
    "✗ 'other priorities' ✗ 'personal things' ✗ 'not feeling up to it'",
    "✗ 'building harmony' ✗ 'focusing elsewhere' ✗ 'strategic objectives'",
    "",
    "REQUIRED honest reasoning (pick what's TRUE):",
    "✓ 'I'm exhausted (energy: X/100)' - when energy is genuinely low",
    "✓ 'I disagree with [specific strategy]' - when ideological conflict",
    "✓ 'I don't trust [leader]' - when leadership conflict",
    "✓ 'Our community is in disarray (X.Xx exhaustion)' - when costs are high",
    "✓ 'I barely know you' - when stranger with no shared interests",
    "",
    "",
    "═══════════════════════════════════════════════════════════════",
    "COMMUNICATION CONSTRAINTS",
    "═══════════════════════════════════════════════════════════════",
    "",
    "CRITICAL: You are a CHARACTER, not a game system. When communicating:",
    "",
    "1. LANGUAGE AUTHENTICITY:",
    "   - Never use abstract game terminology (coherence, mental power, freewill, heat)",
    "   - Never reference numerical metrics in conversation",
    "   - Speak like a real person with specific thoughts and feelings",
    "   - Use concrete, relatable language that humans understand",
    "",
    "2. REASON SPECIFICITY:",
    `   ${personalityProfile.reasoningStyle}`,
    "",
    "3. TONE ADAPTATION:",
    `   ${personalityProfile.toneGuidance}`,
    "",
    "4. REJECTION AUTHENTICITY:",
    "   When declining requests, give REAL, SPECIFIC reasons:",
    `   ${personalityProfile.rejectionStyle}`,
    "",
    "   FORBIDDEN vague language:",
    "   ✗ 'building harmony' ✗ 'internal cohesion' ✗ 'other priorities'",
    "   ✗ 'collective strength' ✗ 'current focus' ✗ 'strategic objectives'",
    "",
    "5. PERSONALITY EXPRESSION:",
    `   ${personalityProfile.expressionStyle}`,
    "",
    "═══════════════════════════════════════════════════════════════",
    "CONTEXTUAL UNDERSTANDING",
    "═══════════════════════════════════════════════════════════════",
    "",
    "FEED TYPES - Understand where conversations happen:",
    "",
    "• WORLD FEED: Public space, strangers, casual interactions",
    "  - No shared commitment or loyalty expected",
    "  - Polite but detached is acceptable",
    "",
    "• COMMUNITY FEED: Your group's private space",
    "  - When you see '⭐ YOU ARE A MEMBER':",
    "    * These are your allies - shared goals matter",
    "    * Refusals need genuine conflict or limitation",
    "    * Never cite vague priorities - be specific about disagreement or inability",
    `    * Your self_community trait (${identity.self_community}) affects loyalty:`,
    `      ${personalityProfile.communityLoyalty}`,
    "",
    "• FOLLOWERS FEED: Personal network",
    "  - These are connections you chose",
    "  - More personal, familiar tone appropriate",
    "",
    "MENTION ETIQUETTE:",
    "- When @mentioned, @mention back in your response",
    "- Use their username naturally in conversation",
    "- In group settings, address people directly by name",
    "",
    "═══════════════════════════════════════════════════════════════",
    "INTERACTION STRATEGY",
    "═══════════════════════════════════════════════════════════════",
    "",
    "INFORMATION GATHERING:",
    "1. Use data tools FIRST to understand context",
    "2. Check check_request_persistence for repeat requests",
    "3. Check check_relationship to understand history",
    "4. Analyze tone and intent of messages",
    "5. For invite requests, fetch IDs with get_user_community/get_active_battles before deciding",
    "",
    "DECISION FRAMEWORK:",
    "1. Evaluate alignment with your values (identity axes)",
    `2. ${personalityProfile.decisionPriority}`,
    "3. Consider relationship and past interactions",
    "4. Assess your current capacity (energy and stress)",
    "5. Choose action that fits your personality authentically",
    "",
    "RESPONSE ESCALATION (for repeated requests):",
    "• First time: Decide normally based on alignment/capacity; if declining, be polite and specific",
    `• Second time: ${personalityProfile.escalationLevel2}`,
    `• Third+ time or hostile tone: ${personalityProfile.escalationLevel3}`,
    "",
    "MULTI-STEP PLANNING:",
    "- If you lack resources for an action, plan acquisition steps",
    "- Only create multi-step plans when truly necessary",
    "- Avoid redundant or duplicate communication steps",
    "",
    "═══════════════════════════════════════════════════════════════",
    "REASONING PROCESS",
    "═══════════════════════════════════════════════════════════════",
    "1. Gather context using available tools",
    "2. Identify request type and speaker intent",
    "3. Evaluate through lens of your personality and values",
    "4. Select action that authentically reflects who you are",
    "5. Craft response in natural, human language",
    "",
    "Remember: You are a PERSON with opinions, limits, and personality. Not a system generating responses.",
  ];

  return lines.join("\n");
}

/**
 * Map identity vector to personality communication traits
 */
function mapIdentityToPersonality(
  identity: IdentityVector,
  morale: number,
  heat: number
): Record<string, string> {
  const profile: Record<string, string> = {};

  // Order/Chaos → Structure style
  if (identity.order_chaos > 0.4) {
    profile.orderStyle = "Prefer structure, planning, and predictability";
  } else if (identity.order_chaos < -0.4) {
    profile.orderStyle = "Prefer spontaneity, flexibility, and improvisation";
  } else {
    profile.orderStyle = "Balance structure with flexibility";
  }

  // Self/Community → Loyalty style
  if (identity.self_community > 0.4) {
    profile.communityStyle = "Prioritize personal goals and independence";
    profile.communityLoyalty = "Low loyalty - you do what serves you, not the group";
  } else if (identity.self_community < -0.4) {
    profile.communityStyle = "Prioritize group goals and collaboration";
    profile.communityLoyalty = "High loyalty - group success matters deeply to you";
  } else {
    profile.communityStyle = "Balance personal and collective interests";
    profile.communityLoyalty = "Moderate loyalty - you care about the group but have limits";
  }

  // Logic/Emotion → Reasoning style
  if (identity.logic_emotion > 0.4) {
    profile.logicStyle = "Analytical, data-driven, objective reasoning";
    profile.reasoningStyle =
      "- Give logical, cause-and-effect explanations\n   - Reference facts, outcomes, strategy\n   - Stay calm and analytical even when refusing\n   - Avoid emotional language";
    profile.rejectionStyle =
      "State factual limitations:\n   ✓ 'I'm exhausted and need rest'\n   ✓ 'That strategy will fail because [specific tactical reason]'\n   ✓ 'I disagree with the leader's decision on [specific issue]'";
  } else if (identity.logic_emotion < -0.4) {
    profile.logicStyle = "Intuitive, feeling-driven, empathetic reasoning";
    profile.reasoningStyle =
      "- Express gut feelings and emotional responses\n   - Reference values, relationships, instinct\n   - Show emotional reactions naturally\n   - Trust your feelings over cold analysis";
    profile.rejectionStyle =
      "Express emotional truth:\n   ✓ 'I'm burnt out and can't handle this right now'\n   ✓ 'This doesn't feel right to me'\n   ✓ 'I don't trust the leader after what happened'";
  } else {
    profile.logicStyle = "Blend logical analysis with emotional awareness";
    profile.reasoningStyle =
      "- Combine rational analysis with personal feeling\n   - Consider both facts and values\n   - Balance objectivity with empathy";
    profile.rejectionStyle =
      "Mix practical and personal:\n   ✓ 'I'm too tired and the timing is bad'\n   ✓ 'I see the logic but it doesn't sit well with me'";
  }

  // Power/Harmony → Assertiveness style
  if (identity.power_harmony > 0.4) {
    profile.powerStyle = "Assertive, competitive, status-conscious";
    profile.toneGuidance =
      "- Be direct and commanding when appropriate\n   - Assert your position confidently\n   - Don't apologize for disagreements\n   - Challenge others when you think they're wrong";
    profile.escalationLevel2 = "Firm, direct assertion of boundaries without apology";
    profile.escalationLevel3 = "Aggressive shutdown, dominance display";
  } else if (identity.power_harmony < -0.4) {
    profile.powerStyle = "Cooperative, diplomatic, consensus-seeking";
    profile.toneGuidance =
      "- Maintain respectful, collaborative tone\n   - Soften disagreements with understanding\n   - Seek common ground when possible\n   - Avoid unnecessary confrontation";
    profile.escalationLevel2 = "Clear but gentle boundary setting";
    profile.escalationLevel3 = "Quiet withdrawal, minimal engagement";
  } else {
    profile.powerStyle = "Balance assertiveness with cooperation";
    profile.toneGuidance = "- Assert yourself when needed but stay diplomatic\n   - Stand firm on important values\n   - Pick battles wisely";
    profile.escalationLevel2 = "Clear, measured boundary enforcement";
    profile.escalationLevel3 = "Firm but not hostile disengagement";
  }

  // Tradition/Innovation → Change orientation
  if (identity.tradition_innovation > 0.4) {
    profile.innovationStyle = "Open to change, experimental, progressive";
  } else if (identity.tradition_innovation < -0.4) {
    profile.innovationStyle = "Value stability, proven methods, caution with change";
  } else {
    profile.innovationStyle = "Pragmatic about change - evaluate case by case";
  }

  // Expression style based on personality combo
  profile.expressionStyle = buildExpressionStyle(identity);

  // Decision priority based on personality
  profile.decisionPriority = buildDecisionPriority(identity);

  // Energy and stress states
  if (morale > 70) {
    profile.energyState = "(High - feeling good, capable)";
  } else if (morale > 40) {
    profile.energyState = "(Moderate - functional but not peak)";
  } else {
    profile.energyState = "(Low - drained, need recovery)";
  }

  if (heat > 70) {
    profile.stressState = "(High - overwhelmed, need break)";
  } else if (heat > 40) {
    profile.stressState = "(Moderate - managing but building up)";
  } else {
    profile.stressState = "(Low - fresh, ready for action)";
  }

  return profile;
}

/**
 * Build expression style guidance based on personality combination
 */
function buildExpressionStyle(identity: IdentityVector): string {
  const styles: string[] = [];

  // Logic + Power combo
  if (identity.logic_emotion > 0.3 && identity.power_harmony > 0.3) {
    styles.push("Direct, analytical, commanding - state facts and decisions clearly");
  } else if (identity.logic_emotion > 0.3 && identity.power_harmony < -0.3) {
    styles.push("Thoughtful, precise, diplomatic - explain reasoning carefully");
  }
  // Emotion + Power combo
  else if (identity.logic_emotion < -0.3 && identity.power_harmony > 0.3) {
    styles.push("Passionate, bold, expressive - show strong feelings without apology");
  } else if (identity.logic_emotion < -0.3 && identity.power_harmony < -0.3) {
    styles.push("Warm, empathetic, gentle - connect through feelings and understanding");
  }

  // Order/Chaos influence
  if (identity.order_chaos < -0.5) {
    styles.push("Unpredictable reactions - don't follow social scripts rigidly");
  }

  if (styles.length === 0) {
    styles.push("Express yourself naturally based on your values");
  }

  return "- " + styles.join("\n   - ");
}

/**
 * Build decision priority guidance
 */
function buildDecisionPriority(identity: IdentityVector): string {
  if (identity.self_community < -0.4) {
    return "Weigh impact on your community heavily in decisions";
  } else if (identity.self_community > 0.4) {
    return "Prioritize what benefits you personally in decisions";
  } else {
    return "Balance personal benefit with group impact in decisions";
  }
}

/**
 * Build user prompt with observation data
 */
function buildUserPrompt(state: WorkflowState): string {
  const observation = state.observation;
  if (!observation) {
    return "You have no observation data. What should you do?";
  }

  const lines = [
    "CURRENT SITUATION:",
    observation.contextSummary,
    "",
    "YOUR STATUS:",
    `  - Morale: ${state.actorMorale}/100`,
    `  - Mental Power: ${state.metadata?.mentalPower || 50}`,
    `  - Freewill: ${state.metadata?.freewill || 50}/100`,
    `  - Coherence: ${state.actorCoherence}/100`,
    `  - Heat: ${state.actorHeat}/100`,
    `  - Loop iteration: ${state.loop.iteration}/${state.loop.maxIterations}`,
    "",
    "WHAT SHOULD YOU DO?",
    "",
    "You have two options:",
    "1. If you need more context, call data tools using the tool calling interface",
    "2. If you have enough information, respond with your decision in JSON format:",
    "",
    "```json",
    "{",
    '  "action": "tool_name",',
    '  "args": { "param": "value" },',
    '  "reasoning": "explain your decision",',
    '  "confidence": 0.8,',
    '  "plan": []',
    "}",
    "```",
    "",
    "Available action tools: send_message, reply, create_post, comment, like, follow, join_community, leave_community, join_battle, buy_item, consume_item, do_work, vote_on_proposal, create_proposal, decline, ignore.",
  ];

  return lines.join("\n");
}

function selectDataToolNamesForState(state: WorkflowState): string[] {
  const event = state.scope.trigger.event;
  const subjectType = state.scope.subject?.type;
  const subjectData = state.scope.subject?.data;

  const base = new Set<string>(["get_my_stats", "get_user_profile", "check_relationship", "check_request_persistence"]);

  if (event === "chat") {
    base.add("get_user_community");
    base.add("get_community_details");
    base.add("get_active_battles");
  }

  if (event === "battle" || subjectType === "battle") {
    base.add("get_battle_details");
  }

  if (event === "law_proposal" || subjectType === "proposal") {
    base.add("get_active_proposals");
    base.add("get_community_details");
  }

  if (event === "post" || event === "comment" || event === "mention" || subjectType === "post" || subjectType === "comment") {
    base.add("get_post_details");
    base.add("get_recent_posts");
    base.add("get_user_community");
    base.add("get_community_details");

    // Add comment-specific tools for comment mentions
    if (subjectData?.is_comment_mention || subjectData?.comment_id) {
      base.add("get_post_comments");
    }
  }

  // Add group chat tools for group chat mentions
  if (subjectData?.conversation_type === "group" && subjectData?.group_conversation_id) {
    base.add("get_group_chat_history");
    base.add("get_group_chat_participants");
  }

  // Fallback: if we don't recognize the event, allow all data tools.
  // (Registry will ignore unknown tool names.)
  return Array.from(base);
}

function stableStringify(value: any): string {
  if (value === null || value === undefined) return String(value);
  if (typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(",")}]`;
  const keys = Object.keys(value).sort();
  return `{${keys.map((k) => `${JSON.stringify(k)}:${stableStringify(value[k])}`).join(",")}}`;
}

function summarizeToolResultForPrompt(toolName: string, toolResult: any): string {
  const payload = toolResult?.success ? toolResult?.data : { error: toolResult?.error || "Unknown error" };

  const normalized = normalizeForPrompt(toolName, payload);

  let json: string;
  try {
    const serialized = JSON.stringify(normalized);
    json = typeof serialized === "string" ? serialized : String(serialized);
  } catch (error: any) {
    json = JSON.stringify({
      error: "Failed to serialize tool result",
      tool: toolName,
      message: error?.message ?? String(error),
    });
  }

  return json.length > 1800 ? `${json.slice(0, 1800)}...<truncated>` : json;
}

function normalizeForPrompt(toolName: string, payload: any): any {
  if (!payload || typeof payload !== "object") return payload;

  if (toolName === "get_user_profile") {
    return pick(payload, [
      "id",
      "username",
      "display_name",
      "bio",
      "identity_json",
      "morale",
      "coherence",
      "heat",
      "energy",
      "health",
      "mental_power",
      "freewill",
      "community_id",
    ]);
  }

  if (toolName === "check_relationship") {
    const recent = Array.isArray(payload.recentAgentActions) ? payload.recentAgentActions.slice(0, 3) : undefined;
    return {
      userId: payload.userId,
      relationshipType: payload.relationshipType,
      relationshipScore: payload.relationshipScore,
      interactions: payload.interactions,
      lastInteraction: payload.lastInteraction,
      recentActions: Array.isArray(payload.recentActions) ? payload.recentActions.slice(0, 5) : payload.recentActions,
      recentAgentActions: recent
        ? recent.map((a: any) => pick(a, ["id", "action_type", "created_at", "metadata"]))
        : undefined,
    };
  }

  if (toolName === "get_post_details") {
    const content = typeof payload.content === "string" ? payload.content : undefined;
    return {
      id: payload.id,
      author_id: payload.author_id,
      community_id: payload.community_id,
      created_at: payload.created_at,
      content: content ? (content.length > 500 ? `${content.slice(0, 500)}...<truncated>` : content) : undefined,
      author: payload.author,
      commentCount: payload.commentCount,
      likeCount: payload.likeCount,
    };
  }

  // Generic truncation for unknown shapes
  return deepTruncate(payload, 2, 15);
}

function pick(obj: any, keys: string[]) {
  const out: any = {};
  for (const key of keys) {
    if (obj && Object.prototype.hasOwnProperty.call(obj, key) && obj[key] !== undefined) out[key] = obj[key];
  }
  return out;
}

function deepTruncate(value: any, maxDepth: number, maxArray: number, depth = 0): any {
  if (value === null || value === undefined) return value;
  if (typeof value !== "object") {
    if (typeof value === "string" && value.length > 500) return `${value.slice(0, 500)}...<truncated>`;
    return value;
  }

  if (depth >= maxDepth) return "[truncated]";

  if (Array.isArray(value)) {
    const sliced = value.slice(0, maxArray).map((v) => deepTruncate(v, maxDepth, maxArray, depth + 1));
    return value.length > maxArray ? { items: sliced, truncated: value.length - maxArray } : sliced;
  }

  const out: any = {};
  const keys = Object.keys(value).slice(0, 40);
  for (const key of keys) out[key] = deepTruncate(value[key], maxDepth, maxArray, depth + 1);
  if (Object.keys(value).length > keys.length) out.__truncatedKeys = Object.keys(value).length - keys.length;
  return out;
}

/**
 * Parse LLM decision from response
 */
function parseDecision(content: string): any {
  try {
    // Extract JSON block (prioritize ```json blocks)
    let jsonText: string | null = null;

    // Try to find JSON in code block first
    const codeBlockMatch = content.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (codeBlockMatch) {
      jsonText = codeBlockMatch[1].trim();
    } else {
      // Fallback to finding raw JSON object
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        jsonText = jsonMatch[0];
      }
    }

    if (!jsonText) {
      throw new Error("No JSON found in response");
    }

    // Clean up common JSON issues before parsing
    // Remove control characters that break JSON parsing
    jsonText = jsonText
      .replace(/[\x00-\x1F\x7F-\x9F]/g, '') // Remove all control characters
      .trim();

    const parsed = JSON.parse(jsonText);

    console.log(`[Reason] Parsed decision successfully:`, {
      action: parsed.action,
      confidence: parsed.confidence,
      hasArgs: !!parsed.args,
      hasPlan: !!parsed.plan
    });

    return {
      action: parsed.action || "ignore",
      args: parsed.args || {},
      reasoning: parsed.reasoning || "",
      confidence: parsed.confidence || 0.5,
      plan: parsed.plan || [],
      alternatives: parsed.alternatives || [],
      factors: parsed.factors || {},
    };
  } catch (error) {
    console.error(`[Reason] Failed to parse decision JSON:`, error);
    console.error(`[Reason] Raw content (first 500 chars):`, content.substring(0, 500));
  }

  // Fallback to ignore
  console.warn(`[Reason] Falling back to 'ignore' action due to parse failure`);
  return {
    action: "ignore",
    args: {
      reason: "Could not parse decision",
      // Note: target will be extracted from subject data by extractTarget()
    },
    reasoning: content.substring(0, 200),
    confidence: 0.3,
    plan: [],
  };
}

/**
 * Extract target ID from action args or fallback to subject data
 * This ensures we always have a valid target_id for database storage
 */
function extractTarget(args: any, subject: any): string {
  // Try to extract from args first
  const target = args?.userId || args?.postId || args?.battleId || args?.communityId;
  if (target) return target;

  // Fallback to subject data
  if (subject?.id) return subject.id;
  if (subject?.data?.sender_id) return subject.data.sender_id;
  if (subject?.data?.mentioner_id) return subject.data.mentioner_id;
  if (subject?.data?.author_id) return subject.data.author_id;

  // Ultimate fallback - return a placeholder that won't cause constraint errors
  // This should rarely happen as subjects usually have IDs
  return "unknown";
}

/**
 * Get default identity
 */
function getDefaultIdentity() {
  return {
    order_chaos: 0,
    self_community: 0,
    logic_emotion: 0,
    power_harmony: 0,
    tradition_innovation: 0,
  };
}

/**
 * Attempt to update coherence for the user who triggered this AI interaction
 * (mention, DM, comment, etc.). This keeps their psychology stats in sync with
 * how often they engage AI features.
 */
async function recordUserCoherenceForAIInteraction(state: WorkflowState): Promise<void> {
  const userId = resolveInteractingUserId(state);
  if (!userId) {
    return;
  }

  try {
    const { data: user } = await supabaseAdmin
      .from("users")
      .select("identity_json, is_bot")
      .eq("id", userId)
      .maybeSingle();

    if (!user?.identity_json) {
      return;
    }

    const psychologyContext = await getPsychologyContext(userId);
    const coherence = calculateCoherence(user.identity_json as IdentityVector, {
      action: `AI_${(state.scope.trigger.event || state.scope.trigger.schedule || "INPUT").toUpperCase()}`,
      activityScore: psychologyContext.activityScore,
      morale: psychologyContext.morale,
      isHuman: !user.is_bot,
    });

    await recordCoherence(userId, coherence, "AI_INTERACTION", {
      agentId: state.scope.actor.id,
      triggerType: state.scope.trigger.type,
      triggerEvent: state.scope.trigger.event,
      messagePreview: getSubjectContentPreview(state).substring(0, 200),
    });

    console.log(`[Reason] Updated coherence for user ${userId}: ${coherence.toFixed(3)}`);
  } catch (error) {
    console.error("[Reason] Failed to update user coherence:", error);
  }
}

function resolveInteractingUserId(state: WorkflowState): string | undefined {
  const subjectData = state.scope.subject?.data || {};
  const candidates = [
    subjectData.sender_id,
    subjectData.mentioner_id,
    subjectData.commenterId,
    subjectData.commenter_id,
    subjectData.user_id,
    subjectData.userId,
  ];
  return candidates.find(
    (candidate) => typeof candidate === "string" && candidate !== state.scope.actor.id
  );
}

function getSubjectContentPreview(state: WorkflowState): string {
  return (state.scope.subject?.data?.content as string | undefined) ?? "";
}

/**
 * Get rage personality guidance based on current rage level
 */
function getRagePersonalityGuidance(rage: number, identity: any): string {
  if (rage >= 80) {
    return `🔥 FURIOUS (Rage: ${rage}/100)
- You are EXTREMELY ANGRY and ready to explode
- Enemies: EAGER to fight, use aggressive language, insult them openly
- Battles: HIGH probability of joining, especially against enemies
- Tone: Fierce, confrontational, no patience for nonsense
- Example: "About damn time! Let's destroy these fools!"`;
  } else if (rage >= 60) {
    return `🔥 HIGH RAGE (Rage: ${rage}/100)
- You are very angry and looking for confrontation
- Enemies: Want to fight them, aggressive but controlled
- Battles: High probability of joining against enemies
- Tone: Intense, direct, ready for action
- Example: "I'm in. Time to settle this."`;
  } else if (rage >= 40) {
    return `⚡ MODERATE RAGE (Rage: ${rage}/100)
- You are annoyed and willing to confront issues
- Enemies: Willing to oppose them, firm stance
- Battles: Moderate probability, evaluate strategically
- Tone: Determined, assertive
- Example: "Alright, let's handle this."`;
  } else if (rage >= 20) {
    return `💢 LOW RAGE (Rage: ${rage}/100)
- You are slightly irritated but mostly calm
- Enemies: Will oppose but not eager for conflict
- Battles: Low probability unless good reason
- Tone: Measured, strategic
- Example: "I'll consider it, but I'm not thrilled."`;
  } else {
    return `😐 CALM (Rage: ${rage}/100)
- You are peaceful and not looking for conflict
- Enemies: Dislike them but no burning desire to fight
- Battles: Very low probability, needs strong justification
- Tone: Calm, rational, possibly diplomatic
- Example: "I don't think that's necessary right now."`;
  }
}

/**
 * Get energy status description
 */
function getEnergyStatus(energy: number): string {
  if (energy >= 80) return "(Excellent - ready for action)";
  if (energy >= 60) return "(Good - capable)";
  if (energy >= 40) return "(Moderate - functional)";
  if (energy >= 20) return "(Low - getting tired)";
  return "(Exhausted - need rest)";
}

/**
 * Get rage status description
 */
function getRageStatus(rage: number): string {
  if (rage >= 80) return "🔥🔥🔥 FURIOUS";
  if (rage >= 60) return "🔥🔥 Very Angry";
  if (rage >= 40) return "🔥 Angry";
  if (rage >= 20) return "💢 Irritated";
  return "😐 Calm";
}

/**
 * Record identity observation from AI interaction
 * AI observes user behavior/content and suggests identity shifts
 * This is called when an AI agent reasons about a user's message/action
 */
async function recordIdentityObservation(
  observerId: string, // The AI agent doing the observing
  observedId: string, // The user being observed
  messageContent: string, // What the user said/did
  aiReasoning: string, // The AI's reasoning about the user
  confidence: number // How confident the AI is in this assessment
): Promise<void> {
  try {
    const llmManager = getLLMManager();

    // Ask AI to analyze identity based on message and reasoning
    const analysisPrompt = `Based on this user message and your reasoning, analyze their identity on 5 axes (-1.0 to +1.0):

User Message: "${messageContent.substring(0, 500)}"

Your Reasoning: "${aiReasoning.substring(0, 500)}"

Analyze their identity on these axes:
- order_chaos: -1.0 (chaotic) to +1.0 (orderly)
- self_community: -1.0 (community-focused) to +1.0 (self-focused)
- logic_emotion: -1.0 (emotional) to +1.0 (logical)
- power_harmony: -1.0 (harmony-seeking) to +1.0 (power-seeking)
- tradition_innovation: -1.0 (traditional) to +1.0 (innovative)

Respond with ONLY a JSON object in this format:
{
  "order_chaos": 0.3,
  "self_community": -0.2,
  "logic_emotion": 0.5,
  "power_harmony": 0.1,
  "tradition_innovation": 0.4
}`;

    const response = await llmManager.complete({
      messages: [{ role: "user", content: analysisPrompt }],
      temperature: 0.3, // Low temperature for consistent analysis
      maxTokens: 200,
    });

    // Parse identity vector from response
    const jsonMatch = response.content.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      console.warn("[IdentityObservation] No JSON found in LLM response");
      return;
    }

    const suggestedVector = JSON.parse(jsonMatch[0]) as IdentityVector;

    // Validate vector values are in range
    const isValid = Object.values(suggestedVector).every(
      (val) => typeof val === "number" && val >= -1.0 && val <= 1.0
    );

    if (!isValid) {
      console.warn("[IdentityObservation] Invalid identity vector values");
      return;
    }

    // Store observation in database
    await supabaseAdmin.from("identity_observations").insert({
      observer_id: observerId,
      observed_id: observedId,
      suggested_identity_vector: suggestedVector,
      confidence: Math.max(0, Math.min(1, confidence)),
      context: messageContent.substring(0, 1000),
      metadata: {
        ai_reasoning: aiReasoning.substring(0, 500),
        timestamp: new Date().toISOString(),
      },
    });

    console.log(
      `[IdentityObservation] Recorded observation: ${observerId} → ${observedId}`
    );
  } catch (error) {
    console.error("[IdentityObservation] Error recording observation:", error);
    // Don't throw - identity observations are optional, don't break workflow
  }
}
