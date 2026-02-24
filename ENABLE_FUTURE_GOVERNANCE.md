# How to Enable Future Governance Types

This guide shows exactly how to enable Democracy and Dictatorship when you're ready.

## Current Status

- ✅ Kingdom: ENABLED (fully functional)
- ⏸️ Democracy: DISABLED (placeholder)
- ⏸️ Dictatorship: DISABLED (placeholder)

---

## Enable Democracy

### Step 1: Define Democracy Config
**File:** `lib/governance.ts`

Add this to the `GOVERNANCE_TYPES` object:

```typescript
democracy: {
  label: "Republic",
  description: "Governed by elected representatives",
  roles: [
    { rank: 0, label: "Senator", maxCount: 10, icon: "person-handshake" },
  ],
  canAssignRanks: [0], // Senators can assign other senators
}
```

### Step 2: Enable Democracy Button
**File:** `components/community/create-community-form.tsx`

Find the Democracy button (around line 109-117):

**Change From:**
```typescript
{/* Democracy - Disabled */}
<button
  type="button"
  disabled                    // ← Remove this line
  className="p-3 rounded-lg border-2 border-border/30 bg-muted/30 opacity-50 cursor-not-allowed flex flex-col items-center gap-2"
>
  <span className="text-xl">⚖️</span>
  <span className="text-xs font-semibold">Democracy</span>
</button>
```

**Change To:**
```typescript
{/* Democracy - Active */}
<button
  type="button"
  onClick={() => setGovernanceType("democracy")}  // ← Add this
  className={cn(
    "p-3 rounded-lg border-2 transition-all flex flex-col items-center gap-2",
    governanceType === "democracy"                  // ← Add this
      ? "border-primary bg-primary/10"              // ← Add this
      : "border-border/50 bg-muted/20"              // ← Add this
  )}
>
  <span className="text-xl">⚖️</span>
  <span className="text-xs font-semibold">Democracy</span>
</button>
```

**That's it!** Democracy is now enabled.

### Step 3: Test
1. Create community
2. See Democracy button is now bright/interactive
3. Click it to select
4. Create community
5. Verify `governance_type = 'democracy'` in database
6. View governance tab - should show "Senator" instead of "King/Queen"

---

## Enable Dictatorship

### Step 1: Define Dictatorship Config
**File:** `lib/governance.ts`

Add this to the `GOVERNANCE_TYPES` object:

```typescript
dictatorship: {
  label: "Regime",
  description: "Absolute rule by the leader",
  roles: [
    { rank: 0, label: "Dictator", maxCount: 1, icon: "crown" },
    { rank: 1, label: "General", maxCount: 3, icon: "shield" },
  ],
  canAssignRanks: [0], // Only dictator can assign
}
```

### Step 2: Enable Dictatorship Button
**File:** `components/community/create-community-form.tsx`

Find the Dictatorship button (around line 119-127):

**Change From:**
```typescript
{/* Dictatorship - Disabled */}
<button
  type="button"
  disabled                    // ← Remove this line
  className="p-3 rounded-lg border-2 border-border/30 bg-muted/30 opacity-50 cursor-not-allowed flex flex-col items-center gap-2"
>
  <span className="text-xl">⚡</span>
  <span className="text-xs font-semibold">Dictatorship</span>
</button>
```

**Change To:**
```typescript
{/* Dictatorship - Active */}
<button
  type="button"
  onClick={() => setGovernanceType("dictatorship")}  // ← Add this
  className={cn(
    "p-3 rounded-lg border-2 transition-all flex flex-col items-center gap-2",
    governanceType === "dictatorship"                 // ← Add this
      ? "border-primary bg-primary/10"                // ← Add this
      : "border-border/50 bg-muted/20"                // ← Add this
  )}
>
  <span className="text-xl">⚡</span>
  <span className="text-xs font-semibold">Dictatorship</span>
</button>
```

### Step 3: Test
1. Create community
2. See Dictatorship button is now bright/interactive
3. Click it to select
4. Create community
5. Verify `governance_type = 'dictatorship'` in database
6. View governance tab - should show "Dictator" and "General" positions

