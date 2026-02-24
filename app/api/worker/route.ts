import { NextResponse } from "next/server";
import { runPostProcessingWorker } from "@/lib/worker";
import { isWorkflowEnabled } from "@/lib/ai-system/scheduling/workflow-control";

const WORKER_SECRET = process.env.WORKER_SECRET ?? "default-secret";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const secret = url.searchParams.get("secret");

  if (secret !== WORKER_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const postsEnabled = await isWorkflowEnabled("agent.posts");
    if (!postsEnabled) {
      return NextResponse.json(
        { error: "Post processing workflow is disabled" },
        { status: 403 }
      );
    }
    const result = await runPostProcessingWorker();
    return NextResponse.json(result, { status: 200 });
  } catch (error) {
    console.error("Worker error:", error);
    return NextResponse.json({ error: "Worker failed" }, { status: 500 });
  }
}
