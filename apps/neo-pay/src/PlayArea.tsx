/**
 * PlayArea.tsx -- Neo Pay
 *
 * Stream payment management interface with stats overview,
 * stream creation form, and active stream list with cancel/claim actions.
 */

import { useState } from "react";
import { NeoButton, NeoCard, NeoInput } from "@shared/components-react";
import { useStateBindings } from "@shared/react/hooks/useStateBindings";
import type { Observable } from "@shared/react/context";
import "./PlayArea.scss";

interface PlayAreaProps {
  t: (key: string, params?: Record<string, string | number>) => string;
  state: Record<string, Observable>;
  dispatch: (name: string, ...args: unknown[]) => Promise<void>;
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
}

export default function PlayArea({ t, state, dispatch }: PlayAreaProps) {
  const { bool, num, val } = useStateBindings(state);

  const isLoading = bool("isLoading");
  const isCreating = bool("isCreating");
  const activeCount = num("activeCount");
  const createdStreamCount = num("createdStreamCount");
  const beneficiaryStreamCount = num("beneficiaryStreamCount");
  const totalStreamCount = num("totalStreamCount");

  const createdStreams = (val("createdStreams") ?? []) as Stream[];
  const beneficiaryStreams = (val("beneficiaryStreams") ?? []) as Stream[];
  const allStreams = (val("allStreams") ?? []) as Stream[];

  // Local form state
  const [recipient, setRecipient] = useState("");
  const [amount, setAmount] = useState("");
  const [duration, setDuration] = useState("");

  const handleCreateStream = async () => {
    if (!recipient || !amount || !duration) return;
    await dispatch("createStream", { recipient, amount, duration });
    setRecipient("");
    setAmount("");
    setDuration("");
  };

  const handleCancel = async (id: string) => {
    await dispatch("cancelStream", id);
  };

  const handleClaim = async (id: string) => {
    await dispatch("claimStream", id);
  };

  const displayStreams = allStreams.length > 0 ? allStreams : [...createdStreams, ...beneficiaryStreams];

  return (
    <div className="neopay-play-area">
      {/* Stats Bar */}
      <div className="neopay-hero-stats">
        <div className="neopay-hero-stat">
          <span className="neopay-hero-stat-value">{totalStreamCount}</span>
          <span className="neopay-hero-stat-label">{t("totalStreams")}</span>
        </div>
        <div className="neopay-hero-stat">
          <span className="neopay-hero-stat-value">{activeCount}</span>
          <span className="neopay-hero-stat-label">{t("active")}</span>
        </div>
        <div className="neopay-hero-stat">
          <span className="neopay-hero-stat-value">{createdStreamCount}</span>
          <span className="neopay-hero-stat-label">{t("created")}</span>
        </div>
        <div className="neopay-hero-stat">
          <span className="neopay-hero-stat-value">{beneficiaryStreamCount}</span>
          <span className="neopay-hero-stat-label">{t("beneficiary")}</span>
        </div>
      </div>

      {/* Create Stream Form */}
      <NeoCard variant="erobo" title={t("createStream")}>
        <div className="neopay-form">
          <NeoInput
            label={t("recipient")}
            placeholder={t("recipientPlaceholder")}
            value={recipient}
            onChange={setRecipient}
          />
          <NeoInput
            label={t("amount")}
            placeholder="0.00"
            type="number"
            value={amount}
            suffix="NEO"
            onChange={setAmount}
          />
          <NeoInput
            label={t("duration")}
            placeholder={t("durationPlaceholder")}
            type="number"
            value={duration}
            suffix={t("days")}
            onChange={setDuration}
          />
          <NeoButton
            variant="primary"
            block
            loading={isCreating}
            disabled={!recipient || !amount || !duration || isCreating}
            onClick={handleCreateStream}
          >
            {t("createStream")}
          </NeoButton>
        </div>
      </NeoCard>

      {/* Stream List */}
      <NeoCard variant="erobo" title={t("streams")}>
        {isLoading ? (
          <div className="neopay-loading">{t("loading")}</div>
        ) : displayStreams.length === 0 ? (
          <div className="neopay-empty">{t("noStreams")}</div>
        ) : (
          <div className="neopay-stream-list">
            {displayStreams.map((stream) => (
              <div key={stream.id} className="neopay-stream-item">
                <div className="neopay-stream-info">
                  <div className="neopay-stream-header">
                    <span className="neopay-stream-id">#{stream.id}</span>
                    <span className={`neopay-stream-status neopay-stream-status--${stream.status ?? "active"}`}>
                      {stream.status ?? t("active")}
                    </span>
                  </div>
                  <div className="neopay-stream-details">
                    {stream.recipient && (
                      <span className="neopay-stream-detail">
                        {t("to")}: {stream.recipient.slice(0, 8)}...{stream.recipient.slice(-6)}
                      </span>
                    )}
                    {stream.sender && (
                      <span className="neopay-stream-detail">
                        {t("from")}: {stream.sender.slice(0, 8)}...{stream.sender.slice(-6)}
                      </span>
                    )}
                    {stream.amount !== undefined && (
                      <span className="neopay-stream-detail">
                        {stream.amount} NEO
                      </span>
                    )}
                  </div>
                  {stream.amount !== undefined && stream.remaining !== undefined && (
                    <div className="neopay-stream-progress">
                      <div
                        className="neopay-stream-progress-bar"
                        style={{ width: `${stream.amount > 0 ? ((stream.amount - stream.remaining) / stream.amount) * 100 : 0}%` }}
                      />
                    </div>
                  )}
                </div>
                <div className="neopay-stream-actions">
                  <NeoButton
                    variant="danger"
                    size="sm"
                    onClick={() => handleCancel(stream.id)}
                  >
                    {t("cancel")}
                  </NeoButton>
                  <NeoButton
                    variant="success"
                    size="sm"
                    onClick={() => handleClaim(stream.id)}
                  >
                    {t("claim")}
                  </NeoButton>
                </div>
              </div>
            ))}
          </div>
        )}
      </NeoCard>
    </div>
  );
}
