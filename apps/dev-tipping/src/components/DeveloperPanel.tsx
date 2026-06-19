import { useState } from "react";
import { NeoInput, NeoButton } from "@shared/components-react";

interface DeveloperPanelProps {
  /** Whether a wallet is connected (gates registration/withdrawal). */
  connected: boolean;
  /** True while the wallet connect prompt is in flight. */
  isConnecting: boolean;
  /** The devId owned by the connected wallet (0 = not registered). */
  myDeveloperId: number;
  /** That developer's claimable balance in human GAS. */
  claimableBalance: number;
  isRegistering: boolean;
  isWithdrawing: boolean;
  /** Connect the wallet (reuses the app's existing chain.ensureWallet path). */
  onConnect: () => void;
  /** Resolves true on a confirmed registration so inputs clear only on success. */
  onRegister: (name: string, role: string) => Promise<boolean>;
  onWithdraw: () => void;
  formatNum: (n: number | string) => string;
  t: (key: string, params?: Record<string, string | number>) => string;
}

/**
 * DeveloperPanel — developer self-service.
 *
 * Unregistered connected wallets see a register form (name + role → on-chain
 * registerDeveloper). Registered wallets see their devId and, when they have a
 * positive claimable balance, a withdraw action (on-chain withdrawTips).
 */
export default function DeveloperPanel({
  connected,
  isConnecting,
  myDeveloperId,
  claimableBalance,
  isRegistering,
  isWithdrawing,
  onConnect,
  onRegister,
  onWithdraw,
  formatNum,
  t,
}: DeveloperPanelProps) {
  const [name, setName] = useState("");
  const [role, setRole] = useState("");

  if (!connected) {
    return (
      <div className="dev-panel form-group">
        <p className="dev-panel__hint">{t("registerConnectHint")}</p>
        <NeoButton
          variant="primary"
          size="lg"
          block
          loading={isConnecting}
          disabled={isConnecting}
          onClick={onConnect}
        >
          {isConnecting ? t("connecting") : t("connectWallet")}
        </NeoButton>
      </div>
    );
  }

  if (myDeveloperId > 0) {
    return (
      <div className="dev-panel">
        <div className="dev-panel__status">
          <span className="dev-panel__status-label">{t("registeredAs")}</span>
          <span className="dev-panel__status-value">#{myDeveloperId}</span>
        </div>
        <div className="dev-panel__claim">
          <span className="dev-panel__claim-label">{t("claimableBalance")}</span>
          <span className="dev-panel__claim-value">
            {formatNum(claimableBalance)} {t("tokenGas")}
          </span>
        </div>
        <p className="dev-panel__hint">{t("claimableHint")}</p>
        <NeoButton
          variant="primary"
          size="lg"
          block
          loading={isWithdrawing}
          disabled={claimableBalance <= 0 || isWithdrawing}
          onClick={onWithdraw}
        >
          {isWithdrawing
            ? t("withdrawing")
            : claimableBalance > 0
              ? t("withdrawTipsBtn")
              : t("nothingToWithdraw")}
        </NeoButton>
      </div>
    );
  }

  const trimmedName = name.trim();
  const canRegister = trimmedName.length > 0 && trimmedName.length <= 64 && !isRegistering;

  const handleRegister = async () => {
    if (!canRegister) return;
    // Clear the inputs ONLY on a confirmed registration — a failed register
    // (wallet reject / revert) keeps the typed name + role for an easy retry.
    const ok = await onRegister(trimmedName, role.trim());
    if (ok) {
      setName("");
      setRole("");
    }
  };

  return (
    <div className="dev-panel form-group">
      <p className="dev-panel__hint">{t("registerHint")}</p>
      <NeoInput
        value={name}
        label={t("devNameLabel")}
        placeholder={t("devNamePlaceholder")}
        onChange={(v) => setName(v.slice(0, 64))}
      />
      <NeoInput
        value={role}
        label={t("devRoleLabel")}
        placeholder={t("devRolePlaceholder")}
        onChange={(v) => setRole(v.slice(0, 64))}
      />
      <NeoButton
        variant="primary"
        size="lg"
        block
        loading={isRegistering}
        disabled={!canRegister}
        onClick={handleRegister}
      >
        {isRegistering ? t("registering") : t("registerBtn")}
      </NeoButton>
    </div>
  );
}
