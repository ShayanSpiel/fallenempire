import { createSupabaseServerClient } from "@/lib/supabase-server";
import { NextRequest, NextResponse } from "next/server";
import { COMPANY_TYPES } from "@/lib/company-config";

// Upgrade cost formula: base_cost * 3^(currentLevel - 1)
// Example: level 1→2 = 10, level 2→3 = 30, level 3→4 = 90, level 4→5 = 270, level 5→6 = 810
const BASE_UPGRADE_COST = 10;

function calculateUpgradeCost(currentLevel: number): number {
  return BASE_UPGRADE_COST * Math.pow(3, currentLevel - 1);
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createSupabaseServerClient();

    // Get the authenticated user
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Get user ID from auth_id
    const { data: userProfile } = await supabase
      .from("users")
      .select("id")
      .eq("auth_id", user.id)
      .single();

    if (!userProfile) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    // Get company_id from request body
    const body = await request.json();
    const { company_id } = body;

    if (!company_id) {
      return NextResponse.json(
        { error: "Company ID required" },
        { status: 400 }
      );
    }

    // Get company details
    const { data: company } = await supabase
      .from("companies")
      .select("id, user_id, company_type_key, level")
      .eq("id", company_id)
      .single();

    if (!company) {
      return NextResponse.json(
        { error: "Company not found" },
        { status: 404 }
      );
    }

    // Verify ownership
    if (company.user_id !== userProfile.id) {
      return NextResponse.json(
        { error: "You don't own this company" },
        { status: 403 }
      );
    }

    // Get company type configuration
    const companyType = COMPANY_TYPES.find(
      (ct) => ct.key === company.company_type_key
    );

    if (!companyType) {
      return NextResponse.json(
        { error: "Invalid company type" },
        { status: 400 }
      );
    }

    // Check if already at max level
    if (company.level >= companyType.max_level) {
      return NextResponse.json(
        { error: `Company is already at max level (${companyType.max_level})` },
        { status: 400 }
      );
    }

    // Calculate upgrade cost
    const upgradeCost = calculateUpgradeCost(company.level);

    // Get user's gold wallet
    const { data: wallet } = await supabase
      .from("user_wallets")
      .select("gold_coins")
      .eq("user_id", userProfile.id)
      .single();

    if (!wallet || wallet.gold_coins < upgradeCost) {
      return NextResponse.json(
        {
          error: `Insufficient gold. Need ${upgradeCost} gold, but you have ${wallet?.gold_coins || 0}`,
        },
        { status: 400 }
      );
    }

    // Deduct gold
    const { error: walletError } = await supabase
      .from("user_wallets")
      .update({ gold_coins: wallet.gold_coins - upgradeCost })
      .eq("user_id", userProfile.id);

    if (walletError) {
      console.error("Error updating wallet:", walletError);
      return NextResponse.json(
        { error: "Failed to deduct gold" },
        { status: 500 }
      );
    }

    // Upgrade company level
    const newLevel = company.level + 1;
    const { error: upgradeError } = await supabase
      .from("companies")
      .update({ level: newLevel })
      .eq("id", company_id);

    if (upgradeError) {
      console.error("Error upgrading company:", upgradeError);
      // Rollback wallet change
      await supabase
        .from("user_wallets")
        .update({ gold_coins: wallet.gold_coins })
        .eq("user_id", userProfile.id);
      return NextResponse.json(
        { error: "Failed to upgrade company" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      newLevel,
      goldSpent: upgradeCost,
      remainingGold: wallet.gold_coins - upgradeCost,
      maxLevel: companyType.max_level,
    });
  } catch (error) {
    console.error("Error upgrading company:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

// GET endpoint to get upgrade costs for all levels
export async function GET(request: NextRequest) {
  const companyId = request.nextUrl.searchParams.get("company_id");

  if (!companyId) {
    return NextResponse.json(
      { error: "Company ID required" },
      { status: 400 }
    );
  }

  try {
    const supabase = await createSupabaseServerClient();

    // Get company details
    const { data: company } = await supabase
      .from("companies")
      .select("company_type_key, level")
      .eq("id", companyId)
      .single();

    if (!company) {
      return NextResponse.json(
        { error: "Company not found" },
        { status: 404 }
      );
    }

    // Get company type configuration
    const companyType = COMPANY_TYPES.find(
      (ct) => ct.key === company.company_type_key
    );

    if (!companyType) {
      return NextResponse.json(
        { error: "Invalid company type" },
        { status: 400 }
      );
    }

    // Calculate costs for all levels
    const costs = [];
    for (let level = 1; level < companyType.max_level; level++) {
      costs.push({
        fromLevel: level,
        toLevel: level + 1,
        cost: calculateUpgradeCost(level),
      });
    }

    return NextResponse.json({
      currentLevel: company.level,
      maxLevel: companyType.max_level,
      costs,
    });
  } catch (error) {
    console.error("Error fetching upgrade costs:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
