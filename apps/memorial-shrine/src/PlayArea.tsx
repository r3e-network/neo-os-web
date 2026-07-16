/**
 * PlayArea.tsx -- Memorial Shrine.
 *
 * Keeps the primary surface as a memorial garden and tribute altar. The chain
 * actions stay unchanged; long memorial metadata fields live in the drawer.
 */
import { useState } from "react";
import {
  Apple,
  CircleAlert,
  Flame,
  Flower2,
  Image as ImageIcon,
  LoaderCircle,
  PenLine,
  RefreshCw,
  ScrollText,
  Sprout,
  Utensils,
  Wine,
  type LucideIcon,
} from "lucide-react";

import { useStateBindings } from "@shared/react/hooks/useStateBindings";
import type { Observable } from "@shared/react/context";
import { PlayStage } from "@shared/components-react/v2/PlayStage";
import {
  OpenUiLitePanel as OpenUiPanel,
  OpenUiLiteTextArea as OpenUiTextArea,
  OpenUiLiteTextField as OpenUiTextField,
} from "@shared/components-react/v2/OpenUiLite";
import { validateMemorialDraft } from "./logic/memorial-draft";
import "./PlayArea.scss";

interface PlayAreaProps {
  t: (key: string, params?: Record<string, string | number>) => string;
  state: Record<string, Observable>;
  dispatch: (name: string, ...args: unknown[]) => Promise<void>;
  launchContext?: { network?: string | null };
}

interface Memorial {
  id: number;
  name: string;
  birthYear?: number;
  deathYear?: number;
  relationship?: string;
  biography?: string;
  obituary?: string;
  photoHash?: string;
  offerings?: Record<string, number>;
}

interface PendingMemorialWriteView {
  txid: string;
  network: string;
  contractHash: string;
  intent?: { kind?: string };
}

type FormState = {
  name: string;
  relationship: string;
  birthYear: string;
  deathYear: string;
  biography: string;
  obituary: string;
  photoHash: string;
};

const GARDEN_IMAGE = "memorial-garden.webp";
const ALTAR_IMAGE = "shrine-scene-art.webp";

const OFFERINGS: Array<{ type: number; key: string; cost: string; Icon: LucideIcon }> = [
  { type: 1, key: "incense", cost: "0.01", Icon: Sprout },
  { type: 2, key: "candle", cost: "0.02", Icon: Flame },
  { type: 3, key: "flower", cost: "0.03", Icon: Flower2 },
  { type: 4, key: "fruit", cost: "0.05", Icon: Apple },
  { type: 5, key: "wine", cost: "0.10", Icon: Wine },
  { type: 6, key: "feast", cost: "0.50", Icon: Utensils },
];

const MEMORY_PRESETS: Array<{
  key: string;
  labelKey: string;
  relationKey: string;
  bioKey: string;
  Icon: LucideIcon;
}> = [
  {
    key: "family",
    labelKey: "memoryPresetFamily",
    relationKey: "memoryPresetFamilyRelation",
    bioKey: "memoryPresetFamilyBio",
    Icon: Flower2,
  },
  {
    key: "mentor",
    labelKey: "memoryPresetMentor",
    relationKey: "memoryPresetMentorRelation",
    bioKey: "memoryPresetMentorBio",
    Icon: ScrollText,
  },
  {
    key: "friend",
    labelKey: "memoryPresetFriend",
    relationKey: "memoryPresetFriendRelation",
    bioKey: "memoryPresetFriendBio",
    Icon: Sprout,
  },
];

