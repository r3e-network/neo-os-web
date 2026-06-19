import { NeoButton } from "@shared/components-react";
import { StateView } from "@shared/components";
import "./TreasuryLoadingState.scss";

interface TreasuryLoadingStateProps {
  t: (key: string, params?: Record<string, string | number>) => string;
  loading: boolean;
  error: string;
  hasData: boolean;
  /**
   * True when the first balance load has not resolved within the watchdog
   * timeout. Prevents an indefinite spinner when there is no chain/host
   * context: the placeholder becomes an actionable empty state instead.
   */
  timedOut?: boolean;
  onRetry?: () => void;
}

export default function TreasuryLoadingState({
  t,
  loading,
  error,
  hasData,
  timedOut,
  onRetry,
}: TreasuryLoadingStateProps) {
  const retryAction = onRetry ? (
    <NeoButton variant="primary" onClick={onRetry}>
      {t("retry")}
    </NeoButton>
  ) : undefined;

  if (hasData && loading) {
    return (
      <div className="soft-loading" role="status" aria-live="polite">
        <span className="soft-loading-text">{t("refreshing")}</span>
      </div>
    );
  }

  if (error) {
    return <StateView kind="error" title={error} action={retryAction} />;
  }

  // Watchdog: a first load that never resolves drops to an actionable empty
  // state rather than spinning forever.
  if (!hasData && timedOut) {
    return (
      <StateView
        kind="empty"
        title={t("treasuryLoadTimeout")}
        hint={t("treasuryLoadTimeoutHint")}
        action={retryAction}
      />
    );
  }

  if (!hasData && loading) {
    return <StateView kind="loading" title={t("loading")} />;
  }

  return null;
}
