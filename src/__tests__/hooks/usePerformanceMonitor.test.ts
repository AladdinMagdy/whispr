import { renderHook } from "@testing-library/react-native";
import { usePerformanceMonitor } from "@/hooks/usePerformanceMonitor";

describe("usePerformanceMonitor", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(console, "log").mockImplementation();
    jest.spyOn(console, "warn").mockImplementation();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it("should initialize with correct default values", () => {
    const { result } = renderHook(() => usePerformanceMonitor("TestComponent"));

    expect(result.current.renderCount).toBe(0);
    expect(result.current.lastRenderTime).toBe(0);
    expect(result.current.isMounted).toBe(false); // isMounted starts as false until useEffect runs
    expect(typeof result.current.getRenderTime).toBe("function");
  });

  it("should log mount message on initialization", () => {
    renderHook(() => usePerformanceMonitor("TestComponent"));

    expect(console.log).toHaveBeenCalledWith(
      "🎯 TestComponent component mounted"
    );
  });

  it("should log unmount message when component unmounts", () => {
    const { unmount } = renderHook(() =>
      usePerformanceMonitor("TestComponent")
    );

    unmount();

    expect(console.log).toHaveBeenCalledWith(
      expect.stringMatching(
        /🎯 TestComponent component unmounted \(total mount time: \d+ms\)/
      )
    );
  });

  it("should track render count correctly", () => {
    const { result, rerender } = renderHook(() =>
      usePerformanceMonitor("TestComponent")
    );

    // Initial render
    expect(result.current.renderCount).toBe(0);

    // First re-render
    rerender({});
    expect(result.current.renderCount).toBe(1);

    // Second re-render
    rerender({});
    expect(result.current.renderCount).toBe(2);
  });

  it("should calculate render time correctly", () => {
    const { result } = renderHook(() => usePerformanceMonitor("TestComponent"));

    const startTime = Date.now();
    const renderTime = result.current.getRenderTime();
    const endTime = Date.now();

    // Render time should be within a reasonable range
    expect(renderTime).toBeGreaterThanOrEqual(0);
    expect(renderTime).toBeLessThanOrEqual(endTime - startTime + 10); // Allow small timing variance
  });

  it("should update component name when it changes", () => {
    const { result, rerender } = renderHook(
      ({ name }: { name: string }) => usePerformanceMonitor(name),
      { initialProps: { name: "InitialComponent" } }
    );

    rerender({ name: "UpdatedComponent" });

    // The hook should handle the name change gracefully
    expect(result.current.isMounted).toBe(true);
  });

  it("should log slow render warnings for renders > 100ms", () => {
    // Mock Date.now to simulate slow render
    const originalDateNow = Date.now;
    let mockTime = 0;
    Date.now = jest.fn(() => {
      mockTime += 150; // Simulate 150ms render time
      return mockTime;
    });

    renderHook(() => usePerformanceMonitor("SlowComponent"));

    // Trigger a render by updating the component name
    const { rerender } = renderHook(
      ({ name }: { name: string }) => usePerformanceMonitor(name),
      { initialProps: { name: "SlowComponent" } }
    );

    rerender({ name: "SlowComponentUpdated" });

    expect(console.warn).toHaveBeenCalledWith(
      expect.stringMatching(
        /⚠️ Slow render detected in SlowComponentUpdated: \d+ms \(render #\d+\)/
      )
    );

    // Restore original Date.now
    Date.now = originalDateNow;
  });

  it("should log normal render info for renders between 50-100ms", () => {
    // Mock Date.now to simulate medium render time
    const originalDateNow = Date.now;
    let mockTime = 0;
    Date.now = jest.fn(() => {
      mockTime += 75; // Simulate 75ms render time
      return mockTime;
    });

    renderHook(() => usePerformanceMonitor("MediumComponent"));

    // Trigger a render
    const { rerender } = renderHook(
      ({ name }: { name: string }) => usePerformanceMonitor(name),
      { initialProps: { name: "MediumComponent" } }
    );

    rerender({ name: "MediumComponentUpdated" });

    expect(console.log).toHaveBeenCalledWith(
      expect.stringMatching(
        /✅ MediumComponent rendered in \d+ms \(render #\d+\)/
      )
    );

    // Restore original Date.now
    Date.now = originalDateNow;
  });

  it("should not log for fast renders (< 50ms)", () => {
    // Mock Date.now to simulate fast render
    const originalDateNow = Date.now;
    let mockTime = 0;
    Date.now = jest.fn(() => {
      mockTime += 25; // Simulate 25ms render time
      return mockTime;
    });

    renderHook(() => usePerformanceMonitor("FastComponent"));

    // Trigger a render
    const { rerender } = renderHook(
      ({ name }: { name: string }) => usePerformanceMonitor(name),
      { initialProps: { name: "FastComponent" } }
    );

    rerender({ name: "FastComponentUpdated" });

    // Should not log anything for fast renders
    expect(console.log).not.toHaveBeenCalledWith(
      expect.stringMatching(/FastComponentUpdated rendered/)
    );
    expect(console.warn).not.toHaveBeenCalledWith(
      expect.stringMatching(/FastComponentUpdated/)
    );

    // Restore original Date.now
    Date.now = originalDateNow;
  });

  it("should maintain isMounted state correctly", () => {
    const { result, unmount } = renderHook(() =>
      usePerformanceMonitor("TestComponent")
    );

    // Should be mounted initially (after useEffect runs)
    expect(result.current.isMounted).toBe(false); // Initially false

    // Should be unmounted after unmount
    unmount();
    expect(result.current.isMounted).toBe(false);
  });

  it("should handle multiple instances independently", () => {
    const { result: result1 } = renderHook(() =>
      usePerformanceMonitor("Component1")
    );
    const { result: result2 } = renderHook(() =>
      usePerformanceMonitor("Component2")
    );

    expect(result1.current.renderCount).toBe(0);
    expect(result2.current.renderCount).toBe(0);

    // Each should track independently
    expect(result1.current.isMounted).toBe(false); // Initially false
    expect(result2.current.isMounted).toBe(false); // Initially false
  });

  it("should provide consistent interface", () => {
    const { result } = renderHook(() => usePerformanceMonitor("TestComponent"));

    // Check that all expected properties exist
    expect(result.current).toHaveProperty("renderCount");
    expect(result.current).toHaveProperty("lastRenderTime");
    expect(result.current).toHaveProperty("isMounted");
    expect(result.current).toHaveProperty("getRenderTime");

    // Check that getRenderTime is a function
    expect(typeof result.current.getRenderTime).toBe("function");
  });
});
