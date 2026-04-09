import { NeoButton, NeoCard, NeoInput } from "@shared/components-react";
import { useStateBindings } from "@shared/react/hooks/useStateBindings";
import type { Observable } from "@shared/react/context";
import "./PlayArea.scss";

interface KeyMeta {
  algorithm?: string;
  network?: string;
  contract?: string;
  rpc_url?: string;
  source?: string;
  public_key?: string;
}

interface StoredRefType {
  secret_ref?: string;
  name?: string;
}

interface PlayAreaProps {
  t: (key: string, params?: Record<string, string | number>) => string;
  state: Record<string, Observable>;
  dispatch: (name: string, ...args: unknown[]) => Promise<void>;
}

export default function PlayArea({ t, state, dispatch }: PlayAreaProps) {
  const { str, bool, val } = useStateBindings(state);

  const keyMeta = val<KeyMeta>("keyMeta");
  const inputMode = str("inputMode", "json");
  const fieldName = str("fieldName", "encrypted_payload");
  const confidentialInput = str("confidentialInput");
  const ciphertext = str("ciphertext");
  const isLoadingKey = bool("isLoadingKey");
  const isSealing = bool("isSealing");
  const isStoring = bool("isStoring");
  const copiedKey = val<string>("copiedKey");
  const storageName = str("storageName");
  const projectSlug = str("projectSlug");
  const boundRequester = str("boundRequester");
  const boundCallbackContract = str("boundCallbackContract");
  const storedRef = val<StoredRefType>("storedRef");
  const canSeal = bool("canSeal");
  const canStoreRef = bool("canStoreRef");
  const wrapperJson = str("wrapperJson");
  const refWrapperJson = str("refWrapperJson");
  const networkDisplay = str("networkDisplay");

  return (
    <div className="seal-play-area">
      {/* Public Key Details */}
      <NeoCard variant="erobo" title={t("publicKeyTitle")} className="mb-6">
        <div className="details-grid">
          <div><span className="label">{t("algorithm")}</span><span className="value">{keyMeta?.algorithm || t("notAvailable")}</span></div>
          <div><span className="label">{t("network")}</span><span className="value">{keyMeta?.network || networkDisplay}</span></div>
          <div><span className="label">{t("contract")}</span><span className="value">{keyMeta?.contract || t("notAvailable")}</span></div>
          <div><span className="label">{t("rpc")}</span><span className="value">{keyMeta?.rpc_url || t("notAvailable")}</span></div>
          <div><span className="label">{t("source")}</span><span className="value">{keyMeta?.source || t("notAvailable")}</span></div>
          <div><span className="label">{t("publicKeyLabel")}</span><span className="value">{keyMeta?.public_key || t("notAvailable")}</span></div>
        </div>
      </NeoCard>

      {/* Encrypted Output */}
      <NeoCard variant="erobo" title={t("outputTitle")} className="mb-6">
        <div className="stack">
          <NeoInput type="textarea" value={ciphertext} label={t("ciphertext")} aria-label={t("ciphertext")} disabled />
          <NeoButton variant="secondary" disabled={!ciphertext} aria-label={t("copyCiphertext")} onClick={() => dispatch("copyText", ciphertext, "cipher")}>
            {copiedKey === "cipher" ? t("copied") : t("copyCiphertext")}
          </NeoButton>

          <NeoInput type="textarea" value={wrapperJson} label={t("wrapperJson")} aria-label={t("wrapperJson")} disabled />
          <NeoButton variant="secondary" disabled={!ciphertext} aria-label={t("copyWrapper")} onClick={() => dispatch("copyText", wrapperJson, "wrapper")}>
            {copiedKey === "wrapper" ? t("copied") : t("copyWrapper")}
          </NeoButton>
        </div>
      </NeoCard>

      {/* Stored Reference */}
      <NeoCard variant="erobo" title={t("refTitle")} className="mb-6">
        <div className="stack">
          <div className="details-grid">
            <div><span className="label">{t("secretRef")}</span><span className="value">{storedRef?.secret_ref || t("notAvailable")}</span></div>
            <div><span className="label">{t("storageName")}</span><span className="value">{storedRef?.name || storageName || t("notAvailable")}</span></div>
          </div>

          <NeoInput type="textarea" value={refWrapperJson} label={t("copyRefWrapper")} aria-label={t("copyRefWrapper")} disabled />
          <NeoButton variant="secondary" disabled={!storedRef?.secret_ref} aria-label={t("copyRefWrapper")} onClick={() => dispatch("copyText", refWrapperJson, "ref")}>
            {copiedKey === "ref" ? t("copied") : t("copyRefWrapper")}
          </NeoButton>
        </div>
      </NeoCard>

      {/* Operation Section */}
      <div className="stack">
        <div className="button-row">
          <NeoButton variant={inputMode === "json" ? "primary" : "secondary"} aria-label={t("jsonMode")} onClick={() => dispatch("setInputMode", "json")}>{t("jsonMode")}</NeoButton>
          <NeoButton variant={inputMode === "text" ? "primary" : "secondary"} aria-label={t("textMode")} onClick={() => dispatch("setInputMode", "text")}>{t("textMode")}</NeoButton>
        </div>

        <div className="button-row button-row--three">
          <NeoButton variant={fieldName === "encrypted_payload" ? "primary" : "secondary"} aria-label={t("encryptedPayload")} onClick={() => dispatch("setFieldName", "encrypted_payload")}>{t("encryptedPayload")}</NeoButton>
          <NeoButton variant={fieldName === "encrypted_params" ? "primary" : "secondary"} aria-label={t("encryptedParams")} onClick={() => dispatch("setFieldName", "encrypted_params")}>{t("encryptedParams")}</NeoButton>
          <NeoButton variant={fieldName === "encrypted_token" ? "primary" : "secondary"} aria-label={t("encryptedToken")} onClick={() => dispatch("setFieldName", "encrypted_token")}>{t("encryptedToken")}</NeoButton>
        </div>

        <NeoInput
          value={confidentialInput}
          type="textarea"
          label={t("plaintextLabel")}
          hint={t("helperNote")}
          placeholder={t("confidentialJsonPlaceholder")}
          onChange={(val) => dispatch("updateConfidentialInput", val)}
        />

        <NeoInput value={storageName} label={t("storageName")} placeholder={t("storageNamePlaceholder")} onChange={(val) => dispatch("updateStorageName", val)} />
        <NeoInput value={projectSlug} label={t("projectSlug")} placeholder={t("optional")} onChange={(val) => dispatch("updateProjectSlug", val)} />
        <NeoInput value={boundRequester} label={t("requesterScriptHash")} placeholder={t("hexOptional")} onChange={(val) => dispatch("updateBoundRequester", val)} />
        <NeoInput value={boundCallbackContract} label={t("callbackContract")} placeholder={t("hexOptional")} onChange={(val) => dispatch("updateBoundCallbackContract", val)} />

        <NeoButton variant="secondary" loading={isLoadingKey} aria-label={t("refreshKey")} onClick={() => dispatch("loadKey")}>{t("refreshKey")}</NeoButton>
        <NeoButton variant="primary" loading={isSealing} disabled={!canSeal} aria-label={t("sealNow")} onClick={() => dispatch("sealPayload")}>{t("sealNow")}</NeoButton>
        <NeoButton variant="secondary" loading={isStoring} disabled={!canStoreRef} aria-label={t("storeRef")} onClick={() => dispatch("storeCiphertextRef")}>{t("storeRef")}</NeoButton>
      </div>
    </div>
  );
}
