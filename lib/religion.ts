/**
 * Community Religion System
 *
 * Generates unique, AI-driven religious narratives from community ideology.
 * Religion emerges when community reaches critical mass (20+ members).
 */

import { IDEOLOGY_CONFIG } from './ideology-config'
import { IdentityVector, ideologyToTenets, vectorDistance } from './ideology'
import { Mistral } from '@mistralai/mistralai'

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

export interface CommunityReligion {
  id: string
  community_id: string
  name: string
  short_description: string
  long_description: string
  ideology_snapshot: IdentityVector
  core_tenets: string[]
  sacred_values: string[]
  forbidden_actions: string[]
  created_at: Date
  last_updated: Date
}

export interface ReligionGenerationParams {
  community_id: string
  community_name: string
  ideology_vector: IdentityVector
  governance_type: string
  member_count: number
  previous_religion?: CommunityReligion
  recent_events?: string[] // e.g., ["Declared war on X", "Formed alliance with Y"]
}

// ============================================================================
// MAIN GENERATION FUNCTION
// ============================================================================

/**
 * Generate a unique religion for a community
 * Called when community reaches 20+ members or manually by sovereign
 */
export async function generateReligion(
  params: ReligionGenerationParams
): Promise<Omit<CommunityReligion, 'id' | 'created_at' | 'last_updated'>> {
  // Step 1: Derive tenets from ideology vector
  const tenets = ideologyToTenets(params.ideology_vector)

  // Step 2: Get interpretation labels (used in prompt)
  const { getGovernanceLabel, getEconomyLabel, getCultureLabel, getDecisionLabel } = require('./ideology-config')
  const governanceLabel = getGovernanceLabel(
    params.ideology_vector.order_chaos,
    params.ideology_vector.power_harmony,
    params.governance_type
  )
  const economyLabel = getEconomyLabel(params.ideology_vector.self_community)
  const cultureLabel = getCultureLabel(params.ideology_vector.tradition_innovation)
  const decisionLabel = getDecisionLabel(params.ideology_vector.logic_emotion)

  // Step 3: Build AI prompt
  const prompt = buildReligionPrompt({
    communityName: params.community_name,
    governanceStyle: governanceLabel.label,
    economySystem: economyLabel.label,
    culturalValues: cultureLabel.label,
    decisionStyle: decisionLabel.label,
    coreTenets: tenets.core,
    sacredValues: tenets.sacred,
    forbiddenActions: tenets.forbidden,
    memberCount: params.member_count,
    recentEvents: params.recent_events,
    previousReligion: params.previous_religion,
  })

  // Step 4: Call Claude to generate religion
  const religionData = await callAIForReligion(prompt)

  return {
    community_id: params.community_id,
    name: religionData.name,
    short_description: religionData.short_description,
    long_description: religionData.long_description,
    ideology_snapshot: params.ideology_vector,
    core_tenets: tenets.core,
    sacred_values: tenets.sacred,
    forbidden_actions: tenets.forbidden,
  }
}

/**
 * Check if religion should be regenerated due to ideology drift
 */
export function shouldRegenerateReligion(
  currentIdeology: IdentityVector,
  ideologySnapshot: IdentityVector
): boolean {
  const drift = vectorDistance(currentIdeology, ideologySnapshot)
  return drift > IDEOLOGY_CONFIG.religion.ideologyShiftThresholdForRegeneration
}

// ============================================================================
// AI PROMPT BUILDING
// ============================================================================

interface PromptParams {
  communityName: string
  governanceStyle: string
  economySystem: string
  culturalValues: string
  decisionStyle: string
  coreTenets: string[]
  sacredValues: string[]
  forbiddenActions: string[]
  memberCount: number
  recentEvents?: string[]
  previousReligion?: CommunityReligion
}

