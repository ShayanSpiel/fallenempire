import { createServerClient, type CookieMethodsServer } from "@supabase/ssr";
import { cookies } from "next/headers";

type SupabaseClientOptions = {
  canSetCookies?: boolean;
};

export async function createSupabaseServerClient(options?: SupabaseClientOptions) {
  const cookieStore = await cookies();
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error("Missing Supabase environment variables");
  }

  const cookieMethods: CookieMethodsServer = {
    getAll() {
      return cookieStore.getAll().map((cookie) => ({
        name: cookie.name,
        value: cookie.value,
      }));
    },
  };

  const allowSetCookies = options?.canSetCookies ?? false;

  if (allowSetCookies) {
    // Only try to set cookies if explicitly allowed
    const mutableStore = cookieStore as unknown as {
      set?: (cookie: { name: string; value: string } & Record<string, unknown>) => void;
    };

    if (typeof mutableStore.set === "function") {
      cookieMethods.setAll = (cookiesToSet) => {
        cookiesToSet.forEach(({ name, value, options }) => {
          try {
            mutableStore.set?.({ name, value, ...options });
          } catch (err) {
            // Silently fail if we can't set cookies (e.g., during static generation)
            console.debug("Could not set cookie:", name, err instanceof Error ? err.message : err);
          }
        });
      };
    }
  }

  // Always provide setAll, even if it's a no-op
  if (!cookieMethods.setAll) {
    cookieMethods.setAll = () => {};
  }

  return createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: cookieMethods,
  });
}
