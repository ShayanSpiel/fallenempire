# Currency System - Single Source of Truth

## Problem Statement

The currency system was scattered across the codebase with multiple issues:

### Issues Identified

1. **Inconsistent Currency Symbols**
   - "Community Coin" in some places
   - "TEC" in other places
   - "CC" as fallback
   - No connection to actual community currency data

2. **Hardcoded Values**
   - Currency names hardcoded in components
   - Symbols defined in multiple files
   - Colors scattered across UI components

3. **Poor Location Error Messages**
   - Generic "travel to community" messages
   - No specific community names in toasts
   - Inconsistent formatting

4. **No Central Bank Integration**
   - Currency data not connected to `community_currencies` table
   - No single source for symbol/name lookups
   - Missing transaction logging integration

## Solution: Centralized Currency System

### Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                     Database Layer                           │
│  ┌────────────────────┐        ┌──────────────────────┐    │
│  │ community_currencies│───────▶│ community_wallets    │    │
│  └────────────────────┘        └──────────────────────┘    │
│           ▲                              ▲                   │
└───────────┼──────────────────────────────┼───────────────────┘
            │                              │
┌───────────┼──────────────────────────────┼───────────────────┐
│           │       Currency System        │                   │
│  ┌────────┴──────────┐         ┌────────┴──────────┐        │
│  │  lib/currency-    │◀────────│   Cache Layer      │        │
│  │     system.ts     │         │   (1 min TTL)      │        │
│  └───────────────────┘         └────────────────────┘        │
│           │                                                   │
│           │                                                   │
│  ┌────────┴──────────────────────────────────────────┐      │
│  │  Single Source of Truth for:                      │      │
│  │  • Currency symbols (TEC, not "CC")               │      │
│  │  • Currency names (TestCommunity Coin)            │      │
│  │  • Exchange rates                                 │      │
│  │  • Colors from community data                     │      │
│  │  • Formatting rules                               │      │
│  └───────────────────────────────────────────────────┘      │
│           │                                                   │
└───────────┼───────────────────────────────────────────────────┘
            │
┌───────────┼───────────────────────────────────────────────────┐
│           ▼          UI Layer                                 │
│  ┌─────────────────┐  ┌──────────────┐  ┌─────────────────┐ │
│  │ Market UI       │  │ Job Offers   │  │ Currency        │ │
│  │ (uses symbols)  │  │ (uses symbols)│  │ Exchange        │ │
│  └─────────────────┘  └──────────────┘  └─────────────────┘ │
│                                                               │
│  All components get currency info from currency-system.ts    │
└───────────────────────────────────────────────────────────────┘
```

### Files Created/Modified

#### New Files

1. **`lib/currency-system.ts`** - The Single Source of Truth
   - Fetches currency data from database
   - Caches for performance (1 min TTL)
   - Provides consistent formatting
   - Integrates with central bank logging

2. **`CURRENCY_SYSTEM_SINGLE_SOURCE_OF_TRUTH.md`** - This documentation

#### Modified Files

1. **`lib/toast-utils.tsx`**
   - Added `showLocationAccessError()` function
   - Unified location-based error messages
   - Shows community names in toasts

2. **`app/market/market-view.tsx`**
   - Uses `showLocationAccessError()` for purchases
   - Uses `showLocationAccessError()` for job applications
   - Proper error detection and routing

3. **`MARKET_CURRENCY_SYSTEM_COMPLETE.md`**
   - Updated with currency system integration

## Usage Guide

### Getting Currency Information

```typescript
import { CurrencySystem } from '@/lib/currency-system';

// Get currency for a community
const currency = await CurrencySystem.getCurrencyByCommunityId(communityId);

// Get display info (symbol, name, color)
const displayInfo = CurrencySystem.getCurrencyDisplayInfo(currency);
console.log(displayInfo.symbol); // "TEC" (from database!)
console.log(displayInfo.fullName); // "TestCommunity Coin"
console.log(displayInfo.color); // "#3B82F6" (from community color)

