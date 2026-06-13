/**
 * PlayArea.tsx — Memorial Shrine
 *
 * Full interactive memorial console: stats bar, obituary banner,
 * memorial grid with TombstoneCards, create form, and tribute panel.
 */

import { useState } from "react";
import { NeoButton, NeoCard, NeoInput, NeoSelect } from "@shared/components-react";
import { useStateBindings } from "@shared/react/hooks/useStateBindings";
import type { Observable } from "@shared/react/context";
import TombstoneCard, { resolvePhotoSrc } from "./pages/index/components/TombstoneCard";
import "./PlayArea.scss";

/** Offering tallies in on-chain order, paired with their i18n label keys. */
const OFFERING_FIELDS: ReadonlyArray<{ key: string; labelKey: string }> = [
  { key: "incense", labelKey: "incense" },
  { key: "candle", labelKey: "candle" },
  { key: "flower", labelKey: "flower" },
  { key: "fruit", labelKey: "fruit" },
  { key: "wine", labelKey: "wine" },
  { key: "feast", labelKey: "feast" },
];

interface PlayAreaProps {
  t: (key: string, params?: Record<string, string | number>) => string;
  state: Record<string, Observable>;
  dispatch: (name: string, ...args: unknown[]) => Promise<void>;
  launchContext?: { network?: "mainnet" | "testnet" | null };
}

