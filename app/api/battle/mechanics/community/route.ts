import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import { isSupabaseNetworkError } from "@/lib/utils";

/**
 * GET /api/battle/mechanics/community
 *
 * Fetches battle mechanics state for a community:
 * - Disarray (energy cost multiplier + time remaining)
 * - Exhaustion (energy regen multiplier + time remaining)
 * - Momentum (morale buff + time remaining)
 * - Conquest count and timestamps
 *
 * Query params:
 *   communityId: string (required)
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const communityId = searchParams.get("communityId");

    if (!communityId) {
      return NextResponse.json(
        { error: "communityId is required" },
        { status: 400 }
      );
    }

    const supabase = await createSupabaseServerClient();

    // Fetch community battle state
    const { data: battleState, error: stateError } = await supabase
      .from("community_battle_state")
      .select("*")
      .eq("community_id", communityId)
      .maybeSingle();

    if (stateError) {
      return buildBattleMechanicsErrorResponse(
        stateError,
        "fetching battle state"
      );
    }

    const { data: membersRage, error: membersRageError } = await supabase
      .from("users")
      .select("rage")
      .eq("main_community_id", communityId)
      .not("rage", "is", null);

    if (membersRageError) {
      return buildBattleMechanicsErrorResponse(
        membersRageError,
        "fetching community rage stats",
        {
          generalMessage: "Failed to load community rage stats",
        }
      );
    }

    const rageStats = calculateAverageRage(membersRage);

    // If no battle state exists, return default values
    if (!battleState) {
      return NextResponse.json({
        disarray: {
          active: false,
          multiplier: 1.0,
          hoursRemaining: 0,
        },
        exhaustion: {
          active: false,
          multiplier: 1.0,
          hoursRemaining: 0,
        },
        momentum: {
          active: false,
          moraleBonus: 0,
          hoursRemaining: 0,
        },
        rage: rageStats,
        conquests: {
          total: 0,
          recent: 0,
          timestamps: [],
        },
      });
    }

    const now = new Date();

    // Calculate disarray
    const disarray = calculateDisarray(battleState, now);

    // Calculate exhaustion
    const exhaustion = calculateExhaustion(battleState, now);

    // Calculate momentum
    const momentum = calculateMomentum(battleState, now);

    // Calculate conquests
    const conquestTimestamps = Array.isArray(battleState.conquest_timestamps)
      ? battleState.conquest_timestamps
      : [];
    const twelveHoursAgo = new Date(now.getTime() - 12 * 60 * 60 * 1000);
    const recentConquests = conquestTimestamps.filter(
      (ts: string) => new Date(ts) > twelveHoursAgo
    ).length;

    return NextResponse.json({
      disarray,
      exhaustion,
      momentum,
      rage: rageStats,
      conquests: {
        total: battleState.total_conquests || 0,
        recent: recentConquests,
        timestamps: conquestTimestamps,
      },
    });
  } catch (error) {
    return buildBattleMechanicsErrorResponse(
      error as BattleMechanicsError,
      "processing battle mechanics request",
      {
        generalMessage: "Internal server error",
      }
    );
  }
}

function calculateAverageRage(
  membersRage: { rage?: number | null }[] | null | undefined
): {
  average: number;
  memberCount: number;
} {
  const rows = Array.isArray(membersRage) ? membersRage : [];
  const memberCount = rows.length;
  if (memberCount === 0) {
    return { average: 0, memberCount: 0 };
  }

  const totalRage = rows.reduce((sum, row) => {
    const rageValue = row?.rage;
    return sum + (typeof rageValue === "number" ? rageValue : Number(rageValue ?? 0));
  }, 0);

  return {
    average: totalRage / memberCount,
    memberCount,
  };
}

type BattleMechanicsError = {
  message?: string;
  details?: string;
  code?: string;
} | null | undefined;

const NETWORK_ERROR_MESSAGE =
  "Battle mechanics are temporarily unavailable. Please try again shortly.";

function buildBattleMechanicsErrorResponse(
  error: BattleMechanicsError,
  context: string,
  options?: {
    networkMessage?: string;
    generalMessage?: string;
  }
) {
  const generalMessage = options?.generalMessage ?? "Failed to fetch battle mechanics";

  if (!error) {
    console.error(`[Battle Mechanics API] ${context}: missing error details`);
    return NextResponse.json(
      { error: generalMessage },
      { status: 500 }
    );
  }

  if (isSupabaseNetworkError(error)) {
    console.warn(`[Battle Mechanics API] Supabase network error (${context}):`, error);
    return NextResponse.json(
      { error: options?.networkMessage ?? NETWORK_ERROR_MESSAGE },
      { status: 503 }
    );
  }

  console.error(`[Battle Mechanics API] ${context}:`, error);
  return NextResponse.json(
    { error: generalMessage },
    { status: 500 }
  );
}

function calculateDisarray(
  battleState: any,
  now: Date
): {
  active: boolean;
  multiplier: number;
  hoursRemaining: number;
} {
  if (!battleState.disarray_active || !battleState.disarray_started_at) {
    return { active: false, multiplier: 1.0, hoursRemaining: 0 };
  }

  const startedAt = new Date(battleState.disarray_started_at);
  const hoursSince = (now.getTime() - startedAt.getTime()) / (1000 * 60 * 60);
  const DURATION_HOURS = 12;

  if (hoursSince >= DURATION_HOURS) {
    return { active: false, multiplier: 1.0, hoursRemaining: 0 };
  }

  // Linear decay: 3.0 → 1.0 over 12 hours
  const MAX_MULTIPLIER = 3.0;
  const multiplier = MAX_MULTIPLIER - (hoursSince / DURATION_HOURS) * (MAX_MULTIPLIER - 1.0);
  const hoursRemaining = DURATION_HOURS - hoursSince;

  return {
    active: true,
    multiplier: Math.max(1.0, multiplier),
    hoursRemaining: Math.max(0, hoursRemaining),
  };
}

function calculateExhaustion(
  battleState: any,
  now: Date
): {
  active: boolean;
  multiplier: number;
  hoursRemaining: number;
} {
  if (!battleState.exhaustion_active || !battleState.last_conquest_at) {
    return { active: false, multiplier: 1.0, hoursRemaining: 0 };
  }

  const lastConquestAt = new Date(battleState.last_conquest_at);
  const hoursSince = (now.getTime() - lastConquestAt.getTime()) / (1000 * 60 * 60);
  const RESET_HOURS = 12;

  if (hoursSince >= RESET_HOURS) {
    return { active: false, multiplier: 1.0, hoursRemaining: 0 };
  }

  const ENERGY_REGEN_MULTIPLIER = 0.5;
  const hoursRemaining = RESET_HOURS - hoursSince;

  return {
    active: true,
    multiplier: ENERGY_REGEN_MULTIPLIER,
    hoursRemaining: Math.max(0, hoursRemaining),
  };
}

function calculateMomentum(
  battleState: any,
  now: Date
): {
  active: boolean;
  moraleBonus: number;
  hoursRemaining: number;
} {
  if (!battleState.momentum_active || !battleState.momentum_expires_at) {
    return { active: false, moraleBonus: 0, hoursRemaining: 0 };
  }

  const expiresAt = new Date(battleState.momentum_expires_at);
  const hoursRemaining = (expiresAt.getTime() - now.getTime()) / (1000 * 60 * 60);

  if (hoursRemaining <= 0) {
    return { active: false, moraleBonus: 0, hoursRemaining: 0 };
  }

  const MORALE_BONUS = 15;

  return {
    active: true,
    moraleBonus: MORALE_BONUS,
    hoursRemaining: Math.max(0, hoursRemaining),
  };
}