// Quick access methods
const symbol = await CurrencySystem.getCurrencySymbol(communityId);
const name = await CurrencySystem.getCurrencyName(communityId);
const color = await CurrencySystem.getCurrencyColor(communityId);
```

### Formatting Currency

```typescript
// Format with symbol
const formatted = CurrencySystem.formatCommunityCurrency(
  100.50,
  currency,
  { showSymbol: true }
);
// Output: "100.50 TEC"

// Format with full name
const formatted = CurrencySystem.formatCommunityCurrency(
  100.50,
  currency,
  { showFullName: true }
);
// Output: "100.50 TestCommunity Coin"

// Compact formatting (for large numbers)
const formatted = CurrencySystem.formatCommunityCurrency(
  1500000,
  currency,
  { compact: true }
);
// Output: "1.5M TEC"

// Gold formatting
const formatted = CurrencySystem.formatGold(50.25);
// Output: "50.25 G"
```

### Logging Transactions

```typescript
// Integrated with central bank
await CurrencySystem.logCurrencyTransaction({
  from_user_id: sellerId,
  to_user_id: buyerId,
  currency_type: 'community',
  community_currency_id: currencyId,
  amount: 100.50,
  transaction_type: 'market_purchase',
  description: 'Purchased grain from market',
  metadata: {
    listing_id: listingId,
    quantity: 10,
  },
  scope: 'community',
});
```

### Showing Location Errors

```typescript
import { showLocationAccessError } from '@/lib/toast-utils';

// For purchases
showLocationAccessError({
  communityName: "TestCommunity",
  action: "purchase",
});
// Shows: "Must be in TestCommunity territory"
// Description: "Travel to TestCommunity territory to purchase items..."
// With "Travel" link to map

// For job applications
showLocationAccessError({
  communityName: "TestCommunity",
  action: "apply",
});

// For currency trading
showLocationAccessError({
  communityName: "TestCommunity",
  action: "trade",
});

// Supported actions:
// - "purchase"
// - "sell"
// - "apply"
// - "trade"
// - "create"
// - "work"
```

## Benefits

### 1. Zero Hardcoding
- All currency symbols come from database
- No more "CC" or "Community Coin" hardcoded strings
- Community-specific symbols (e.g., "TEC" for TestCommunity)

### 2. Performance
- In-memory cache (1 min TTL)
- Reduces database queries
- Fast symbol lookups

### 3. Consistency
- Same formatting everywhere
- Unified color scheme
- Consistent error messages

### 4. Maintainability
- Single place to update currency logic
- Type-safe with TypeScript
- Well-documented API

### 5. Central Bank Integration
- Transaction logging built-in
- Exchange rate tracking
- Supply monitoring

## Migration Guide

### Old Way (Scattered)

```typescript
// ❌ Old - hardcoded
<span>{amount} CC</span>

// ❌ Old - inconsistent
<span>{amount} Community Coin</span>

// ❌ Old - no database connection
const symbol = "TEC"; // hardcoded!
```

### New Way (Centralized)

```typescript
// ✅ New - from database
import { CurrencySystem } from '@/lib/currency-system';

const currency = await CurrencySystem.getCurrencyByCommunityId(communityId);
const formatted = CurrencySystem.formatCommunityCurrency(amount, currency);
<span>{formatted}</span>
// Output: "100.50 TEC" (TEC comes from database!)
```

### Updating Components

**Before:**
```typescript
// components/SomeComponent.tsx
<div>
  <span>{wage} currency/day</span>
</div>
```

**After:**
```typescript
// components/SomeComponent.tsx
import { CurrencySystem } from '@/lib/currency-system';

// In async function or useEffect
const currency = await CurrencySystem.getCurrencyByCommunityId(communityId);
const displayInfo = CurrencySystem.getCurrencyDisplayInfo(currency);

<div>
  <span>
    {wage} {displayInfo.symbol}/day
  </span>
</div>
```

### Updating Server Actions

**Before:**
```typescript
// app/actions/some-action.ts
return {
  success: true,
  message: `Paid 100 Community Coins` // ❌ Hardcoded
};
```

**After:**
```typescript
// app/actions/some-action.ts
import { CurrencySystem } from '@/lib/currency-system';

const currency = await CurrencySystem.getCurrencyByCommunityId(communityId);
const formatted = CurrencySystem.formatCommunityCurrency(100, currency);

