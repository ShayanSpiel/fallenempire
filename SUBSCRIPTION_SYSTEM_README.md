# Subscription System Documentation

## Overview

The subscription system provides three user tiers with escalating benefits:

1. **Alpha (Free)** - Base tier, available to all users
2. **Sigma ($9.99/month)** - Premium tier with exclusive themes and keeper pass
3. **Omega ($14.99/month)** - Ultimate tier with all features unlocked

## Architecture

### Database Schema

The system uses the following tables:

#### `subscriptions`
- **Purpose**: Tracks active and historical subscriptions
- **Key Fields**:
  - `user_id`: Foreign key to users table
  - `tier`: sigma | omega
  - `status`: active | cancelled | expired | pending
  - `months_subscribed`: Counter for supporter medal progression
  - `payment_provider`: buymeacoffee | stripe | manual | other
  - `provider_subscription_id`: External subscription ID

#### `subscription_history`
- **Purpose**: Audit trail of all subscription changes
- **Key Fields**:
  - `event_type`: created | renewed | cancelled | expired | upgraded | downgraded | medal_awarded
  - `old_status` / `new_status`
  - `amount_paid`

#### `medals`
- **New Entries**: sigma-supporter, omega-supporter
- **Purpose**: Track supporter medals with month counters

### Type Definitions

All types are defined in `/lib/subscriptions/types.ts`:

```typescript
export type UserTier = 'alpha' | 'sigma' | 'omega';
export type SubscriptionTier = 'sigma' | 'omega';
export type SubscriptionStatus = 'active' | 'cancelled' | 'expired' | 'pending';
export type PaymentProvider = 'buymeacoffee' | 'stripe' | 'manual' | 'other';
```

## Features by Tier

### Alpha (Free)
- ✅ Cream theme
- ✅ Free battle pass track
- ❌ No premium themes
- ❌ No keeper battle pass
- ❌ No tier badge
- ❌ No supporter medal

### Sigma ($9.99/month)
- ✅ Cream + Blue themes
- ✅ Free battle pass track
- ✅ **Keeper battle pass** (2x rewards)
- ✅ **Blue Sigma badge** on profile
- ✅ **Sigma Supporter medal** (grows monthly)
- ❌ Discord theme locked

### Omega ($14.99/month)
- ✅ **All themes** (Cream, Blue, Discord)
- ✅ Free battle pass track
- ✅ **Keeper battle pass** (2x rewards)
- ✅ **Gold Omega badge** with gradient
- ✅ **Omega Supporter medal** (grows monthly)

## Implementation Details

### 1. Theme Locking

**File**: `components/settings/theme-selector.tsx`

Themes are locked based on user tier. Clicking a locked theme redirects to `/subscribe`.

```typescript
const handleThemeClick = (option: ThemeOption) => {
  const userLevel = getTierLevel(userTier);
  const requiredLevel = getTierLevel(option.requiredTier);

  if (userLevel >= requiredLevel) {
    setTheme(option.value);
  } else {
    router.push("/subscribe");
  }
};
```

### 2. Keeper Battle Pass

**Files**:
- `components/battlepass/battle-pass-banner-slider.tsx`
- `app/battlepass/page.tsx`

Keeper pass is automatically enabled for Sigma/Omega users via database trigger:

```sql
CREATE TRIGGER sync_user_tier_on_subscription_change
  AFTER INSERT OR UPDATE OR DELETE ON public.subscriptions
  FOR EACH ROW
  EXECUTE FUNCTION sync_user_tier_from_subscription();
```

### 3. Supporter Medals

**File**: `components/medals/medal-badge.tsx`

Medals display month count instead of regular count for supporter medals:

```typescript
{isSupporterMedal ? `${count} ${count === 1 ? 'month' : 'months'}` : count}
```

Each monthly payment triggers medal counter increment via `awardSupporterMedal()`.

### 4. Subscription Page

**File**: `app/subscribe/page.tsx`

Features:
- Hero section with animated background
- 3 tier cards (Alpha, Sigma featured, Omega)
- Feature comparison table
- Benefits showcase
- FAQ accordion
- Fully client-side optimized

