import { supabaseAdmin } from "@/lib/supabaseAdmin";

export type WorkflowMode = "interval" | "event";

export interface WorkflowSchedule {
  id: string;
  workflow_key: string;
  display_name: string;
  mode: WorkflowMode;
  enabled: boolean;
  interval_seconds: number | null;
  last_run_at: string | null;
  next_run_at: string | null;
}

export async function getWorkflowSchedules(): Promise<WorkflowSchedule[]> {
  const { data, error } = await supabaseAdmin
    .from("workflow_schedules")
    .select("*")
    .order("workflow_key", { ascending: true });

  if (error || !data) {
    console.warn("[WorkflowControl] Failed to load schedules:", error);
    return [];
  }

  return data as WorkflowSchedule[];
}

export async function isWorkflowEnabled(workflowKey: string): Promise<boolean> {
  try {
    const { data, error } = await supabaseAdmin
      .from("workflow_schedules")
      .select("enabled")
      .eq("workflow_key", workflowKey)
      .maybeSingle();

    if (error) {
      console.warn("[WorkflowControl] Failed to check workflow:", error);
      return true;
    }

    if (!data) {
      return true;
    }

    return data.enabled !== false;
  } catch (error) {
    console.warn("[WorkflowControl] Workflow check error:", error);
    return true;
  }
}

export async function getSchedulerEnabled(): Promise<boolean> {
  try {
    const { data, error } = await supabaseAdmin
      .from("simulation_control")
      .select("scheduler_enabled")
      .limit(1);

    if (error || !data?.length) {
      return true;
    }

    return data[0].scheduler_enabled !== false;
  } catch (error) {
    console.warn("[WorkflowControl] Scheduler check error:", error);
    return true;
  }
}

export async function setSchedulerEnabled(enabled: boolean): Promise<boolean> {
  try {
    const { data: records, error: selectError } = await supabaseAdmin
      .from("simulation_control")
      .select("id")
      .limit(1);

    if (selectError || !records || records.length === 0) {
      console.warn("[WorkflowControl] No simulation control record found");
      return false;
    }

    const { error } = await supabaseAdmin
      .from("simulation_control")
      .update({ scheduler_enabled: enabled })
      .eq("id", records[0].id);

    if (error) {
      console.warn("[WorkflowControl] Failed to update scheduler:", error);
      return false;
    }

    return true;
  } catch (error) {
    console.warn("[WorkflowControl] Scheduler update error:", error);
    return false;
  }
}

export async function updateWorkflowSchedules(
  schedules: Array<Pick<WorkflowSchedule, "workflow_key" | "enabled" | "interval_seconds">>
): Promise<boolean> {
  try {
    const now = new Date();
    for (const schedule of schedules) {
      const intervalSeconds =
        typeof schedule.interval_seconds === "number"
          ? schedule.interval_seconds
          : null;

      let nextRunAt: string | null = null;
      if (schedule.enabled && intervalSeconds && intervalSeconds > 0) {
        nextRunAt = new Date(now.getTime() + intervalSeconds * 1000).toISOString();
      }

      const { error } = await supabaseAdmin
        .from("workflow_schedules")
        .update({
          enabled: schedule.enabled,
          interval_seconds: intervalSeconds,
          next_run_at: nextRunAt,
        })
        .eq("workflow_key", schedule.workflow_key);

      if (error) {
        console.warn("[WorkflowControl] Failed to update workflow:", error);
        return false;
      }
    }

    return true;
  } catch (error) {
    console.warn("[WorkflowControl] Workflow update error:", error);
    return false;
  }
}
