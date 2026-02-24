/**
 * Real-time User Stats Hook
 * Subscribes to user morale, rage, and energy updates via Supabase Realtime
 */

import { useEffect, useState, useCallback } from "react";
import { createSupabaseBrowserClient } from "@/lib/supabase-browser";
import type { RealtimePostgresUpdatePayload } from "@supabase/supabase-js";

export interface UserStats {
  morale: number;
  rage: number;
  energy: number;
  energy_updated_at: string | null;
  last_morale_update: string | null;
  last_rage_update: string | null;
  power_mental?: number | null;
  freewill?: number | null;
  coherence?: number | null;
  strength?: number | null;
  current_military_rank?: string | null;
}

export function useUserStats(userId: string | null | undefined) {
  const [stats, setStats] = useState<UserStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  // Fetch initial stats
  const fetchStats = useCallback(async () => {
    if (!userId) {
      setStats(null);
      setLoading(false);
      return;
    }

    try {
      const supabase = createSupabaseBrowserClient();
      const { data, error: fetchError } = await supabase
        .from("users")
        .select(
          "morale, rage, energy, energy_updated_at, last_morale_update, last_rage_update, power_mental, freewill, coherence, strength, current_military_rank"
        )
        .eq("id", userId)
        .single();

      if (fetchError) throw fetchError;

      setStats(data);
      setError(null);
    } catch (err) {
      console.error("Error fetching user stats:", err);
      setError(err as Error);
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    if (!userId) {
      setStats(null);
      setLoading(false);
      return;
    }

    // Fetch initial data
    fetchStats();

    // Subscribe to real-time updates
    const supabase = createSupabaseBrowserClient();
    const channel = supabase
      .channel(`user-stats-${userId}`)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "users",
          filter: `id=eq.${userId}`,
        },
        (payload: RealtimePostgresUpdatePayload<Record<string, unknown>>) => {
          console.log("User stats updated via Realtime:", payload.new);

          // Extract only stats-related fields
          const newData = payload.new as any;
          setStats({
            morale: newData.morale ?? 50,
            rage: newData.rage ?? 0,
            energy: newData.energy ?? 100,
            energy_updated_at: newData.energy_updated_at ?? null,
            last_morale_update: newData.last_morale_update ?? null,
            last_rage_update: newData.last_rage_update ?? null,
            power_mental: newData.power_mental ?? null,
            freewill: newData.freewill ?? null,
            coherence: newData.coherence ?? null,
            strength: newData.strength ?? null,
            current_military_rank: newData.current_military_rank ?? null,
          });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [userId, fetchStats]);

  return {
    stats,
    loading,
    error,
    refetch: fetchStats,
  };
}
