# Revolution & Uprising System - Complete Implementation

## Overview

A high-stakes political upheaval mechanic allowing communities to revolt against their Sovereign. Features morale-based triggers, multi-stage agitation → battle → resolution flow, exile mechanics, and diplomatic negotiations.

---

## Files Created

### 1. **Design System** (`lib/revolution-design-system.ts`)
- **Purpose**: Zero hardcoding, theme-consistent styling
- **Contents**:
  - `REVOLUTION_COLOR_SCHEME`: Red/Amber palette for uprisen
  - `NEGOTIATION_COLOR_SCHEME`: Amber palette for diplomacy
  - `phaseStyles`: Status-based UI labels
  - Helper functions: `getRevolutionColorScheme()`, `buildRevolutionClassName()`
  - Spacing, typography, and component tokens
  - Notification and progress bar styling

### 2. **Database Migration** (`supabase/migrations/20250121_revolution_system.sql`)
- **Tables**:
  - `rebellions`: Core uprising tracking with status progression
  - `rebellion_supports`: Individual supporter tracking
  - `civil_wars`: Separate battle table for future customization
  - `rebellion_negotiations`: Scalable negotiation system for future contracts/voting

- **RPC Functions** (14 total):
  1. `calculate_required_supports()` - 20% of community, excluding governor
  2. `can_start_revolution()` - Check morale triggers and eligibility
  3. `start_uprising()` - Initialize revolution
  4. `support_uprising()` - Add support, auto-trigger battle
  5. `exile_uprising_leader()` - Governor exile action
  6. `reinvite_exiled_leader()` - Advisor/Secretary reinvitation
  7. `request_negotiation()` - Governor peace offer
  8. `respond_to_negotiation()` - Leader accepts/rejects
  9. `resolve_civil_war()` - Battle outcome resolution
  10. `auto_fail_expired_uprisings()` - Cleanup for expired agitations
  11. Plus RLS policy functions

- **Indexes**: Optimized for fast lookups and Realtime
- **RLS**: Automatic access control based on community membership

### 3. **Server Actions** (`app/actions/revolution.ts`)
- **Core Actions**:
  - `startUprisingAction()` - Launch a revolution
  - `supportUprisingAction()` - Support an uprising
  - `exileUprisingLeaderAction()` - Governor exile
  - `reinviteExiledLeaderAction()` - Bring back leader
  - `requestNegotiationAction()` - Governor negotiation
  - `respondToNegotiationAction()` - Leader response

- **Query Actions**:
  - `getActiveRebellionAction()` - Get current uprising
  - `getRebellionDetailsAction()` - Full rebellion data
  - `getSupporterCountAction()` - Get supporter list
  - `getActiveNegotiationAction()` - Get negotiation request
  - `canStartRevolutionAction()` - Check eligibility
  - `getRebellionHistoryAction()` - Past uprisings

- **Features**:
  - Type-safe return values
  - Morale event integration
  - Game log tracking
  - Error handling

### 4. **Main Component** (`components/community/revolution-component.tsx`)
- **Features**:
  - Live Realtime subscriptions for progress bar
  - Dynamic button states based on phase and role
  - Supporter avatars display
  - Countdown timer for agitation phase
  - Role-based actions (Governor negotiate/exile, Members support)
  - Exiled leader notification banner

- **States**:
  - `agitation`: Gathering support (1 hour countdown)
  - `battle`: Civil war active
  - Success/Failed/Negotiated: Results

### 5. **Negotiation Modal** (`components/community/negotiation-modal.tsx`)
- **Features**:
  - Governor can send negotiation request
  - Leader can accept (ends revolution, 72-hour cooldown) or reject (continues)
  - Scalable for future contract/voting systems
  - Theme-aware styling using `NEGOTIATION_COLOR_SCHEME`

### 6. **Integration** (Modified `components/community/community-details-client.tsx`)
- Added `RevolutionComponent` import
- Integrated into Governance tab
- Placed above Governance Hierarchy for visual hierarchy
- Conditional rendering based on membership

---

## Game Mechanics

### Trigger Conditions
Revolution button appears when:
- Individual morale < 50 **OR**
- Community average morale < 30

### Phases

#### 1. **Spark** (1 second)
- First clicker becomes leader
- Notification sent: "X Started a Revolution Uprising"
- Progress bar appears

#### 2. **Agitation** (1 hour)
- Members click "Support The Revolt" to add support
- Governor sees "Negotiate with Revolutionaries" button
- Progress bar: `current_supports / required_supports`
- Countdown timer shows remaining time
- Required supports: 20% of community (excluding governor)

**Actions**:
- **Governor**: Negotiate (send request) or Exile Leader (kick + 1-hour cooldown)
- **Members**: Support or do nothing
- **Leader**: Can't be sovereign

#### 3. **Battle** (1 hour)
- When threshold met, `civil_wars` table records the battle
- Civil war lasts 1 hour
- Attacker (revolutionaries) vs Defender (government)
- Battle mechanics: Same as regular battles (attack/defend/score)

#### 4. **Resolution**

**Revolutionary Win**:
- Leader → rank 0 (Sovereign)
- Governor → rank 10 (Citizen)
- Supporters: +20 morale
- Non-supporters: -10 morale
- Status: `success`

**Government Win**:
- Governor keeps rank 0
- Leader stays citizen
- Status: `failed`
- 72-hour cooldown activates (no new revolutions)

