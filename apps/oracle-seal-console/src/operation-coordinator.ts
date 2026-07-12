export class OracleSealOperationConflictError extends Error {
  constructor() {
    super("Another Oracle Seal operation is already in progress");
    this.name = "OracleSealOperationConflictError";
  }
}

/**
 * One cross-action lane for key checks, sealing, retries, and local cleanup.
 * Duplicate reads join the same promise; conflicting product actions fail
 * immediately instead of racing observable state or presenting stale results.
 */
export function createOracleSealOperationCoordinator(
  onBusyChange: (busy: boolean) => void,
) {
  let active: { key: string; promise: Promise<unknown> } | null = null;

  return {
    activeKey: () => active?.key ?? "",
    run<T>(
      key: string,
      task: () => Promise<T>,
      options: { joinSame?: boolean } = {},
    ): Promise<T> {
      if (active) {
        if (options.joinSame && active.key === key) return active.promise as Promise<T>;
        return Promise.reject(new OracleSealOperationConflictError());
      }
      onBusyChange(true);
      const promise = Promise.resolve().then(task);
      active = { key, promise };
      return promise.finally(() => {
        if (active?.promise === promise) {
          active = null;
          onBusyChange(false);
        }
      });
    },
  };
}
