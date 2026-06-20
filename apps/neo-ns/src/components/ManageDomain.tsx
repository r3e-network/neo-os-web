/**
 * ManageDomain.tsx -- Domain management panel for Neo NS.
 */

import { useState } from "react";
import { ArrowLeft, KeyRound, Send, Settings2 } from "lucide-react";
import { NeoButton, NeoInput, NeoCard } from "@shared/components-react";
import type { Domain } from "../hooks/useNeoNS";

/** Neo N3 address: base58check, leading 'N', 34 chars total. Mirrors useNeoNS NEO_ADDRESS_PATTERN. */
const NEO_ADDRESS_PATTERN = /^N[1-9A-HJ-NP-Za-km-z]{33}$/;

/** Empty is allowed (no error shown yet); a non-empty value must match the N3 pattern. */
function isAddressFieldInvalid(value: string): boolean {
  const trimmed = value.trim();
  return trimmed.length > 0 && !NEO_ADDRESS_PATTERN.test(trimmed);
}

interface ManageDomainProps {
  t: (key: string, params?: Record<string, string | number>) => string;
  domain: Domain;
  loading: boolean;
  dispatch: (name: string, ...args: unknown[]) => Promise<void>;
}

export default function ManageDomain({
  t,
  domain,
  loading,
  dispatch,
}: ManageDomainProps) {
  const [targetAddress, setTargetAddress] = useState("");
  const [transferAddress, setTransferAddress] = useState("");

  const targetInvalid = isAddressFieldInvalid(targetAddress);
  const transferInvalid = isAddressFieldInvalid(transferAddress);

  return (
    <NeoCard variant="erobo" className="nns-manage-card">
      <div className="manage-panel">
        <div className="manage-header">
          <div className="manage-heading">
            <span className="manage-heading__icon" aria-hidden="true">
              <Settings2 size={20} />
            </span>
            <div>
              <span>{t("manageTitle")}</span>
              <h3>{domain.name}</h3>
            </div>
          </div>
          <NeoButton
            variant="secondary"
            onClick={() => dispatch("cancelManage")}
          >
            <ArrowLeft size={15} aria-hidden="true" />
            {t("cancelManage")}
          </NeoButton>
        </div>

        <div className="manage-info">
          <div className="info-row">
            <span className="info-label">{t("currentOwner")}</span>
            <span className="info-value">{domain.owner}</span>
          </div>
          <div className="info-row">
            <span className="info-label">{t("currentExpiry")}</span>
            <span className="info-value">
              {domain.expiry > 0
                ? new Date(domain.expiry).toLocaleDateString()
                : "—"}
            </span>
          </div>
          <div className="info-row">
            <span className="info-label">{t("currentTarget")}</span>
            <span className="info-value">{domain.target ?? t("notSet")}</span>
          </div>
        </div>

        <section className="manage-action-group">
          <div className="manage-action-intro">
            <span aria-hidden="true">
              <KeyRound size={18} />
            </span>
            <div>
              <strong>{t("setTarget")}</strong>
              <p>{t("targetActionCopy")}</p>
            </div>
          </div>
          <div className="manage-action">
            <NeoInput
              value={targetAddress}
              label={t("setTarget")}
              placeholder={t("targetAddress")}
              onChange={(v) => setTargetAddress(v)}
            />
            <NeoButton
              variant="primary"
              loading={loading}
              disabled={targetInvalid || targetAddress.trim().length === 0}
              onClick={() => dispatch("handleSetTarget", targetAddress)}
            >
              {t("setTarget")}
            </NeoButton>
          </div>
          {targetInvalid && (
            <p className="field-error" role="alert">
              {t("invalidAddressHint")}
            </p>
          )}
        </section>

        <section className="manage-action-group">
          <div className="manage-action-intro">
            <span aria-hidden="true">
              <Send size={18} />
            </span>
            <div>
              <strong>{t("transferDomain")}</strong>
              <p>{t("transferActionCopy")}</p>
            </div>
          </div>
          <div className="manage-action">
            <NeoInput
              value={transferAddress}
              label={t("transferDomain")}
              placeholder={t("receiverAddress")}
              onChange={(v) => setTransferAddress(v)}
            />
            <NeoButton
              variant="primary"
              loading={loading}
              disabled={transferInvalid || transferAddress.trim().length === 0}
              onClick={() => dispatch("handleTransfer", transferAddress)}
            >
              {t("transferDomain")}
            </NeoButton>
          </div>
          {transferInvalid && (
            <p className="field-error" role="alert">
              {t("invalidAddressHint")}
            </p>
          )}
        </section>
      </div>
    </NeoCard>
  );
}
