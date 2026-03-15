/**
 * Provides default ErrorBoundary handlers for miniapps.
 *
 * Usage:
 *   const { handleBoundaryError, resetAndReload } = useHandleBoundaryError('my-app');
 *
 * For apps with custom reload logic, override resetAndReload:
 *   const { handleBoundaryError } = useHandleBoundaryError('my-app');
 *   const resetAndReload = async () => { await fetchData(); };
 */
export function useHandleBoundaryError(appName: string) {
  const handleBoundaryError = (error: Error) => {
    console.error(`[${appName}] boundary error:`, error);
  };

  const resetAndReload = () => {
    // Default no-op; override in app if needed
  };

  return { handleBoundaryError, resetAndReload };
}
