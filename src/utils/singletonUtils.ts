/**
 * Singleton utility functions to consolidate repeated patterns across services
 */

/**
 * Generic singleton destroy function
 * Consolidates duplicate destroy patterns across multiple services
 */
export function destroySingleton<T>(
  serviceClass: { instance?: T; destroyInstance?: () => void },
  serviceName: string
): void {
  const instance = (serviceClass as unknown as { instance?: T }).instance;
  if (instance) {
    // Call destroyInstance if it exists
    const destroyInstance = (serviceClass as { destroyInstance?: () => void })
      .destroyInstance;
    if (typeof destroyInstance === "function") {
      destroyInstance();
    } else {
      // Fallback: clear the instance
      (serviceClass as unknown as { instance?: T }).instance = undefined;
    }
    console.log(`🗑️ ${serviceName} singleton destroyed`);
  }
}

/**
 * Generic singleton reset function
 */
export function resetSingleton<T>(
  serviceClass: { instance?: T; resetInstance?: () => void },
  serviceName: string
): void {
  const resetInstance = (serviceClass as { resetInstance?: () => void })
    .resetInstance;
  if (typeof resetInstance === "function") {
    resetInstance();
    console.log(`🔄 ${serviceName} singleton reset successfully`);
  }
}
