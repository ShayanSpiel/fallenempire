import { createBrowserClient } from "@supabase/ssr";

// Singleton pattern to prevent multiple GoTrueClient instances
let supabaseClient: ReturnType<typeof createBrowserClient> | null = null;

export function createSupabaseBrowserClient() {
  // Return existing instance if already created (prevents multiple GoTrueClient warnings)
  if (supabaseClient) {
    return supabaseClient;
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error("Missing Supabase environment variables");
  }

  supabaseClient = createBrowserClient(supabaseUrl, supabaseAnonKey);
  return supabaseClient;
}
