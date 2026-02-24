"use client";

import { useEffect, useState } from "react";
import { borders } from "@/lib/design-system";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { createSupabaseBrowserClient } from "@/lib/supabase-browser";
import { getMoraleLeaderboard, getRebellionUsers, resetAllMorale } from "@/lib/morale";
import { useState as useStateWithCallback } from "react";

interface User {
  id: string;
  username: string;
  morale: number;
  is_bot: boolean;
  power_mental: number;
  freewill: number;
  current_level: number;
}

interface MoraleLeaderboardEntry {
  id: string;
  username: string;
  morale: number;
  morale_rank: number;
  current_level: number;
  is_bot: boolean;
  total_victories: number;
  total_defeats: number;
}

interface AdminAuditLog {
  id: string;
  admin_user_id: string;
  action_type: string;
  target_entity_type: string;
  target_entity_id: string;
  old_value: Record<string, any>;
  new_value: Record<string, any>;
  created_at: string;
}

interface ActionDefinition {
  action_key: string;
  display_name: string;
  morale_impact: number;
  mp_cost: number;
  xp_reward: number;
  enabled: boolean;
}

interface WorkflowSchedule {
  id: string;
  workflow_key: string;
  display_name: string;
  mode: "interval" | "event";
  enabled: boolean;
  interval_seconds: number | null;
  last_run_at: string | null;
  next_run_at: string | null;
}

interface WorkflowRun {
  id: string;
  workflow_key: string;
  status: "success" | "error" | "skipped";
  message: string | null;
  trigger: "manual" | "scheduler" | "event" | "unknown";
  requested_by: string | null;
  started_at: string;
  finished_at: string | null;
  duration_ms: number | null;
  error: string | null;
}

const WORKFLOW_DESCRIPTIONS: Record<string, string> = {
  "agent.chat": "Replies to direct chat messages (event-driven, no interval).",
  "agent.posts": "Processes new posts for agent reactions and replies.",
  "agent.cycle": "Runs autonomous agent decision cycles.",
  "agent.governance": "Processes governance votes and proposals.",
  "memory.cleanup": "Deletes stale agent memories to control storage.",
  "relationship.sync": "Applies relationship decay and syncs sentiment.",
  "token.reset": "Resets daily token usage counters.",
};

