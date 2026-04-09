import { useState } from "react";
import { NeoInput, NeoButton } from "@shared/components-react";

interface RoundFormProps { onSubmit: (...args: unknown[]) => void; t: (key: string) => string; }

export default function RoundForm({ onSubmit, t }: RoundFormProps) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [matchingPool, setMatchingPool] = useState("");
  const [startTime, setStartTime] = useState("");
  const [endTime, setEndTime] = useState("");

  return (
    <div className="round-form">
      <NeoInput value={title} label={t("roundTitle")} placeholder={t("roundTitlePlaceholder")} onChange={setTitle} />
      <NeoInput value={description} type="textarea" label={t("roundDescription")} onChange={setDescription} />
      <NeoInput value={matchingPool} type="number" label={t("matchingPool")} onChange={setMatchingPool} />
      <NeoInput value={startTime} label={t("roundStart")} onChange={setStartTime} />
      <NeoInput value={endTime} label={t("roundEnd")} onChange={setEndTime} />
      <NeoButton variant="primary" onClick={() => onSubmit({ title, description, asset: "GAS", matchingPool, startTime, endTime })}>{t("createRound")}</NeoButton>
    </div>
  );
}
