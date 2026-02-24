import {
  Apple,
  Box,
  Droplet,
  Mountain,
  Sword,
  Ticket,
  Wheat,
} from "lucide-react";
import type { ComponentType } from "react";

export type ResourceIconName =
  | "wheat"
  | "mountain"
  | "droplet"
  | "apple"
  | "sword"
  | "ticket"
  | "box";

export const RESOURCE_ICON_COMPONENTS: Record<
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
};

export function getResourceIconComponent(iconName?: string | null) {
  if (!iconName) {
    return RESOURCE_ICON_COMPONENTS.box;
  }

  const normalized = iconName.trim().toLowerCase() as ResourceIconName;
  return RESOURCE_ICON_COMPONENTS[normalized] ?? RESOURCE_ICON_COMPONENTS.box;
}
