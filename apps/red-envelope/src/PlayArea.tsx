/**
 * PlayArea.tsx -- Red Envelope
 *
 * Claim-first surface. Creating and diagnostics are secondary so a recipient
 * who arrives from OneGate QR sees the one job they came to do.
 */

import { useEffect, useMemo, useState } from "react";
import { NeoButton, NeoCard, NeoInput } from "@shared/components-react";
import { useStateBindings } from "@shared/react/hooks/useStateBindings";
import type { Observable } from "@shared/react/context";
import type { MiniAppLaunchContext } from "@shared/utils/launch-params";
import {
  ChevronDown,
  Coins,
  Gift,
  PackageOpen,
  Send,
  ShieldCheck,
  Sparkles,
  WalletCards,
} from "lucide-react";
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

const AMOUNT_PRESETS = ["0.5", "1", "3"];
const PACKET_PRESETS = ["4", "8", "16"];
const EXPIRY_PRESETS = ["12", "24", "72"];

export default function PlayArea({ t, state, dispatch, launchContext }: PlayAreaProps) {
  const { bool, val } = useStateBindings(state);
  const isLoading = bool("isLoading");
  const luckyMessage = val<{ amount?: number; from?: string } | null>("luckyMessage", null);
  const openingId = val<string | null>("openingId", null);
  const envelopes = (val("envelopes") ?? []) as Envelope[];
  const claims = (val("claims") ?? []) as Claim[];
  const claimCount = val<number>("claimCount", claims.length) ?? claims.length;
  const poolCount = val<number>("poolCount", 0) ?? 0;
  const totalCreated = val<number>("totalCreated", 0) ?? 0;
  const totalClaimed = val<number>("totalClaimed", 0) ?? 0;
  const prepaidCredit = val<number>("prepaidCredit", 0) ?? 0;
  const lastCreatedEnvelopeId = val<string>("lastCreatedEnvelopeId", "") ?? "";
  const launchedEnvelopeId = getLaunchEnvelopeId(launchContext);
  const launchedCreateForm = useMemo(
    () => getLaunchCreateForm(launchContext),
    [launchContext],
  );
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
  }, [launchedCreateForm]);

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
  const hasHeroStats = activeEnvelopes.length > 0 || claimCount > 0 || claimableGas > 0;
  const reclaimables = envelopes.filter((env) => env.reclaimable);
  const hasRecovery = reclaimables.length > 0 || prepaidCredit > 0;
  const trimmedEnvelopeId = selectedEnvelopeId.trim();
  const heroCardTitle = hasHeroStats
    ? t("claimablePool")
    : targetEnvelope
      ? t("readyToClaim")
      : t("claimTab");
  const heroCardValue = hasHeroStats
    ? formatGas(claimableGas)
    : targetEnvelope
      ? `#${shortId(String(targetEnvelope.id))}`
      : trimmedEnvelopeId
        ? `#${shortId(trimmedEnvelopeId)}`
        : t("needsEnvelopeId");
  const heroCardHint = hasHeroStats
    ? `${t("availableEnvelopes")}: ${activeEnvelopes.length}`
    : trimmedEnvelopeId
      ? t("claimOperationDesc")
      : t("claimNeedIdDesc");
  const previewAmount =
    activeTab === "create"
      ? Number.isFinite(createAmount)
        ? formatGas(createAmount)
        : formatGas(0)
      : targetEnvelope
        ? formatGas(targetEnvelope.remainingAmount ?? targetEnvelope.totalAmount ?? targetEnvelope.amount)
        : formatGas(claimableGas);
  const previewPacketLabel =
    activeTab === "create"
      ? `${Number.isFinite(createCount) ? createCount : 0} ${t("packetCount")}`
      : targetEnvelope
        ? `${selectedRemaining}/${selectedTotal || "?"} ${t("remainingPacketsLabel")}`
        : trimmedEnvelopeId
          ? t("ready")
          : t("needsEnvelopeId");
  const previewTitle =
    activeTab === "create"
      ? t("createPreviewTitle")
      : targetEnvelope
        ? t("readyToClaim")
        : trimmedEnvelopeId
          ? t("readyToClaim")
          : t("needsEnvelopeId");
  const createStatusTitle = canCreateEnvelope
    ? t("readyToSendEnvelope")
    : t("adjustEnvelopeSetup");
  const claimTicketTitle = targetEnvelope
    ? t("claimTicketReady")
    : trimmedEnvelopeId
      ? t("claimTicketPrepared")
      : t("claimTicketEmpty");
  const claimTicketValue = targetEnvelope
    ? formatGas(targetEnvelope.remainingAmount ?? targetEnvelope.totalAmount ?? targetEnvelope.amount)
    : trimmedEnvelopeId
      ? `#${shortId(trimmedEnvelopeId)}`
      : t("scanOrPasteEnvelope");

  return (
    <div className="redenv-play-area">
      <div className="redenv-shell">
        <section className="redenv-main" aria-label={t("redEnvelopeHeroTitle")}>
          <div className="redenv-hero">
            <img
              className="redenv-hero__image"
              src="./red-envelope-stage.jpg"
              alt=""
              aria-hidden="true"
            />
            <div className="redenv-hero__shade" aria-hidden="true" />
            <div className="redenv-hero-badge" aria-hidden="true">
              <Gift size={24} />
            </div>
            <div className="redenv-hero-copy">
              <span>{t("shareReadyTitle")}</span>
              <h2>{t("redEnvelopeHeroTitle")}</h2>
              <p>{t("redEnvelopeHeroSubtitle")}</p>
              <div className="redenv-hero-flow" aria-label={t("claimFlowTitle")}>
                <span>
                  <PackageOpen size={14} />
                  {t("claimRouteOne")}
                </span>
                <span>
                  <ShieldCheck size={14} />
                  {t("claimRouteTwo")}
                </span>
                <span>
                  <Coins size={14} />
                  {t("claimRouteThree")}
                </span>
              </div>
            </div>
            <div className="redenv-hero-card" aria-label={heroCardTitle}>
              <span>{heroCardTitle}</span>
              <strong>{heroCardValue}</strong>
              <small>{heroCardHint}</small>
            </div>
          </div>

          {hasHeroStats && (
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
          )}

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

            <section className="redenv-envelope-preview" aria-label={t("createPreviewTitle")}>
              <div className="redenv-envelope-preview__art" aria-hidden="true">
                <img src="./red-envelope-claim-card.jpg" alt="" />
              </div>
              <div className="redenv-envelope-preview__copy">
                <span>{activeTab === "claim" ? t("claimTab") : t("createTab")}</span>
                <strong>{previewTitle}</strong>
                <div>
                  <small>
                    <Coins size={13} />
                    {previewAmount}
                  </small>
                  <small>
                    <Sparkles size={13} />
                    {previewPacketLabel}
                  </small>
                </div>
              </div>
            </section>

            {activeTab === "claim" ? (
              <div className="redenv-claim-body">
                <section className="redenv-claim-ticket" aria-label={t("claimTicketTitle")}>
                  <div className="redenv-ticket-stamp" aria-hidden="true">
                    <PackageOpen size={18} />
                  </div>
                  <div className="redenv-ticket-copy">
                    <span>{claimTicketTitle}</span>
                    <strong>{claimTicketValue}</strong>
                    <small>
                      {targetEnvelope
                        ? t("claimTicketReadyDesc")
                        : trimmedEnvelopeId
                          ? t("claimTicketPreparedDesc")
                          : t("claimTicketEmptyDesc")}
                    </small>
                  </div>
                  <div className="redenv-ticket-route" aria-label={t("claimFlowTitle")}>
                    <span>{t("claimRouteOne")}</span>
                    <span>{t("claimRouteTwo")}</span>
                    <span>{t("claimRouteThree")}</span>
                  </div>
                </section>
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
                  <PackageOpen size={16} />
                  {t("claimNow")}
                </NeoButton>
              </div>
            ) : (
              <div className="redenv-create-body">
                <section className="redenv-gift-builder" aria-label={t("giftBuilderTitle")}>
                  <div className="redenv-gift-builder__head">
                    <span>{t("giftBuilderTitle")}</span>
                    <strong>{createStatusTitle}</strong>
                  </div>
                  <div className="redenv-preset-board">
                    <div className="redenv-preset-group">
                      <span>{t("totalGas")}</span>
                      <div>
                        {AMOUNT_PRESETS.map((amount) => (
                          <button
                            key={amount}
                            type="button"
                            className={createForm.amount === amount ? "is-selected" : ""}
                            onClick={() => setCreateField("amount", amount)}
                          >
                            {formatGas(amount)}
                          </button>
                        ))}
                      </div>
                    </div>
                    <div className="redenv-preset-group">
                      <span>{t("packetCount")}</span>
                      <div>
                        {PACKET_PRESETS.map((count) => (
                          <button
                            key={count}
                            type="button"
                            className={createForm.count === count ? "is-selected" : ""}
                            onClick={() => setCreateField("count", count)}
                          >
                            {t("packetPreset", { count })}
                          </button>
                        ))}
                      </div>
                    </div>
                    <div className="redenv-preset-group">
                      <span>{t("expiryHours")}</span>
                      <div>
                        {EXPIRY_PRESETS.map((hours) => (
                          <button
                            key={hours}
                            type="button"
                            className={createForm.expiryHours === hours ? "is-selected" : ""}
                            onClick={() => setCreateField("expiryHours", hours)}
                          >
                            {t("hourPreset", { hours })}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                </section>
                <div
                  className="redenv-create-grid redenv-envelope-dials"
                  aria-label={t("createPreviewTitle")}
                >
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
                    <em className="redenv-per-packet-note">{t("perPacketRandomNote")}</em>
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
                  variant="primary"
                  loading={isLoading}
                  disabled={isLoading || !canCreateEnvelope}
                  onClick={createEnvelope}
                >
                  <Send size={16} />
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
                        <WalletCards size={15} />
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

          {hasActivity && (
            <NeoCard variant="erobo" className="redenv-activity-panel">
              <div className="redenv-section-heading">
                <span>{t("availablePools")}</span>
                <strong>{poolCount || recentClaims.length}</strong>
              </div>
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
            </NeoCard>
          )}

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
                  <ShieldCheck size={16} />
                </span>
                {t("safetyPanelTitle")}
              </span>
              <span className="redenv-summary-value">
                <strong>{t("osGuarded")}</strong>
                <ChevronDown className="redenv-summary-chevron" size={16} aria-hidden="true" />
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
              <div className="redenv-modal-icon" aria-hidden="true">
                <img src="./red-envelope-claim-card.jpg" alt="" />
                <Sparkles size={22} />
              </div>
              <h3 className="redenv-modal-title">{t("congratulations")}</h3>
              <p className="redenv-modal-caption">{t("luckyReceivedLabel")}</p>
              <p className="redenv-modal-amount">{formatGas(luckyMessage.amount)}</p>
              <button className="redenv-modal-button" type="button" onClick={() => dispatch("dismissOverlay")}>
                {t("luckyReceivedClose")}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
