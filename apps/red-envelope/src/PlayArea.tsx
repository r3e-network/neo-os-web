/**
 * PlayArea.tsx -- Red Envelope
 *
 * Claim-first surface. Creating and diagnostics are secondary so a recipient
 * who arrives from OneGate QR sees the one job they came to do.
 */

import { useEffect, useState } from "react";
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

interface Envelope {
  id: string;
  totalAmount?: number;
  amount?: number;
  packetCount?: number;
  count?: number;
  openedCount?: number;
  remainingAmount?: number;
  remainingPackets?: number;
  remaining?: number;
  active?: boolean;
  canOpen?: boolean;
  ready?: boolean;
  expired?: boolean;
  depleted?: boolean;
  reclaimable?: boolean;
  status?: string;
  creator?: string;
  from?: string;
  memo?: string;
  message?: string;
  bestLuckAddress?: string;
  bestLuckAmount?: number;
}

interface Claim {
  id: string;
  poolId?: string;
  envelopeId?: string;
  holder?: string;
  claimer?: string;
  amount?: number;
}

function shortId(value: string): string {
  return value.length > 18 ? `${value.slice(0, 10)}...${value.slice(-6)}` : value;
}

function formatGas(value: unknown): string {
  const numberValue = Number(value ?? 0);
  if (!Number.isFinite(numberValue)) return "0 GAS";
  return `${numberValue.toLocaleString(undefined, { maximumFractionDigits: 4 })} GAS`;
}

function getLaunchEnvelopeId(context: MiniAppLaunchContext): string {
  const params = context.params ?? {};
  return String(params.envelopeId || params.poolId || params.id || params.packet || "").trim();
}

function getLaunchCreateForm(context: MiniAppLaunchContext) {
  const params = context.params ?? {};
  return {
    amount: String(params.amount || "1"),
    count: String(params.count || params.packetCount || "8"),
    expiryHours: String(params.expiryHours || params.expiry || "24"),
  };
}

