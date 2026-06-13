import { NeoInput, NeoButton } from "@shared/components-react";
import type { Developer } from "../composables/useDevTippingStats";

interface TipFormProps {
  developers: Developer[]; selectedDevId: number | null; amount: string;
  anonymous: boolean; isLoading: boolean;
  onSelectDev: (id: number | null) => void; onAmountChange: (val: string) => void;
  onAnonymousChange: (val: boolean) => void; onSubmit: () => void; t: (key: string) => string;
}

// The on-chain Tipped event carries only devId, tipper, amount and anonymous —
// there is no off-chain store for a message or tipper name, so those inputs are
// intentionally omitted (they were silently discarded). The anonymous toggle is
// the only identity control the contract actually honors.
export default function TipForm({ developers, selectedDevId, amount, anonymous, isLoading, onSelectDev, onAmountChange, onAnonymousChange, onSubmit, t }: TipFormProps) {
  const canSubmit = selectedDevId !== null && amount && !isLoading;
  const handleManualDeveloperId = (value: string) => {
    const devId = Number.parseInt(value, 10);
    onSelectDev(Number.isSafeInteger(devId) && devId > 0 ? devId : null);
  };

  return (
    <div className="form-group">
      {developers.length > 0 ? (
        <div className="dev-selector">
          {developers.map((dev) => (
            <button key={dev.id} type="button" className={`dev-select-item-glass${selectedDevId === dev.id ? " active" : ""}`} onClick={() => onSelectDev(dev.id)}>
              <span className="dev-select-name-glass">{dev.name}</span>
              <span className="dev-select-role-glass">{dev.role}</span>
            </button>
          ))}
        </div>
      ) : (
        <NeoInput
          value={selectedDevId ?? ""}
          type="number"
          label={t("developerId")}
          placeholder={t("developerIdPlaceholder")}
          min={1}
          onChange={handleManualDeveloperId}
        />
      )}
      <NeoInput value={amount} type="number" label={t("tipAmount")} placeholder={t("customAmount")} onChange={onAmountChange} />
      <div className="toggle-field">
        <span className="toggle-field__label">{t("anonymousLabel")}</span>
        <div className="toggle-row" role="group" aria-label={t("anonymousLabel")}>
          <NeoButton size="sm" variant={anonymous ? "primary" : "secondary"} onClick={() => onAnonymousChange(true)}>{t("anonymousOn")}</NeoButton>
          <NeoButton size="sm" variant={anonymous ? "secondary" : "primary"} onClick={() => onAnonymousChange(false)}>{t("anonymousOff")}</NeoButton>
        </div>
      </div>
      <NeoButton variant="primary" size="lg" block loading={isLoading} disabled={!canSubmit} onClick={onSubmit}>
        {isLoading ? t("sending") : t("sendTipBtn")}
      </NeoButton>
    </div>
  );
}
