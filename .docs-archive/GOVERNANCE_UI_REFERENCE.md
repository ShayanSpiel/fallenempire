# Governance System - UI Reference Guide

## Community Creation Flow

### Before (Old)
```
┌─────────────────────────────┐
│  Create a New Community      │
├─────────────────────────────┤
│ Name:        [____________] │
│ Ideology:    [____________] │
│ Color:       [██]           │
│ Description: [____________] │
│                             │
│         [Create & Join]     │
└─────────────────────────────┘
```

### After (New - With Governance Type Selection)
```
┌─────────────────────────────┐
│  Create a New Community      │
├─────────────────────────────┤
│ Name:        [____________] │
│ Ideology:    [____________] │
│ Color:       [██]           │
│ Description: [____________] │
│                             │
│ Governance Type:            │
│ ┌──────┐ ┌──────┐ ┌──────┐ │
│ │ 👑   │ │  ⚖️  │ │  ⚡  │ │
│ │Kingdom│ │Democ│ │Dictat│ │
│ │[✓]   │ │[X]   │ │[X]   │ │
│ └──────┘ └──────┘ └──────┘ │
│  (Active)  (Disabled)      │
│                             │
│  More governance types      │
│  coming soon.               │
│                             │
│         [Create & Join]     │
└─────────────────────────────┘
```

---

## Governance Hierarchy View

### Sovereign Section (Empty - Vacant Throne)

#### Before (Old)
```
┌────────────────────────────┐
│  King/Queen                │
│ [────────────────────────] │
│ ╎                          ╎
│ ╎  No Sovereign            ╎
│ ╎  The throne is vacant    ╎
│ ╎                          ╎
│ ╎                          ╎
│ ╎  [The throne awaits...]  ╎
│ ╎  [Claim the Throne]      ╎
│ ╎                          ╎
│ ╎                          ╎
│ ╎                          ╎
│ ╎                          ╎
│ [────────────────────────] │
└────────────────────────────┘
```

#### After (New - Prominent Button)
```
┌────────────────────────────┐
│  👑 King/Queen             │
│ [────────────────────────] │
│ ╎                          ╎
│ ╎  No King/Queen           ╎
│ ╎  The throne is vacant    ╎
│ ╎                          ╎
│ ╎ ┌──────────────────────┐ ╎
│ ╎ │ 👑 CLAIM THE THRONE  │ ╎
│ ╎ └──────────────────────┘ ╎
│ ╎                          ╎
│ [────────────────────────] │
└────────────────────────────┘
```

### Sovereign Section (Filled)

```
┌────────────────────────────┐
│  👑 King/Queen             │
│ [────────────────────────] │
│ ╎                          ╎
│ ╎       ┌────────┐         ╎
│ ╎       │ Avatar │         ╎
│ ╎       └────────┘         ╎
│ ╎     AlexGaming            ╎
│ ╎    King/Queen             ╎
│ ╎                          ╎
│ [────────────────────────] │
└────────────────────────────┘
```

---

## Secretary Slots Section

```
┌────────────────────────────┐
│  🔧 Secretary              │
│ [────────────────────────] │
│ ┌────────┐ ┌────────┐ ┌───┐│
│ │ Avatar │ │ Avatar │ │ + ││
│ └────────┘ └────────┘ └───┘│
│  JaneDev   MikeMod        │
│ Secretary  Secretary       │
└────────────────────────────┘
```

**Key Points:**
- Shows 3 slots (monarchy maxCount: 3)
- Filled slots show member avatar + name
- Empty slots show "+" button (if user is sovereign)
- Empty slots show placeholder "+" (if user is not sovereign)

---

## Members Drawer (Complete)

### Before (Old - Role-Based)
```
┌────────────────────────────┐
│ Community Members      [X]  │
│ 42 Members • Gaming Guild   │
├────────────────────────────┤
│                            │
│ 👑 LEADERSHIP (2)          │
│ ─────────────────────────  │
│  ❏ AlexGaming             │
│  ❏ JaneDev                │
│                            │
│ 👤 MEMBERS (40)            │
│ ─────────────────────────  │
│  ❏ MikeMod                │
│  ❏ SarahGamer             │
│  ❏ TomCoder                │
│   ... (37 more)            │
│                            │
└────────────────────────────┘
```

### After (New - Governance Rank-Based)
```
┌────────────────────────────┐
│ Community Members      [X]  │
│ 42 Members • Gaming Guild   │
├────────────────────────────┤
│                            │
│ 👑 KING/QUEEN (1)          │
│ ─────────────────────────  │
│  ❏ AlexGaming             │
│                            │
│ 🔧 SECRETARY (2)           │
│ ─────────────────────────  │
│  ❏ JaneDev                │
│  ❏ MikeMod                │
│                            │
│ 👤 MEMBERS (39)            │
│ ─────────────────────────  │
│  ❏ SarahGamer             │
│  ❏ TomCoder                │
│  ❏ LisaCoder               │
│   ... (36 more)            │
│                            │
└────────────────────────────┘
```

