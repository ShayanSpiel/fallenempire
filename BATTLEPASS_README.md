# Battle Pass System Setup Guide

## Overview

A fully-featured monthly battle pass system with:
- ✅ 40 tiers with dual tracks (Free + Keeper Pass)
- ✅ Golden gradient UI with magical animations
- ✅ Integrated with mission XP system
- ✅ Daily login rewards (100 XP once per day)
- ✅ Collapsible banner on feed page
- ✅ Full battle pass view page at `/battlepass`
- ✅ Reward claiming with animated modals
- ✅ Scalable reward configuration via database

## Setup Instructions

### 1. Apply Database Migrations

You need to run **three** SQL migrations in order:

```bash
# Migration 1: Battle Pass System (tables, functions, seed data)
psql YOUR_DATABASE_URL -f supabase/migrations/20270227_battle_pass_system.sql

# Migration 2: Integration with XP System
psql YOUR_DATABASE_URL -f supabase/migrations/20270227_integrate_battlepass_xp.sql
```

Or if using Supabase CLI:
```bash
npx supabase db push
```

### 2. Verify Installation

Run the seed script to verify everything is working:

```bash
node seed-battlepass.mjs
```

This will:
- Check if the active season exists
- Verify tier rewards are configured
- Test the XP awarding system
- Award 1000 test XP to the first user

### 3. Visit the Feed Page

Navigate to `/feed` and you should see:
- 🎯 **Battle Pass Banner** at the top (collapsible)
- 📊 **Progress bar** showing current XP and tier
- 🎁 **Visible tiers** with rewards (Free + Keeper)
- ⏰ **Time remaining** countdown

### 4. Test the System

**Earn XP:**
- Complete missions → Automatically awards battle pass XP
- Daily login → 100 XP bonus once per day
- Posts/comments/battles → All regular XP also goes to battle pass

**Claim Rewards:**
- Click on unlocked reward icons
- Animated modal shows the reward
- Rewards added to inventory/wallet

**View Full Battle Pass:**
- Visit `/battlepass` for complete tier list
- Shows all 40 tiers and their rewards

## How It Works

### XP System Integration

The battle pass hooks into the existing `award_xp()` function. Whenever a user earns regular XP from any source, they also earn battle pass XP (without daily caps).

### XP Progression

- **Linear progression**: 500 XP per tier
- **Total XP needed**: 20,000 XP for all 40 tiers
- **Designed for ~3 weeks**: With daily missions + daily login

#### Daily XP Calculation:
- Daily login: 100 XP
- Daily missions: ~80 XP (training + battle)
- Weekly missions: ~100 XP/day average
- Engagement: ~50-100 XP/day

**Total per day**: ~330-380 XP → ~21-24 days to complete

### Reward Distribution

**Free Pass (40 rewards):**
- Total gold: ~15,000 coins
- Food items: Q1/Q2 quality
- Tickets: Basic training tickets
- Progressive value increases

**Keeper Pass (40 rewards - Currently Greyed Out):**
- Total gold: ~30,000 coins
- Food items: Q2/Q3 quality (better buffs)
- Tickets: Premium training tickets
- 2x value of Free Pass

## Database Schema

### Tables

1. **`battle_pass_seasons`** - Season definitions
   - Season name, dates, active status
   - XP per tier, total tiers

2. **`battle_pass_tiers`** - Tier rewards per season
   - Tier number, type (free/keeper)
   - Reward type, amount, quality data

3. **`user_battle_pass_progress`** - User progress
   - Total XP, current tier
   - Last daily login date
   - Keeper pass status

4. **`user_battle_pass_rewards`** - Claimed rewards log
   - User, season, tier, type
   - Claimed timestamp

### Key Functions

- `get_user_battle_pass_data(user_id)` - Get all BP data for user
- `award_battle_pass_xp(user_id, amount, source)` - Award XP, auto-unlock tiers
- `check_and_award_daily_login_xp(user_id)` - Daily login bonus
- `claim_battle_pass_reward(user_id, tier, type)` - Claim reward, add to inventory
- `award_xp(...)` - **Modified to also award battle pass XP**

## Components

### Banner (`/components/battlepass/`)

- **`battle-pass-wrapper.tsx`** - Client wrapper, handles data fetching
- **`battle-pass-banner.tsx`** - Main banner with progress + rewards
- **`tier-reward-card.tsx`** - Individual reward display
- **`reward-unlock-modal.tsx`** - Animated claim modal
- **`types.ts`** - TypeScript interfaces

