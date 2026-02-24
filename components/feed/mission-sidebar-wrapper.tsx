"use client";

import { useEffect, useState } from "react";
import { createSupabaseBrowserClient } from "@/lib/supabase-browser";
import { MissionSidebar, type Mission } from "./mission-sidebar";

type MissionSidebarWrapperProps = {
  initialMissions: Mission[];
};

export function MissionSidebarWrapper({ initialMissions }: MissionSidebarWrapperProps) {
  const [missions, setMissions] = useState<Mission[]>(initialMissions);
  const [userId, setUserId] = useState<string | null>(null);

  // Get userId on mount
  useEffect(() => {
    const supabase = createSupabaseBrowserClient();
    supabase.auth.getUser().then(({ data: { user } }: any) => {
      if (user) {
        supabase
          .from("users")
          .select("id")
          .eq("auth_id", user.id)
          .maybeSingle()
          .then(({ data: profile }: any) => {
            if (profile) setUserId(profile.id);
          });
      }
    });
  }, []);

  // Poll for mission updates every 3 seconds
  useEffect(() => {
    if (!userId) return;

    const supabase = createSupabaseBrowserClient();

    const interval = setInterval(async () => {
      const { data: dbMissions } = await supabase
        .from("user_missions")
        .select("*")
        .eq("user_id", userId);

      if (dbMissions) {
        // Transform DB missions to component format
        const transformed = dbMissions.map((m: any) => {
          const initial = initialMissions.find((im) => im.id === m.mission_id);
          return {
            id: m.mission_id,
            title: initial?.title || "Unknown",
            description: initial?.description || "",
            iconName: initial?.iconName || "Trophy",
            progress: m.progress,
            goal: m.goal,
            xpReward: m.xp_reward,
            status: m.status as "incomplete" | "complete" | "claimed",
            type: m.mission_type as "daily" | "weekly",
          };
        });

        setMissions(transformed);
      }
    }, 3000);

    return () => clearInterval(interval);
  }, [userId, initialMissions]);


  return <MissionSidebar missions={missions} />;
}
