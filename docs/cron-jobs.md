# Unified Cron System - Single Source of Truth

All time-based game mechanics run on **Supabase pg_cron** (database-level scheduling). This ensures reliability, survives deployments, and is included in the free tier.

## Architecture Overview

- **Single Source of Truth**: All scheduled jobs defined in database migrations
- **No External Dependencies**: No reliance on Vercel cron or external services
- **Free Tier Friendly**: pg_cron included in Supabase free plan
- **Survives Deployments**: Jobs keep running during app redeployment
- **Consistent Timing**: All 1-minute jobs run together for easier debugging

---

## Important Notes

### Conditional Features

Some cron jobs are **conditionally created** based on whether their required database tables exist:

- **Uprising Auto-Fail** (`auto-fail-expired-uprisings`): Requires `rebellions` table
- **Civil War Resolution** (`resolve-expired-civil-wars`): Requires `civil_wars` and `rebellions` tables

These tables are created by the `20250121_revolution_system.sql` migration. If you haven't applied that migration yet, these cron jobs will be skipped automatically without causing errors.

**To enable revolution system features later:**
1. Apply the `20250121_revolution_system.sql` migration
2. Re-run this migration or manually create the functions and schedule the cron jobs

---

## Active Cron Jobs

### Every 1 Minute (High Priority)

| Job Name | Function | Purpose | Migration |
|----------|----------|---------|-----------|
| `resolve-expired-battles` | `resolve_expired_battles()` | Resolves battles where `ends_at <= NOW()`. Determines attacker/defender win, updates region ownership, processes battle ranking. | `20251224_auto_resolve_battles.sql` |
| `resolve-expired-proposals` | `resolve_expired_proposals()` | Resolves law proposals where `expires_at <= NOW()`. Counts votes, determines pass/reject/expire status, executes law actions, sends notifications. | `20261229_unified_cron_system.sql` |
| `auto-fail-expired-uprisings` | `auto_fail_expired_uprisings()` | **[CONDITIONAL]** Auto-fails uprisings in agitation phase where `agitation_expires_at <= NOW()` without reaching required support threshold. Only created if `rebellions` table exists. | `20261229_unified_cron_system.sql` |
| `resolve-expired-civil-wars` | `resolve_expired_civil_wars()` | **[CONDITIONAL]** Resolves civil wars where `ends_at <= NOW()`. Determines revolutionary/government win, swaps sovereign if revolutionaries win, applies morale changes. Only created if `civil_wars` table exists. | `20261229_unified_cron_system.sql` |

### Hourly

| Job Name | Function | Purpose | Migration |
|----------|----------|---------|-----------|
| `psychology-hourly-update` | `run_psychology_update()` | Updates Mental Power for users with 10+ actions in last hour (limit 1000). Updates Identity for users with 5+ AI observations in last 24h (limit 100, max ±0.1 shift per update). | `20260502_psychology_cron.sql` |

### Daily at 3:00 AM

| Job Name | Function | Purpose | Migration |
|----------|----------|---------|-----------|
| `psychology-daily-cleanup` | `run_psychology_cleanup()` | Cleans old coherence_history (keeps last 50 per user). Cleans old identity_observations (keeps last 100, older than 30 days). | `20260502_psychology_cron.sql` |

---

## Time-Based Game Mechanics

### Battle System
- **Duration**: 1 hour per battle
- **Auto-Resolution**: Every 1 minute via `resolve-expired-battles`
- **Win Conditions**:
  - Attacker wins if `current_defense <= 0`
  - Defender wins if `NOW() >= ends_at`
- **Side Effects**: Updates `world_regions` ownership, processes battle ranking

**Database Table**: `battles`
- `started_at` (TIMESTAMPTZ)
- `ends_at` (TIMESTAMPTZ) - set to `NOW() + INTERVAL '1 hour'`
- `status` - 'active', 'attacker_win', 'defender_win'
- `current_defense` (INT, starts at 10000)

---

### Law/Proposal System
- **Duration**: Varies by law type and governance
  - MESSAGE_OF_THE_DAY: 0h (instant)
  - PROPOSE_HEIR: 12h (monarchy)
  - DECLARE_WAR: 24h (monarchy), 48h (democracy)
  - CHANGE_GOVERNANCE: 48h (monarchy)
- **Auto-Resolution**: Every 1 minute via `resolve-expired-proposals`
- **Resolution Logic**:
  - Counts yes/no votes
  - Determines pass/reject/expire based on governance rules
  - Executes law actions (creates announcements, conflicts, updates heir/governance)
  - Sends notifications to community members
- **Early Resolution**: Proposals can resolve before expiration if decisive vote reached (handled in app layer)

