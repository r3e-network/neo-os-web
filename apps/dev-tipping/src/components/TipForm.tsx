import { NeoInput, NeoButton } from "@shared/components-react";
import type { Developer } from "../composables/useDevTippingStats";

interface TipFormProps {
  developers: Developer[]; selectedDevId: number | null; amount: string; message: string;
  tipperName: string; anonymous: boolean; isLoading: boolean;
  onSelectDev: (id: number) => void; onAmountChange: (val: string) => void;
  onMessageChange: (val: string) => void; onTipperNameChange: (val: string) => void;
  onAnonymousChange: (val: boolean) => void; onSubmit: () => void; t: (key: string) => string;
}

export default function TipForm({ developers, selectedDevId, amount, message, tipperName, anonymous, isLoading, onSelectDev, onAmountChange, onMessageChange, onTipperNameChange, onAnonymousChange, onSubmit, t }: TipFormProps) {
  const canSubmit = selectedDevId !== null && amount && !isLoading;
  return (
    <div className="form-group">
      <div className="dev-selector">
        {developers.map((dev) => (
          <button key={dev.id} type="button" className={`dev-select-item-glass${selectedDevId === dev.id ? " active" : ""}`} onClick={() => onSelectDev(dev.id)}>
            <span className="dev-select-name-glass">{dev.name}</span>
            <span className="dev-select-role-glass">{dev.role}</span>
          </button>
        ))}
      </div>
      <NeoInput value={amount} type="number" label={t("tipAmount")} placeholder={t("customAmount")} onChange={onAmountChange} />
      <NeoInput value={message} label={t("optionalMessage")} placeholder={t("messagePlaceholder")} onChange={onMessageChange} />
      <NeoInput value={tipperName} label={t("tipperName")} placeholder={t("tipperNamePlaceholder")} disabled={anonymous} onChange={onTipperNameChange} />
      <div className="toggle-row">
        <NeoButton size="sm" variant={anonymous ? "primary" : "secondary"} onClick={() => onAnonymousChange(true)}>{t("anonymousOn")}</NeoButton>
        <NeoButton size="sm" variant={anonymous ? "secondary" : "primary"} onClick={() => onAnonymousChange(false)}>{t("anonymousOff")}</NeoButton>
      </div>
      <NeoButton variant="primary" size="lg" block loading={isLoading} disabled={!canSubmit} onClick={onSubmit}>
        {isLoading ? t("sending") : t("sendTipBtn")}
      </NeoButton>
    </div>
  );
}
