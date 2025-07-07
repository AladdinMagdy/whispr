import { useEffect, useRef } from "react";

interface PerformanceMetrics {
  renderTime: number;
  memoryUsage?: number;
  timestamp: number;
}

export const usePerformanceMonitor = (componentName: string) => {
  const renderStartTime = useRef<number>(Date.now());
  const renderCount = useRef<number>(0);

  useEffect(() => {
    const renderTime = Date.now() - renderStartTime.current;
    renderCount.current += 1;

    const metrics: PerformanceMetrics = {
      renderTime,
      timestamp: Date.now(),
    };

    // Log performance metrics
    if (renderTime > 100) {
      console.warn(
        `⚠️ Slow render detected in ${componentName}: ${renderTime}ms (render #${renderCount.current})`
      );
    } else {
      console.log(
        `✅ ${componentName} rendered in ${renderTime}ms (render #${renderCount.current})`
      );
    }

    // Reset timer for next render
    renderStartTime.current = Date.now();

    // Cleanup function
    return () => {
      // Component unmounting
      console.log(
        `🔄 ${componentName} unmounted after ${renderCount.current} renders`
      );
    };
  });

  // Return performance data for external monitoring
  return {
    renderCount: renderCount.current,
    getRenderTime: () => Date.now() - renderStartTime.current,
  };
};
