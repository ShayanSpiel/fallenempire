// ============================================================================
// COMPANIES & PRODUCTION CONFIG
// ============================================================================
// Zero hardcoding - all company types and recipes driven by config
// Matches database seed data exactly
// ============================================================================

export const COMPANY_ICONS: Record<string, string> = {
  farm: 'wheat',
  mine: 'mountain',
  smithy: 'hammer',
  oil_rig: 'droplet',
  transit_station: 'train',
} as const;

export const COMPANY_TYPES_CONFIG = {
  FARM: {
    key: 'farm',
    name: 'Farm',
    description: 'Agricultural facility for growing and processing grain. Can harvest grain from fertile land and bake it into food.',
    build_cost_gold: 100,
    build_cost_resources: {},
    recipes: ['harvest_grain', 'bake_bread'],
    icon: 'wheat',
    metadata: {
      pollution_per_work: 1,
      upgradeable: true,
      max_level: 5,
    },
  },
  MINE: {
    key: 'mine',
    name: 'Mine',
    description: 'Underground facility for extracting iron ore from mineral-rich regions.',
    build_cost_gold: 150,
    build_cost_resources: {},
    recipes: ['mine_iron'],
    icon: 'mountain',
    metadata: {
      pollution_per_work: 3,
      upgradeable: true,
      max_level: 5,
    },
  },
  SMITHY: {
    key: 'smithy',
    name: 'Smithy',
    description: 'Forge facility for crafting weapons from iron ore. Requires pre-existing iron supply.',
    build_cost_gold: 200,
    build_cost_resources: {
      iron: 10, // Will be resolved to resource_id in server action
    },
    recipes: ['forge_weapon'],
    icon: 'hammer',
    metadata: {
      pollution_per_work: 2,
      upgradeable: true,
      max_level: 5,
    },
  },
  OIL_RIG: {
    key: 'oil_rig',
    name: 'Oil Rig',
    description: 'Drilling facility for extracting crude oil from petroleum deposits. Highly valuable but environmentally costly.',
    build_cost_gold: 300,
    build_cost_resources: {},
    recipes: ['drill_oil'],
    icon: 'droplet',
    metadata: {
      pollution_per_work: 5,
      upgradeable: true,
      max_level: 3,
    },
  },
  TRANSIT_STATION: {
    key: 'transit_station',
    name: 'Transit Station',
    description: 'Service facility for converting oil into travel tickets. Enables inter-community commerce and migration.',
    build_cost_gold: 250,
    build_cost_resources: {
      oil: 5, // Will be resolved to resource_id in server action
    },
    recipes: ['issue_ticket'],
    icon: 'train',
    metadata: {
      pollution_per_work: 1,
      upgradeable: true,
      max_level: 5,
    },
  },
} as const;

