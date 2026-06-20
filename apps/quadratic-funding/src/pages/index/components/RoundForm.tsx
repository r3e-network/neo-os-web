import { useEffect, useState } from "react";
import {
  CalendarClock,
  CircleDollarSign,
  Gauge,
  HandCoins,
  Landmark,
  Sparkles,
} from "lucide-react";
import { NeoCard, NeoInput, NeoButton } from "@shared/components-react";

interface RoundFormProps {
  onSubmit: (...args: unknown[]) => void;
  t: (key: string) => string;
  loading?: boolean;
  /** Incremented by the parent after a successful create to clear the fields. */
  resetKey?: number;
}

export default function RoundForm({
  onSubmit,
  t,
  loading = false,
  resetKey = 0,
}: RoundFormProps) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [asset, setAsset] = useState("GAS");
  const [matchingPool, setMatchingPool] = useState("");
  const [startTime, setStartTime] = useState("");
  const [endTime, setEndTime] = useState("");

  const selectedAssetLabel = asset === "NEO" ? t("assetNeo") : t("assetGas");
  const previewTitle = title.trim() || t("roundTitlePlaceholder");
  const previewPool = matchingPool.trim() || t("matchingPoolPlaceholder");
  const previewWindow =
    startTime.trim() || endTime.trim()
      ? `${startTime.trim() || t("roundStartPlaceholderFriendly")} - ${
          endTime.trim() || t("roundEndPlaceholderFriendly")
        }`
      : t("qfRoundPreviewWindowEmpty");

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
      <div className="qf-round-desk">
        <div className="qf-round-preview" aria-label={t("qfRoundLivePreview")}>
          <div className="qf-round-preview__top">
            <span className="qf-round-preview__badge">
              <Sparkles aria-hidden="true" />
              {t("qfRoundBlueprint")}
            </span>
            <strong>{selectedAssetLabel}</strong>
          </div>
          <div className="qf-round-preview__body">
            <h3>{previewTitle}</h3>
            <p>{description.trim() || t("roundDescriptionPlaceholder")}</p>
          </div>
          <div className="qf-round-preview__stats">
            <span>
              <CircleDollarSign aria-hidden="true" />
              <small>{t("matchingPool")}</small>
              <b>
                {previewPool} {asset}
              </b>
            </span>
            <span>
              <CalendarClock aria-hidden="true" />
              <small>{t("roundSchedule")}</small>
              <b>{previewWindow}</b>
            </span>
          </div>
          <div className="qf-mechanic-note" role="note">
            <Gauge aria-hidden="true" />
            <span>{t("qfMechanicExplainer")}</span>
          </div>
        </div>

        <div className="qf-round-controls">
          <p className="qf-panel-hint">{t("qfCreateDeskIntro")}</p>
          <div className="qf-form-grid">
            <NeoInput
              value={title}
              label={t("roundTitle")}
              placeholder={t("roundTitlePlaceholder")}
              onChange={setTitle}
            />
            <div
              className="qf-asset-segment"
              role="group"
              aria-label={t("assetSelect")}
            >
              {[
                {
                  value: "GAS",
                  label: t("assetGas"),
                  hint: t("qfGasPoolLabel"),
                },
                {
                  value: "NEO",
                  label: t("assetNeo"),
                  hint: t("qfNeoPoolLabel"),
                },
              ].map((option) => (
                <button
                  key={option.value}
                  type="button"
                  className={asset === option.value ? "is-selected" : ""}
                  aria-pressed={asset === option.value}
                  onClick={() => setAsset(option.value)}
                >
                  <Landmark aria-hidden="true" />
                  <span>
                    <strong>{option.label}</strong>
                    <small>{option.hint}</small>
                  </span>
                </button>
              ))}
            </div>
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
              placeholder={t("roundStartPlaceholderFriendly")}
              hint={t("roundDateFormatHint")}
              className="qf-datetime-field"
              onChange={setStartTime}
            />
            <NeoInput
              value={endTime}
              label={t("roundEnd")}
              placeholder={t("roundEndPlaceholderFriendly")}
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
            className="qf-mission-field"
            onChange={setDescription}
          />
          <div className="qf-panel-footer">
            <span className="qf-submit-note">
              <CircleDollarSign aria-hidden="true" />
              {t("matchingPoolHint")}
            </span>
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
              <HandCoins aria-hidden="true" />
              {loading ? t("creatingRound") : t("createRound")}
            </NeoButton>
          </div>
        </div>
      </div>
    </NeoCard>
  );
}
