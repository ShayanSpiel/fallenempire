import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase-server";

/**
 * Central Bank API Routes
 * Provides economic analytics and statistics
 */

export async function GET(request: Request) {
  try {
    const supabase = await createSupabaseServerClient({ canSetCookies: false });
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Get public user ID
    const { data: profile } = await supabase
      .from("users")
      .select("id")
      .eq("auth_id", user.id)
      .single();

    if (!profile) {
      return NextResponse.json({ error: "Profile not found" }, { status: 404 });
    }

    // Add subscription_tier field (default to free for now)
    const profileWithTier = { ...profile, subscription_tier: "free" };

    const { searchParams } = new URL(request.url);
    const action = searchParams.get("action");

    // Route to different handlers based on action
    switch (action) {
      case "overview":
        return await getOverviewStats(supabase, profileWithTier);

      case "gold_flow":
        return await getGoldFlow(supabase, searchParams);

      case "transactions":
        return await getTransactions(supabase, profileWithTier, searchParams);

      case "transaction_volume":
        return await getTransactionVolume(supabase, searchParams);

      case "market_stats":
        return await getMarketStats(supabase, searchParams);

      case "job_market":
        return await getJobMarket(supabase, searchParams);

      case "timeseries":
        return await getTimeseries(supabase, searchParams, profileWithTier);

      case "community_stats":
        return await getCommunityStats(supabase, searchParams);

      default:
        return NextResponse.json(
          { error: "Invalid action parameter" },
          { status: 400 }
        );
    }
  } catch (err: any) {
    console.error("Central Bank API error:", err);
    return NextResponse.json(
      { error: err?.message ?? "Unknown error" },
      { status: 500 }
    );
  }
}

// ============================================================================
// HANDLER FUNCTIONS
// ============================================================================

async function getOverviewStats(supabase: any, profile: any) {
  // Get total gold supply
  const { data: goldSupply } = await supabase.rpc("get_total_gold_supply");

  // Get community currencies stats
  const { data: currenciesStats } = await supabase.rpc(
    "get_community_currencies_stats"
  );

  // Get today's gold flow
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  const { data: todayFlow } = await supabase.rpc("get_gold_flow", {
    p_start_date: today.toISOString(),
    p_end_date: tomorrow.toISOString(),
  });

  // Get week's gold flow
  const weekAgo = new Date(today);
  weekAgo.setDate(weekAgo.getDate() - 7);

  const { data: weekFlow } = await supabase.rpc("get_gold_flow", {
    p_start_date: weekAgo.toISOString(),
    p_end_date: tomorrow.toISOString(),
  });

  // Get month's gold flow
  const monthAgo = new Date(today);
  monthAgo.setDate(monthAgo.getDate() - 30);

  const { data: monthFlow } = await supabase.rpc("get_gold_flow", {
    p_start_date: monthAgo.toISOString(),
    p_end_date: tomorrow.toISOString(),
  });

  return NextResponse.json({
    total_gold_supply: goldSupply || 0,
    community_currencies: currenciesStats || { total_currencies: 0, currencies: [] },
    gold_flow: {
      today: todayFlow || { added: 0, burnt: 0, net_change: 0 },
      week: weekFlow || { added: 0, burnt: 0, net_change: 0 },
      month: monthFlow || { added: 0, burnt: 0, net_change: 0 },
    },
  });
}

async function getGoldFlow(supabase: any, searchParams: URLSearchParams) {
  const range = searchParams.get("range") || "month"; // day, week, month

  const now = new Date();
  let startDate = new Date(now);

  switch (range) {
    case "day":
      startDate.setHours(0, 0, 0, 0);
      break;
    case "week":
      startDate.setDate(startDate.getDate() - 7);
      break;
    case "month":
      startDate.setDate(startDate.getDate() - 30);
      break;
    default:
      startDate.setDate(startDate.getDate() - 30);
  }

  const { data, error } = await supabase.rpc("get_gold_flow", {
    p_start_date: startDate.toISOString(),
    p_end_date: now.toISOString(),
  });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data || { added: 0, burnt: 0, net_change: 0 });
}

async function getTransactions(
  supabase: any,
  profile: any,
  searchParams: URLSearchParams
) {
  const limit = parseInt(searchParams.get("limit") || "50");
  const offset = parseInt(searchParams.get("offset") || "0");
  const scope = searchParams.get("scope") || null; // 'personal', 'community', 'global', or null for all

  let data, error;

  // For global scope, use dedicated function (shows all global transactions)
  if (scope === "global") {
    ({ data, error } = await supabase.rpc("get_global_transactions", {
      p_limit: limit,
      p_offset: offset,
    }));
  } else {
    // For personal/community or all, use user-scoped function
    ({ data, error } = await supabase.rpc("get_user_transactions_scoped", {
      p_user_id: profile.id,
      p_scope: scope,
      p_limit: limit,
      p_offset: offset,
    }));
  }

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Extract total count from first row
  const totalCount = data && data.length > 0 ? data[0].total_count : 0;

  return NextResponse.json({
    transactions: data || [],
    total: totalCount,
  });
}