export const RECIPES_CONFIG = {
  HARVEST_GRAIN: {
    key: 'harvest_grain',
    name: 'Harvest Grain',
    description: 'Extract grain from farmland. No materials required, depends on hex fertility.',
    inputs: {},
    outputs: {
      grain: {
        base_quantity: 1,
        quality_level: 1,
      },
    },
    time_cost_work_days: 1,
    metadata: {
      category: 'harvesting',
      skill_requirement: null,
    },
  },
  MINE_IRON: {
    key: 'mine_iron',
    name: 'Mine Iron Ore',
    description: 'Extract iron ore from mineral deposits. No materials required, depends on hex geology.',
    inputs: {},
    outputs: {
      iron: {
        base_quantity: 1,
        quality_level: 1,
      },
    },
    time_cost_work_days: 1,
    metadata: {
      category: 'mining',
      skill_requirement: null,
    },
  },
  DRILL_OIL: {
    key: 'drill_oil',
    name: 'Drill for Oil',
    description: 'Extract crude oil from underground reservoirs. No materials required, depends on hex petroleum deposits.',
    inputs: {},
    outputs: {
      oil: {
        base_quantity: 1,
        quality_level: 1,
      },
    },
    time_cost_work_days: 1,
    metadata: {
      category: 'extraction',
      skill_requirement: null,
    },
  },
  BAKE_BREAD: {
    key: 'bake_bread',
    name: 'Bake Bread',
    description: 'Process grain into consumable food. Requires 10 grain to produce 1 food ration.',
    inputs: {
      grain: 10,
    },
    outputs: {
      food: {
        base_quantity: 1,
        quality_level: 1,
      },
    },
    time_cost_work_days: 1,
    metadata: {
      category: 'processing',
      skill_requirement: null,
    },
  },
  FORGE_WEAPON: {
    key: 'forge_weapon',
    name: 'Forge Weapon',
    description: 'Smelt iron ore into combat weapons. Requires 10 iron to produce 1 weapon.',
    inputs: {
      iron: 10,
    },
    outputs: {
      weapon: {
        base_quantity: 1,
        quality_level: 1,
      },
    },
    time_cost_work_days: 1,
    metadata: {
      category: 'smithing',
      skill_requirement: null,
    },
  },
  ISSUE_TICKET: {
    key: 'issue_ticket',
    name: 'Issue Travel Ticket',
    description: 'Convert oil into travel tickets for inter-community movement. Requires 1 oil per ticket.',
    inputs: {
      oil: 1,
    },
    outputs: {
      ticket: {
        base_quantity: 1,
        quality_level: 1,
      },
    },
    time_cost_work_days: 1,
    metadata: {
      category: 'services',
      skill_requirement: null,
    },
  },
} as const;

// Helper functions

export function getCompanyTypeByKey(key: string) {
  return Object.values(COMPANY_TYPES_CONFIG).find((type) => type.key === key);
}

export function getRecipeByKey(key: string) {
  return Object.values(RECIPES_CONFIG).find((recipe) => recipe.key === key);
}

export function getCompanyIcon(companyTypeKey: string): string {
  return COMPANY_ICONS[companyTypeKey] || 'building';
}

export function canAffordCompany(
  companyTypeKey: string,
  userGold: number,
  userInventory: Record<string, number>
): {
  can_afford: boolean;
  missing_gold?: number;
  missing_resources?: Array<{ resource_key: string; needed: number; have: number }>;
} {
  const companyType = getCompanyTypeByKey(companyTypeKey);
  if (!companyType) {
    return { can_afford: false };
  }

  const missing_resources: Array<{ resource_key: string; needed: number; have: number }> = [];
  let missing_gold = 0;

  // Check gold
  if (userGold < companyType.build_cost_gold) {
    missing_gold = companyType.build_cost_gold - userGold;
  }

  // Check resources
  for (const [resourceKey, needed] of Object.entries(companyType.build_cost_resources)) {
    const have = userInventory[resourceKey] || 0;
    if (have < needed) {
      missing_resources.push({
        resource_key: resourceKey,
        needed,
        have,
      });
    }
  }

  const can_afford = missing_gold === 0 && missing_resources.length === 0;

  return {
    can_afford,
    ...(missing_gold > 0 && { missing_gold }),
    ...(missing_resources.length > 0 && { missing_resources }),
  };
}

export function canPerformRecipe(
  recipeKey: string,
  userInventory: Record<string, number>
): {
  can_perform: boolean;
  missing_resources?: Array<{ resource_key: string; needed: number; have: number }>;
} {
  const recipe = getRecipeByKey(recipeKey);
  if (!recipe) {
    return { can_perform: false };
  }

  const missing_resources: Array<{ resource_key: string; needed: number; have: number }> = [];

  for (const [resourceKey, needed] of Object.entries(recipe.inputs)) {
    const have = userInventory[resourceKey] || 0;
    if (have < needed) {
      missing_resources.push({
        resource_key: resourceKey,
        needed,
        have,
      });
    }
  }

  const can_perform = missing_resources.length === 0;

  return {
    can_perform,
    ...(missing_resources.length > 0 && { missing_resources }),
  };
}
