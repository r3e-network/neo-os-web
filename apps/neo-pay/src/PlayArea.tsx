/**
 * PlayArea.tsx -- Neo Pay
 *
 * Stream payment management interface with stats overview,
 * stream creation form, separate created/beneficiary stream lists
 * with progress bars, and cancel/claim actions.
 */

import { useEffect, useMemo, useState } from "react";
import { NeoButton, NeoCard, NeoInput } from "@shared/components-react";
import { useStateBindings } from "@shared/react/hooks/useStateBindings";
import type { Observable } from "@shared/react/context";
import type { MiniAppLaunchContext } from "@shared/utils/launch-params";
import "./PlayArea.scss";

interface PlayAreaProps {
  t: (key: string, params?: Record<string, string | number>) => string;
  state: Record<string, Observable>;
  dispatch: (name: string, ...args: unknown[]) => Promise<void>;
  launchContext: MiniAppLaunchContext;
}

interface Stream {
  id: string;
  recipient?: string;
  sender?: string;
  amount?: number;
  remaining?: number;
  duration?: number;
  status?: string;
  startTime?: number;
  endTime?: number;
  token?: string;
}

function getLaunchValue(
  launchContext: MiniAppLaunchContext,
  keys: string[],
): string {
  for (const key of keys) {
    const value = String(launchContext.params?.[key] ?? "").trim();
    if (value) return value;
  }
  return "";
}

