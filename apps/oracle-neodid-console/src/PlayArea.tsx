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
  const { str, num, bool } = useStateBindings(state);

  const did = str("did");
  const format = str("format", "resolution");
  const renderedPayload = str("renderedPayload", "{}");
  const providerCount = num("providerCount");
  const formatDisplay = str("formatDisplay");
  const networkDisplay = str("networkDisplay", "N3 TestNet");
  const publicApiUrl = str("publicApiUrl");
  const neodidContract = str("neodidContract");
  const neodidDomain = str("neodidDomain");
  const isRequesting = bool("isRequesting");

  return (
    <div className="neodid-play-area">
      {/* Stats Bar */}
      <div className="stats-bar">
        <div className="stat-chip">
          <span className="stat-chip-label">{t("network") || "Network"}</span>
          <span className="stat-chip-value">{networkDisplay}</span>
        </div>
        <div className="stat-chip">
          <span className="stat-chip-label">{t("providers") || "Providers"}</span>
          <span className="stat-chip-value">{providerCount}</span>
        </div>
        <div className="stat-chip">
          <span className="stat-chip-label">{t("format") || "Format"}</span>
          <span className="stat-chip-value">{formatDisplay || format}</span>
        </div>
      </div>

      {/* Contract Info */}
      <NeoCard title={t("contractInfo") || "Contract Info"}>
        <div className="info-grid">
          {neodidContract && (
            <div className="info-row">
              <span className="label">{t("contract") || "Contract"}</span>
              <span className="value mono">{neodidContract}</span>
            </div>
          )}
          {neodidDomain && (
            <div className="info-row">
              <span className="label">{t("domain") || "Domain"}</span>
              <span className="value mono">{neodidDomain}</span>
            </div>
          )}
          {publicApiUrl && (
            <div className="info-row">
              <span className="label">{t("apiUrl") || "API URL"}</span>
              <span className="value mono">{publicApiUrl}</span>
            </div>
          )}
        </div>
      </NeoCard>

      {/* Input Form */}
      <div className="stack">
        <NeoInput
          value={did}
          label={t("did") || "DID"}
          placeholder={t("didPlaceholder") || "Enter DID identifier"}
          onChange={(val) => dispatch("updateDid", val)}
        />
        <NeoInput
          value={format}
          label={t("format") || "Format"}
          placeholder={t("formatPlaceholder") || "resolution"}
          onChange={(val) => dispatch("updateFormat", val)}
        />

        {/* Example DIDs */}
        <div className="button-row">
          <NeoButton variant="secondary" aria-label={t("serviceDid") || "Service DID"} onClick={() => dispatch("applyExample", "service")}>
            {t("serviceDid") || "Service"}
          </NeoButton>
          <NeoButton variant="secondary" aria-label={t("vaultDid") || "Vault DID"} onClick={() => dispatch("applyExample", "vault")}>
            {t("vaultDid") || "Vault"}
          </NeoButton>
          <NeoButton variant="secondary" aria-label={t("aaDid") || "AA DID"} onClick={() => dispatch("applyExample", "aa")}>
            {t("aaDid") || "AA"}
          </NeoButton>
        </div>

        {/* Actions */}
        <NeoButton
          variant="primary"
          size="lg"
          block
          loading={isRequesting}
          aria-label={t("resolveDid") || "Resolve DID"}
          onClick={() => dispatch("resolveDid")}
        >
          {t("resolveDid") || "Resolve DID"}
        </NeoButton>
        <NeoButton
          variant="secondary"
          block
          loading={isRequesting}
          aria-label={t("loadProviders") || "Load Providers"}
          onClick={() => dispatch("loadProviders")}
        >
          {t("loadProviders") || "Load Providers"}
        </NeoButton>
      </div>

      {/* Result Display */}
      <NeoCard title={t("result") || "Result"}>
        <pre className="json-box">{renderedPayload}</pre>
      </NeoCard>
    </div>
  );
}
