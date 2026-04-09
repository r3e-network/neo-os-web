/**
 * PlayArea.tsx — React version of NeoDID Passport PlayArea.
 *
 * Renders the JSON result panel and identity/DID action inputs/buttons.
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

  const did = str("did", "did:morpheus:neo_n3:service:neodid");
  const format = str("format", "resolution");
  const secretName = str("secretName", "passport-ref");
  const credentialRecipient = str("credentialRecipient");
  const credentialTemplateId = str("credentialTemplateId");
  const ciphertext = str("ciphertext");
  const isRequesting = bool("isRequesting");
  const renderedPayload = str("renderedPayload", "{}");

  const setField = (key: string, val: string) => {
    if (state[key]) state[key].set(val);
  };

  return (
    <div className="neodid-passport-play-area">
      {/* Result Panel */}
      <pre className="json-box">{renderedPayload}</pre>

      {/* Operation Panel */}
      <div className="stack">
        <NeoInput value={did} label={t("did")} placeholder={t("didPlaceholder")} onChange={(val) => setField("did", val)} />
        <NeoInput value={format} label={t("format")} placeholder={t("formatPlaceholder")} onChange={(val) => setField("format", val)} />
        <NeoInput value={secretName} label={t("secretName")} placeholder={t("secretNamePlaceholder")} onChange={(val) => setField("secretName", val)} />
        <NeoInput value={credentialRecipient} label={t("credentialRecipient")} placeholder={t("credentialRecipientPlaceholder")} onChange={(val) => setField("credentialRecipient", val)} />
        <NeoInput value={credentialTemplateId} label={t("credentialTemplateId")} placeholder={t("credentialTemplateIdPlaceholder")} onChange={(val) => setField("credentialTemplateId", val)} />
        <NeoInput value={ciphertext} type="textarea" label={t("ciphertext")} placeholder={t("ciphertextPlaceholder")} onChange={(val) => setField("ciphertext", val)} />
        <div className="button-row">
          <NeoButton variant="primary" loading={isRequesting} onClick={() => dispatch("resolveDidDocument")} aria-label={t("resolveDid")}>{t("resolveDid")}</NeoButton>
          <NeoButton variant="secondary" loading={isRequesting} onClick={() => dispatch("loadProviders")} aria-label={t("loadProviders")}>{t("loadProviders")}</NeoButton>
          <NeoButton variant="secondary" loading={isRequesting} onClick={() => dispatch("fetchOracleKey")} aria-label={t("fetchOracleKey")}>{t("fetchOracleKey")}</NeoButton>
          <NeoButton variant="secondary" loading={isRequesting} onClick={() => dispatch("storeRef")} aria-label={t("storeConfidentialRef")}>{t("storeConfidentialRef")}</NeoButton>
          <NeoButton variant="secondary" onClick={() => dispatch("openIdentityCredentialDraft")} aria-label={t("openIdentityCredential")}>{t("openIdentityCredential")}</NeoButton>
          <NeoButton variant="secondary" onClick={() => dispatch("copyIdentityCredentialLink")} aria-label={t("copyIdentityCredential")}>{t("copyIdentityCredential")}</NeoButton>
          <NeoButton variant="secondary" onClick={() => dispatch("shareIdentityCredentialLink")} aria-label={t("shareIdentityCredential")}>{t("shareIdentityCredential")}</NeoButton>
        </div>
      </div>
    </div>
  );
}
