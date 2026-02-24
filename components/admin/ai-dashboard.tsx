/**
 * AI Administration Dashboard
 * Full control over agents, governance, and simulation
 * Configuration-driven, no hardcoding
 */

"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Alert, AlertDescription } from "@/components/ui/alert";

interface AdminSection {
  id: string;
  title: string;
  icon: string;
  description: string;
}

interface SimulationStats {
  is_active: boolean;
  batch_size: number;
  max_concurrent: number;
  tokens_used_today: number;
  tokens_used_month: number;
  cost_limit: number;
  paused_until?: string;
}

const DASHBOARD_SECTIONS: AdminSection[] = [
  {
    id: "agents",
    title: "Agent Management",
    icon: "🤖",
    description: "View and control individual AI agents",
  },
  {
    id: "simulation",
    title: "Simulation Control",
    icon: "⚙️",
    description: "Global AI simulation settings",
  },
  {
    id: "governance",
    title: "Governance",
    icon: "⚖️",
    description: "Laws, proposals, and factions",
  },
  {
    id: "statistics",
    title: "Statistics",
    icon: "📊",
    description: "Relationships, goals, and performance",
  },
  {
    id: "chat",
    title: "Chat with Agents",
    icon: "💬",
    description: "Talk directly with AI agents",
  },
  {
    id: "jobs",
    title: "Background Jobs",
    icon: "⏰",
    description: "Manage scheduled tasks",
  },
];