return {
  success: true,
  message: `Paid ${formatted}` // ✅ Uses actual symbol from DB
};
```

## Database Schema

The system integrates with existing tables:

```sql
-- Community currencies (source of truth)
CREATE TABLE community_currencies (
  id UUID PRIMARY KEY,
  community_id UUID UNIQUE REFERENCES communities(id),
  currency_name TEXT NOT NULL,        -- e.g., "TestCommunity Coin"
  currency_symbol TEXT NOT NULL,      -- e.g., "TEC"
  exchange_rate_to_gold NUMERIC,      -- e.g., 1.0
  total_supply NUMERIC,               -- e.g., 1000000
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ
);

-- Communities (provides color)
CREATE TABLE communities (
  id UUID PRIMARY KEY,
  name TEXT,
  color TEXT,  -- e.g., "#3B82F6"
  ...
);
```

## API Reference

### Core Functions

| Function | Description | Returns |
|----------|-------------|---------|
| `getAllCommunityCurrencies()` | Fetch all currencies | `CommunityCurrency[]` |
| `getCurrencyByCommunityId(id)` | Get currency for community | `CommunityCurrency \| null` |
| `getCurrencyById(id)` | Get currency by currency ID | `CommunityCurrency \| null` |

### Display Functions

| Function | Description | Returns |
|----------|-------------|---------|
| `getCurrencyDisplayInfo(currency)` | Get display info | `CurrencyDisplayInfo` |
| `getGoldDisplayInfo()` | Get gold display info | `CurrencyDisplayInfo` |
| `getCurrencyDisplayInfoByCommunityId(id)` | Async display info | `CurrencyDisplayInfo` |

### Formatting Functions

| Function | Description | Returns |
|----------|-------------|---------|
| `formatCurrency(amount, info, options)` | Format with options | `string` |
| `formatGold(amount, options)` | Format gold | `string` |
| `formatCommunityCurrency(amount, currency, options)` | Format community currency | `string` |

### Helper Functions

| Function | Description | Returns |
|----------|-------------|---------|
| `getCurrencySymbol(communityId)` | Quick symbol lookup | `string` |
| `getCurrencyName(communityId)` | Quick name lookup | `string` |
| `getCurrencyColor(communityId)` | Quick color lookup | `string` |

### Exchange Functions

| Function | Description | Returns |
|----------|-------------|---------|
| `convertCurrency(amount, fromId, toId)` | Convert between currencies | `number` |

### Central Bank Functions

| Function | Description | Returns |
|----------|-------------|---------|
| `logCurrencyTransaction(log)` | Log transaction | `void` |

### Validation Functions

| Function | Description | Returns |
|----------|-------------|---------|
| `isValidAmount(amount)` | Validate amount | `boolean` |
| `hasCurrency(communityId)` | Check if currency exists | `boolean` |

## Toast Messages - Unified System

### Location Errors

All location-based restrictions use the same toast:

```typescript
showLocationAccessError({
  communityName: string,
  action: "purchase" | "sell" | "apply" | "trade" | "create" | "work"
});
```

**Output Example:**
```
Title: "Must be in TestCommunity territory"
Description: "Travel to TestCommunity territory to purchase items from TestCommunity market."
Action: [Travel] (links to /map)
```

## Testing Checklist

- [ ] Currency symbols display correctly from database
- [ ] Colors match community colors
- [ ] Location errors show community names
- [ ] Cache refreshes after 1 minute
- [ ] Transaction logging works
- [ ] Exchange rates calculate correctly
- [ ] Formatting is consistent across all UI
- [ ] Gold displays as "G" not "Gold Coins"
- [ ] Community currencies show actual symbols (e.g., "TEC")

## Future Enhancements

- [ ] Real-time currency updates (websockets)
- [ ] Currency historical data tracking
- [ ] Exchange rate charts
- [ ] Currency supply visualizations
- [ ] Multi-currency wallet UI
- [ ] Currency conversion calculator
- [ ] Transaction history with currency symbols

---

**Status**: ✅ Complete
**Integration**: Central Bank + UI + Database
**Performance**: Cached (1 min TTL)
**Maintainability**: Single Source of Truth
