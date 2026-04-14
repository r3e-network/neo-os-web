/**
 * PlayArea.tsx — Recovery Guardian
 *
 * Social recovery management with guardian state query, preview/credential
 * links, and workspace navigation. Uses all state and actions from main.tsx.
 */

import { NeoButton, NeoCard, NeoInput } from "@shared/components-react";
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

  // Guardian state
  const hasPayload = bool("hasPayload");
  const isLoading = bool("isLoading");
  const isQuerying = bool("isQuerying");
  const renderedPayload = str("renderedPayload", t("notAvailable") || "N/A");

  // Derived payload fields
  const accountId = str("accountId", t("notAvailable") || "N/A");
  const verifierHash = str("verifierHash", t("notAvailable") || "N/A");
  const threshold = str("threshold", t("notAvailable") || "N/A");
  const timelock = str("timelock", t("notAvailable") || "N/A");

  // URLs
  const previewUrl = str("previewUrl");
  const credentialUrl = str("credentialUrl");

  // Form fields
  const accountAddress = str("accountAddress");
  const verifierHashOverride = str("verifierHashOverride");
  const recoveryNewOwner = str("recoveryNewOwner");
  const recoveryExpiryMinutes = str("recoveryExpiryMinutes", "30");
  const recoveryTemplateId = str("recoveryTemplateId");

  const handleAction = (name: string) => dispatch(name);
  const setField = (field: string, value: string) => {
    dispatch("setField", field, value);
  };

  return (
    <div className="guardian-play-area">
      {/* Guardian State Display */}
      {hasPayload && (
        <NeoCard title={t("guardianState") || "Guardian State"}>
          <div className="guardian-details">
            <div className="detail-row">
              <span className="label">{t("accountId") || "Account ID"}</span>
              <span className="value mono">{accountId}</span>
            </div>
            <div className="detail-row">
              <span className="label">{t("verifierHash") || "Verifier Hash"}</span>
              <span className="value mono">{verifierHash}</span>
            </div>
            <div className="detail-row">
              <span className="label">{t("threshold") || "Threshold"}</span>
              <span className="value">{threshold}</span>
            </div>
            <div className="detail-row">
              <span className="label">{t("timelock") || "Timelock"}</span>
              <span className="value">{timelock}</span>
            </div>
          </div>
        </NeoCard>
      )}

      {/* Result Section */}
      <div className="result-section">
        {hasPayload && (
          <div className="note-box">
            <p className="note-title">{t("noteTitle") || "Recovery Info"}</p>
            <p className="note-text">{t("noteText") || "Guardian state loaded successfully."}</p>
            {previewUrl && (
              <div className="link-box">
                <p className="link-label">{t("openRecoveryPreview") || "Recovery Preview"}</p>
                <p className="link-value">{previewUrl}</p>
                <div className="link-actions">
                  <NeoButton
                    variant="secondary"
                    size="sm"
                    onClick={() => handleAction("copyRecoveryPreviewLink")}
                    aria-label={t("copyRecoveryLink") || "Copy Link"}
                  >
                    {t("copyRecoveryLink") || "Copy Link"}
                  </NeoButton>
                  <NeoButton
                    variant="secondary"
                    size="sm"
                    onClick={() => handleAction("shareRecoveryPreviewLink")}
                    aria-label={t("shareRecoveryLink") || "Share Link"}
                  >
                    {t("shareRecoveryLink") || "Share"}
                  </NeoButton>
                </div>
              </div>
            )}
            {credentialUrl && (
              <div className="link-box">
                <p className="link-label">{t("openRecoveryCredential") || "Recovery Credential"}</p>
                <p className="link-value">{credentialUrl}</p>
                <div className="link-actions">
                  <NeoButton
                    variant="secondary"
                    size="sm"
                    onClick={() => handleAction("copyRecoveryCredentialLink")}
                    aria-label={t("copyRecoveryCredential") || "Copy Credential"}
                  >
                    {t("copyRecoveryCredential") || "Copy"}
                  </NeoButton>
                  <NeoButton
                    variant="secondary"
                    size="sm"
                    onClick={() => handleAction("shareRecoveryCredentialLink")}
                    aria-label={t("shareRecoveryCredential") || "Share Credential"}
                  >
                    {t("shareRecoveryCredential") || "Share"}
                  </NeoButton>
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
          <NeoInput
            value={accountAddress}
            onChange={(v) => setField("accountAddress", v)}
            label={t("accountAddress") || "Account Address"}
            placeholder={t("accountAddressPlaceholder") || "NeoAddress..."}
          />
          <NeoInput
            value={verifierHashOverride}
            onChange={(v) => setField("verifierHashOverride", v)}
            label={t("verifierHash") || "Verifier Hash Override"}
            placeholder={t("verifierHashPlaceholder") || "0x..."}
          />
          <NeoInput
            value={recoveryNewOwner}
            onChange={(v) => setField("recoveryNewOwner", v)}
            label={t("newOwner") || "New Owner"}
            placeholder={t("newOwnerPlaceholder") || "NeoAddress..."}
          />
          <NeoInput
            value={recoveryExpiryMinutes}
            onChange={(v) => setField("recoveryExpiryMinutes", v)}
            label={t("recoveryExpiry") || "Expiry (minutes)"}
            placeholder={t("recoveryExpiryPlaceholder") || "30"}
          />
          <NeoInput
            value={recoveryTemplateId}
            onChange={(v) => setField("recoveryTemplateId", v)}
            label={t("recoveryTemplateId") || "Template ID"}
            placeholder={t("recoveryTemplateIdPlaceholder") || "Enter template ID"}
          />

          {/* Primary Actions */}
          <div className="button-row">
            <NeoButton
              variant="primary"
              loading={isQuerying}
              onClick={() => handleAction("queryGuardianState")}
              aria-label={t("queryState") || "Query State"}
            >
              {t("queryState") || "Query State"}
            </NeoButton>
            <NeoButton
              variant="secondary"
              onClick={() => handleAction("openRecoveryPreviewLink")}
              aria-label={t("openRecoveryPreview") || "Open Preview"}
            >
              {t("openRecoveryPreview") || "Open Preview"}
            </NeoButton>
          </div>

          {/* Link Actions */}
          <div className="button-row">
            <NeoButton
              variant="secondary"
              onClick={() => handleAction("copyRecoveryPreviewLink")}
              aria-label={t("copyRecoveryLink") || "Copy Preview Link"}
            >
              {t("copyRecoveryLink") || "Copy Preview Link"}
            </NeoButton>
            <NeoButton
              variant="secondary"
              onClick={() => handleAction("shareRecoveryPreviewLink")}
              aria-label={t("shareRecoveryLink") || "Share Preview"}
            >
              {t("shareRecoveryLink") || "Share Preview"}
            </NeoButton>
            <NeoButton
              variant="secondary"
              onClick={() => handleAction("openRecoveryCredentialLink")}
              aria-label={t("openRecoveryCredential") || "Open Credential"}
            >
              {t("openRecoveryCredential") || "Open Credential"}
            </NeoButton>
            <NeoButton
              variant="secondary"
              onClick={() => handleAction("copyRecoveryCredentialLink")}
              aria-label={t("copyRecoveryCredential") || "Copy Credential"}
            >
              {t("copyRecoveryCredential") || "Copy Credential"}
            </NeoButton>
            <NeoButton
              variant="secondary"
              onClick={() => handleAction("shareRecoveryCredentialLink")}
              aria-label={t("shareRecoveryCredential") || "Share Credential"}
            >
              {t("shareRecoveryCredential") || "Share Credential"}
            </NeoButton>
          </div>

          {/* Workspace Actions */}
          <div className="button-row">
            <NeoButton
              variant="secondary"
              onClick={() => handleAction("openIdentityWorkspace")}
              aria-label={t("openIdentityWorkspace") || "Identity Workspace"}
            >
              {t("openIdentityWorkspace") || "Identity Workspace"}
            </NeoButton>
            <NeoButton
              variant="secondary"
              onClick={() => handleAction("openAaWorkspace")}
              aria-label={t("openAaWorkspace") || "AA Workspace"}
            >
              {t("openAaWorkspace") || "AA Workspace"}
            </NeoButton>
            <NeoButton
              variant="secondary"
              onClick={() => handleAction("openRecoveryDocs")}
              aria-label={t("openRecoveryDocs") || "Recovery Docs"}
            >
              {t("openRecoveryDocs") || "Recovery Docs"}
            </NeoButton>
          </div>
        </div>
      </div>
    </div>
  );
}