**Changes:**
- "Leadership" → "King/Queen" / "Secretary" (based on governance)
- Sorted by rank_tier
- Icons match governance config:
  - 👑 (amber) for rank 0
  - 🔧 (blue) for rank 1
  - 👤 (grey) for other ranks
- Count badges accurate per rank

---

## Governance Type Selection Details

### Kingdom (Enabled)
```
┌────────┐
│   👑   │  ← Crown icon
│ Kingdom│  ← Label
└────────┘
  Bright border (primary color)
  Solid background
  Clickable/interactive
  Status: ACTIVE
```

### Democracy (Disabled)
```
┌────────┐
│   ⚖️   │  ← Scales icon
│Democra-│  ← Label (fits 3 cols)
└────────┘
  Faint border (border/30)
  Muted background
  Opacity 50%
  Cursor: not-allowed
  Status: COMING SOON
```

### Dictatorship (Disabled)
```
┌────────┐
│   ⚡   │  ← Lightning icon
│Dictato-│  ← Label (fits 3 cols)
└────────┘
  Faint border (border/30)
  Muted background
  Opacity 50%
  Cursor: not-allowed
  Status: COMING SOON
```

---

## Governance Config Mapping

### Kingdom (Monarchy)
```typescript
{
  name: "Monarchy",
  label: "Kingdom",
  description: "Ruled by a single sovereign with appointed advisors"

  Rank 0: King/Queen (👑)
    - maxCount: 1
    - permissions: assign ranks

  Rank 1: Secretary (🔧)
    - maxCount: 3
    - permissions: none (advisory only)
}
```

### Democracy (Future)
```typescript
{
  name: "Democracy",
  label: "Republic",
  description: "Governed by elected representatives"

  Rank 0: Senator (⚖️)
    - maxCount: 10
    - permissions: assign ranks
}
```

### Dictatorship (Future)
```typescript
{
  name: "Dictatorship",
  label: "Regime",
  description: "Absolute rule by the leader"

  Rank 0: Dictator (⚡)
    - maxCount: 1
    - permissions: all administrative actions
}
```

---

## State Transitions

### Sovereign State
```
┌──────────────────┐
│  No Sovereign    │  ← Community starts here
│  (vacant throne) │
└────────┬─────────┘
         │ Any member claims
         │ claimThroneAction()
         │
         ↓
┌──────────────────┐
│  With Sovereign  │  ← Claim button disappears
│  (ruled)         │  ← Sovereign can assign ranks
└──────────────────┘
```

### Rank Assignment
```
Sovereign can assign members to:
  - Rank 0 (but only if vacant - handled by DB constraint)
  - Rank 1 (up to 3)

Cannot assign rank 10 (members default to this)
```

---

## Responsive Design Notes

### Mobile (< 640px)
- Governance type selector stays as 3 buttons in row
- Buttons may have smaller padding
- Names wrap if needed
- Sovereign section increases min-height for tap target
- Secretary slots may stack (but should stay 3-wide for visibility)

### Tablet (640px - 1024px)
- All elements scale properly
- Governance selector maintains 3-column grid
- Secretary slots show well
- Member drawer full-width

### Desktop (> 1024px)
- Full spacious layout
- All elements properly spaced
- Good visual hierarchy

---

## Copy/Text References

### Create Form
```
"Governance Type"
"More governance types coming soon."
```

### Governance Hierarchy
```
"No King/Queen"
"The throne is vacant"
"CLAIM THE THRONE"
```

### Member Drawer
```
"KING/QUEEN (1)"
"SECRETARY (3)"
"MEMBERS (39)"
```

---

## Color/Icon Reference

| Element | Icon | Color | Meaning |
|---------|------|-------|---------|
| Sovereign | 👑 | Amber | Authority |
| Secretary | 🔧 | Blue | Support/Admin |
| Member | 👤 | Grey | Regular |
| Kingdom | 👑 | Primary | Active governance |
| Democracy | ⚖️ | Muted | Disabled (coming) |
| Dictatorship | ⚡ | Muted | Disabled (coming) |

---

## Interaction Points

### User Actions
1. **Claim Throne** - Click prominent button
   - Available: Only when no sovereign exists
   - Effect: Becomes rank_tier = 0

2. **Assign Secretary** - Click "+" in secretary slot
   - Available: Only if user is sovereign
   - Effect: Opens member picker

3. **View Members** - Click member drawer button
   - Shows full member list sorted by rank
   - Can click member to visit profile

4. **Select Governance** - Click governance type button
   - Only Kingdom is clickable
   - Democracy/Dictatorship disabled

---

## Future Enhancements

When enabling Democracy or Dictatorship:
1. Remove `disabled` attribute from button
2. Remove `opacity-50` class
3. Change `cursor-not-allowed` to pointer
4. Add governance config to `lib/governance.ts`
5. Update `create-community-form.tsx` enabled button logic

No other changes needed - system is already prepared!
