/**
 * PlayArea.tsx — AA Account Lab
 *
 * AA account inspection and registration interface.
 * Uses all state keys and actions from main.tsx setup().
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
  const isInspecting = bool("isInspecting");
  const isSubmitting = bool("isSubmitting");
  const currentVerifier = str("currentVerifier", t("notAvailable") || "N/A");
  const currentHook = str("currentHook", t("notAvailable") || "N/A");
  const currentBackupOwner = str("currentBackupOwner", t("notAvailable") || "N/A");
  const aaCoreDisplay = str("aaCoreDisplay");
  const defaultVerifierDisplay = str("defaultVerifierDisplay");
  const networkDisplay = str("networkDisplay");

  // Local form state
  const [inspectAccountId, setInspectAccountId] = useState("");
  const [registerAccountId, setRegisterAccountId] = useState("");
  const [verifierHash, setVerifierHash] = useState(defaultVerifierDisplay || "");
  const [verifierParamsHex, setVerifierParamsHex] = useState("");
  const [hookHash, setHookHash] = useState("");
  const [backupOwner, setBackupOwner] = useState("");
  const [escapeTimelock, setEscapeTimelock] = useState("2592000");

  const detailItems = [
    { label: t("currentVerifier") || "Verifier", value: currentVerifier },
    { label: t("currentHook") || "Hook", value: currentHook },
    { label: t("currentBackupOwner") || "Backup Owner", value: currentBackupOwner },
    { label: t("aaCore") || "AA Core", value: aaCoreDisplay },
  ];

  return (
    <div className="aa-account-play-area">
      {/* Network Info */}
      {networkDisplay && (
        <div className="network-info">
          <span className="network-label">{t("network") || "Network"}</span>
          <span className="network-value">{networkDisplay}</span>
        </div>
      )}

      {/* Inspector Section */}
      <NeoCard variant="erobo" title={t("inspectorTitle") || "Account Inspector"}>
        <div className="field-stack">
          <NeoInput
            value={inspectAccountId}
            label={t("accountId") || "Account ID"}
            placeholder={t("accountIdPlaceholder") || "Enter account ID hash"}
            onChange={(v) => setInspectAccountId(v)}
          />
          <div className="actions-row">
            <NeoButton
              variant="primary"
              loading={isInspecting}
              aria-label={t("inspect") || "Inspect"}
              onClick={() => dispatch("inspect", inspectAccountId)}
            >
              {t("inspect") || "Inspect"}
            </NeoButton>
            <NeoButton
              variant="secondary"
              aria-label={t("connectWallet") || "Connect Wallet"}
              onClick={() => dispatch("connect")}
            >
              {t("connectWallet") || "Connect Wallet"}
            </NeoButton>
          </div>
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

      {/* Register Section */}
      <NeoCard variant="erobo" title={t("registerTitle") || "Register Account"}>
        <div className="field-stack">
          <NeoInput
            value={registerAccountId}
            label={t("accountId") || "Account ID"}
            placeholder={t("accountIdPlaceholder") || "Enter account ID hash"}
            onChange={(v) => setRegisterAccountId(v)}
          />
          <NeoInput
            value={verifierHash}
            label={t("verifier") || "Verifier Hash"}
            placeholder={t("verifierPlaceholder") || "0x..."}
            onChange={(v) => setVerifierHash(v)}
          />
          <NeoInput
            value={verifierParamsHex}
            label={t("verifierParams") || "Verifier Params (hex)"}
            placeholder={t("verifierParamsPlaceholder") || "0x..."}
            onChange={(v) => setVerifierParamsHex(v)}
          />
          <NeoInput
            value={hookHash}
            label={t("hook") || "Hook Hash"}
            placeholder={t("hookPlaceholder") || "0x..."}
            onChange={(v) => setHookHash(v)}
          />
          <NeoInput
            value={backupOwner}
            label={t("backupOwner") || "Backup Owner"}
            placeholder={t("backupOwnerPlaceholder") || "NeoAddress..."}
            onChange={(v) => setBackupOwner(v)}
          />
          <NeoInput
            value={escapeTimelock}
            label={t("timelock") || "Escape Timelock (seconds)"}
            placeholder={t("timelockPlaceholder") || "2592000"}
            onChange={(v) => setEscapeTimelock(v)}
          />
          <NeoButton
            variant="primary"
            loading={isSubmitting}
            aria-label={t("register") || "Register"}
            onClick={() =>
              dispatch(
                "register",
                registerAccountId,
                verifierHash,
                verifierParamsHex,
                hookHash,
                backupOwner,
                escapeTimelock,
              )
            }
          >
            {t("register") || "Register"}
          </NeoButton>
        </div>
      </NeoCard>
    </div>
  );
}
