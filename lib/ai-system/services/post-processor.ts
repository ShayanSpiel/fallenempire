/**
 * POST PROCESSING SERVICE
 * Processes recent posts using the universal workflow
 *
 * Each cycle:
 * - Get 5 most recent posts
 * - Select 5 random active agents
 * - Each agent reviews posts via universal workflow and can:
 *   - Comment on posts
 *   - Like posts
 *   - Follow post authors
 *   - Ignore
 */

import { supabaseAdmin } from "../../supabaseAdmin";
import { executeUniversalWorkflow, createInitialState } from "../workflows/universal";
import { logGameEvent } from "../../logger";

/**
 * Run post processing cycle
 * Gets recent posts and sends agents to react to them
 */
export async function runPostProcessingCycle(): Promise<{
  success: boolean;
  postsProcessed: number;
  agentsUsed: number;
  totalWorkflows: number;
  errors: string[];
}> {
  const errors: string[] = [];

  try {
    // 1. Get 5 most recent posts
    const { data: recentPosts, error: postsError } = await supabaseAdmin
      .from("posts")
      .select("id, content, user_id, community_id, created_at")
      .order("created_at", { ascending: false })
      .limit(5);

    if (postsError) {
      logGameEvent("PostProcessor", "Failed to fetch recent posts", "error", { error: postsError });
      return {
        success: false,
        postsProcessed: 0,
        agentsUsed: 0,
        totalWorkflows: 0,
        errors: [postsError.message],
      };
    }

    if (!recentPosts || recentPosts.length === 0) {
      logGameEvent("PostProcessor", "No recent posts to process", "info");
      return {
        success: true,
        postsProcessed: 0,
        agentsUsed: 0,
        totalWorkflows: 0,
        errors: [],
      };
    }

    logGameEvent("PostProcessor", `Found ${recentPosts.length} recent posts`, "info");

    // 2. Get 5 random active agents (with energy > 10, heat < 80)
    const { data: agents, error: agentsError } = await supabaseAdmin
      .from("users")
      .select("id, username, energy, heat")
      .eq("is_bot", true)
      .gt("energy", 10)
      .lt("heat", 80)
      .limit(100); // Get pool of candidates

    if (agentsError || !agents || agents.length === 0) {
      logGameEvent("PostProcessor", "No active agents available", "warn", { error: agentsError });
      return {
        success: false,
        postsProcessed: 0,
        agentsUsed: 0,
        totalWorkflows: 0,
        errors: ["No active agents available"],
      };
    }

    // Randomly select 5 agents from the pool
    const shuffled = agents.sort(() => Math.random() - 0.5);
    const selectedAgents = shuffled.slice(0, 5);

    logGameEvent("PostProcessor", `Selected ${selectedAgents.length} agents`, "info");

    // 3. For each agent, process each post via universal workflow
    let totalWorkflows = 0;

    for (const agent of selectedAgents) {
      for (const post of recentPosts) {
        try {
          // Skip if agent is the post author
          if (agent.id === post.user_id) {
            continue;
          }

          logGameEvent(
            "PostProcessor",
            `Agent ${agent.username} reviewing post ${post.id.substring(0, 8)}`,
            "info"
          );

          // Create workflow scope for "post seen" event
          const scope = {
            trigger: {
              type: "schedule" as const,
              event: "post_review" as const,
              timestamp: new Date(),
            },
            actor: {
              id: agent.id,
              type: "agent" as const,
            },
            subject: {
              id: post.id,
              type: "post" as const,
              data: {
                content: post.content,
                user_id: post.user_id,
                community_id: post.community_id,
                created_at: post.created_at,
              },
            },
            dataScope: {
              postId: post.id,
              authorId: post.user_id,
            },
          };

          // Execute universal workflow
          const result = await executeUniversalWorkflow(createInitialState(scope));

          totalWorkflows++;

          if (result.errors.length > 0) {
            errors.push(`Agent ${agent.id} error on post ${post.id}: ${result.errors[0].error}`);
          }
        } catch (error: any) {
          logGameEvent(
            "PostProcessor",
            `Error processing post ${post.id} with agent ${agent.id}`,
            "error",
            { error }
          );
          errors.push(`Workflow error: ${error.message}`);
        }
      }
    }

    logGameEvent(
      "PostProcessor",
      `Completed cycle: ${recentPosts.length} posts, ${selectedAgents.length} agents, ${totalWorkflows} workflows`,
      "success"
    );

    return {
      success: true,
      postsProcessed: recentPosts.length,
      agentsUsed: selectedAgents.length,
      totalWorkflows,
      errors,
    };
  } catch (error: any) {
    logGameEvent("PostProcessor", "Fatal error in post processing cycle", "error", { error });
    return {
      success: false,
      postsProcessed: 0,
      agentsUsed: 0,
      totalWorkflows: 0,
      errors: [error.message],
    };
  }
}
