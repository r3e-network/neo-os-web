/**
 * PlayArea.tsx — Memorial Shrine
 *
 * Full interactive memorial console: garden hero, obituary rail,
 * memorial wall, creation studio, and tribute station.
 */

import { useState } from "react";
import {
  Apple,
  CalendarDays,
  Flame,
  Flower2,
  Heart,
  Image as ImageIcon,
  Plus,
  ScrollText,
  Share2,
  ShieldCheck,
  Sprout,
  Utensils,
  Wine,
  X,
  type LucideIcon,
} from "lucide-react";
import { NeoButton, NeoCard, NeoInput } from "@shared/components-react";
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

  const defaultOffering = { value: "1", costGas: "0.01 GAS", label: t("incense") };
  const offeringOptions = [
    defaultOffering,
    { value: "2", costGas: "0.02 GAS", label: t("candle") },
    { value: "3", costGas: "0.03 GAS", label: t("flower") },
    { value: "4", costGas: "0.05 GAS", label: t("fruit") },
    { value: "5", costGas: "0.10 GAS", label: t("wine") },
    { value: "6", costGas: "0.50 GAS", label: t("feast") },
  ];
  const selectedOffering =
    offeringOptions.find((item) => item.value === tributeOfferingType) ?? defaultOffering;
  const offeringVisuals: Record<string, LucideIcon> = {
    "1": Sprout,
    "2": Flame,
    "3": Flower2,
    "4": Apple,
    "5": Wine,
    "6": Utensils,
  };
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
  const previewPhotoSrc = resolvePhotoSrc(formPhotoHash);
  const previewName = formName.trim() || t("previewEmptyName");
  const previewRelation = formRelationship.trim() || t("previewRelationEmpty");
  const previewYears =
    birthYearRaw || deathYearRaw
      ? `${birthYearRaw || "----"}-${deathYearRaw || "----"}`
      : t("previewDatesEmpty");
  const previewBio = formBiography.trim() || t("previewBioEmpty");
  const previewObituary = formObituary.trim() || t("previewObituaryEmpty");
  const canPayTribute = !isMainnet || tributeReceiptId.trim().length > 0;

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
    if (!canPayTribute) return;
    await dispatch("payTribute", memorialId, parseInt(tributeOfferingType, 10), tributeMessage, tributeReceiptId);
    setTributeMessage("");
    setTributeReceiptId("");
  };

  return (
    <div className="memorial-play-area">
      <div className="shrine-hero">
        <img className="shrine-hero__image" src="./memorial-garden.jpg" alt={t("gardenAlt")} />
        <div className="shrine-hero__shade" aria-hidden="true" />
        <div className="shrine-hero__content">
          <span className="shrine-hero__eyebrow">{t("heroKicker")}</span>
          <h2 className="shrine-hero__title">{t("title")}</h2>
          <p className="shrine-hero__subtitle">{t("subtitle")}</p>
          <div className="shrine-hero__signals" aria-label={t("chainPermanence")}>
            <span>
              <ShieldCheck size={15} strokeWidth={2} aria-hidden="true" />
              {t("chainPermanence")}
            </span>
            <span>{memorialCount} {t("memorials")}</span>
            <span>{tributeCount} {t("myTributes")}</span>
            <span>{visitedMemorials.length} {t("visited")}</span>
          </div>
          <NeoButton
            variant="primary"
            className="shrine-hero__cta"
            onClick={() => setShowCreateForm((current) => !current)}
            aria-label={showCreateForm ? t("cancel") : t("createMemorial")}
          >
            {showCreateForm ? <X size={16} strokeWidth={2.2} aria-hidden="true" /> : <Plus size={16} strokeWidth={2.2} aria-hidden="true" />}
            {showCreateForm ? t("cancel") : t("createMemorial")}
          </NeoButton>
        </div>
        {lastTx?.txid && (
          <div className="chain-receipt" aria-live="polite">
            <span>{t("lastTransaction")}</span>
            <strong>{lastTx.txid}</strong>
          </div>
        )}
      </div>

      {recentObituaries.length > 0 && (
        <div className="obituary-banner">
          <div className="banner-title">
            <ScrollText size={16} strokeWidth={2} aria-hidden="true" />
            <span>{t("obituaries")}</span>
          </div>
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

      {selectedMemorial && (
        <NeoCard variant="erobo" className="detail-card memorial-focus">
          <div className="detail-header">
            <div className="detail-portrait" aria-hidden="true">
              {selectedPhotoSrc ? (
                <img
                  className="detail-photo"
                  src={selectedPhotoSrc}
                  alt=""
                  loading="lazy"
                  onError={(event) => {
                    event.currentTarget.style.display = "none";
                  }}
                />
              ) : (
                <Heart size={25} strokeWidth={1.9} />
              )}
            </div>
            <div className="detail-identity">
              <span className="detail-kicker">{t("foreverRemember")}</span>
              <span className="detail-name">{selectedMemorialName}</span>
              {selectedMemorialYears && (
                <span className="detail-years">
                  <CalendarDays size={14} strokeWidth={2} aria-hidden="true" />
                  {selectedMemorialYears}
                </span>
              )}
            </div>
            <div className="detail-actions">
              <NeoButton
                variant="ghost"
                className="detail-action"
                onClick={() => dispatch("shareMemorial", selectedMemorial.id)}
                aria-label={t("shareMemorial")}
              >
                <Share2 size={15} strokeWidth={2.2} aria-hidden="true" />
                {t("share")}
              </NeoButton>
              <NeoButton
                variant="ghost"
                className="detail-action"
                onClick={() => dispatch("closeMemorial")}
                aria-label={t("close")}
              >
                <X size={15} strokeWidth={2.2} aria-hidden="true" />
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
          <div className="tribute-station">
            <div className="tribute-station__head">
              <div>
                <span className="tribute-title">{t("payTribute")}</span>
                <p>{t("tributeStationDesc")}</p>
              </div>
              <div className="offering-cost-card" aria-label={t("offeringCost")}>
                <span>{t("offeringCost")}</span>
                <strong>{selectedOffering.costGas}</strong>
              </div>
            </div>
            <NeoInput
              value={tributeMessage}
              label={t("tributeMessage")}
              placeholder={t("tributeMessagePlaceholder")}
              className="tribute-message-input"
              onChange={setTributeMessage}
            />
            <div className="offering-tray" role="radiogroup" aria-label={t("selectOffering")}>
              {offeringOptions.map((option) => {
                const Icon = offeringVisuals[option.value] ?? Sprout;
                const isSelected = option.value === tributeOfferingType;
                return (
                  <button
                    key={option.value}
                    type="button"
                    className={`offering-option${isSelected ? " is-selected" : ""}`}
                    role="radio"
                    aria-checked={isSelected}
                    onClick={() => setTributeOfferingType(option.value)}
                  >
                    <span className="offering-option__icon" aria-hidden="true">
                      <Icon size={17} strokeWidth={2} />
                    </span>
                    <span className="offering-option__label">{option.label}</span>
                    <span className="offering-option__cost">{option.costGas}</span>
                  </button>
                );
              })}
            </div>
            <p className="tribute-disclosure" role="note">{t("offeringDisclosure")}</p>
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
            <NeoButton
              variant="primary"
              loading={isPaying}
              disabled={!canPayTribute}
              className="tribute-submit"
              onClick={() => handlePayTribute(selectedMemorial.id)}
              aria-label={t("payTribute")}
            >
              <Heart size={16} strokeWidth={2.2} aria-hidden="true" />
              {t("payTribute")}
            </NeoButton>
          </div>
        </NeoCard>
      )}

      {showCreateForm && (
        <section className="memorial-studio" aria-label={t("memoryStudio")}>
          <div className="create-form-panel">
            <div className="create-form__head">
              <span>{t("memoryStudio")}</span>
              <p>{t("createDesc")}</p>
            </div>
            <div className="studio-step">
              <span className="studio-step__index">01</span>
              <span>{t("studioStepIdentity")}</span>
            </div>
            <div className="field-grid">
              <NeoInput value={formName} label={t("labelName")} placeholder={t("placeholderName")} onChange={setFormName} />
              <NeoInput value={formRelationship} label={t("labelRelation")} placeholder={t("placeholderRelation")} onChange={setFormRelationship} />
              <NeoInput value={formPhotoHash} label={t("labelPhoto")} placeholder={t("photoHashPlaceholder")} hint={t("photoUrlHelper")} onChange={setFormPhotoHash} />
              <div className="year-row">
                <NeoInput value={formBirthYear} label={t("labelBirth")} placeholder={t("placeholderBirthYear")} onChange={setFormBirthYear} />
                <NeoInput value={formDeathYear} label={t("labelDeath")} placeholder={t("placeholderDeathYear")} onChange={setFormDeathYear} />
              </div>
            </div>
            {(birthYearError || deathYearError) && (
              <p className="field-error" role="alert">
                {deathYearError || birthYearError}
              </p>
            )}
            <div className="studio-mobile-publish">
              <NeoButton variant="primary" loading={isSubmitting} disabled={!canCreateMemorial} onClick={handleCreate} aria-label={t("createMemorial")}>
                <Plus size={16} strokeWidth={2.2} aria-hidden="true" />
                {t("createMemorial")}
              </NeoButton>
              <span>{t("studioStepPublish")}</span>
            </div>
            <div className="studio-step">
              <span className="studio-step__index">02</span>
              <span>{t("studioStepStory")}</span>
            </div>
            <div className="story-grid">
              <NeoInput value={formBiography} type="textarea" label={t("labelBio")} placeholder={t("placeholderBio")} onChange={setFormBiography} />
              <NeoInput value={formObituary} type="textarea" label={t("labelObituary")} placeholder={t("placeholderObituary")} onChange={setFormObituary} />
            </div>
            <div className="studio-publish">
              <div className="studio-step studio-step--publish">
                <span className="studio-step__index">03</span>
                <span>{t("studioStepPublish")}</span>
              </div>
              <NeoButton variant="primary" loading={isSubmitting} disabled={!canCreateMemorial} onClick={handleCreate} aria-label={t("createMemorial")}>
                <Plus size={16} strokeWidth={2.2} aria-hidden="true" />
                {t("createMemorial")}
              </NeoButton>
            </div>
          </div>

          <div className="studio-preview">
            <div className="studio-preview__media">
              {previewPhotoSrc ? (
                <img
                  src={previewPhotoSrc}
                  alt=""
                  onError={(event) => {
                    event.currentTarget.style.display = "none";
                  }}
                />
              ) : (
                <ImageIcon size={24} strokeWidth={1.9} aria-hidden="true" />
              )}
            </div>
            <span className="studio-preview__label">{t("previewLabel")}</span>
            <strong>{previewName}</strong>
            <span className="studio-preview__years">{previewYears}</span>
            <span className="studio-preview__relation">{previewRelation}</span>
            <p>{previewBio}</p>
            <blockquote>{previewObituary}</blockquote>
          </div>
        </section>
      )}

      {memorials.length > 0 ? (
        <section className="memorials-section">
          <div className="section-heading">
            <span className="section-eyebrow">{t("memorials")}</span>
            <span>{t("chainPermanenceDesc")}</span>
          </div>
          <div className="memorials-grid">
            {memorials.map((memorial) => (
              <TombstoneCard key={memorial.id} memorial={memorial} onClick={() => dispatch("openMemorial", memorial.id)} t={t} />
            ))}
          </div>
        </section>
      ) : (
        <div className="empty-memorials">
          <span className="empty-memorials__badge" aria-hidden="true">
            <Heart size={27} strokeWidth={1.8} />
          </span>
          <p>{t("noMemorials")}</p>
          {!showCreateForm && (
            <NeoButton
              variant="ghost"
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
