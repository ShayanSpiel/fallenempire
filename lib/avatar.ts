const BACKGROUND_COLORS = [
  "b6e3f4",
  "c0aede",
  "d1d4f9",
  "ffdfbf",
  "fdcdc5",
].join(",")

export function resolveAvatar({
  avatarUrl,
  seed,
  style,
  avatarHair,
  avatarEyes,
  avatarMouth,
  avatarNose,
}: {
  avatarUrl?: string | null
  seed?: string | null
  style?: "thumbs" | "micah" | "lorelei"
  avatarHair?: string | null
  avatarEyes?: string | null
  avatarMouth?: string | null
  avatarNose?: string | null
} = {}) {
  if (avatarUrl) {
    return avatarUrl
  }

  if (!seed) {
    return undefined
  }

  const hasCustomParts = Boolean(avatarHair || avatarEyes || avatarMouth || avatarNose)
  const resolvedStyle = style ?? (hasCustomParts ? "micah" : "micah")

  const safeSeed = (seed ?? "avatar").trim() || "avatar"
  const params = new URLSearchParams({
    seed: safeSeed,
    backgroundColor: BACKGROUND_COLORS,
  })

  // Add Micah-specific parameters
  if (resolvedStyle === "micah") {
    if (avatarHair) params.append("hair", avatarHair)
    if (avatarEyes) params.append("eyes", avatarEyes)
    if (avatarMouth) params.append("mouth", avatarMouth)
    if (avatarNose) params.append("nose", avatarNose)
  }

  return `https://api.dicebear.com/9.x/${resolvedStyle}/svg?${params.toString()}`
}

export function getAvatarUrl(seed?: string | null, style?: "thumbs" | "micah" | "lorelei") {
  return resolveAvatar({ seed, style })
}
