const DICEBEAR_BASE_URL = "https://api.dicebear.com/9.x";
const DEFAULT_COMMUNITY_COLOR = "7c3aed";
const COMMUNITY_VISUAL_STYLE = "shapes";

type DicebearParams = Record<string, string | string[] | undefined>;

function sanitizeHexColor(value?: string | null, fallback = DEFAULT_COMMUNITY_COLOR) {
  if (!value) {
    return fallback;
  }

  let normalized = value.trim();
  if (normalized.startsWith("#")) {
    normalized = normalized.slice(1);
  }

  if (normalized.length === 3) {
    normalized = normalized
      .split("")
      .map((char) => char + char)
      .join("");
  }

  if (!/^[0-9a-f]{6}$/i.test(normalized)) {
    return fallback;
  }

  return normalized.toLowerCase();
}

function lightenHexColor(hex: string, amount = 0.5) {
  const sanitized = sanitizeHexColor(hex);
  const toChannel = (value: number) => {
    const channel = Math.round(value + (255 - value) * amount);
    return channel.toString(16).padStart(2, "0");
  };

  const r = parseInt(sanitized.slice(0, 2), 16);
  const g = parseInt(sanitized.slice(2, 4), 16);
  const b = parseInt(sanitized.slice(4, 6), 16);

  return `${toChannel(r)}${toChannel(g)}${toChannel(b)}`;
}

function buildDicebearUrl(style: string, seed: string, params: DicebearParams = {}) {
  const query = new URLSearchParams();
  query.set("seed", seed);

  for (const [key, value] of Object.entries(params)) {
    if (!value) continue;

    if (Array.isArray(value)) {
      value.forEach((item) => query.append(key, item));
    } else {
      query.set(key, value);
    }
  }

  return `${DICEBEAR_BASE_URL}/${style}/svg?${query.toString()}`;
}

function buildCommunitySeed(base: string, color: string, suffix?: string) {
  const normalizedBase = base.trim() || "community";
  const normalizedColor = sanitizeHexColor(color);
  const parts = [normalizedBase, normalizedColor];
  if (suffix?.trim()) {
    parts.push(suffix.trim());
  }
  return parts.join("-");
}

export function formatCommunityColor(value?: string | null) {
  const normalized = sanitizeHexColor(value);
  return `#${normalized}`;
}

export function getCommunityAvatarUrl({
  communityId,
  seedSource,
  color,
}: {
  communityId: string;
  seedSource?: string;
  color?: string | null;
}) {
  const normalizedColor = sanitizeHexColor(color);
  const seed = buildCommunitySeed(seedSource || communityId, normalizedColor, "avatar");

  return buildDicebearUrl(COMMUNITY_VISUAL_STYLE, seed, {
    size: "320",
    scale: "110",
    "colors[]": [normalizedColor],
    backgroundColor: lightenHexColor(normalizedColor, 0.65),
  });
}

export function getCommunityBannerUrl({
  communityId,
  seedSource,
  color,
}: {
  communityId: string;
  seedSource?: string;
  color?: string | null;
}) {
  const normalizedColor = sanitizeHexColor(color);
  const seed = buildCommunitySeed(seedSource || communityId, normalizedColor, "banner");

  return buildDicebearUrl(COMMUNITY_VISUAL_STYLE, seed, {
    size: "1200",
    scale: "130",
    "colors[]": [normalizedColor],
    backgroundColor: lightenHexColor(normalizedColor, 0.78),
  });
}
