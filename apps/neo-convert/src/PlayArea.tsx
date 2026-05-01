/**
 * PlayArea.tsx — Neo Convert PlayArea.
 *
 * Key conversion, account generation, and balance checking tool.
 */

import { useState } from "react";
import { NeoButton, NeoCard, NeoInput } from "@shared/components-react";
import { useStateBindings } from "@shared/react/hooks/useStateBindings";
import type { Observable } from "@shared/react/context";
import "./PlayArea.scss";

interface PlayAreaProps {
  t: (key: string, params?: Record<string, string | number>) => string;
  state: Record<string, Observable>;
  dispatch: (name: string, ...args: unknown[]) => Promise<void>;
}

interface NeoAccountSummary {
  address?: string;
  publicKey?: string;
  privateKey?: string;
  wif?: string;
}

export default function PlayArea({ t, state, dispatch }: PlayAreaProps) {
  const { str, bool, val } = useStateBindings(state);
  const [keyInput, setKeyInput] = useState("");

  const isLoading = bool("isLoading");
  const balancesLoading = bool("balancesLoading");
  const hasGeneratedAccount = bool("hasGeneratedAccount");
  const generatedAccount = val<NeoAccountSummary | null>("generatedAccount") ?? null;
  const hasConversionResult = bool("hasConversionResult");
  const showSecrets = bool("showSecrets");
  const accountsGenerated = str("accountsGenerated", "0");
  const conversionResult = str("conversionResult");
  const conversionStatus = str("conversionStatus");
  const conversionStatusType = str("conversionStatusType");
  const copyStatus = str("copyStatus");
  const formattedNeoBalance = str("formattedNeoBalance", "0");
  const formattedGasBalance = str("formattedGasBalance", "0");

  return (
    <div className="neo-convert-play-area">
      <div className="hero-stats">
        <div className="hero-stat">
          <span className="hero-stat-value">{accountsGenerated}</span>
          <span className="hero-stat-label">{t("accountsGenerated")}</span>
        </div>
        <div className="hero-stat">
          <span className="hero-stat-value">{formattedNeoBalance}</span>
          <span className="hero-stat-label">NEO</span>
        </div>
        <div className="hero-stat">
          <span className="hero-stat-value">{formattedGasBalance}</span>
          <span className="hero-stat-label">GAS</span>
        </div>
      </div>

      <NeoCard variant="erobo" title={t("generateAccount") || "Generate Account"}>
        <div className="convert-section">
          <NeoButton
            variant="primary"
            block
            loading={isLoading}
            onClick={() => dispatch("generate")}
          >
            {t("generateNewAccount") || "Generate New Account"}
          </NeoButton>
          {hasGeneratedAccount && generatedAccount && (
            <div className="generated-result">
              <div className="result-row">
                <span className="result-label">{t("address") || "Address"}</span>
                <code className="result-value mono">{generatedAccount.address ?? ""}</code>
                <NeoButton
                  size="sm"
                  variant="ghost"
                  onClick={() => dispatch("copy", generatedAccount.address ?? "")}
                >
                  {copyStatus || t("copy") || "Copy"}
                </NeoButton>
              </div>
              <NeoButton
                size="sm"
                variant="secondary"
                onClick={() => dispatch("toggleSecrets")}
              >
                {showSecrets ? t("hideSecrets") || "Hide" : t("showSecrets") || "Show Secrets"}
              </NeoButton>
            </div>
          )}
        </div>
      </NeoCard>

      <NeoCard variant="erobo" title={t("convertKey") || "Convert Key"}>
        <div className="convert-section">
          <NeoInput
            value={keyInput}
            onChange={(v) => setKeyInput(v)}
            placeholder={t("enterKeyPlaceholder") || "Enter WIF, hex, or address..."}
          />
          <NeoButton
            variant="primary"
            block
            loading={isLoading}
            disabled={!keyInput.trim()}
            onClick={() => dispatch("convert", keyInput)}
          >
            {t("convert") || "Convert"}
          </NeoButton>
          {hasConversionResult && (
            <div className={`conversion-status conversion-status--${conversionStatusType}`}>
              <span>{conversionStatus}</span>
              <pre className="conversion-result">{conversionResult}</pre>
            </div>
          )}
        </div>
      </NeoCard>

      {balancesLoading && (
        <div className="loading-state">
          <div className="loading-spinner" />
          <span>{t("loadingBalances") || "Loading balances..."}</span>
        </div>
      )}
    </div>
  );
}
