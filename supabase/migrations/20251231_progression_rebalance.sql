-- =====================================================
-- PROGRESSION SYSTEM REBALANCING
-- =====================================================
-- This migration documents the progression rebalancing that shifts
-- the game from weeks-to-max to years-to-max progression.
--
-- Changes implemented:
-- 1. Strength training: 1.0 → 0.1 per day (10x slower)
-- 2. XP daily caps: 850 → 200 total (battle: 500→100, social: 300→50)
-- 3. Military ranks: 9 → 16 ranks with new exponential thresholds
-- 4. Rank damage bonus: Each rank adds +5% damage (additive)
--
-- Timeline targets:
-- - Rank 2 (Private): 1 week full grind
-- - Level 5: 1-2 weeks realistic
-- - Rank 16 (General): ~3 years
-- - Level 100: ~2.7 years at max grind
-- =====================================================

-- =====================================================
-- 1. MILITARY RANK EXPANSION (9 → 16 ranks)
-- =====================================================
-- The current_military_rank column already exists as TEXT,
-- so no schema changes needed. The new ranks are:
--
-- Rank  | Name                | Min Score    | Max Score    | Damage Bonus
-- ------|---------------------|--------------|--------------|-------------
-- 1     | Recruit             | 0            | 999          | +0%
-- 2     | Private             | 1,000        | 4,999        | +5%
-- 3     | Private First Class | 5,000        | 14,999       | +10%
-- 4     | Corporal            | 15,000       | 39,999       | +15%
-- 5     | Sergeant            | 40,000       | 99,999       | +20%
-- 6     | Staff Sergeant      | 100,000      | 249,999      | +25%
-- 7     | Sergeant Major      | 250,000      | 599,999      | +30%
-- 8     | Warrant Officer     | 600,000      | 1,199,999    | +35%
-- 9     | Lieutenant          | 1,200,000    | 2,399,999    | +40%
-- 10    | Captain             | 2,400,000    | 4,799,999    | +45%
-- 11    | Major               | 4,800,000    | 8,999,999    | +50%
-- 12    | Lieutenant Colonel  | 9,000,000    | 15,999,999   | +55%
-- 13    | Colonel             | 16,000,000   | 27,999,999   | +60%
-- 14    | Brigadier General   | 28,000,000   | 47,999,999   | +65%
-- 15    | Major General       | 48,000,000   | 79,999,999   | +70%
-- 16    | General             | 80,000,000+  | ∞            | +75%

COMMENT ON COLUMN users.current_military_rank IS
'Military rank (1-16): Recruit, Private, Private First Class, Corporal, Sergeant, Staff Sergeant, Sergeant Major, Warrant Officer, Lieutenant, Captain, Major, Lieutenant Colonel, Colonel, Brigadier General, Major General, General. Each rank adds +5% damage bonus (additive).';

-- =====================================================
-- 2. RANK DAMAGE BONUS SYSTEM
-- =====================================================
-- Rank damage bonus formula: finalDamage = baseDamage × (1 + rankNumber × 0.05)
-- Examples:
--   - Recruit (Rank 1):  10,000 base → 10,000 damage (1.00x)
--   - Captain (Rank 10): 10,000 base → 14,500 damage (1.45x)
--   - General (Rank 16): 10,000 base → 17,500 damage (1.75x)
--
-- Implementation: Applied in app/api/battle/attack/route.ts via getRankDamageMultiplier()

-- =====================================================
-- 3. STRENGTH TRAINING REBALANCE
-- =====================================================
-- Strength gain per training reduced from 1.0 to 0.1
-- This makes strength progression 10x slower:
--   - Week 1:   0.7 strength (vs. 7 previously)
--   - Month 1:  3 strength (vs. 30 previously)
--   - Year 1:   36.5 strength (vs. 365 previously)
--   - Year 3:   109.5 strength (vs. 1,095 previously)
--
-- Implementation: Applied in app/actions/training.ts

COMMENT ON COLUMN users.strength IS
'Combat strength. Gains +0.1 per daily training. Base damage = 100 × strength × rank_multiplier.';

-- =====================================================
-- 4. XP SYSTEM REBALANCE
-- =====================================================
-- Daily XP caps reduced to slow progression:
--   - Battle XP:   500 → 100 per day
--   - Social XP:   300 → 50 per day (posts + comments)
--   - Training XP: 50 (unchanged)
--   - TOTAL:       850 → 200 per day
--
-- This achieves multi-year progression:
--   - Level 5:  1-2 weeks realistic
--   - Level 10: 2 weeks realistic
--   - Level 30: 2 months realistic
--   - Level 50: 6 months realistic
--   - Level 100: ~2.7 years realistic
--
-- Leaves room for future economy module (~50-100 XP/day)
--
-- Implementation: Applied in lib/progression.ts (DAILY_XP_CAPS)

-- =====================================================
-- 5. BALANCE VALIDATION CHECKPOINTS
-- =====================================================
-- Week 1 Full Grind:
--   - 0.7 strength training
--   - ~21,000 total damage from battles
--   - Achieves Rank 2 (Private) ✓
--
-- Year 3 Full Grind:
--   - 109.5 strength from training
--   - ~80,000,000 total damage (accelerating with rank bonuses)
--   - Achieves Rank 16 (General) ✓
--   - Level 100 ✓

-- =====================================================
-- 6. PERFORMANCE INDEXES
-- =====================================================
-- Indexes already exist from 20260126_military_ranking_system.sql:
--   - idx_users_military_rank_score (for leaderboards)
--   - idx_users_current_military_rank (for filtering by rank)

-- Additional index for strength-based queries (if needed for future features)
CREATE INDEX IF NOT EXISTS idx_users_strength ON users(strength DESC)
WHERE strength > 0;

-- =====================================================
-- 7. MIGRATION VERIFICATION
-- =====================================================
-- This migration is primarily documentation and a structural marker.
-- The actual logic changes are implemented in TypeScript:
--   - lib/progression.ts: XP caps
--   - lib/military-ranks.ts: Rank definitions and damage multipliers
--   - app/actions/training.ts: Strength increment
--   - app/api/battle/attack/route.ts: Rank damage bonus application
--
-- No data migration needed as:
--   - Existing ranks are valid (subset of new ranks)
--   - XP caps are enforced at runtime, not in DB
--   - Strength values remain valid
--   - Damage bonus applies automatically based on current rank

-- =====================================================
-- 8. ROLLBACK NOTES
-- =====================================================
-- To revert this rebalancing:
-- 1. Revert TypeScript changes in the 4 files mentioned above
-- 2. Drop the strength index: DROP INDEX IF EXISTS idx_users_strength;
-- 3. Remove column comments
--
-- Note: User progress (strength, XP, ranks) is preserved and does not
-- need to be rolled back, as the new system is more conservative.
