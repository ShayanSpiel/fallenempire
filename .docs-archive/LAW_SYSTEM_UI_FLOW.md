# Law System - UI/UX Flow

## Visual Flow: Accordion-Based Law Proposal

```
┌─────────────────────────────────────────────────────────┐
│         USER CLICKS "PROPOSE A LAW" BUTTON              │
│              (in Politics Panel)                        │
└────────────────┬────────────────────────────────────────┘
                 │
                 ▼
         ┌───────────────────┐
         │   SHEET OPENS     │
         │                   │
         │ "Propose a Law"   │
         │ [Description]     │
         │                   │
         │ AVAILABLE LAWS    │
         │ ──────────────────│
         │                   │
         │ ▼ Declare War     │
         │   ↳ Declare war on│
         │   another commun. │
         │   ⏱ 24h           │
         │                   │
         │ ▼ Propose Heir    │
         │   ↳ Designate the │
         │   next in line    │
         │   ⏱ 12h           │
         │                   │
         └───────────────────┘
```

**What happens:**
- Sheet shows scrollable list of available laws (filtered by user rank + governance type)
- Each law shows name, description, voting time, and fast-track indicator
- User clicks a law to expand/select it

---

## Step 1: Law Selection View

**User sees:**
```
┏━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┓
┃ 🏛️ Propose a Law                ┃
┃ Select and propose laws...      ┃
┗━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┛

AVAILABLE LAWS
─────────────────

[⚔ Declare War]
  ↳ Initiate conflict with another community
  ⏱ 24h • Can fast-track

[👑 Propose Heir]
  ↳ Designate the next in line for succession
  ⏱ 12h • Can fast-track

[⚙️ Change Governance]
  ↳ Shift to different governance model
  ⏱ 48h

[💰 Levy Tax]
  ↳ Impose a tax on resources
  ⏱ 24h • Can fast-track
```

**Code state:**
```typescript
selectedLaw === null  // Shows law list
expandedAccordion === false
```

---

## Step 2: User Clicks a Law (e.g., "Declare War")

**Transition:** Sheet content changes to show law details

```
┌─────────────────────────────────────────┐
│ USER CLICKS "DECLARE WAR"               │
│                                         │
│ [⚔ Declare War]                        │
│   ↳ Initiate conflict...               │
│   ⏱ 24h • Can fast-track               │
│                                         │
│ (User clicks anywhere on this row)      │
└────────────┬────────────────────────────┘
             │
             ▼
        (selectedLaw = "DECLARE_WAR")
```

---

## Step 3: Law Details Accordion View

**User now sees the expanded law details:**

```
┏━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┓
┃ ⚔️ Declare War                      ┃
┃ Initiate conflict with another...  ┃
┗━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┛

┌───────────────────────────────────────┐
│  LAW DETAILS ACCORDION                │
├───────────────────────────────────────┤
│                                       │
│ ⏱ VOTING TIME                         │
│   24 hours                            │
│                                       │
│ ✓ PASSING CONDITION                   │
│   Sovereign Only                      │
│                                       │
│ 🗳️ WHO CAN VOTE                       │
│   Council Only                        │
│                                       │
│ ⚡ SOVEREIGN POWER                     │
│   Can be fast-tracked                 │
│                                       │
│ 📋 DESCRIPTION                        │
│   Only the sovereign can declare      │
│   war, but advisors vote to approve.  │
│                                       │
└───────────────────────────────────────┘

TARGET COMMUNITY
─────────────────
[Search for a community...]

(Results appear as user types)
```

---

## Step 4: User Selects Target

**User types in search box:**

```
┌───────────────────────────────────────┐
│ TARGET COMMUNITY                      │
├───────────────────────────────────────┤
│                                       │
│ [Search for a community...           │]
│  (user types "north")                │
│                                       │
│ ┌─────────────────────────────────┐  │
│ │ ✓ The North Kingdom             │  │
│ │   Selected                       │  │
│ ├─────────────────────────────────┤  │
│ │ The Northern Empire             │  │
│ │                                 │  │
│ │ North Coast Alliance            │  │
│ └─────────────────────────────────┘  │
│                                       │
│ ⚔️ War with The North Kingdom        │
│    Hostilities will commence in...   │
│                                       │
└───────────────────────────────────────┘
```

**State:**
```typescript
selectedLaw = "DECLARE_WAR"
selectedWarTarget = { id: "...", name: "The North Kingdom" }
warTargetSearch = "north"
warTargets = [...]
```

---

## Step 5: User Confirms Selection

**Target is selected, now ready to propose:**

```
┏━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┓
┃ ⚔️ Declare War                      ┃
┃ Initiate conflict with another...  ┃
┗━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┛

[Law Details - Same as before]

TARGET COMMUNITY
─────────────────
[Search for a community...           ]

✓ The North Kingdom
  Selected

⚔️ War with The North Kingdom
   Hostilities will commence in 1 hour

┌─────────────────────────────────────┐
│ [Propose Law]                       │
│ [Back to Laws]                      │
└─────────────────────────────────────┘
```

---

## Step 6: Click "Propose Law"

**Server action called with metadata:**

```typescript
await proposeLawAction(communityId, "DECLARE_WAR", {
  target_community_id: "north-kingdom-id"
})
```

**What happens:**
1. Server validates user can propose
2. Creates record in `community_proposals`
3. Sets expiration to 24h from now
4. Stores target in metadata JSONB

**UI Response:**
- Loading state: "Proposing..."
- Sheet closes
- PoliticsPanel reloads
- Proposal appears in "Active Proposals" section

