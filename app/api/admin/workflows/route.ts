import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { getSchedulerEnabled, getWorkflowSchedules, setSchedulerEnabled, updateWorkflowSchedules } from "@/lib/ai-system/scheduling/workflow-control";
import { runDueWorkflows, runWorkflowNow } from "@/lib/ai-system/scheduling/workflow-scheduler";
import { WorkflowKey } from "@/lib/ai-system/scheduling/workflow-runner";
import { requeueRecentPosts } from "@/lib/worker";

async function assertAdmin(request: NextRequest) {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    console.log("[Admin] No authenticated user");
    return { error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  }

  const { data: adminCheck, error: adminError } = await supabaseAdmin
    .from("users")
    .select("role, id, username")
    .eq("auth_id", user.id)
    .maybeSingle();

  console.log("[Admin] Auth check:", {
    auth_id: user.id,
    user: adminCheck?.username,
    role: adminCheck?.role,
    error: adminError?.message
  });

  if (adminError || !adminCheck) {
    console.error("[Admin] User not found or error:", adminError);
    return { error: NextResponse.json({ error: "Forbidden - User not found" }, { status: 403 }) };
  }

  if (adminCheck.role !== "admin") {
    console.warn("[Admin] Non-admin access attempt:", adminCheck.username, "role:", adminCheck.role);
    return { error: NextResponse.json({ error: "Forbidden - Admin role required" }, { status: 403 }) };
  }

  console.log("[Admin] Access granted:", adminCheck.username);
  return { userId: adminCheck.id };
}

export async function GET(request: NextRequest) {
  try {
    const { error } = await assertAdmin(request);
    if (error) return error;

    const schedules = await getWorkflowSchedules();
    const schedulerEnabled = await getSchedulerEnabled();

    return NextResponse.json({
      scheduler_enabled: schedulerEnabled,
      schedules,
    });
  } catch (err: any) {
    console.error("[Admin Workflows] GET error:", err);
    return NextResponse.json(
      { error: "Internal server error", details: err?.message },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  const { error, userId } = await assertAdmin(request);
  if (error) return error;

  const payload = await request.json();
  const action = payload.action;

  if (action === "toggle_scheduler") {
    const enabled = Boolean(payload.enabled);
    const ok = await setSchedulerEnabled(enabled);
    return NextResponse.json({ success: ok, enabled });
  }

  if (action === "bulk_update") {
    const schedules = Array.isArray(payload.schedules) ? payload.schedules : [];
    const ok = await updateWorkflowSchedules(schedules);
    return NextResponse.json({ success: ok });
  }

  if (action === "run_due") {
    const results = await runDueWorkflows();
    return NextResponse.json({ success: true, results });
  }

  if (action === "run_workflow") {
    const workflowKey = payload.workflow_key as WorkflowKey;
    if (!workflowKey) {
      return NextResponse.json({ error: "Missing workflow_key" }, { status: 400 });
    }
    const result = await runWorkflowNow(workflowKey, {
      trigger: "manual",
      requestedBy: userId ?? null,
    });
    return NextResponse.json({ success: result.success, result });
  }

  if (action === "requeue_recent_posts") {
    const hours = Number(payload.hours ?? 12);
    const safeHours = Number.isFinite(hours) && hours > 0 ? Math.min(hours, 168) : 12;
    const result = await requeueRecentPosts(safeHours);
    const hasError = "error" in result;
    return NextResponse.json({ success: !hasError, result }, { status: hasError ? 500 : 200 });
  }

  return NextResponse.json({ error: "Unknown action" }, { status: 400 });
}
