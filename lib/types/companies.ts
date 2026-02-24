// ============================================================================
// COMPANY TYPES - Zero Hardcoding, Fully Config-Driven
// ============================================================================

export interface CompanyType {
  id: string;
  key: string;
  name: string;
  description: string | null;
  build_cost_gold: number;
  build_cost_resources: Record<string, number>; // {resource_id: quantity}
  can_produce_recipes: string[]; // recipe_ids
  icon: string;
  metadata: {
    pollution_per_work?: number;
    upgradeable?: boolean;
    max_level?: number;
    [key: string]: any;
  };
  created_at: string;
}

export interface ProductionRecipe {
  id: string;
  key: string;
  name: string;
  description: string | null;
  inputs: Record<string, number>; // {resource_id: quantity}
  outputs: Record<
    string,
    {
      base_quantity: number;
      quality_level: number;
    }
  >; // {resource_id: {base_quantity, quality_level}}
  time_cost_work_days: number;
  metadata: {
    category?: string;
    skill_requirement?: string | null;
    [key: string]: any;
  };
  created_at: string;
}

export interface Company {
  id: string;
  owner_id: string;
  company_type_id: string;
  hex_id: string;
  name: string;
  level: number;
  health: number;
  community_id: string | null;
  output_destination: "founder" | "community";
  metadata: {
    pollution_level?: number;
    build_progress_days?: number;
    build_complete?: boolean;
    [key: string]: any;
  };
  created_at: string;
  updated_at: string;
}

export interface EmploymentContract {
  id: string;
  company_id: string;
  employee_id: string;
  wage_per_day_community_coin: number;
  community_coin_type: string | null;
  position: string;
  hired_at: string;
  last_worked_at: string | null;
  total_work_days: number;
  active: boolean;
}

export interface WorkHistory {
  id: string;
  user_id: string;
  company_id: string;
  work_type: "manager" | "employee";
  recipe_id: string | null;
  resources_consumed: Record<string, number> | null;
  resources_produced: Record<string, { quantity: number; quality_id: string }> | null;
  hex_bonuses_applied: Record<string, number>;
  wage_earned: number;
  currency_type: string | null;
  worked_at: string;
}

// ============================================================================
// EXTENDED TYPES (with joins)
// ============================================================================

export interface CompanyWithType extends Company {
  company_type: CompanyType;
  owner_username?: string;
  community_name?: string | null;
  community_slug?: string | null;
  region?: { custom_name: string | null; province_name?: string | null } | null;
}

export interface UserCompany {
  id: string;
  name: string;
  company_type_key: string;
  company_type_name: string;
  hex_id: string;
  custom_name: string | null;
  level: number;
  health: number;
  can_work_today: boolean;
  available_recipes: string[]; // recipe_ids
  created_at: string;
}

export interface UserEmployment {
  id: string;
  company_id: string;
  company_name: string;
  company_type_key: string;
  company_type_name: string;
  owner_username: string;
  hex_id: string;
  custom_name: string | null;
  wage_per_day_community_coin: number;
  can_work_today: boolean;
  available_recipes: string[]; // recipe_ids
  hired_at: string;
}

// ============================================================================
// ACTION TYPES
// ============================================================================

export interface CreateCompanyInput {
  company_type_id: string;
  hex_id: string;
  name: string;
  community_id?: string | null;
}

export interface HireEmployeeInput {
  company_id: string;
  employee_id: string;
  wage_per_day_community_coin: number;
  position?: string;
}

export interface PerformWorkInput {
  worker_id?: string;
  company_id: string;
  recipe_id: string;
}

export interface WorkResult {
  success: boolean;
  error?: string;
  work_type?: "manager" | "employee";
  inputs_consumed?: Record<string, number>;
  outputs_produced?: Record<string, { base_quantity: number; quality_level: number }>;
  wage_earned?: number;
  hex_bonuses?: Record<string, number>;
}

// ============================================================================
// UI TYPES
// ============================================================================

export interface CompanyCardData {
  id: string;
  name: string;
  type: string;
  type_name: string;
  hex_id: string;
  level: number;
  health: number;
  can_work: boolean;
  recipes_count: number;
  owner_username?: string;
}

export interface RecipeOptionData {
  id: string;
  key: string;
  name: string;
  description: string | null;
  inputs: Array<{
    resource_id: string;
    resource_name: string;
    resource_key: string;
    quantity: number;
    available: number;
  }>;
  outputs: Array<{
    resource_id: string;
    resource_name: string;
    resource_key: string;
    quantity: number;
  }>;
  can_perform: boolean;
  missing_resources?: string[];
}

export interface WorkStats {
  total_work_days: number;
  total_products_created: number;
  total_wages_earned: number;
  companies_worked_at: number;
  favorite_company?: {
    id: string;
    name: string;
    work_days: number;
  };
}
