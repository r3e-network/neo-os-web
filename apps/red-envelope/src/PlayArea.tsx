/**
 * PlayArea.tsx -- Red Envelope
 *
 * Red envelope gift management with stats overview, creation form,
 * envelope grid with open/claim actions, lucky overlay modal,
 * and activity feed of recent claims.
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

interface Envelope {
  id: string;
  amount?: number;
  count?: number;
  remaining?: number;
  status?: string;
  creator?: string;
  memo?: string;
}

interface Claim {
  id: string;
  envelopeId?: string;
  claimer?: string;
  amount?: number;
  timestamp?: number;
}

interface Pool {
  id: string;
  total?: number;
  remaining?: number;
  status?: string;
}

export default function PlayArea({ t, state, dispatch }: PlayAreaProps) {
  const { str, bool, num, val } = useStateBindings(state);

  /* ---------- Bound state ---------- */
  const isLoading = bool("isLoading");
  const isCreating = bool("isCreating");
  const showOpeningModal = bool("showOpeningModal");
  const luckyMessage = str("luckyMessage");
  const createAmount = str("createAmount");
  const createCount = str("createCount");
  const createMemo = str("createMemo");

  const envelopeCount = num("envelopeCount");
  const claimCount = num("claimCount");
  const poolCount = num("poolCount");
  const totalCreated = num("totalCreated");
  const totalClaimed = num("totalClaimed");

  const envelopes = (val("envelopes") ?? []) as Envelope[];
  const claims = (val("claims") ?? []) as Claim[];
  const pools = (val("pools") ?? []) as Pool[];
  const openingEnvelope = val<Envelope>("openingEnvelope");

  /* ---------- Local form state ---------- */
  const [formAmount, setFormAmount] = useState("");
  const [formCount, setFormCount] = useState("");
  const [formMemo, setFormMemo] = useState("");

  /* ---------- Handlers ---------- */
  const handleCreate = async () => {
    if (!formAmount || !formCount) return;
    await dispatch("createEnvelope", {
      amount: formAmount,
      count: formCount,
      memo: formMemo,
    });
    setFormAmount("");
    setFormCount("");
    setFormMemo("");
  };

  const handleOpen = async (id: string) => {
    await dispatch("openEnvelope", id);
  };

  const handleClaim = async (id: string) => {
    await dispatch("claimEnvelope", id);
  };

  const handleDismissModal = async () => {
    await dispatch("dismissOpeningModal");
  };

  const handleDismissOverlay = async () => {
    await dispatch("dismissOverlay");
  };

  /* ---------- Derived ---------- */
  const activeEnvelopes = envelopes.filter(
    (e) => e.status === "active" || !e.status
  );
  const recentClaims = [...claims]
    .sort((a, b) => (b.timestamp ?? 0) - (a.timestamp ?? 0))
    .slice(0, 10);

  const formatAddress = (addr: string) =>
    addr.length > 14 ? `${addr.slice(0, 8)}...${addr.slice(-6)}` : addr;

  const formatTime = (ts?: number) => {
    if (!ts) return "";
    const d = new Date(ts);
    return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  };

  return (
    <div className="redenv-play-area">
      {/* ==================== Stats ==================== */}
      <div className="redenv-hero-stats">
        <div className="redenv-hero-stat">
          <span className="redenv-hero-stat-value">{envelopeCount}</span>
          <span className="redenv-hero-stat-label">
            {t("envelopesCreated") || "Envelopes Created"}
          </span>
        </div>
        <div className="redenv-hero-stat">
          <span className="redenv-hero-stat-value">{claimCount}</span>
          <span className="redenv-hero-stat-label">
            {t("claims") || "Claims"}
          </span>
        </div>
        <div className="redenv-hero-stat">
          <span className="redenv-hero-stat-value">
            {totalCreated > 0 ? totalCreated.toLocaleString() : "0"}
          </span>
          <span className="redenv-hero-stat-label">
            {t("totalGasCreated") || "Total GAS Created"}
          </span>
        </div>
        <div className="redenv-hero-stat">
          <span className="redenv-hero-stat-value">
            {totalClaimed > 0 ? totalClaimed.toLocaleString() : "0"}
          </span>
          <span className="redenv-hero-stat-label">
            {t("totalGasClaimed") || "Total GAS Claimed"}
          </span>
        </div>
      </div>

      {/* ==================== Create Envelope Form ==================== */}
      <NeoCard
        variant="erobo"
        title={t("createEnvelope") || "Create Envelope"}
      >
        <div className="redenv-form">
          <NeoInput
            label={t("amount") || "Amount"}
            placeholder="0.00"
            type="number"
            value={formAmount || createAmount}
            suffix="GAS"
            onChange={setFormAmount}
          />
          <NeoInput
            label={t("count") || "How Many Can Claim"}
            placeholder={t("countPlaceholder") || "Number of recipients"}
            type="number"
            value={formCount || createCount}
            min={1}
            onChange={setFormCount}
          />
          <NeoInput
            label={t("memo") || "Memo"}
            placeholder={t("memoPlaceholder") || "Add a lucky message..."}
            value={formMemo || createMemo}
            onChange={setFormMemo}
          />
          <NeoButton
            variant="primary"
            block
            loading={isCreating}
            disabled={!formAmount || !formCount || isCreating}
            onClick={handleCreate}
          >
            {t("createEnvelope") || "Create Envelope"}
          </NeoButton>
        </div>
      </NeoCard>

      {/* ==================== Available Envelopes Grid ==================== */}
      <NeoCard
        variant="erobo"
        title={`${t("availableEnvelopes") || "Available Envelopes"} (${activeEnvelopes.length})`}
      >
        {isLoading ? (
          <div className="redenv-loading">
            <div className="redenv-loading-spinner" />
            <span>{t("loading") || "Loading..."}</span>
          </div>
        ) : activeEnvelopes.length === 0 ? (
          <div className="redenv-empty">
            {t("noEnvelopes") || "No envelopes available"}
          </div>
        ) : (
          <div className="redenv-grid">
            {activeEnvelopes.map((env) => (
              <div
                key={env.id}
                className={`redenv-envelope redenv-envelope--${env.status ?? "active"}`}
              >
                <div className="redenv-envelope-icon" aria-hidden="true" />
                <div className="redenv-envelope-body">
                  <span className="redenv-envelope-amount">
                    {env.amount ?? "?"} GAS
                  </span>
                  {env.remaining !== undefined && env.count !== undefined && (
                    <span className="redenv-envelope-remaining">
                      {env.remaining}/{env.count}{" "}
                      {t("remaining") || "remaining"}
                    </span>
                  )}
                  {env.memo && (
                    <span className="redenv-envelope-memo">{env.memo}</span>
                  )}
                  <span
                    className={`redenv-envelope-status redenv-envelope-status--${env.status ?? "active"}`}
                  >
                    {env.status ?? (t("active") || "Active")}
                  </span>
                </div>
                <div className="redenv-envelope-actions">
                  <NeoButton
                    variant="warning"
                    size="sm"
                    onClick={() => handleOpen(env.id)}
                  >
                    {t("open") || "Open"}
                  </NeoButton>
                  <NeoButton
                    variant="success"
                    size="sm"
                    onClick={() => handleClaim(env.id)}
                  >
                    {t("claim") || "Claim"}
                  </NeoButton>
                </div>
              </div>
            ))}
          </div>
        )}
      </NeoCard>

      {/* ==================== Pool Summary ==================== */}
      {pools.length > 0 && (
        <NeoCard
          variant="erobo"
          title={`${t("pools") || "Pools"} (${poolCount})`}
        >
          <div className="redenv-pool-list">
            {pools.map((pool) => {
              const pct =
                pool.total && pool.total > 0
                  ? ((pool.remaining ?? 0) / pool.total) * 100
                  : 0;
              return (
                <div key={pool.id} className="redenv-pool-item">
                  <div className="redenv-pool-header">
                    <span className="redenv-pool-id">
                      {t("pool") || "Pool"} #{pool.id}
                    </span>
                    <span
                      className={`redenv-pool-status redenv-pool-status--${pool.status ?? "active"}`}
                    >
                      {pool.status ?? (t("active") || "Active")}
                    </span>
                  </div>
                  <div className="redenv-pool-bar-track">
                    <div
                      className="redenv-pool-bar-fill"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                  <div className="redenv-pool-amounts">
                    <span>
                      {pool.remaining ?? 0} / {pool.total ?? 0} GAS
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </NeoCard>
      )}

      {/* ==================== Activity Feed ==================== */}
      <NeoCard
        variant="erobo"
        title={t("recentActivity") || "Recent Activity"}
      >
        {recentClaims.length === 0 ? (
          <div className="redenv-empty">
            {t("noActivity") || "No recent activity"}
          </div>
        ) : (
          <div className="redenv-activity-feed">
            {recentClaims.map((claim) => (
              <div key={claim.id} className="redenv-activity-item">
                <div className="redenv-activity-dot" />
                <div className="redenv-activity-body">
                  <span className="redenv-activity-text">
                    {claim.claimer
                      ? formatAddress(claim.claimer)
                      : t("someone") || "Someone"}{" "}
                    {t("claimedAmount") || "claimed"}{" "}
                    <strong>{claim.amount ?? "?"} GAS</strong>
                  </span>
                  {claim.envelopeId && (
                    <span className="redenv-activity-envelope">
                      {t("fromEnvelope") || "from envelope"} #{claim.envelopeId}
                    </span>
                  )}
                </div>
                <span className="redenv-activity-time">
                  {formatTime(claim.timestamp)}
                </span>
              </div>
            ))}
          </div>
        )}
      </NeoCard>

      {/* ==================== Lucky Overlay Modal ==================== */}
      {showOpeningModal && (
        <div className="redenv-modal-backdrop" onClick={handleDismissOverlay}>
          <div
            className="redenv-modal"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="redenv-modal-glow" />
            <div className="redenv-modal-content">
              <div className="redenv-modal-icon" aria-hidden="true" />
              <h3 className="redenv-modal-title">
                {t("lucky") || "Lucky!"}
              </h3>
              {luckyMessage && (
                <p className="redenv-modal-message">{luckyMessage}</p>
              )}
              {openingEnvelope && (
                <div className="redenv-modal-details">
                  <div className="redenv-modal-amount">
                    {(openingEnvelope as Envelope).amount ?? "?"} GAS
                  </div>
                  {(openingEnvelope as Envelope).memo && (
                    <p className="redenv-modal-memo">
                      &ldquo;{(openingEnvelope as Envelope).memo}&rdquo;
                    </p>
                  )}
                </div>
              )}
              <NeoButton variant="primary" onClick={handleDismissModal}>
                {t("dismiss") || "Dismiss"}
              </NeoButton>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