async function getTransactionVolume(
  supabase: any,
  searchParams: URLSearchParams
) {
  const scope = searchParams.get("scope") || null;
  const range = searchParams.get("range") || "month";

  const now = new Date();
  let startDate = new Date(now);

  switch (range) {
    case "week":
      startDate.setDate(startDate.getDate() - 7);
      break;
    case "month":
      startDate.setDate(startDate.getDate() - 30);
      break;
    default:
      startDate.setDate(startDate.getDate() - 30);
  }

  const { data, error } = await supabase.rpc("get_transaction_volume_by_type", {
    p_scope: scope,
    p_start_date: startDate.toISOString(),
    p_end_date: now.toISOString(),
  });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ volume_by_type: data || [] });
}

async function getMarketStats(supabase: any, searchParams: URLSearchParams) {
  const range = searchParams.get("range") || "month";

  const now = new Date();
  let startDate = new Date(now);

  switch (range) {
    case "week":
      startDate.setDate(startDate.getDate() - 7);
      break;
    case "month":
      startDate.setDate(startDate.getDate() - 30);
      break;
    default:
      startDate.setDate(startDate.getDate() - 30);
  }

  const { data, error } = await supabase.rpc("get_market_statistics", {
    p_start_date: startDate.toISOString(),
    p_end_date: now.toISOString(),
  });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ market_stats: data || [] });
}

async function getJobMarket(supabase: any, searchParams: URLSearchParams) {
  const range = searchParams.get("range") || "month";

  const now = new Date();
  let startDate = new Date(now);

  switch (range) {
    case "week":
      startDate.setDate(startDate.getDate() - 7);
      break;
    case "month":
      startDate.setDate(startDate.getDate() - 30);
      break;
    default:
      startDate.setDate(startDate.getDate() - 30);
  }

  const { data, error } = await supabase.rpc("get_job_market_statistics", {
    p_start_date: startDate.toISOString(),
    p_end_date: now.toISOString(),
  });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ job_market: data || [] });
}

async function getTimeseries(
  supabase: any,
  searchParams: URLSearchParams,
  profile: any
) {
  // Check if user has premium access for advanced timeseries
  const isPremium = profile.subscription_tier === "premium";
  const type = searchParams.get("type"); // 'money_supply', 'transaction_volume'
  const range = searchParams.get("range") || "month";

  // Free users can only see basic timeseries
  if (!isPremium && type === "money_supply") {
    return NextResponse.json(
      { error: "Premium feature - Upgrade to access money supply timeseries" },
      { status: 403 }
    );
  }

  const now = new Date();
  let startDate = new Date(now);

  switch (range) {
    case "week":
      startDate.setDate(startDate.getDate() - 7);
      break;
    case "month":
      startDate.setDate(startDate.getDate() - 30);
      break;
    case "quarter":
      if (!isPremium) {
        return NextResponse.json(
          { error: "Premium feature - Upgrade to access extended timeseries" },
          { status: 403 }
        );
      }
      startDate.setDate(startDate.getDate() - 90);
      break;
    default:
      startDate.setDate(startDate.getDate() - 30);
  }

  let data, error;

  if (type === "money_supply") {
    ({ data, error } = await supabase.rpc("get_money_supply_timeseries", {
      p_start_date: startDate.toISOString(),
      p_end_date: now.toISOString(),
    }));
  } else {
    ({ data, error } = await supabase.rpc("get_transaction_volume_timeseries", {
      p_start_date: startDate.toISOString(),
      p_end_date: now.toISOString(),
    }));
  }

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ timeseries: data || [] });
}

async function getCommunityStats(
  supabase: any,
  searchParams: URLSearchParams
) {
  const communityId = searchParams.get("community_id");
  const range = searchParams.get("range") || "month";

  if (!communityId) {
    return NextResponse.json(
      { error: "community_id parameter required" },
      { status: 400 }
    );
  }

  const now = new Date();
  let startDate = new Date(now);

  switch (range) {
    case "week":
      startDate.setDate(startDate.getDate() - 7);
      break;
    case "month":
      startDate.setDate(startDate.getDate() - 30);
      break;
    default:
      startDate.setDate(startDate.getDate() - 30);
  }

  const { data, error } = await supabase.rpc("get_community_economic_stats", {
    p_community_id: communityId,
    p_start_date: startDate.toISOString(),
    p_end_date: now.toISOString(),
  });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data || {});
}
