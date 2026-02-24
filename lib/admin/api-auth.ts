import { NextRequest, NextResponse } from "next/server";

import { createSupabaseServerClient } from "@/lib/supabase-server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export async function assertAdmin(request: NextRequest) {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  }

  const { data: adminCheck, error: adminError } = await supabaseAdmin
    .from("users")
    .select("role, id")
    .eq("auth_id", user.id)
    .maybeSingle();

  if (adminError || !adminCheck || adminCheck.role !== "admin") {
    return { error: NextResponse.json({ error: "Forbidden" }, { status: 403 }) };
  }

  return { userId: adminCheck.id, authId: user.id };
}

