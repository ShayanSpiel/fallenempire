"use server";

import { revalidatePath } from "next/cache";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  CompanyType,
  ProductionRecipe,
  UserCompany,
  UserEmployment,
  CreateCompanyInput,
  HireEmployeeInput,
  PerformWorkInput,
  WorkResult,
  CompanyWithType,
} from "@/lib/types/companies";

function resolveRegionName(
  customName?: string | null,
  provinceName?: string | null
): string | null {
  const normalizedCustom = customName?.trim();
  if (normalizedCustom) return normalizedCustom;
  const normalizedProvince = provinceName?.trim();
  if (normalizedProvince) return normalizedProvince;
  return null;
}

async function hydrateRegionNames<T extends { hex_id: string; custom_name: string | null }>(
  supabase: SupabaseClient,
  items: T[]
): Promise<T[]> {
  const missingHexIds = items
    .filter((item) => !item.custom_name?.trim())
    .map((item) => item.hex_id?.trim())
    .filter((hexId): hexId is string => Boolean(hexId));

  if (missingHexIds.length === 0) return items;

  const { data: regions, error } = await supabase
    .from("world_regions")
    .select("hex_id, custom_name, province_name")
    .in("hex_id", missingHexIds);

  if (error) {
    console.error("Error fetching region names:", error);
    return items;
  }

  const regionByHexId = new Map(
    (regions || []).map((region) => [
      region.hex_id,
      resolveRegionName(region.custom_name, region.province_name),
    ])
  );

  return items.map((item) => {
    if (item.custom_name?.trim()) return item;
    const hexId = item.hex_id?.trim();
    if (!hexId) return item;
    return {
      ...item,
      custom_name: regionByHexId.get(hexId) ?? null,
    };
  });
}

// ============================================================================
// COMPANY TYPES & RECIPES (Config Data)
// ============================================================================

// Helper: Get public user ID from auth user
async function getPublicUserId(supabase: SupabaseClient): Promise<string | null> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: profile } = await supabase
    .from("users")
    .select("id")
    .eq("auth_id", user.id)
    .single();

  return profile?.id || null;
}

async function resolvePublicUserId(
  supabase: SupabaseClient,
  userId?: string
): Promise<string | null> {
  if (!userId) {
    return getPublicUserId(supabase);
  }

  const { data, error } = await supabase
    .from("users")
    .select("id")
    .or(`id.eq.${userId},auth_id.eq.${userId}`)
    .maybeSingle();

  if (error) {
    console.error("Error resolving public user ID:", error);
    return null;
  }

  return data?.id || null;
}

export async function getCompanyTypes(): Promise<CompanyType[]> {
  const supabase = await createSupabaseServerClient();

  const { data, error } = await supabase
    .from("company_types")
    .select("*")
    .order("build_cost_gold", { ascending: true });

  if (error) {
    console.error("Error fetching company types:", error);
    return [];
  }

  return data || [];
}

export async function getProductionRecipes(): Promise<ProductionRecipe[]> {
  const supabase = await createSupabaseServerClient();

  const { data, error } = await supabase
    .from("production_recipes")
    .select("*")
    .order("created_at", { ascending: true });

  if (error) {
    console.error("Error fetching production recipes:", error);
    return [];
  }

  return data || [];
}

export async function getRecipesByIds(
  recipeIds: string[]
): Promise<ProductionRecipe[]> {
  if (!recipeIds || recipeIds.length === 0) return [];

  const supabase = await createSupabaseServerClient();

  const { data, error } = await supabase
    .from("production_recipes")
    .select("*")
    .in("id", recipeIds);

  if (error) {
    console.error("Error fetching recipes by IDs:", error);
    return [];
  }

  return data || [];
}

// ============================================================================
// USER COMPANIES (Manager View)
// ============================================================================

