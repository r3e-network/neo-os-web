import { NeoButton } from "@shared/components-react";
import { StateView } from "@shared/components";
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
    return <StateView kind="loading" title={t("loading")} />;
  }

  if (error) {
    return (
      <StateView
        kind="error"
        title={error}
        action={
          onRetry ? (
            <NeoButton variant="primary" onClick={onRetry}>
              {t("retry")}
            </NeoButton>
          ) : undefined
        }
      />
    );
  }

  return null;
}
