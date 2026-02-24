/**
 * Shared types for Market components
 */

import type { MarketListing } from "@/app/actions/market";

// ============================================================================
// COMMON PROPS
// ============================================================================

export interface BaseTabProps {
  selectedCommunities: string[];
}

// ============================================================================
// RESOURCES & QUALITIES
// ============================================================================

export interface Resource {
  id: string;
  key: string;
  name: string;
  category: string;
  icon_name?: string | null;
}

export interface Quality {
  id: string;
  key: string;
  name: string;
  quality_level: number;
}

// ============================================================================
// COMMUNITY
// ============================================================================

export interface Community {
  id: string;
  name: string;
  slug: string;
  color?: string | null;
}

// ============================================================================
// RE-EXPORT MARKET LISTING
// ============================================================================

export type { MarketListing };
