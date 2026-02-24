"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { createSupabaseServerClient } from "@/lib/supabase-server";
import type { AuthActionState } from "@/components/auth/auth-form";

async function ensureProfileExists(
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>,
  authId: string,
  username?: string | null,
  email?: string | null
) {
  const { data: profile } = await supabase
    .from("users")
    .select("id")
    .eq("auth_id", authId)
    .maybeSingle();

  if (profile) {
    return profile;
  }

  const fallbackUsername = username?.trim() || `player-${authId.slice(0, 5)}`;

  const { error: insertError } = await supabase.from("users").insert({
    username: fallbackUsername,
    auth_id: authId,
    email: email ?? null,
    is_bot: false,
  });

  if (insertError) {
    console.error("Failed to insert user profile", insertError.message);
    throw new Error("Could not create your profile. Try again.");
  }
}

export async function loginAction(
  _prev: AuthActionState,
  formData: FormData
): Promise<AuthActionState> {
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");

  if (!email || !password) {
    return { message: "Email and password are required" };
  }

  const supabase = await createSupabaseServerClient({ canSetCookies: true });

  const { error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (error) {
    return { message: error.message };
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();

    if (user) {
      await ensureProfileExists(
        supabase,
        user.id,
        user.user_metadata?.username ?? user.email,
        user.email ?? null
      );
    }

  revalidatePath("/feed");
  redirect("/feed");
  return { message: null };
}

export async function registerAction(
  _prev: AuthActionState,
  formData: FormData
): Promise<AuthActionState> {
  const username = String(formData.get("username") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");

  if (!username || !email || !password) {
    return { message: "All fields are required" };
  }

  const supabase = await createSupabaseServerClient({ canSetCookies: true });

  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: { username },
    },
  });

  if (error) {
    return { message: error.message };
  }

  const authUser = data.user;

    if (authUser) {
      await ensureProfileExists(supabase, authUser.id, username, email);
    }

  if (!data.session) {
    const { error: loginError } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (loginError) {
      return { message: loginError.message };
    }
  }

  revalidatePath("/feed");
  redirect("/feed");
  return { message: null };
}

export async function logoutAction() {
  const supabase = await createSupabaseServerClient({ canSetCookies: true });
  await supabase.auth.signOut();
  revalidatePath("/");
  revalidatePath("/feed");
  redirect("/");
}
