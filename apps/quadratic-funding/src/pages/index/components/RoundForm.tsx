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
          onChange={setMatchingPool}
        />
        <NeoInput
          value={startTime}
          label={t("roundStart")}
          placeholder={t("roundStartPlaceholder")}
          hint={t("roundStartPlaceholder")}
          className="qf-datetime-field"
          onChange={setStartTime}
        />
        <NeoInput
          value={endTime}
          label={t("roundEnd")}
          placeholder={t("roundEndPlaceholder")}
          hint={t("roundEndPlaceholder")}
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
