import { useEffect, useRef } from "react";

export const usePerformanceMonitor = (componentName: string) => {
  const renderStartTime = useRef<number>(Date.now());
  const renderCount = useRef<number>(0);
  const isMounted = useRef<boolean>(false);
  const lastRenderTime = useRef<number>(0);
  const mountTime = useRef<number>(0);
  const componentNameRef = useRef<string>(componentName);

  // Update componentName ref when it changes
  useEffect(() => {
    componentNameRef.current = componentName;
  }, [componentName]);

  // Track mounting/unmounting - only runs once on mount/unmount
  useEffect(() => {
    console.log(`🎯 ${componentNameRef.current} component mounted`);
    isMounted.current = true;
    mountTime.current = Date.now();
    renderStartTime.current = Date.now();

    return () => {
      const totalMountTime = Date.now() - mountTime.current;
      console.log(
        `🎯 ${componentNameRef.current} component unmounted (total mount time: ${totalMountTime}ms)`
      );
      isMounted.current = false;
    };
  }, []); // Empty dependency array - only runs on mount/unmount

  // Track render performance - runs on every render but efficiently
  useEffect(() => {
    if (!isMounted.current) return;

    const currentTime = Date.now();
    const renderTime = currentTime - renderStartTime.current;
    renderCount.current += 1;

    // Only log if this is a significant render (not just a quick re-render)
    if (renderTime > 100) {
      console.warn(
        `⚠️ Slow render detected in ${componentNameRef.current}: ${renderTime}ms (render #${renderCount.current})`
      );
    } else if (renderTime > 50) {
      console.log(
        `✅ ${componentNameRef.current} rendered in ${renderTime}ms (render #${renderCount.current})`
      );
    }

    // Update last render time and reset timer for next render
    lastRenderTime.current = renderTime;
    renderStartTime.current = currentTime;
  }); // No dependency array - runs on every render but efficiently

  // Return performance data for external monitoring
  return {
    renderCount: renderCount.current,
    lastRenderTime: lastRenderTime.current,
    isMounted: isMounted.current,
    getRenderTime: () => Date.now() - renderStartTime.current,
  };
};
