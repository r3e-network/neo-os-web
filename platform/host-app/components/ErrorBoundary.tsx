import type { ErrorInfo, ReactNode } from "react";
import React, { Component } from "react";
import * as Sentry from "@sentry/nextjs";
import { logger } from "@/lib/logger";

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
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
    logger.error("ErrorBoundary caught an error", error);

    this.setState({
      error,
      errorInfo,
    });

    // In production, send to error tracking service
    if (process.env.NODE_ENV === "production") {
      Sentry.captureException(error, {
        contexts: {
          react: {
            componentStack: errorInfo.componentStack,
          },
        },
      });
    }
  }

  handleReset = (): void => {
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null,
    });
  };

  render(): ReactNode {
    if (this.state.hasError) {
      // Custom fallback UI
      if (this.props.fallback) {
        return this.props.fallback;
      }

      // Default fallback UI
      return (
        <div className="min-h-screen flex items-center justify-center bg-white dark:bg-erobo-bg-dark px-4">
          <div className="max-w-md w-full bg-white dark:bg-erobo-bg-card rounded-lg shadow-lg p-6">
            <div className="flex items-center justify-center w-12 h-12 mx-auto bg-red-100 dark:bg-red-900/20 rounded-full mb-4">
              <svg
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

            <h2 className="text-xl font-semibold text-erobo-ink dark:text-white text-center mb-2">
              Something went wrong
            </h2>

            <p className="text-erobo-ink-soft dark:text-slate-400 text-center mb-6">
              We apologize for the inconvenience. The application encountered an unexpected error.
            </p>

            {process.env.NODE_ENV === "development" && this.state.error && (
              <details className="mb-4 p-4 bg-erobo-purple/5 dark:bg-white/5 rounded text-xs overflow-auto">
                <summary className="cursor-pointer font-semibold text-erobo-ink dark:text-slate-300 mb-2">
                  Error Details (Development Only)
                </summary>
                <pre className="text-red-600 dark:text-red-400 whitespace-pre-wrap break-words">
                  {this.state.error.toString()}
                  {this.state.errorInfo?.componentStack}
                </pre>
              </details>
            )}

            <div className="flex gap-3">
              <button
                onClick={this.handleReset}
                className="flex-1 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-medium transition-colors"
              >
                Try Again
              </button>
              <button
                onClick={() => (window.location.href = "/")}
                className="flex-1 px-4 py-2 bg-erobo-purple/10 hover:bg-erobo-purple/20 dark:bg-white/10 dark:hover:bg-white/20 text-erobo-ink dark:text-white rounded-lg font-medium transition-colors"
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
