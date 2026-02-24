# Adrenaline System (Final Stand) - Complete Explanation

## Overview
The adrenaline system gives **defenders only** a rage bonus when they're losing badly in the final phase of battle.

## When It Activates

### 1. Final Stand Window
- Activates in the **last 33%** of battle time (configurable)
- Example: 60-minute battle → activates at 40-minute mark (last 20 minutes)
- Calculated dynamically based on `started_at` and `ends_at`

### 2. Damage Difference Condition
- Requires **2x damage difference** (not 1.5x)
- Formula: `attacker_score / defender_score >= 2.0`
- Examples:
  - ✅ Attacker: 200, Defender: 100 → Ratio: 2.0 (condition MET)
  - ✅ Attacker: 300, Defender: 100 → Ratio: 3.0 (condition MET)
  - ❌ Attacker: 150, Defender: 100 → Ratio: 1.5 (condition NOT MET)

## How Rage Accumulates

### Formula
```typescript
// 1. Calculate percentage of TOTAL battle time the condition has been met
percentOfBattle = (cumulativeTimeMs / totalBattleDurationMs) * 100

// 2. Calculate bonus rage
bonusRage = Math.floor(percentOfBattle * rage_per_percent_time)
bonusRage = Math.min(bonusRage, max_rage) // Cap at 33
```

### Example (60-minute battle)
- Total battle duration: 60 minutes = 3,600,000 ms
- 1% of battle time: 0.6 minutes = 36 seconds
- Final 33% window: Last 20 minutes (from minute 40 to 60)

**Scenario:**
1. At minute 40: Condition becomes true (attacker has 2x damage)
2. Condition stays true for 10 minutes
3. 10 minutes = 600,000 ms
4. Percentage of battle: (600,000 / 3,600,000) × 100 = 16.67%
5. Bonus rage: 16.67 × 1 = 16 rage (floored)

**If condition stays true for entire final window:**
- 20 minutes active = 1,200,000 ms
- Percentage: (1,200,000 / 3,600,000) × 100 = 33.33%
- Bonus rage: 33 (capped at max_rage)

## Dynamic Behavior

### Starts and Stops
- ✅ If damage ratio **drops below 2.0**, accumulation **stops**
- ✅ If damage ratio **goes back above 2.0**, accumulation **resumes**
- ✅ Only cumulative time when condition is **actively met** counts

### Update Frequency
- Client checks every **10 seconds** (not 1 second - optimized!)
- Accumulates time delta only when both:
  - In final stand window (last 33%)
  - Damage ratio >= 2.0

## Configuration (Per Community)

```typescript
{
  enabled: true,                        // Enable/disable system
  final_stand_window_percent: 33,       // Last 33% of battle
  damage_threshold_ratio: 2.0,          // 2x damage required (NOT 1.5x!)
  rage_per_percent_time: 1,             // +1 rage per 1% of battle time
  max_rage: 33,                         // Maximum 33 rage bonus
  check_interval_seconds: 10,           // Check every 10 seconds
}
```

## Visual Display

### Adrenaline Bar Shows:
- **Is Active**: Green/red gradient bar with pulsing animation
- **Bonus Rage**: "+X RAGE" display (0-33)
- **Progress**: Bar fill percentage based on accumulated time
- **Label**: "2x Damage Difference!!" (matches the actual threshold)

### Only Visible When:
- User is on **defender** side
- **Both** conditions met:
  1. In final stand window (last 33%)
  2. Attacker damage >= 2x defender damage

## Server Validation

Server validates all adrenaline bonuses to prevent cheating:
```sql
validate_adrenaline_bonus(
  p_battle_id,
  p_claimed_bonus,
  p_user_side
)
```

Checks:
- ✅ User is defender (attackers can't get bonus)
- ✅ In final stand window
- ✅ Adrenaline enabled for community
- ✅ Bonus doesn't exceed max_rage

## Summary

**Correct Understanding:**
- 2x damage difference = ratio of 2.0 (attacker has double defender's damage)
- +1 rage per 1% of TOTAL battle time (not per minute)
- Max 33 rage over full final stand window (33% of battle)
- Check every 10 seconds (not every second - optimized)
- Defender-only bonus
- Stops/resumes dynamically based on damage ratio
