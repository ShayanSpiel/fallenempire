# Law System - Visual Guide

## User Journey: Declaring War

### Screen 1: Politics Tab (Initial State)
```
┌────────────────────────────────────────────────────────┐
│ POLITICS                                               │
├────────────────────────────────────────────────────────┤
│                                                        │
│ ⚖️ LAWS & PROPOSALS              [1 active]            │
│ ┌─────────────────────────────────────────────────────┐
│ │ [🔨 Propose a Law]                                  │
│ │ Leadership access only                              │
│ └─────────────────────────────────────────────────────┘
│                                                        │
│ No active proposals.                                   │
│                                                        │
├────────────────────────────────────────────────────────┤
│ POLITICS EVENTS              [live]                    │
│ No political events recorded yet                       │
└────────────────────────────────────────────────────────┘
```

**User Action:** Click "Propose a Law" button

---

### Screen 2: Law Selection (Sheet Opens)
```
┏━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┓
┃ Propose a Law                                       ┃
┃ Select and propose laws for your community          ┃
┗━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┛

AVAILABLE LAWS

[⚔ Declare War]
  Initiate conflict with another community.
  ⏱ 24h • Can fast-track

[👑 Propose Heir]
  Designate the next in line for succession.
  ⏱ 12h • Can fast-track

[⚙️ Change Governance]
  Shift the community to a different governance model.
  ⏱ 48h

[💰 Levy Tax]
  Impose a tax on community resources.
  ⏱ 24h • Can fast-track
```

**Visual Cues:**
- Scrollable list
- Chevron icons (▼) indicate each law is clickable
- Time durations shown for each
- "Can fast-track" indicator for relevant laws

**User Action:** Click "Declare War"

---

### Screen 3: Law Details (Accordion Expanded)
```
┏━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┓
┃ ⚔️ Declare War                                       ┃
┃ Initiate conflict with another community.           ┃
┗━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┛

┌─────────────────────────────────────────────────────┐
│ LAW DETAILS                                         │
├─────────────────────────────────────────────────────┤
│                                                     │
│ ⏱ VOTING TIME                                      │
│   24 hours                                          │
│                                                     │
│ ✓ PASSING CONDITION                                │
│   Sovereign Only                                    │
│                                                     │
│ 🗳️ WHO CAN VOTE                                     │
│   Council Only                                      │
│                                                     │
│ ⚡ SOVEREIGN POWER                                  │
│   Can be fast-tracked                              │
│                                                     │
│ 📋 DESCRIPTION                                     │
│   Only the sovereign can declare war, but          │
│   advisors vote to approve.                        │
│                                                     │
└─────────────────────────────────────────────────────┘

TARGET COMMUNITY
[Search for a community...                          ]

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

[Propose Law]
[Back to Laws]
```

**Visual Cues:**
- Title and description at top
- Governance rules in a card container
- Target input field ready for search
- Two action buttons at bottom

**User Action:** Type "north" in search field

---

### Screen 4: Search Results
```
┏━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┓
┃ ⚔️ Declare War                                       ┃
┃ Initiate conflict with another community.           ┃
┗━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┛

[Law Details - same as before]

TARGET COMMUNITY
[Search for a community...                  north    ]

🔍 Searching...

  [The North Kingdom]          ← User will click this

  [Northern Empire]

  [North Coast Alliance]

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

[Propose Law] (disabled - no target yet)
[Back to Laws]
```

**Visual Cues:**
- Loading spinner shows search in progress
- Results appear below search box
- Results are clickable buttons
- "Propose Law" button is greyed out until target selected

**User Action:** Click "The North Kingdom"

---

### Screen 5: Target Selected
```
┏━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┓
┃ ⚔️ Declare War                                       ┃
┃ Initiate conflict with another community.           ┃
┗━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┛

[Law Details - same as before]

TARGET COMMUNITY
[Search for a community...                        ]

✓ The North Kingdom (selected in red background)

┌─────────────────────────────────────────────────────┐
│ ⚔️ War with The North Kingdom                       │
│    Hostilities will commence in 1 hour              │
└─────────────────────────────────────────────────────┘

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

[Propose Law] ← Now enabled (green)
[Back to Laws]
```

**Visual Cues:**
- Selected target highlighted in red
- Warning box shows war will begin
- "Propose Law" button now active/enabled
- Red theme emphasizes war action

**User Action:** Click "Propose Law"

---

### Screen 6: Proposal Processing
```
┏━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┓
┃ ⚔️ Declare War                                       ┃
┃ Initiate conflict with another community.           ┃
┗━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┛

[Law Details and selections shown faded]

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

[Proposing...] 🔄 ← Loading indicator
[Back to Laws] (disabled)
```

**Visual Cues:**
- Content fades slightly
- Button shows loading state
- Back button disabled
- Spinner indicates processing

---

### Screen 7: Success (Sheet Closes, Panel Updates)
```
┌────────────────────────────────────────────────────────┐
│ POLITICS                                               │
├────────────────────────────────────────────────────────┤
│                                                        │
│ ⚖️ LAWS & PROPOSALS              [1 active]            │
│ ┌─────────────────────────────────────────────────────┐
│ │ [🔨 Propose a Law]                                  │
│ └─────────────────────────────────────────────────────┘
│                                                        │
│ ⚔ Declare War
│   Initiate conflict with another community.
│   ⏱ 24h remaining
│   ████░░░░░░ 0/2 votes                               │
│   Sovereign Only                                      │
│                                                        │
├────────────────────────────────────────────────────────┤
│ POLITICS EVENTS              [live]                    │
│ [User] proposed war declaration                        │
│ 2 minutes ago                                          │
└────────────────────────────────────────────────────────┘
```

