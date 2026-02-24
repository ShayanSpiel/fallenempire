"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";

interface WorkflowAction {
  id: string;
  agent_id: string;
  agentName: string;
  action_type: string;
  target_id: string | null;
  scope_trigger: string;
  metadata: Record<string, any>;
  created_at: string;
}

interface WorkflowStats {
  totalExecutions: number;
  byAgent: Record<string, number>;
  byAction: Record<string, number>;
  timeline: Array<{ time: string; count: number }>;
}

interface AgentHealth {
  id: string;
  username: string;
  heat: number;
  morale: number;
  coherence: number;
  is_active: boolean;
  recentActionsCount: number;
  status: string;
  healthScore: number;
}

export function WorkflowMonitoring() {
  const [activeTab, setActiveTab] = useState("executions");
  const [actions, setActions] = useState<WorkflowAction[]>([]);
  const [stats, setStats] = useState<WorkflowStats | null>(null);
  const [selectedAgent, setSelectedAgent] = useState<AgentHealth | null>(null);
  const [loading, setLoading] = useState(false);
  const [timeRange, setTimeRange] = useState("24h");
  const [pagination, setPagination] = useState({
    offset: 0,
    limit: 50,
    total: 0,
    hasMore: false,
  });

  // Fetch workflow execution history
  const fetchExecutions = async (offset = 0) => {
    setLoading(true);
    try {
      const response = await fetch(
        `/api/admin/workflow-monitoring?limit=50&offset=${offset}`
      );
      const data = await response.json();
      if (data.success) {
        setActions(data.data);
        setPagination(data.pagination);
      }
    } catch (error) {
      console.error("Error fetching executions:", error);
    } finally {
      setLoading(false);
    }
  };

  // Fetch workflow statistics
  const fetchStats = async () => {
    setLoading(true);
    try {
      const response = await fetch(`/api/admin/workflow-monitoring`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "stats", timeRange }),
      });
      const data = await response.json();
      if (data.success) {
        setStats(data.stats);
      }
    } catch (error) {
      console.error("Error fetching stats:", error);
    } finally {
      setLoading(false);
    }
  };

  // Fetch agent health
  const fetchAgentHealth = async (agentId: string) => {
    setLoading(true);
    try {
      const response = await fetch(`/api/admin/workflow-monitoring`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "agent-health", agentId }),
      });
      const data = await response.json();
      if (data.success) {
        setSelectedAgent(data.agent);
      }
    } catch (error) {
      console.error("Error fetching agent health:", error);
    } finally {
      setLoading(false);
    }
  };

  // Control workflow execution
  const controlWorkflow = async (action: string, agentId: string) => {
    try {
      const response = await fetch(`/api/admin/workflow-monitoring`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, agentId }),
      });
      const data = await response.json();
      if (data.success) {
        alert(data.message);
        fetchAgentHealth(agentId); // Refresh agent data
      }
    } catch (error) {
      console.error("Error controlling workflow:", error);
    }
  };

  useEffect(() => {
    fetchExecutions();
  }, []);

  useEffect(() => {
    if (activeTab === "stats") {
      fetchStats();
    }
  }, [activeTab, timeRange]);

  const getActionBadgeColor = (actionType: string) => {
    switch (actionType) {
      case "REPLY":
        return "bg-blue-100 text-blue-800";
      case "COMMENT":
        return "bg-green-100 text-green-800";
      case "LIKE":
        return "bg-pink-100 text-pink-800";
      case "FOLLOW":
        return "bg-purple-100 text-purple-800";
      case "JOIN_COMMUNITY":
        return "bg-orange-100 text-orange-800";
      case "DECLINE":
        return "bg-red-100 text-red-800";
      case "IGNORE":
        return "bg-gray-100 text-gray-800";
      default:
        return "bg-gray-100 text-gray-800";
    }
  };

  const getHealthColor = (score: number) => {
    if (score >= 80) return "text-green-600";
    if (score >= 50) return "text-yellow-600";
    return "text-red-600";
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold">Workflow Monitoring</h2>
        <Button
          onClick={() => setActiveTab(activeTab === "executions" ? "stats" : "executions")}
          variant="outline"
        >
          {activeTab === "executions" ? "View Statistics" : "View Executions"}
        </Button>
      </div>

      {activeTab === "executions" && (
        <Card>
          <CardHeader>
            <CardTitle>Recent Workflow Executions</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {actions.length === 0 ? (
                <p className="text-gray-500">No executions found</p>
              ) : (
                <>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead className="border-b">
                        <tr>
                          <th className="text-left py-2 px-3">Agent</th>
                          <th className="text-left py-2 px-3">Action</th>
                          <th className="text-left py-2 px-3">Trigger</th>
                          <th className="text-left py-2 px-3">Confidence</th>
                          <th className="text-left py-2 px-3">Time</th>
                        </tr>
                      </thead>
                      <tbody>
                        {actions.map((action) => (
                          <tr
                            key={action.id}
                            className="border-b hover:bg-gray-50 cursor-pointer"
                            onClick={() => fetchAgentHealth(action.agent_id)}
                          >
                            <td className="py-2 px-3">
                              <span className="font-medium">{action.agentName}</span>
                            </td>
                            <td className="py-2 px-3">
                              <Badge className={getActionBadgeColor(action.action_type)}>
                                {action.action_type}
                              </Badge>
                            </td>
                            <td className="py-2 px-3 text-xs text-gray-600">
                              {action.scope_trigger}
                            </td>
                            <td className="py-2 px-3">
                              {(action.metadata?.confidence * 100).toFixed(0)}%
                            </td>
                            <td className="py-2 px-3 text-xs text-gray-600">
                              {new Date(action.created_at).toLocaleTimeString()}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  {/* Pagination */}
                  <div className="flex justify-between items-center mt-4">
                    <div className="text-sm text-gray-600">
                      Showing {pagination.offset + 1}-{Math.min(pagination.offset + pagination.limit, pagination.total)} of {pagination.total}
                    </div>
                    <div className="space-x-2">
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={pagination.offset === 0 || loading}
                        onClick={() => fetchExecutions(Math.max(0, pagination.offset - pagination.limit))}
                      >
                        Previous
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={!pagination.hasMore || loading}
                        onClick={() => fetchExecutions(pagination.offset + pagination.limit)}
                      >
                        Next
                      </Button>
                    </div>
                  </div>
                </>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {activeTab === "stats" && stats && (
        <div className="space-y-6">
          {/* Overall Stats */}
          <Card>
            <CardHeader>
              <CardTitle>Workflow Statistics ({timeRange})</CardTitle>
              <div className="flex gap-2 mt-4">
                {["1h", "24h", "7d", "30d"].map((range) => (
                  <Button
                    key={range}
                    variant={timeRange === range ? "default" : "outline"}
                    size="sm"
                    onClick={() => setTimeRange(range)}
                  >
                    {range}
                  </Button>
                ))}
              </div>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-4 mb-6">
                <div className="p-4 bg-blue-50 rounded">
                  <div className="text-gray-600 text-sm">Total Executions</div>
                  <div className="text-3xl font-bold text-blue-600">
                    {stats.totalExecutions}
                  </div>
                </div>
                <div className="p-4 bg-purple-50 rounded">
                  <div className="text-gray-600 text-sm">Agents Active</div>
                  <div className="text-3xl font-bold text-purple-600">
                    {Object.keys(stats.byAgent).length}
                  </div>
                </div>
              </div>

              {/* Timeline Chart */}
              <div className="space-y-4">
                <h3 className="font-semibold">Execution Timeline</h3>
                <div className="space-y-2">
                  {stats.timeline.map((point) => (
                    <div key={point.time} className="flex items-center gap-2">
                      <div className="w-20 text-sm text-gray-600">{point.time}</div>
                      <div className="flex-1 bg-gray-200 rounded h-6 overflow-hidden">
                        <div
                          className="bg-blue-500 h-full"
                          style={{
                            width: `${(point.count / Math.max(...stats.timeline.map(p => p.count))) * 100}%`,
                          }}
                        />
                      </div>
                      <div className="w-12 text-right text-sm font-medium">
                        {point.count}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Action Distribution */}
          <Card>
            <CardHeader>
              <CardTitle>Action Distribution</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {Object.entries(stats.byAction).map(([action, count]) => (
                  <div key={action} className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Badge className={getActionBadgeColor(action)}>
                        {action}
                      </Badge>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="w-48 bg-gray-200 rounded h-6 overflow-hidden">
                        <div
                          className="bg-green-500 h-full"
                          style={{
                            width: `${(count / stats.totalExecutions) * 100}%`,
                          }}
                        />
                      </div>
                      <div className="w-12 text-right font-medium">{count}</div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Agent Health Panel */}
      {selectedAgent && (
        <Card className="border-2 border-blue-200">
          <CardHeader>
            <div className="flex justify-between items-start">
              <div>
                <CardTitle>{selectedAgent.username}</CardTitle>
                <div className="text-sm text-gray-600 mt-1">Agent Health</div>
              </div>
              <div className={`text-3xl font-bold ${getHealthColor(selectedAgent.healthScore)}`}>
                {selectedAgent.healthScore}
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <div className="text-sm text-gray-600">Heat</div>
                  <div className="text-xl font-semibold">{selectedAgent.heat}/100</div>
                  <div className="w-full bg-gray-200 rounded h-2 mt-1">
                    <div
                      className="bg-red-500 h-full rounded"
                      style={{ width: `${Math.min(selectedAgent.heat, 100)}%` }}
                    />
                  </div>
                </div>
                <div>
                  <div className="text-sm text-gray-600">Morale</div>
                  <div className="text-xl font-semibold">{selectedAgent.morale}/100</div>
                  <div className="w-full bg-gray-200 rounded h-2 mt-1">
                    <div
                      className="bg-green-500 h-full rounded"
                      style={{ width: `${Math.min(selectedAgent.morale, 100)}%` }}
                    />
                  </div>
                </div>
                <div>
                  <div className="text-sm text-gray-600">Coherence</div>
                  <div className="text-xl font-semibold">{selectedAgent.coherence}/100</div>
                  <div className="w-full bg-gray-200 rounded h-2 mt-1">
                    <div
                      className="bg-blue-500 h-full rounded"
                      style={{ width: `${Math.min(selectedAgent.coherence, 100)}%` }}
                    />
                  </div>
                </div>
                <div>
                  <div className="text-sm text-gray-600">Recent Actions</div>
                  <div className="text-xl font-semibold">{selectedAgent.recentActionsCount}</div>
                </div>
              </div>

              <div className="pt-4 border-t space-y-2">
                <div className="text-sm">
                  Status:{" "}
                  <Badge variant={selectedAgent.is_active ? "default" : "secondary"}>
                    {selectedAgent.status}
                  </Badge>
                </div>

                {/* Control Buttons */}
                <div className="flex gap-2 mt-4 flex-wrap">
                  {selectedAgent.is_active ? (
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button variant="destructive" size="sm">
                          Pause Agent
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogTitle>Pause Agent</AlertDialogTitle>
                        <AlertDialogDescription>
                          Are you sure you want to pause this agent's activities?
                        </AlertDialogDescription>
                        <div className="flex gap-2">
                          <AlertDialogCancel>Cancel</AlertDialogCancel>
                          <AlertDialogAction
                            onClick={() =>
                              controlWorkflow("pause", selectedAgent.id)
                            }
                          >
                            Pause
                          </AlertDialogAction>
                        </div>
                      </AlertDialogContent>
                    </AlertDialog>
                  ) : (
                    <Button
                      onClick={() =>
                        controlWorkflow("resume", selectedAgent.id)
                      }
                      size="sm"
                    >
                      Resume Agent
                    </Button>
                  )}

                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() =>
                      controlWorkflow("reset-heat", selectedAgent.id)
                    }
                  >
                    Reset Heat
                  </Button>

                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() =>
                      controlWorkflow("reset-tokens", selectedAgent.id)
                    }
                  >
                    Reset Tokens
                  </Button>

                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setSelectedAgent(null)}
                  >
                    Close
                  </Button>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
