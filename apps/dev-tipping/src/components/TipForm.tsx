import { NeoInput, NeoButton } from "@shared/components-react";
import type { Developer } from "../composables/useDevTippingStats";

interface TipFormProps {
  developers: Developer[]; selectedDevId: number | null; amount: string;
  anonymous: boolean; isLoading: boolean;
  onSelectDev: (id: number | null) => void; onAmountChange: (val: string) => void;
  onAnonymousChange: (val: boolean) => void; onSubmit: () => void; t: (key: string) => string;
}

/** First-letter monogram for a developer name; falls back to "#" for empty names. */
function devInitial(name: string): string {
  const trimmed = name.trim();
  return trimmed ? trimmed[0].toUpperCase() : "#";
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
              <span className="dev-select-avatar" aria-hidden="true">{devInitial(dev.name)}</span>
              <span className="dev-select-meta">
                <span className="dev-select-name-glass">{dev.name}</span>
                <span className="dev-select-role-glass">{dev.role}</span>
              </span>
            </button>
          ))}
        </div>
      ) : (
        <div className="dev-id-field">
          <NeoInput
            value={selectedDevId ?? ""}
            type="number"
            label={t("developerId")}
            placeholder={t("developerIdPlaceholder")}
            min={1}
            onChange={handleManualDeveloperId}
          />
          <p className="dev-id-help">{t("developerIdHelp")}</p>
        </div>
      )}
      <NeoInput value={amount} type="number" label={t("tipAmount")} placeholder={t("customAmount")} onChange={onAmountChange} />
      <div className="toggle-field">
        <span className="toggle-field__label">{t("tipVisibility")}</span>
        <div className="toggle-row" role="group" aria-label={t("tipVisibility")}>
          <NeoButton size="sm" variant={anonymous ? "secondary" : "primary"} onClick={() => onAnonymousChange(false)}>{t("anonymousOff")}</NeoButton>
          <NeoButton size="sm" variant={anonymous ? "primary" : "secondary"} onClick={() => onAnonymousChange(true)}>{t("anonymousOn")}</NeoButton>
        </div>
      </div>
      <NeoButton className={!canSubmit && !isLoading ? "neo-btn--idle" : undefined} variant="primary" size="lg" block loading={isLoading} disabled={!canSubmit} onClick={onSubmit}>
        {isLoading ? t("sending") : canSubmit ? t("sendTipBtn") : t("sendTipBtnIdle")}
      </NeoButton>
      {!canSubmit && !isLoading && (
        <p className="tipping-send-hint">{t("sendTipHint")}</p>
      )}
    </div>
  );
}
