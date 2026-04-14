/**
 * PlayArea.tsx — NeoDID Passport PlayArea.
 *
 * Full interactive passport manager: stats bar, DID resolution form,
 * credential management, oracle key fetch, and JSON result panel.
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
  const { str, bool, num } = useStateBindings(state);

  const did = str("did", "did:morpheus:neo_n3:service:neodid");
  const format = str("format", "resolution");
  const secretName = str("secretName", "passport-ref");
  const credentialRecipient = str("credentialRecipient");
  const credentialTemplateId = str("credentialTemplateId");
  const ciphertext = str("ciphertext");
  const isRequesting = bool("isRequesting");
  const renderedPayload = str("renderedPayload", "{}");
  const oracleHash = str("oracleHash");
  const networkDisplay = str("networkDisplay");
  const publicApiUrl = str("publicApiUrl");
  const neodidDomain = str("neodidDomain");
  const neodidContract = str("neodidContract");
  const providerCount = num("providerCount");

  const setField = (key: string, val: string) => {
    if (state[key]) state[key].set(val);
  };

  return (
    <div className="neodid-passport-play-area">
      {/* Stats Bar */}
      <div className="stats-bar">
        <div className="stat-chip">
          <span className="stat-value">{providerCount}</span>
          <span className="stat-label">{t("providers") || "Providers"}</span>
        </div>
        <div className="stat-chip">
          <span className="stat-value">{networkDisplay || "--"}</span>
          <span className="stat-label">{t("network") || "Network"}</span>
        </div>
        <div className="stat-chip">
          <span className="stat-value">{oracleHash ? oracleHash.slice(0, 8) + "..." : "--"}</span>
          <span className="stat-label">{t("oracleHash") || "Oracle"}</span>
        </div>
      </div>

      {/* Environment Info */}
      <NeoCard variant="erobo" className="env-card">
        <div className="env-grid">
          <div className="env-item">
            <span className="env-label">{t("publicApiUrl") || "API URL"}</span>
            <span className="env-value">{publicApiUrl || "--"}</span>
          </div>
          <div className="env-item">
            <span className="env-label">{t("neodidDomain") || "Domain"}</span>
            <span className="env-value">{neodidDomain || "--"}</span>
          </div>
          <div className="env-item">
            <span className="env-label">{t("neodidContract") || "Contract"}</span>
            <span className="env-value">{neodidContract || "--"}</span>
          </div>
        </div>
      </NeoCard>

      {/* Result Panel */}
      <NeoCard variant="erobo" className="result-card">
        <span className="result-title">{t("resultPayload") || "Result Payload"}</span>
        <pre className="json-box">{renderedPayload}</pre>
      </NeoCard>

      {/* DID Resolution Form */}
      <NeoCard variant="erobo" className="operation-card">
        <div className="stack">
          <NeoInput value={did} label={t("did") || "DID"} placeholder={t("didPlaceholder") || "Enter DID"} onChange={(v: string) => setField("did", v)} />
          <NeoInput value={format} label={t("format") || "Format"} placeholder={t("formatPlaceholder") || "resolution"} onChange={(v: string) => setField("format", v)} />
          <NeoInput value={secretName} label={t("secretName") || "Secret Name"} placeholder={t("secretNamePlaceholder") || "passport-ref"} onChange={(v: string) => setField("secretName", v)} />
          <NeoInput value={credentialRecipient} label={t("credentialRecipient") || "Credential Recipient"} placeholder={t("credentialRecipientPlaceholder") || "Recipient DID"} onChange={(v: string) => setField("credentialRecipient", v)} />
          <NeoInput value={credentialTemplateId} label={t("credentialTemplateId") || "Template ID"} placeholder={t("credentialTemplateIdPlaceholder") || "Template ID"} onChange={(v: string) => setField("credentialTemplateId", v)} />
          <NeoInput value={ciphertext} type="textarea" label={t("ciphertext") || "Ciphertext"} placeholder={t("ciphertextPlaceholder") || "Encrypted payload"} onChange={(v: string) => setField("ciphertext", v)} />
        </div>
      </NeoCard>

      {/* Actions */}
      <div className="button-row">
        <NeoButton variant="primary" loading={isRequesting} onClick={() => dispatch("resolveDidDocument")} aria-label={t("resolveDid") || "Resolve DID"}>
          {t("resolveDid") || "Resolve DID"}
        </NeoButton>
        <NeoButton variant="secondary" loading={isRequesting} onClick={() => dispatch("loadProviders")} aria-label={t("loadProviders") || "Load Providers"}>
          {t("loadProviders") || "Load Providers"}
        </NeoButton>
        <NeoButton variant="secondary" loading={isRequesting} onClick={() => dispatch("fetchOracleKey")} aria-label={t("fetchOracleKey") || "Fetch Oracle Key"}>
          {t("fetchOracleKey") || "Fetch Oracle Key"}
        </NeoButton>
        <NeoButton variant="secondary" loading={isRequesting} onClick={() => dispatch("storeRef")} aria-label={t("storeConfidentialRef") || "Store Ref"}>
          {t("storeConfidentialRef") || "Store Ref"}
        </NeoButton>
      </div>

      {/* Credential Actions */}
      <NeoCard variant="erobo" className="credential-card">
        <span className="section-title">{t("identityCredentials") || "Identity Credentials"}</span>
        <div className="credential-actions">
          <NeoButton variant="secondary" onClick={() => dispatch("openIdentityCredentialDraft")} aria-label={t("openIdentityCredential") || "Open Credential"}>
            {t("openIdentityCredential") || "Open Credential"}
          </NeoButton>
          <NeoButton variant="secondary" onClick={() => dispatch("copyIdentityCredentialLink")} aria-label={t("copyIdentityCredential") || "Copy Link"}>
            {t("copyIdentityCredential") || "Copy Link"}
          </NeoButton>
          <NeoButton variant="secondary" onClick={() => dispatch("shareIdentityCredentialLink")} aria-label={t("shareIdentityCredential") || "Share Link"}>
            {t("shareIdentityCredential") || "Share Link"}
          </NeoButton>
        </div>
      </NeoCard>
    </div>
  );
}
