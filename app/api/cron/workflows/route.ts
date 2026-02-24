import { NextRequest, NextResponse } from "next/server";
import { runDueWorkflows } from "@/lib/ai-system/scheduling/workflow-scheduler";

const WORKFLOW_SECRET = process.env.WORKFLOW_SCHEDULER_SECRET ?? "";

export async function GET(request: NextRequest) {
  const secret = request.nextUrl.searchParams.get("secret");
  if (!WORKFLOW_SECRET || secret !== WORKFLOW_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const results = await runDueWorkflows();
  return NextResponse.json({ success: true, results });
}