export async function getUserCompanies(
  userId: string
): Promise<UserCompany[]> {
  const supabase = await createSupabaseServerClient();

  const resolvedUserId = await resolvePublicUserId(supabase, userId);
  if (!resolvedUserId) return [];

  const { data, error } = await supabase.rpc("get_user_companies", {
    p_user_id: resolvedUserId,
  });

  if (!error) {
    const companies = (data || []) as UserCompany[];
    return hydrateRegionNames(supabase, companies);
  }

  // Fallback: some environments have a missing/broken RPC (common during iterative SQL changes).
  console.error("Error fetching user companies (rpc:get_user_companies). Falling back:", error);

  const { data: companies, error: companiesError } = await supabase
    .from("companies")
    .select(
      `
      id,
      name,
      hex_id,
      level,
      health,
      created_at,
      company_type:company_types(key, name, can_produce_recipes)
    `
    )
    .eq("owner_id", resolvedUserId)
    .order("created_at", { ascending: false });

  if (companiesError) {
    console.error("Error fetching user companies (fallback select):", companiesError);
    return [];
  }

  const results: UserCompany[] = [];
  for (const company of companies || []) {
    const { data: canWork, error: canWorkError } = await supabase.rpc("can_work_today", {
      p_user_id: resolvedUserId,
      p_company_id: company.id,
    });

    if (canWorkError) {
      console.error("Error checking can_work_today (fallback):", canWorkError);
    }

    results.push({
      id: company.id,
      name: company.name,
      company_type_key: (company.company_type as { key?: string } | null)?.key ?? "",
      company_type_name: (company.company_type as { name?: string } | null)?.name ?? "",
      hex_id: company.hex_id,
      custom_name: null,
      level: company.level,
      health: company.health,
      can_work_today: Boolean(canWork),
      available_recipes: (((company.company_type as { can_produce_recipes?: unknown } | null)
        ?.can_produce_recipes ?? []) as string[]),
      created_at: company.created_at,
    });
  }

  return hydrateRegionNames(supabase, results);
}

export async function getCompanyById(
  companyId: string
): Promise<CompanyWithType | null> {
  const supabase = await createSupabaseServerClient();

  const { data, error } = await supabase
    .from("companies")
    .select(
      `
      *,
      company_type:company_types(*),
      owner:users(username),
      community:communities(id, name, slug)
    `
    )
    .eq("id", companyId)
    .single();

  if (error) {
    console.error("Error fetching company:", error);
    return null;
  }

  // Best-effort: derive effective community from hex ownership (governance follows the land).
  let effectiveCommunityId: string | null = data.community_id ?? null;
  let effectiveCommunityName: string | null = data.community?.name ?? null;
  let effectiveCommunitySlug: string | null = data.community?.slug ?? null;

  if (data.hex_id) {
    const companyHexId = (data.hex_id as string).trim();
    const { data: region } = await supabase
      .from("world_regions")
      .select("owner_community_id")
      .eq("hex_id", companyHexId)
      .maybeSingle();

    const regionOwnerCommunityId: string | null = region?.owner_community_id ?? null;

    effectiveCommunityId = regionOwnerCommunityId;

    if (effectiveCommunityId && effectiveCommunityId !== data.community_id) {
      const { data: resolvedCommunity } = await supabase
        .from("communities")
        .select("name, slug")
        .eq("id", effectiveCommunityId)
        .maybeSingle();

      effectiveCommunityName = resolvedCommunity?.name ?? null;
      effectiveCommunitySlug = resolvedCommunity?.slug ?? null;
    }
  }

  let region: { custom_name: string | null; province_name: string | null } | null = null;
  if (data.hex_id) {
    const { data: regionRow } = await supabase
      .from("world_regions")
      .select("custom_name, province_name")
      .eq("hex_id", (data.hex_id as string).trim())
      .maybeSingle();
    if (regionRow) {
      region = {
        custom_name: regionRow.custom_name ?? null,
        province_name: regionRow.province_name ?? null,
      };
    }
  }

  return {
    ...data,
    company_type: data.company_type,
    owner_username: data.owner?.username,
    community_id: effectiveCommunityId,
    community_name: effectiveCommunityName,
    community_slug: effectiveCommunitySlug,
    region,
  };
}

