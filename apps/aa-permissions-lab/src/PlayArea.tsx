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

export default function PlayArea({ t, state, dispatch }: PlayAreaProps) {
  const { str, bool } = useStateBindings(state);

  // State bindings
  const isRefreshing = bool("isRefreshing");
  const isVerifierBusy = bool("isVerifierBusy");
  const isHookBusy = bool("isHookBusy");
  const currentVerifier = str("currentVerifier", t("notAvailable"));
  const currentHook = str("currentHook", t("notAvailable"));
  const currentBackupOwner = str("currentBackupOwner", t("notAvailable"));

  // Local form state
  const [accountIdHash, setAccountIdHash] = useState("");
  const [verifierHash, setVerifierHash] = useState("");
  const [verifierParamsHex, setVerifierParamsHex] = useState("");
  const [hookHash, setHookHash] = useState("");

  const detailItems = [
    { label: t("currentVerifier"), value: currentVerifier },
    { label: t("currentHook"), value: currentHook },
    { label: t("currentBackupOwner"), value: currentBackupOwner },
  ];

  return (
    <div className="aa-permissions-play-area">
      {/* Inspect Section */}
      <NeoCard variant="erobo" title={t("inspect")}>
        <div className="stack">
          <NeoInput
            value={accountIdHash}
            label={t("accountId")}
            placeholder={t("accountIdHashPlaceholder")}
            onChange={(val) => setAccountIdHash(val)}
          />
          <NeoButton variant="secondary" loading={isRefreshing} aria-label={t("inspect")} onClick={() => dispatch("refresh", accountIdHash)}>
            {t("inspect")}
          </NeoButton>
        </div>
        <div className="details-grid">
          {detailItems.map((item) => (
            <div key={item.label}>
              <span className="label">{item.label}</span>
              <span className="value">{item.value}</span>
            </div>
          ))}
        </div>
      </NeoCard>

      {/* Update Verifier Section */}
      <NeoCard variant="erobo" title={t("updateVerifier")}>
        <div className="stack">
          <NeoInput
            value={verifierHash}
            label={t("verifier")}
            placeholder={t("verifierHashPlaceholder")}
            onChange={(val) => setVerifierHash(val)}
          />
          <NeoInput
            value={verifierParamsHex}
            label={t("verifierParams")}
            placeholder={t("verifierParamsPlaceholder")}
            onChange={(val) => setVerifierParamsHex(val)}
          />
          <NeoButton variant="primary" loading={isVerifierBusy} aria-label={t("updateVerifier")} onClick={() => dispatch("submitVerifier", accountIdHash, verifierHash, verifierParamsHex)}>
            {t("updateVerifier")}
          </NeoButton>
        </div>
      </NeoCard>

      {/* Update Hook Section */}
      <NeoCard variant="erobo" title={t("updateHook")}>
        <div className="stack">
          <NeoInput
            value={hookHash}
            label={t("hook")}
            placeholder={t("hookHashPlaceholder")}
            onChange={(val) => setHookHash(val)}
          />
          <NeoButton variant="secondary" loading={isHookBusy} aria-label={t("updateHook")} onClick={() => dispatch("submitHook", accountIdHash, hookHash)}>
            {t("updateHook")}
          </NeoButton>
        </div>
      </NeoCard>
    </div>
  );
}
