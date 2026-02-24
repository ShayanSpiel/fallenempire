# Landing Page & Registration Journey Setup

## Overview

This document describes the newly redesigned landing page and optimized registration journey for eIntelligence. The entire flow follows the design system, uses no hardcoding, and provides a premium game experience.

## Architecture

### Landing Page Components

The landing page is composed of modular, design-system-aware components:

#### 1. **Landing Hero** (`components/landing/landing-hero.tsx`)
- Eye-catching headline: "Rule the World With Strategy & AI"
- Dynamic background with decorative blur elements
- Immediate CTA for registration
- Three feature highlights (Dynamic World, AI & Human Players, Deep Strategy)
- Screenshot placeholder for the game world

**Key Features:**
- Gradient text using design system colors
- Responsive eyebrow badge with icon
- Auth modal integration with query parameter support
- Mobile-optimized layout

#### 2. **Landing Features** (`components/landing/landing-features.tsx`)
- 6-card grid showcasing core game features:
  - Build Empires
  - Create Laws & Governance
  - Ideology & Culture
  - Wage Strategic Battles
  - Progress & Achievements
  - Compete & Collaborate

**Design:**
- Hover effects with border and background transitions
- Color-coded icons using primary and secondary colors
- 3-column grid on desktop, responsive on mobile
- Screenshot placeholder at bottom

#### 3. **Landing Game Mechanics** (`components/landing/landing-game-mechanics.tsx`)
- Deep dive into 5 core mechanics:
  1. 5-Dimensional Ideology System
  2. Legislative System
  3. Tactical Warfare
  4. Progression & Mastery
  5. Dynamic Communities

**Features:**
- Numbered cards with elevated styling
- Bullet-point benefits for each mechanic
- AI-powered differentiation section
- Grid layout optimized for visual hierarchy

#### 4. **Landing CTA** (`components/landing/landing-cta.tsx`)
- Social proof with testimonials
- Main call-to-action card
- Benefit checklist (5 key benefits)
- Secondary engagement section

**Elements:**
- 2-column testimonial cards
- Checkmark-based benefits list
- Gradient card design
- Player count social proof

#### 5. **Landing Footer** (`components/landing/landing-footer.tsx`)
- 4-column footer with navigation
- Game, Resources, Legal sections
- Social media buttons
- Copyright and company info

### Design System Integration

All components use **zero hardcoding** and rely entirely on design tokens:

```typescript
// Colors used
- Primary: #facc15 (amber/gold)
- Secondary: #f59e0b (orange)
- Background: #fff9f0 (warm cream)
- Foreground: #2c1f10 (dark brown)
- Muted: #ffeecc (light muted)

// Spacing
- All padding/gaps from design-system scale (xs, sm, md, lg, xl, 2xl, 3xl)

// Typography
- Font: Oxanium (brand font)
- Sizes: displayLg, displayMd, displaySm, headingLg/Md/Sm, bodyLg/Md/Sm

// Components
- Uses shadcn/ui Card, Button, Badge variants
- All styling via CSS variables and Tailwind utilities
```

## Registration & Auth Journey

### Auth Modal Improvements

**File:** `components/auth/auth-tabs.tsx`

**Enhancements:**
- Dynamic titles based on active tab ("Welcome Back, Leader" vs "Claim Your Territory")
- Contextual descriptions that match the game theme
- Improved visual hierarchy with icons in tabs
- Better dialog sizing and spacing

### Auth Form Enhancements

**File:** `components/auth/auth-form.tsx`

**Features:**
- Input-specific placeholders referencing the game
- Helper text for each field (password requirements, email privacy, username rules)
- Visual validation feedback:
  - Error alerts with icon and red styling
  - Success messages with checkmark icon
- Username validation with pattern: `^[a-zA-Z0-9_-]+$`
- Better typography with emphasized labels
- Tab switching prompt at bottom
- Focus states with primary color ring

**Validation:**
- Username: 3-32 characters, alphanumeric + underscores/hyphens
- Email: Standard email validation
- Password: Minimum 6 characters
- Client-side validation messages before submission

### Onboarding Flow (Post-Registration)

**Entry Point:** After successful registration, users see the onboarding flow

#### 1. **Onboarding Flow Component** (`components/onboarding/onboarding-flow.tsx`)

Three-step setup process:

1. **Welcome Step**
   - Explanation of what's to come
   - List of customizations (Ideology + Nation)
   - Helpful tips about ideology system
   - Single CTA to begin

2. **Ideology Selector Step** (`components/onboarding/ideology-selector.tsx`)
   - 5 interactive sliders for ideology dimensions:
     - Order vs Chaos
     - Self vs Community
     - Logic vs Emotion
     - Power vs Harmony
     - Tradition vs Innovation
   - Visual progress bar (step N of 5)
   - Real-time value display with color coding
   - Previous/Next navigation
   - Reset button to start over
   - Descriptions for each dimension
   - Slider-specific left/right labels

   **Design:**
   - Smooth slider interaction
   - Gradient progress bar
   - Color-coded value badges
   - Clear navigation flow

3. **Nation Setup Step** (`components/onboarding/nation-setup.tsx`)
   - Nation name input (3-50 characters)
   - Color picker with 8 presets:
     - Imperial Gold, Sovereign Red, Royal Blue, Emerald Green
     - Purple Majesty, Orange Fire, Crimson, Cyan
   - Custom color input (hex or color picker)
   - Live preview of name + color combination
   - Character count display
   - Helper text for customization later

   **Features:**
   - Visual color swatches with hover tooltips
   - Hex color input for advanced users
   - Preview card showing nation appearance
   - Validation error display
   - Optional setup note

## User Flow

