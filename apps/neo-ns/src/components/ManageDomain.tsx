/**
 * ManageDomain.tsx -- Domain management panel for Neo NS.
 */

import { useState } from "react";
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

export default function ManageDomain({ t, domain, loading, dispatch }: ManageDomainProps) {
  const [targetAddress, setTargetAddress] = useState("");
  const [transferAddress, setTransferAddress] = useState("");

  const targetInvalid = isAddressFieldInvalid(targetAddress);
  const transferInvalid = isAddressFieldInvalid(transferAddress);

  return (
    <NeoCard variant="erobo">
      <div className="manage-panel">
        <div className="manage-header">
          <h3>{t("manageTitle")}: {domain.name}</h3>
          <NeoButton variant="secondary" onClick={() => dispatch("cancelManage")}>{t("cancelManage")}</NeoButton>
        </div>

        <div className="manage-info">
          <div className="info-row">
            <span className="info-label">{t("currentOwner")}</span>
            <span className="info-value">{domain.owner}</span>
          </div>
          <div className="info-row">
            <span className="info-label">{t("currentExpiry")}</span>
            <span className="info-value">{domain.expiry > 0 ? new Date(domain.expiry).toLocaleDateString() : "—"}</span>
          </div>
          <div className="info-row">
            <span className="info-label">{t("currentTarget")}</span>
            <span className="info-value">{domain.target ?? t("notSet")}</span>
          </div>
        </div>

        <div className="manage-action-group">
          <div className="manage-action">
            <NeoInput value={targetAddress} label={t("setTarget")} placeholder={t("targetAddress")} onChange={(v) => setTargetAddress(v)} />
            <NeoButton
              variant="primary"
              loading={loading}
              disabled={targetInvalid || targetAddress.trim().length === 0}
              onClick={() => dispatch("handleSetTarget", targetAddress)}
            >
              {t("setTarget")}
            </NeoButton>
          </div>
          {targetInvalid && <p className="field-error" role="alert">{t("invalidAddressHint")}</p>}
        </div>

        <div className="manage-action-group">
          <div className="manage-action">
            <NeoInput value={transferAddress} label={t("transferDomain")} placeholder={t("receiverAddress")} onChange={(v) => setTransferAddress(v)} />
            <NeoButton
              variant="primary"
              loading={loading}
              disabled={transferInvalid || transferAddress.trim().length === 0}
              onClick={() => dispatch("handleTransfer", transferAddress)}
            >
              {t("transferDomain")}
            </NeoButton>
          </div>
          {transferInvalid && <p className="field-error" role="alert">{t("invalidAddressHint")}</p>}
        </div>
      </div>
    </NeoCard>
  );
}
