/**
 * Application Constants and Magic Number Configuration
 *
 * This file centralizes all magic numbers, limits, and configuration values
 * to eliminate hardcoding throughout the application.
 */

// Data Fetching Limits
export const DATA_LIMITS = {
  LEADERBOARD_ENTRIES: 50,
  MESSAGES_PER_THREAD: 50,
  INITIAL_CONVERSATIONS: 100,
  COMMUNITY_CHAT_HISTORY: 100,
  USER_SEARCH_RESULTS: 20,
} as const;

// API Timeouts (in milliseconds)
export const API_TIMEOUTS = {
  COMMUNITY_CHAT_HISTORY: 5000,
  DEFAULT_REQUEST: 30000,
  FILE_UPLOAD: 60000,
} as const;

// Input Constraints
export const INPUT_CONSTRAINTS = {
  MAX_MESSAGE_LENGTH: 500,
  MAX_COMMUNITY_MESSAGE_LENGTH: 500,
  MAX_COMMENT_LENGTH: 1000,
  MAX_USERNAME_LENGTH: 50,
  MAX_COMMUNITY_NAME_LENGTH: 100,
  MESSAGE_PREVIEW_LENGTH: 50,
  TEXTAREA_MIN_HEIGHT: '90px',
} as const;

// AI Configuration
export const AI_CONFIG = {
  DEFAULT_PROVIDER: 'gemini',
  DEFAULT_MODEL: 'gemini-pro',
  MAX_TOKENS: 200,
  TEMPERATURE_ANALYTICAL: 0.1,
  TEMPERATURE_CREATIVE: 0.8,
  TEMPERATURE_BALANCED: 0.7,
  SYSTEM_PROMPT_CHARACTER_LIMIT: 500,
} as const;

// UI Layout Heights (in pixels)
export const LAYOUT_HEIGHTS = {
  COMMUNITY_CHAT_CONTAINER: 'calc(100vh - 220px)',
  MOBILE_HEADER: 56,
  DESKTOP_HEADER: 64,
  FOOTER: 56,
} as const;

// Pagination Configuration
export const PAGINATION = {
  DEFAULT_PAGE_SIZE: 20,
  LEADERBOARD_PAGE_SIZE: 10,
  MESSAGES_PAGE_SIZE: 50,
  COMMUNITIES_PAGE_SIZE: 20,
} as const;

// Performance Thresholds
export const PERFORMANCE = {
  DEBOUNCE_TYPING: 300,
  DEBOUNCE_SEARCH: 300,
  DEBOUNCE_SCROLL: 200,
  CACHE_DURATION_MS: 300000, // 5 minutes
  RANK_CACHE_TTL: 600000, // 10 minutes
} as const;

// Rank System Configuration
export const RANK_SYSTEM = {
  FALLBACK_RANKS: {
    KING: 'King',
    SECRETARY: 'Secretary',
    MEMBER: 'Member',
    RECRUIT: 'Recruit',
  },
  DEFAULT_RANK_TIER: 10,
  LEADER_TIER: 1,
  FOUNDER_TIER: 0,
} as const;

// Command Configuration
export const COMMANDS = [
  {
    label: '/summary',
    description:
      'Digest recent community logs (law proposals, leadership shifts, secretary updates, message of the day, and more).',
    badgeLabel: 'Events',
    badgeVariant: 'accent' as const,
  },
  {
    label: '/kick [username]',
    description: 'Founder or leader command to expel a disruptive operative instantly.',
    badgeLabel: 'Leader only',
    badgeVariant: 'warning' as const,
  },
  {
    label: '/mute [username]',
    description: 'Coming soon: temporarily silence a user while negotiations are underway.',
    badgeLabel: 'Coming soon',
    badgeVariant: 'minimal' as const,
  },
] as const;

// Panel Configuration
export const PANEL_OPTIONS = [
  { id: 'chat', label: 'Chat' },
  { id: 'command', label: 'Command Center' },
] as const;

// Modal Configuration
export const MODAL_CONFIG = {
  BACKDROP_OPACITY: 'bg-background/80',
  Z_INDEX: 'z-50',
} as const;

// Error Messages
export const ERROR_MESSAGES = {
  GENERIC_FAILURE: 'An error occurred. Please try again.',
  KICK_UNAUTHORIZED: 'Authorization failed. Only founders or leaders can use /kick.',
  INVALID_COMMAND_USAGE: 'Usage: /kick <username>',
  FETCH_TIMEOUT: 'Request timed out. Please try again.',
  INVALID_MESSAGE: 'Invalid message format',
  AI_GENERATION_FAILED: 'I encountered an error processing your request. Please try again.',
} as const;

// Success Messages
export const SUCCESS_MESSAGES = {
  KICK_SUCCESS: 'Member kicked successfully',
  MESSAGE_SENT: 'Message sent',
  COMMAND_EXECUTED: 'Command executed',
} as const;

// Category and Badge Styling
export const BADGE_STYLES = {
  LEADER: 'accent',
  SECRETARY: 'secondary',
  MEMBER: 'minimal',
} as const;

// Chat UI Configuration
export const CHAT_UI = {
  MESSAGE_ITEM_PADDING: 'py-4',
  PLACEHOLDER_ICON_SIZE: 12,
  LOADING_ICON_SIZE: 12,
  SEND_BUTTON_ICON_SIZE: 14,
  INPUT_MAX_LENGTH: 500,
  INPUT_PLACEHOLDER_SELECTOR: '.chat-input',
} as const;

export default {
  DATA_LIMITS,
  API_TIMEOUTS,
  INPUT_CONSTRAINTS,
  AI_CONFIG,
  LAYOUT_HEIGHTS,
  PAGINATION,
  PERFORMANCE,
  RANK_SYSTEM,
  COMMANDS,
  PANEL_OPTIONS,
  MODAL_CONFIG,
  ERROR_MESSAGES,
  SUCCESS_MESSAGES,
  BADGE_STYLES,
  CHAT_UI,
};