### Landing → Registration → Onboarding → Game

1. **User lands on homepage** (`/`)
   - Sees hero section with "Rule the World" headline
   - Can scroll through features and mechanics
   - Clicks "Get Started" or "Enter the Game" button

2. **Auth Modal Opens** (via AuthTabs component)
   - Defaults to login tab
   - Can switch to register
   - Uses design-system-aware form components

3. **Registration Successful** (server-side redirect)
   - User redirected to onboarding flow (needs new route implementation)
   - OR auto-redirected to `/feed` (existing behavior)

4. **Optional Onboarding** (if implemented)
   - Welcome screen
   - Ideology setup (5 sliders)
   - Nation name + color customization
   - Returns to game with profile complete

5. **Game Access**
   - User enters main `/feed`
   - Can access map, battles, community
   - Ideology and nation info visible in profile

## Color Customization

All colors are defined in `/app/globals.css` as CSS variables:

```css
:root {
  --primary: #facc15;
  --secondary: #f59e0b;
  --background: #fff9f0;
  --foreground: #2c1f10;
  --success: #10b981;
  --destructive: #dc2626;
  /* ... etc */
}

.dark {
  --primary: #38bdf8;
  --secondary: #38bdf8;
  --background: #030b1f;
  --foreground: #dbeafe;
  /* ... etc */
}
```

**To customize:** Edit these variables and all components automatically update.

## Content Placeholders

All image/screenshot sections use semantic placeholders:

```jsx
<div className="aspect-video flex items-center justify-center rounded-lg border border-border bg-muted/50">
  <div className="text-center">
    <Globe className="mx-auto mb-3 h-12 w-12 text-muted-foreground opacity-50" />
    <p className="text-sm text-muted-foreground">
      [Game screenshot: Hex map with nations, territories, and strategic elements]
    </p>
  </div>
</div>
```

**To add real images:**
1. Replace placeholder divs with `<Image>` components
2. Import images from `/public`
3. Maintain existing className for sizing

## Navigation & Routing

### Current Routes

- `/` - Landing page (public)
- `/api/auth/*` - Auth API (handled by Supabase)
- `/feed` - Main game (authenticated)
- `/profile/*` - User profiles (authenticated)
- `/map` - World map (authenticated)
- `/battles` - Battle browser (authenticated)
- `/community/*` - Community features (authenticated)

### Recommended New Routes

- `/onboarding` - Post-registration setup flow (authenticated, first-time only)
- `/welcome` - Welcome screen before onboarding (optional)

## Query Parameters

The auth modal supports query parameters for linking:

```
/?auth=open - Opens auth modal
/?auth=open&tab=register - Opens registration tab
/?auth=open&tab=login - Opens login tab
/?auth=open&next=/feed - Redirect after auth
```

## Implementation Status

### ✅ Completed

- Landing page with 5 modular components
- Improved auth modal with game-themed messaging
- Enhanced auth form with validation and error handling
- Ideology selector with 5-slider interface
- Nation setup with name + color customization
- Onboarding flow component wrapper
- Design system integration (zero hardcoding)
- Footer with navigation
- Responsive mobile design
- Dark mode support

### ⏳ To Implement

1. **Route Setup**
   - Create `/onboarding` route
   - Add first-time user detection
   - Implement post-onboarding redirect to game

2. **Backend Integration**
   - Connect onboarding to user creation
   - Save ideology values to `identity_json`
   - Save nation data to `communities` table
   - Create default community for user

3. **Features**
   - Email verification flow
   - Password reset
   - Social login options
   - Marketing consent/newsletter signup

4. **Analytics**
   - Track landing page views
   - Track registration completion rate
   - Track onboarding completion
   - Track feature interest (scroll depth)

5. **Polish**
   - Add real screenshots/videos
   - Smooth animations between onboarding steps
   - Success screen after nation creation
   - Confetti/celebration animation

## Styling Reference

### Card Variants (from design system)

```typescript
// Used throughout landing page
Card variant="elevated" - Main content cards
Card variant="subtle" - Secondary information
Card variant="default" - Basic containers
```

### Button States

```typescript
Button type="submit" - Primary action
Button variant="outline" - Secondary actions
Button variant="ghost" - Tertiary links
```

### Responsive Breakpoints

- Mobile: < 640px (sm)
- Tablet: 640px - 1024px (lg)
- Desktop: > 1024px

All components use `sm:`, `lg:` prefixes for responsive classes.

## Accessibility

- Semantic HTML structure
- Form labels linked to inputs via `htmlFor`
- ARIA-appropriate color messaging (not relying on color alone)
- Keyboard navigation support
- Focus states visible (ring-primary)
- Alt text for icons using `title` attributes

## Performance

- Zero inline styles
- CSS variables for theming (no JS overhead)
- Optimized images with placeholders
- Lazy-loaded components via Next.js
- No unnecessary client-side hydration

## Future Enhancements

1. **Animated Hero Section**
   - Parallax scrolling effects
   - Animated SVG elements
   - Scroll-triggered animations

2. **Advanced Ideology Visualization**
   - 2D/3D ideology space visualization
   - Comparison with other players
   - Dynamic recommendations based on slider values

3. **Social Features**
   - Share ideology results
   - Show nation preview to friends
   - Referral links

4. **Localization**
   - Multi-language support
   - RTL language handling
   - Localized ideology descriptions

## Maintenance Notes

- **Design Changes:** Update `/app/globals.css` CSS variables
- **Content Changes:** Edit individual landing component files
- **Component Updates:** Sync with shadcn/ui `components.json` config
- **Typography:** Reference design-system.ts for font scales
- **Colors:** Use semantic names (primary, secondary, success, destructive)
