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
  const launchedEnvelopeId = getLaunchEnvelopeId(launchContext);
  const [selectedEnvelopeId, setSelectedEnvelopeId] = useState(launchedEnvelopeId);
  const [createForm, setCreateForm] = useState({
    amount: "1",
    count: "8",
    expiryHours: "24",
  });

  useEffect(() => {
    if (launchedEnvelopeId) setSelectedEnvelopeId(launchedEnvelopeId);
  }, [launchedEnvelopeId]);

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
  const canCreateEnvelope =
    Number(createForm.amount) >= 0.1 &&
    Number(createForm.count) >= 1 &&
    Number(createForm.count) <= 100 &&
    Number(createForm.expiryHours) > 0;

  const setCreateField = (key: keyof typeof createForm, value: string) => {
    setCreateForm((current) => ({ ...current, [key]: value }));
  };

  const claimSelectedEnvelope = () =>
    dispatch("claimEnvelope", {
      envelopeId: selectedEnvelopeId.trim(),
    });

  const createEnvelope = () => dispatch("createEnvelope", createForm);

  return (
    <div className="redenv-play-area">
      <div className="redenv-shell">
        <section className="redenv-main" aria-label={t("redEnvelopeHeroTitle")}>
          <div className="redenv-hero">
            <div className="redenv-hero-copy">
              <span>{t("shareReadyTitle")}</span>
              <h2>{t("redEnvelopeHeroTitle")}</h2>
              <p>{t("redEnvelopeHeroSubtitle")}</p>
            </div>
            <div className="redenv-hero-stats">
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
          </div>

          <div className="redenv-flow-strip" aria-label={t("claimFlowTitle")}>
            <div>
              <span>01</span>
              <strong>{t("claimRouteOne")}</strong>
              <p>{t("claimRouteOneCopy")}</p>
            </div>
            <div>
              <span>02</span>
              <strong>{t("claimRouteTwo")}</strong>
              <p>{t("claimRouteTwoCopy")}</p>
            </div>
            <div>
              <span>03</span>
              <strong>{t("claimRouteThree")}</strong>
              <p>{t("claimRouteThreeCopy")}</p>
            </div>
          </div>

          <div className="redenv-workspace">
            <NeoCard variant="erobo" className="redenv-claim-panel">
              <div className="redenv-section-heading">
                <span>{t("claimPanelTitle")}</span>
                <strong>
                  {targetEnvelope ? t("ready") : t("walletNotConnected")}
                </strong>
              </div>
              <div className="redenv-selected-card">
                <div>
                  <span>{t("envelopeId")}</span>
                  <strong>{selectedEnvelopeId ? `#${shortId(selectedEnvelopeId)}` : t("enterPoolId")}</strong>
                </div>
                <div>
                  <span>{t("remainingPacketsLabel")}</span>
                  <strong>{targetEnvelope ? `${selectedRemaining}/${selectedTotal || "?"}` : "--"}</strong>
                </div>
                <div>
                  <span>{t("poolProgress")}</span>
                  <strong>{completionRate}%</strong>
                </div>
              </div>
              <NeoInput
                value={selectedEnvelopeId}
                label={t("envelopeId")}
                placeholder={t("enterPoolId")}
                onChange={(value) => setSelectedEnvelopeId(value)}
              />
              <NeoButton
                variant="primary"
                loading={Boolean(openingId)}
                disabled={isLoading || !selectedEnvelopeId.trim()}
                onClick={claimSelectedEnvelope}
              >
                {t("claimNow")}
              </NeoButton>
            </NeoCard>

            <NeoCard variant="erobo" className="redenv-create-panel">
              <div className="redenv-section-heading">
                <span>{t("createPanelTitle")}</span>
                <strong>{t("creatorMode")}</strong>
              </div>
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
              <NeoButton
                variant="secondary"
                loading={isLoading}
                disabled={isLoading || !canCreateEnvelope}
                onClick={createEnvelope}
              >
                {t("sendRedEnvelope")}
              </NeoButton>
            </NeoCard>
          </div>
        </section>

        <aside className="redenv-side" aria-label={t("safetyPanelTitle")}>
          <NeoCard variant="erobo" className="redenv-safety-panel">
            <div className="redenv-section-heading">
              <span>{t("safetyPanelTitle")}</span>
              <strong>{t("osGuarded")}</strong>
            </div>
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
          </NeoCard>

          <NeoCard variant="erobo" className="redenv-envelope-list">
            <div className="redenv-section-heading">
              <span>{t("availableEnvelopes")}</span>
              <strong>{poolCount}</strong>
            </div>
            {activeEnvelopes.length === 0 ? (
              <div className="redenv-empty-state">
                <strong>{t("noPools")}</strong>
                <p>{t("noPoolsCopy")}</p>
              </div>
            ) : (
              <div className="redenv-list">
                {activeEnvelopes.slice(0, 6).map((env) => (
                  <button
                    key={env.id}
                    type="button"
                    className={`redenv-row${selectedEnvelopeId === String(env.id) ? " redenv-row--selected" : ""}`}
                    onClick={() => setSelectedEnvelopeId(String(env.id))}
                  >
                    <span>#{shortId(String(env.id))}</span>
                    <strong>{env.remainingPackets ?? env.remaining ?? "?"}/{env.packetCount ?? env.count ?? "?"}</strong>
                  </button>
                ))}
              </div>
            )}
          </NeoCard>

          <NeoCard variant="erobo" className="redenv-activity-panel">
            <div className="redenv-section-heading">
              <span>{t("recentClaimsTitle")}</span>
              <strong>{recentClaims.length}</strong>
            </div>
            {recentClaims.length === 0 ? (
              <div className="redenv-empty-state">
                <strong>{t("noActivity")}</strong>
                <p>{t("noActivityCopy")}</p>
              </div>
            ) : (
              <div className="redenv-list">
                {recentClaims.map((claim) => (
                  <div key={claim.id} className="redenv-row redenv-row--static">
                    <span>{claim.holder || claim.claimer ? shortId(String(claim.holder || claim.claimer)) : "Wallet"}</span>
                    <strong>{formatGas(claim.amount)}</strong>
                  </div>
                ))}
              </div>
            )}
          </NeoCard>
        </aside>
      </div>

      {luckyMessage && (
        <div className="redenv-modal-backdrop">
          <div className="redenv-modal">
            <div className="redenv-modal-content">
              <div className="redenv-modal-icon" aria-hidden="true" />
              <h3 className="redenv-modal-title">{t("congratulations") || "Congratulations"}</h3>
              <p className="redenv-modal-message">
                {(t("claimReceivedMessage") || "You received {amount} GAS").replace("{amount}", String(luckyMessage.amount ?? "?"))}
              </p>
              <button className="redenv-modal-button" type="button" onClick={() => dispatch("dismissOverlay")}>
                {t("confirm") || "OK"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
