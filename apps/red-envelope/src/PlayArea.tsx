/**
 * PlayArea.tsx -- Red Envelope
 *
 * Red envelope gift management with stats overview, creation form,
 * envelope grid with open/claim actions, and lucky overlay modal.
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
}

export default function PlayArea({ t, state, dispatch }: PlayAreaProps) {
  const { str, bool, num, val } = useStateBindings(state);

  const isLoading = bool("isLoading");
  const isCreating = bool("isCreating");
  const showOpeningModal = bool("showOpeningModal");
  const luckyMessage = str("luckyMessage");
  const envelopeCount = num("envelopeCount");
  const claimCount = num("claimCount");
  const poolCount = num("poolCount");
  const totalCreated = num("totalCreated");
  const totalClaimed = num("totalClaimed");

  const envelopes = (val("envelopes") ?? []) as Envelope[];
  const openingEnvelope = val<Envelope>("openingEnvelope");

  // Local form state
  const [formAmount, setFormAmount] = useState("");
  const [formCount, setFormCount] = useState("");

  const handleCreate = async () => {
    if (!formAmount || !formCount) return;
    await dispatch("createEnvelope", { amount: formAmount, count: formCount });
    setFormAmount("");
    setFormCount("");
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

  return (
    <div className="redenv-play-area">
      {/* Stats */}
      <div className="redenv-hero-stats">
        <div className="redenv-hero-stat">
          <span className="redenv-hero-stat-value">{envelopeCount}</span>
          <span className="redenv-hero-stat-label">{t("envelopes")}</span>
        </div>
        <div className="redenv-hero-stat">
          <span className="redenv-hero-stat-value">{claimCount}</span>
          <span className="redenv-hero-stat-label">{t("claims")}</span>
        </div>
        <div className="redenv-hero-stat">
          <span className="redenv-hero-stat-value">{poolCount}</span>
          <span className="redenv-hero-stat-label">{t("pools")}</span>
        </div>
        <div className="redenv-hero-stat redenv-hero-stat--wide">
          <div className="redenv-hero-stat-pair">
            <div>
              <span className="redenv-hero-stat-value">{totalCreated}</span>
              <span className="redenv-hero-stat-label">{t("totalCreated")}</span>
            </div>
            <div className="redenv-hero-stat-divider" />
            <div>
              <span className="redenv-hero-stat-value">{totalClaimed}</span>
              <span className="redenv-hero-stat-label">{t("totalClaimed")}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Create Envelope */}
      <NeoCard variant="erobo" title={t("createEnvelope")}>
        <div className="redenv-form">
          <NeoInput
            label={t("amount")}
            placeholder="0.00"
            type="number"
            value={formAmount}
            suffix="NEO"
            onChange={setFormAmount}
          />
          <NeoInput
            label={t("count")}
            placeholder={t("countPlaceholder")}
            type="number"
            value={formCount}
            min={1}
            onChange={setFormCount}
          />
          <NeoButton
            variant="primary"
            block
            loading={isCreating}
            disabled={!formAmount || !formCount || isCreating}
            onClick={handleCreate}
          >
            {t("createEnvelope")}
          </NeoButton>
        </div>
      </NeoCard>

      {/* Envelope Grid */}
      <NeoCard variant="erobo" title={t("envelopes")}>
        {isLoading ? (
          <div className="redenv-loading">{t("loading")}</div>
        ) : envelopes.length === 0 ? (
          <div className="redenv-empty">{t("noEnvelopes")}</div>
        ) : (
          <div className="redenv-grid">
            {envelopes.map((env) => (
              <div key={env.id} className={`redenv-envelope redenv-envelope--${env.status ?? "active"}`}>
                <div className="redenv-envelope-icon" aria-hidden="true" />
                <div className="redenv-envelope-body">
                  <span className="redenv-envelope-amount">
                    {env.amount ?? "?"} NEO
                  </span>
                  {env.remaining !== undefined && env.count !== undefined && (
                    <span className="redenv-envelope-remaining">
                      {env.remaining}/{env.count} {t("remaining")}
                    </span>
                  )}
                  <span className={`redenv-envelope-status redenv-envelope-status--${env.status ?? "active"}`}>
                    {env.status ?? t("active")}
                  </span>
                </div>
                <div className="redenv-envelope-actions">
                  <NeoButton
                    variant="warning"
                    size="sm"
                    onClick={() => handleOpen(env.id)}
                  >
                    {t("open")}
                  </NeoButton>
                  <NeoButton
                    variant="success"
                    size="sm"
                    onClick={() => handleClaim(env.id)}
                  >
                    {t("claim")}
                  </NeoButton>
                </div>
              </div>
            ))}
          </div>
        )}
      </NeoCard>

      {/* Lucky Overlay Modal */}
      {showOpeningModal && (
        <div className="redenv-modal-backdrop" onClick={handleDismissModal}>
          <div className="redenv-modal" onClick={(e) => e.stopPropagation()}>
            <div className="redenv-modal-glow" />
            <div className="redenv-modal-content">
              <div className="redenv-modal-icon" aria-hidden="true" />
              <h3 className="redenv-modal-title">{t("lucky")}</h3>
              {luckyMessage && (
                <p className="redenv-modal-message">{luckyMessage}</p>
              )}
              {openingEnvelope && (
                <div className="redenv-modal-amount">
                  {(openingEnvelope as Envelope).amount ?? "?"} NEO
                </div>
              )}
              <NeoButton variant="primary" onClick={handleDismissModal}>
                {t("dismiss")}
              </NeoButton>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
