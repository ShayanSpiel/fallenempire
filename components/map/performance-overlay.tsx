"use client";

import React, { useEffect, useState } from "react";
import { globalPerformanceMonitor, type PerformanceMetrics } from "@/lib/performance-monitor";

export function PerformanceOverlay() {
  const [metrics, setMetrics] = useState<PerformanceMetrics | null>(null);
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const toggle = (e: KeyboardEvent) => {
      if (e.ctrlKey && e.key === "p") {
        setIsVisible((prev) => !prev);
      }
    };

    window.addEventListener("keydown", toggle);
    return () => window.removeEventListener("keydown", toggle);
  }, []);

  useEffect(() => {
    if (!isVisible) return;

    const interval = setInterval(() => {
      setMetrics(globalPerformanceMonitor.getMetrics());
    }, 100);

    return () => clearInterval(interval);
  }, [isVisible]);

  if (!isVisible || !metrics) return null;

  const fpsColor =
    metrics.fps >= 50
      ? "text-green-400"
      : metrics.fps >= 30
        ? "text-yellow-400"
        : "text-red-400";

  const frameTimeColor =
    metrics.frameTime <= 16.67
      ? "text-green-400"
      : metrics.frameTime <= 33
        ? "text-yellow-400"
        : "text-red-400";

  return (
    <div className="fixed bottom-4 right-4 z-50 font-mono text-xs bg-black/80 backdrop-blur-sm rounded-lg p-3 border border-white/20 text-white max-w-xs">
      <div className="mb-2 text-white/70 font-bold">Performance Debug (Ctrl+P to toggle)</div>

      <div className={`${fpsColor} mb-1`}>
        FPS: {metrics.fps.toFixed(1)} {metrics.fps >= 50 ? "✓" : "✗"}
      </div>

      <div className={`${frameTimeColor} mb-1`}>
        Frame: {metrics.frameTime.toFixed(2)}ms {metrics.frameTime <= 16.67 ? "✓" : "✗"}
      </div>

      <div className="text-blue-300 mb-1">
        Memory: {metrics.memoryMB.toFixed(1)}MB
      </div>

      <div className="text-cyan-300 mb-2 border-t border-white/10 pt-2">
        Network: {metrics.networkRequests.pending} pending
        <br />
        Avg latency: {metrics.networkRequests.avgLatency.toFixed(0)}ms
        <br />
        Total requests: {metrics.networkRequests.total}
      </div>

      <div className="text-white/50 text-[10px] mt-2 border-t border-white/10 pt-2">
        Recent latencies (ms):
        <div className="grid grid-cols-5 gap-1 mt-1">
          {metrics.supabaseLatency.slice(-10).map((lat, i) => (
            <div key={i} className={lat > 500 ? "text-red-400" : "text-cyan-300"}>
              {lat.toFixed(0)}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
