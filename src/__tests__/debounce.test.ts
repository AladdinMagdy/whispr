import { debounce } from "../utils/debounce";

describe("debounce", () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it("should delay function execution by specified time", () => {
    // Arrange
    const mockFn = jest.fn();
    const debouncedFn = debounce(mockFn, 1000);

    // Act
    debouncedFn();
    expect(mockFn).not.toHaveBeenCalled();

    // Fast-forward time
    jest.advanceTimersByTime(1000);
    expect(mockFn).toHaveBeenCalledTimes(1);
  });

  it("should pass arguments correctly to the debounced function", () => {
    // Arrange
    const mockFn = jest.fn();
    const debouncedFn = debounce(mockFn, 500);

    // Act
    debouncedFn("arg1", "arg2", 123);
    jest.advanceTimersByTime(500);

    // Assert
    expect(mockFn).toHaveBeenCalledWith("arg1", "arg2", 123);
  });

  it("should reset timer when called multiple times", () => {
    // Arrange
    const mockFn = jest.fn();
    const debouncedFn = debounce(mockFn, 1000);

    // Act
    debouncedFn();
    jest.advanceTimersByTime(500); // Half way through
    debouncedFn(); // Reset timer
    jest.advanceTimersByTime(500); // Still not enough time
    expect(mockFn).not.toHaveBeenCalled();

    jest.advanceTimersByTime(500); // Now it should execute
    expect(mockFn).toHaveBeenCalledTimes(1);
  });

  it("should handle multiple rapid calls correctly", () => {
    // Arrange
    const mockFn = jest.fn();
    const debouncedFn = debounce(mockFn, 1000);

    // Act
    debouncedFn("call1");
    debouncedFn("call2");
    debouncedFn("call3");
    debouncedFn("call4");
    debouncedFn("call5");

    expect(mockFn).not.toHaveBeenCalled();

    jest.advanceTimersByTime(1000);
    expect(mockFn).toHaveBeenCalledTimes(1);
    expect(mockFn).toHaveBeenCalledWith("call5"); // Should only execute the last call
  });

  it("should work with different delay times", () => {
    // Arrange
    const mockFn = jest.fn();
    const debouncedFn = debounce(mockFn, 100);

    // Act
    debouncedFn();
    jest.advanceTimersByTime(50);
    expect(mockFn).not.toHaveBeenCalled();

    jest.advanceTimersByTime(50);
    expect(mockFn).toHaveBeenCalledTimes(1);
  });

  it("should handle zero delay", () => {
    // Arrange
    const mockFn = jest.fn();
    const debouncedFn = debounce(mockFn, 0);

    // Act
    debouncedFn();
    jest.advanceTimersByTime(0);

    // Assert
    expect(mockFn).toHaveBeenCalledTimes(1);
  });

  it("should handle functions that return values", () => {
    // Arrange
    const mockFn = jest.fn().mockReturnValue("test result");
    const debouncedFn = debounce(mockFn, 500);

    // Act
    const result = debouncedFn();
    jest.advanceTimersByTime(500);

    // Assert
    expect(result).toBeUndefined(); // debounced function returns void
    expect(mockFn).toHaveBeenCalledTimes(1);
    expect(mockFn).toHaveBeenCalledWith();
  });

  it("should handle functions with complex arguments", () => {
    // Arrange
    const mockFn = jest.fn();
    const debouncedFn = debounce(mockFn, 500);
    const complexArg = { name: "test", value: 123, nested: { prop: "value" } };

    // Act
    debouncedFn(complexArg, ["array", "of", "strings"], null, undefined);
    jest.advanceTimersByTime(500);

    // Assert
    expect(mockFn).toHaveBeenCalledWith(
      complexArg,
      ["array", "of", "strings"],
      null,
      undefined
    );
  });

  it("should handle async functions", async () => {
    // Arrange
    const mockAsyncFn = jest.fn().mockResolvedValue("async result");
    const debouncedFn = debounce(mockAsyncFn, 500);

    // Act
    debouncedFn();
    jest.advanceTimersByTime(500);

    // Assert
    expect(mockAsyncFn).toHaveBeenCalledTimes(1);
    // Note: The debounced function itself doesn't return a promise
  });

  it("should handle functions that throw errors", () => {
    // Arrange
    const error = new Error("Test error");
    const mockFn = jest.fn().mockImplementation(() => {
      throw error;
    });
    const debouncedFn = debounce(mockFn, 500);

    // Act & Assert
    expect(() => {
      debouncedFn();
      jest.advanceTimersByTime(500);
    }).toThrow("Test error");
  });

  it("should work with arrow functions", () => {
    // Arrange
    const arrowFn = jest.fn((x: number, y: number) => x + y);
    const debouncedFn = debounce(
      arrowFn as (...args: unknown[]) => unknown,
      300
    );

    // Act
    debouncedFn(5, 10);
    jest.advanceTimersByTime(300);

    // Assert
    expect(arrowFn).toHaveBeenCalledWith(5, 10);
  });

  it("should handle multiple debounced functions independently", () => {
    // Arrange
    const mockFn1 = jest.fn();
    const mockFn2 = jest.fn();
    const debouncedFn1 = debounce(mockFn1, 1000);
    const debouncedFn2 = debounce(mockFn2, 500);

    // Act
    debouncedFn1();
    debouncedFn2();

    jest.advanceTimersByTime(500);
    expect(mockFn1).not.toHaveBeenCalled();
    expect(mockFn2).toHaveBeenCalledTimes(1);

    jest.advanceTimersByTime(500);
    expect(mockFn1).toHaveBeenCalledTimes(1);
  });

  it("should handle edge case with very large delay", () => {
    // Arrange
    const mockFn = jest.fn();
    const debouncedFn = debounce(mockFn, 10000); // 10 seconds

    // Act
    debouncedFn();
    jest.advanceTimersByTime(9999);
    expect(mockFn).not.toHaveBeenCalled();

    jest.advanceTimersByTime(1);
    expect(mockFn).toHaveBeenCalledTimes(1);
  });

  it("should handle negative delay gracefully", () => {
    // Arrange
    const mockFn = jest.fn();
    const debouncedFn = debounce(mockFn, -100);

    // Act
    debouncedFn();
    jest.advanceTimersByTime(0);

    // Assert
    expect(mockFn).toHaveBeenCalledTimes(1);
  });

  it("should handle functions with no arguments", () => {
    // Arrange
    const mockFn = jest.fn();
    const debouncedFn = debounce(mockFn, 500);

    // Act
    debouncedFn();
    jest.advanceTimersByTime(500);

    // Assert
    expect(mockFn).toHaveBeenCalledWith();
  });

  it("should preserve function context when possible", () => {
    // Arrange
    const context = { value: 42 };
    const mockFn = jest.fn(function (this: typeof context) {
      return this.value;
    });
    const debouncedFn = debounce(mockFn, 500);

    // Act
    debouncedFn.call(context);
    jest.advanceTimersByTime(500);

    // Assert
    expect(mockFn).toHaveBeenCalled();
    // Note: The context might not be preserved due to how debounce is implemented
  });
});
