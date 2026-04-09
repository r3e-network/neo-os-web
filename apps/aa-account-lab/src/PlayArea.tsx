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
  const currentVerifier = str("currentVerifier", t("notAvailable"));
  const currentHook = str("currentHook", t("notAvailable"));
  const currentBackupOwner = str("currentBackupOwner", t("notAvailable"));
  const aaCore = str("aaCoreDisplay");

  // Local form state
  const [inspectAccountId, setInspectAccountId] = useState("");
  const [registerAccountId, setRegisterAccountId] = useState("");
  const [verifierHash, setVerifierHash] = useState(str("defaultVerifierDisplay") || "");
  const [verifierParamsHex, setVerifierParamsHex] = useState("");
  const [hookHash, setHookHash] = useState("");
  const [backupOwner, setBackupOwner] = useState("");
  const [escapeTimelock, setEscapeTimelock] = useState("2592000");

  const detailItems = [
    { label: t("currentVerifier"), value: currentVerifier },
    { label: t("currentHook"), value: currentHook },
    { label: t("currentBackupOwner"), value: currentBackupOwner },
    { label: t("aaCore"), value: aaCore },
  ];

  return (
    <div className="aa-account-play-area">
      {/* Inspector Section */}
      <NeoCard variant="erobo" title={t("inspectorTitle")}>
        <div className="field-stack">
          <NeoInput
            value={inspectAccountId}
            label={t("accountId")}
            placeholder={t("accountIdPlaceholder")}
            onChange={(val) => setInspectAccountId(val)}
          />
          <div className="actions-row">
            <NeoButton variant="primary" loading={isInspecting} aria-label={t("inspect")} onClick={() => dispatch("inspect", inspectAccountId)}>
              {t("inspect")}
            </NeoButton>
            <NeoButton variant="secondary" aria-label={t("connectWallet")} onClick={() => dispatch("connect")}>
              {t("connectWallet")}
            </NeoButton>
          </div>
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

      {/* Register Section */}
      <NeoCard variant="erobo" title={t("registerTitle")}>
        <div className="field-stack">
          <NeoInput value={registerAccountId} label={t("accountId")} placeholder={t("accountIdPlaceholder")} onChange={(val) => setRegisterAccountId(val)} />
          <NeoInput value={verifierHash} label={t("verifier")} placeholder={t("verifierPlaceholder")} onChange={(val) => setVerifierHash(val)} />
          <NeoInput value={verifierParamsHex} label={t("verifierParams")} placeholder={t("verifierParamsPlaceholder")} onChange={(val) => setVerifierParamsHex(val)} />
          <NeoInput value={hookHash} label={t("hook")} placeholder={t("hookPlaceholder")} onChange={(val) => setHookHash(val)} />
          <NeoInput value={backupOwner} label={t("backupOwner")} placeholder={t("backupOwnerPlaceholder")} onChange={(val) => setBackupOwner(val)} />
          <NeoInput value={escapeTimelock} label={t("timelock")} placeholder={t("timelockPlaceholder")} onChange={(val) => setEscapeTimelock(val)} />
          <NeoButton variant="primary" loading={isSubmitting} aria-label={t("register")} onClick={() => dispatch("register", registerAccountId, verifierHash, verifierParamsHex, hookHash, backupOwner, escapeTimelock)}>
            {t("register")}
          </NeoButton>
        </div>
      </NeoCard>
    </div>
  );
}
