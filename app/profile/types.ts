import type { IdentityVector } from "@/lib/psychology";

export type ProfileRecord = {
  id: string;
  username: string | null;
  identity_label: string | null;
  identity_json: IdentityVector | null;
  freewill: number | null;
  coherence: number | null;
  power_mental: number | null;
  power_physical: number | null;
  energy?: number | null;
  banner_url: string | null;
  avatar_url: string | null;
  main_community_id: string | null;
  created_at: string;
  total_xp?: number | null;
  morale?: number | null;
  is_bot?: boolean | null;
  current_military_rank?: string | null;
  military_rank_score?: bigint | number | null;
  total_damage_dealt?: bigint | number | null;
  battles_fought?: number | null;
  battles_won?: number | null;
  highest_damage_battle?: number | null;
  win_streak?: number | null;
};

export type PostRow = {
  id: string;
  content: string;
  created_at: string;
  post_reactions: { id: string }[] | null;
};

export type CommentRow = {
  id: string;
  content: string;
  created_at: string;
  post_id: string;
};

export type ActivityLogItem = {
  id: string;
  type: "post" | "comment";
  content: string;
  created_at: string;
  dateLabel: string;
};

export type CommunityRow = {
  id: string;
  name: string | null;
  slug?: string | null;
  color?: string | null;
  ideology_label: string | null;
  power_mental: number | null;
  power_physical: number | null;
  members_count: number | null;
  regions_count?: number | null;
  average_morale?: number | null;
};

export type CommunityMember = {
  role: string;
  user:
    | {
        username: string | null;
        identity_label: string | null;
      }
    | null;
};