export async function getMyCompanyCommunityIds(): Promise<string[]> {
  const supabase = await createSupabaseServerClient();

  const userId = await getPublicUserId(supabase);
  if (!userId) return [];

  const { data: companies, error } = await supabase
    .from("companies")
    .select("hex_id, community_id")
    .eq("owner_id", userId);

  if (error) {
    console.error("Error fetching companies for community discovery:", error);
    return [];
  }

  const hexIds = (companies || [])
    .map((company) => (company.hex_id as string | null)?.trim?.() ?? null)
    .filter((hexId): hexId is string => !!hexId);

  if (hexIds.length === 0) return [];

  const { data: regions, error: regionsError } = await supabase
    .from("world_regions")
    .select("hex_id, owner_community_id")
    .in("hex_id", hexIds);

  if (regionsError) {
    console.error("Error fetching world regions for company discovery:", regionsError);
    return [];
  }

  const ownerByHexId = new Map<string, string | null>(
    (regions || []).map((region) => [region.hex_id, region.owner_community_id ?? null])
  );

  const communityIds = new Set<string>();
  for (const company of companies || []) {
    const hexId = (company.hex_id as string | null)?.trim?.() ?? null;
    if (!hexId) continue;

    const ownerCommunityId = ownerByHexId.get(hexId) ?? (company.community_id as string | null);
    if (ownerCommunityId) communityIds.add(ownerCommunityId);
  }

  return Array.from(communityIds);
}

// ============================================================================
// USER EMPLOYMENTS (Employee View)
// ============================================================================

export async function getUserEmployments(
  userId?: string
): Promise<UserEmployment[]> {
  const supabase = await createSupabaseServerClient();

  const resolvedUserId = await resolvePublicUserId(supabase, userId);
  if (!resolvedUserId) return [];

  const { data, error } = await supabase.rpc("get_user_employments", {
    p_user_id: resolvedUserId,
  });

  if (!error) {
    const employments = (data || []) as UserEmployment[];
    return hydrateRegionNames(supabase, employments);
  }

  console.error("Error fetching user employments (rpc:get_user_employments). Falling back:", error);

  const { data: contracts, error: contractsError } = await supabase
    .from("employment_contracts")
    .select(
      `
      id,
      company_id,
      wage_per_day_community_coin,
      hired_at,
      companies:companies!inner(
        id,
        name,
        hex_id,
        owner:users!owner_id(username),
        company_type:company_types(key, name, can_produce_recipes)
      )
    `
    )
    .eq("employee_id", resolvedUserId)
    .eq("active", true)
    .order("hired_at", { ascending: false });

  if (contractsError) {
    console.error("Error fetching user employments (fallback select):", contractsError);
    return [];
  }

  type EmploymentContractRow = {
    id: string;
    company_id: string;
    wage_per_day_community_coin: number | null;
    hired_at: string;
    companies?:
      | {
          id: string;
          name: string | null;
          hex_id: string | null;
          owner?: { username?: string | null } | null;
          company_type?: { key?: string | null; name?: string | null; can_produce_recipes?: string[] | null } | null;
        }
      | {
          id: string;
          name: string | null;
          hex_id: string | null;
          owner?: { username?: string | null } | null;
          company_type?: { key?: string | null; name?: string | null; can_produce_recipes?: string[] | null } | null;
        }[]
      | null;
  };

  const results: UserEmployment[] = [];
  for (const contract of (contracts || []) as EmploymentContractRow[]) {
    const companiesJoin = contract.companies;
    const company = Array.isArray(companiesJoin) ? companiesJoin[0] : companiesJoin;

    const companyId = company?.id ?? contract.company_id;

    const { data: canWork, error: canWorkError } = await supabase.rpc("can_work_today", {
      p_user_id: resolvedUserId,
      p_company_id: companyId,
    });

    if (canWorkError) {
      console.error("Error checking can_work_today (employment fallback):", canWorkError);
    }

    results.push({
      id: contract.id,
      company_id: companyId,
      company_name: company?.name ?? "Company",
      company_type_key: company?.company_type?.key ?? "",
      company_type_name: company?.company_type?.name ?? "",
      owner_username: company?.owner?.username ?? "",
      hex_id: company?.hex_id ?? "",
      custom_name: null,
      wage_per_day_community_coin: contract.wage_per_day_community_coin ?? 0,
      can_work_today: Boolean(canWork),
      available_recipes: (company?.company_type?.can_produce_recipes ?? []) as string[],
      hired_at: contract.hired_at,
    });
  }

  return hydrateRegionNames(supabase, results);
}

