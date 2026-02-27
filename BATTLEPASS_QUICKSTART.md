# Battle Pass - Quick Start Guide

## 🎮 What Was Built

A complete monthly battle pass system with 40 tiers, dual tracks (Free + Keeper), golden animations, and full integration with your existing mission/XP systems.

## 🚀 Quick Setup (3 Steps)

### Step 1: Apply Migrations

Run these two migrations in your database:

```bash
# Option A: Using psql
psql YOUR_DATABASE_URL -f supabase/migrations/20270227_battle_pass_system.sql
psql YOUR_DATABASE_URL -f supabase/migrations/20270227_integrate_battlepass_xp.sql

# Option B: Using Supabase CLI (if configured)
npx supabase db push
```

### Step 2: Verify Setup

Run the test script:

```bash
node seed-battlepass.mjs
```

You should see:
```
✅ Active battle pass season found!
   Season: Season 1: Golden Dawn
   Tiers: 40
   XP per tier: 500
✅ 80 tier rewards configured
   Free: 40 rewards
   Keeper: 40 rewards
✅ XP awarded successfully!
```

### Step 3: See It In Action

1. Visit **`/feed`** - You'll see the battle pass banner at the top
2. Complete a mission - XP automatically goes to battle pass
3. Click on an unlocked reward to claim it
4. Visit **`/battlepass`** - Full view of all 40 tiers

## 🎯 Why You're Not Seeing It Now

The battle pass won't appear until you run the migrations (Step 1). The component checks for an active season and returns null if none exists.

## 📊 Key Features

### UI Features
- ✨ **Golden gradient** theme (amber/yellow in light, sky/blue in dark)
- 🎨 **Framer Motion animations** for tier unlocks and rewards
- 📱 **Collapsible banner** (saves state to localStorage)
- 🎁 **Animated reward modals** when claiming
- 📈 **Progress bar** with smooth animations
- 🔒 **Locked/unlocked states** with visual feedback

### Gameplay Features
- 🎯 **40 tiers** with linear progression (500 XP each)
- ⏰ **Monthly seasons** (30 days by default)
- 🎁 **Dual tracks**: Free Pass + Keeper Pass (greyed out for now)
- 📅 **Daily login bonus**: 100 XP once per day
- 🔄 **Auto-integration**: All XP sources feed into battle pass
- 💰 **Rewards**: Gold, food (Q1/Q2/Q3), tickets

### Technical Features
- ⚡ **Database-driven** rewards (easy to update)
- 🔐 **RLS policies** for security
- 📊 **Transaction logging** for analytics
- 🎮 **Non-blocking**: Won't break if BP system fails
- 🔄 **Scalable**: Easy to add new seasons

## 📦 What Was Created

### Database (3 Migrations)
- `20270227_battle_pass_system.sql` - Tables, functions, Season 1 with 40 tiers
- `20270227_integrate_battlepass_xp.sql` - Hooks BP into `award_xp()` function

### Components
- `components/banner/banner-container.tsx` - Reusable collapsible wrapper
- `components/battlepass/battle-pass-banner.tsx` - Main banner component
- `components/battlepass/battle-pass-wrapper.tsx` - Client-side data handler
- `components/battlepass/tier-reward-card.tsx` - Individual reward display
- `components/battlepass/reward-unlock-modal.tsx` - Animated claim modal
- `components/battlepass/types.ts` - TypeScript interfaces

### Backend
- `app/actions/battlepass.ts` - Server actions (getBattlePassData, checkDailyLoginXP)
- `app/api/battlepass/claim/route.ts` - POST endpoint for claiming rewards

### Pages
- `app/battlepass/page.tsx` - Full battle pass view with all tiers
- `app/feed/page.tsx` - **Modified** to include battle pass banner

### Utilities
- `seed-battlepass.mjs` - Test/verification script
- `BATTLEPASS_README.md` - Full documentation
- `BATTLEPASS_QUICKSTART.md` - This file!

## 🎮 How Players Use It

1. **Daily Login**: Visit `/feed` → Get 100 XP bonus (once/day)
2. **Complete Missions**: XP automatically goes to battle pass
3. **Check Progress**: See tier progress in banner
4. **Claim Rewards**: Click unlocked reward icons
5. **View All Tiers**: Visit `/battlepass` for full view

## 📈 Progression Math

**XP Per Tier**: 500 XP (linear)
**Total XP Needed**: 20,000 XP (for all 40 tiers)
**Target Time**: ~3 weeks with normal play

**Daily XP Sources**:
- Daily login: 100 XP
- Daily training: 30 XP
- Daily battle: 50 XP
- Weekly missions (avg): ~100 XP/day
- Engagement (posts/comments): ~50-100 XP/day

**Total daily**: ~330-380 XP → Complete in 21-24 days

## 🎁 Reward Breakdown

### Free Pass (Total: 15 rewards worth)
- **Gold**: 15 smaller amounts spread across tiers
- **Food**: Q1 and Q2 quality items
- **Tickets**: Basic training tickets

### Keeper Pass (Total: 30 rewards worth - GREYED OUT)
- **Gold**: 30 larger amounts
- **Food**: Q2 and Q3 quality (better buffs)
- **Tickets**: Premium tickets
- **2x value** of Free Pass

## 🔧 Customization

### Change Rewards
Edit tier rewards in database:
```sql
UPDATE battle_pass_tiers
SET reward_amount = 5000
WHERE season_id = 'SEASON_ID' AND tier_number = 40;
```

### Adjust Difficulty
Make it easier/harder:
```sql
UPDATE battle_pass_seasons
SET xp_per_tier = 400  -- Easier (was 500)
WHERE season_number = 1;
```

### Enable Keeper Pass (Future)
When ready for paid pass:
```sql
UPDATE user_battle_pass_progress
SET has_keeper_pass = true
WHERE user_id = 'USER_ID';
```

## 🐛 Troubleshooting

**"I don't see the battle pass"**
- ✅ Run migrations first
- ✅ Check `battle_pass_seasons` table exists
- ✅ Run `node seed-battlepass.mjs` to verify
- ✅ Check browser console for errors

**"XP not updating"**
- Refresh the page (client-side polling)
- Check database: `SELECT * FROM user_battle_pass_progress;`
- Verify integration migration ran

**"Can't claim rewards"**
- Tier must be unlocked (current_tier >= reward tier)
- Can't claim already-claimed rewards
- Check console for API errors

## 📞 Next Steps

1. **Apply migrations** (see Step 1 above)
2. **Test it** with the seed script
3. **Visit `/feed`** to see it live
4. **Customize rewards** as needed
5. **Announce to players** when ready!

## 🎨 Future Enhancements

- Add **Keeper Pass** purchase flow (Stripe?)
- Create **special events** with bonus XP
- Add **cosmetic rewards** (avatars, badges)
- Implement **leaderboards** for competition
- Add **video banners** with Remotion
- Create **referral bonuses** for invites

---

**Need help?** Check `BATTLEPASS_README.md` for full documentation!
