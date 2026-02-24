export const STRENGTH_DISPLAY_PRECISION = 1
export const STRENGTH_STORAGE_PRECISION = 3
export const DAILY_STRENGTH_INCREMENT = 0.1

function parseNumber(value?: number | string | null): number {
  if (typeof value === "number") {
    return value
  }

  if (typeof value === "string") {
    const parsed = Number(value)
    if (!Number.isNaN(parsed)) {
      return parsed
    }
  }

  return 0
}

export function parseStrengthValue(value?: number | string | null): number {
  return parseNumber(value)
}

export function roundStrength(value: number, precision = STRENGTH_DISPLAY_PRECISION): number {
  const factor = 10 ** precision
  return Math.round(value * factor) / factor
}

export function normalizeStrength(
  value?: number | string | null,
  precision = STRENGTH_DISPLAY_PRECISION,
): number {
  const numericValue = Math.max(0, parseStrengthValue(value))
  return roundStrength(numericValue, precision)
}

export function formatStrengthDisplay(value?: number | string | null): string {
  return normalizeStrength(value, STRENGTH_DISPLAY_PRECISION).toFixed(STRENGTH_DISPLAY_PRECISION)
}