export default function PlayArea({ t, state, dispatch, launchContext }: PlayAreaProps) {
  const { bool, val } = useStateBindings(state);
  const isLoading = bool("isLoading");
  const luckyMessage = val<{ amount?: number; from?: string } | null>("luckyMessage", null);
  const openingId = val<string | null>("openingId", null);
  const envelopes = (val("envelopes") ?? []) as Envelope[];
  const claims = (val("claims") ?? []) as Claim[];
  const envelopeCount = val<number>("envelopeCount", envelopes.length) ?? envelopes.length;
  const claimCount = val<number>("claimCount", claims.length) ?? claims.length;
  const poolCount = val<number>("poolCount", 0) ?? 0;
  const totalCreated = val<number>("totalCreated", 0) ?? 0;
  const totalClaimed = val<number>("totalClaimed", 0) ?? 0;
  const prepaidCredit = val<number>("prepaidCredit", 0) ?? 0;
  const lastCreatedEnvelopeId = val<string>("lastCreatedEnvelopeId", "") ?? "";
  const launchedEnvelopeId = getLaunchEnvelopeId(launchContext);
  const launchedCreateForm = getLaunchCreateForm(launchContext);
  const [selectedEnvelopeId, setSelectedEnvelopeId] = useState(launchedEnvelopeId);
  const [activeTab, setActiveTab] = useState<"claim" | "create">("claim");
  const [createForm, setCreateForm] = useState({
    amount: "1",
    count: "8",
    expiryHours: "24",
  });

  useEffect(() => {
    if (launchedEnvelopeId) setSelectedEnvelopeId(launchedEnvelopeId);
  }, [launchedEnvelopeId]);

  useEffect(() => {
    setCreateForm(launchedCreateForm);
  }, [launchedCreateForm.amount, launchedCreateForm.count, launchedCreateForm.expiryHours]);

  const activeEnvelopes = envelopes.filter((env) => {
    if (env.active === false) return false;
    if (env.canOpen === false) return false;
    return env.status === "active" || env.status === undefined || env.active === true;
  });
  const targetEnvelope =
    activeEnvelopes.find((env) => String(env.id) === selectedEnvelopeId.trim()) ??
    envelopes.find((env) => String(env.id) === selectedEnvelopeId.trim());
  const recentClaims = claims.slice(0, 5);
  const claimableGas = activeEnvelopes.reduce(
    (sum, env) => sum + Number(env.remainingAmount ?? env.totalAmount ?? env.amount ?? 0),
    0,
  );
  const selectedOpened = Number(targetEnvelope?.openedCount ?? 0);
  const selectedTotal = Number(targetEnvelope?.packetCount ?? targetEnvelope?.count ?? 0);
  const completionRate = selectedTotal > 0
    ? Math.round((selectedOpened / selectedTotal) * 100)
    : 0;
  const selectedRemaining = Number(
    targetEnvelope?.remainingPackets ?? targetEnvelope?.remaining ?? Math.max(0, selectedTotal - selectedOpened),
  );
  const createAmount = Number(createForm.amount);
  const createCount = Number(createForm.count);
  const createExpiryHours = Number(createForm.expiryHours);
  const perPacketGas =
    Number.isFinite(createAmount) && Number.isFinite(createCount) && createCount > 0
      ? createAmount / createCount
      : 0;
  const canCreateEnvelope =
    Number.isFinite(createAmount) &&
    Number.isFinite(createCount) &&
    Number.isFinite(createExpiryHours) &&
    createAmount >= 0.1 &&
    createCount >= 1 &&
    createCount <= 100 &&
    perPacketGas >= 0.01 &&
    createExpiryHours > 0;

  // Inline validation feedback: surface WHY the send button is disabled so a
  // user is never stuck staring at a greyed-out control with no guidance.
  // Order mirrors the composable's create() guard checks so the message the
  // user sees matches the error that would otherwise be thrown on submit.
  const createValidationMessage = (() => {
    if (canCreateEnvelope) return "";
    if (!Number.isFinite(createAmount) || createAmount < 0.1) return t("invalidAmount");
    if (!Number.isFinite(createCount) || createCount < 1 || createCount > 100)
      return t("invalidPackets");
    if (perPacketGas < 0.01) return t("invalidPerPacket");
    if (!Number.isFinite(createExpiryHours) || createExpiryHours <= 0) return t("invalidExpiry");
    return "";
  })();

  const setCreateField = (key: keyof typeof createForm, value: string) => {
    setCreateForm((current) => ({ ...current, [key]: value }));
  };

  const claimSelectedEnvelope = () =>
    dispatch("claimEnvelope", {
      envelopeId: selectedEnvelopeId.trim(),
    });

  const createEnvelope = () => dispatch("createEnvelope", createForm);

  const hasActivity = activeEnvelopes.length > 0 || recentClaims.length > 0;
  const reclaimables = envelopes.filter((env) => env.reclaimable);
  const hasRecovery = reclaimables.length > 0 || prepaidCredit > 0;

  return (
    <div className="redenv-play-area">
      <div className="redenv-shell">
        <section className="redenv-main" aria-label={t("redEnvelopeHeroTitle")}>
          <div className="redenv-hero">
            <div className="redenv-hero-badge" aria-hidden="true">
              <svg viewBox="0 0 24 24" width="22" height="22" fill="none">
                <rect x="4" y="3" width="16" height="18" rx="3" fill="currentColor" opacity="0.16" />
                <rect x="4" y="3" width="16" height="18" rx="3" stroke="currentColor" strokeWidth="1.6" />
                <path d="M9 3l3 5 3-5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
                <circle cx="12" cy="13" r="2.6" fill="currentColor" />
              </svg>
            </div>
            <div className="redenv-hero-copy">
              <span>{t("shareReadyTitle")}</span>
              <h2>{t("redEnvelopeHeroTitle")}</h2>
              <p>{t("redEnvelopeHeroSubtitle")}</p>
            </div>
          </div>

          <div className="redenv-metrics" aria-label={t("claimablePool")}>
            <div>
              <span>{t("availableEnvelopes")}</span>
              <strong>{activeEnvelopes.length}</strong>
            </div>
            <div>
              <span>{t("claimablePool")}</span>
              <strong>{formatGas(claimableGas)}</strong>
            </div>
            <div>
              <span>{t("recentClaimsTitle")}</span>
              <strong>{claimCount}</strong>
            </div>
          </div>

          <NeoCard variant="erobo" className="redenv-action-panel">
            <div className="redenv-tabs" role="tablist" aria-label={t("claimFlowTitle")}>
              <button
                type="button"
                role="tab"
                aria-selected={activeTab === "claim"}
                className={`redenv-tab${activeTab === "claim" ? " redenv-tab--active" : ""}`}
                onClick={() => setActiveTab("claim")}
              >
                {t("claimTab")}
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={activeTab === "create"}
                className={`redenv-tab${activeTab === "create" ? " redenv-tab--active" : ""}`}
                onClick={() => setActiveTab("create")}
              >
                {t("createTab")}
              </button>
            </div>

            {activeTab === "claim" ? (
              <div className="redenv-claim-body">
                {targetEnvelope && (
                  <div className="redenv-selected-card">
                    <div>
                      <span>{t("envelopeId")}</span>
                      <strong>{`#${shortId(selectedEnvelopeId)}`}</strong>
                    </div>
                    <div>
                      <span>{t("remainingPacketsLabel")}</span>
                      <strong>{`${selectedRemaining}/${selectedTotal || "?"}`}</strong>
                    </div>
                    <div>
                      <span>{t("poolProgress")}</span>
                      <strong>{completionRate}%</strong>
                    </div>
                  </div>
                )}
                <NeoInput
                  value={selectedEnvelopeId}
                  label={t("envelopeId")}
                  placeholder={t("enterPoolId")}
                  onChange={(value) => setSelectedEnvelopeId(value)}
                />
                <p className="redenv-helper">
                  {targetEnvelope
                    ? t("claimReadyDesc")
                    : selectedEnvelopeId
                    ? t("claimOperationDesc")
                    : t("claimNeedIdDesc")}
                </p>
                <NeoButton
                  variant="primary"
                  loading={Boolean(openingId)}
                  disabled={isLoading || !selectedEnvelopeId.trim()}
                  onClick={claimSelectedEnvelope}
                >
                  {t("claimNow")}
                </NeoButton>
              </div>
            ) : (
              <div className="redenv-create-body">
                <div className="redenv-create-grid">
                  <NeoInput
                    value={createForm.amount}
                    type="number"
                    min={0.1}
                    suffix="GAS"
                    label={t("totalGas")}
                    placeholder="1"
                    onChange={(value) => setCreateField("amount", value)}
                  />
                  <NeoInput
                    value={createForm.count}
                    type="number"
                    min={1}
                    max={100}
                    label={t("packetCount")}
                    placeholder="8"
                    onChange={(value) => setCreateField("count", value)}
                  />
                  <NeoInput
                    value={createForm.expiryHours}
                    type="number"
                    min={1}
                    suffix={t("hoursSuffix")}
                    label={t("expiryHours")}
                    placeholder="24"
                    onChange={(value) => setCreateField("expiryHours", value)}
                  />
                </div>
                <div className="redenv-create-summary" aria-label={t("createPreviewTitle")}>
                  <div>
                    <span>{t("perPacketLabel")}</span>
                    <strong>{formatGas(perPacketGas)}</strong>
                  </div>
                  <div>
                    <span>{t("expiryHours")}</span>
                    <strong>{Number.isFinite(createExpiryHours) ? `${createExpiryHours} ${t("hoursSuffix")}` : "--"}</strong>
                  </div>
                </div>
                {createValidationMessage ? (
                  <p className="redenv-helper redenv-helper--error" role="alert">
                    {createValidationMessage}
                  </p>
                ) : (
                  <p className="redenv-helper">{t("createReadyDesc")}</p>
                )}
                <NeoButton
                  variant="secondary"
                  loading={isLoading}
                  disabled={isLoading || !canCreateEnvelope}
                  onClick={createEnvelope}
                >
                  {t("sendRedEnvelope")}
                </NeoButton>

                {/* Post-create share affordance — the OneGate-QR distribution
                    journey the product is named for. The recipient opens the
                    copied deep link and the envelope id prefills their claim. */}
                {lastCreatedEnvelopeId && (
                  <div className="redenv-share-card" role="status">
                    <div className="redenv-share-copy">
                      <span className="redenv-share-title">{t("shareTitle")}</span>
                      <span className="redenv-share-hint">
                        {t("shareHint", { id: lastCreatedEnvelopeId })}
                      </span>
                    </div>
                    <div className="redenv-share-actions">
                      <NeoButton
                        variant="primary"
                        size="sm"
                        onClick={() =>
                          dispatch("shareEnvelope", { envelopeId: lastCreatedEnvelopeId })
                        }
                      >
                        {t("copyShareLink")}
                      </NeoButton>
                      <NeoButton
                        variant="secondary"
                        size="sm"
                        onClick={() => dispatch("dismissShare")}
                      >
                        {t("dismiss")}
                      </NeoButton>
                    </div>
                  </div>
                )}
              </div>
            )}
          </NeoCard>

          <NeoCard variant="erobo" className="redenv-activity-panel">
            <div className="redenv-section-heading">
              <span>{t("availablePools")}</span>
              <strong>{poolCount || recentClaims.length}</strong>
            </div>
            {!hasActivity ? (
              <div className="redenv-empty-line">{t("noPools")}</div>
            ) : (
              <div className="redenv-activity-grid">
                {activeEnvelopes.length > 0 && (
                  <div className="redenv-list">
                    {activeEnvelopes.slice(0, 6).map((env) => (
                      <button
                        key={env.id}
                        type="button"
                        className={`redenv-row${selectedEnvelopeId === String(env.id) ? " redenv-row--selected" : ""}`}
                        onClick={() => {
                          setSelectedEnvelopeId(String(env.id));
                          setActiveTab("claim");
                        }}
                      >
                        <span>#{shortId(String(env.id))}</span>
                        <strong>{env.remainingPackets ?? env.remaining ?? "?"}/{env.packetCount ?? env.count ?? "?"}</strong>
                      </button>
                    ))}
                  </div>
                )}
                {recentClaims.length > 0 && (
                  <div className="redenv-list">
                    {recentClaims.map((claim) => (
                      <div key={claim.id} className="redenv-row redenv-row--static">
                        {/* These are always the connected wallet's own claims;
                            label them by envelope id + a localized "You" instead
                            of a noisy raw script hash (and no English fallback). */}
                        <span>
                          {claim.poolId || claim.envelopeId
                            ? `#${claim.poolId ?? claim.envelopeId} · ${t("you")}`
                            : t("you")}
                        </span>
                        <strong>{formatGas(claim.amount)}</strong>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </NeoCard>

          {hasRecovery && (
            <NeoCard variant="erobo" className="redenv-recovery-panel">
              <div className="redenv-section-heading">
                <span>{t("reclaimableTitle")}</span>
                <strong>{reclaimables.length}</strong>
              </div>
              <div className="redenv-list">
                {reclaimables.slice(0, 6).map((env) => (
                  <div key={env.id} className="redenv-row redenv-row--static redenv-row--recovery">
                    <span>#{shortId(String(env.id))}</span>
                    <strong>{formatGas(env.remainingAmount)}</strong>
                    <NeoButton
                      variant="secondary"
                      size="sm"
                      disabled={isLoading}
                      onClick={() => dispatch("reclaimEnvelope", { envelopeId: String(env.id) })}
                    >
                      {t("reclaimEnvelope")}
                    </NeoButton>
                  </div>
                ))}
                {prepaidCredit > 0 && (
                  <div className="redenv-row redenv-row--static redenv-row--recovery">
                    <span>{t("prepaidCreditLabel")}</span>
                    <strong>{formatGas(prepaidCredit)}</strong>
                    <NeoButton
                      variant="secondary"
                      size="sm"
                      disabled={isLoading}
                      onClick={() => dispatch("withdrawCredit")}
                    >
                      {t("withdrawCredit")}
                    </NeoButton>
                  </div>
                )}
              </div>
            </NeoCard>
          )}

          <details className="redenv-details">
            <summary>
              <span className="redenv-summary-label">
                <span className="redenv-summary-badge" aria-hidden="true">
                  <svg viewBox="0 0 24 24" width="16" height="16" fill="none">
                    <path
                      d="M12 3l7 3v5c0 4.2-2.9 7.3-7 8.5C7.9 18.3 5 15.2 5 11V6l7-3z"
                      stroke="currentColor"
                      strokeWidth="1.6"
                      strokeLinejoin="round"
                    />
                    <path d="M9.2 11.7l1.9 1.9 3.7-3.9" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </span>
                {t("safetyPanelTitle")}
              </span>
              <span className="redenv-summary-value">
                <strong>{t("osGuarded")}</strong>
                <svg className="redenv-summary-chevron" viewBox="0 0 24 24" width="16" height="16" fill="none" aria-hidden="true">
                  <path d="M6 9l6 6 6-6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </span>
            </summary>
            <div className="redenv-details-body">
              <p>{t("safetyPanelCopy")}</p>
              <div className="redenv-signal-row">
                <span>{t("contractRoute")}</span>
                <strong>{t("claimContractRoute")}</strong>
              </div>
              <div className="redenv-signal-row">
                <span>{t("createdGasLabel")}</span>
                <strong>{formatGas(totalCreated)}</strong>
              </div>
              <div className="redenv-signal-row">
                <span>{t("claimedGasLabel")}</span>
                <strong>{formatGas(totalClaimed)}</strong>
              </div>
            </div>
          </details>
        </section>
      </div>

      {luckyMessage && (
        <div className="redenv-modal-backdrop">
          <div className="redenv-modal">
            <div className="redenv-modal-content">
              <div className="redenv-modal-icon" aria-hidden="true" />
              <h3 className="redenv-modal-title">{t("congratulations")}</h3>
              <p className="redenv-modal-message">
                {t("claimReceivedMessage", { amount: String(luckyMessage.amount ?? "?") })}
              </p>
              <button className="redenv-modal-button" type="button" onClick={() => dispatch("dismissOverlay")}>
                {t("confirm")}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
