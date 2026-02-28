# Subscription System Quick Start Guide

## 🚀 Setup (5 minutes)

### 1. Apply Database Migration

```bash
# Option A: Using Supabase CLI (recommended)
npx supabase db push

# Option B: Manual via Supabase Dashboard
# 1. Go to SQL Editor in Supabase Dashboard
# 2. Copy contents of supabase/migrations/20270228_subscription_system.sql
# 3. Paste and run
```

### 2. Configure Environment Variables (Optional - for BMC webhook)

Add to `.env.local`:
```bash
BMC_WEBHOOK_SECRET=your_webhook_secret_here
```

### 3. Test the System

#### Create a Test Subscription
1. Visit `/admin/subscriptions`
2. Get your user UUID from database or profile
3. Create subscription:
   - User ID: `your-uuid-here`
   - Tier: Sigma
   - Duration: 30 days
4. Click "Create Subscription"

#### Verify Everything Works
- ✅ Visit `/settings` - Blue theme should now be unlocked
- ✅ Visit `/battlepass` - Keeper pass should show "Upgrade" removed
- ✅ Visit `/profile` - Should see Sigma badge next to username
- ✅ Check profile medals - Should see "Sigma Supporter - 0 months"

---

## 📋 Key URLs

| Page | URL | Description |
|------|-----|-------------|
| **Subscription Page** | `/subscribe` | Public-facing subscription page |
| **Admin Panel** | `/admin/subscriptions` | Manage all subscriptions |
| **Settings** | `/settings` | View theme locking in action |
| **Battle Pass** | `/battlepass` | See keeper pass benefits |
| **BMC Webhook** | `/api/webhooks/buymeacoffee` | Webhook endpoint for BMC |

---

## 🎯 Quick Actions

### Create Manual Subscription
```typescript
// Via admin panel or server action
await createSubscription({
  userId: 'user-uuid',
  tier: 'sigma', // or 'omega'
  paymentProvider: 'manual',
  expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
});
```

### Award Monthly Medal
```typescript
// Happens automatically on renewal, or manually:
await renewSubscription(subscriptionId, 9.99);
```

### Cancel Subscription
```typescript
await updateSubscription({
  subscriptionId: 'sub-uuid',
  status: 'cancelled',
  notes: 'User requested cancellation',
});
```

### Check User Subscription Status
```typescript
const status = await getUserSubscriptionStatus(userId);
console.log(status.tier); // 'alpha' | 'sigma' | 'omega'
console.log(status.canAccessKeeperPass); // boolean
console.log(status.availableThemes); // ['cream-light', 'blue-dark']
console.log(status.supporterMedal.monthCount); // number
```

---

## 🔧 Common Tasks

### Update Tier Prices
Edit: `lib/subscriptions/types.ts`
```typescript
export const TIER_CONFIGS: Record<UserTier, TierConfig> = {
  sigma: { price: 9.9, ... },
  omega: { price: 14.9, ... },
};
```

### Add New Theme
1. Add theme to theme selector
2. Update theme mapping in `lib/subscriptions/types.ts`:
```typescript
const getAvailableThemes = (tier: UserTier): string[] => {
  const themeMap = {
    alpha: ['cream-light'],
    sigma: ['cream-light', 'blue-dark', 'new-theme'],
    omega: ['cream-light', 'blue-dark', 'discord-dark', 'new-theme'],
  };
  return themeMap[tier];
};
```

### Add Tier Feature
1. Update `TIER_CONFIGS` in types.ts
2. Add feature to comparison table in `/subscribe` page
3. Implement feature locking in relevant component

### Change Subscription Duration
Default is 30 days. To change:
```typescript
// In createSubscription or renewSubscription
const expiresAt = new Date();
expiresAt.setDate(expiresAt.getDate() + 90); // 90 days instead of 30
```

---

## 🐛 Troubleshooting

### "Theme still locked after subscription"
```sql
-- Check user tier
SELECT user_tier FROM users WHERE id = 'user-uuid';

-- Should show 'sigma' or 'omega', not 'alpha'
-- If it shows 'alpha', the trigger didn't fire. Manually update:
UPDATE users SET user_tier = 'sigma' WHERE id = 'user-uuid';
```

