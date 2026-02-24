import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

async function assertAdmin(request: NextRequest) {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    console.log("[Admin WorkflowRuns] No authenticated user");
    return { error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  }

  const { data: adminCheck, error: adminError } = await supabaseAdmin
    .from("users")
    .select("role, id, username")
    .eq("auth_id", user.id)
    .maybeSingle();

  console.log("[Admin WorkflowRuns] Auth check:", {
    auth_id: user.id,
    user: adminCheck?.username,
    role: adminCheck?.role,
    error: adminError?.message
  });

  if (adminError || !adminCheck) {
    console.error("[Admin WorkflowRuns] User not found or error:", adminError);
    return { error: NextResponse.json({ error: "Forbidden - User not found" }, { status: 403 }) };
  }

  if (adminCheck.role !== "admin") {
    console.warn("[Admin WorkflowRuns] Non-admin access attempt:", adminCheck.username, "role:", adminCheck.role);
    return { error: NextResponse.json({ error: "Forbidden - Admin role required" }, { status: 403 }) };
  }

  return {};
}

export async function GET(request: NextRequest) {
  const { error } = await assertAdmin(request);
  if (error) return error;

  const { searchParams } = new URL(request.url);
  const limitParam = parseInt(searchParams.get("limit") || "", 10);
  const limit = Number.isFinite(limitParam) ? Math.min(Math.max(limitParam, 1), 100) : 20;
  const workflowKey = searchParams.get("workflow_key");
  const status = searchParams.get("status");

  let query = supabaseAdmin
    .from("workflow_runs")
    .select("*")
    .order("started_at", { ascending: false })
    .limit(limit);

  if (workflowKey) {
    query = query.eq("workflow_key", workflowKey);
  }

  if (status) {
    query = query.eq("status", status);
  }

  const { data, error: queryError } = await query;
  if (queryError) {
    return NextResponse.json({ error: queryError.message }, { status: 500 });
  }

  return NextResponse.json({ runs: data ?? [] });
}
