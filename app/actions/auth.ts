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
    throw new Error("Unable to create user profile. Please try again.");
  }
}

function sanitizeAuthError(message: string): string {
  const errorMap: Record<string, string> = {
    "Invalid login credentials": "Email or password is incorrect. Please try again.",
    "Email not confirmed": "Please verify your email address before logging in.",
    "User already registered": "This email is already registered. Please log in instead.",
    "Password should be at least 6 characters": "Password must be at least 6 characters long.",
    "Email format is invalid": "Please enter a valid email address.",
    "User not found": "No account found with this email. Please sign up first.",
  };

  for (const [key, value] of Object.entries(errorMap)) {
    if (message.toLowerCase().includes(key.toLowerCase())) {
      return value;
    }
  }

  return message || "An unexpected error occurred. Please try again.";
}

export async function loginAction(
  _prev: AuthActionState,
  formData: FormData
): Promise<AuthActionState> {
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");

  if (!email) {
    return { error: "Email address is required" };
  }

  if (!password) {
    return { error: "Password is required" };
  }

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return { error: "Please enter a valid email address" };
  }

  const supabase = await createSupabaseServerClient({ canSetCookies: true });

  const { error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (error) {
    return { error: sanitizeAuthError(error.message) };
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user) {
    try {
      await ensureProfileExists(
        supabase,
        user.id,
        user.user_metadata?.username ?? user.email,
        user.email ?? null
      );
    } catch (err) {
      return { error: "Failed to initialize profile. Please try again." };
    }
  }

  revalidatePath("/feed");
  redirect("/feed");
  return { error: null };
}

export async function registerAction(
  _prev: AuthActionState,
  formData: FormData
): Promise<AuthActionState> {
  const username = String(formData.get("username") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  const confirmPassword = String(formData.get("confirmPassword") ?? "");

  if (!username) {
    return { error: "Username is required" };
  }

  if (!email) {
    return { error: "Email address is required" };
  }

  if (!password) {
    return { error: "Password is required" };
  }

  if (!confirmPassword) {
    return { error: "Please confirm your password" };
  }

  if (username.length < 3 || username.length > 32) {
    return { error: "Username must be between 3 and 32 characters" };
  }

  if (!/^[a-zA-Z0-9_-]+$/.test(username)) {
    return { error: "Username can only contain letters, numbers, underscores, and hyphens" };
  }

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return { error: "Please enter a valid email address" };
  }

  if (password.length < 6) {
    return { error: "Password must be at least 6 characters long" };
  }

  if (password !== confirmPassword) {
    return { error: "Passwords do not match" };
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
    return { error: sanitizeAuthError(error.message) };
  }

  const authUser = data.user;

  if (authUser) {
    try {
      await ensureProfileExists(supabase, authUser.id, username, email);
    } catch (err) {
      return { error: "Account created but profile setup failed. Please log in." };
    }
  }

  if (!data.session) {
    const { error: loginError } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (loginError) {
      return { error: sanitizeAuthError(loginError.message) };
    }
  }

  revalidatePath("/feed");
  redirect("/feed");
  return { error: null };
}

export async function logoutAction() {
  const supabase = await createSupabaseServerClient({ canSetCookies: true });
  await supabase.auth.signOut();
  revalidatePath("/");
  revalidatePath("/feed");
  redirect("/");
}
