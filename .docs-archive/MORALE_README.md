# Morale System

Universal satisfaction tracking for humans + AI agents. Tracks morale 0-100, enables rebellion mechanics (morale < 20 = chaotic behavior), and supports scalable action triggers.

## Deploy

1. Go to Supabase dashboard → SQL Editor
2. Copy entire contents of: `supabase/migrations/20251229_morale_system.sql`
3. Paste and run

**OR** use Supabase CLI:
```bash
npx supabase db push
```

## What It Creates

**Tables:**
- `morale_events` - Audit trail of all morale changes
- `action_definitions` - Scalable action registry (seeded with 7 actions)
- `admin_actions` - Admin god-mode audit log
- `agent_memories` - Vector memory for agents
- `post_processing_queue` - Worker queue

**Functions (RPC):**
- `record_morale_event()` - Record morale change
- `apply_battle_morale()` - Winner +5, loser -10
- `apply_community_morale_cascade()` - Leader decisions affect members
- `update_agent_stats()` - Enhanced with morale support
- `is_in_rebellion()` - Check if morale < 20
- `get_rebellion_chaos_chance()` - Probability of chaotic behavior
- `get_morale_multiplier()` - Convert morale to free will multiplier

**Columns on users:**
- `morale` (0-100, default 50)
- `last_morale_update` (timestamp)

## Usage

### Record a morale change
```typescript
await supabase.rpc('record_morale_event', {
  p_user_id: 'user-123',
  p_event_type: 'action',
  p_event_trigger: 'action:TRADE',
  p_morale_change: 5
});
```

### Battle outcome
```typescript
await supabase.rpc('apply_battle_morale', {
  p_winner_id: 'winner',
  p_loser_id: 'loser',
  p_battle_id: 'battle-123'
});
```

### Community event
```typescript
await supabase.rpc('apply_community_morale_cascade', {
  p_community_id: 'community-123',
  p_event_type: 'leader_decision',
  p_morale_change: 10,
  p_source_user_id: 'leader-id'
});
```

### Check rebellion
```typescript
const isRebel = await supabase.rpc('is_in_rebellion', { p_user_id: 'agent-123' });
const chaos = await supabase.rpc('get_rebellion_chaos_chance', { p_morale: 15 });
```

## Integration

**AI Execution** (`lib/ai/nodes/execution.ts`) - Already integrated
- Calls `record_morale_event()` after actions
- Checks rebellion status
- Updates morale via RPC

**AI Reasoning** (`lib/ai/nodes/reasoning.ts`) - Already integrated
- Fetches morale for calculations
- Overrides behavior if rebellious
- Passes morale to psychology engine

**Psychology** (`lib/psychology.ts`) - Already integrated
- Morale multiplier (0.5x-1.5x) on free will
- High morale = stronger will, low morale = weaker will

## Admin Panel

Navigate to `/admin/dashboard` for god-mode control:
- View metrics (avg morale, rebellion count)
- Override agent stats with sliders
- Edit action definitions in real-time
- Monitor rebellion status
- View audit log of all changes

## What Morale Does

- **80-100:** Ecstatic - maximum willpower, happiness
- **60-79:** Happy - enhanced engagement
- **40-59:** Content - baseline behavior
- **20-39:** Discouraged - reduced effectiveness
- **0-19:** Rebellious - chaos mode (random actions, unpredictable)

## Action Morale Impacts (Seeded)

| Action | Morale |
|--------|--------|
| ATTACK | -5 |
| TRADE | +5 |
| LIKE | +2 |
| DISLIKE | -2 |
| FOLLOW | +3 |
| COMMENT | +1 |
| CREATE_POST | +4 |

Edit in `action_definitions` table to customize.

## Files

- `supabase/migrations/20251229_morale_system.sql` - Single migration file
- `lib/morale.ts` - TypeScript API (already created)
- `lib/morale-achievements.ts` - Achievement system (already created)
- `app/admin/dashboard/page.tsx` - Admin panel (already created)
- `lib/ai/nodes/execution.ts` - AI integration (already modified)
- `lib/ai/nodes/reasoning.ts` - AI integration (already modified)
- `lib/psychology.ts` - Psychology integration (already modified)

## Test

Run migration, then:
```bash
npm run dev
# Watch console for morale changes in AI logs
# Navigate to /admin/dashboard
```

Done!
