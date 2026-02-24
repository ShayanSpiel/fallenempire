import type { PostgrestError, SupabaseClient } from "@supabase/supabase-js";

export type UserProfileRow = {
  id: string;
  username?: string | null;
  avatar_url?: string | null;
  identity_label?: string | null;
  avatar_style?: string | null;
  avatar_background_color?: string | null;
  avatar_hair?: string | null;
  avatar_eyes?: string | null;
  avatar_mouth?: string | null;
  avatar_nose?: string | null;
  avatar_base_color?: string | null;
  avatar_hair_color?: string | null;
  avatar_eyebrows?: string | null;
  avatar_eye_shadow_color?: string | null;
  avatar_facial_hair?: string | null;
  avatar_ears?: string | null;
  avatar_earrings?: string | null;
  avatar_earring_color?: string | null;
  avatar_glasses?: string | null;
  avatar_glasses_color?: string | null;
  avatar_shirt?: string | null;
  avatar_shirt_color?: string | null;
};

const PROFILE_BASE_COLUMNS = ["id", "username", "avatar_url", "identity_label"];
const PROFILE_AVATAR_COLUMNS = [
  "avatar_style",
  "avatar_background_color",
  "avatar_hair",
  "avatar_eyes",
  "avatar_mouth",
  "avatar_nose",
  "avatar_base_color",
  "avatar_hair_color",
  "avatar_eyebrows",
  "avatar_eye_shadow_color",
  "avatar_facial_hair",
  "avatar_ears",
  "avatar_earrings",
  "avatar_earring_color",
  "avatar_glasses",
  "avatar_glasses_color",
  "avatar_shirt",
  "avatar_shirt_color",
];
const PROFILE_DESIRED_COLUMNS = [...PROFILE_BASE_COLUMNS, ...PROFILE_AVATAR_COLUMNS];
const REQUIRED_COLUMNS = new Set(["id"]);
const missingColumns = new Set<string>();

const missingColumnRegex =
  /column\s+(?:(?:\"?[\w]+\"?)\.)?(?:\"?)([\w_]+)(?:\"?)\s+does not exist/i;

function parseMissingColumnFromMessage(message?: string) {
  if (!message) {
    return null;
  }
  const match = message.match(missingColumnRegex);
  return match ? match[1] : null;
}

function flagMissingColumn(column: string | null) {
  if (!column || REQUIRED_COLUMNS.has(column)) {
    return false;
  }
  missingColumns.add(column);
  return true;
}

function getSelectableColumns() {
  return PROFILE_DESIRED_COLUMNS.filter((column) => !missingColumns.has(column));
}

function removeUndefinedValues<T extends Record<string, unknown>>(payload: T): T {
  return Object.fromEntries(
    Object.entries(payload).filter(([, value]) => value !== undefined)
  ) as T;
}

function filterPayloadForExistingColumns<T extends Record<string, unknown>>(payload: T): T {
  const entries = Object.entries(payload).filter(([column]) => !missingColumns.has(column));
  return Object.fromEntries(entries) as T;
}

export async function selectUserProfile(
  supabase: SupabaseClient,
  authId: string
): Promise<UserProfileRow | null> {
  let selectColumns = getSelectableColumns();

  if (selectColumns.length === 0) {
    throw new Error("No available profile columns to select");
  }

  while (selectColumns.length) {
    const { data, error } = await supabase
      .from("users")
      .select(selectColumns.join(", "))
      .eq("auth_id", authId)
      .maybeSingle();

    if (!error) {
      return data as UserProfileRow | null;
    }

    const missingColumn = parseMissingColumnFromMessage(error.message);
    const removed = flagMissingColumn(missingColumn);

    if (removed) {
      selectColumns = getSelectableColumns();
      continue;
    }

    throw error;
  }

  throw new Error("Failed to select user profile columns");
}

export async function updateUserRowWithAvailableColumns(
  supabase: SupabaseClient,
  userId: string,
  payload: Record<string, unknown>
): Promise<PostgrestError | null> {
  let updatePayload = filterPayloadForExistingColumns(removeUndefinedValues(payload));

  if (!Object.keys(updatePayload).length) {
    return null;
  }

  while (Object.keys(updatePayload).length) {
    const { error } = await supabase.from("users").update(updatePayload).eq("id", userId);

    if (!error) {
      return null;
    }

    const missingColumn = parseMissingColumnFromMessage(error.message);
    const removed = missingColumn && Object.prototype.hasOwnProperty.call(updatePayload, missingColumn)
      ? flagMissingColumn(missingColumn)
      : false;

    if (removed && missingColumn) {
      delete updatePayload[missingColumn];
      updatePayload = filterPayloadForExistingColumns(updatePayload);
      if (!Object.keys(updatePayload).length) {
        return null;
      }
      continue;
    }

    return error;
  }

  return null;
}
