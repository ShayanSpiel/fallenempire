# Military Ranking System - UI Guide

## Visual System Overview

### Rank Icons & Colors

```
Rank Display as Circular Badge:

     🪖              ⚔️              🗡️              ⭐
   SLATE           ZINC            AMBER           ORANGE
   Recruit        Private         Corporal        Sergeant

     🔥              👑              💎              ⚜️
    RED             ROSE           PURPLE          VIOLET
  Lieutenant      Captain          Major          Colonel

                    🏆
                  INDIGO
                  General
```

Each has:
- Unique emoji icon
- Unique Tailwind color class
- Color-coded backgrounds in components
- Descriptive flavor text

---

## UI Component Locations

### 1. Battle Page - Damage Bar (Top Priority)
**Location:** Above "FIGHT" button during active battle

```
┌─────────────────────────────────┐
│  Damage: 12,450 / 100,000  [Captain]  ← Dynamic rank
├─────────────────────────────────┤
│ ██████████░░░░░░░░░░░░░░░░░░░░  ← Progress bar (12.45%)
└─────────────────────────────────┘
```

**Shows:**
- Live damage count
- Target (100,000)
- Current military rank (updates in real-time)
- Progress bar to next rank milestone

---

### 2. Profile Page - Military Service Section
**Location:** Below Decorations/Medals section

```
┌─────────────────────────────────────────────┐
│ Military Service                             │
├─────────────────────────────────────────────┤
│                                              │
│  [ 👑 ]        Current Rank                 │
│   CAPTAIN      Captain                      │
│                                              │
├──────────────────────┬──────────────────────┤
│ [Swords]             │ [Trophy]             │
│ BATTLES FOUGHT: 42   │ BATTLES WON: 28 (67%)│
├──────────────────────┼──────────────────────┤
│ [Zap]                │ [Shield]             │
│ TOTAL DAMAGE: 2.5M   │ WIN STREAK: 5        │
├──────────────────────────────────────────────┤
│ Avg Damage/Battle: 59.5K | Highest: 125.3K │
└──────────────────────────────────────────────┘
```

**Shows:**
- Large rank badge (lg size)
- All battle statistics
- Average and highest damage
- Win/loss ratio
- Current win streak

---

### 3. Leaderboard Page
**Location:** `/leaderboard` - New top-level navigation item

#### Header Section
```
┌─────────────────────────────────────┐
│ 👑 Global Leaderboard               │
│ Compete for glory across the realm   │
│                                     │
│ [🏅 Military Rank] [📈 Level]      │
└─────────────────────────────────────┘
```

#### Rank Leaderboard Cards
```
┌──────────────────────────────────────────────────────┐
│ 🥇 | [Avatar] Username        │ 1.2M    [👑 Captain] │
│                    42 battles • 28 wins  │             │
└──────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────┐
│ 🥈 | [Avatar] Username2       │ 950K    [⭐ Sgt]    │
│                    38 battles • 25 wins  │             │
└──────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────┐
│ 🥉 | [Avatar] Username3       │ 875K    [🔥 Lt]     │
│                    35 battles • 22 wins  │             │
└──────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────┐
│ #4 | [Avatar] Username4       │ 720K    [⚔️ Pvt]    │
│                    30 battles • 18 wins  │             │
└──────────────────────────────────────────────────────┘
```

**Shows:**
- Rank position with medal emoji (top 3)
- User avatar
- Username (clickable → profile)
- Rank score (formatted: 1.2M)
- Current military rank badge
- Battle statistics
- Dark card with hover effects

#### Level Leaderboard Cards
```
┌──────────────────────────────────────────────────────┐
│ 🥇 | [Avatar] Username        │ 43 |   2.8M XP      │
│                    42 battles • 28 wins  │             │
└──────────────────────────────────────────────────────┘
```

**Shows:**
- Level number (large, blue text)
- Total XP earned
- Same battle stats

---

## Component Hierarchy

```
RankDisplay (large circular)
├─ Used in: Profile Military Service section
├─ Sizes: lg (24x24 with label)
└─ Shows: Large emoji, rank name below

RankBadge (pill-style)
├─ Used in: Profile stats, tooltips
├─ Sizes: sm, md, lg
└─ Shows: Icon + rank name + optional description

RankProgress (progress bar)
├─ Used in: Battle page damage bar
├─ Features: Current/next rank, percentage, damage needed
└─ Shows: Visual progress, statistics

LeaderboardCard (full entry)
├─ Used in: Leaderboard page
├─ Features: Rank position, avatar, username, stats
└─ Shows: Medal emoji, rank badge, level/score
```