### 5. Feed Sidebar Banner

**File**: `components/feed/subscription-banner.tsx`

- Animated promotional banner
- Dismissible with localStorage persistence
- Auto-hides for Omega users
- Shows targeted messaging for Alpha vs Sigma users
- Framer Motion animations

### 6. Navigation Support Button

**File**: `components/layout/app-shell.tsx`

Premium gradient button in header:
```tsx
<Button className="bg-gradient-to-r from-amber-500/10 to-orange-500/10">
  <Heart /> Support
</Button>
```

## Server Actions

**File**: `app/actions/subscription.ts`

### Core Actions

#### `getUserSubscriptionStatus(userId?)`
Returns current subscription status including:
- `hasActiveSubscription`: boolean
- `tier`: UserTier
- `canAccessKeeperPass`: boolean
- `availableThemes`: string[]
- `supporterMedal`: { hasMedal, medalKey, monthCount }

#### `createSubscription(input)`
Creates new subscription and:
1. Cancels existing active subscriptions
2. Creates new subscription record
3. Updates user tier
4. Enables keeper pass
5. Awards initial supporter medal
6. Logs to subscription_history

#### `updateSubscription(input)`
Updates subscription status (cancel, expire, upgrade)

#### `renewSubscription(subscriptionId, amountPaid?)`
Renews monthly subscription and:
1. Extends expiration by 30 days
2. Updates last_payment_at
3. Increments supporter medal counter
4. Logs renewal event

#### `checkAndExpireSubscriptions()`
Scheduled function to expire old subscriptions (cron job recommended)

#### `getAllSubscriptions()` (Admin only)
Fetches all subscriptions with user info for admin panel

## Buy Me a Coffee Integration

### Webhook Endpoint

**File**: `app/api/webhooks/buymeacoffee/route.ts`

**URL**: `https://yourdomain.com/api/webhooks/buymeacoffee`

Handles three event types:
- `membership.started` → Creates new subscription
- `membership.renewed` → Renews subscription + awards medal
- `membership.cancelled` → Cancels subscription

### Event Flow

1. User subscribes on Buy Me a Coffee
2. BMC sends webhook to our endpoint
3. System finds user by email
4. Determines tier from membership name or amount
5. Creates/renews subscription
6. Updates user tier and benefits
7. Awards supporter medal

### Configuration Required

Add to `.env.local`:
```bash
BMC_WEBHOOK_SECRET=your_secret_here
```

Configure webhook URL in BMC dashboard:
```
https://yourdomain.com/api/webhooks/buymeacoffee
```

### Membership Level Mapping

```typescript
function determineTierFromMembership(name: string, amount: number) {
  if (name.includes('sigma') || amount >= 9.99 && amount < 14.99) return 'sigma';
  if (name.includes('omega') || amount >= 14.99) return 'omega';
  return null;
}
```

## Admin Panel

**File**: `app/admin/subscriptions/page.tsx`

**URL**: `/admin/subscriptions`

Features:
- View all subscriptions with filters
- Create manual subscriptions (for testing or special cases)
- Cancel subscriptions
- Manually renew and award medals
- View subscription history

### Access Control

Currently restricted to usernames: `admin`, `shayan`

Update in RLS policies:
```sql
WHERE username IN ('admin', 'shayan')
```

## Database Migration

**File**: `supabase/migrations/20270228_subscription_system.sql`

To apply:
```bash
npx supabase db push
```

Or apply directly via Supabase dashboard SQL editor.

## Testing Workflow

### 1. Create Test Subscription

Via Admin Panel:
1. Navigate to `/admin/subscriptions`
2. Enter user UUID
3. Select tier (Sigma or Omega)
4. Set duration (30 days)
5. Click "Create Subscription"

### 2. Verify Benefits

**Theme Access**:
1. Go to `/settings`
2. Try selecting locked themes
3. Should redirect to `/subscribe` for locked themes

**Keeper Pass**:
1. Go to `/battlepass`
2. Should see keeper pass rewards unlocked
3. Can claim keeper pass rewards

**Badge**:
1. Check profile page
2. Should see Sigma (blue) or Omega (gold) badge