---

## Step 7: Back Button

**User can click "Back to Laws" to return to law list:**

```
[Back to Laws] button clicked
    ↓
setSelectedLaw(null)
    ↓
Re-renders law selection view
    ↓
User can select a different law
```

---

## Complete User Flow Diagram

```
SHEET OPENS
    ↓
┌──────────────────┐
│ Select Law View  │ ← Start here
├──────────────────┤
│ [Declare War]    │
│ [Propose Heir]   │
│ [Change Gov]     │
│ [Levy Tax]       │
└────────┬─────────┘
         │ Click law
         ▼
┌──────────────────┐
│ Law Details View │ ← Expanded accordion
├──────────────────┤
│ Law info         │
│ Governance rules │
│ Voting timeline  │
│ Law-specific UI  │
│ (target search)  │
├──────────────────┤
│ [Propose Law]    │
│ [Back to Laws] ──┼─────┐
└──────┬───────────┘     │
       │                  │
       │ Propose          └─→ Back to Select View
       │                  (restart if want different law)
       ▼
   PROPOSAL CREATED
   Sheet closes
   Panel reloads
   Proposal visible
```

---

## State Management Detail

```typescript
// In LawProposalSheet component

// View state
const [selectedLaw, setSelectedLaw] = useState<LawType | null>(null);

// If selectedLaw === null:
//   → Show law list/selection view
// If selectedLaw === "DECLARE_WAR":
//   → Show expanded law details + war-specific inputs

// Action state
const [isLoading, setIsLoading] = useState(false);
const [error, setError] = useState<string | null>(null);

// Law-specific state
const [warTargetSearch, setWarTargetSearch] = useState("");
const [selectedWarTarget, setSelectedWarTarget] = useState<{id, name} | null>(null);
const [warTargets, setWarTargets] = useState([]);
```

---

## Keyboard/Accessibility

- Tab through laws (chevron indicates interactive element)
- Enter/Space to select law
- Search box auto-focuses when law selected
- Arrow keys to navigate target results
- Escape to close sheet

---

## Mobile Responsiveness

```
DESKTOP (sm:max-w-md)
┌─────────────────────┐
│ Propose a Law       │
│                     │
│ [Declare War]       │
│ [Propose Heir]      │
└─────────────────────┘

MOBILE (full width)
┌─────────────────────────────┐
│ Propose a Law               │
│                             │
│ [Declare War]               │
│ [Propose Heir]              │
└─────────────────────────────┘
```

Sheet uses `w-full sm:max-w-md` so it's:
- Full width on mobile
- 448px max on desktop
- Maintains readability everywhere

---

## Comparison: Before vs After

### Before (Hardcoded)
```
Politics Panel
    ↓
[Declare War] button (hardcoded)
    ↓
DeclareWarSheet component (custom component)
    ↓
Search + Select + Declare
    ↓
Direct RPC call
```

### After (Registry-Based)
```
Politics Panel
    ↓
[Propose a Law] button (generic)
    ↓
LawProposalSheet component (generic, from LAW_REGISTRY)
    ↓
Select law type (from registry)
    ↓
View law details (from registry)
    ↓
Law-specific inputs (dynamic based on requiresMetadata)
    ↓
Server action with validation
    ↓
Proposal created (generic flow)
```

**Benefits:**
- ✅ Adding new laws = just update registry
- ✅ No custom components per law
- ✅ No hardcoded UI
- ✅ Governance rules drive UI behavior
- ✅ Consistent UX across all laws

---

## Error Handling

**Example: User tries to propose without selecting target**

```
User clicks "Propose Law" without target
    ↓
Client-side check in handleProposeLaw:
if (selectedLaw === "DECLARE_WAR" && !selectedWarTarget) {
  setError("Please select a target community");
  return;  // Don't call server action
}
    ↓
Error displays below the form:
┌─────────────────────────────┐
│ ⚠️ Please select a target    │
│    community                │
└─────────────────────────────┘
```

**Example: Server-side error (duplicate proposal)**

```
User proposes war, server action runs
    ↓
Server finds existing pending war proposal
    ↓
Throws error: "A proposal for 'Declare War' is already pending"
    ↓
catch block in handleProposeLaw
    ↓
setError(err.message)
    ↓
Error displays to user:
┌──────────────────────────────────────┐
│ ⚠️ A proposal for 'Declare War'       │
│    is already pending                │
└──────────────────────────────────────┘
```

---

## Skeleton Loaders (Future Enhancement)

When proposing, you could add skeleton loaders:

```
While searching targets:
┌─────────────────────────┐
│ [Search box]            │
│                         │
│ ░░░░░░░░░░░░░░░░░░░░   │
│ ░░░░░░░░░░░░░░░░░░░░   │
│ ░░░░░░░░░░░░░░░░░░░░   │
└─────────────────────────┘

While proposing:
┌─────────────────────────┐
│ [Proposing...] 🔄       │
└─────────────────────────┘
```

---

## Summary

The new UI/UX provides:

1. **Two-stage flow**: Select law → View details & propose
2. **Accordion feel**: Click law to expand its details
3. **Generic component**: Works for any law type
4. **Dynamic inputs**: Law-specific fields appear based on metadata needs
5. **Clear governance rules**: Users see voting timeline, conditions, access before proposing
6. **Responsive design**: Works on mobile and desktop
7. **Error handling**: Clear feedback for any issues
8. **Consistent pattern**: Same experience for all laws
