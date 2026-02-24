# UI/UX Consistency Standardization Checklist

## ✅ COMPLETED: Core Design System

### Design Tokens Updated
- Border radius: `rounded-xi` (16px) for inputs/dialogs, `rounded-2xl` (24px) for cards, `rounded-full` for badges
- All component radii increased for rounder aesthetic
- Font sizes: Buttons now have explicit `text-sm` for smaller button text

### Components Standardized
- ✅ Button: `rounded-xl`, `text-sm`, all variants working
- ✅ Card: `rounded-2xl` with variants (default, compact, subtle, elevated)
- ✅ Badge: `rounded-full` (pill shape), all status variants
- ✅ Input: `rounded-xl`
- ✅ Textarea: `rounded-xl`
- ✅ Dialog: `rounded-2xl`
- ✅ Sheet: `rounded-2xl` with side variants
- ✅ Progress: `rounded-full`, size/color variants
- ✅ Typography: H1-H4, Meta, Small components

---

## ⏳ TODO: Ensure ALL Pages Use This System

### Golden Rule
**NEVER write hardcoded styling. ALWAYS use components or design tokens.**

### Page-by-Page Fixes Needed

#### 1. Feed Page (`/app/feed/page.tsx` + `/components/feed/feed-stream.tsx`)
- [ ] Replace `-mx-6 px-6` with consistent Card/Section
- [ ] Action bars: Use `<Button>` group instead of hardcoded h-9
- [ ] Toasts: Use consistent Card variant styling
- [ ] Avatar sizing: Use consistent Avatar size tokens

**Current Issues:**
```
- Hardcoded padding patterns: `-mx-6 px-6`
- Inline button styling instead of <Button>
- Custom toast styling
```

**Fix Pattern:**
```tsx
// BEFORE (BAD)
<div className="-mx-6 px-6 border-b border-border/60">...</div>
<div className="bg-muted/40 border rounded-full h-9 px-1 py-1">button</div>

// AFTER (GOOD)
<Card variant="default">...</Card>
<Button size="sm" variant="ghost">Click me</Button>
```

---

#### 2. Community Chat (`/components/community/community-chat.tsx`)
- [ ] Tab buttons: Use `<Button>` component
- [ ] Leader badge: Use `<Badge variant="warning" />`
- [ ] Message spacing: Use consistent gap patterns
- [ ] Input composer: Use Card variant system
- [ ] Command center: Use `<Card variant="subtle" />`

**Current Issues:**
- Custom tab button styling with hardcoded colors
- Leader badge: hardcoded colors instead of Badge component
- Message item: `-mx-6 px-6` padding pattern
- Input composer: inline styling instead of Card

**Fix Pattern:**
```tsx
// Tab buttons
<Button variant={isActive ? "default" : "ghost"}>Tab</Button>

// Leader badge
<Badge variant="warning">Leader</Badge>

// Command center
<Card variant="subtle">Commands</Card>
```

---

#### 3. Community Details (`/app/community/[slug]/page.tsx` + related)
- [ ] Community cards: Use `<Card>` variants
- [ ] Tags/ideology badges: Use `<Badge>` component
- [ ] Stats: Use consistent styling

---

#### 4. Train Page (`/app/train/page.tsx`)
- [ ] Badges: Ensure using `<Badge>` component
- [ ] Buttons: Ensure using `<Button>` component

---

#### 5. Map Page (`/app/map/page.tsx`)
- [ ] Drawer components: Use `<Sheet>` component
- [ ] Buttons: Use `<Button>` component
- [ ] Cards: Use `<Card>` component

---

#### 6. All Other Pages & Components
- [ ] Search for all hardcoded styling patterns
- [ ] Replace with design system components
- [ ] Remove inline `className` styling for complex components
- [ ] Use semantic spacing from tokens

---

## 🔍 Search Patterns for Hardcoded Styling

Run these searches to find violations:

```bash
# Hardcoded borders (should be border-border or border-border/40)
grep -r "border-\(white\|slate\|gray\|red\|blue\)" --include="*.tsx"

# Hardcoded colors in text (should use text-foreground, text-muted-foreground, etc)
grep -r "text-\(white\|slate\|gray\|red\|blue\)-" --include="*.tsx"

# Hardcoded card styling (should use <Card>)
grep -r "bg-card.*border.*rounded" --include="*.tsx"

# Hardcoded button styling (should use <Button>)
grep -r "bg-primary.*text-primary-foreground" --include="*.tsx"

# Hardcoded padding patterns (should use design tokens)
grep -r "\-mx-\|px-\(3\|6\|8\)" --include="*.tsx"
```

