/**
 * PlayArea.tsx — React version of Recovery Guardian PlayArea.
 */

import { NeoButton, NeoInput } from "@shared/components-react";
import { useStateBindings } from "@shared/react/hooks/useStateBindings";
import type { Observable } from "@shared/react/context";
import "./PlayArea.scss";

interface PlayAreaProps {
  t: (key: string, params?: Record<string, string | number>) => string;
  state: Record<string, Observable>;
  dispatch: (name: string, ...args: unknown[]) => Promise<void>;
}

export default function PlayArea({ t, state, dispatch }: PlayAreaProps) {
  const { str, bool } = useStateBindings(state);

  const hasPayload = bool("hasPayload");
  const renderedPayload = str("renderedPayload", t("notAvailable"));
  const previewUrl = str("previewUrl");
  const credentialUrl = str("credentialUrl");
  const accountAddress = str("accountAddress");
  const verifierHashOverride = str("verifierHashOverride");
  const recoveryNewOwner = str("recoveryNewOwner");
  const recoveryExpiryMinutes = str("recoveryExpiryMinutes", "30");
  const recoveryTemplateId = str("recoveryTemplateId");
  const isQuerying = bool("isQuerying");

  const handleAction = (name: string) => dispatch(name);
  const setField = (field: string, value: string) => {
    dispatch("setField", field, value);
  };

  return (
    <div className="guardian-play-area">
      {/* Result Section */}
      <div className="result-section">
        {hasPayload && (
          <div className="note-box">
            <p className="note-title">{t("noteTitle")}</p>
            <p className="note-text">{t("noteText")}</p>
            {previewUrl && (
              <div className="link-box">
                <p className="link-label">{t("openRecoveryPreview")}</p>
                <p className="link-value">{previewUrl}</p>
                <div className="link-actions">
                  <NeoButton variant="secondary" size="sm" onClick={() => handleAction("copyRecoveryPreviewLink")} aria-label={t("copyRecoveryLink")}>{t("copyRecoveryLink")}</NeoButton>
                  <NeoButton variant="secondary" size="sm" onClick={() => handleAction("shareRecoveryPreviewLink")} aria-label={t("shareRecoveryLink")}>{t("shareRecoveryLink")}</NeoButton>
                </div>
              </div>
            )}
            {credentialUrl && (
              <div className="link-box">
                <p className="link-label">{t("openRecoveryCredential")}</p>
                <p className="link-value">{credentialUrl}</p>
                <div className="link-actions">
                  <NeoButton variant="secondary" size="sm" onClick={() => handleAction("copyRecoveryCredentialLink")} aria-label={t("copyRecoveryCredential")}>{t("copyRecoveryCredential")}</NeoButton>
                  <NeoButton variant="secondary" size="sm" onClick={() => handleAction("shareRecoveryCredentialLink")} aria-label={t("shareRecoveryCredential")}>{t("shareRecoveryCredential")}</NeoButton>
                </div>
              </div>
            )}
          </div>
        )}
        <pre className="json-box">{renderedPayload}</pre>
      </div>

      {/* Operation Section */}
      <div className="operation-section">
        <div className="stack">
          <NeoInput value={accountAddress} onChange={(val) => setField("accountAddress", val)} label={t("accountAddress")} placeholder={t("accountAddressPlaceholder")} />
          <NeoInput value={verifierHashOverride} onChange={(val) => setField("verifierHashOverride", val)} label={t("verifierHash")} placeholder={t("verifierHashPlaceholder")} />
          <NeoInput value={recoveryNewOwner} onChange={(val) => setField("recoveryNewOwner", val)} label={t("newOwner")} placeholder={t("newOwnerPlaceholder")} />
          <NeoInput value={recoveryExpiryMinutes} onChange={(val) => setField("recoveryExpiryMinutes", val)} label={t("recoveryExpiry")} placeholder={t("recoveryExpiryPlaceholder")} />
          <NeoInput value={recoveryTemplateId} onChange={(val) => setField("recoveryTemplateId", val)} label={t("recoveryTemplateId")} placeholder={t("recoveryTemplateIdPlaceholder")} />
          <div className="button-row">
            <NeoButton variant="primary" loading={isQuerying} onClick={() => handleAction("queryGuardianState")} aria-label={t("queryState")}>{t("queryState")}</NeoButton>
            <NeoButton variant="secondary" onClick={() => handleAction("openRecoveryPreviewLink")} aria-label={t("openRecoveryPreview")}>{t("openRecoveryPreview")}</NeoButton>
            <NeoButton variant="secondary" onClick={() => handleAction("copyRecoveryPreviewLink")} aria-label={t("copyRecoveryLink")}>{t("copyRecoveryLink")}</NeoButton>
            <NeoButton variant="secondary" onClick={() => handleAction("shareRecoveryPreviewLink")} aria-label={t("shareRecoveryLink")}>{t("shareRecoveryLink")}</NeoButton>
            <NeoButton variant="secondary" onClick={() => handleAction("openRecoveryCredentialLink")} aria-label={t("openRecoveryCredential")}>{t("openRecoveryCredential")}</NeoButton>
            <NeoButton variant="secondary" onClick={() => handleAction("copyRecoveryCredentialLink")} aria-label={t("copyRecoveryCredential")}>{t("copyRecoveryCredential")}</NeoButton>
            <NeoButton variant="secondary" onClick={() => handleAction("shareRecoveryCredentialLink")} aria-label={t("shareRecoveryCredential")}>{t("shareRecoveryCredential")}</NeoButton>
            <NeoButton variant="secondary" onClick={() => handleAction("openIdentityWorkspace")} aria-label={t("openIdentityWorkspace")}>{t("openIdentityWorkspace")}</NeoButton>
            <NeoButton variant="secondary" onClick={() => handleAction("openAaWorkspace")} aria-label={t("openAaWorkspace")}>{t("openAaWorkspace")}</NeoButton>
            <NeoButton variant="secondary" onClick={() => handleAction("openRecoveryDocs")} aria-label={t("openRecoveryDocs")}>{t("openRecoveryDocs")}</NeoButton>
          </div>
        </div>
      </div>
    </div>
  );
}
