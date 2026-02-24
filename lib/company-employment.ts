import type { UserEmployment } from "@/lib/types/companies";

export function normalizeEmployments(
  employments: UserEmployment[]
): UserEmployment[] {
  if (!employments.length) return [];

  const sorted = [...employments].sort((a, b) => {
    const aTime = Number(new Date(a.hired_at));
    const bTime = Number(new Date(b.hired_at));
    return bTime - aTime;
  });

  const seenCompanies = new Set<string>();
  return sorted.filter((employment) => {
    const companyId = employment.company_id;
    if (!companyId || seenCompanies.has(companyId)) return false;
    seenCompanies.add(companyId);
    return true;
  });
}

export function pickPrimaryEmployment(
  employments: UserEmployment[]
): UserEmployment | null {
  const normalized = normalizeEmployments(employments);
  return normalized[0] ?? null;
}
