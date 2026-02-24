"use client";

import React from "react";
import type { UserRole } from "@/lib/battle/types";
import { FightButtonStandard, type FightButtonProps } from "./fight-button-standard";
import { FightButtonAlly } from "./fight-button-ally";

/**
 * Button Factory - Creates the appropriate fight button based on user role
 * Supports: standard, ally, and future role types (mercenary, observer, etc.)
 */
export function createFightButton(role: UserRole): React.ComponentType<FightButtonProps> {
  switch (role) {
    case "ally":
      return FightButtonAlly;
    case "standard":
    default:
      return FightButtonStandard;
  }
}

// Export individual button components for direct use if needed
export { FightButtonStandard, FightButtonAlly };
export type { FightButtonProps };
