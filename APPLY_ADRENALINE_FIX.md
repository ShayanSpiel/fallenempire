# Apply Adrenaline Configuration Fix

## What Changed

Fixed adrenaline system configuration:
- **Damage threshold**: 1.5x → 2.0x (now requires 2x damage difference, not 50% more)
- **Check interval**: 1 second → 10 seconds (optimized for performance)

## How to Apply

### Option 1: Supabase Dashboard (Recommended)
1. Go to https://supabase.com/dashboard
2. Navigate to SQL Editor
3. Copy and paste the contents of `UPDATE_ADRENALINE_CONFIG.sql`
4. Click "Run"

### Option 2: Command Line
```bash
# If you have psql installed
psql "postgresql://postgres.npgdvvwsxgktdqdfhdlh:Shaya20021101@aws-0-us-east-1.pooler.supabase.com:6543/postgres" -f UPDATE_ADRENALINE_CONFIG.sql

# Or use Supabase CLI (if working)
npx supabase db execute --file UPDATE_ADRENALINE_CONFIG.sql
```

## What This Does

Updates the `battle_mechanics_config` table to set:
- `adrenaline_damage_threshold_ratio = 2.0` (was 1.5)
- `adrenaline_check_interval_seconds = 10` (was 1)

This applies to all communities using the default config or configs with the old values.

## Verification

After running, the SQL script will show all config rows. Verify that:
- Global config (community_id IS NULL) has correct values
- Community-specific configs are updated if they had old values
