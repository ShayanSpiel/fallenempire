/**
 * Battle System Constants
 * Centralized constants for the battle system
 */

export const WALL_IMG_URL = "https://i.ibb.co/d0z6xq1q/town.png";

// Durations (milliseconds)
export const LOG_TOAST_DURATION = 21000;
export const FLOATING_HIT_DURATION = 650;
export const HERO_BUMP_DURATION = 220;
export const SCORE_BUMP_DURATION = 150;
export const TIMER_UPDATE_INTERVAL = 1000;
export const CRITICAL_THRESHOLD_MS = 5 * 60 * 1000; // 5 minutes
export const FIGHT_BUTTON_COOLDOWN_MS = 300;

// Styling
export const WALL_CONTAINER_STYLE = {
  paddingTop: "0",
  paddingBottom: "7rem",
  marginTop: "-3rem",
} as const;

// Battle status groups
export const ATTACKER_VICTORY_STATUSES = ["attacker_win", "attacker_won"] as const;
export const DEFENDER_VICTORY_STATUSES = ["defender_win", "defender_won"] as const;
