import { Component, type ReactNode } from "react";
import { NeoButton } from "@shared/components-react";
import "./ErrorBoundary.scss";

export interface ErrorBoundaryProps {
  showDetails?: boolean;
  onError?: (error: Error) => void;
  fallback?: string;
  children?: ReactNode;
  /** Translation function for i18n */
  t?: (key: string) => string;
  onRetry?: () => void;
  onReset?: () => void;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
  errorMessage: string;
}

/** Default translation fallback */
function defaultT(key: string): string {
  const fallbacks: Record<string, string> = {
    errorTitle: "Something went wrong",
    retry: "Retry",
    reset: "Reset",
    unexpectedError: "An unexpected error occurred",
  };
  return fallbacks[key] ?? key;
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null, errorMessage: "" };
  }

  static getDerivedStateFromError(error: Error): Partial<ErrorBoundaryState> {
    return {
      hasError: true,
      error,
      errorMessage: error.message || "An unexpected error occurred",
    };
  }

  componentDidCatch(error: Error) {
    this.props.onError?.(error);
  }

  handleRetry = () => {
    this.setState({ hasError: false, error: null });
    this.props.onRetry?.();
  };

  handleReset = () => {
    this.setState({ hasError: false, error: null, errorMessage: "" });
    this.props.onReset?.();
  };

  render() {
    const { showDetails = false, fallback, children } = this.props;
    const t = this.props.t ?? defaultT;
    const { hasError, error, errorMessage } = this.state;

    if (hasError) {
      const displayMessage = fallback || errorMessage || t("unexpectedError");

      return (
        <div className="error-boundary" role="alert">
          <div className="error-container">
            <span className="error-icon" aria-hidden="true">
              {"\u26A0\uFE0F"}
            </span>
            <span className="error-title">{t("errorTitle")}</span>
            <span className="error-message">{displayMessage}</span>
            <div className="error-actions">
              <NeoButton variant="primary" onClick={this.handleRetry} aria-label={t("retry")}>
                {t("retry")}
              </NeoButton>
              <NeoButton variant="secondary" onClick={this.handleReset} aria-label={t("reset")}>
                {t("reset")}
              </NeoButton>
            </div>
            {showDetails && (
              <div className="error-details">
                <span className="error-stack">{error?.stack || error?.message}</span>
              </div>
            )}
          </div>
        </div>
      );
    }

    return children;
  }
}

export default ErrorBoundary;
