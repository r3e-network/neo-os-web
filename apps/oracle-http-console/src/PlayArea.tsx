/**
 * PlayArea.tsx -- Oracle HTTP Console
 *
 * Uses all state: url, method, secretName, secretAsKey, body, response,
 * responseHeaders, responseBody, isRequesting, methodDisplay, statusCode,
 * oracleHash, networkDisplay, publicApiUrl.
 * Actions: runQuery, updateField.
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

  const url = str("url");
  const method = str("method", "GET");
  const secretName = str("secretName");
  const secretAsKey = str("secretAsKey");
  const bodyText = str("body");
  const statusCode = str("statusCode", t("notAvailable") || "N/A");
  const responseHeaders = str("responseHeaders", "{}");
  const responseBody = str("responseBody", t("notAvailable") || "N/A");
  const isRequesting = bool("isRequesting");
  const methodDisplay = str("methodDisplay", "GET");
  const oracleHash = str("oracleHash", "");
  const networkDisplay = str("networkDisplay", "");
  const publicApiUrl = str("publicApiUrl", "");

  const updateField = (field: string, value: string) => {
    dispatch("updateField", field, value);
  };

  return (
    <div className="http-play-area">
      {/* Infrastructure info bar */}
      <NeoCard variant="erobo" className="infra-card">
        <div className="infra-grid">
          <div className="infra-row">
            <span className="label">{t("heroMode") || "Mode"}</span>
            <span className="value">{methodDisplay}</span>
          </div>
          {networkDisplay && (
            <div className="infra-row">
              <span className="label">{t("network") || "Network"}</span>
              <span className="value">{networkDisplay}</span>
            </div>
          )}
          {oracleHash && (
            <div className="infra-row">
              <span className="label">Oracle</span>
              <span className="value mono">{oracleHash.slice(0, 12)}...{oracleHash.slice(-8)}</span>
            </div>
          )}
          {publicApiUrl && (
            <div className="infra-row">
              <span className="label">API</span>
              <span className="value mono">{publicApiUrl}</span>
            </div>
          )}
        </div>
      </NeoCard>

      {/* Result Section */}
      <NeoCard variant="erobo" className="result-card">
        <div className="response-grid">
          <div><span className="label">{t("labelStatus") || "Status"}</span><span className="value">{statusCode}</span></div>
          <div><span className="label">{t("labelHeaders") || "Headers"}</span><span className="value mono">{responseHeaders}</span></div>
          <div><span className="label">{t("labelBody") || "Body"}</span><span className="value mono">{responseBody}</span></div>
        </div>
      </NeoCard>

      {/* Operation Section */}
      <div className="stack">
        <NeoInput value={url} label={t("url") || "URL"} placeholder={t("urlPlaceholder") || "https://..."} onChange={(val) => updateField("url", val)} />
        <NeoInput value={method} label={t("method") || "Method"} placeholder={t("methodPlaceholder") || "GET"} onChange={(val) => updateField("method", val)} />
        <NeoInput value={secretName} label={t("secretName") || "Secret Name"} placeholder={t("optional") || "optional"} onChange={(val) => updateField("secretName", val)} />
        <NeoInput value={secretAsKey} label={t("secretAsKey") || "Secret As Key"} placeholder={t("secretAsKeyPlaceholder") || "Authorization"} onChange={(val) => updateField("secretAsKey", val)} />
        <NeoInput type="textarea" value={bodyText} label={t("body") || "Body"} placeholder={t("bodyPlaceholder") || "{}"} aria-label={t("body") || "Body"} onChange={(val) => updateField("body", val)} />
        <NeoButton variant="primary" loading={isRequesting} aria-label={t("runQuery") || "Run Oracle Query"} onClick={() => dispatch("runQuery")}>
          {t("runQuery") || "Run Oracle Query"}
        </NeoButton>
      </div>
    </div>
  );
}
