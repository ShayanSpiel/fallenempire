import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function generateSlug(input: string) {
  const normalized = input
    .toLowerCase()
    .trim()
    .replace(/[_\s]+/g, "-")
    .replace(/[^a-z0-9-]/g, "")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")

  if (normalized.length > 0) {
    return normalized
  }

  return `community-${Math.random().toString(36).slice(2, 8)}`
}

export function isColumnMissingError(
  error: { message?: string } | null | undefined,
  columnName: string
) {
  return Boolean(error?.message?.includes(`column "${columnName}"`));
}

export function isSupabaseNetworkError(
  error: { message?: string; details?: string; code?: string } | null | undefined
) {
  const message = error?.message ?? "";
  const details = error?.details ?? "";
  const code = error?.code ?? "";

  return (
    message.includes("fetch failed") ||
    details.includes("ConnectTimeoutError") ||
    details.includes("UND_ERR_CONNECT_TIMEOUT") ||
    code === "UND_ERR_CONNECT_TIMEOUT"
  );
}

export function hexToRgba(hex: string, alpha: number) {
  if (!hex) return null;
  let normalized = hex.trim();
  if (normalized.startsWith("#")) {
    normalized = normalized.slice(1);
  }

  if (normalized.length === 3) {
    normalized = normalized
      .split("")
      .map((char) => char + char)
      .join("");
  }

  if (normalized.length !== 6) return null;

  const r = parseInt(normalized.slice(0, 2), 16);
  const g = parseInt(normalized.slice(2, 4), 16);
  const b = parseInt(normalized.slice(4, 6), 16);

  if ([r, g, b].some((value) => Number.isNaN(value))) {
    return null;
  }

  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}