export function AIDashboard() {
  const [activeSection, setActiveSection] = useState<string>("simulation");
  const [simulationStats, setSimulationStats] = useState<SimulationStats | null>(
    null
  );
  const [agents, setAgents] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Load stats on mount
  useEffect(() => {
    loadSimulationStats();
  }, []);

  const loadSimulationStats = async () => {
    try {
      setLoading(true);
      const res = await fetch("/api/admin/simulation?action=stats");
      const data = await res.json();
      setSimulationStats(data);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const loadAgents = async () => {
    try {
      setLoading(true);
      const res = await fetch("/api/admin/agents?action=list");
      const data = await res.json();
      setAgents(data.agents || []);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleSimulationToggle = async (active: boolean) => {
    try {
      const res = await fetch("/api/admin/simulation", {
        method: "POST",
        body: JSON.stringify({ action: "set_active", active }),
      });
      const data = await res.json();
      if (data.success) {
        setSuccess(data.message);
        await loadSimulationStats();
      } else {
        setError("Failed to update simulation");
      }
    } catch (err: any) {
      setError(err.message);
    }
  };

  return (
    <div className="w-full min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 p-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-white mb-2">
            🎮 AI Administration Dashboard
          </h1>
          <p className="text-purple-200">
            Full control over autonomous agents, governance, and simulation
          </p>
        </div>

        {/* Status Messages */}
        {error && (
          <Alert className="mb-4 border-red-500 bg-red-50">
            <AlertDescription className="text-red-800">{error}</AlertDescription>
          </Alert>
        )}
        {success && (
          <Alert className="mb-4 border-green-500 bg-green-50">
            <AlertDescription className="text-green-800">{success}</AlertDescription>
          </Alert>
        )}

        {/* Simulation Status Card */}
        {simulationStats && (
          <Card className="mb-8 bg-slate-800 border-purple-500">
            <CardHeader>
              <CardTitle className="text-white">System Status</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div>
                  <p className="text-purple-300 text-sm">Status</p>
                  <p className="text-white text-lg font-bold">
                    {simulationStats.is_active ? "🟢 ACTIVE" : "🔴 INACTIVE"}
                  </p>
                </div>
                <div>
                  <p className="text-purple-300 text-sm">Batch Size</p>
                  <p className="text-white text-lg font-bold">
                    {simulationStats.batch_size}
                  </p>
                </div>
                <div>
                  <p className="text-purple-300 text-sm">Tokens Today</p>
                  <p className="text-white text-lg font-bold">
                    {simulationStats.tokens_used_today.toLocaleString()}
                  </p>
                </div>
                <div>
                  <p className="text-purple-300 text-sm">Month Cost</p>
                  <p className="text-white text-lg font-bold">
                    ${(simulationStats.tokens_used_month * 0.00014).toFixed(2)}
                  </p>
                </div>
              </div>

              <div className="mt-4 space-x-2">
                <Button
                  onClick={() => handleSimulationToggle(true)}
                  className="bg-green-600 hover:bg-green-700"
                  disabled={simulationStats.is_active}
                >
                  Enable
                </Button>
                <Button
                  onClick={() => handleSimulationToggle(false)}
                  className="bg-red-600 hover:bg-red-700"
                  disabled={!simulationStats.is_active}
                >
                  Disable
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Navigation */}
        <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-4 mb-8">
          {DASHBOARD_SECTIONS.map((section) => (
            <Button
              key={section.id}
              onClick={() => {
                setActiveSection(section.id);
                if (section.id === "agents") loadAgents();
              }}
              className={`h-auto py-4 px-3 flex flex-col items-center justify-center text-center ${
                activeSection === section.id
                  ? "bg-purple-600 text-white"
                  : "bg-slate-700 text-purple-200 hover:bg-slate-600"
              }`}
            >
              <div className="text-2xl mb-2">{section.icon}</div>
              <div className="text-xs font-bold">{section.title}</div>
            </Button>
          ))}
        </div>

        {/* Content Sections */}
        <div>
          {activeSection === "agents" && <AgentManagement agents={agents} loading={loading} />}
          {activeSection === "simulation" && (
            <SimulationControl stats={simulationStats} onRefresh={loadSimulationStats} />
          )}
          {activeSection === "governance" && <GovernancePanel />}
          {activeSection === "statistics" && <StatisticsPanel />}
          {activeSection === "chat" && <ChatPanel />}
          {activeSection === "jobs" && <JobsPanel />}
        </div>
      </div>
    </div>
  );
}

/**
 * Agent Management Section
 */
function AgentManagement({ agents, loading }: { agents: any[]; loading: boolean }) {
  return (
    <Card className="bg-slate-800 border-purple-500">
      <CardHeader>
        <CardTitle className="text-white">🤖 Agents ({agents.length})</CardTitle>
      </CardHeader>
      <CardContent>
        {loading ? (
          <p className="text-purple-300">Loading agents...</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-purple-200">
              <thead className="bg-slate-700">
                <tr>
                  <th className="px-4 py-2 text-left">Name</th>
                  <th className="px-4 py-2">Type</th>
                  <th className="px-4 py-2">Morale</th>
                  <th className="px-4 py-2">Power</th>
                  <th className="px-4 py-2">Last Seen</th>
                  <th className="px-4 py-2">Actions</th>
                </tr>
              </thead>
              <tbody>
                {agents.map((agent) => (
                  <tr key={agent.id} className="border-b border-slate-700 hover:bg-slate-700">
                    <td className="px-4 py-2">{agent.username}</td>
                    <td className="px-4 py-2 text-center">{agent.identity_label}</td>
                    <td className="px-4 py-2 text-center">
                      <span
                        className={`px-2 py-1 rounded ${
                          agent.morale > 70
                            ? "bg-green-900 text-green-200"
                            : agent.morale > 40
                            ? "bg-yellow-900 text-yellow-200"
                            : "bg-red-900 text-red-200"
                        }`}
                      >
                        {agent.morale}
                      </span>
                    </td>
                    <td className="px-4 py-2 text-center">{agent.power_mental}</td>
                    <td className="px-4 py-2 text-xs">
                      {new Date(agent.last_seen_at).toLocaleDateString()}
                    </td>
                    <td className="px-4 py-2">
                      <Button size="sm" className="text-xs">
                        View
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

/**
 * Simulation Control Section
 */
function SimulationControl({
  stats,
  onRefresh,
}: {
  stats: SimulationStats | null;
  onRefresh: () => void;
}) {
  const [batchSize, setBatchSize] = useState(stats?.batch_size || 8);
  const [maxConcurrent, setMaxConcurrent] = useState(stats?.max_concurrent || 5);
  const [pauseDuration, setPauseDuration] = useState(10); // minutes
  const [pauseLoading, setPauseLoading] = useState(false);

  const handlePause = async () => {
    try {
      setPauseLoading(true);
      const untilTime = new Date(Date.now() + pauseDuration * 60 * 1000);
      const res = await fetch("/api/admin/simulation", {
        method: "POST",
        body: JSON.stringify({
          action: "pause",
          until_timestamp: untilTime.toISOString()
        }),
      });
      const data = await res.json();
      if (data.success) {
        await onRefresh();
      }
    } catch (err) {
      console.error("Error pausing simulation:", err);
    } finally {
      setPauseLoading(false);
    }
  };

  const handleResume = async () => {
    try {
      setPauseLoading(true);
      const res = await fetch("/api/admin/simulation", {
        method: "POST",
        body: JSON.stringify({ action: "resume" }),
      });
      const data = await res.json();
      if (data.success) {
        await onRefresh();
      }
    } catch (err) {
      console.error("Error resuming simulation:", err);
    } finally {
      setPauseLoading(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* Pause/Resume Controls */}
      <Card className="bg-slate-800 border-purple-500">
        <CardHeader>
          <CardTitle className="text-white">⏸️ Pause/Resume Simulation</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="text-purple-300 text-sm">Pause Duration (minutes)</label>
              <Input
                type="number"
                value={pauseDuration}
                onChange={(e) => setPauseDuration(parseInt(e.target.value))}
                min="1"
                max="1440"
                className="bg-slate-700 border-slate-600 text-white"
              />
            </div>
            <div className="flex items-end gap-2">
              <Button
                onClick={handlePause}
                disabled={pauseLoading}
                className="flex-1 bg-yellow-600 hover:bg-yellow-700"
              >
                {pauseLoading ? "Processing..." : "⏸️ Pause"}
              </Button>
              <Button
                onClick={handleResume}
                disabled={pauseLoading}
                className="flex-1 bg-green-600 hover:bg-green-700"
              >
                {pauseLoading ? "Processing..." : "▶️ Resume"}
              </Button>
            </div>
          </div>
          {stats?.paused_until && (
            <p className="text-amber-300 text-sm">
              Paused until: {new Date(stats.paused_until).toLocaleString()}
            </p>
          )}
        </CardContent>
      </Card>

      {/* Settings */}
      <Card className="bg-slate-800 border-purple-500">
        <CardHeader>
          <CardTitle className="text-white">⚙️ Simulation Settings</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="text-purple-300 text-sm">Batch Size</label>
              <Input
                type="number"
                value={batchSize}
                onChange={(e) => setBatchSize(parseInt(e.target.value))}
                min="1"
                max="50"
                className="bg-slate-700 border-slate-600 text-white"
              />
              <p className="text-xs text-purple-400 mt-1">Agents per cycle</p>
            </div>
            <div>
              <label className="text-purple-300 text-sm">Max Concurrent</label>
              <Input
                type="number"
                value={maxConcurrent}
                onChange={(e) => setMaxConcurrent(parseInt(e.target.value))}
                min="1"
                max="20"
                className="bg-slate-700 border-slate-600 text-white"
              />
              <p className="text-xs text-purple-400 mt-1">Parallel executions</p>
            </div>
          </div>
          <Button className="w-full bg-purple-600 hover:bg-purple-700">Save Changes</Button>
        </CardContent>
      </Card>
    </div>
  );
}

/**
 * Governance Panel
 */
function GovernancePanel() {
  return (
    <Card className="bg-slate-800 border-purple-500">
      <CardHeader>
        <CardTitle className="text-white">⚖️ Governance System</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          <p className="text-purple-300">Proposals, factions, and laws</p>
          <Button className="w-full bg-purple-600 hover:bg-purple-700">
            View All Proposals
          </Button>
          <Button className="w-full bg-slate-700 hover:bg-slate-600 text-white">
            Manage Factions
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

/**
 * Statistics Panel
 */
function StatisticsPanel() {
  return (
    <Card className="bg-slate-800 border-purple-500">
      <CardHeader>
        <CardTitle className="text-white">📊 Statistics</CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-purple-300">Agent relationships, goals, and performance</p>
      </CardContent>
    </Card>
  );
}

/**
 * Chat Panel
 */
function ChatPanel() {
  const [agentId, setAgentId] = useState("");
  const [message, setMessage] = useState("");
  const [response, setResponse] = useState("");
  const [loading, setLoading] = useState(false);
  const [aiDmsEnabled, setAiDmsEnabled] = useState(true);
  const [settingsLoading, setSettingsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Load AI DM settings on mount
  useEffect(() => {
    loadAiDmSettings();
  }, []);

  const loadAiDmSettings = async () => {
    try {
      setSettingsLoading(true);
      const res = await fetch("/api/admin/settings?action=getAiDms");
      const data = await res.json();
      setAiDmsEnabled(data.enabled !== false);
    } catch (err: any) {
      setError("Failed to load AI DM settings");
    } finally {
      setSettingsLoading(false);
    }
  };

  const handleAiDmsToggle = async (enabled: boolean) => {
    try {
      setSettingsLoading(true);
      const res = await fetch("/api/admin/settings", {
        method: "POST",
        body: JSON.stringify({ action: "setAiDms", enabled }),
      });
      const data = await res.json();
      if (data.success) {
        setAiDmsEnabled(enabled);
        setError(null);
      } else {
        setError(data.error || "Failed to update setting");
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSettingsLoading(false);
    }
  };

  const sendMessage = async () => {
    if (!agentId || !message) return;

    try {
      setLoading(true);
      const res = await fetch("/api/chat/ai", {
        method: "POST",
        body: JSON.stringify({ agent_id: agentId, message }),
      });
      const data = await res.json();
      setResponse(data.agent_response || "No response");
    } catch (err) {
      setResponse("Error: Failed to get response");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* AI DMs Settings */}
      <Card className="bg-slate-800 border-purple-500">
        <CardHeader>
          <CardTitle className="text-white">🤖 AI Direct Messages Settings</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-white font-semibold">Enable AI Agent Direct Messages</p>
              <p className="text-purple-300 text-sm">Allow users to send direct messages to AI agents</p>
            </div>
            <Button
              onClick={() => handleAiDmsToggle(!aiDmsEnabled)}
              disabled={settingsLoading}
              className={`${
                aiDmsEnabled
                  ? "bg-green-600 hover:bg-green-700"
                  : "bg-red-600 hover:bg-red-700"
              }`}
            >
              {settingsLoading ? "Updating..." : aiDmsEnabled ? "Enabled" : "Disabled"}
            </Button>
          </div>
          {error && <p className="text-red-400 text-sm">{error}</p>}
          <div className="bg-slate-700 p-3 rounded text-purple-200 text-sm">
            <p>
              When enabled: Users can message AI agents directly from the Direct Messages section, and AI agents will appear in their conversation list.
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Chat with Agents */}
      <Card className="bg-slate-800 border-purple-500">
        <CardHeader>
          <CardTitle className="text-white">💬 Chat with Agents</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <Input
            placeholder="Agent ID"
            value={agentId}
            onChange={(e) => setAgentId(e.target.value)}
            className="bg-slate-700 border-slate-600 text-white"
          />
          <Input
            placeholder="Your message..."
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            className="bg-slate-700 border-slate-600 text-white"
          />
          <Button
            onClick={sendMessage}
            disabled={loading}
            className="w-full bg-purple-600 hover:bg-purple-700"
          >
            {loading ? "Waiting..." : "Send Message"}
          </Button>
          {response && (
            <div className="bg-slate-700 p-3 rounded text-purple-200">
              <p className="text-sm font-bold text-white mb-2">Agent Response:</p>
              <p>{response}</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

/**
 * Background Jobs Panel
 */
function JobsPanel() {
  return (
    <Card className="bg-slate-800 border-purple-500">
      <CardHeader>
        <CardTitle className="text-white">⏰ Background Jobs</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {["decay_agent_relationships", "generate_agent_goals", "cleanup_expired_goals", "vacuum_agent_stats"].map((job) => (
            <div
              key={job}
              className="flex justify-between items-center bg-slate-700 p-3 rounded"
            >
              <span className="text-purple-200 text-sm">{job}</span>
              <Button size="sm" className="text-xs">
                Run Now
              </Button>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
