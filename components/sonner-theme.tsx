/**
 * Sonner Toast Theme Configuration
 * Provides consistent styling for all toast notifications across the app
 */

import { CSSProperties } from "react";

export const sonnerTheme = {
  light: {
    background: "#fffdf6",
    foreground: "#2c1f10",
    border: "rgba(80, 60, 34, 0.25)",
    radius: "0.75rem",
  },
  dark: {
    background: "#0b1d3a",
    foreground: "#dbeafe",
    border: "rgba(148, 163, 184, 0.3)",
    radius: "0.75rem",
  },
} as const;

/**
 * Custom Sonner theme styles
 * Applied to the Toaster component for consistent appearance
 */
export const sonnerToasterStyles: CSSProperties = {
  fontFamily: "var(--font-oxanium, Oxanium, system-ui, sans-serif)",
};

/**
 * Toast wrapper styles for consistent padding and spacing
 */
export const toastContainerStyles = {
  padding: "0.75rem 1rem",
  gap: "0.75rem",
  borderRadius: "0.75rem",
  fontSize: "0.875rem",
  lineHeight: "1.25rem",
  fontWeight: 500,
} as const;
