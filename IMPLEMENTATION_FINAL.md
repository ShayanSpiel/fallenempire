# Law System - Final Implementation Guide

## Architecture Overview

```
POLITICS TAB
│
├─ [Law List Accordion] (INLINE)
│  └─ User clicks "Propose a Law"
│     └─ Accordion expands showing list of available laws
│        └─ User clicks a law
│           └─ Triggers...
│
├─ [Law Proposal Drawer] (MODAL)
│  ├─ User proposes new law
│  │  └─ User selects target (for war)
│  │     └─ Clicks "Propose Law"
│  │        └─ Proposal created, drawer closes
│  │           └─ Appears in Active Proposals list
│  │
│  └─ User views/votes existing proposal
│     └─ User clicks proposal from sidebar
│        └─ Same drawer opens with vote buttons
│           └─ User votes
│              └─ Proposal updates in real-time
│
├─ [Active Proposals] (Clickable cards)
│  └─ Shows all pending proposals
│     └─ User can click to view/vote
│
└─ [Politics Events Sidebar] (Right panel)
   ├─ Active proposals (clickable)
   └─ Historical events
```

---

## Component Structure

### 1. LawListAccordion (Inline)
**File:** `components/community/law-list-accordion.tsx`

**Purpose:** Display list of available laws inline in the Politics Panel

**Features:**
- Expands/collapses inline (no modal)
- Filters laws by user rank and governance type
- Shows law name, description, voting time, fast-track indicator
- Clicking a law triggers the drawer

**Props:**
```typescript
interface LawListAccordionProps {
  governanceType: string;
  userRank: number;
  onSelectLaw: (lawType: LawType) => void;
  isExpanded: boolean;
  onToggle: (expanded: boolean) => void;
}
```

**Behavior:**
```
User clicks "Propose a Law" header
  ↓
isExpanded toggles true
  ↓
List of laws appears below
  ↓
User clicks "Declare War"
  ↓
onSelectLaw("DECLARE_WAR")
  ↓
Drawer opens in PoliticsPanel
```

---

### 2. LawProposalDrawer (Modal)
**File:** `components/community/law-proposal-drawer.tsx`

**Purpose:** Modal dialog for proposing new laws OR viewing/voting on existing proposals

**Features:**
- 80% of screen on desktop
- Full screen on mobile with close button (X)
- Dual mode:
  - **Propose mode:** When lawType is provided (new proposal)
  - **View/Vote mode:** When proposalId is provided (existing proposal)
- Smart button rendering based on user access
- Shows governance rules, voting progress, proposal status

**Props:**
```typescript
interface LawProposalDrawerProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  communityId: string;
  governanceType: string;
  userRank: number;
  lawType?: LawType;        // For proposing (new)
  proposalId?: string;      // For viewing/voting (existing)
  onProposalCreated?: () => void;
}
```

**Modes:**

**PROPOSE MODE (lawType provided):**
```
Header: Law title + close button
Content:
  - Law details (2-column grid)
    - Voting Time
    - Passing Condition
    - Sovereign Power (if applicable)
    - Who Can Vote
    - Description
  - Law-specific inputs (for DECLARE_WAR: target search)
  - Error messages
Buttons:
  - [Propose Law] (disabled until inputs filled)
  - [Cancel]
```

**VIEW/VOTE MODE (proposalId provided):**
```
Header: Law title + close button
Content:
  - Law details (same as above)
  - Proposal status card
    - Time remaining
    - Status badge (pending/passed/rejected)
    - Vote progress bar (yes/no)
Buttons:
  - If user can vote: [Vote Yes] [Vote No]
  - If already voted: "You have already voted" message
  - If no access: "You don't have voting access" message
  - [Close]
```

---

### 3. PoliticsPanel (Main Container)
**File:** `components/community/politics-panel.tsx`

**Purpose:** Main orchestrator component for all law-related UI

