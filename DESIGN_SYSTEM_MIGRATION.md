# Design System Migration Guide

## ✅ COMPLETED

### Core Infrastructure
1. **Design System Tokens** (`/lib/design-system.ts`)
   - Comprehensive spacing, radius, typography, and semantic color scales
   - Presets for buttons, cards, badges, forms
   - Utility functions for className combinations

2. **Base UI Components Standardized**
   - ✅ Button: Rounded corners (rounded-lg), improved variants
   - ✅ Card: New variants (default, compact, subtle, elevated)
   - ✅ Badge: Minimalist variants (default, minimal, accent, status colors)
   - ✅ Progress: Size and color variants
   - ✅ Input: Size variants (sm, md, lg)
   - ✅ Textarea: Size variants
   - ✅ Label: Size variants
   - ✅ Typography: Expanded helpers (H1-H4, DisplayLg-Sm, BodyLarge/Small, Meta, Small)
   - ✅ Dialog: Updated border/background colors
   - ✅ Sheet: Consistent border/background colors

3. **Profile Page** (`/app/profile/profile-view.tsx`)
   - ✅ All card styling uses `<Card>` component
   - ✅ All progress bars use `<Progress>` component with color/size variants
   - ✅ Typography uses `<Meta>`, `<Small>`, `<H3>` components
   - ✅ StatSpectrum updated with Progress component
   - ✅ Stat cards use `Card variant="subtle"`
   - ✅ Consistent border colors (border-border/40)
   - ✅ Size utilities (size-12, size-14, size-3, size-1)

### Design Philosophy Applied
- **Minimalist Power**: Clean, information-dense layouts without clutter
- **Consistent Spacing**: Using design tokens instead of hardcoded values
- **Unified Borders**: All cards use border-border/40 for subtle appearance
- **Typography Hierarchy**: Semantic text sizes with proper line heights

---

## ❌ TODO: REMAINING PAGES

### 1. Feed Page (`/components/feed/feed-stream.tsx`)

**Issues to Fix:**
- Line 141: Replace `-mx-6 px-6` padding pattern with consistent spacing utility
- Line 187, 194: Action bar styling - use Button with size variants instead of hardcoded h-9
- Lines 431-437: Toast notification - create consistent toast styling
- Lines 61-72: Avatar sizing - use consistent Avatar sizes

**Changes Needed:**
```typescript
// Before
<div className="-mx-6 px-6 py-8 border-b border-border/60">

// After
<div className="px-6 py-8 border-b border-border/40">

// Action bar
<div className="flex items-center bg-muted/40 border border-border/50 rounded-full px-1 py-1 h-9">
// Use Button group instead
```

### 2. Game Terminal (`/components/debug/game-terminal.tsx`)

**Issues to Fix:**
- Hardcoded slate-950, white colors - replace with design tokens
- Header styling - use Card component
- Color mapping for log levels - use semantic status colors

**Changes Needed:**
```typescript
// Replace all slate-950 with bg-background
// Replace white text with text-foreground
// Color map: red → destructive, yellow → warning, emerald → success, sky → primary
// Use Card with consistent styling
```

### 3. Community Chat (`/components/community/community-chat.tsx`)

**Issues to Fix:**
- Line 333-336: Tab buttons - create TabButton variant or use Button component
- Line 87-89: Leader badge - use `<Badge variant="warning" />`
- Line 44: Message spacing - extract to consistent pattern
- Line 462: Action button - use `<Button variant="default" size="sm" className="rounded-full"/>`
- Line 412-418: Input composer - use Card variant system
- Line 387-404: Command center - use `<Card variant="subtle" />`
- Line 439-442: Textarea - already has component, verify proper use

### 4. Community Pages (`/app/community/[slug]/page.tsx` & related)

**Issues to Fix:**
- Badge styling - use Badge component variants
- Empty state placeholders - use Card variant="subtle" or create EmptyState component

### 5. Training/Train Page (`/app/train/page.tsx`)