**Database Table**: `community_proposals`
- `created_at` (TIMESTAMPTZ)
- `expires_at` (TIMESTAMPTZ)
- `resolved_at` (TIMESTAMPTZ)
- `status` - 'pending', 'passed', 'rejected', 'expired', 'failed'

**Law Execution**:
- `MESSAGE_OF_THE_DAY`: Creates record in `community_announcements`
- `DECLARE_WAR`: Creates record in `community_conflicts`
- `PROPOSE_HEIR`: Updates `communities.heir_id`
- `CHANGE_GOVERNANCE`: Updates `communities.governance_type`

---

### Revolution/Uprising System
- **Agitation Phase**: 1 hour to gather support
  - Requires 20% community support (excluding governor)
  - Auto-fails if time expires without threshold via `auto-fail-expired-uprisings`
- **Battle Phase**: 1 hour civil war
  - Works like regular battles (10,000 defense)
  - Auto-resolves via `resolve-expired-civil-wars`
- **Cooldowns**:
  - Exile cooldown: 1 hour
  - Failure cooldown: 72 hours
  - Negotiation cooldown: 72 hours

**Database Tables**:
- `rebellions`: Tracks uprising progress and status
- `civil_wars`: Separate battle instances for uprisings
- `rebellion_supports`: Tracks individual supporters
- `rebellion_negotiations`: Peace negotiation tracking

**Win Conditions**:
- Revolutionary win: `current_defense <= 0` → Leader becomes sovereign (rank 0)
- Government win: `NOW() >= ends_at` → Rebellion fails, 72h cooldown

---

### Psychology System
- **Mental Power Update**: Hourly for users with 10+ actions
  - Calculates moving average of coherence scores
  - Updates `users.mental_power`
- **Identity Update**: Hourly for users with 5+ AI observations
  - Aggregates AI observations from last 24h
  - Shifts identity alignment (max ±0.1 per update)
- **Cleanup**: Daily at 3am
  - Removes old coherence_history (keeps last 50/user)
  - Removes old identity_observations (keeps last 100, >30 days old)

**Database Tables**:
- `users`: `mental_power`, identity axes (`authoritarian_libertarian`, `collectivist_individualist`, etc.)
- `coherence_history`: Tracks coherence scores over time
- `identity_observations`: AI-generated observations about user behavior

---

### Energy Regeneration
- **Type**: Calculated on-demand (not cron-based)
- **Base Rate**: 10 energy per hour
- **Cap**: 100 (can be modified by rank/items in future)
- **Function**: `get_current_energy(user_id UUID)`
  - Calculates energy since last update
  - Applies morale modifier (>80 morale = +20% regen)
  - Future-ready for item buffs, rank bonuses
- **Update Function**: `update_user_energy(user_id UUID, energy_delta INTEGER)`
  - Called when energy is spent or gained
  - Stores new value + timestamp in `users.energy` and `users.energy_updated_at`

**Why On-Demand?**
- Flexible for future modifiers (morale, items, buffs)
- Reduces database writes (only updates when energy is actually used)
- No cron overhead for simple calculation

---

## Monitoring & Debugging

### Check Cron Job Status

```sql
-- List all scheduled jobs
SELECT * FROM cron.job;

-- Check recent job runs
SELECT *
FROM cron.job_run_details
ORDER BY start_time DESC
LIMIT 20;

-- Check for failed jobs
SELECT *
FROM cron.job_run_details
WHERE status = 'failed'
ORDER BY start_time DESC
LIMIT 10;

-- Check specific job runs
SELECT *
FROM cron.job_run_details
WHERE jobid = (SELECT jobid FROM cron.job WHERE jobname = 'resolve-expired-battles')
ORDER BY start_time DESC
LIMIT 10;
```

### Manual Execution (Testing)

```sql
-- Manually trigger battle resolution
SELECT resolve_expired_battles();

-- Manually trigger law resolution
SELECT resolve_expired_proposals();

-- Manually trigger uprising auto-fail
SELECT auto_fail_expired_uprisings();

-- Manually trigger civil war resolution
SELECT resolve_expired_civil_wars();

-- Check user's current energy (calculated)
SELECT get_current_energy('user-uuid-here'::UUID);

-- Update user energy (e.g., spend 10 energy)
SELECT update_user_energy('user-uuid-here'::UUID, -10);
```

### Logs and Debugging

- **Cron execution logs**: Stored in `cron.job_run_details`
- **Game event logs**: Stored in `game_logs` table
- **Function comments**: Each function has SQL comments explaining its purpose
- **Migration comments**: Each migration includes detailed documentation

---

## Migration History