export async function leaveEmployment(
  contractId: string
): Promise<{ success: boolean; error?: string }> {
  const supabase = await createSupabaseServerClient();

  const userId = await getPublicUserId(supabase);
  if (!userId) {
    return { success: false, error: "Not authenticated" };
  }

  const { data: contract, error: contractError } = await supabase
    .from("employment_contracts")
    .select("id, employee_id, company_id, active")
    .eq("id", contractId)
    .single();

  if (contractError || !contract) {
    return { success: false, error: "Employment contract not found" };
  }

  if (contract.employee_id !== userId) {
    return { success: false, error: "Not authorized" };
  }

  if (!contract.active) {
    return { success: false, error: "Employment already ended" };
  }

  const { data: updatedContracts, error } = await supabase
    .from("employment_contracts")
    .update({ active: false })
    .eq("employee_id", userId)
    .eq("company_id", contract.company_id)
    .eq("active", true)
    .select("id");

  if (error) {
    console.error("Error leaving employment:", error);
    return { success: false, error: "Failed to leave employment" };
  }

  if (!updatedContracts || updatedContracts.length === 0) {
    return { success: false, error: "No active employment found to leave" };
  }

  revalidatePath("/market");
  revalidatePath("/ventures");

  return { success: true };
}

// ============================================================================
// COMPANY CREATION
// ============================================================================

export async function createCompany(
  input: CreateCompanyInput
): Promise<{ success: boolean; error?: string; company_id?: string }> {
  const supabase = await createSupabaseServerClient();
  const hexId = input.hex_id.trim();
  const companyName = input.name.trim();

  // Get public user ID
  const userId = await getPublicUserId(supabase);
  if (!userId) {
    return { success: false, error: "Not authenticated" };
  }

  // Get company type details
  const { data: companyType, error: typeError } = await supabase
    .from("company_types")
    .select("*")
    .eq("id", input.company_type_id)
    .single();

  if (typeError || !companyType) {
    return { success: false, error: "Invalid company type" };
  }

  // Note: Company creation only requires gold.
  // Resources are used for WORKING at companies, not for creating them.

  // Deduct gold using transaction service (single source of truth)
  console.log(`[createCompany] Attempting to deduct ${companyType.build_cost_gold} gold for company creation`);

  const { data: deductResult, error: goldError } = await supabase.rpc(
    "deduct_gold_enhanced",
    {
      p_user_id: userId,
      p_amount: companyType.build_cost_gold,
      p_transaction_type: "company_creation",
      p_description: `Company creation: ${companyName}`,
      p_metadata: {
        company_type_id: input.company_type_id,
        company_name: companyName,
        hex_id: hexId,
      },
      p_scope: "personal",
    }
  );

  if (goldError) {
    console.error(`[createCompany] Gold RPC error:`, goldError);
    return {
      success: false,
      error: `Gold deduction failed: ${goldError.message}`,
    };
  }

  console.log(`[createCompany] Gold deduction result:`, deductResult);

  if (!deductResult?.success) {
    return {
      success: false,
      error: deductResult?.error || "Insufficient gold",
    };
  }

  // No resource deduction needed - company creation only costs gold

  // Determine which community (if any) this company belongs to.
  // Governance follows the land: if the hex has an owner community, the company belongs to it.
  let resolvedCommunityId: string | null = null;
  const { data: region } = await supabase
    .from("world_regions")
    .select("owner_community_id")
    .eq("hex_id", hexId)
    .maybeSingle();

  const hexOwnerCommunityId = (region?.owner_community_id ?? input.community_id ?? null) as
    | string
    | null;
  if (hexOwnerCommunityId) {
    resolvedCommunityId = hexOwnerCommunityId;
  }

  // Create company
  const { data: company, error: createError } = await supabase
    .from("companies")
    .insert({
      owner_id: userId,
      company_type_id: input.company_type_id,
      hex_id: hexId,
      name: companyName,
      community_id: resolvedCommunityId,
      level: 1,
      health: 100,
      output_destination: "founder",
      metadata: { build_complete: true },
    })
    .select()
    .single();

  if (createError) {
    console.error("Error creating company:", createError);
    return { success: false, error: "Failed to create company" };
  }

  return { success: true, company_id: company.id };
}