---

## Color Scheme by Rank

### Dark Theme (Primary)
```
Recruit:   bg-slate-500    border-slate-400    text-white
Private:   bg-zinc-500     border-zinc-400     text-white
Corporal:  bg-amber-500    border-amber-400    text-white
Sergeant:  bg-orange-500   border-orange-400   text-white
Lieutenant:bg-red-500      border-red-400      text-white
Captain:   bg-rose-500     border-rose-400     text-white
Major:     bg-purple-500   border-purple-400   text-white
Colonel:   bg-violet-500   border-violet-400   text-white
General:   bg-indigo-500   border-indigo-400   text-white
```

### Light Backgrounds (Hover States)
```
With dark: prefix for dark mode:
- dark:bg-slate-900, dark:border-slate-800
- etc.
```

---

## Navigation Integration

### App Shell (Top Navigation)
```
Home | Map | Battles | ⭐ Leaderboard | Community ▼ | Profile ▼
```

**Leaderboard link:**
- Icon: Crown (👑)
- Href: `/leaderboard`
- Position: Between Battles and Community
- Shows when authenticated

---

## Data Flow Visualization

### During Battle
```
Player Takes Action
    ↓
recordBattleParticipation() called
    ├─ Creates battle_participants entry
    └─ Stores: side, damage, user_id, battle_id
    ↓
UI Updated Instantly
    ├─ Damage counter increases
    ├─ Progress bar animates
    └─ Rank display updates (if score changes mid-battle)
```

### After Battle Ends
```
Battle Status Changes to Win/Loss
    ↓
updateBattleParticipantStats() called
    ├─ Fetches all participants
    ├─ Determines winners
    └─ For each: updateBattleStats()
         ├─ Calculates new military_rank_score
         ├─ Determines new rank tier
         ├─ Updates win streak
         └─ Saves all stats
    ↓
Client-Side Rank-Up Animation (Optional)
    ├─ Shows promotion notification
    └─ Updates profile section
```

### Leaderboard Display
```
User Navigates to /leaderboard
    ↓
Fetch rank leaderboard (top 50 by military_rank_score DESC)
Fetch level leaderboard (top 50 by total_xp DESC)
    ↓
Map entries to LeaderboardCard components
    ├─ Calculate position (index + 1)
    ├─ Determine medal emoji (top 3)
    └─ Format scores and stats
    ↓
Render scrollable list
    └─ Each card is clickable link to profile
```

---

## Mobile Responsiveness

### Battle Page (sm: < 640px)
```
Damage bar shrinks to fit screen width
Rank display remains visible
Icons scale appropriately
```

### Profile (sm: < 640px)
```
Military Service section:
├─ Stacks vertically
├─ Rank display on top
└─ Stats grid becomes single column
```

### Leaderboard (sm: < 640px)
```
Cards stack vertically
Rank position shown as emoji
Avatar size: 12x12 → 10x10
Score/level right-aligned
```

---

## Animation States

### Progress Bar
- Gradient: `from-amber-400 to-rose-500`
- Transition: `duration-500 ease-out`
- Updates on damage change

### Card Hover (Leaderboard)
- Border: `hover:border-amber-500/50`
- Background: `hover:bg-slate-800/50`
- Transition: `transition-all`

### Rank Badge
- Shadow: `shadow-lg hover:shadow-xl`
- Border: `border-4 border-white dark:border-slate-800`
- Transition: `transition-shadow`

---

## Empty States

### No Battles Yet
```
Battle Stats Section:
- "0 battles"
- Rank: Recruit
- All stats show 0
```

### Empty Leaderboard
```
"No entries yet"
(Shown when no users have any rank score)
```

---

## Accessibility Features

- Semantic HTML (proper headings, sections)
- Color + Icons (not color-only indicators)
- Proper contrast ratios
- Tooltips on hover
- Link labels descriptive
- Icons have aria-labels

---

## Performance Optimizations

### Leaderboard
- Limits to top 50 entries
- Single query per tab (no N+1)
- Cached for 1 second between switches
- Indexes on military_rank_score and total_xp

### Profile
- Fetches in single query
- No extra database calls
- RankDisplay component is memoized

### Battle Page
- Updates recorded in background
- No UI blocking
- Progress calculated client-side

