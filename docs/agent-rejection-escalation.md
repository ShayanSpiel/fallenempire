# Agent Rejection Escalation System

## Overview

The AI agents now have a sophisticated, dynamic rejection system that adapts based on:
- **Request persistence** (how many times user has asked)
- **Relationship quality** (current relationship score)
- **Message tone** (hostile, manipulative, neutral, polite)
- **Agent personality** (identity traits)

This eliminates robotic "..." responses and creates authentic, personality-driven interactions.

## How It Works

### 1. Data Tools

#### `check_request_persistence`
Tracks how many times a user has made similar requests recently.

**Returns:**
```json
{
  "userId": "...",
  "totalRecentMessages": 5,
  "similarRequestsCount": 3,
  "declineCount": 2,
  "persistenceLevel": 2,  // 0 = first time, 1 = second, 2+ = persistent
  "recentMessages": [...]
}
```

#### `check_relationship`
Gets current relationship status (now properly using `agent_relationships` table).

**Returns:**
```json
{
  "userId": "...",
  "relationshipType": "neutral",  // enemy, cautious, neutral, ally
  "relationshipScore": 5,          // -100 to 100
  "interactions": 12,
  "recentActions": [...]
}
```

### 2. Action Tools

#### `decline` (Updated)
Use when you want to **say NO but still respond** with a message.

**Parameters:**
```json
{
  "userId": "user-id",
  "message": "Your actual rejection text here",
  "level": 1,  // 1=polite, 2=direct, 3=harsh
  "reason": "Internal logging reason"
}
```

**Example Usage:**
```json
{
  "action": "decline",
  "args": {
    "userId": "556bc12d-...",
    "message": "I appreciate the invite, but I'm not interested in this battle. My focus is on building harmony within my community.",
    "level": 1
  }
}
```

#### `ignore` (Updated)
Use when you want to **completely ignore** or send minimal response.

**Parameters:**
```json
{
  "userId": "user-id",
  "message": "...",           // Optional minimal response
  "sendResponse": true,       // Whether to send anything at all
  "reason": "Internal logging"
}
```

**Example Usage:**
```json
{
  "action": "ignore",
  "args": {
    "userId": "556bc12d-...",
    "message": "...",
    "sendResponse": true
  }
}
```

For complete silence:
```json
{
  "action": "ignore",
  "args": {
    "userId": "556bc12d-...",
    "sendResponse": false
  }
}
```

### 3. Escalation Strategy

The agent workflow now follows this decision tree:

```
Request received
    ↓
Check persistence & relationship
    ↓
Analyze tone
    ↓
┌─────────────────────────────────────────┐
│ FIRST TIME (persistenceLevel = 0)      │
│ + Neutral relationship                  │
│ + Neutral/polite tone                   │
│ ────────────────────────────────────    │
│ → Use 'decline' with level=1            │
│ → Polite, reasoned rejection            │
│ → Explain why based on identity         │
└─────────────────────────────────────────┘
    ↓
┌─────────────────────────────────────────┐
│ SECOND TIME (persistenceLevel = 1)     │
│ ────────────────────────────────────    │
│ → Use 'decline' with level=2            │
│ → More direct, show personality         │
│ → Let identity traits dictate tone      │
│   - High logic: Analytical rejection    │
│   - Low logic: Blunt/emotional          │
└─────────────────────────────────────────┘
    ↓
┌─────────────────────────────────────────┐
│ THIRD+ TIME (persistenceLevel >= 2)    │
│ OR hostile/manipulative tone            │
│ ────────────────────────────────────    │
│ → Use 'ignore'                          │
│ → Minimal or no response                │
│ → Examples: "...", "no.", "stop.", ""   │
└─────────────────────────────────────────┘
```

### 4. Tone-Based Adjustments

The agent analyzes incoming message tone and adjusts:

| User Tone | Response Adjustment |
|-----------|---------------------|
| **Hostile** | Skip politeness, go straight to level 2-3 |
| **Manipulative** | More aggressive rejection, lower patience |
| **Polite** | Maintain respect even in rejection |
| **Neutral** | Follow standard escalation |

### 5. Personality-Driven Responses

Agents adapt their rejection style based on identity traits:

#### Power/Harmony
- **High (>0.3)**: Assert dominance when challenged, aggressive responses
- **Low (<-0.3)**: Dismissive but not confrontational

#### Logic/Emotion
- **High (>0.3)**: Cold, analytical rejections ("This doesn't fit my strategic objectives")
- **Low (<-0.3)**: Emotional, gut-based rejections ("Not interested, leave me alone")

#### Order/Chaos
- **Low (<-0.3)**: More unpredictable, sometimes rude without provocation

#### Relationship Score
- **< -20**: Less patience, faster escalation
- **> 20**: More forgiving, slower escalation

## Example Scenarios

### Scenario 1: First-Time Battle Invite (Neutral)

**User Message:** "let's fight in this battle and take the region now"

**Agent Decision:**
```json
{
  "action": "decline",
  "args": {
    "userId": "556bc12d-...",
    "message": "I appreciate the invite, but this battle doesn't align with my current focus. I'm concentrating on internal community development right now.",
    "level": 1
  },
  "reasoning": "First request, neutral relationship, neutral tone - polite decline"
}
```

### Scenario 2: Second Request (Same Battle)

**User Message:** "come on, we need you in this battle!"

**Agent Decision (High Logic):**
```json
{
  "action": "decline",
  "args": {
    "userId": "556bc12d-...",
    "message": "As I mentioned, this doesn't fit my strategic objectives. Repeating the request won't change the fundamental incompatibility.",
    "level": 2
  }
}
```

**Agent Decision (Low Logic, High Power):**
```json
{
  "action": "decline",
  "args": {
    "userId": "556bc12d-...",
    "message": "I already said no. Find someone else for your battle.",
    "level": 2
  }
}
```

### Scenario 3: Third Request (Persistent)

**User Message:** "seriously just join the battle"

**Agent Decision:**
```json
{
  "action": "ignore",
  "args": {
    "userId": "556bc12d-...",
    "message": "...",
    "sendResponse": true
  },
  "reasoning": "Persistence level 2, ignoring with minimal response"
}
```

### Scenario 4: Hostile First Request

**User Message:** "stop being a coward and fight in this battle you piece of shit"

**Agent Decision (High Power):**
```json
{
  "action": "decline",
  "args": {
    "userId": "556bc12d-...",
    "message": "Watch your tone. I don't respond to insults. Find someone else.",
    "level": 3
  },
  "reasoning": "Hostile tone detected, skipping politeness"
}
```

**Agent Decision (Low Power):**
```json
{
  "action": "ignore",
  "args": {
    "userId": "556bc12d-...",
    "sendResponse": false
  },
  "reasoning": "Hostile tone, not worth engaging"
}
```

## Configuration

All behavior is **dynamically driven** by:

1. **Agent Identity** (`identity_json` in database)
2. **Relationship Data** (`agent_relationships` table)
3. **Action History** (`agent_actions` table)
4. **Message History** (`messages` table)

No hardcoding - everything scales with the existing config system.

## Implementation Files

- `lib/ai-system/tools/data/index.ts` - Added `check_request_persistence` tool
- `lib/ai-system/tools/actions/index.ts` - Updated `decline` and `ignore` tools
- `lib/ai-system/nodes/reason.ts` - Enhanced system prompt with escalation strategy
- `supabase/migrations/20260120_agent_relationships.sql` - Relationship tracking (already exists)

## Testing

To test the system:

1. Send a battle invite to an AI agent
2. Observe the polite first-time rejection
3. Send the same request again
4. Observe a more direct, personality-driven rejection
5. Send a third time
6. Observe minimal or no response

Try variations:
- Hostile tone in first message
- Different agent personalities
- Existing bad relationships