// ============================================================================
// EMPLOYMENT
// ============================================================================

export async function hireEmployee(
  input: HireEmployeeInput
): Promise<{ success: boolean; error?: string }> {
  const supabase = await createSupabaseServerClient();

  // Get public user ID
  const userId = await getPublicUserId(supabase);
  if (!userId) {
    return { success: false, error: "Not authenticated" };
  }

  // Verify company ownership
  const { data: company } = await supabase
    .from("companies")
    .select("owner_id, community_id, hex_id")
    .eq("id", input.company_id)
    .single();

  if (!company || company.owner_id !== userId) {
    return { success: false, error: "Not authorized" };
  }

  const companyHexId = (company.hex_id as string | null)?.trim?.() ?? null;

  let effectiveCommunityId: string | null = (company.community_id as string | null) ?? null;
  if (companyHexId) {
    const { data: region } = await supabase
      .from("world_regions")
      .select("owner_community_id")
      .eq("hex_id", companyHexId)
      .maybeSingle();

    effectiveCommunityId = (region?.owner_community_id as string | null) ?? effectiveCommunityId;

    if (effectiveCommunityId && effectiveCommunityId !== company.community_id) {
      await supabase
        .from("companies")
        .update({ community_id: effectiveCommunityId })
        .eq("id", input.company_id);
    }
  }

  if (!effectiveCommunityId) {
    return {
      success: false,
      error: "Your company is in wilderness. No employees to hire here!",
    };
  }

  if (input.employee_id === userId) {
    return {
      success: false,
      error: "You can't be hired in your own company. Work there as manager instead.",
    };
  }

  const { data: employeeRow, error: employeeError } = await supabase
    .from("users")
    .select("current_hex")
    .eq("id", input.employee_id)
    .maybeSingle();

  if (employeeError) {
    console.error("Error checking employee location:", employeeError);
    return { success: false, error: "Failed to verify employee location" };
  }

  if (!employeeRow?.current_hex) {
    return {
      success: false,
      error: "Employee must travel to this community's territory before being hired.",
    };
  }

  // Check if employee's current hex is owned by the effective community
  const { data: employeeRegion } = await supabase
    .from("world_regions")
    .select("owner_community_id")
    .eq("hex_id", employeeRow.current_hex.trim())
    .maybeSingle();

  if (!employeeRegion || employeeRegion.owner_community_id !== effectiveCommunityId) {
    return {
      success: false,
      error: "Employee must travel to this community's territory before being hired.",
    };
  }

  const wage = Number(input.wage_per_day_community_coin ?? 0);
  if (!Number.isFinite(wage) || wage < 0.01) {
    return { success: false, error: "Wage must be at least 0.01 community coin per day" };
  }

  // Get community currency type
  let communityCoinType = null;
  const { data: currency } = await supabase
    .from("community_currencies")
    .select("id")
    .eq("community_id", effectiveCommunityId)
    .single();

  communityCoinType = currency?.id || null;

  // Create employment contract
  const { error } = await supabase.from("employment_contracts").insert({
    company_id: input.company_id,
    employee_id: input.employee_id,
    wage_per_day_community_coin: wage,
    community_coin_type: communityCoinType,
    position: input.position || "worker",
    active: true,
  });

  if (error) {
    console.error("Error hiring employee:", error);
    return { success: false, error: "Failed to hire employee" };
  }

  return { success: true };
}