export default function PlayArea({ t, state, dispatch, launchContext }: PlayAreaProps) {
  const { num, bool } = useStateBindings(state);

  const memorials = (state.memorials?.get() ?? []) as Array<{ id: number; name?: string; [key: string]: unknown }>;
  const visitedMemorials = (state.visitedMemorials?.get() ?? []) as Array<{ id: number; [key: string]: unknown }>;
  const recentObituaries = (state.recentObituaries?.get() ?? []) as Array<{ id: number; name: string; text: string }>;
  const selectedMemorial = state.selectedMemorial?.get() as {
    id: number;
    name?: string;
    photoHash?: string;
    offerings?: Record<string, number>;
    [key: string]: unknown;
  } | null;
  const shareStatus = (state.shareStatus?.get() ?? null) as string | null;
  const lastTx = state.lastTx?.get() as { txid?: string } | null;
  const memorialCount = num("memorialCount");
  const tributeCount = num("tributeCount");
  const obituaryCount = num("obituaryCount");
  const isSubmitting = bool("isSubmitting");
  const isPaying = bool("isPaying");

  const [showCreateForm, setShowCreateForm] = useState(false);
  const [formName, setFormName] = useState("");
  const [formPhotoHash, setFormPhotoHash] = useState("");
  const [formRelationship, setFormRelationship] = useState("");
  const [formBirthYear, setFormBirthYear] = useState("");
  const [formDeathYear, setFormDeathYear] = useState("");
  const [formBiography, setFormBiography] = useState("");
  const [formObituary, setFormObituary] = useState("");

  const [tributeMessage, setTributeMessage] = useState("");
  const [tributeOfferingType, setTributeOfferingType] = useState("1");
  const [tributeReceiptId, setTributeReceiptId] = useState("");
  const isMainnet = launchContext?.network === "mainnet";

  const defaultOffering = { value: "1", costGas: "0.01 GAS", label: `${t("incense")} · 0.01 GAS` };
  const offeringOptions = [
    defaultOffering,
    { value: "2", costGas: "0.02 GAS", label: `${t("candle")} · 0.02 GAS` },
    { value: "3", costGas: "0.03 GAS", label: `${t("flower")} · 0.03 GAS` },
    { value: "4", costGas: "0.05 GAS", label: `${t("fruit")} · 0.05 GAS` },
    { value: "5", costGas: "0.10 GAS", label: `${t("wine")} · 0.10 GAS` },
    { value: "6", costGas: "0.50 GAS", label: `${t("feast")} · 0.50 GAS` },
  ];
  const selectedOffering =
    offeringOptions.find((item) => item.value === tributeOfferingType) ?? defaultOffering;
  const currentYear = new Date().getFullYear();
  const birthYearRaw = formBirthYear.trim();
  const deathYearRaw = formDeathYear.trim();
  const parsedDeathYear = parseInt(formDeathYear, 10);
  const parsedBirthYear = parseInt(formBirthYear, 10);
  const deathYearDigits = /^\d+$/.test(deathYearRaw) && parsedDeathYear > 0;
  const birthYearDigits = birthYearRaw === "" || (/^\d+$/.test(birthYearRaw) && parsedBirthYear > 0);
  const deathYearValid = deathYearDigits && parsedDeathYear <= currentYear;
  const birthYearValid =
    birthYearRaw === "" ||
    (birthYearDigits && parsedBirthYear <= currentYear);
  const yearOrderValid =
    birthYearRaw === "" || !deathYearDigits || parsedBirthYear <= parsedDeathYear;
  // Inline feedback: only surface an error once the user has typed something.
  const deathYearError = deathYearRaw === ""
    ? ""
    : !deathYearDigits
      ? t("yearInvalid")
      : parsedDeathYear > currentYear
        ? t("yearFuture")
        : "";
  const birthYearError = birthYearRaw === ""
    ? ""
    : !/^\d+$/.test(birthYearRaw) || parsedBirthYear <= 0
      ? t("yearInvalid")
      : parsedBirthYear > currentYear
        ? t("yearFuture")
        : !yearOrderValid
          ? t("yearOrder")
          : "";
  const canCreateMemorial =
    formName.trim().length > 0 && deathYearValid && birthYearValid && yearOrderValid;
  const selectedMemorialName = selectedMemorial?.name ? String(selectedMemorial.name) : t("unnamed");
  const selectedMemorialYears =
    selectedMemorial?.birthYear && selectedMemorial?.deathYear
      ? `${String(selectedMemorial.birthYear)}-${String(selectedMemorial.deathYear)}`
      : "";
  const selectedMemorialBio = selectedMemorial?.biography ? String(selectedMemorial.biography) : "";
  const selectedPhotoSrc = resolvePhotoSrc(selectedMemorial?.photoHash);
  const selectedOfferings = selectedMemorial?.offerings ?? {};
  const selectedPaidOfferings = OFFERING_FIELDS.filter(
    (field) => Number(selectedOfferings[field.key]) > 0,
  );

  const handleCreate = async () => {
    if (!canCreateMemorial) return;
    await dispatch("createMemorial", {
      name: formName,
      photoHash: formPhotoHash,
      relationship: formRelationship,
      birthYear: parseInt(formBirthYear, 10) || 0,
      deathYear: parseInt(formDeathYear, 10) || 0,
      biography: formBiography,
      obituary: formObituary,
    });
    setShowCreateForm(false);
    setFormName(""); setFormPhotoHash(""); setFormRelationship("");
    setFormBirthYear(""); setFormDeathYear(""); setFormBiography(""); setFormObituary("");
  };

  const handlePayTribute = async (memorialId: number) => {
    await dispatch("payTribute", memorialId, parseInt(tributeOfferingType, 10), tributeMessage, tributeReceiptId);
    setTributeMessage("");
    setTributeReceiptId("");
  };

  return (
    <div className="memorial-play-area">
      {/* Hero: identity + stats strip in one white card */}
      <div className="shrine-hero">
        <div className="shrine-hero__head">
          <span className="shrine-hero__badge" aria-hidden="true">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 21s-6.5-4.35-9-8.5C1.5 9.5 3 6 6.5 6 9 6 10.5 7.5 12 9.5 13.5 7.5 15 6 17.5 6 21 6 22.5 9.5 21 12.5 18.5 16.65 12 21 12 21Z" />
            </svg>
          </span>
          <div className="shrine-hero__text">
            <span className="shrine-hero__eyebrow">{t("memorials")}</span>
            <span className="shrine-hero__title">{t("title")}</span>
            <span className="shrine-hero__subtitle">{t("subtitle")}</span>
          </div>
          <NeoButton
            variant="primary"
            className="shrine-hero__cta"
            onClick={() => setShowCreateForm(!showCreateForm)}
            aria-label={showCreateForm ? t("cancel") : t("createMemorial")}
          >
            {showCreateForm ? t("cancel") : t("createMemorial")}
          </NeoButton>
        </div>
        <div className="shrine-hero__stats">
          <div className="stat-chip">
            <span className="stat-value">{memorialCount}</span>
            <span className="stat-label">{t("memorials")}</span>
          </div>
          <div className="stat-chip">
            <span className="stat-value">{tributeCount}</span>
            <span className="stat-label">{t("myTributes")}</span>
          </div>
          <div className="stat-chip">
            <span className="stat-value">{obituaryCount}</span>
            <span className="stat-label">{t("obituaries")}</span>
          </div>
          <div className="stat-chip">
            <span className="stat-value">{visitedMemorials.length}</span>
            <span className="stat-label">{t("visited")}</span>
          </div>
        </div>
        {lastTx?.txid && (
          <div className="chain-receipt" aria-live="polite">
            <span>{t("lastTransaction")}</span>
            <strong>{lastTx.txid}</strong>
          </div>
        )}
      </div>

      {/* Obituary Banner */}
      {recentObituaries.length > 0 && (
        <div className="obituary-banner">
          <span className="banner-title">{t("obituaries")}</span>
          <div className="banner-scroll">
            {recentObituaries.map((ob) => (
              <button key={ob.id} type="button" className="obituary-item" aria-label={ob.name}
                onClick={() => dispatch("openMemorial", ob.id)}>
                <span className="name">{ob.name}</span>
                <span className="text">{ob.text}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Selected Memorial Detail */}
      {selectedMemorial && (
        <NeoCard variant="erobo" className="detail-card">
          <div className="detail-header">
            {selectedPhotoSrc && (
              <img
                className="detail-photo"
                src={selectedPhotoSrc}
                alt=""
                loading="lazy"
                onError={(event) => {
                  event.currentTarget.style.display = "none";
                }}
              />
            )}
            <span className="detail-name">{selectedMemorialName}</span>
            {selectedMemorialYears && (
              <span className="detail-years">{selectedMemorialYears}</span>
            )}
            <div className="detail-actions">
              <NeoButton
                variant="ghost"
                className="detail-action"
                onClick={() => dispatch("shareMemorial", selectedMemorial.id)}
                aria-label={t("shareMemorial")}
              >
                {t("share")}
              </NeoButton>
              <NeoButton
                variant="ghost"
                className="detail-action"
                onClick={() => dispatch("closeMemorial")}
                aria-label={t("close")}
              >
                {t("close")}
              </NeoButton>
            </div>
          </div>
          {shareStatus && (
            <p className="detail-share-status" aria-live="polite">{shareStatus}</p>
          )}
          {selectedMemorialBio && (
            <p className="detail-bio">{selectedMemorialBio}</p>
          )}
          {selectedPaidOfferings.length > 0 && (
            <div className="detail-offerings">
              <span className="detail-offerings__title">{t("offeringsReceived")}</span>
              <div className="detail-offerings__tallies">
                {selectedPaidOfferings.map((field) => (
                  <span key={field.key} className="detail-offering-tally">
                    <span className="detail-offering-tally__label">{t(field.labelKey)}</span>
                    <span className="detail-offering-tally__count">{Number(selectedOfferings[field.key])}</span>
                  </span>
                ))}
              </div>
            </div>
          )}
          <div className="tribute-form">
            <span className="tribute-title">{t("payTribute")}</span>
            <NeoInput value={tributeMessage} label={t("tributeMessage")} placeholder={t("tributeMessagePlaceholder")} onChange={setTributeMessage} />
            <div className="tribute-row">
              <NeoSelect
                value={tributeOfferingType}
                label={t("offeringType")}
                options={offeringOptions}
                onChange={setTributeOfferingType}
              />
              <div className="offering-cost-card" aria-label={t("offeringCost")}>
                <span>{t("offeringCost")}</span>
                <strong>{selectedOffering.costGas}</strong>
              </div>
            </div>
            {isMainnet && (
              <>
                <p className="tribute-mainnet-note" role="note">{t("mainnetTributeNote")}</p>
                <NeoInput
                  value={tributeReceiptId}
                  label={t("receiptId")}
                  placeholder={t("receiptIdPlaceholder")}
                  onChange={setTributeReceiptId}
                />
              </>
            )}
            <NeoButton variant="primary" loading={isPaying} onClick={() => handlePayTribute(selectedMemorial.id)} aria-label={t("payTribute")}>
              {t("payTribute")}
            </NeoButton>
          </div>
        </NeoCard>
      )}

      {/* Create Memorial */}
      {showCreateForm && (
        <NeoCard variant="erobo" className="create-form-card">
          <div className="create-form">
            <div className="create-form__head">
              <span>{t("createTitle")}</span>
              <p>{t("createDesc")}</p>
            </div>
            <NeoInput value={formName} label={t("labelName")} placeholder={t("placeholderName")} onChange={setFormName} />
            <NeoInput value={formPhotoHash} label={t("labelPhoto")} placeholder={t("photoHashPlaceholder")} onChange={setFormPhotoHash} />
            <NeoInput value={formRelationship} label={t("labelRelation")} placeholder={t("placeholderRelation")} onChange={setFormRelationship} />
            <div className="year-row">
              <NeoInput value={formBirthYear} label={t("labelBirth")} placeholder={t("placeholderBirthYear")} onChange={setFormBirthYear} />
              <NeoInput value={formDeathYear} label={t("labelDeath")} placeholder={t("placeholderDeathYear")} onChange={setFormDeathYear} />
            </div>
            {(birthYearError || deathYearError) && (
              <p className="field-error" role="alert">
                {deathYearError || birthYearError}
              </p>
            )}
            <NeoInput value={formBiography} type="textarea" label={t("labelBio")} placeholder={t("placeholderBio")} onChange={setFormBiography} />
            <NeoInput value={formObituary} type="textarea" label={t("labelObituary")} placeholder={t("placeholderObituary")} onChange={setFormObituary} />
            <NeoButton variant="primary" loading={isSubmitting} disabled={!canCreateMemorial} onClick={handleCreate} aria-label={t("createMemorial")}>
              {t("createMemorial")}
            </NeoButton>
          </div>
        </NeoCard>
      )}

      {/* Memorial Grid */}
      {memorials.length > 0 ? (
        <section className="memorials-section">
          <span className="section-eyebrow">{t("memorials")}</span>
          <div className="memorials-grid">
            {memorials.map((memorial) => (
              <TombstoneCard key={memorial.id} memorial={memorial} onClick={() => dispatch("openMemorial", memorial.id)} t={t} />
            ))}
          </div>
        </section>
      ) : (
        <div className="empty-memorials">
          <span className="empty-memorials__badge" aria-hidden="true">
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 21s-6.5-4.35-9-8.5C1.5 9.5 3 6 6.5 6 9 6 10.5 7.5 12 9.5 13.5 7.5 15 6 17.5 6 21 6 22.5 9.5 21 12.5 18.5 16.65 12 21 12 21Z" />
            </svg>
          </span>
          <p>{t("noMemorials")}</p>
          {!showCreateForm && (
            <NeoButton
              variant="secondary"
              size="sm"
              className="empty-memorials__cta"
              onClick={() => setShowCreateForm(true)}
            >
              {t("createMemorial")}
            </NeoButton>
          )}
        </div>
      )}
    </div>
  );
}
