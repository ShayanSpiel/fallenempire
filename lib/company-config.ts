// ============================================================================
// STATIC COMPANY CONFIGURATION
// ============================================================================
// Company types are config data, NOT database dependent
// Only the user's actual companies are loaded from database

import {
  Wheat,
  Mountain,
  Hammer,
  Droplet,
  Train,
  CookingPot,
  Building2,
  type LucideIcon,
} from "lucide-react";

export interface StaticCompanyType {
  key: string;
  name: string;
  description: string;
  build_cost_gold: number;
  build_cost_resources: Record<string, number>;
  icon: LucideIcon;
  pollution_per_work: number;
  max_level: number;
}

export type CompanyCategory = "raw_material" | "production";

export const COMPANY_TYPES: (StaticCompanyType & { category: CompanyCategory })[] = [
  // RAW MATERIALS (Extraction)
  {
    key: "farm",
    name: "Grain Farm",
    category: "raw_material",
    description: "Extract grain from fertile farmland.",
    build_cost_gold: 10,
    build_cost_resources: {},
    icon: Wheat,
    pollution_per_work: 1,
    max_level: 5,
  },
  {
    key: "mine",
    name: "Iron Mine",
    category: "raw_material",
    description: "Extract iron ore from underground deposits.",
    build_cost_gold: 15,
    build_cost_resources: {},
    icon: Mountain,
    pollution_per_work: 3,
    max_level: 5,
  },
  {
    key: "oil_rig",
    name: "Oil Drill",
    category: "raw_material",
    description: "Extract crude oil from petroleum reservoirs.",
    build_cost_gold: 25,
    build_cost_resources: {},
    icon: Droplet,
    pollution_per_work: 5,
    max_level: 3,
  },

  // PRODUCTION (Processing)
  {
    key: "bakery",
    name: "Bakery",
    category: "production",
    description: "Process grain into food rations.",
    build_cost_gold: 10,
    build_cost_resources: {
      grain: 10,
    },
    icon: CookingPot,
    pollution_per_work: 1,
    max_level: 5,
  },
  {
    key: "smithy",
    name: "Weapon Factory",
    category: "production",
    description: "Forge weapons from iron ore.",
    build_cost_gold: 15,
    build_cost_resources: {
      iron: 10,
    },
    icon: Hammer,
    pollution_per_work: 2,
    max_level: 5,
  },
  {
    key: "transit_station",
    name: "Logistics Hub",
    category: "production",
    description: "Convert oil into travel tickets for movement.",
    build_cost_gold: 15,
    build_cost_resources: {
      oil: 5,
    },
    icon: Train,
    pollution_per_work: 1,
    max_level: 5,
  },
];

export const RAW_MATERIAL_TYPES = COMPANY_TYPES.filter(t => t.category === "raw_material");
export const PRODUCTION_TYPES = COMPANY_TYPES.filter(t => t.category === "production");

export function getCompanyTypeByKey(key: string): StaticCompanyType | undefined {
  return COMPANY_TYPES.find((t) => t.key === key);
}

export function getCompanyIcon(key: string): LucideIcon {
  return getCompanyTypeByKey(key)?.icon || Building2;
}
