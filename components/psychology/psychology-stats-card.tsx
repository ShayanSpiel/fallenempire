'use client';

import { useEffect, useState } from 'react';
import { Progress } from '@/components/ui/progress';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

interface PsychologyStats {
  mentalPower: number;
  physicalPower: number;
  morale: number;
  coherence: number;
  actionHeat: number;
  activityScore: number;
  heatLevel: string;
  persuasionEffect: string;
}

interface PsychologyStatsCardProps {
  userId: string;
  compact?: boolean;
}

export function PsychologyStatsCard({ userId, compact = false }: PsychologyStatsCardProps) {
  const [stats, setStats] = useState<PsychologyStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const response = await fetch(`/api/psychology/stats?userId=${userId}`);
        if (response.ok) {
          const data = await response.json();
          setStats(data);
        }
      } catch (error) {
        console.error('Failed to fetch psychology stats:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchStats();
    // Refresh every 30 seconds
    const interval = setInterval(fetchStats, 30000);
    return () => clearInterval(interval);
  }, [userId]);

  if (loading) {
    return (
      <Card className="w-full">
        <CardHeader>
          <CardTitle>Psychology Stats</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-muted-foreground">Loading...</div>
        </CardContent>
      </Card>
    );
  }

  if (!stats) {
    return null;
  }

  if (compact) {
    return (
      <div className="grid grid-cols-3 gap-2 text-sm">
        <StatBadge label="MP" value={stats.mentalPower} color="blue" />
        <StatBadge label="PP" value={stats.physicalPower} color="red" />
        <StatBadge label="Morale" value={stats.morale} color="green" />
      </div>
    );
  }

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle>Psychological State</CardTitle>
        <CardDescription>Your mental and physical characteristics</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Mental Power */}
        <div className="space-y-2">
          <div className="flex justify-between items-center">
            <label className="text-sm font-medium">Mental Power</label>
            <span className="text-sm font-bold text-blue-600">{stats.mentalPower}/100</span>
          </div>
          <Progress value={stats.mentalPower} className="h-2" />
          <p className="text-xs text-muted-foreground">Influence over AI agents: {stats.persuasionEffect}</p>
        </div>

        {/* Physical Power */}
        <div className="space-y-2">
          <div className="flex justify-between items-center">
            <label className="text-sm font-medium">Physical Power</label>
            <span className="text-sm font-bold text-red-600">{stats.physicalPower}/150</span>
          </div>
          <Progress value={(stats.physicalPower / 150) * 100} className="h-2" />
          <p className="text-xs text-muted-foreground">Combat effectiveness: {getPowerLevel(stats.physicalPower)}</p>
        </div>

        {/* Morale */}
        <div className="space-y-2">
          <div className="flex justify-between items-center">
            <label className="text-sm font-medium">Morale</label>
            <span className={`text-sm font-bold ${getMoraleColor(stats.morale)}`}>{stats.morale}/100</span>
          </div>
          <Progress value={stats.morale} className="h-2" />
          <p className="text-xs text-muted-foreground">Emotional state: {getMoraleLabel(stats.morale)}</p>
        </div>

        {/* Coherence */}
        <div className="space-y-2">
          <div className="flex justify-between items-center">
            <label className="text-sm font-medium">Coherence</label>
            <span className={`text-sm font-bold ${getCoherenceColor(stats.coherence)}`}>
              {(stats.coherence * 100).toFixed(0)}%
            </span>
          </div>
          <Progress value={((stats.coherence + 1) / 2) * 100} className="h-2" />
          <p className="text-xs text-muted-foreground">
            {stats.coherence > 0.5
              ? '✓ Your actions align with your identity'
              : stats.coherence > -0.5
                ? '~ Your actions are neutral to your identity'
                : '✗ Your actions contradict your identity (hypocrite)'}
          </p>
        </div>

        {/* Activity Score */}
        <div className="space-y-2">
          <div className="flex justify-between items-center">
            <label className="text-sm font-medium">Activity Score</label>
            <span className="text-sm font-bold text-purple-600">{stats.activityScore}/100</span>
          </div>
          <Progress value={stats.activityScore} className="h-2" />
          <p className="text-xs text-muted-foreground">Action diversity: {getActivityLabel(stats.activityScore)}</p>
        </div>

        {/* Action Heat */}
        <div className="space-y-2">
          <div className="flex justify-between items-center">
            <label className="text-sm font-medium">Action Heat</label>
            <span className={`text-sm font-bold ${getHeatColor(stats.actionHeat)}`}>{stats.actionHeat.toFixed(0)}/200</span>
          </div>
          <Progress value={(stats.actionHeat / 200) * 100} className="h-2" />
          <p className="text-xs text-muted-foreground">
            {stats.heatLevel} {stats.actionHeat > 100 ? '⚠️ Actions blocked!' : ''}
          </p>
        </div>

        {/* Stats Summary */}
        <div className="border-t pt-4">
          <h4 className="text-sm font-semibold mb-2">Quick Summary</h4>
          <div className="grid grid-cols-2 gap-2 text-xs text-muted-foreground">
            <div>
              <span className="font-medium">Influence:</span> {stats.mentalPower > 70 ? 'High' : stats.mentalPower > 40 ? 'Moderate' : 'Low'}
            </div>
            <div>
              <span className="font-medium">Combat:</span> {stats.physicalPower > 90 ? 'Strong' : stats.physicalPower > 60 ? 'Moderate' : 'Weak'}
            </div>
            <div>
              <span className="font-medium">Consistency:</span> {Math.abs(stats.coherence) > 0.5 ? 'Aligned' : 'Mixed'}
            </div>
            <div>
              <span className="font-medium">Playstyle:</span> {stats.activityScore > 70 ? 'Diverse' : 'Specialized'}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