### "Keeper pass not unlocked"
```sql
-- Check keeper pass status
SELECT has_keeper_pass FROM user_battle_pass_progress WHERE user_id = 'user-uuid';

-- If false, manually enable:
UPDATE user_battle_pass_progress SET has_keeper_pass = true WHERE user_id = 'user-uuid';
```

### "Medal not showing"
```sql
-- Check if medal was awarded
SELECT m.key, um.metadata
FROM user_medals um
JOIN medals m ON m.id = um.medal_id
WHERE um.user_id = 'user-uuid' AND m.key LIKE '%supporter%';

-- If no results, award manually via admin panel or:
-- (Run awardSupporterMedal server action)
```

### "Webhook not working"
1. Check webhook URL in BMC dashboard
2. Test manually:
```bash
curl -X POST http://localhost:3000/api/webhooks/buymeacoffee \
  -H "Content-Type: application/json" \
  -d '{
    "type": "membership.started",
    "data": {
      "supporter_email": "your-email@example.com",
      "support_id": "test_123",
      "membership_level_name": "Sigma",
      "amount": 9.99,
      "currency": "USD",
      "is_recurring": true
    }
  }'
```

---

## 📊 Database Queries

### View All Active Subscriptions
```sql
SELECT
  u.username,
  s.tier,
  s.status,
  s.months_subscribed,
  s.expires_at
FROM subscriptions s
JOIN users u ON u.id = s.user_id
WHERE s.status = 'active'
ORDER BY s.created_at DESC;
```

### Revenue by Tier
```sql
SELECT
  sh.new_tier as tier,
  COUNT(*) as subscriptions,
  SUM(sh.amount_paid) as total_revenue,
  AVG(sh.amount_paid) as avg_revenue
FROM subscription_history sh
WHERE sh.event_type IN ('created', 'renewed')
  AND sh.amount_paid IS NOT NULL
GROUP BY sh.new_tier;
```

### Churn Analysis
```sql
SELECT
  DATE(cancelled_at) as cancel_date,
  COUNT(*) as cancellations,
  tier
FROM subscriptions
WHERE status = 'cancelled'
  AND cancelled_at >= NOW() - INTERVAL '30 days'
GROUP BY DATE(cancelled_at), tier
ORDER BY cancel_date DESC;
```

### Top Supporters (by months)
```sql
SELECT
  u.username,
  s.tier,
  s.months_subscribed,
  s.started_at
FROM subscriptions s
JOIN users u ON u.id = s.user_id
WHERE s.status = 'active'
ORDER BY s.months_subscribed DESC
LIMIT 10;
```

---

## 🎨 UI Customization

### Change Tier Colors
Edit component files:
- Sigma: Blue (`from-blue-500 to-sky-500`)
- Omega: Amber/Orange (`from-amber-600 to-orange-600`)

Files to update:
- `app/subscribe/page.tsx`
- `components/feed/subscription-banner.tsx`
- `components/ui/verification-badge.tsx`

### Modify Subscription Page
Edit: `app/subscribe/page.tsx`
- Hero section
- Tier cards
- Feature comparison
- FAQ section

### Update Banner Animation
Edit: `components/feed/subscription-banner.tsx`
- Framer Motion animations
- Timing and easing
- Visual effects

---

## 🚢 Deployment Checklist

- [ ] Apply database migration
- [ ] Configure BMC webhook URL
- [ ] Set environment variables
- [ ] Test subscription creation
- [ ] Test tier benefits (themes, keeper pass, badges)
- [ ] Test supporter medals
- [ ] Test cancellation flow
- [ ] Set up cron job for expiring subscriptions
- [ ] Update admin usernames in RLS policies
- [ ] Test webhook with real BMC event
- [ ] Monitor error logs

---

## 📞 Support

For issues or questions:
1. Check SUBSCRIPTION_SYSTEM_README.md for detailed docs
2. Review troubleshooting section above
3. Check database directly for data integrity
4. Review server logs for webhook errors