**Issues to Fix:**
- Line 41: Badge styling - already mostly correct, verify component usage

### 6. Other Components

- Map page: Minimal changes needed (data management focused)
- All remaining components: Verify they use new component variants

---

## 📋 IMPLEMENTATION CHECKLIST

### Phase 1: Core Pages (Required)
- [ ] Feed Page: Fix padding patterns and action bars
- [ ] Community Chat: Fix badges, tabs, input composer
- [ ] Game Terminal: Fix colors and styling

### Phase 2: Remaining Components
- [ ] Community Pages: Fix badge usage
- [ ] Train Page: Verify badge component
- [ ] All other components: Audit for hardcoded values

### Phase 3: Validation
- [ ] Test light mode colors
- [ ] Test dark mode colors
- [ ] Verify spacing is consistent across pages
- [ ] Check button sizes and variants
- [ ] Verify card styling consistency
- [ ] Test typography hierarchy
- [ ] Ensure no hardcoded pixel values for spacing

---

## 🎨 Design System Rules

### ALWAYS Use:
- `<Card variant="default|compact|subtle|elevated">` for containers
- `<Progress size="xs|sm|md|lg" color="primary|secondary|success|warning|destructive" />` for progress bars
- `<Badge variant="default|minimal|accent|success|warning|destructive" />` for tags/badges
- `<Button variant="default|destructive|outline|secondary|ghost|link" size="default|sm|lg|icon" />` for buttons
- `<Input size="sm|md|lg" />` for inputs
- `<Typography>` components: `H1`, `H2`, `H3`, `H4`, `Meta`, `Small`, `Label`, etc.
- Border color: `border-border/40` (default), `border-border/60` (emphasis), `border-border` (strong)
- Size utilities: `size-X` instead of `w-X h-X`

### NEVER:
- Hardcode padding values (use design tokens)
- Use custom card/button styling (use components)
- Mix color schemes (use semantic colors from tokens)
- Use inconsistent border radii (use rounded-lg as default)
- Inline className strings for complex components (extract to components)

---

## 🔄 Quick Reference: Component Replacements

| Old Pattern | New Pattern | Component |
|---|---|---|
| `<div className="bg-card border border-border rounded-2xl p-6">` | `<Card>` | Card |
| `<div className="h-2 w-full bg-muted rounded-full">` | `<Progress value={X} />` | Progress |
| `<span className="px-2 py-1 rounded text-xs bg-muted">` | `<Badge variant="default" />` | Badge |
| `<button className="h-9 px-4 bg-primary...">` | `<Button size="default" />` | Button |
| `<input className="h-10 px-3 border border-input...">` | `<Input size="md" />` | Input |
| `<h1 className="text-3xl font-extrabold...">` | `<H1>` | Typography |

---

## 📦 Files Modified

✅ Completed:
- `/lib/design-system.ts` (NEW)
- `/components/ui/button.tsx`
- `/components/ui/card.tsx`
- `/components/ui/badge.tsx`
- `/components/ui/progress.tsx`
- `/components/ui/input.tsx`
- `/components/ui/textarea.tsx`
- `/components/ui/label.tsx`
- `/components/ui/typography.tsx`
- `/components/ui/dialog.tsx`
- `/components/ui/sheet.tsx`
- `/app/profile/profile-view.tsx`

⏳ Pending:
- `/components/feed/feed-stream.tsx`
- `/components/debug/game-terminal.tsx`
- `/components/community/community-chat.tsx`
- `/app/community/[slug]/page.tsx` (and related)
- `/app/train/page.tsx` (minor fixes)
- All other components

---

## 🚀 Next Steps

1. **Feed Page**: Replace `-mx-6 px-6` patterns and action bars
2. **Game Terminal**: Replace hardcoded colors with design tokens
3. **Community Chat**: Fix badges, tabs, and input composer
4. **Final Audit**: Ensure all pages follow the new design system

See specific issues in each section above for line numbers and exact changes needed.
