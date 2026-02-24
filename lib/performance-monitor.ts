/**
 * Real-time performance monitoring for debugging map lag and FPS issues
 */

export type PerformanceMetrics = {
  fps: number;
  frameTime: number;
  memoryMB: number;
  lastFrameTime: number;
  supabaseLatency: number[];
  renderTime: number;
  networkRequests: {
    pending: number;
    total: number;
    avgLatency: number;
  };
};

export class PerformanceMonitor {
  private frameCount = 0;
  private lastSecond = performance.now();
  private currentFps = 60;
  private frameHistory: number[] = [];
  private networkLatencies: number[] = [];
  private networkPending = 0;
  private networkTotal = 0;

  private static readonly MAX_HISTORY = 60; // Keep 1 second of data at 60fps

  startNetworkRequest() {
    this.networkPending++;
    this.networkTotal++;
  }

  endNetworkRequest(latencyMs: number) {
    this.networkPending--;
    this.networkLatencies.push(latencyMs);
    if (this.networkLatencies.length > PerformanceMonitor.MAX_HISTORY * 2) {
      this.networkLatencies.shift();
    }
  }

  recordFrame(deltaMs: number) {
    const now = performance.now();
    this.frameHistory.push(deltaMs);

    if (this.frameHistory.length > PerformanceMonitor.MAX_HISTORY) {
      this.frameHistory.shift();
    }

    this.frameCount++;

    if (now - this.lastSecond >= 1000) {
      this.currentFps = this.frameCount;
      this.frameCount = 0;
      this.lastSecond = now;
    }
  }

  getMetrics(): PerformanceMetrics {
    const avgFrameTime =
      this.frameHistory.length > 0
        ? this.frameHistory.reduce((a, b) => a + b, 0) / this.frameHistory.length
        : 0;

    const memory =
      typeof performance !== "undefined" &&
      (performance as any).memory &&
      (performance as any).memory.usedJSHeapSize
        ? ((performance as any).memory.usedJSHeapSize / 1024 / 1024).toFixed(1)
        : 0;

    const avgNetworkLatency =
      this.networkLatencies.length > 0
        ? this.networkLatencies.reduce((a, b) => a + b, 0) / this.networkLatencies.length
        : 0;

    return {
      fps: this.currentFps,
      frameTime: avgFrameTime,
      memoryMB: Number(memory),
      lastFrameTime: this.frameHistory[this.frameHistory.length - 1] || 0,
      supabaseLatency: this.networkLatencies.slice(-10),
      renderTime: avgFrameTime,
      networkRequests: {
        pending: this.networkPending,
        total: this.networkTotal,
        avgLatency: avgNetworkLatency,
      },
    };
  }
}

export const globalPerformanceMonitor = new PerformanceMonitor();