### Banner Container (`/components/banner/`)

- **`banner-container.tsx`** - Reusable collapsible wrapper for future banners

### Page

- **`/app/battlepass/page.tsx`** - Full battle pass view with all tiers

### API & Actions

- **`/app/api/battlepass/claim/route.ts`** - POST endpoint for claiming
- **`/app/actions/battlepass.ts`** - Server actions for data fetching

## Customization

### Change Rewards

Edit the seed data in `20270227_battle_pass_system.sql` or update the database directly:

```sql
UPDATE battle_pass_tiers
SET reward_amount = 2000
WHERE tier_number = 40 AND tier_type = 'keeper';
```

### Adjust XP Requirements

Update the season's `xp_per_tier` value:

```sql
UPDATE battle_pass_seasons
SET xp_per_tier = 600  -- Makes it harder
WHERE season_number = 1;
```

### Create New Season

```sql
-- Deactivate old season
UPDATE battle_pass_seasons SET is_active = false WHERE is_active = true;

-- Create new season
INSERT INTO battle_pass_seasons (name, season_number, start_date, end_date, is_active, xp_per_tier, total_tiers)
VALUES ('Season 2: Crystal Empire', 2, NOW(), NOW() + INTERVAL '30 days', true, 500, 40);

-- Then add tier rewards for the new season...
```

### Enable Keeper Pass (Future)

When ready to add paid Keeper Pass:

1. Add payment flow
2. Update user's `has_keeper_pass` in `user_battle_pass_progress`
3. Remove greyed-out UI state in components

```sql
UPDATE user_battle_pass_progress
SET has_keeper_pass = true
WHERE user_id = 'USER_UUID';
```

## Styling

The battle pass uses:
- **Colors**: Amber/yellow gradient (light mode), Sky/blue gradient (dark mode)
- **Animations**: Framer Motion for all transitions
- **Theme**: Fully integrated with existing UI theme

### Key CSS Classes

- Golden gradient: `bg-gradient-to-r from-amber-500 via-yellow-500 to-amber-500`
- Progress bar: Uses `<Progress>` component with amber colors
- Locked state: `grayscale opacity-40`
- Unlocked: `animate-pulse` with golden glow
- Claimed: Green checkmark, subtle gradient

## Troubleshooting

### Battle pass not showing?

1. ✅ Run migrations: Check database for `battle_pass_seasons` table
2. ✅ Check active season: `SELECT * FROM battle_pass_seasons WHERE is_active = true;`
3. ✅ Run seed script: `node seed-battlepass.mjs`
4. ✅ Check browser console for errors

### Rewards not claiming?

1. Check if tier is unlocked: User's `current_tier` >= reward tier number
2. Check if already claimed: Query `user_battle_pass_rewards` table
3. Verify resource/quality IDs exist in database
4. Check API response in Network tab

### XP not awarding?

1. Verify integration migration ran: Check `award_xp` function includes battle pass call
2. Test directly: `SELECT award_battle_pass_xp('user_id', 100, 'test');`
3. Check for active season
4. Look for errors in Supabase logs

### Daily login not working?

1. Check `last_daily_login_date` in `user_battle_pass_progress`
2. Date is UTC-based, ensure timezone handling
3. Check browser console for API errors
4. Verify `checkDailyLoginXP()` is called on feed page load

## Performance

- ✅ Server-side rendering for feed page
- ✅ Client-side data fetching for battle pass (non-blocking)
- ✅ Indexed queries for fast lookups
- ✅ Lightweight animations with Framer Motion
- ✅ Collapsible banner reduces visual clutter

## Future Enhancements

**Potential features to add:**

1. **Paid Keeper Pass** - Stripe integration, unlock premium track
2. **Battle Pass Shop** - Spend currency to buy tier skips
3. **Season Challenges** - Special missions for bonus XP
4. **Cosmetic Rewards** - Avatars, badges, profile frames
5. **Leaderboards** - Fastest tier completion rankings
6. **Video Banners** - Use Remotion for animated banners
7. **Push Notifications** - Remind users of daily login
8. **Referral Bonuses** - Extra XP for inviting friends

## Support

If you encounter issues:
1. Check the migration files for syntax errors
2. Review Supabase logs for database errors
3. Inspect browser console for client-side errors
4. Verify all dependencies are installed (`framer-motion`)

---

**Built with:**
- Next.js 16 (App Router)
- Supabase (PostgreSQL + RLS)
- Framer Motion
- Radix UI + Tailwind CSS
