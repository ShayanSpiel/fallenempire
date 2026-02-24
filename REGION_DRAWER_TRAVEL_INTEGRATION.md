# Region Drawer Travel Integration Instructions

## File: `components/map/region-drawer.tsx`

### Step 1: Add imports at the top
Add this import after the existing lucide-react imports:

```typescript
import { TravelButton } from "@/components/map/travel-button";
```

### Step 2: Update the Props type (around line 83-97)
Add these three new properties to the `Props` type:

```typescript
type Props = {
  // ... existing props ...
  resourceBonus?: HexResourceBonus | null;
  onTravel?: (hexId: string) => Promise<void>;  // ADD THIS
  userCurrentHex?: string | null;               // ADD THIS
  userTicketCount?: number;                     // ADD THIS
};
```

### Step 3: Update the component function parameters (around line 136-150)
Add the new props to the function destructuring:

```typescript
export default memo(function RegionDrawer({
  // ... existing parameters ...
  resourceBonus = null,
  onTravel,           // ADD THIS
  userCurrentHex = null,    // ADD THIS
  userTicketCount = 0,      // ADD THIS
}: Props) {
```

### Step 4: Add Travel Button to Home Tab
In the `TabsContent value="home"` section (around line 434), add the TravelButton component at the very top, right after `<TabsContent value="home" className="flex-1 overflow-y-auto mt-4 space-y-4">`:

```typescript
<TabsContent value="home" className="flex-1 overflow-y-auto mt-4 space-y-4">
  {/* Travel Button - ADD THIS ENTIRE BLOCK */}
  {onTravel && hex && (
    <TravelButton
      hexId={hex.id}
      hexName={hex.region.customName?.trim() || hex.provinceName?.trim() || hex.id}
      userCurrentHex={userCurrentHex}
      userTicketCount={userTicketCount}
      onTravel={onTravel}
    />
  )}

  {/* Existing battle cards below */}
  {isBattleActive && (
    <Card
      variant="default"
      ...
```

This will add the travel functionality to the top of the home tab in the region drawer.
