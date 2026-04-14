/**
 * PlayArea.tsx — AA Permissions Lab
 *
 * AA permissions inspection and management: view current verifier/hook/backup,
 * update verifier, update hook. Uses all state and actions from main.tsx.
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

export default function PlayArea({ t, state, dispatch }: PlayAreaProps) {
  const { str, bool } = useStateBindings(state);

  // State bindings
  const isRefreshing = bool("isRefreshing");
  const isVerifierBusy = bool("isVerifierBusy");
  const isHookBusy = bool("isHookBusy");
  const currentVerifier = str("currentVerifier", t("notAvailable") || "N/A");
  const currentHook = str("currentHook", t("notAvailable") || "N/A");
  const currentBackupOwner = str("currentBackupOwner", t("notAvailable") || "N/A");

  // Local form state
  const [accountIdHash, setAccountIdHash] = useState("");
  const [verifierHash, setVerifierHash] = useState("");
  const [verifierParamsHex, setVerifierParamsHex] = useState("");
  const [hookHash, setHookHash] = useState("");

  const detailItems = [
    { label: t("currentVerifier") || "Current Verifier", value: currentVerifier },
    { label: t("currentHook") || "Current Hook", value: currentHook },
    { label: t("currentBackupOwner") || "Backup Owner", value: currentBackupOwner },
  ];

  return (
    <div className="aa-permissions-play-area">
      {/* Inspect Section */}
      <NeoCard variant="erobo" title={t("inspect") || "Inspect Permissions"}>
        <div className="stack">
          <NeoInput
            value={accountIdHash}
            label={t("accountId") || "Account ID Hash"}
            placeholder={t("accountIdHashPlaceholder") || "Enter account ID hash"}
            onChange={(v) => setAccountIdHash(v)}
          />
          <NeoButton
            variant="secondary"
            loading={isRefreshing}
            aria-label={t("inspect") || "Inspect"}
            onClick={() => dispatch("refresh", accountIdHash)}
          >
            {t("inspect") || "Inspect"}
          </NeoButton>
        </div>
        <div className="details-grid">
          {detailItems.map((item) => (
            <div key={item.label} className="detail-item">
              <span className="label">{item.label}</span>
              <span className="value mono">{item.value}</span>
            </div>
          ))}
        </div>
      </NeoCard>

      {/* Update Verifier Section */}
      <NeoCard variant="erobo" title={t("updateVerifier") || "Update Verifier"}>
        <div className="stack">
          <NeoInput
            value={verifierHash}
            label={t("verifier") || "Verifier Hash"}
            placeholder={t("verifierHashPlaceholder") || "0x..."}
            onChange={(v) => setVerifierHash(v)}
          />
          <NeoInput
            value={verifierParamsHex}
            label={t("verifierParams") || "Verifier Params (hex)"}
            placeholder={t("verifierParamsPlaceholder") || "0x..."}
            onChange={(v) => setVerifierParamsHex(v)}
          />
          <NeoButton
            variant="primary"
            loading={isVerifierBusy}
            aria-label={t("updateVerifier") || "Update Verifier"}
            onClick={() =>
              dispatch("submitVerifier", accountIdHash, verifierHash, verifierParamsHex)
            }
          >
            {t("updateVerifier") || "Update Verifier"}
          </NeoButton>
        </div>
      </NeoCard>

      {/* Update Hook Section */}
      <NeoCard variant="erobo" title={t("updateHook") || "Update Hook"}>
        <div className="stack">
          <NeoInput
            value={hookHash}
            label={t("hook") || "Hook Hash"}
            placeholder={t("hookHashPlaceholder") || "0x..."}
            onChange={(v) => setHookHash(v)}
          />
          <NeoButton
            variant="secondary"
            loading={isHookBusy}
            aria-label={t("updateHook") || "Update Hook"}
            onClick={() => dispatch("submitHook", accountIdHash, hookHash)}
          >
            {t("updateHook") || "Update Hook"}
          </NeoButton>
        </div>
      </NeoCard>
    </div>
  );
}