**Structure:**
```
Main Section (Left)
├─ [LawListAccordion] ← Inline, expands in place
├─ Active Proposals ← Clickable cards
│  └─ Shows all pending proposals with progress bars
│     └─ Clicking opens drawer in view/vote mode
└─ Resolved Proposals ← Read-only history

Sidebar (Right)
├─ Active Proposals ← Quick access, clickable
├─ Events ← Historical events
```

**State Management:**
```typescript
const [isAccordionExpanded, setIsAccordionExpanded] = useState(false);
const [isDrawerOpen, setIsDrawerOpen] = useState(false);
const [selectedLaw, setSelectedLaw] = useState<LawType | null>(null);
const [selectedProposalId, setSelectedProposalId] = useState<string | null>(null);
const [proposals, setProposals] = useState<Proposal[]>([]);
```

**Key Handlers:**

```typescript
const handleSelectLaw = (lawType: LawType) => {
  setSelectedLaw(lawType);
  setSelectedProposalId(null);  // Clear proposal mode
  setIsDrawerOpen(true);        // Open drawer
  setIsAccordionExpanded(false); // Close accordion
};

const handleSelectProposal = (proposalId: string) => {
  setSelectedProposalId(proposalId);
  setSelectedLaw(null);          // Clear propose mode
  setIsDrawerOpen(true);         // Open drawer
};

const handleDrawerClose = () => {
  setIsDrawerOpen(false);
  setSelectedLaw(null);
  setSelectedProposalId(null);
  // Drawer content automatically switches based on these values
};
```

---

## User Flows

### Flow 1: Propose a Law

```
1. User sees Politics Panel
   ├─ "Propose a Law" accordion (collapsed)
   ├─ Active Proposals list
   └─ Sidebar with events

2. User clicks "Propose a Law" header
   └─ LawListAccordion expands INLINE

3. User sees list of available laws:
   ├─ ⚔️ Declare War (24h, can fast-track)
   ├─ 👑 Propose Heir (12h, can fast-track)
   ├─ ⚙️ Change Governance (48h)
   └─ 💰 Levy Tax (24h, can fast-track)

4. User clicks "Declare War"
   └─ handleSelectLaw("DECLARE_WAR")
      └─ Drawer opens with PROPOSE MODE

5. Drawer shows:
   ├─ Title: "Declare War"
   ├─ Description
   ├─ Law details (voting time, conditions, etc.)
   ├─ Target search field
   └─ [Propose Law] button (disabled)

6. User searches & selects target
   └─ [Propose Law] button enables

7. User clicks "Propose Law"
   └─ proposeLawAction() called
      └─ Proposal created in database
         └─ Drawer closes
            └─ PoliticsPanel reloads proposals
               └─ New proposal appears in Active Proposals list
```

### Flow 2: Vote on Existing Proposal

```
1. User sees Politics Panel with active proposals
   ├─ Main area: "Declare War" card (clickable)
   └─ Sidebar: "Declare War" in active proposals (clickable)

2. User clicks proposal card or sidebar item
   └─ handleSelectProposal(proposalId)
      └─ Drawer opens with VIEW/VOTE MODE

3. Drawer shows:
   ├─ Title: "Declare War"
   ├─ Law details
   ├─ Proposal status:
   │  ├─ Time remaining (12h)
   │  ├─ Status badge (pending)
   │  └─ Vote progress (3 yes, 1 no)
   └─ Buttons based on access:
      ├─ If can vote: [Vote Yes] [Vote No] [Close]
      ├─ If already voted: [Close]
      └─ If no access: [Close] + message

4. User clicks [Vote Yes]
   └─ voteOnProposalAction(proposalId, "yes")
      └─ Vote recorded in database
         └─ Proposal reloaded
            └─ Vote count updates in real-time
               └─ Button shows "You have already voted" message

5. User clicks [Close]
   └─ Drawer closes
      └─ PoliticsPanel still shows updated vote counts
```

---

## Styling Architecture

### Minimal Theme Approach

**No hardcoded colors.** All styling uses CSS custom properties and Tailwind:

```typescript
// ✅ GOOD - Uses theme variables
className="bg-muted/20 p-4 rounded-lg border border-border/40"

// ❌ BAD - Hardcoded color
className="bg-red-500 p-4"
```