function StatBadge({ label, value, color }: { label: string; value: number; color: string }) {
  const colorClasses = {
    blue: 'bg-blue-50 text-blue-700 border-blue-200',
    red: 'bg-red-50 text-red-700 border-red-200',
    green: 'bg-green-50 text-green-700 border-green-200',
    purple: 'bg-purple-50 text-purple-700 border-purple-200',
  };

  return (
    <div className={`border rounded px-2 py-1 text-center ${colorClasses[color as keyof typeof colorClasses]}`}>
      <div className="text-xs font-semibold">{label}</div>
      <div className="text-lg font-bold">{Math.round(value)}</div>
    </div>
  );
}

function getMoraleLabel(morale: number): string {
  if (morale >= 80) return 'Ecstatic';
  if (morale >= 60) return 'Happy';
  if (morale >= 40) return 'Content';
  if (morale >= 20) return 'Discouraged';
  return 'Rebellious';
}

function getMoraleColor(morale: number): string {
  if (morale >= 80) return 'text-green-600';
  if (morale >= 60) return 'text-green-500';
  if (morale >= 40) return 'text-yellow-500';
  if (morale >= 20) return 'text-orange-500';
  return 'text-red-600';
}

function getCoherenceColor(coherence: number): string {
  if (coherence > 0.5) return 'text-green-600';
  if (coherence > -0.5) return 'text-yellow-500';
  return 'text-red-600';
}

function getPowerLevel(pp: number): string {
  if (pp >= 120) return 'Legendary';
  if (pp >= 100) return 'Epic';
  if (pp >= 75) return 'Strong';
  if (pp >= 50) return 'Normal';
  if (pp >= 25) return 'Weak';
  return 'Critical';
}

function getActivityLabel(activity: number): string {
  if (activity >= 80) return 'Highly diverse';
  if (activity >= 60) return 'Diverse';
  if (activity >= 40) return 'Balanced';
  if (activity >= 20) return 'Specialized';
  return 'Very specialized';
}

function getHeatColor(heat: number): string {
  if (heat > 150) return 'text-red-700';
  if (heat > 100) return 'text-red-600';
  if (heat > 50) return 'text-orange-500';
  return 'text-blue-600';
}