---

## ✨ Component Usage Reference

### Buttons
```tsx
<Button variant="default" size="default">Primary</Button>
<Button variant="secondary">Secondary</Button>
<Button variant="outline">Outline</Button>
<Button variant="ghost">Ghost</Button>
<Button variant="destructive">Delete</Button>
<Button variant="link">Link</Button>
<Button size="sm">Small</Button>
<Button size="lg">Large</Button>
<Button size="icon">Icon</Button>
```

### Cards
```tsx
<Card>Default card</Card>
<Card variant="compact">Compact card</Card>
<Card variant="subtle">Subtle card</Card>
<Card variant="elevated">Elevated card</Card>

// With structure
<Card>
  <CardHeader>
    <CardTitle>Title</CardTitle>
  </CardHeader>
  <CardContent>Content</CardContent>
  <CardFooter>Footer</CardFooter>
</Card>
```

### Badges
```tsx
<Badge>Default</Badge>
<Badge variant="minimal">Minimal</Badge>
<Badge variant="accent">Accent</Badge>
<Badge variant="success">Success</Badge>
<Badge variant="warning">Warning</Badge>
<Badge variant="destructive">Error</Badge>
```

### Typography
```tsx
<H1>Page Title</H1>
<H2>Section Title</H2>
<H3>Subsection</H3>
<Meta>Small label text</Meta>
<Small>Footnote</Small>
<Label>Form label</Label>
```

### Forms
```tsx
<Input placeholder="Type here" />
<Input size="sm">Small input</Input>
<Input size="lg">Large input</Input>
<Textarea />
<Label>Label text</Label>
```

### Dialogs & Drawers
```tsx
<Dialog open={isOpen} onOpenChange={setIsOpen}>
  <DialogTrigger>Open</DialogTrigger>
  <DialogContent>
    <DialogTitle>Title</DialogTitle>
    <DialogDescription>Description</DialogDescription>
  </DialogContent>
</Dialog>

<Sheet open={isOpen} onOpenChange={setIsOpen}>
  <SheetTrigger>Open Drawer</SheetTrigger>
  <SheetContent side="right">
    <SheetTitle>Title</SheetTitle>
  </SheetContent>
</Sheet>
```

---

## 📐 Spacing & Layout

### Always Use These
```tsx
// Gap between items
gap-1 gap-2 gap-3 gap-4 gap-6 gap-8

// Padding (use Card or built-in)
<Card> // Has p-6 by default

// Don't use hardcoded px-6 outside of components
```

### Border Colors
```tsx
border-border        // Full strength border
border-border/40     // Subtle border (default for cards)
border-border/60     // Emphasis border
border-border/20     // Very subtle
```

### Text Colors
```tsx
text-foreground           // Primary text
text-muted-foreground     // Secondary text
text-muted-foreground/70  // Tertiary text
```

---

## 🛠️ Implementation Steps

1. **Identify**: Find file with hardcoded styling
2. **Replace**: Use design system component
3. **Verify**: Check that styling matches intended design
4. **Test**: Ensure dark mode works correctly

---

## Final Checklist Before Build

- [ ] All `<button>` replaced with `<Button>`
- [ ] All `<div className="...card-like...">` replaced with `<Card>`
- [ ] All inline input styling replaced with `<Input>`
- [ ] All badge/tag styling replaced with `<Badge>`
- [ ] All hardcoded border colors use `border-border` or variants
- [ ] All text colors use semantic tokens
- [ ] No hardcoded colors like `text-red-400`, `bg-slate-950`, etc.
- [ ] Button text is consistently `text-sm` (smaller)
- [ ] Borders are rounder: `rounded-xl` (inputs), `rounded-2xl` (cards), `rounded-full` (badges)
- [ ] No `-mx-6 px-6` padding patterns (use Cards instead)
- [ ] Battle page & Navigation excluded from changes ✅
- [ ] Build passes TypeScript ✅
- [ ] All pages look consistent ✅