### Drawer Responsive Design

**Mobile:**
```typescript
// Full screen
className="w-full max-w-none"  // No max-width restriction
// Close button visible
<button className="flex-shrink-0 h-10 w-10">
  <X className="h-5 w-5" />
</button>
// Full height available
className="max-h-[90vh]"
```

**Desktop:**
```typescript
// 80% of screen (large modal)
className="max-w-4xl"  // sm:max-w-4xl for responsive
// Close button visible (same as mobile)
// Centered with proper padding
```

### Content Grid

**Law Details - 2 Column Grid on Desktop**
```typescript
className="grid sm:grid-cols-2 gap-4"
// Stacks on mobile, 2 columns on desktop
```

---

## Data Flow

```
User Action
  ↓
Event Handler (handleSelectLaw, handleSelectProposal)
  ↓
State Update (selectedLaw, selectedProposalId, isDrawerOpen)
  ↓
LawProposalDrawer re-renders with new props
  ↓
Component logic determines:
  ├─ Which mode? (propose vs view/vote)
  ├─ What buttons? (based on user access)
  └─ What content? (based on lawType or proposal data)
  ↓
User interacts (propose, vote, close)
  ↓
Server Action called (proposeLawAction, voteOnProposalAction)
  ↓
loadProposals() called to refresh
  ↓
State updates, components re-render
```

---

## File Summary

### New Files
- `components/community/law-list-accordion.tsx` - Inline law list
- `components/community/law-proposal-drawer.tsx` - Modal for propose/vote
- `lib/governance/laws.ts` - Law registry and helpers
- `app/actions/laws.ts` - Server actions
- `supabase/migrations/20260107_law_system.sql` - Database schema

### Modified Files
- `components/community/politics-panel.tsx` - Main orchestrator
- `components/community/community-details-client.tsx` - Pass props

### Deleted Files
- `components/community/law-proposal-sheet.tsx` - Replaced by drawer
- `components/community/declare-war-sheet.tsx` - Replaced by law system

---

## Key Design Decisions

### 1. Inline Accordion (not modal)
- Users see laws in context of other proposals
- No page jump/distraction
- Faster access to existing proposals below

### 2. Modal Drawer (not inline form)
- Full focus on single law
- 80% of screen = premium look
- Close button for easy dismiss
- Separate from active proposals list

### 3. Dual-Mode Drawer
- Same component for propose AND vote
- Consistent UX
- Reduces code duplication
- Logic determined by props (lawType vs proposalId)

### 4. Politics Events Sidebar
- Active proposals clickable and accessible
- No need to scroll main area
- Quick voting interface
- Historical context maintained

### 5. Smart Button Rendering
- Buttons change based on:
  - User rank (can they vote?)
  - Proposal status (pending vs resolved?)
  - User's vote history (already voted?)
- No hidden/disabled buttons confuse users

---

## Testing Checklist

- [ ] Accordion expands/collapses inline
- [ ] Drawer opens when law selected
- [ ] Drawer opens when proposal clicked
- [ ] Target search works for declare war
- [ ] Proposal can be created
- [ ] New proposal appears in lists
- [ ] Existing proposal can be voted on
- [ ] Vote buttons show/hide correctly
- [ ] Drawer closes properly
- [ ] Mobile: drawer full screen with close button
- [ ] Desktop: drawer 80% width looking premium
- [ ] Styling uses CSS variables (no hardcoded colors)
- [ ] Multiple proposals can coexist
- [ ] Vote progress updates in real-time
- [ ] Sidebar proposals are clickable
- [ ] Governance rules display correctly

---

## Summary

The law system is now properly structured with:
- ✅ **Inline accordion** for law selection
- ✅ **Modal drawer** for propose/vote (dual-mode)
- ✅ **Responsive design** (full-screen mobile, 80% desktop)
- ✅ **No hardcoded styling** (CSS variables + Tailwind)
- ✅ **Clickable sidebars** for quick access
- ✅ **Smart button rendering** based on user access
- ✅ **Clean separation of concerns** (three components)

Ready to test and deploy!