function buildReligionPrompt(params: PromptParams): string {
  const recentEventsText = params.recentEvents && params.recentEvents.length > 0
    ? `\nRecent major events:\n${params.recentEvents.map(e => `- ${e}`).join('\n')}`
    : ''

  const previousReligionText = params.previousReligion
    ? `\n\nNote: This community previously had a religion called "${params.previousReligion.name}". ` +
      `The new religion should reflect changes in the community's ideology and values. ` +
      `It can be an evolution, reformation, or complete replacement of the previous faith.`
    : ''

  return `You are creating a unique religion/faith system for a community in a geopolitical strategy game. This religion should be a philosophical framework that justifies and reinforces the community's actual governance style, economic system, and cultural values.

COMMUNITY PROFILE:
- Name: ${params.communityName}
- Population: ${params.memberCount} members
- Governance: ${params.governanceStyle}
- Economy: ${params.economySystem}
- Culture: ${params.culturalValues}
- Decision-Making: ${params.decisionStyle}${recentEventsText}${previousReligionText}

IDEOLOGICAL FOUNDATION:
These values form the community's worldview:

Core Tenets:
${params.coreTenets.map((t, i) => `${i + 1}. ${t}`).join('\n')}

Sacred Values:
${params.sacredValues.map((v, i) => `${i + 1}. ${v}`).join('\n')}

Forbidden Actions:
${params.forbiddenActions.map((a, i) => `${i + 1}. ${a}`).join('\n')}

CRITICAL REQUIREMENTS:
1. Religion name: 2-4 words, memorable, reflects actual community values
2. Short description: 1 sentence summarizing the faith's core purpose
3. Long lore: 2-3 paragraphs explaining:
   - Why this faith matters to the community (connection to their real values)
   - How it justifies their governance and economic system
   - What practices bind them together
   - What makes this community different from others
   - NO fantasy origin myths or irrelevant storytelling

WHAT NOT TO DO:
- Do NOT invent fantasy creatures, ancient civilizations, or magical events
- Do NOT use religious clichés (chosen ones, divine prophecies, gods)
- Do NOT describe fictional battles or mythical creatures
- Do NOT create elaborate back-stories disconnected from the community's actual values
- DO ground everything in the community's real governance, economy, and culture

FOCUS ON:
- The philosophical justification for their system
- How their values create meaning and unity
- Practical rituals that reinforce their ideology
- Why this approach works for THEM specifically

Return ONLY valid JSON (no markdown, no code blocks):
{
  "name": "The Balanced Path",
  "short_description": "A philosophy of measured governance and shared prosperity that binds the community through practical principles",
  "long_description": "The Balanced Path teaches that power must flow through deliberate channels. Our sovereign holds authority not as a divine right, but as stewardship of the community's collective will. Decision-making combines logic with empathy - we debate fiercely but unite in action. Our economy reflects this balance: individuals may pursue wealth, but critical resources are managed communally to ensure stability. Through regular councils where every voice matters, we practice the Path daily. This is not mysticism but pragmatism - a shared understanding that our strength comes from respecting both individual merit and collective needs."
}`
}

// ============================================================================
// AI CALL
// ============================================================================

interface ReligionAIResponse {
  name: string
  short_description: string
  long_description: string
}

