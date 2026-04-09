import { NeoButton } from "@shared/components-react";
import "./TreasuryLoadingState.scss";

interface TreasuryLoadingStateProps {
  t: (key: string, params?: Record<string, string | number>) => string;
  loading: boolean;
  error: string;
  hasData: boolean;
  onRetry?: () => void;
}

export default function TreasuryLoadingState({ t, loading, error, hasData, onRetry }: TreasuryLoadingStateProps) {
  if (hasData && loading) {
    return (
      <div className="soft-loading" role="status" aria-live="polite">
        <span className="soft-loading-text">{t("refreshing")}</span>
      </div>
    );
  }

  if (!hasData && loading) {
    return (
      <div className="loading-container" role="status" aria-live="polite">
        <div className="skeleton-card mb-4" aria-hidden="true" />
        <div className="loading-overlay">
          <span className="loading-label">{t("loading")}</span>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="error-container" role="alert">
        <span className="error-label">{error}</span>
        {onRetry && (
          <NeoButton variant="primary" className="mt-4" onClick={onRetry}>
            {t("retry")}
          </NeoButton>
        )}
      </div>
    );
  }

  return null;
}
