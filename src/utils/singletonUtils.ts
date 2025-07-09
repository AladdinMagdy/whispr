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
    if (typeof (serviceClass as any).destroyInstance === "function") {
      (serviceClass as any).destroyInstance();
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
  if (typeof (serviceClass as any).resetInstance === "function") {
    (serviceClass as any).resetInstance();
    console.log(`🔄 ${serviceName} singleton reset successfully`);
  }
}