export async function fireEmployee(
  contractId: string
): Promise<{ success: boolean; error?: string }> {
  const supabase = await createSupabaseServerClient();

  // Get public user ID
  const userId = await getPublicUserId(supabase);
  if (!userId) {
    return { success: false, error: "Not authenticated" };
  }

  // Verify ownership through company
  const { data: contract } = await supabase
    .from("employment_contracts")
    .select("company_id, companies!inner(owner_id)")
    .eq("id", contractId)
    .single();

  const companiesJoin = (contract as unknown as { companies?: { owner_id?: string } | { owner_id?: string }[] })
    ?.companies;
  const companyOwnerId = Array.isArray(companiesJoin)
    ? companiesJoin[0]?.owner_id
    : companiesJoin?.owner_id;

  if (!contract || companyOwnerId !== userId) {
    return { success: false, error: "Not authorized" };
  }

  // Deactivate contract
  const { error } = await supabase
    .from("employment_contracts")
    .update({ active: false })
    .eq("id", contractId);

  if (error) {
    return { success: false, error: "Failed to fire employee" };
  }

  return { success: true };
}

// ============================================================================
// WORK SYSTEM
// ============================================================================

export async function performWork(
  input: PerformWorkInput
): Promise<WorkResult> {
  const supabase = await createSupabaseServerClient();

  // Get public user ID
  const userId = await getPublicUserId(supabase);
  if (!userId) {
    return { success: false, error: "Not authenticated" };
  }

  // Verify worker_id matches authenticated user
  const resolvedWorkerId = await resolvePublicUserId(supabase, input.worker_id);
  if (!resolvedWorkerId || resolvedWorkerId !== userId) {
    return { success: false, error: "Not authorized" };
  }

  // Call database function
  const { data, error } = await supabase.rpc("perform_work", {
    p_worker_id: resolvedWorkerId,
    p_company_id: input.company_id,
    p_recipe_id: input.recipe_id,
  });

  if (error) {
    console.error("Error performing work:", error);
    return { success: false, error: error.message };
  }

  return data as WorkResult;
}

export async function canWorkToday(
  userId: string,
  companyId: string
): Promise<boolean> {
  const supabase = await createSupabaseServerClient();

  const { data, error } = await supabase.rpc("can_work_today", {
    p_user_id: userId,
    p_company_id: companyId,
  });

  if (error) {
    console.error("Error checking work cooldown:", error);
    return false;
  }

  return data === true;
}

// ============================================================================
// COMPANIES BY HEX (For hex drawer)
// ============================================================================

export async function getCompaniesByHex(
  hexId: string
): Promise<CompanyWithType[]> {
  const supabase = await createSupabaseServerClient();

  const { data, error } = await supabase
    .from("companies")
    .select(
      `
      *,
      company_type:company_types(*),
      owner:users(username)
    `
    )
    .eq("hex_id", hexId)
    .order("created_at", { ascending: false });

  if (error) {
    console.error("Error fetching companies by hex:", error);
    return [];
  }

  return (
    data?.map((company) => ({
      ...company,
      company_type: company.company_type,
      owner_username: company.owner?.username,
    })) || []
  );
}

// ============================================================================
// WORK HISTORY & STATS
// ============================================================================