| Migration | Date | Purpose |
|-----------|------|---------|
| `20251224_auto_resolve_battles.sql` | 2025-12-24 | Battle auto-resolution (every 1 min) |
| `20260502_psychology_cron.sql` | 2026-05-02 | Psychology updates (hourly) and cleanup (daily 3am) |
| `20261229_unified_cron_system.sql` | 2026-12-29 | **Unified system**: Law resolution, uprising auto-fail, civil war resolution, energy calculation functions |

---

## Best Practices

### Adding a New Cron Job

1. **Create database function** in new migration:
   ```sql
   CREATE OR REPLACE FUNCTION my_new_cron_function()
   RETURNS TABLE(...) AS $$
   BEGIN
     -- Your logic here
   END;
   $$ LANGUAGE plpgsql;
   ```

2. **Schedule the job**:
   ```sql
   SELECT cron.schedule(
     'my-job-name',
     '*/5 * * * *',  -- Cron schedule (every 5 minutes)
     $$SELECT my_new_cron_function()$$
   );
   ```

3. **Add documentation** to this file

4. **Test manually** before deploying:
   ```sql
   SELECT my_new_cron_function();
   ```

### Cron Schedule Syntax

Standard cron syntax: `minute hour day-of-month month day-of-week`

Examples:
- `*/1 * * * *` - Every 1 minute
- `0 * * * *` - Every hour at minute 0
- `0 3 * * *` - Daily at 3:00 AM
- `*/5 * * * *` - Every 5 minutes
- `0 0 * * 0` - Weekly on Sunday at midnight

### Removing a Cron Job

```sql
-- Unschedule by job name
SELECT cron.unschedule('job-name-here');

-- Or by job ID
SELECT cron.unschedule(jobid) FROM cron.job WHERE jobname = 'job-name-here';
```

---

## Removed API Routes

The following API routes have been removed as they are now handled by pg_cron:

- ❌ `/app/api/cron/psychology-update/route.ts` - Duplicate of pg_cron hourly job
- ❌ `/app/api/cron/resolve-laws/route.ts` - Now handled by `resolve-expired-proposals`
- ❌ `/app/api/cron/resolve-proposals/route.ts` - Alias of resolve-laws, redundant

### Optional AI Workflow Route

- ⚠️ `/app/api/cron/workflows/route.ts` - Kept for manual/on-demand AI workflow triggering
  - **Not part of core game mechanics**
  - Can be triggered manually or via external service if needed
  - Not scheduled in pg_cron (AI workflows are event-driven, not time-based)

---

## Future Enhancements

### Potential New Cron Jobs

1. **Morale Decay/Recovery** (if needed)
   - Gradual morale changes based on community state
   - Could run hourly or daily

2. **Resource Regeneration** (if added)
   - Other resources beyond energy
   - Could follow same on-demand pattern as energy

3. **Event Spawning** (if added)
   - Random world events
   - Could run daily or weekly

4. **Leaderboard Updates** (if needed)
   - Pre-compute leaderboard rankings
   - Could run every 5-15 minutes

### Energy System Enhancements

Currently ready to support:
- **Item Buffs**: Add items that boost energy cap or regen rate
- **Rank Bonuses**: Higher-ranked community members get faster regen
- **Battle Fatigue**: Slow down regen for users in active battles
- **Morale Effects**: Already supports >80 morale = +20% regen

To add new modifiers, update `get_current_energy()` function in migration.

---

## Troubleshooting

### Cron job not running?

1. Check if job exists:
   ```sql
   SELECT * FROM cron.job WHERE jobname = 'job-name-here';
   ```

2. Check recent runs:
   ```sql
   SELECT * FROM cron.job_run_details
   WHERE jobid = (SELECT jobid FROM cron.job WHERE jobname = 'job-name-here')
   ORDER BY start_time DESC LIMIT 5;
   ```

3. Check for errors:
   ```sql
   SELECT * FROM cron.job_run_details
   WHERE status = 'failed' AND jobid = (SELECT jobid FROM cron.job WHERE jobname = 'job-name-here')
   ORDER BY start_time DESC LIMIT 5;
   ```

### Function returns wrong results?

1. Test function manually with sample data
2. Check function logic in migration file
3. Add logging via `RAISE NOTICE` in pl/pgsql
4. Check `game_logs` table for expected event logs

### Job running too slow?

1. Add indexes on columns used in WHERE clauses
2. Use `EXPLAIN ANALYZE` to profile queries
3. Consider batching or limiting rows processed per run
4. Check `cron.job_run_details` for execution times

---

## Contact & Support

For issues with cron jobs:
1. Check Supabase dashboard for pg_cron status
2. Review `cron.job_run_details` for error messages
3. Test functions manually before troubleshooting cron schedule
4. Check migration files for function definitions and comments

---

**Last Updated**: December 29, 2026
**Maintained By**: Development Team
**Migration**: `20261229_unified_cron_system.sql`
