export type RegionOwnerCommunity = {
  id: string;
  name: string;
  color: string | null;
  capital_hex_id?: string | null;
};

export type RegionOwnerRow = {
  hex_id: string;
  custom_name?: string | null;
  province_name?: string | null;
  display_name?: string | null;
  owner_community_id: string | null;
  fortification_level: number;
  resource_yield: number;
  communities: RegionOwnerCommunity | null;
};

export type RegionOwnersMap = Record<string, RegionOwnerRow>;

export type BattleCommunityRef = {
  id: string;
  name: string;
  slug?: string | null;
  color?: string | null;
};

export type ActiveBattleRow = {
  id: string;
  target_hex_id: string;
  attacker_community_id: string;
  defender_community_id: string | null;
  status: string;
  ends_at?: string | null;
  started_at?: string | null;
  current_defense?: number | null;
  initial_defense?: number | null;
  attacker_score?: number | null;
  defender_score?: number | null;
  attacker?: BattleCommunityRef | null;
  defender?: BattleCommunityRef | null;
};

export type RegionCommunitiesRow = {
  id: string;
  name: string;
  color: string | null;
  capital_hex_id?: string | null;
};
export type RawRegionRow = Omit<Partial<RegionOwnerRow>, "communities"> & {
  communities?: RegionCommunitiesRow[] | RegionCommunitiesRow | null;
};

export type DiplomacyStatus = "neutral" | "war" | "ally" | "ceasefire";
export type DiplomacyStateRow = {
  initiator_community_id: string;
  target_community_id: string;
  status: DiplomacyStatus;
};
export type DiplomacyMap = Record<string, DiplomacyStatus>;

export function makeDiplomacyKey(a: string, b: string) {
  return [a, b].sort().join("|");
}
