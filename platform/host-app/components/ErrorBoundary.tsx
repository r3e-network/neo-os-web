import React, { Component, ErrorInfo, ReactNode } from "react";
import { logger } from "@/lib/logger";
import { trackError, getTrackedErrors, getErrorCount, type ErrorCategory } from "@/lib/monitoring/errors";

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
  // Optional: provide component name for better error tracking
  componentName?: string;
  // Optional: custom error handler
  onError?: (error: Error, errorInfo: ErrorInfo) => void;
  // Optional: show error count badge
  showErrorCount?: boolean;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
  errorId?: string;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
    };
  }

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    // Track error with monitoring system
    const errorId = trackError(error, {
      category: this.getCategoryFromProps(),
      componentStack: errorInfo.componentStack || undefined,
      extra: {
        componentName: this.props.componentName,
      },
    });
    
    // Log to logger
    logger.error(`ErrorBoundary [${this.props.componentName || "Unknown"}] caught an error:`, error);
    
    // Set state with error ID
    this.setState({
      error,
      errorInfo,
      errorId,
    });
    
    // Call custom error handler if provided
    this.props.onError?.(error, errorInfo);
  }

  getCategoryFromProps(): ErrorCategory {
    // Can be extended to determine category based on component type
    return "render";
  }

  handleReset = (): void => {
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null,
      errorId: undefined,
    });
  };

  handleReport = (): void => {
    if (this.state.errorId) {
      // In production, this would open a bug report dialog
      // or send to a bug tracking service
      const errorReportUrl = `mailto:support@example.com?subject=Error Report: ${this.state.errorId}&body=${encodeURIComponent(
        `Error ID: ${this.state.errorId}\nError: ${this.state.error?.toString()}\n\nStack: ${this.state.errorInfo?.componentStack || "N/A"}`
      )}`;
      window.open(errorReportUrl);
    }
  };

  render(): ReactNode {
    if (this.state.hasError) {
      // Custom fallback UI
      if (this.props.fallback) {
        return this.props.fallback;
      }

      // Default fallback UI
      return (
        <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900 px-4">
          <div className="max-w-md w-full bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6">
            <div className="flex items-center justify-center w-12 h-12 mx-auto bg-red-100 dark:bg-red-900/20 rounded-full mb-4">
              <svg
                aria-hidden="true"
                className="w-6 h-6 text-red-600 dark:text-red-400"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                />
              </svg>
            </div>

            <h2 className="text-xl font-bold text-gray-900 dark:text-white text-center mb-2">
              Something went wrong
            </h2>

            <p className="text-gray-600 dark:text-gray-400 text-center mb-6">
              We apologize for the inconvenience. The application encountered an unexpected error.
            </p>

            {this.state.errorId && (
              <div className="text-xs text-gray-500 dark:text-gray-400 text-center mb-4">
                Error ID: <code className="bg-gray-100 dark:bg-gray-700 px-1 rounded">{this.state.errorId}</code>
              </div>
            )}

            {process.env.NODE_ENV === "development" && this.state.error && (
              <details className="mb-4 p-4 bg-gray-100 dark:bg-gray-900 rounded-lg text-xs overflow-auto">
                <summary className="cursor-pointer font-semibold text-gray-700 dark:text-gray-300 mb-2">
                  Error Details (Development Only)
                </summary>
                <pre className="text-red-600 dark:text-red-400 whitespace-pre-wrap break-words">
                  {this.state.error.toString()}
                  {this.state.errorInfo?.componentStack}
                </pre>
              </details>
            )}

            <div className="flex gap-2">
              <button
                type="button"
                onClick={this.handleReset}
                className="flex-1 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-medium transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neo/50"
              >
                Try Again
              </button>
              <button
                type="button"
                onClick={this.handleReport}
                aria-label="Report this error"
                className="px-4 py-2 bg-gray-200 hover:bg-gray-300 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-900 dark:text-white rounded-lg font-medium transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neo/50"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                </svg>
              </button>
              <button
                type="button"
                onClick={() => (window.location.href = "/")}
                className="px-4 py-2 bg-gray-200 hover:bg-gray-300 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-900 dark:text-white rounded-lg font-medium transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neo/50"
              >
                Go Home
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

/**
 * HOC to wrap a component with ErrorBoundary
 */
export function withErrorBoundary<P extends object>(
  WrappedComponent: React.ComponentType<P>,
  errorBoundaryProps?: Omit<Props, "children">
): React.FC<P> {
  const displayName = WrappedComponent.displayName || WrappedComponent.name || "Component";
  
  const WithErrorBoundary: React.FC<P> = (props) => (
    <ErrorBoundary componentName={displayName} {...errorBoundaryProps}>
      <WrappedComponent {...props} />
    </ErrorBoundary>
  );
  
  WithErrorBoundary.displayName = `withErrorBoundary(${displayName})`;
  return WithErrorBoundary;
}

/**
 * Hook to get global error state
 */
export function useGlobalErrors() {
  const [errorCount, setErrorCount] = React.useState(0);
  const [errors, setErrors] = React.useState<ReturnType<typeof getTrackedErrors>>([]);
  
  React.useEffect(() => {
    let active = true;
    const update = () => {
      if (!active) return;
      setErrorCount(getErrorCount());
      setErrors(getTrackedErrors());
    };

    update();

    const interval = setInterval(update, 5000);
    return () => {
      active = false;
      clearInterval(interval);
    };
  }, []);
  
  return { errorCount, errors };
}

export default ErrorBoundary;