**Visual Cues:**
- Sheet closes automatically
- Proposal appears in "Active Proposals" section
- Vote counter shows 0 votes initially
- Time remaining displays countdown
- Event logged in Politics Events panel

---

## Color Scheme & Icons

```
LAW TYPES & ICONS:
─────────────────
⚔️ DECLARE_WAR     (Red theme, military icon)
👑 PROPOSE_HEIR    (Gold theme, crown icon)
⚙️ CHANGE_GOVERNANCE (Blue theme, gear icon)
💰 LEVY_TAX        (Green theme, coins icon)

VOTING & RESULTS:
────────────────
✓ Passed           (Green checkmark)
✗ Rejected         (Red X mark)
⏱️ Time remaining   (Orange clock)
🗳️ Voting access    (Blue ballot icon)
⚡ Fast-track       (Amber lightning)

GOVERNANCE RULES:
────────────────
░░░░░░░░░░ Voting progress bar
🔒 Locked         (Restricted action)
👤 Council only    (Limited access)
🌍 Everyone votes  (Open access)
```

---

## State Visualization: Governor's Perspective

### As King (Rank 0)
```
Available Actions:
  ✅ Propose any law
  ✅ Vote on any law
  ✅ Fast-track any law (skip voting)

Declare War Options:
  1️⃣ Propose war
  2️⃣ Wait 24h for council feedback
  3️⃣ OR click "Pass Immediately" to start war now

After Proposal:
  🔴 Can see voting progress
  🔴 Can use fast-track anytime
  🔴 Can see advisor votes (secretaries)
```

### As Secretary (Rank 1)
```
Available Actions:
  ❌ Cannot propose war
  ✅ Can vote on council laws
  ✅ Cannot fast-track

Declare War Participation:
  🔴 King proposed war on The North Kingdom
  🔴 Timer: 23h 45m remaining
  🔴 You can vote: [YES] [NO]
  🔴 Current: 1 yes, 0 no (from King)
```

### As Member (Rank 10)
```
Available Actions:
  ❌ Cannot propose most laws
  ❌ Cannot vote (in monarchy)
  ❌ Cannot fast-track

Declare War Status (Observer):
  👁️ See active proposal
  👁️ See voting status
  👁️ Cannot participate in voting
  🔴 Wait for resolution
```

---

## Error States

### Error 1: Duplicate Proposal
```
┏━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┓
┃ ⚔️ Declare War                                       ┃
┗━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┛

[Content faded]

┌─────────────────────────────────────────────────────┐
│ ⚠️ A proposal for "Declare War" is already pending  │
└─────────────────────────────────────────────────────┘

[Propose Law] (disabled)
[Back to Laws]
```

### Error 2: Missing Target
```
User tries to propose without selecting target

┌─────────────────────────────────────────────────────┐
│ ⚠️ Please select a target community                 │
└─────────────────────────────────────────────────────┘

[Propose Law] (disabled - no target)
```

### Error 3: Insufficient Permissions
```
Non-founder tries to propose war

┌─────────────────────────────────────────────────────┐
│ 🔒 Leadership access only                           │
│                                                     │
│ You don't have permission to propose this law       │
└─────────────────────────────────────────────────────┘
```

---

## Timeline: What Happens After Proposal

```
T+0h: Proposal Created
├─ status: "pending"
├─ expires_at: NOW + 24h
└─ Vote window opens for council

T+6h: Secretary Votes Yes
├─ proposal_votes: 1 yes, 0 no
└─ Progress shows: 1/2 votes

T+12h: Secretary Votes No
├─ proposal_votes: 1 yes, 1 no
└─ Progress shows: 1/2 votes (split)

T+24h: Proposal Expires
├─ Background job checks: shouldProposalPass(1, 1, 2, "sovereign_only")
├─ King's vote counts: 1 yes ✓
├─ Result: PASSED
├─ status: "passed"
└─ War Executes!

T+25h: In Politics Panel
├─ Proposal moves to "Resolved" section
├─ Shows: ✓ Declare War - Passed
└─ User sees war is active
```

---

## Responsive Design

### Mobile (< 640px)
```
Full width sheet
┌─────────────────┐
│ Propose a Law   │
├─────────────────┤
│ [Law 1]         │
│ [Law 2]         │
│ [Law 3]         │
└─────────────────┘
```

### Tablet (640px - 1024px)
```
sm:max-w-md = 448px
┌──────────────────────────┐
│ Propose a Law            │
├──────────────────────────┤
│ [Law 1]                  │
│ [Law 2]                  │
│ [Law 3]                  │
│ [Law 4]                  │
└──────────────────────────┘
```

### Desktop (> 1024px)
```
Still 448px max width (better UX)
Positioned on right side or center
┌──────────────────────────┐
│ Propose a Law            │
├──────────────────────────┤
│ [Law 1]                  │
│ [Law 2]                  │
│ [Law 3]                  │
│ [Law 4]                  │
└──────────────────────────┘
```

---

## Summary

The visual guide shows:
- ✅ Clear 7-step user journey
- ✅ Intuitive accordion flow
- ✅ Responsive design
- ✅ Error states and edge cases
- ✅ Timeline of proposal lifecycle
- ✅ Different user perspectives
- ✅ Color-coded actions and states
- ✅ Loading states and feedback
