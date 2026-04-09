/**
 * ManageDomain.tsx -- Domain management panel for Neo NS.
 */

import { useState } from "react";
import { NeoButton, NeoInput, NeoCard } from "@shared/components-react";
import type { Domain } from "../hooks/useNeoNS";

interface ManageDomainProps {
  t: (key: string, params?: Record<string, string | number>) => string;
  domain: Domain;
  loading: boolean;
  dispatch: (name: string, ...args: unknown[]) => Promise<void>;
}

export default function ManageDomain({ t, domain, loading, dispatch }: ManageDomainProps) {
  const [targetAddress, setTargetAddress] = useState("");
  const [transferAddress, setTransferAddress] = useState("");

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
            <span className="info-value">{domain.expiry > 0 ? new Date(domain.expiry).toLocaleDateString() : "--"}</span>
          </div>
        </div>

        <div className="manage-action">
          <NeoInput value={targetAddress} label={t("setTarget")} placeholder={t("targetAddress")} onChange={(v) => setTargetAddress(v)} />
          <NeoButton variant="primary" loading={loading} onClick={() => dispatch("handleSetTarget", targetAddress)}>{t("setTarget")}</NeoButton>
        </div>

        <div className="manage-action">
          <NeoInput value={transferAddress} label={t("transferDomain")} placeholder={t("receiverAddress")} onChange={(v) => setTransferAddress(v)} />
          <NeoButton variant="primary" loading={loading} onClick={() => dispatch("handleTransfer", transferAddress)}>{t("transferDomain")}</NeoButton>
        </div>
      </div>
    </NeoCard>
  );
}