**Supporter Medal**:
1. Check profile medals section
2. Should see supporter medal with month count

### 3. Test Renewal

Via Admin Panel:
1. Click "Renew & Award Medal" on active subscription
2. Check that medal counter increments
3. Verify expiration date extends by 30 days

### 4. Test Cancellation

Via Admin Panel:
1. Click "Cancel" on active subscription
2. Verify user tier reverts to Alpha
3. Check theme access is locked
4. Verify keeper pass is disabled
5. **Supporter medal should remain** (permanent achievement)

## Scheduled Tasks

### Expire Old Subscriptions

Set up a cron job to run daily:

```typescript
// pages/api/cron/expire-subscriptions.ts
import { checkAndExpireSubscriptions } from '@/app/actions/subscription';

export default async function handler(req, res) {
  if (req.headers.authorization !== `Bearer ${process.env.CRON_SECRET}`) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const result = await checkAndExpireSubscriptions();
  return res.status(200).json(result);
}
```

Use Vercel Cron or external service:
```
0 0 * * * curl -H "Authorization: Bearer SECRET" https://yourdomain.com/api/cron/expire-subscriptions
```

## Future Enhancements

### Planned Features
- [ ] Stripe integration as alternative payment provider
- [ ] Annual subscription option (discount)
- [ ] Gift subscriptions
- [ ] Subscriber-only Discord role
- [ ] Exclusive subscriber chat badge in feed
- [ ] Early access to new features
- [ ] Subscriber leaderboard

### Technical Improvements
- [ ] BMC signature verification
- [ ] Email notifications for subscription events
- [ ] Subscription analytics dashboard
- [ ] Revenue reporting
- [ ] Churn analysis
- [ ] Trial period support

## Troubleshooting

### Subscription Not Activating

1. Check subscription status in database:
```sql
SELECT * FROM subscriptions WHERE user_id = 'user_uuid';
```

2. Check user tier was updated:
```sql
SELECT user_tier FROM users WHERE id = 'user_uuid';
```

3. Check keeper pass status:
```sql
SELECT has_keeper_pass FROM user_battle_pass_progress WHERE user_id = 'user_uuid';
```

### Webhook Not Receiving Events

1. Verify webhook URL in BMC dashboard
2. Check webhook logs in BMC
3. Check server logs for errors
4. Test with manual POST request:
```bash
curl -X POST https://yourdomain.com/api/webhooks/buymeacoffee \
  -H "Content-Type: application/json" \
  -d '{
    "type": "membership.started",
    "data": {
      "supporter_email": "test@example.com",
      "support_id": "test_123",
      "membership_level_name": "Sigma",
      "amount": 9.99,
      "currency": "USD",
      "is_recurring": true
    }
  }'
```

### Themes Not Locking

1. Verify user_tier is passed to ThemeSelector:
```tsx
<ThemeSelector userTier={profile.user_tier || 'alpha'} />
```

2. Check theme mapping in types.ts
3. Clear browser cache and localStorage

### Medals Not Incrementing

1. Check medal exists in medals table:
```sql
SELECT * FROM medals WHERE key IN ('sigma-supporter', 'omega-supporter');
```

2. Check user_medals table:
```sql
SELECT * FROM user_medals
WHERE user_id = 'user_uuid'
AND medal_id IN (SELECT id FROM medals WHERE key LIKE '%supporter%');
```

3. Run manual medal award:
```typescript
await awardSupporterMedal({
  userId: 'user_uuid',
  subscriptionId: 'sub_uuid',
  tier: 'sigma'
});
```

## Security Considerations

- ✅ RLS policies restrict subscription access
- ✅ Admin actions check user permissions
- ✅ Webhook endpoint validates payload structure
- ⚠️ TODO: Implement BMC signature verification
- ✅ User tier sync uses database trigger (prevents race conditions)
- ✅ Subscription history creates audit trail

## Performance Optimizations

- Client-side subscription status caching
- Optimistic UI updates
- Database indexes on frequently queried fields
- Lazy loading of subscription page components
- Memoized tier configuration
- LocalStorage for banner dismissal state
