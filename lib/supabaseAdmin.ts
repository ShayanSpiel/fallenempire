import { SupabaseClient, createClient } from "@supabase/supabase-js";

declare global {
  // eslint-disable-next-line no-var
  var __supabase__admin: SupabaseClient | undefined;
}

const supabaseUrlEnv = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKeyEnv = process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrlEnv || !serviceRoleKeyEnv) {
  throw new Error("Missing Supabase configuration");
}

const supabaseUrl = supabaseUrlEnv;
const serviceRoleKey = serviceRoleKeyEnv;

function createAdminClient() {
  return createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
    global: {
      headers: { "x-application-name": "eIntelligence-Worker" },
    },
  });
}

export const supabaseAdmin =
  globalThis.__supabase__admin ?? (globalThis.__supabase__admin = createAdminClient());