export async function getUserWorkHistory(
  userId: string,
  limit: number = 20
) {
  const supabase = await createSupabaseServerClient();

  const { data, error } = await supabase
    .from("work_history")
    .select(
      `
      *,
      company:companies(name, hex_id),
      recipe:production_recipes(name, key)
    `
    )
    .eq("user_id", userId)
    .order("worked_at", { ascending: false })
    .limit(limit);

  if (error) {
    console.error("Error fetching work history:", error);
    return [];
  }

  const regionNames = new Map<string, { custom_name: string | null; province_name: string | null }>();
  const uniqueHexIds = new Set<string>();
  for (const company of data || []) {
    if (company.hex_id) uniqueHexIds.add((company.hex_id as string).trim());
  }
  if (uniqueHexIds.size > 0) {
    const { data: regions } = await supabase
      .from("world_regions")
      .select("hex_id, custom_name, province_name")
      .in("hex_id", Array.from(uniqueHexIds));
    for (const region of regions || []) {
      regionNames.set(region.hex_id, {
        custom_name: region.custom_name ?? null,
        province_name: region.province_name ?? null,
      });
    }
  }

  return (data || []).map((company) => {
    const region = company.hex_id ? regionNames.get((company.hex_id as string).trim()) : null;
    return {
      ...company,
      owner_username: company.owner?.username,
      region: region ?? null,
    };
  });
}

// ============================================================================
// EMPLOYEE MANAGEMENT
// ============================================================================

export interface CompanyEmployee {
  id: string;
  employee_id: string;
  employee_type: "player" | "ai";
  employee_name: string;
  position: string;
  wage_per_day_community_coin: number;
  total_work_days: number;
  hired_at: string;
}

export async function getCompanyEmployees(
  companyId: string
): Promise<CompanyEmployee[]> {
  const supabase = await createSupabaseServerClient();

  const { data, error } = await supabase
    .from("employment_contracts")
    .select(
      `
      id,
      employee_id,
      employee_type,
      position,
      wage_per_day_community_coin,
      total_work_days,
      hired_at,
      employee:users!employee_id(username)
    `
    )
    .eq("company_id", companyId)
    .eq("active", true);

  if (error) {
    console.error("Error fetching company employees:", error);
    return [];
  }

  type CompanyEmployeeRow = {
    id: string;
    employee_id: string;
    employee_type: string | null;
    position: string | null;
    wage_per_day_community_coin: number | null;
    total_work_days: number | null;
    hired_at: string;
    employee?: { username?: string | null } | null;
  };

  return ((data || []) as CompanyEmployeeRow[]).map((emp) => ({
    id: emp.id,
    employee_id: emp.employee_id,
    employee_type: emp.employee_type === "ai" ? "ai" : "player",
    employee_name: emp.employee?.username || "AI Worker",
    position: emp.position ?? "Worker",
    wage_per_day_community_coin: emp.wage_per_day_community_coin ?? 0,
    total_work_days: emp.total_work_days ?? 0,
    hired_at: emp.hired_at,
  }));
}

/**
 * Get active job listings for a specific company
 */
export async function getCompanyJobListings(companyId: string) {
  const supabase = await createSupabaseServerClient();

  const { data, error } = await supabase
    .from("market_listings")
    .select(
      `
      id,
      position_title,
      positions_available,
      wage_per_day_community_coin,
      requirements,
      created_at,
      community:communities!community_id(name)
    `
    )
    .eq("listing_type", "job")
    .eq("company_id", companyId)
    .eq("status", "active");

  if (error) {
    console.error("Error fetching company job listings:", error);
    return [];
  }

  return (data || []).map((listing) => ({
    id: listing.id,
    position_title: listing.position_title || "Worker",
    positions_available: listing.positions_available || 0,
    wage_per_day_community_coin: listing.wage_per_day_community_coin || 0,
    requirements: listing.requirements || {},
    created_at: listing.created_at,
    community_name: Array.isArray(listing.community)
      ? listing.community[0]?.name || "Unknown"
      : (listing.community as any)?.name || "Unknown",
  }));
}
