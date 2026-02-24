import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { logGameEvent } from "@/lib/logger";
import { getSchedulerEnabled } from "./workflow-control";
import { runWorkflow, WorkflowKey, WorkflowRunContext, WorkflowRunResult } from "./workflow-runner";

type ScheduleRow = {
  id: string;
  workflow_key: string;
  enabled: boolean;
  mode: "interval" | "event";
  interval_seconds: number | null;
  next_run_at: string | null;
};

async function claimSchedule(schedule: ScheduleRow, nowIso: string): Promise<boolean> {
  if (!schedule.interval_seconds || schedule.interval_seconds <= 0) {
    return false;
  }

  const nextRunAt = new Date(
    Date.parse(nowIso) + schedule.interval_seconds * 1000
  ).toISOString();

  const { data, error } = await supabaseAdmin
    .from("workflow_schedules")
    .update({
      last_run_at: nowIso,
      next_run_at: nextRunAt,
    })
    .eq("id", schedule.id)
    .lte("next_run_at", nowIso)
    .select("id")
    .maybeSingle();

  if (error || !data) {
    return false;
  }

  return true;
}

export async function runDueWorkflows(): Promise<WorkflowRunResult[]> {
  const results: WorkflowRunResult[] = [];
  const schedulerEnabled = await getSchedulerEnabled();
  if (!schedulerEnabled) {
    return results;
  }

  const nowIso = new Date().toISOString();
  const { data: schedules, error } = await supabaseAdmin
    .from("workflow_schedules")
    .select("id, workflow_key, enabled, mode, interval_seconds, next_run_at")
    .eq("enabled", true)
    .eq("mode", "interval")
    .lte("next_run_at", nowIso);

  if (error || !schedules?.length) {
    return results;
  }

  for (const schedule of schedules as ScheduleRow[]) {
    const claimed = await claimSchedule(schedule, nowIso);
    if (!claimed) {
      continue;
    }

    logGameEvent("WorkflowScheduler", `Running workflow ${schedule.workflow_key}`, "info");
    const result = await runWorkflow(schedule.workflow_key as WorkflowKey, {
      trigger: "scheduler",
    });
    results.push(result);
  }

  return results;
}

export async function runWorkflowNow(
  workflowKey: WorkflowKey,
  context: WorkflowRunContext = { trigger: "manual" }
): Promise<WorkflowRunResult> {
  const nowIso = new Date().toISOString();
  const { data: schedule } = await supabaseAdmin
    .from("workflow_schedules")
    .select("id, interval_seconds, mode")
    .eq("workflow_key", workflowKey)
    .maybeSingle();

  if (schedule?.mode === "interval" && schedule.interval_seconds) {
    const nextRunAt = new Date(
      Date.parse(nowIso) + schedule.interval_seconds * 1000
    ).toISOString();
    await supabaseAdmin
      .from("workflow_schedules")
      .update({ last_run_at: nowIso, next_run_at: nextRunAt })
      .eq("workflow_key", workflowKey);
  }

  return runWorkflow(workflowKey, context);
}
