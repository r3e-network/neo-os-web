/**
 * PlayArea.tsx -- Red Envelope
 *
 * Claim-first surface. Creating and diagnostics are secondary so a recipient
 * who arrives from OneGate QR sees the one job they came to do.
 */

import { useEffect, useMemo, useState } from "react";
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
  remainingPackets?: number;
  remaining?: number;
  active?: boolean;
  canOpen?: boolean;
  status?: string;
  creator?: string;
  from?: string;
  memo?: string;
  message?: string;
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

function getLaunchEnvelopeId(context: MiniAppLaunchContext): string {
  const params = context.params ?? {};
  return String(params.envelopeId || params.poolId || params.id || params.packet || "").trim();
}

export default function PlayArea({ t, state, dispatch, launchContext }: PlayAreaProps) {
  const { bool, val } = useStateBindings(state);
  const isLoading = bool("isLoading");
  const luckyMessage = val<{ amount?: number; from?: string } | null>("luckyMessage", null);
  const envelopes = (val("envelopes") ?? []) as Envelope[];
  const claims = (val("claims") ?? []) as Claim[];
  const launchedEnvelopeId = useMemo(() => getLaunchEnvelopeId(launchContext), [launchContext.signature]);
  const [selectedEnvelopeId, setSelectedEnvelopeId] = useState(launchedEnvelopeId);

  useEffect(() => {
    if (launchedEnvelopeId) setSelectedEnvelopeId(launchedEnvelopeId);
  }, [launchedEnvelopeId]);

  const activeEnvelopes = envelopes.filter((env) => {
    if (env.active === false) return false;
    if (env.canOpen === false) return false;
    return env.status === "active" || env.status === undefined || env.active === true;
  });
  const targetEnvelope = activeEnvelopes.find((env) => String(env.id) === selectedEnvelopeId);
  const recentClaims = claims.slice(0, 6);

  return (
    <div className="redenv-play-area">
      <section className="redenv-claim-card">
        <div className="redenv-claim-icon" aria-hidden="true" />
        <div className="redenv-claim-copy">
          <span className="redenv-kicker">Red Envelope</span>
          <h2>{t("claimRedEnvelope") || "Claim red envelope"}</h2>
          <p>
            {selectedEnvelopeId
              ? (t("claimReadyDesc") || "This envelope is ready. Confirm once to receive GAS.")
              : (t("claimNeedIdDesc") || "Scan a OneGate QR or enter an envelope ID to receive GAS.")}
          </p>
        </div>
        <div className="redenv-target-pill">
          <span>{selectedEnvelopeId ? `#${shortId(selectedEnvelopeId)}` : "No ID"}</span>
          <small>{selectedEnvelopeId ? "selected" : "scan QR"}</small>
        </div>
      </section>

      {targetEnvelope && (
        <div className="redenv-selected">
          <div>
            <span className="redenv-selected-label">Ready to claim</span>
            <strong>{targetEnvelope.remainingPackets ?? targetEnvelope.remaining ?? "?"} left</strong>
          </div>
          <span>{targetEnvelope.totalAmount ?? targetEnvelope.amount ?? "?"} GAS pool</span>
        </div>
      )}

      <details className="redenv-secondary" open={!selectedEnvelopeId}>
        <summary>{t("availableEnvelopes") || "Active envelopes"}</summary>
        {isLoading ? (
          <div className="redenv-empty">{t("loadingEnvelopes") || "Loading envelopes..."}</div>
        ) : activeEnvelopes.length === 0 ? (
          <div className="redenv-empty">{t("noEnvelopes") || "No envelopes available yet"}</div>
        ) : (
          <div className="redenv-list">
            {activeEnvelopes.slice(0, 8).map((env) => (
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
      </details>

      <details className="redenv-secondary">
        <summary>{t("recentActivity") || "Recent claims"}</summary>
        {recentClaims.length === 0 ? (
          <div className="redenv-empty">{t("noActivity") || "No recent activity"}</div>
        ) : (
          <div className="redenv-list">
            {recentClaims.map((claim) => (
              <div key={claim.id} className="redenv-row redenv-row--static">
                <span>{claim.holder || claim.claimer ? shortId(String(claim.holder || claim.claimer)) : "Wallet"}</span>
                <strong>{claim.amount ?? "?"} GAS</strong>
              </div>
            ))}
          </div>
        )}
      </details>

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