async function callAIForReligion(prompt: string): Promise<ReligionAIResponse> {
  const client = new Mistral({
    apiKey: process.env.MISTRAL_API_KEY,
  })

  let lastError: Error | null = null

  for (let attempt = 0; attempt < IDEOLOGY_CONFIG.religion.maxGenerationRetries; attempt++) {
    try {
      const message = await client.chat.complete({
        model: 'mistral-large-latest',
        messages: [
          {
            role: 'user',
            content: prompt,
          },
        ],
        maxTokens: 1024,
      })

      // Extract text from response
      const rawContent = message.choices?.[0]?.message?.content
      const responseText = typeof rawContent === 'string'
        ? rawContent
        : Array.isArray(rawContent)
          ? rawContent
            .map(chunk => {
              if (typeof chunk === 'string') return chunk
              if ('text' in chunk && typeof chunk.text === 'string') return chunk.text
              return ''
            })
            .join('')
          : ''

      if (!responseText) {
        throw new Error('Empty response from AI')
      }

      // Extract and parse JSON from response
      let religionData: ReligionAIResponse

      // Try to extract JSON manually by parsing the structure
      // Look for the main fields we need
      const nameMatch = responseText.match(/"name"\s*:\s*"([^"]*)"/i)
      const shortMatch = responseText.match(/"short_description"\s*:\s*"([^"]*(?:\\.[^"]*)*)"/i)

      // For long_description, we need to handle multiline strings
      const longMatch = responseText.match(/"long_description"\s*:\s*"((?:[^"\\]|\\.|\n)*)"/i)

      if (nameMatch && shortMatch && longMatch) {
        // Build the religion data from extracted fields
        try {
          religionData = {
            name: nameMatch[1],
            short_description: shortMatch[1].replace(/\\n/g, '\n').replace(/\\t/g, '\t'),
            long_description: longMatch[1]
              .replace(/\\n/g, '\n')
              .replace(/\\t/g, '\t')
              .replace(/\\"/g, '"'),
          }

          // Validate response
          if (!religionData.name || !religionData.short_description || !religionData.long_description) {
            throw new Error('Extracted fields are incomplete')
          }

          return religionData
        } catch (e) {
          console.warn('Field extraction parsing failed:', e)
          // Fall through to JSON parsing attempt
        }
      }

      // Fallback: try standard JSON parsing
      try {
        let jsonMatch = responseText.match(/\{[\s\S]*\}/)
        if (!jsonMatch) {
          throw new Error('No JSON object found in response')
        }

        let jsonStr = jsonMatch[0]

        // Replace unescaped newlines in string values with escaped ones
        // This regex looks for newlines that are inside quoted strings
        jsonStr = jsonStr.replace(/: "([^"]*)\n([^"]*)"/g, ': "$1\\n$2"')

        religionData = JSON.parse(jsonStr)

        // Validate response
        if (!religionData.name || !religionData.short_description || !religionData.long_description) {
          throw new Error('Missing required fields in response')
        }

        return religionData
      } catch (e) {
        console.error('All JSON parsing attempts failed:', e)
        throw new Error(`Failed to parse religion response: ${(e as Error).message}`)
      }
    } catch (error) {
      lastError = error as Error
      console.warn(`Religion generation attempt ${attempt + 1} failed:`, error)

      // Wait before retry (exponential backoff)
      if (attempt < IDEOLOGY_CONFIG.religion.maxGenerationRetries - 1) {
        await new Promise(resolve => setTimeout(resolve, 1000 * Math.pow(2, attempt)))
      }
    }
  }

  // If all retries failed, throw error
  throw new Error(
    `Failed to generate religion after ${IDEOLOGY_CONFIG.religion.maxGenerationRetries} attempts: ${lastError?.message}`
  )
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Generate a religion description/summary for UI display
 */
export function generateReligionSummary(religion: CommunityReligion): string {
  return `
**${religion.name}**

*${religion.short_description}*

**Core Beliefs:**
${religion.core_tenets.map(t => `- ${t}`).join('\n')}

**Sacred Values:**
${religion.sacred_values.map(v => `• ${v}`).join(' • ')}

**Forbidden:**
${religion.forbidden_actions.map(a => `✗ ${a}`).join(', ')}
`.trim()
}

/**
 * Get religion update suggestions based on ideology drift
 */
export function getReligionUpdateSuggestions(
  currentIdeology: IdentityVector,
  previousSnapshot: IdentityVector
): { drift: number; suggestions: string[] } {
  const drift = vectorDistance(currentIdeology, previousSnapshot)

  const suggestions: string[] = []

  if (currentIdeology.order_chaos > previousSnapshot.order_chaos + 0.3) {
    suggestions.push('Community has become more authoritarian - faith may be evolving toward stricter doctrines')
  }
  if (currentIdeology.order_chaos < previousSnapshot.order_chaos - 0.3) {
    suggestions.push('Community has become more chaotic - faith may be shifting toward liberty and spontaneity')
  }

  if (currentIdeology.self_community > previousSnapshot.self_community + 0.3) {
    suggestions.push('Community has become more collectivist - faith emphasizing unity and shared purpose')
  }
  if (currentIdeology.self_community < previousSnapshot.self_community - 0.3) {
    suggestions.push('Community has become more individualist - faith shifting toward personal achievement')
  }

  if (currentIdeology.power_harmony > previousSnapshot.power_harmony + 0.3) {
    suggestions.push('Community has become more aggressive - warlike ideals influencing the faith')
  }
  if (currentIdeology.power_harmony < previousSnapshot.power_harmony - 0.3) {
    suggestions.push('Community has become more peaceful - faith evolving toward harmony and diplomacy')
  }

  if (currentIdeology.tradition_innovation > previousSnapshot.tradition_innovation + 0.3) {
    suggestions.push('Community has become more progressive - faith adapting to new ideas and changes')
  }
  if (currentIdeology.tradition_innovation < previousSnapshot.tradition_innovation - 0.3) {
    suggestions.push('Community has become more traditional - faith reinforcing heritage and established ways')
  }

  return { drift, suggestions }
}
