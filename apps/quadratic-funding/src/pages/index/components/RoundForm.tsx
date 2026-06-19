import { useEffect, useState } from "react";
import { NeoCard, NeoInput, NeoButton, NeoSelect } from "@shared/components-react";

interface RoundFormProps {
  onSubmit: (...args: unknown[]) => void;
  t: (key: string) => string;
  loading?: boolean;
  /** Incremented by the parent after a successful create to clear the fields. */
  resetKey?: number;
}

export default function RoundForm({ onSubmit, t, loading = false, resetKey = 0 }: RoundFormProps) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [asset, setAsset] = useState("GAS");
  const [matchingPool, setMatchingPool] = useState("");
  const [startTime, setStartTime] = useState("");
  const [endTime, setEndTime] = useState("");

  // Clear the form only when the parent confirms a successful round creation
  // (resetKey changes); the initial 0 value is skipped so fields aren't wiped
  // on first render.
  useEffect(() => {
    if (resetKey === 0) return;
    setTitle("");
    setDescription("");
    setAsset("GAS");
    setMatchingPool("");
    setStartTime("");
    setEndTime("");
  }, [resetKey]);

  return (
    <NeoCard title={t("createRound")} className="qf-form-panel">
      {/* Surface the quadratic mechanic before the Contribute tab: matching
          rewards donor breadth, not the largest single cheque. */}
      <div className="qf-mechanic-note" role="note">
        <span className="qf-mechanic-note__icon" aria-hidden="true">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M3 3v18h18" />
            <path d="M7 15l4-5 3 3 4-6" />
          </svg>
        </span>
        <span>{t("qfMechanicExplainer")}</span>
      </div>
      <p className="qf-panel-hint">{t("matchingPoolHint")}</p>
      <div className="qf-form-grid">
        <NeoInput
          value={title}
          label={t("roundTitle")}
          placeholder={t("roundTitlePlaceholder")}
          onChange={setTitle}
        />
        <NeoSelect
          value={asset}
          label={t("assetSelect")}
          options={[
            { value: "GAS", label: t("assetGas") },
            { value: "NEO", label: t("assetNeo") },
          ]}
          onChange={setAsset}
        />
        <NeoInput
          value={matchingPool}
          type="number"
          label={t("matchingPool")}
          placeholder={t("matchingPoolPlaceholder")}
          suffix={asset}
          className="qf-amount-field"
          onChange={setMatchingPool}
        />
        <NeoInput
          value={startTime}
          label={t("roundStart")}
          placeholder={t("roundDateFormat")}
          hint={t("roundDateFormatHint")}
          className="qf-datetime-field"
          onChange={setStartTime}
        />
        <NeoInput
          value={endTime}
          label={t("roundEnd")}
          placeholder={t("roundDateFormat")}
          hint={t("roundDateFormatHint")}
          className="qf-datetime-field"
          onChange={setEndTime}
        />
      </div>
      <NeoInput
        value={description}
        type="textarea"
        label={t("roundDescription")}
        placeholder={t("roundDescriptionPlaceholder")}
        onChange={setDescription}
      />
      <div className="qf-panel-footer">
        <NeoButton
          variant="primary"
          loading={loading}
          disabled={loading}
          onClick={() =>
            onSubmit({
              title,
              description,
              asset,
              matchingPool,
              startTime,
              endTime,
            })
          }
        >
          {loading ? t("creatingRound") : t("createRound")}
        </NeoButton>
      </div>
    </NeoCard>
  );
}