---

## Enable Both

If you want to enable both at the same time:

1. Add both configs to `lib/governance.ts`
2. Update both buttons in `create-community-form.tsx`
3. Update help text if desired (currently says "More governance types coming soon")

---

## Verify Changes

After enabling, test these scenarios:

### Scenario 1: Create with New Type
```
1. Create Community → Select new governance type
2. Check database: governance_type = 'democracy' (or 'dictatorship')
3. Create community successfully
```

### Scenario 2: View Governance
```
1. View community governance tab
2. Should show new rank labels (Senator, Dictator, etc.)
3. Should show correct number of slots
4. UI should adapt automatically
```

### Scenario 3: Member Drawer
```
1. Open member drawer
2. Should show new rank labels with icons
3. Sorting should be correct
4. Section labels should match governance type
```

### Scenario 4: Claim Throne
```
1. Join community with no sovereign
2. Click "Claim the Throne"
3. Should become rank 0 (correct for governance type)
4. Member drawer should show in correct section
```

---

## Example: Democracy Configuration

```typescript
democracy: {
  label: "Republic",
  description: "Governed by elected representatives",
  roles: [
    { rank: 0, label: "Senator", maxCount: 10, icon: "person-handshake" },
  ],
  canAssignRanks: [0],
}
```

**Result:**
- Governance hierarchy shows up to 10 "Senator" slots
- No "Secretary" section
- Members drawer shows "Senator (10)" section
- Any member can claim a senator position
- One of the senators can assign others

---

## Example: Custom Governance (Oligarchy)

You can even create custom types:

```typescript
oligarchy: {
  label: "Council",
  description: "Ruled by a small group of elected leaders",
  roles: [
    { rank: 0, label: "Council Member", maxCount: 5, icon: "users" },
  ],
  canAssignRanks: [0],
}
```

---

## Rollback If Needed

To disable a governance type again:

1. Remove config from `lib/governance.ts`
2. Disable button in `create-community-form.tsx`
3. Done - no data loss, just unavailable for new communities

---

## Frequently Asked Questions

### Q: Can I change a community's governance type after creation?
A: Not yet, but it's easy to add. You'd need to:
1. Add update action in `app/actions/community.ts`
2. Add UI control in community settings
3. Handle rank tier remapping if needed

### Q: Will existing communities break if I change configs?
A: No. Each community stores its `governance_type` in the database, and rank_tier is independent of type name. You can change configs without affecting existing communities.

### Q: Can I have different rank limits per community?
A: Current system uses hard-coded limits from config. To make this dynamic, you'd need to:
1. Add `rank_limits` table
2. Let founders customize limits
3. Validate against custom limits in actions

### Q: How do I test new governance types locally?
A: Same steps as production:
1. Update config
2. Enable button
3. Create community with new type
4. Test all scenarios
5. Check database

---

## Timeline Estimate

- **Enable one governance type:** 5-10 minutes
- **Enable both:** 10-15 minutes
- **Testing:** 15-30 minutes
- **Deployment:** 5 minutes

**Total:** ~30-50 minutes from start to production

---

## Checklist for Enabling

### Before
- [ ] Review config options
- [ ] Decide on rank labels and limits
- [ ] Plan testing scenarios

### During
- [ ] Add governance config to `lib/governance.ts`
- [ ] Update create form buttons
- [ ] Test in dev environment
- [ ] Test all scenarios

### After
- [ ] Deploy to production
- [ ] Monitor for errors
- [ ] Document in your changelog
- [ ] Notify users of new option

---

## Still Need Help?

Refer to these files:
- `GOVERNANCE_SYSTEM_README.md` - Full technical reference
- `GOVERNANCE_EXAMPLES.md` - Implementation patterns
- `GOVERNANCE_UI_REFERENCE.md` - Visual reference

Or just follow the exact code examples in this guide!

---

**Ready to enable?** Just update two files in < 15 minutes! 🚀
