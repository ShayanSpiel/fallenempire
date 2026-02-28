/**
 * ============================================================================
 * UNIFIED ICON REGISTRY
 * ============================================================================
 * Single source of truth for all icon definitions across the application
 * This consolidates icon definitions from multiple icon sources
 *
 * ICON TYPES:
 * 1. CURRENCY ICONS - SVG components (gold, community coins)
 * 2. COMPANY ICONS - Lucide React components
 * 3. RESOURCE ICONS - Lucide React components
 * 4. QUALITY TIER ICONS - Emoji strings (weapons, food)
 * 5. NOTIFICATION ICONS - Lucide React component names
 * 6. TRANSACTION ICONS - Lucide React component names
 */

import type { ComponentType } from "react";
import {
  Wheat,
  Mountain,
  Hammer,
  Droplet,
  Train,
  CookingPot,
  Building2,
  Apple,
  Box,
  Sword,
  Ticket,
  type LucideIcon,
} from "lucide-react";

// ============================================================================
// COMPANY ICONS
// ============================================================================
// Maps company types to their Lucide React icon components
// These are the official company type icons used throughout the app

export const COMPANY_ICONS: Record<string, LucideIcon> = {
  farm: Wheat,
  mine: Mountain,
  smithy: Hammer,
  oil_rig: Droplet,
  transit_station: Train,
  bakery: CookingPot,
} as const;

export function getCompanyIcon(companyKey: string): LucideIcon {
  return COMPANY_ICONS[companyKey] || Building2;
}

// ============================================================================
// RESOURCE ICONS
// ============================================================================
// Maps resource types to their Lucide React icon components
// Used in inventory, economy displays, and resource visualizations

export type ResourceIconName =
  | "wheat"
  | "mountain"
  | "droplet"
  | "apple"
  | "sword"
  | "ticket"
  | "box";

export const RESOURCE_ICONS: Record<
  ResourceIconName,
  ComponentType<{ className?: string }>
> = {
  wheat: Wheat,
  mountain: Mountain,
  droplet: Droplet,
  apple: Apple,
  sword: Sword,
  ticket: Ticket,
  box: Box,
} as const;

export function getResourceIconComponent(iconName?: string | null) {
  if (!iconName) {
    return RESOURCE_ICONS.box;
  }

  const normalized = iconName.trim().toLowerCase() as ResourceIconName;
  return RESOURCE_ICONS[normalized] ?? RESOURCE_ICONS.box;
}

// ============================================================================
// NOTIFICATION ICONS
// ============================================================================
// Maps notification types to Lucide React icon component names
// Used in notification system to display appropriate icons for different event types

export type NotificationType =
  | "DIRECT_MESSAGE"
  | "LAW_PROPOSAL"
  | "BATTLE_WON"
  | "REVOLUTION_STARTED"
  | "COMMUNITY_UPDATE"
  | "TRADE_COMPLETED"
  | "RESOURCE_DEPLETED"
  | "PRODUCTION_COMPLETE"
  | "MARKET_ALERT"
  | "DIPLOMACY_EVENT";

export const NOTIFICATION_ICONS: Record<NotificationType, string> = {
  DIRECT_MESSAGE: "Mail",
  LAW_PROPOSAL: "FileText",
  BATTLE_WON: "Trophy",
  REVOLUTION_STARTED: "Flame",
  COMMUNITY_UPDATE: "Building2",
  TRADE_COMPLETED: "ShoppingCart",
  RESOURCE_DEPLETED: "AlertTriangle",
  PRODUCTION_COMPLETE: "Check",
  MARKET_ALERT: "TrendingUp",
  DIPLOMACY_EVENT: "Users",
} as const;

export function getNotificationIcon(type: string): string {
  return NOTIFICATION_ICONS[type as NotificationType] || "Bell";
}

// ============================================================================
// TRANSACTION ICONS
// ============================================================================
// Maps transaction types to Lucide React icon component names
// Used in economy/market displays to show transaction types

export const TRANSACTION_ICONS: Record<string, string> = {
  transfer: "ArrowLeftRight",
  exchange: "Repeat",
  exchange_order_locked: "Lock",
  battle_cost: "Sword",
  wage_payment: "DollarSign",
  trade: "ShoppingCart",
  tax: "ReceiptText",
  production: "Zap",
  harvest: "Leaf",
  construction: "Hammer",
} as const;

export function getTransactionIcon(type: string): string {
  return TRANSACTION_ICONS[type] || "ArrowRight";
}

// ============================================================================
// ICON REGISTRY METADATA
// ============================================================================
// Documentation of all available icons and their usage

export const ICON_REGISTRY_DOCS = {
  currency: {
    description: "Currency icons (gold, community coins)",
    location: "/components/ui/coin-icon.tsx",
    icons: {
      gold: "GoldCoinIcon (SVG component)",
      community: "CommunityCoinIcon (SVG component)",
    },
  },
  company: {
    description: "Company/building type icons",
    location: "/lib/icons/registry.ts",
    icons: COMPANY_ICONS,
  },
  resource: {
    description: "Resource icons for inventory and displays",
    location: "/lib/icons/registry.ts",
    icons: RESOURCE_ICONS,
  },
  quality: {
    description: "Quality tier icons (weapons, food)",
    location: "/lib/design-system.ts",
    icons: {
      weapon: "🔫, 💥, 💣, 🚁 (emoji-based)",
      food: "🍞, 🥖, 🥐, 🥯, 🎂 (emoji-based)",
    },
  },
  notification: {
    description: "Notification type icons",
    location: "/lib/icons/registry.ts",
    icons: NOTIFICATION_ICONS,
  },
  transaction: {
    description: "Transaction type icons",
    location: "/lib/icons/registry.ts",
    icons: TRANSACTION_ICONS,
  },
} as const;