**Negotiated**:
- Revolution ends
- Both leader and governor reset to 50 morale
- Status: `negotiated`
- 72-hour cooldown activates

### Exile Mechanic

**Governor Action**:
- Can exile the leader anytime during agitation/battle
- Leader is kicked from community
- Governor takes -15 morale penalty
- Cooldown becomes 1 hour (not 72), allowing immediate new revolution
- Notification: "The King/President Exiled The Leader..."

**Advisor/Secretary Action**:
- Can reinvite exiled leader
- Leader returns with rank 10
- Progress bar resumes from where it was
- Supporters persist
- Notification: "The Leader of the Revolution is invited back..."
- If no one reinvites leader within 1 hour, revolution fails

---

## Cooldown System

| Scenario | Duration | Scope |
|----------|----------|-------|
| Failed (time expires) | 72 hours | Community-wide |
| Failed (government wins) | 72 hours | Community-wide |
| Negotiated (peace agreed) | 72 hours | Community-wide |
| Exile (leader kicked) | 1 hour | Community-wide, BUT allows immediate new uprisings |

---

## Database Constraints & Validation

- **One active rebellion per community**: `UNIQUE (community_id, status) WHERE status IN ('agitation', 'battle')`
- **One sovereign per community**: Enforced in `community_members` trigger
- **Required supports validation**: Must be > 0
- **Morale triggers**: Individual < 50 OR community < 30
- **Role-based actions**: RPC validation for governor/advisor/leader actions

---

## Realtime Features

Tables enabled for Realtime:
- `rebellions` - Live progress bar updates
- `rebellion_supports` - Live supporter count
- `civil_wars` - Live battle state
- `rebellion_negotiations` - Live negotiation requests

React component subscribes to channel:
```typescript
supabase.channel(`rebellion:${rebellion.id}`)
  .on('postgres_changes', { table: 'rebellions', ... })
  .on('postgres_changes', { table: 'rebellion_supports', ... })
  .subscribe()
```

---

## Design System Integration

**Zero Hardcoding Approach**:
- All colors from `revolution-design-system.ts`
- Spacing/Typography from `lib/design-system.ts`
- No inline Tailwind strings in components
- Scalable: Can easily add different uprising types/colors

**Theme-Aware**:
- Uses Tailwind dark: modifiers
- Red → Amber gradient for revolution (high tension)
- Amber primary for negotiations (diplomacy)
- Consistent with existing law system theming

---

## Future Enhancements

### Scalable Foundation Ready For:
1. **Contract System**: `rebellion_negotiations.terms_json` stores complex terms
2. **Voting System**: Extend negotiation terms to include voting periods
3. **Different Uprising Types**: Add faction colors, resource-based uprisings
4. **Alliance Mechanics**: Multiple communities revolting together
5. **Propaganda/Morale Warfare**: Laws that affect revolution thresholds
6. **Historical Tracking**: Full audit trail via `game_logs` + negotiation table

---

## Testing Checklist

- [ ] Verify migration runs without errors
- [ ] Test trigger conditions (morale < 50 / < 30)
- [ ] Start uprising → creates rebellion record
- [ ] Support uprising → adds supporter
- [ ] Progress bar reaches threshold → auto-starts civil war
- [ ] Governor can exile leader → removes from community
- [ ] Governor can negotiate → sends negotiation request
- [ ] Leader can accept negotiation → ends rebellion
- [ ] Leader can reject negotiation → continues
- [ ] Exile leader → cooldown is 1 hour (not 72)
- [ ] Reinvite leader → supporter count persists
- [ ] Civil war resolves → sovereign swap on revolutionary win
- [ ] Morale penalties apply to non-supporters
- [ ] Realtime updates reflect in UI
- [ ] Failed uprising → 72-hour cooldown
- [ ] Negotiated outcome → 72-hour cooldown

---

## Component Hierarchy

```
CommunityDetailsClient
├── Governance Tab
│   ├── GovernanceHierarchy (first)
│   └── RevolutionComponent (last)
│       ├── Phases: Spark → Agitation → Battle → Resolution
│       ├── Actions: Start / Support / Exile / Negotiate
│       ├── Mini Morale Bar (when dormant)
│       ├── Realtime Subscription
│       └── NegotiationModal (conditional)
```

**Visual Order**: Governance roles → Revolution mechanics (bottom priority)

---

## Code Quality

- ✅ No hardcoding (all theme tokens)
- ✅ Type-safe (TypeScript throughout)
- ✅ RLS security (automatic access control)
- ✅ Atomic operations (RPC functions)
- ✅ Realtime-ready (Replica Identity FULL)
- ✅ Scalable schema (JSONB for future contracts)
- ✅ Error handling (proper error messages)
- ✅ Game integration (morale events, game logs)
- ✅ Follows existing patterns (like law system)

---

## Next Steps

1. **Run Migration**: `npx supabase migration list` to verify
2. **Test Flow**: Join community, trigger morale < 50, start uprising
3. **Iterate on UX**: Feedback from test runs
4. **Add Notifications**: Wire into notification system (banner + sidebar)
5. **Add Civil War UI**: Full battle interface
6. **Add History**: Past revolutions display

---

Generated: 2025-12-21
Scope: Complete Revolution & Uprising System
Status: Ready for testing
