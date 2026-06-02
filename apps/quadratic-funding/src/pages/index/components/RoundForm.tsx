import { useState } from "react";
import { NeoCard, NeoInput, NeoButton } from "@shared/components-react";

interface RoundFormProps {
  onSubmit: (...args: unknown[]) => void;
  t: (key: string) => string;
}

export default function RoundForm({ onSubmit, t }: RoundFormProps) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [matchingPool, setMatchingPool] = useState("");
  const [startTime, setStartTime] = useState("");
  const [endTime, setEndTime] = useState("");

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
          onChange={setStartTime}
        />
        <NeoInput
          value={endTime}
          label={t("roundEnd")}
          placeholder={t("roundEndPlaceholder")}
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
          onClick={() =>
            onSubmit({
              title,
              description,
              asset: "GAS",
              matchingPool,
              startTime,
              endTime,
            })
          }
        >
          {t("createRound")}
        </NeoButton>
      </div>
    </NeoCard>
  );
}