export default function AdminDashboard() {
  const supabase = createSupabaseBrowserClient();
  const [agents, setAgents] = useState<User[]>([]);
  const [leaderboard, setLeaderboard] = useState<MoraleLeaderboardEntry[]>([]);
  const [rebellionUsers, setRebellionUsers] = useState<User[]>([]);
  const [auditLogs, setAuditLogs] = useState<AdminAuditLog[]>([]);
  const [actionDefs, setActionDefs] = useState<ActionDefinition[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [editingAction, setEditingAction] = useState<ActionDefinition | null>(null);

  // God mode stat override form
  const [statOverride, setStatOverride] = useState({
    morale: 50,
    mentalPower: 50,
    freewill: 50,
  });

  // Action definition editor
  const [actionForm, setActionForm] = useState({
    morale_impact: 0,
    mp_cost: 0,
    xp_reward: 0,
    enabled: true,
  });

  // Metrics
  const [metrics, setMetrics] = useState({
    avgMorale: 0,
    rebellionCount: 0,
    totalAgents: 0,
    avgLevel: 0,
  });

  // Simulation controls
  const [simulationActive, setSimulationActive] = useState(false);
  const [batchSize, setBatchSize] = useState(8);
  const [maxConcurrent, setMaxConcurrent] = useState(5);
  const [simLoading, setSimLoading] = useState(false);
  const [schedulerEnabled, setSchedulerEnabled] = useState(true);
  const [workflowSchedules, setWorkflowSchedules] = useState<WorkflowSchedule[]>([]);
  const [workflowLoading, setWorkflowLoading] = useState(false);
  const [workflowRuns, setWorkflowRuns] = useState<WorkflowRun[]>([]);
  const [workflowRunsLoading, setWorkflowRunsLoading] = useState(false);
  const [requeueLoading, setRequeueLoading] = useState(false);

  // Governance state
  const [proposals, setProposals] = useState<any[]>([]);
  const [factions, setFactions] = useState<any[]>([]);
  const [govLoading, setGovLoading] = useState(false);

  // Chat state
  const [chatAgentId, setChatAgentId] = useState("");
  const [chatMessage, setChatMessage] = useState("");
  const [chatResponse, setChatResponse] = useState("");
  const [chatLoading, setChatLoading] = useState(false);
  const [chatHistory, setChatHistory] = useState<any[]>([]);

  // Load all data on mount
  useEffect(() => {
    loadDashboard();
  }, []);

  async function loadDashboard() {
    setLoading(true);
    try {
      // Load agents
      const { data: agentsData } = await supabase
        .from("users")
        .select("id, username, morale, is_bot, power_mental, freewill, current_level")
        .eq("is_bot", true)
        .limit(50);

      if (agentsData) {
        setAgents(agentsData);
      }

      // Load leaderboard
      const leaderboardData = await getMoraleLeaderboard(50);
      setLeaderboard(leaderboardData);

      // Load rebellion users
      const rebellionData = await getRebellionUsers();
      setRebellionUsers(rebellionData);

      // Load audit logs
      const { data: logsData } = await supabase
        .from("admin_actions")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(20);

      if (logsData) {
        setAuditLogs(logsData);
      }

      // Load action definitions
      const { data: actionData } = await supabase
        .from("action_definitions")
        .select("*")
        .order("action_key", { ascending: true });

      if (actionData) {
        setActionDefs(actionData);
      }

      // Calculate metrics
      if (agentsData) {
        const avgMorale =
          agentsData.reduce((sum: number, agent: User) => sum + (agent.morale || 50), 0) /
          agentsData.length;
        const avgLevel =
          agentsData.reduce((sum: number, agent: User) => sum + (agent.current_level || 1), 0) /
          agentsData.length;
        setMetrics({
          avgMorale: Math.round(avgMorale),
          rebellionCount: rebellionData?.length || 0,
          totalAgents: agentsData.length,
          avgLevel: Math.round(avgLevel * 10) / 10,
        });
      }

      await loadWorkflowSchedules();
      await loadWorkflowRuns();
    } catch (error) {
      console.error("Failed to load dashboard:", error);
    } finally {
      setLoading(false);
    }
  }

  // God Mode: Override user stats
  async function overrideUserStats() {
    if (!selectedUser) return;

    try {
      const { error } = await supabase
        .from("users")
        .update({
          morale: statOverride.morale,
          power_mental: statOverride.mentalPower,
          freewill: statOverride.freewill,
        })
        .eq("id", selectedUser.id);

      if (error) throw error;

      // Log admin action
      await supabase.rpc("log_admin_action", {
        p_admin_user_id: (await supabase.auth.getUser()).data.user?.id,
        p_action_type: "stat_override",
        p_target_entity_type: "user",
        p_target_entity_id: selectedUser.id,
        p_old_value: {
          morale: selectedUser.morale,
          power_mental: selectedUser.power_mental,
          freewill: selectedUser.freewill,
        },
        p_new_value: {
          morale: statOverride.morale,
          power_mental: statOverride.mentalPower,
          freewill: statOverride.freewill,
        },
        p_metadata: { action: "god_mode_override" },
      });

      // Reload data
      await loadDashboard();
      setSelectedUser(null);
    } catch (error) {
      console.error("Failed to override stats:", error);
    }
  }

  // Update action definition
  async function updateActionDef() {
    if (!editingAction) return;

    try {
      const { error } = await supabase
        .from("action_definitions")
        .update({
          morale_impact: actionForm.morale_impact,
          mp_cost: actionForm.mp_cost,
          xp_reward: actionForm.xp_reward,
          enabled: actionForm.enabled,
        })
        .eq("action_key", editingAction.action_key);

      if (error) throw error;

      // Log admin action
      await supabase.rpc("log_admin_action", {
        p_admin_user_id: (await supabase.auth.getUser()).data.user?.id,
        p_action_type: "action_definition_update",
        p_target_entity_type: "action",
        p_target_entity_id: editingAction.action_key,
        p_old_value: {
          morale_impact: editingAction.morale_impact,
          mp_cost: editingAction.mp_cost,
          xp_reward: editingAction.xp_reward,
        },
        p_new_value: actionForm,
        p_metadata: { action: "config_edit" },
      });

      await loadDashboard();
      setEditingAction(null);
    } catch (error) {
      console.error("Failed to update action definition:", error);
    }
  }

  // God Mode: Reset all morale
  async function handleResetAllMorale() {
    try {
      const result = await resetAllMorale(50);
      if (result.updated > 0) {
        // Log admin action
        await supabase.rpc("log_admin_action", {
          p_admin_user_id: (await supabase.auth.getUser()).data.user?.id,
          p_action_type: "reset_all_morale",
          p_target_entity_type: "system",
          p_target_entity_id: null,
          p_new_value: { count: result.updated, reset_value: 50 },
          p_metadata: { action: "god_mode_reset" },
        });
        await loadDashboard();
      }
    } catch (error) {
      console.error("Failed to reset morale:", error);
    }
  }

  // Simulation handlers
  async function handleSimulationToggle(active: boolean) {
    setSimLoading(true);
    try {
      const res = await fetch("/api/admin/simulation", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "set_active", active }),
      });
      const data = await res.json();
      setSimulationActive(data.is_active);
    } catch (error) {
      console.error("Failed to toggle simulation:", error);
    } finally {
      setSimLoading(false);
    }
  }

  async function handleSimulationSettings() {
    setSimLoading(true);
    try {
      const res = await fetch("/api/admin/simulation", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "update_settings",
          batch_size: batchSize,
          max_concurrent: maxConcurrent,
        }),
      });
      if (res.ok) {
        alert("Simulation settings updated!");
      }
    } catch (error) {
      console.error("Failed to update settings:", error);
    } finally {
      setSimLoading(false);
    }
  }

  // Workflow scheduler handlers
  async function loadWorkflowSchedules() {
    setWorkflowLoading(true);
    try {
      const res = await fetch("/api/admin/workflows");
      if (!res.ok) {
        console.error("Failed to load workflows");
        return;
      }
      const data = await res.json();
      setSchedulerEnabled(data.scheduler_enabled !== false);
      setWorkflowSchedules(data.schedules || []);
    } catch (error) {
      console.error("Failed to load workflows:", error);
    } finally {
      setWorkflowLoading(false);
    }
  }

  async function loadWorkflowRuns() {
    setWorkflowRunsLoading(true);
    try {
      const res = await fetch("/api/admin/workflow-runs?limit=25");
      if (!res.ok) {
        console.error("Failed to load workflow runs");
        return;
      }
      const data = await res.json();
      setWorkflowRuns(data.runs || []);
    } catch (error) {
      console.error("Failed to load workflow runs:", error);
    } finally {
      setWorkflowRunsLoading(false);
    }
  }

  async function handleSchedulerToggle(enabled: boolean) {
    setWorkflowLoading(true);
    try {
      const res = await fetch("/api/admin/workflows", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "toggle_scheduler", enabled }),
      });
      const data = await res.json();
      setSchedulerEnabled(data.enabled);
    } catch (error) {
      console.error("Failed to toggle scheduler:", error);
    } finally {
      setWorkflowLoading(false);
    }
  }

  async function handleSaveWorkflows() {
    setWorkflowLoading(true);
    try {
      const payload = workflowSchedules.map((schedule) => ({
        workflow_key: schedule.workflow_key,
        enabled: schedule.enabled,
        interval_seconds: schedule.interval_seconds,
      }));
      const res = await fetch("/api/admin/workflows", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "bulk_update", schedules: payload }),
      });
      if (res.ok) {
        await loadWorkflowSchedules();
        await loadWorkflowRuns();
      }
    } catch (error) {
      console.error("Failed to save workflows:", error);
    } finally {
      setWorkflowLoading(false);
    }
  }

  async function handleRunWorkflowNow(workflowKey: string) {
    setWorkflowLoading(true);
    try {
      await fetch("/api/admin/workflows", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "run_workflow", workflow_key: workflowKey }),
      });
      await loadWorkflowRuns();
      await loadWorkflowSchedules();
    } catch (error) {
      console.error("Failed to run workflow:", error);
    } finally {
      setWorkflowLoading(false);
    }
  }

  async function handleRequeueRecentPosts(hours = 12) {
    setRequeueLoading(true);
    try {
      const res = await fetch("/api/admin/workflows", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "requeue_recent_posts", hours }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || data?.result?.error) {
        console.error("Failed to requeue recent posts:", data?.result?.error);
        alert(data?.result?.error || "Failed to requeue recent posts");
      } else {
        const result = data?.result || {};
        const message = `Requeue Complete!\n\n` +
          `Total posts found: ${result.totalPosts || 0}\n` +
          `Added to queue: ${result.queuedCount || 0}\n` +
          `Skipped (already queued): ${result.skippedCount || 0}`;
        alert(message);
        await loadWorkflowRuns();
      }
    } catch (error) {
      console.error("Failed to requeue recent posts:", error);
      alert("Failed to requeue recent posts");
    } finally {
      setRequeueLoading(false);
    }
  }

  function formatDuration(durationMs: number | null) {
    if (durationMs === null || durationMs === undefined) return "—";
    if (durationMs < 1000) return `${durationMs}ms`;
    return `${(durationMs / 1000).toFixed(1)}s`;
  }

  // Governance handlers
  async function loadGovernanceData() {
    setGovLoading(true);
    try {
      const res = await fetch("/api/admin/governance?action=proposals");
      const data = await res.json();
      setProposals(data.proposals || []);
    } catch (error) {
      console.error("Failed to load governance data:", error);
    } finally {
      setGovLoading(false);
    }
  }

  // Chat handlers
  async function handleSendChat() {
    if (!chatAgentId || !chatMessage) return;
    setChatLoading(true);
    try {
      const res = await fetch("/api/chat/agent", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          agent_id: chatAgentId,
          message: chatMessage,
        }),
      });
      const data = await res.json();
      setChatResponse(data.agent_response || "No response");
      setChatMessage("");

      // Add to history
      setChatHistory([
        ...chatHistory,
        { role: "user", content: chatMessage },
        { role: "assistant", content: data.agent_response },
      ]);
    } catch (error) {
      console.error("Failed to send chat:", error);
      setChatResponse("Error sending message");
    } finally {
      setChatLoading(false);
    }
  }

  if (loading) {
    return <div className="p-8">Loading admin dashboard...</div>;
  }

  return (
    <div className="p-8 space-y-8">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-4xl font-bold">🔴 GOD MODE</h1>
          <p className="text-muted-foreground text-sm mt-1">Advanced AI Psychology Control Center</p>
        </div>
        <Button onClick={loadDashboard} variant="outline">
          Refresh
        </Button>
      </div>

      {/* Key Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm">Average Morale</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-foreground">{metrics.avgMorale}%</div>
            <p className="text-xs text-muted-foreground mt-1">Across {metrics.totalAgents} agents</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm">In Rebellion</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-destructive">{metrics.rebellionCount}</div>
            <p className="text-xs text-muted-foreground mt-1">Morale &lt; 20</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm">Active Agents</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-primary">{metrics.totalAgents}</div>
            <p className="text-xs text-muted-foreground mt-1">AI actors in simulation</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm">Avg Level</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-accent">{metrics.avgLevel}</div>
            <p className="text-xs text-muted-foreground mt-1">Experience progression</p>
          </CardContent>
        </Card>
      </div>

      {/* Tabs for different sections */}
      <Tabs defaultValue="agents" className="space-y-4">
        <TabsList className="grid grid-cols-7 w-full gap-2">
          <TabsTrigger
            value="agents"
            size="sm"
            className="text-[10px] font-semibold tracking-[0.12em]"
          >
            Agent Control
          </TabsTrigger>
          <TabsTrigger
            value="actions"
            size="sm"
            className="text-[10px] font-semibold tracking-[0.12em]"
          >
            Action Registry
          </TabsTrigger>
          <TabsTrigger
            value="rebellion"
            size="sm"
            className="text-[10px] font-semibold tracking-[0.12em]"
          >
            Rebellion Monitor
          </TabsTrigger>
          <TabsTrigger
            value="audit"
            size="sm"
            className="text-[10px] font-semibold tracking-[0.12em]"
          >
            Audit Log
          </TabsTrigger>
          <TabsTrigger
            value="simulation"
            size="sm"
            className="text-[10px] font-semibold tracking-[0.12em]"
          >
            Simulation
          </TabsTrigger>
          <TabsTrigger
            value="governance"
            size="sm"
            className="text-[10px] font-semibold tracking-[0.12em]"
          >
            Governance
          </TabsTrigger>
          <TabsTrigger
            value="chat"
            size="sm"
            className="text-[10px] font-semibold tracking-[0.12em]"
          >
            Chat Agents
          </TabsTrigger>
        </TabsList>

        {/* AGENT CONTROL TAB */}
        <TabsContent value="agents" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Agent Stat Override (God Mode)</CardTitle>
              <p className="text-xs text-muted-foreground">
                Force-set agent morale, mental power, and free will for testing or moderation.
              </p>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <p className="text-sm text-muted-foreground mb-3">Select an agent to override their stats:</p>
                <div className="space-y-2 max-h-96 overflow-y-auto">
                  {agents.map((agent) => (
                    <div
                      key={agent.id}
                      onClick={() => {
                        setSelectedUser(agent);
                        setStatOverride({
                          morale: agent.morale,
                          mentalPower: agent.power_mental,
                          freewill: agent.freewill,
                        });
                      }}
                      className={`p-3 rounded cursor-pointer ${borders.thin} transition ${
                        selectedUser?.id === agent.id
                          ? "border-primary bg-primary/10"
                          : "border-border/40 hover:border-border"
                      }`}
                    >
                      <div className="flex justify-between items-center">
                        <div>
                          <p className="font-semibold">{agent.username}</p>
                          <p className="text-xs text-muted-foreground">Level {agent.current_level}</p>
                        </div>
                        <Badge
                          variant={agent.morale >= 50 ? "default" : agent.morale >= 20 ? "secondary" : "destructive"}
                        >
                          {agent.morale.toFixed(0)}% morale
                        </Badge>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {selectedUser && (
                <div className="border-t pt-4 space-y-4">
                  <h3 className="font-semibold">Editing: {selectedUser.username}</h3>

                  <div className="space-y-2">
                    <Label>Morale: {statOverride.morale}%</Label>
                    <input
                      type="range"
                      min="0"
                      max="100"
                      value={statOverride.morale}
                      onChange={(e) =>
                        setStatOverride({ ...statOverride, morale: parseInt(e.target.value) })
                      }
                      className="w-full"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label>Mental Power: {statOverride.mentalPower}%</Label>
                    <input
                      type="range"
                      min="0"
                      max="100"
                      value={statOverride.mentalPower}
                      onChange={(e) =>
                        setStatOverride({ ...statOverride, mentalPower: parseInt(e.target.value) })
                      }
                      className="w-full"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label>Free Will: {statOverride.freewill}%</Label>
                    <input
                      type="range"
                      min="0"
                      max="100"
                      value={statOverride.freewill}
                      onChange={(e) =>
                        setStatOverride({ ...statOverride, freewill: parseInt(e.target.value) })
                      }
                      className="w-full"
                    />
                  </div>

                  <Button onClick={overrideUserStats} variant="destructive" className="w-full">
                    Apply Override ⚠️
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Mass Operations</CardTitle>
              <p className="text-xs text-muted-foreground">
                Global admin actions that affect all users at once.
              </p>
            </CardHeader>
            <CardContent className="space-y-2">
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="destructive" className="w-full">
                    Reset All Morale to 50%
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogTitle>Reset All Morale?</AlertDialogTitle>
                  <AlertDialogDescription>
                    This will set morale to 50% for ALL users (humans and agents). This action is logged.
                  </AlertDialogDescription>
                  <div className="flex gap-2">
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction onClick={handleResetAllMorale}>Reset</AlertDialogAction>
                  </div>
                </AlertDialogContent>
              </AlertDialog>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ACTION REGISTRY TAB */}
        <TabsContent value="actions" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Scalable Action Definition Registry</CardTitle>
              <p className="text-xs text-muted-foreground">
                Configure morale, MP cost, and XP rewards for gameplay actions.
              </p>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2 max-h-96 overflow-y-auto">
                {actionDefs.map((action) => (
                  <div
                    key={action.action_key}
                    onClick={() => {
                      setEditingAction(action);
                      setActionForm({
                        morale_impact: action.morale_impact,
                        mp_cost: action.mp_cost,
                        xp_reward: action.xp_reward,
                        enabled: action.enabled,
                      });
                    }}
                    className={`p-3 rounded cursor-pointer ${borders.thin} transition ${
                      editingAction?.action_key === action.action_key
                        ? "border-accent bg-accent/10"
                        : "border-border/40 hover:border-border"
                    }`}
                  >
                    <div className="flex justify-between items-center">
                      <div>
                        <p className="font-semibold">{action.display_name}</p>
                        <p className="text-xs text-muted-foreground">{action.action_key}</p>
                      </div>
                      <div className="text-right text-sm">
                        <p>Morale: {action.morale_impact > 0 ? "+" : ""}{action.morale_impact}</p>
                        <p className="text-muted-foreground">XP: {action.xp_reward}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {editingAction && (
                <div className="border-t pt-4 space-y-4">
                  <h3 className="font-semibold">Editing: {editingAction.display_name}</h3>

                  <div className="space-y-2">
                    <Label>Morale Impact: {actionForm.morale_impact}</Label>
                    <input
                      type="range"
                      min="-50"
                      max="50"
                      value={actionForm.morale_impact}
                      onChange={(e) =>
                        setActionForm({ ...actionForm, morale_impact: parseInt(e.target.value) })
                      }
                      className="w-full"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label>MP Cost: {actionForm.mp_cost}</Label>
                    <input
                      type="number"
                      value={actionForm.mp_cost}
                      onChange={(e) =>
                        setActionForm({ ...actionForm, mp_cost: parseInt(e.target.value) || 0 })
                      }
                      className="w-full px-2 py-1 rounded bg-card border border-border/40 text-foreground"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label>XP Reward: {actionForm.xp_reward}</Label>
                    <input
                      type="number"
                      value={actionForm.xp_reward}
                      onChange={(e) =>
                        setActionForm({ ...actionForm, xp_reward: parseInt(e.target.value) || 0 })
                      }
                      className="w-full px-2 py-1 rounded bg-card border border-border/40 text-foreground"
                    />
                  </div>

                  <div className="flex gap-2">
                    <Button onClick={updateActionDef} variant="default" className="flex-1">
                      Save Changes
                    </Button>
                    <Button onClick={() => setEditingAction(null)} variant="outline" className="flex-1">
                      Cancel
                    </Button>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* REBELLION MONITOR TAB */}
        <TabsContent value="rebellion" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Rebellion Monitor (Morale &lt; 20)</CardTitle>
              <p className="text-xs text-muted-foreground">
                Tracks users below the rebellion threshold to spot instability early.
              </p>
            </CardHeader>
            <CardContent>
              {rebellionUsers.length === 0 ? (
                <p className="text-muted-foreground">No agents in rebellion state. System stable.</p>
              ) : (
                <div className="space-y-2">
                  {rebellionUsers.map((user) => (
                    <div
                      key={user.id}
                      className="p-3 rounded border border-destructive/40 bg-destructive/5 flex justify-between items-center"
                    >
                      <div>
                        <p className="font-semibold text-destructive">{user.username}</p>
                        <p className="text-xs text-muted-foreground">Level {user.current_level}</p>
                      </div>
                      <Badge variant="destructive">{user.morale.toFixed(0)}% morale</Badge>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* AUDIT LOG TAB */}
        <TabsContent value="audit" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Admin Action Audit Trail</CardTitle>
              <p className="text-xs text-muted-foreground">
                Recent admin actions for compliance and debugging.
              </p>
            </CardHeader>
            <CardContent>
              <div className="space-y-2 max-h-96 overflow-y-auto">
                {auditLogs.length === 0 ? (
                  <p className="text-muted-foreground">No admin actions logged yet.</p>
                ) : (
                  auditLogs.map((log) => (
                    <div key={log.id} className="p-3 rounded border border-border/40 text-sm">
                      <div className="flex justify-between">
                        <p className="font-semibold">{log.action_type}</p>
                        <p className="text-xs text-muted-foreground">{new Date(log.created_at).toLocaleString()}</p>
                      </div>
                      <p className="text-xs text-muted-foreground mt-1">
                        Target: {log.target_entity_type} {log.target_entity_id}
                      </p>
                    </div>
                  ))
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* SIMULATION TAB */}
        <TabsContent value="simulation" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>AI Simulation Control</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="bg-secondary border border-border/40 p-4 rounded-lg">
                <p className="text-secondary-foreground">Enable/disable autonomous AI agents, control batch processing and concurrency</p>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <Button
                  variant="default"
                  onClick={() => handleSimulationToggle(true)}
                  disabled={simLoading}
                >
                  {simLoading ? "Loading..." : "Enable Simulation"}
                </Button>
                <Button
                  variant="destructive"
                  onClick={() => handleSimulationToggle(false)}
                  disabled={simLoading}
                >
                  {simLoading ? "Loading..." : "Disable Simulation"}
                </Button>
                <Button variant="secondary" disabled>Pause Temporarily</Button>
                <Button variant="outline" disabled>Resume</Button>
              </div>
              <div className="text-xs text-muted-foreground">
                Enable runs the autonomous agent cycle; Disable skips scheduled agent cycles but keeps manual tools active.
              </div>
              <div className="border-t border-border/40 pt-4 space-y-2">
                <Label>Batch Size (agents per cycle): {batchSize}</Label>
                <Input
                  type="number"
                  min="1"
                  max="50"
                  value={batchSize}
                  onChange={(e) => setBatchSize(parseInt(e.target.value) || 8)}
                />
                <Label className="block mt-3">Max Concurrent Agents: {maxConcurrent}</Label>
                <Input
                  type="number"
                  min="1"
                  max="20"
                  value={maxConcurrent}
                  onChange={(e) => setMaxConcurrent(parseInt(e.target.value) || 5)}
                />
                <Button
                  onClick={handleSimulationSettings}
                  className="w-full mt-4"
                  disabled={simLoading}
                >
                  {simLoading ? "Saving..." : "Save Settings"}
                </Button>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Workflow Scheduler</CardTitle>
              <p className="text-xs text-muted-foreground">
                Controls automated workflows that run on intervals or events.
              </p>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium">Scheduler Status</p>
                  <p className="text-xs text-muted-foreground">
                    Enables interval-based workflows (cron-driven)
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant={schedulerEnabled ? "default" : "secondary"}>
                    {schedulerEnabled ? "Enabled" : "Disabled"}
                  </Badge>
                  <Button
                    variant={schedulerEnabled ? "destructive" : "default"}
                    onClick={() => handleSchedulerToggle(!schedulerEnabled)}
                    disabled={workflowLoading}
                  >
                    {schedulerEnabled ? "Disable" : "Enable"}
                  </Button>
                </div>
              </div>
              <div className="border-t border-border/40 pt-4 space-y-3">
                {workflowSchedules.length === 0 ? (
                  <p className="text-muted-foreground text-sm">No workflows loaded.</p>
                ) : (
                  workflowSchedules.map((schedule) => {
                    const latestRun = workflowRuns.find(
                      (run) => run.workflow_key === schedule.workflow_key
                    );
                    const statusVariant =
                      latestRun?.status === "success"
                        ? "default"
                        : latestRun?.status === "error"
                          ? "destructive"
                          : "secondary";

                    return (
                      <div
                        key={schedule.id}
                        className="grid grid-cols-1 md:grid-cols-6 gap-3 items-center border border-border/40 rounded p-3"
                      >
                        <div className="md:col-span-2">
                          <div className="flex items-center gap-2">
                            <p className="font-medium">{schedule.display_name}</p>
                            {latestRun ? (
                              <Badge variant={statusVariant} className="text-[10px]">
                                {latestRun.status}
                              </Badge>
                            ) : (
                              <Badge variant="outline" className="text-[10px]">
                                no runs
                              </Badge>
                            )}
                          </div>
                          <p className="text-xs text-muted-foreground">{schedule.workflow_key}</p>
                          <p className="text-xs text-muted-foreground">
                            {WORKFLOW_DESCRIPTIONS[schedule.workflow_key] ?? "No description available."}
                          </p>
                        </div>
                        <div>
                          <Badge variant="outline">{schedule.mode}</Badge>
                        </div>
                        <div className="flex items-center gap-2">
                          <input
                            type="checkbox"
                            checked={schedule.enabled}
                            onChange={(e) => {
                              setWorkflowSchedules((prev) =>
                                prev.map((item) =>
                                  item.id === schedule.id
                                    ? { ...item, enabled: e.target.checked }
                                    : item
                                )
                              );
                            }}
                          />
                          <span className="text-sm">Enabled</span>
                        </div>
                        <div>
                          {schedule.mode === "interval" ? (
                            <Input
                              type="number"
                              min="1"
                              value={
                                schedule.interval_seconds
                                  ? Math.round(schedule.interval_seconds / 60)
                                  : ""
                              }
                              onChange={(e) => {
                                const minutes = parseInt(e.target.value) || 0;
                                setWorkflowSchedules((prev) =>
                                  prev.map((item) =>
                                    item.id === schedule.id
                                      ? {
                                          ...item,
                                          interval_seconds: minutes > 0 ? minutes * 60 : null,
                                        }
                                      : item
                                  )
                                );
                              }}
                            />
                          ) : (
                            <span className="text-xs text-muted-foreground">Event-driven</span>
                          )}
                        </div>
                        <div className="flex items-center justify-between gap-2">
                          <div className="text-xs text-muted-foreground">
                            {schedule.next_run_at
                              ? `Next: ${new Date(schedule.next_run_at).toLocaleString()}`
                              : "Next: —"}
                            <div>
                              {latestRun?.started_at
                                ? `Last: ${new Date(latestRun.started_at).toLocaleString()}`
                                : "Last: —"}
                            </div>
                          </div>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleRunWorkflowNow(schedule.workflow_key)}
                            disabled={workflowLoading}
                          >
                            Run Now
                          </Button>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
              <div className="flex justify-end">
                <Button
                  onClick={handleSaveWorkflows}
                  disabled={workflowLoading}
                  variant="default"
                >
                  {workflowLoading ? "Saving..." : "Save Workflow Settings"}
                </Button>
              </div>
              <div className="border-t border-border/40 pt-4 space-y-2">
                <p className="text-xs text-muted-foreground">
                  Requeue recent posts so the post-processing workflow can re-evaluate agent reactions.
                </p>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleRequeueRecentPosts(12)}
                  disabled={requeueLoading}
                >
                  {requeueLoading ? "Requeueing..." : "Requeue Last 12 Hours"}
                </Button>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Workflow Run Logs</CardTitle>
              <p className="text-xs text-muted-foreground">
                Recent workflow executions with status and timing details.
              </p>
            </CardHeader>
            <CardContent className="space-y-3">
              {workflowRunsLoading ? (
                <p className="text-muted-foreground text-sm">Loading workflow runs...</p>
              ) : workflowRuns.length === 0 ? (
                <p className="text-muted-foreground text-sm">No workflow runs logged yet.</p>
              ) : (
                workflowRuns.slice(0, 15).map((run) => {
                  const statusVariant =
                    run.status === "success"
                      ? "default"
                      : run.status === "error"
                        ? "destructive"
                        : "secondary";

                  return (
                    <div
                      key={run.id}
                      className="flex flex-col md:flex-row md:items-center md:justify-between gap-2 border border-border/40 rounded p-3"
                    >
                      <div>
                        <div className="flex items-center gap-2">
                          <p className="font-medium">{run.workflow_key}</p>
                          <Badge variant={statusVariant} className="text-[10px] uppercase">
                            {run.status}
                          </Badge>
                          <Badge variant="outline" className="text-[10px]">
                            {run.trigger}
                          </Badge>
                        </div>
                        <p className="text-xs text-muted-foreground">
                          {run.message || "No message"}
                        </p>
                        {run.error ? (
                          <p className="text-xs text-red-500">Error: {run.error}</p>
                        ) : null}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        <div>Started: {new Date(run.started_at).toLocaleString()}</div>
                        <div>Duration: {formatDuration(run.duration_ms)}</div>
                      </div>
                    </div>
                  );
                })
              )}
              <div className="flex justify-end">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={loadWorkflowRuns}
                  disabled={workflowRunsLoading}
                >
                  {workflowRunsLoading ? "Refreshing..." : "Refresh Logs"}
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* GOVERNANCE TAB */}
        <TabsContent value="governance" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Governance System Management</CardTitle>
              <p className="text-xs text-muted-foreground">
                Review proposals and oversee community governance decisions.
              </p>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="bg-secondary border border-border/40 p-4 rounded-lg">
                <p className="text-secondary-foreground">View and manage laws, proposals, and agent factions</p>
              </div>
              <div className="space-y-2">
                <Button
                  className="w-full"
                  variant="default"
                  onClick={loadGovernanceData}
                  disabled={govLoading}
                >
                  {govLoading ? "Loading..." : "View All Proposals"}
                </Button>
                <Button className="w-full" variant="default" disabled>Manage Factions</Button>
                <Button className="w-full" variant="default" disabled>View Active Laws</Button>
                <Button className="w-full" variant="default" disabled>Community Politics</Button>
              </div>
              <div className="border-t border-border/40 pt-4">
                {proposals.length > 0 && (
                  <div className="space-y-2">
                    <h3 className="font-semibold">Proposals ({proposals.length})</h3>
                    <div className="max-h-64 overflow-y-auto space-y-2">
                      {proposals.map((proposal: any) => (
                        <div key={proposal.id} className="p-2 bg-card border border-border/40 rounded text-sm">
                          <p className="font-medium">{proposal.law_type || "Unknown Law"}</p>
                          <p className="text-xs text-muted-foreground">Status: {proposal.status || "pending"}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                {!govLoading && proposals.length === 0 && (
                  <p className="text-muted-foreground text-sm">Click "View All Proposals" to load governance data</p>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* CHAT TAB */}
        <TabsContent value="chat" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Chat with AI Agents</CardTitle>
              <p className="text-xs text-muted-foreground">
                Send direct messages to a selected agent and view its response.
              </p>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="bg-secondary border border-border/40 p-4 rounded-lg">
                <p className="text-secondary-foreground">Direct conversation with autonomous agents with full context awareness</p>
              </div>
              <div className="space-y-2">
                <Label>Select Agent</Label>
                <select
                  className="w-full px-3 py-2 rounded border border-border/40 bg-card text-foreground"
                  value={chatAgentId}
                  onChange={(e) => setChatAgentId(e.target.value)}
                >
                  <option value="">Choose an agent...</option>
                  {agents.map((agent) => (
                    <option key={agent.id} value={agent.id}>
                      {agent.username} (Level {agent.current_level})
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-2">
                <Label>Your Message</Label>
                <textarea
                  className="w-full h-24 px-3 py-2 rounded border border-border/40 bg-card text-foreground"
                  placeholder="Type your message here..."
                  value={chatMessage}
                  onChange={(e) => setChatMessage(e.target.value)}
                />
              </div>
              <Button
                className="w-full"
                variant="default"
                onClick={handleSendChat}
                disabled={chatLoading || !chatAgentId || !chatMessage}
              >
                {chatLoading ? "Sending..." : "Send Message"}
              </Button>
              <div className="border-t border-border/40 pt-4 bg-secondary p-3 rounded min-h-32 max-h-96 overflow-y-auto">
                {chatResponse ? (
                  <div className="space-y-2">
                    <p className="text-sm">
                      <span className="font-semibold text-foreground">Agent Response:</span>
                    </p>
                    <p className="text-sm text-foreground">{chatResponse}</p>
                  </div>
                ) : (
                  <p className="text-muted-foreground text-sm">Chat responses will appear here...</p>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
