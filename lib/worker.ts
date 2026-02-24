import { supabaseAdmin } from "./supabaseAdmin";
import { runPostProcessingCycle } from "@/lib/ai-system/services/post-processor";
import { logGameEvent } from "./logger";

type QueueRecord = {
  post_id: string;
  user_id: string;
};

export async function enqueuePostForProcessing(postId: string, userId: string) {
  const { error } = await supabaseAdmin.from("post_processing_queue").insert({
    post_id: postId,
    user_id: userId,
    action_type: "post.created",
  });

  if (error) {
    console.error("Queue Insert Error:", error.message ?? error);
  }
}

export async function requeueRecentPosts(hours: number, limit = 10) {
  const since = new Date(Date.now() - hours * 60 * 60 * 1000).toISOString();
  const loadPosts = async <TSelect extends string>(selectFields: TSelect) => {
    return supabaseAdmin
      .from("posts")
      .select(selectFields)
      .gte("created_at", since)
      .order("created_at", { ascending: false })
      .limit(limit)
      .returns<any[]>();
  };

  const { data: recentPosts, error: postsError } = await loadPosts("id, user_id, created_at");
  let posts: any[] = recentPosts ?? [];

  if (postsError) {
    console.error("Requeue load error", postsError);
    const message = String(postsError.message || "");
    if (message.includes("column") || message.includes("user_id")) {
      const { data: fallbackPosts, error: fallbackError } = await loadPosts(
        "id, author_id, created_at"
      );
      if (fallbackError) {
        console.error("Requeue fallback load error", fallbackError);
        logGameEvent("Worker", "Failed to load recent posts", "error", {
          error: fallbackError,
        });
        return { error: fallbackError.message ?? "Failed to load recent posts" };
      }
      posts = (fallbackPosts ?? []).map((row: any) => ({
        id: row.id,
        user_id: row.author_id,
        created_at: row.created_at,
      }));
    } else {
      logGameEvent("Worker", "Failed to load recent posts", "error", { error: postsError });
      return { error: postsError.message ?? "Failed to load recent posts" };
    }
  }

  if (posts.length === 0) {
    return { queuedCount: 0, skippedCount: 0, totalPosts: 0 };
  }

  const postIds = posts.map((post) => post.id);
  const { data: queuedRows } = await supabaseAdmin
    .from("post_processing_queue")
    .select("post_id")
    .in("post_id", postIds);

  const queuedSet = new Set((queuedRows ?? []).map((row) => row.post_id));
  const toQueue = posts
    .filter((post: any) => post.user_id && !queuedSet.has(post.id))
    .map((post) => ({
      post_id: post.id,
      user_id: post.user_id,
      action_type: "post.created",
    }));

  if (toQueue.length > 0) {
    const { error: insertError } = await supabaseAdmin
      .from("post_processing_queue")
      .insert(toQueue);
    if (insertError) {
    console.error("Requeue insert error", insertError);
    logGameEvent("Worker", "Failed to requeue posts", "error", { error: insertError });
      return { error: "Failed to requeue posts" };
    }
  }

  return {
    queuedCount: toQueue.length,
    skippedCount: posts.length - toQueue.length,
    totalPosts: posts.length,
  };
}

export async function runPostProcessingWorker() {
  logGameEvent("Worker", "--- POST PROCESSING CYCLE ---", "info");

  // Use new universal workflow-based post processor
  // This gets 5 recent posts and sends 5 agents to review them
  const result = await runPostProcessingCycle();

  if (!result.success) {
    logGameEvent("Worker", "Post processing cycle failed", "error", { errors: result.errors });
    return { error: "Processing failed", details: result.errors };
  }

  logGameEvent(
    "Worker",
    `Cycle complete: ${result.postsProcessed} posts, ${result.agentsUsed} agents, ${result.totalWorkflows} workflows`,
    "success"
  );

  return {
    success: true,
    postsProcessed: result.postsProcessed,
    agentsUsed: result.agentsUsed,
    totalWorkflows: result.totalWorkflows,
    errors: result.errors,
  };
}
