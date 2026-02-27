/**
 * Region Display Name Utilities
 *
 * SINGLE SOURCE OF TRUTH for region name display logic.
 *
 * After migration 20270227_add_display_name_to_world_regions,
 * prefer querying `display_name` from world_regions which is
 * ALWAYS non-null and computed server-side.
 *
 * This utility is for cases where you only have custom_name/province_name
 * and need to compute the display name client-side.
 */

export interface RegionNameData {
  hex_id: string;
  custom_name?: string | null;
  province_name?: string | null;
  display_name?: string | null; // Preferred - server-computed
}

/**
 * Get the display name for a region.
 *
 * Preference order:
 * 1. display_name (if available from database)
 * 2. custom_name
 * 3. province_name
 * 4. "Region {hex_id}" fallback
 *
 * @param region - Region data with optional name fields
 * @returns Display name string (never null/empty)
 */
export function getRegionDisplayName(region: RegionNameData): string {
  // Prefer server-computed display_name
  const displayName = region.display_name?.trim();
  if (displayName) return displayName;

  // Fallback to client-side computation (for backward compatibility)
  const customName = region.custom_name?.trim();
  if (customName) return customName;

  const provinceName = region.province_name?.trim();
  if (provinceName) return provinceName;

  // Final fallback
  return `Region ${region.hex_id}`;
}

/**
 * Get the display name for a region, with hex ID fallback format
 * using "#" prefix instead of "Region" prefix.
 *
 * @param region - Region data with optional name fields
 * @returns Display name string with # prefix for hex fallback
 */
export function getRegionDisplayNameWithHashFallback(region: RegionNameData): string {
  const displayName = region.display_name?.trim();
  if (displayName && !displayName.startsWith('Region ')) return displayName;

  const customName = region.custom_name?.trim();
  if (customName) return customName;

  const provinceName = region.province_name?.trim();
  if (provinceName) return provinceName;

  return `#${region.hex_id}`;
}

/**
 * Format region name for display with optional community owner
 */
export function formatRegionWithOwner(
  region: RegionNameData,
  ownerName?: string | null
): string {
  const regionName = getRegionDisplayName(region);
  if (!ownerName) return regionName;
  return `${regionName} (${ownerName})`;
}