function resolvePhotoSrc(photoHash?: string): string | null {
  const raw = String(photoHash ?? "").trim();
  if (!raw) return null;
  if (/^https:\/\//i.test(raw)) return raw;
  const cid = raw.replace(/^ipfs:\/\//i, "").replace(/^\/?ipfs\//i, "");
  if (/^[A-Za-z0-9]{46,}$/.test(cid) || /^bafy[A-Za-z0-9]+$/i.test(cid)) {
    return `https://ipfs.io/ipfs/${cid}`;
  }
  return null;
}

function yearsFor(memorial: Memorial | null, fallback: string) {
  if (!memorial) return fallback;
  if (memorial.birthYear && memorial.deathYear) return `${memorial.birthYear} - ${memorial.deathYear}`;
  if (memorial.birthYear) return String(memorial.birthYear);
  if (memorial.deathYear) return String(memorial.deathYear);
  return fallback;
}

function totalOfferings(memorial: Memorial) {
  return Object.values(memorial.offerings ?? {}).reduce(
    (total, value) => total + Number(value || 0),
    0,
  );
}

export default function PlayArea({ t, state, dispatch, launchContext }: PlayAreaProps) {
  const { num, bool, str } = useStateBindings(state);
  const memorialCount = num("memorialCount");
  const tributeCount = num("tributeCount");
  const isSubmitting = bool("isSubmitting");
  const isPaying = bool("isPaying");
  const catalogStatus = str("catalogStatus", "loading");
  const catalogError = str("catalogError", "");
  const networkStatus = str("networkStatus", "loading");
  const networkMessage = str("networkMessage", "");
  const writePhase = str("writePhase", "idle");
  const writeNotice = str("writeNotice", "");
  const writeError = str("writeError", "");
  const confirmationChecking = bool("confirmationChecking");
  const storageHealthy = bool("storageHealthy");
  const memorials = (state.memorials?.get() ?? []) as Memorial[];
  const recentObituaries = (state.recentObituaries?.get() ?? []) as Array<{ id: number; name: string; text: string }>;
  const myTributes = (state.myTributes?.get() ?? []) as Array<{ tributeId: number; memorialId: number; offeringName: string; message: string; amountGas: string }>;
  const selectedMemorial = (state.selectedMemorial?.get() ?? null) as Memorial | null;
  const pendingWrite = (state.pendingWrite?.get() ?? null) as PendingMemorialWriteView | null;
  const isMainnet = launchContext?.network === "mainnet";

  const [tab, setTab] = useState<"memorials" | "create">("memorials");
  const [form, setForm] = useState<FormState>({
    name: "",
    relationship: "",
    birthYear: "",
    deathYear: "",
    biography: "",
    obituary: "",
    photoHash: "",
  });
  const [tributeOffering, setTributeOffering] = useState(3);
  const [tributeMessage, setTributeMessage] = useState("");
  const [tributeReceiptId, setTributeReceiptId] = useState("");
  const [activeMemoryPreset, setActiveMemoryPreset] = useState("");

  const hasMemorials = memorials.length > 0 || Boolean(selectedMemorial);
  const catalogUnavailable = !hasMemorials && catalogStatus === "error";
  const catalogLoading = !hasMemorials && catalogStatus === "loading";
  // Pre-connect the garden is simply unread, so fall through to the normal
  // studio surface (with a connect prompt) rather than the recovery scene.
  const catalogAwaiting = !hasMemorials && catalogStatus === "awaiting-context";
  const mode: "tribute" | "create" | "recovery" | "loading" = catalogUnavailable
    ? "recovery"
    : catalogLoading
      ? "loading"
      : tab === "create" || !hasMemorials
        ? "create"
        : "tribute";
  const activeMemorial = mode === "tribute" ? selectedMemorial ?? memorials[0] ?? null : null;
  const activeOffering = OFFERINGS.find((offering) => offering.type === tributeOffering) ?? OFFERINGS[2];
  const activePhoto = resolvePhotoSrc(activeMemorial?.photoHash);
  const createPhoto = resolvePhotoSrc(form.photoHash);
  const memorialRail = [...(activeMemorial ? [activeMemorial] : []), ...memorials]
    .filter((memorial, index, source) => source.findIndex((item) => item.id === memorial.id) === index)
    .slice(0, 6);
  const draftValidation = validateMemorialDraft(form);
  const hasDraftDetails = Object.values(form).some((value) => value.trim());
  const draftErrorKey = !draftValidation.ok && hasDraftDetails
    ? draftValidation.errorKey
    : "";

  const updateForm = (key: keyof FormState, value: string) => {
    if (key === "relationship" || key === "biography") setActiveMemoryPreset("");
    setForm((current) => ({ ...current, [key]: value }));
  };
  const applyMemoryPreset = (preset: (typeof MEMORY_PRESETS)[number]) => {
    setActiveMemoryPreset(preset.key);
    setForm((current) => ({
      ...current,
      relationship: t(preset.relationKey),
      biography: t(preset.bioKey),
    }));
  };

  const handleCreate = () => {
    if (!draftValidation.ok) return;
    void dispatch("createMemorial", draftValidation.value);
  };

  const handlePayTribute = () => {
    if (!activeMemorial) return;
    void dispatch("payTribute", activeMemorial.id, tributeOffering, tributeMessage, tributeReceiptId);
  };

  const openMemorial = (id: number) => {
    setTab("memorials");
    void dispatch("openMemorial", id);
  };
  const refreshMemorials = () => {
    void dispatch("refreshMemorials");
  };
  const recoverPendingWrite = () => {
    void dispatch("recoverPendingWrite");
  };

  const hasPendingWrite = Boolean(pendingWrite);
  const networkAllowsCreate = networkStatus === "ready" || networkStatus === "tribute-unavailable";
  const canCreate = draftValidation.ok && catalogStatus !== "error" && networkAllowsCreate &&
    storageHealthy && !hasPendingWrite;
  const canPay = Boolean(activeMemorial) && networkStatus === "ready" &&
    (!isMainnet || /^[1-9]\d*$/.test(tributeReceiptId.trim())) && storageHealthy && !hasPendingWrite;
  const surfaceNotice = writeError || (!storageHealthy
    ? t("recoveryStorageUnavailable")
    : writeNotice || catalogError || networkMessage);
  const surfaceNoticeTone = writeError || !storageHealthy
    ? "error"
    : catalogStatus === "partial" || networkStatus === "tribute-unavailable"
      ? "warning"
      : "info";

  const createScene = (
    <div className="shrine-create-card" data-ready={canCreate ? "true" : "false"}>
      <div className="shrine-create-card__media">
        <img src={createPhoto ?? ALTAR_IMAGE} alt="" aria-hidden="true" loading="eager" decoding="async" />
        <span className="shrine-create-card__media-label">
          <ScrollText size={14} /> {t("chainPermanence")}
        </span>
      </div>
      <div className="shrine-create-card__copy">
        <span><PenLine size={14} /> {t("previewLabel")}</span>
        <div className="shrine-inscription-panel">
          <small>{form.relationship.trim() || t("previewRelationEmpty")}</small>
          <strong>{form.name.trim() || t("previewEmptyName")}</strong>
          <p>{form.biography.trim() || t("previewBioEmpty")}</p>
          <label className="shrine-name-plaque">
            <span>{t("engravingLabel")}</span>
            <input
              value={form.name}
              onChange={(event) => updateForm("name", event.target.value)}
              placeholder={t("placeholderName")}
              disabled={isSubmitting}
            />
          </label>
        </div>
        <div className="shrine-memory-presets" aria-label={t("memoryPresetLabel")}>
          {MEMORY_PRESETS.map(({ Icon, ...preset }) => (
            <button
              key={preset.key}
              type="button"
              className={[
                "shrine-memory-preset",
                activeMemoryPreset === preset.key ? "shrine-memory-preset--active" : null,
              ].filter(Boolean).join(" ")}
              onClick={() => applyMemoryPreset({ ...preset, Icon })}
              disabled={isSubmitting}
            >
              <Icon size={16} aria-hidden="true" />
              <span>{t(preset.labelKey)}</span>
            </button>
          ))}
        </div>
        {draftErrorKey && (
          <p className="shrine-draft-hint" role="status">
            <CircleAlert size={14} aria-hidden="true" />
            <span>{t(draftErrorKey)}</span>
          </p>
        )}
      </div>
    </div>
  );

  const tributeScene = activeMemorial ? (
    <div className="shrine-tribute-card" data-phase={writePhase}>
      <div className="shrine-tribute-card__portrait">
        <img src={activePhoto ?? ALTAR_IMAGE} alt="" aria-hidden="true" loading="eager" decoding="async" />
      </div>
      <div className="shrine-tribute-card__body">
        <span>{t("foreverRemember")}</span>
        <strong>{activeMemorial.name}</strong>
        <small>{yearsFor(activeMemorial, t("previewDatesEmpty"))}</small>
        <p>{activeMemorial.biography?.trim() || activeMemorial.relationship?.trim() || t("tributeStationDesc")}</p>
      </div>
      <div className="shrine-offering-dock" role="radiogroup" aria-label={t("selectOffering")}>
        {OFFERINGS.map(({ type, key, cost, Icon }) => {
          const selected = tributeOffering === type;
          return (
            <button
              key={type}
              type="button"
              role="radio"
              aria-checked={selected}
              className={`shrine-offering${selected ? " shrine-offering--active" : ""}`}
              onClick={() => setTributeOffering(type)}
              disabled={isPaying}
            >
              <span className="shrine-offering__icon" aria-hidden="true"><Icon size={19} /></span>
              <span className="shrine-offering__label">{t(key)}</span>
              <span className="shrine-offering__cost">{cost} GAS</span>
            </button>
          );
        })}
      </div>
    </div>
  ) : null;

  // The PlayStage header above already carries the title and body for both the
  // loading and recovery modes; repeating them here printed the same two lines
  // twice on one screen. This scene keeps the artwork, the state icon, and the
  // only thing the header cannot show: the specific underlying error.
  const recoveryScene = (
    <div className="shrine-recovery" data-state={mode}>
      <img src={GARDEN_IMAGE} alt={t("gardenAlt")} loading="eager" decoding="async" />
      <div className="shrine-recovery__copy">
        {mode === "loading"
          ? <LoaderCircle className="shrine-recovery__spinner" size={24} aria-hidden="true" />
          : <CircleAlert size={24} aria-hidden="true" />}
        {mode === "recovery" && catalogError && catalogError !== t("catalogLoadFailed") && (
          <small>{catalogError}</small>
        )}
      </div>
    </div>
  );

  const scene = mode === "recovery" || mode === "loading" ? recoveryScene : (
    <div className="shrine-workbench" data-mode={mode} data-phase={writePhase}>
      <div className="shrine-garden-panel" aria-hidden={mode === "create" ? "true" : undefined}>
        <img src={GARDEN_IMAGE} alt={t("gardenAlt")} loading="eager" decoding="async" />
        <div className="shrine-garden-panel__caption">
          <span><ScrollText size={14} /> {t("chainPermanence")}</span>
          <strong>{mode === "create" ? t("memoryStudio") : activeOffering ? t(activeOffering.key) : t("payTribute")}</strong>
          <small>{mode === "create" ? t("createDesc") : t("offeringDisclosure")}</small>
        </div>
        {mode === "tribute" && memorialRail.length > 1 && (
          <div className="shrine-memorial-rail" aria-label={t("memorialRailLabel")}>
            {memorialRail.map((memorial) => {
              const selected = activeMemorial?.id === memorial.id;
              const offeringsCount = totalOfferings(memorial);
              return (
                <button
                  key={memorial.id}
                  type="button"
                  className={`shrine-memorial-stone${selected ? " shrine-memorial-stone--active" : ""}`}
                  aria-pressed={selected}
                  onClick={() => openMemorial(memorial.id)}
                >
                  <span className="shrine-memorial-stone__name">{memorial.name || t("unnamed")}</span>
                  <span className="shrine-memorial-stone__years">{yearsFor(memorial, t("previewDatesEmpty"))}</span>
                  <span className="shrine-memorial-stone__meta">
                    {memorial.relationship?.trim() || memorial.biography?.trim() || t("foreverRemember")}
                  </span>
                  {offeringsCount > 0 && (
                    <span className="shrine-memorial-stone__offerings">
                      {offeringsCount} {t("offeringsReceived").toLowerCase()}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        )}
      </div>
      <div className="shrine-workbench__focus">
        {mode === "create" ? createScene : tributeScene}
        {surfaceNotice && (
          <p
            className="shrine-chain-notice"
            data-tone={surfaceNoticeTone}
            role={surfaceNoticeTone === "error" ? "alert" : "status"}
          >
            <CircleAlert size={15} aria-hidden="true" />
            <span>{surfaceNotice}</span>
          </p>
        )}
      </div>
    </div>
  );

  const drawer = (
    <div className="shrine-drawer-shell">
      {(pendingWrite || writeNotice || writeError) && (
        <OpenUiPanel
          className="shrine-drawer-panel shrine-drawer-panel--transaction"
          icon={<RefreshCw size={16} />}
          title={pendingWrite ? t("pendingTransactionTitle") : t("latestTransactionTitle")}
          subtitle={writeError || writeNotice || t("transactionIdle")}
          titleId="shrine-drawer-transaction"
        >
          <div className="shrine-transaction-record" data-phase={writePhase}>
            <span>{t("transactionPhase")}</span>
            <strong>{t(`writePhase_${writePhase}`)}</strong>
            {pendingWrite?.txid && <code>{pendingWrite.txid}</code>}
            {pendingWrite && (
              <small>
                {pendingWrite.network} · {pendingWrite.contractHash}
              </small>
            )}
          </div>
        </OpenUiPanel>
      )}
      {mode === "create" ? (
        <OpenUiPanel
          className="shrine-drawer-panel shrine-drawer-panel--studio"
          icon={<PenLine size={16} />}
          title={t("createTitle")}
          subtitle={t("createDesc")}
          titleId="shrine-drawer-studio"
        >
          <div className="shrine-studio-grid">
            <OpenUiTextField className="shrine-drawer-field" label={t("labelRelation")} value={form.relationship} onChange={(event) => updateForm("relationship", event.target.value)} placeholder={t("placeholderRelation")} disabled={isSubmitting} />
            <OpenUiTextField className="shrine-drawer-field" label={t("labelPhoto")} value={form.photoHash} onChange={(event) => updateForm("photoHash", event.target.value)} placeholder={t("photoHashPlaceholder")} disabled={isSubmitting} mono />
            <OpenUiTextField className="shrine-drawer-field" label={t("labelBirth")} value={form.birthYear} onChange={(event) => updateForm("birthYear", event.target.value)} placeholder={t("placeholderBirthYear")} inputMode="numeric" pattern="[0-9]*" disabled={isSubmitting} />
            <OpenUiTextField className="shrine-drawer-field" label={t("labelDeath")} value={form.deathYear} onChange={(event) => updateForm("deathYear", event.target.value)} placeholder={t("placeholderDeathYear")} inputMode="numeric" pattern="[0-9]*" disabled={isSubmitting} />
            <OpenUiTextArea className="shrine-drawer-field shrine-drawer-field--wide mx2-open-field--compact" label={t("labelBio")} value={form.biography} onChange={(event) => updateForm("biography", event.target.value)} placeholder={t("placeholderBio")} disabled={isSubmitting} rows={3} />
            <OpenUiTextArea className="shrine-drawer-field shrine-drawer-field--wide mx2-open-field--compact" label={t("labelObituary")} value={form.obituary} onChange={(event) => updateForm("obituary", event.target.value)} placeholder={t("placeholderObituary")} disabled={isSubmitting} rows={3} />
          </div>
          {/* Mirror of the scene card's draft hint: these fields live in the
              drawer (a bottom sheet on mobile that covers the scene), so a
              validation message rendered only up in the scene card is invisible
              at the point of edit. */}
          {draftErrorKey && (
            <p className="shrine-draft-hint" role="status">
              <CircleAlert size={14} aria-hidden="true" />
              <span>{t(draftErrorKey)}</span>
            </p>
          )}
        </OpenUiPanel>
      ) : mode === "tribute" ? (
        <OpenUiPanel
          className="shrine-drawer-panel shrine-drawer-panel--tribute"
          icon={<Flame size={16} />}
          title={t("payTribute")}
          subtitle={activeMemorial?.name ?? t("tributeStationDesc")}
          titleId="shrine-drawer-tribute"
        >
          <OpenUiTextArea className="shrine-drawer-field shrine-drawer-field--wide mx2-open-field--compact" label={t("tributeMessage")} value={tributeMessage} onChange={(event) => setTributeMessage(event.target.value)} placeholder={t("tributeMessagePlaceholder")} disabled={isPaying} rows={2} />
          {isMainnet && (
            <OpenUiTextField className="shrine-drawer-field shrine-drawer-field--wide" label={t("receiptId")} value={tributeReceiptId} onChange={(event) => setTributeReceiptId(event.target.value)} placeholder={t("receiptIdPlaceholder")} disabled={isPaying} mono />
          )}
          <p className="shrine-disclosure">{isMainnet ? t("mainnetTributeNote") : t("offeringDisclosure")}</p>
        </OpenUiPanel>
      ) : null}
      <OpenUiPanel
        className="shrine-drawer-panel shrine-drawer-panel--records"
        icon={<ScrollText size={16} />}
        title={t("memorials")}
        subtitle={`${memorials.length} ${t("memorials").toLowerCase()}`}
        titleId="shrine-drawer-memorials"
      >
        {memorials.length > 0 ? (
          <ul className="shrine-drawer-list shrine-memorial-list">
            {memorials.slice(0, 8).map((memorial) => (
              <li key={memorial.id} className="shrine-drawer-list__item">
                <button
                  type="button"
                  className="mx2-btn mx2-btn--ghost"
                  onClick={() => openMemorial(memorial.id)}
                >
                  {memorial.name}
                </button>
              </li>
            ))}
          </ul>
        ) : <p className="shrine-drawer-empty">{t("noMemorials")}</p>}
      </OpenUiPanel>
      <OpenUiPanel
        className="shrine-drawer-panel shrine-drawer-panel--records"
        icon={<PenLine size={16} />}
        title={t("obituaries")}
        subtitle={`${recentObituaries.length} ${t("obituaries").toLowerCase()}`}
        titleId="shrine-drawer-obituaries"
      >
        {recentObituaries.length > 0 ? (
          <ul className="shrine-drawer-list">
            {recentObituaries.slice(0, 8).map((obituary) => (
              <li key={obituary.id} className="shrine-drawer-list__item">
                <span className="shrine-drawer-list__face">{obituary.name}</span>
                <span className="shrine-drawer-list__meta">{obituary.text?.slice(0, 60)}</span>
              </li>
            ))}
          </ul>
        ) : <p className="shrine-drawer-empty">{t("noMemorials")}</p>}
      </OpenUiPanel>
      <OpenUiPanel
        className="shrine-drawer-panel shrine-drawer-panel--records"
        icon={<Flame size={16} />}
        title={t("myTributes")}
        subtitle={`${myTributes.length} ${t("myTributes").toLowerCase()}`}
        titleId="shrine-drawer-tributes"
      >
        {myTributes.length > 0 ? (
          <ul className="shrine-drawer-list">
            {myTributes.slice(0, 8).map((tribute) => (
              <li key={tribute.tributeId} className="shrine-drawer-list__item">
                <span className="shrine-drawer-list__face">{tribute.offeringName || t("payTribute")}</span>
                <span className="shrine-drawer-list__amount">{tribute.amountGas} GAS</span>
              </li>
            ))}
          </ul>
        ) : <p className="shrine-drawer-empty">{t("noTributes")}</p>}
      </OpenUiPanel>
    </div>
  );

  return (
    <div className="memorial-play-area mx2 mx2-cat-social">
      <PlayStage
        category="social"
        stage={{
          eyebrow: t("heroKicker"),
          title: mode === "recovery"
            ? t("catalogLoadFailedTitle")
            : mode === "loading"
              ? t("catalogLoadingTitle")
              : mode === "create"
                ? t("createTitle")
                : activeMemorial?.name ?? t("title"),
          subtitle: mode === "recovery"
            ? t("catalogLoadFailed")
            : mode === "loading"
              ? t("catalogLoadingBody")
              : mode === "create"
                ? t("previewBioEmpty")
                : t("subtitle"),
          badges: mode === "recovery" || mode === "loading"
            ? undefined
            : <span className="mx2-badge" data-tone="accent"><span className="mx2-badge__dot" /> {memorialCount} {t("memorials").toLowerCase()}</span>,
        }}
        scene={scene}
        score={mode === "recovery" || mode === "loading" ? undefined : [
          { label: t("memorials"), value: String(memorialCount), accent: true },
          { label: t("myTributes"), value: String(tributeCount) },
        ]}
        actions={{
          primary: hasPendingWrite
            ? {
                label: confirmationChecking ? t("transactionChecking") : t("checkPendingTransaction"),
                onClick: recoverPendingWrite,
                disabled: confirmationChecking,
                loading: confirmationChecking,
                icon: <RefreshCw size={18} />,
              }
            : mode === "recovery"
            ? { label: t("retry"), onClick: refreshMemorials, icon: <RefreshCw size={18} /> }
            : mode === "loading"
              ? undefined
              : mode === "tribute"
            ? { label: isPaying ? t("paying") : t("payTributeBtn"), onClick: handlePayTribute, disabled: !canPay || isPaying, loading: isPaying, icon: <Flame size={18} /> }
            : { label: t("createMemorial"), onClick: handleCreate, disabled: !canCreate || isSubmitting, loading: isSubmitting, icon: <ImageIcon size={18} /> },
          secondary: !hasPendingWrite && mode !== "recovery" && mode !== "loading" && hasMemorials ? [
            {
              label: mode === "create" ? t("memorials") : t("createMemorial"),
              onClick: () => setTab(mode === "create" ? "memorials" : "create"),
              disabled: isSubmitting || isPaying || confirmationChecking,
              icon: mode === "create" ? <ScrollText size={17} /> : <PenLine size={17} />,
            },
          ] : undefined,
        }}
        drawerToggleLabel={hasPendingWrite ? t("pendingTransactionTitle") : mode === "create" ? t("memoryStudio") : t("obituaries")}
        drawer={!hasPendingWrite && (mode === "recovery" || mode === "loading") ? undefined : {
          title: hasPendingWrite ? t("pendingTransactionTitle") : mode === "create" ? t("memoryStudio") : t("obituaries"),
          children: drawer,
        }}
      />
    </div>
  );
}
