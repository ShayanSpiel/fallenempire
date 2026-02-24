type LogLevel = "info" | "warn" | "error" | "success" | "debug";

const isDev = process.env.NODE_ENV === "development";

const AGENT_LOG_KEYWORD = "agent";

const formatPayload = (data: unknown) => {
  if (!data) return {};
  if (typeof data === "object" && !Array.isArray(data)) {
    return data as Record<string, unknown>;
  }
  return { detail: data };
};

/**
 * Development debug logging with optional directory-level metadata
 * Agent module logs are persisted to the `game_logs` table when running on the server.
 */
export const debug = (moduleName: string, message: string, data?: unknown) => {
  if (isDev) {
    console.log(
      `%c[${moduleName}]`,
      "color: #0f0; font-weight: bold",
      message,
      data ?? ""
    );
  }

  const shouldPersist =
    typeof window === "undefined" &&
    moduleName.toLowerCase().includes(AGENT_LOG_KEYWORD);

  if (shouldPersist) {
    void logGameEvent(moduleName, message, "debug", formatPayload(data));
  }
};

/**
 * Client-side info logging (dev only)
 */
export const info = (...args: any[]) => {
  if (isDev) {
    console.log("[INFO]", ...args);
  }
};

/**
 * Client-side warning logging (dev only)
 */
export const warn = (...args: any[]) => {
  if (isDev) {
    console.warn("[WARN]", ...args);
  }
};

/**
 * Client-side error logging (always logged, critical errors)
 */
export const error = (...args: any[]) => {
  // Always log errors - use sparingly for critical issues only
  console.error("[ERROR]", ...args);
};

/**
 * Server-side game event logging with database persistence
 * Logs to game_logs table and console
 */
export async function logGameEvent(
  source: string,
  message: string,
  level: LogLevel = "info",
  metadata: Record<string, unknown> = {}
) {
  try {
    const color =
      level === "error"
        ? "\x1b[31m"
        : level === "success"
        ? "\x1b[32m"
        : level === "warn"
        ? "\x1b[33m"
        : level === "debug"
        ? "\x1b[36m"
        : "\x1b[36m";
    console.log(`${color}[${source}] ${message}\x1b[0m`);

    const { supabaseAdmin } = await import("./supabaseAdmin");

    await supabaseAdmin.from("game_logs").insert({
      source,
      message,
      level,
      metadata,
    });
  } catch (error) {
    console.error("Logger failed:", error);
  }
}
