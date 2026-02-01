/**
 * Request cancellation utilities for the SDK
 */

/**
 * Creates a cancellable request controller
 */
export function createCancellableRequest() {
  const controller = new AbortController();
  
  return {
    signal: controller.signal,
    cancel: () => controller.abort(),
    isCancelled: () => controller.signal.aborted,
  };
}

/**
 * Manages multiple cancellable requests
 */
export class RequestManager {
  private controllers = new Map<string, AbortController>();

  /**
   * Creates a new request with the given key
   */
  create(key: string): AbortSignal {
    // Cancel any existing request with the same key
    this.cancel(key);
    
    const controller = new AbortController();
    this.controllers.set(key, controller);
    return controller.signal;
  }

  /**
   * Cancels a request by key
   */
  cancel(key: string): void {
    const controller = this.controllers.get(key);
    if (controller) {
      controller.abort();
      this.controllers.delete(key);
    }
  }

  /**
   * Cancels all pending requests
   */
  cancelAll(): void {
    for (const controller of this.controllers.values()) {
      controller.abort();
    }
    this.controllers.clear();
  }

  /**
   * Checks if a request is pending
   */
  isPending(key: string): boolean {
    const controller = this.controllers.get(key);
    return controller ? !controller.signal.aborted : false;
  }
}

// Global request manager instance
export const requestManager = new RequestManager();