export default function PlayArea({
  t,
  state,
  dispatch,
  launchContext,
}: PlayAreaProps) {
  const { str, bool, num, val } = useStateBindings(state);

  /* ---------- Bound state ---------- */
  const isLoading = bool("isLoading");
  const isCreating = bool("isCreating");
  const activeCount = num("activeCount");
  const createdStreamCount = num("createdStreamCount");
  const beneficiaryStreamCount = num("beneficiaryStreamCount");
  const totalStreamCount = num("totalStreamCount");

  const createdStreams = (val("createdStreams") ?? []) as Stream[];
  const beneficiaryStreams = (val("beneficiaryStreams") ?? []) as Stream[];
  const allStreams = (val("allStreams") ?? []) as Stream[];

  /* ---------- Local form state ---------- */
  const launchDefaults = useMemo(() => {
    const recipient = getLaunchValue(launchContext, [
      "recipient",
      "to",
      "beneficiary",
    ]);
    const amount = getLaunchValue(launchContext, ["amount", "total"]);
    const duration =
      getLaunchValue(launchContext, ["duration", "durationDays", "days"]) ||
      (recipient && amount ? "1" : "");
    const token =
      getLaunchValue(launchContext, ["token", "asset"]).toUpperCase() || "GAS";
    return { recipient, amount, duration, token };
  }, [launchContext.signature]);

  const [recipient, setRecipient] = useState(launchDefaults.recipient);
  const [amount, setAmount] = useState(launchDefaults.amount);
  const [duration, setDuration] = useState(launchDefaults.duration);
  const [token, setToken] = useState(launchDefaults.token);

  useEffect(() => {
    if (launchDefaults.recipient) setRecipient(launchDefaults.recipient);
    if (launchDefaults.amount) setAmount(launchDefaults.amount);
    if (launchDefaults.duration) setDuration(launchDefaults.duration);
    if (launchDefaults.token) setToken(launchDefaults.token);
  }, [launchDefaults]);

  /* ---------- Handlers ---------- */
  const handleCreateStream = async () => {
    if (!recipient || !amount || !duration) return;
    await dispatch("createStream", { recipient, amount, duration, token });
    setRecipient("");
    setAmount("");
    setDuration("");
    setToken("GAS");
  };

  const handleCancel = async (id: string) => {
    await dispatch("cancelStream", id);
  };

  const handleClaim = async (id: string) => {
    await dispatch("claimStream", id);
  };

  /* ---------- Helpers ---------- */
  const formatAddress = (addr: string) =>
    addr.length > 14 ? `${addr.slice(0, 8)}...${addr.slice(-6)}` : addr;

  const getStreamProgress = (stream: Stream): number => {
    if (stream.amount === undefined || stream.amount <= 0) return 0;
    if (stream.remaining === undefined) {
      // Fall back to time-based if remaining is not set
      if (stream.startTime && stream.endTime) {
        const now = Date.now();
        const total = stream.endTime - stream.startTime;
        const elapsed = now - stream.startTime;
        return Math.min(Math.max(elapsed / total, 0), 1) * 100;
      }
      return 0;
    }
    return ((stream.amount - stream.remaining) / stream.amount) * 100;
  };

  const getStreamed = (stream: Stream): string => {
    if (stream.amount === undefined) return "0";
    if (stream.remaining !== undefined) {
      return (stream.amount - stream.remaining).toFixed(2);
    }
    return "0";
  };

  const getProgressColor = (pct: number): string => {
    if (pct >= 100) return "#3b82f6";
    if (pct >= 50) return "#00e599";
    return "#00c9ff";
  };

  const tokenOptions = ["GAS", "NEO", "bNEO"];

  return (
    <div className="neopay-play-area">
      {/* ==================== Stats Bar ==================== */}
      <div className="neopay-hero-stats">
        <div className="neopay-hero-stat">
          <span className="neopay-hero-stat-value">{totalStreamCount}</span>
          <span className="neopay-hero-stat-label">
            {t("totalStreams") || "Total Streams"}
          </span>
        </div>
        <div className="neopay-hero-stat">
          <span className="neopay-hero-stat-value">{activeCount}</span>
          <span className="neopay-hero-stat-label">
            {t("active") || "Active"}
          </span>
        </div>
        <div className="neopay-hero-stat">
          <span className="neopay-hero-stat-value">{createdStreamCount}</span>
          <span className="neopay-hero-stat-label">
            {t("createdByYou") || "Created by You"}
          </span>
        </div>
        <div className="neopay-hero-stat">
          <span className="neopay-hero-stat-value">
            {beneficiaryStreamCount}
          </span>
          <span className="neopay-hero-stat-label">
            {t("youAreBeneficiary") || "You're Beneficiary"}
          </span>
        </div>
      </div>

      {/* ==================== Create Stream Form ==================== */}
      <NeoCard
        variant="erobo"
        title={t("createStream") || "Create Stream"}
      >
        <div className="neopay-form">
          <NeoInput
            label={t("recipient") || "Recipient Address"}
            placeholder={
              t("recipientPlaceholder") || "N3 address..."
            }
            value={recipient}
            onChange={setRecipient}
          />
          <NeoInput
            label={t("amount") || "Amount"}
            placeholder="0.00"
            type="number"
            value={amount}
            suffix={token}
            onChange={setAmount}
          />
          <NeoInput
            label={t("duration") || "Duration"}
            placeholder={t("durationPlaceholder") || "Number of days"}
            type="number"
            value={duration}
            suffix={t("days") || "days"}
            onChange={setDuration}
          />

          {/* Token Selector */}
          <div className="neopay-token-selector">
            <span className="neopay-token-label">
              {t("token") || "Token"}
            </span>
            <div className="neopay-token-options">
              {tokenOptions.map((tk) => (
                <button
                  key={tk}
                  className={`neopay-token-option ${token === tk ? "neopay-token-option--active" : ""}`}
                  onClick={() => setToken(tk)}
                  type="button"
                >
                  {tk}
                </button>
              ))}
            </div>
          </div>

          <NeoButton
            variant="primary"
            block
            loading={isCreating}
            disabled={!recipient || !amount || !duration || isCreating}
            onClick={handleCreateStream}
          >
            {t("createStream") || "Create Stream"}
          </NeoButton>
        </div>
      </NeoCard>

      {/* ==================== Your Created Streams ==================== */}
      <NeoCard
        variant="erobo"
        title={`${t("yourCreatedStreams") || "Your Created Streams"} (${createdStreams.length})`}
      >
        {isLoading ? (
          <div className="neopay-loading">
            <div className="neopay-loading-spinner" />
            <span>{t("loading") || "Loading..."}</span>
          </div>
        ) : createdStreams.length === 0 ? (
          <div className="neopay-empty">
            {t("noCreatedStreams") || "You haven't created any streams yet"}
          </div>
        ) : (
          <div className="neopay-stream-list">
            {createdStreams.map((stream) => {
              const pct = getStreamProgress(stream);
              const streamed = getStreamed(stream);
              return (
                <div key={stream.id} className="neopay-stream-item">
                  <div className="neopay-stream-info">
                    <div className="neopay-stream-header">
                      <span className="neopay-stream-id">#{stream.id}</span>
                      <span
                        className={`neopay-stream-status neopay-stream-status--${stream.status ?? "active"}`}
                      >
                        {stream.status ?? (t("active") || "Active")}
                      </span>
                    </div>
                    <div className="neopay-stream-details">
                      {stream.recipient && (
                        <span className="neopay-stream-detail">
                          {t("to") || "To"}:{" "}
                          {formatAddress(stream.recipient)}
                        </span>
                      )}
                      <span className="neopay-stream-detail">
                        {stream.amount ?? 0} {stream.token || token}
                      </span>
                      {stream.duration !== undefined && (
                        <span className="neopay-stream-detail">
                          {stream.duration}d
                        </span>
                      )}
                    </div>
                    <div className="neopay-stream-progress-wrap">
                      <div className="neopay-stream-progress">
                        <div
                          className="neopay-stream-progress-bar"
                          style={{
                            width: `${pct}%`,
                            background: getProgressColor(pct),
                          }}
                        />
                      </div>
                      <span className="neopay-stream-progress-label">
                        {streamed} / {stream.amount ?? 0}{" "}
                        {stream.token || token} ({pct.toFixed(0)}%)
                      </span>
                    </div>
                  </div>
                  <div className="neopay-stream-actions">
                    <NeoButton
                      variant="danger"
                      size="sm"
                      disabled={stream.status === "cancelled" || stream.status === "completed"}
                      onClick={() => handleCancel(stream.id)}
                    >
                      {t("cancel") || "Cancel"}
                    </NeoButton>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </NeoCard>

      {/* ==================== Streams You Receive ==================== */}
      <NeoCard
        variant="erobo"
        title={`${t("streamsYouReceive") || "Streams You Receive"} (${beneficiaryStreams.length})`}
      >
        {isLoading ? (
          <div className="neopay-loading">
            <div className="neopay-loading-spinner" />
            <span>{t("loading") || "Loading..."}</span>
          </div>
        ) : beneficiaryStreams.length === 0 ? (
          <div className="neopay-empty">
            {t("noBeneficiaryStreams") || "No incoming streams"}
          </div>
        ) : (
          <div className="neopay-stream-list">
            {beneficiaryStreams.map((stream) => {
              const pct = getStreamProgress(stream);
              const streamed = getStreamed(stream);
              const claimable =
                stream.remaining !== undefined && stream.amount !== undefined
                  ? stream.amount - (stream.remaining ?? 0)
                  : 0;
              return (
                <div key={stream.id} className="neopay-stream-item">
                  <div className="neopay-stream-info">
                    <div className="neopay-stream-header">
                      <span className="neopay-stream-id">#{stream.id}</span>
                      <span
                        className={`neopay-stream-status neopay-stream-status--${stream.status ?? "active"}`}
                      >
                        {stream.status ?? (t("active") || "Active")}
                      </span>
                    </div>
                    <div className="neopay-stream-details">
                      {stream.sender && (
                        <span className="neopay-stream-detail">
                          {t("from") || "From"}:{" "}
                          {formatAddress(stream.sender)}
                        </span>
                      )}
                      <span className="neopay-stream-detail">
                        {stream.amount ?? 0} {stream.token || "GAS"}
                      </span>
                      {stream.duration !== undefined && (
                        <span className="neopay-stream-detail">
                          {stream.duration}d
                        </span>
                      )}
                    </div>
                    <div className="neopay-stream-progress-wrap">
                      <div className="neopay-stream-progress">
                        <div
                          className="neopay-stream-progress-bar"
                          style={{
                            width: `${pct}%`,
                            background: getProgressColor(pct),
                          }}
                        />
                      </div>
                      <span className="neopay-stream-progress-label">
                        {streamed} / {stream.amount ?? 0}{" "}
                        {stream.token || "GAS"} ({pct.toFixed(0)}%)
                      </span>
                    </div>
                    {claimable > 0 && (
                      <div className="neopay-stream-claimable">
                        {t("claimable") || "Claimable"}:{" "}
                        <strong>
                          {claimable.toFixed(2)} {stream.token || "GAS"}
                        </strong>
                      </div>
                    )}
                  </div>
                  <div className="neopay-stream-actions">
                    <NeoButton
                      variant="success"
                      size="sm"
                      disabled={stream.status === "cancelled" || stream.status === "completed"}
                      onClick={() => handleClaim(stream.id)}
                    >
                      {t("claim") || "Claim"}
                    </NeoButton>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </NeoCard>
    </div>
  );
}
