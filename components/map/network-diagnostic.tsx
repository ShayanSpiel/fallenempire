"use client";

import React, { useEffect, useState } from "react";

type NetworkRequest = {
  name: string;
  startTime: number;
  endTime?: number;
  duration?: number;
  size?: number;
};

const requests: NetworkRequest[] = [];

export function NetworkDiagnostic() {
  const [isVisible, setIsVisible] = useState(false);
  const [logs, setLogs] = useState<string[]>([]);

  useEffect(() => {
    const toggle = (e: KeyboardEvent) => {
      if (e.ctrlKey && e.shiftKey && e.key === "D") {
        setIsVisible((prev) => !prev);
      }
    };

    window.addEventListener("keydown", toggle);

    // Intercept console logs
    const originalLog = console.log;
    const originalDebug = console.debug;

    const captureLog = (...args: any[]) => {
      const msg = args
        .map((arg) =>
          typeof arg === "object" ? JSON.stringify(arg, null, 2) : String(arg)
        )
        .join(" ");

      if (msg.includes("[MapPage]")) {
        setLogs((prev) => {
          const newLogs = [
            `[${new Date().toLocaleTimeString()}] ${msg}`,
            ...prev,
          ];
          return newLogs.slice(0, 50); // Keep last 50 logs
        });
      }

      originalLog(...args);
    };

    console.log = captureLog;
    console.debug = captureLog;

    return () => {
      window.removeEventListener("keydown", toggle);
      console.log = originalLog;
      console.debug = originalDebug;
    };
  }, []);

  if (!isVisible) return null;

  return (
    <div className="fixed top-4 right-4 z-50 font-mono text-xs bg-black/90 backdrop-blur-sm rounded-lg p-4 border border-amber-500/50 text-amber-50 max-h-96 overflow-y-auto w-96">
      <div className="mb-2 text-amber-400 font-bold">
        Network Diagnostic (Ctrl+Shift+D to toggle)
      </div>

      <div className="text-amber-300 mb-3 border-b border-amber-500/30 pb-2">
        <div className="text-[10px] text-amber-500 uppercase tracking-widest">
          Request Timeline
        </div>
      </div>

      <div className="space-y-1 max-h-80 overflow-y-auto">
        {logs.map((log, i) => (
          <div key={i} className="text-amber-100 text-[10px] leading-tight">
            {log}
          </div>
        ))}
      </div>

      <div className="mt-3 pt-2 border-t border-amber-500/30 text-[10px] text-amber-500">
        <div>Ctrl+Shift+D: Toggle | F12: Browser DevTools Network Tab</div>
      </div>
    </div>
  );
}
