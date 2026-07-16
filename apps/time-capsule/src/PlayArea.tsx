/**
 * PlayArea.tsx — Time Capsule (scene-led rebuild)
 *
 * The capsule is the primary object: users load a message into a glowing vault,
 * set a time lock, then seal. Lists, tips, and recovery actions stay tucked in
 * the drawer so the first screen feels like an app, not a survey form.
 */
import { useEffect, useState, type ReactNode } from "react";
import {
  CalendarClock,
  Eye,
  EyeOff,
  Gift,
  type LucideIcon,
  Megaphone,
  ScrollText,
  Sparkles,
  UserRound,
} from "lucide-react";
import { useNowMs } from "@shared/react/hooks/useNowMs";
import { useStateBindings } from "@shared/react/hooks/useStateBindings";
import type { ObservableState } from "@shared/react/context";
import { CoinArt } from "@shared/art";
import {
  OpenUiLitePanel as OpenUiPanel,
  OpenUiLiteProvider as OpenUiProvider,
  OpenUiLiteSegmented as OpenUiSegmented,
  OpenUiLiteTextArea as OpenUiTextArea,
  OpenUiLiteTextField as OpenUiTextField,
} from "@shared/components-react/v2/OpenUiLite";
import { PlayStage } from "@shared/components-react/v2/PlayStage";
import type { Capsule, CapsuleFormData } from "./composables/useTimeCapsule";
import "./PlayArea.scss";

const stageArtUrl = new URL("../public/time-capsule-stage.webp", import.meta.url).href;

interface PlayAreaProps {
  t: (key: string, p?: Record<string, string | number>) => string;
  state: ObservableState;
  dispatch: (name: string, ...args: unknown[]) => Promise<void>;
}

type DrawerMode = "settings" | "capsules" | "public" | "deposit";

const DEFAULT_FORM: CapsuleFormData = {
  title: "",
  content: "",
  days: "30",
  isPublic: false,
  category: 1,
};

const CATEGORY_OPTIONS = [
  { value: 1, key: "categoryPersonalShort", hintKey: "categoryPersonalHint", icon: UserRound },
  { value: 2, key: "categoryGiftShort", hintKey: "categoryGiftHint", icon: Gift },
  { value: 3, key: "categoryMemorialShort", hintKey: "categoryMemorialHint", icon: Sparkles },
  { value: 4, key: "categoryAnnouncementShort", hintKey: "categoryAnnouncementHint", icon: Megaphone },
  { value: 5, key: "categorySecretShort", hintKey: "categorySecretHint", icon: EyeOff },
];

const DAY_PRESETS = ["30", "365", "1825"];
const MIN_DAYS = 1;
const MAX_DAYS = 3650;

function clampDays(days: unknown): string {
  const parsed = Number.parseInt(String(days ?? DEFAULT_FORM.days), 10);
  if (!Number.isFinite(parsed)) return DEFAULT_FORM.days;
  return String(Math.min(MAX_DAYS, Math.max(MIN_DAYS, parsed)));
}

function normalizeCapsuleForm(raw: unknown): CapsuleFormData {
  const data =
    raw && typeof raw === "object"
      ? (raw as Partial<CapsuleFormData>)
      : DEFAULT_FORM;
  const category = Number(data.category ?? DEFAULT_FORM.category);
  return {
    title: String(data.title ?? "").slice(0, 100),
    content: String(data.content ?? ""),
    days: clampDays(data.days),
    isPublic: Boolean(data.isPublic),
    category: Number.isFinite(category)
      ? Math.min(5, Math.max(1, Math.round(category)))
      : DEFAULT_FORM.category,
  };
}

function formsEqual(a: CapsuleFormData, b: CapsuleFormData): boolean {
  return (
    a.title === b.title &&
    a.content === b.content &&
    a.days === b.days &&
    a.isPublic === b.isPublic &&
    a.category === b.category
  );
}

function capsuleTitle(cap: Capsule, fallback: string): string {
  return cap.title?.trim() || `${fallback} #${cap.id}`;
}

function shortDate(timestamp: unknown): string {
  const date = new Date(Number(timestamp));
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

function remainingTime(timestamp: number, now: number, t: PlayAreaProps["t"]): string {
  const milliseconds = Math.max(0, timestamp - now);
  if (milliseconds <= 0) return t("readyToOpen");
  const days = Math.floor(milliseconds / 86_400_000);
  const hours = Math.floor((milliseconds % 86_400_000) / 3_600_000);
  if (days > 0) return t("countdownDaysHours", { days, hours });
  const minutes = Math.max(1, Math.ceil(milliseconds / 60_000));
  return t("countdownHoursMinutes", { hours, minutes: minutes % 60 });
}

export default function PlayArea({ t, state, dispatch }: PlayAreaProps) {
  const { str, bool, num, val } = useStateBindings(state);
  const isLoading = bool("isLoading");
  const isCreating = bool("isCreating");
  const isProcessing = bool("isProcessing");
  const isBusy = bool("isBusy");
  const totalCapsules = num("totalCapsules");
  const hasCredit = bool("hasCredit");
  const reusableCredit = str("reusableCredit", "0");
  const capsules = val<Capsule[]>("capsules", []) ?? [];
  const fishCandidates = val<Capsule[]>("fishCandidates", []) ?? [];
  const isLoadingCandidates = bool("isLoadingCandidates");
  const isRecovering = bool("isRecovering");
  const capsulesSource = str("capsulesSource", "none");
  const candidatesSource = str("candidatesSource", "none");
  const creditSource = str("creditSource", "none");
  const transactionNotice = str("transactionNotice", "");
  const storageHealthy = bool("storageHealthy");
  const pendingOperation = val<{ kind?: string; txid?: string; paymentTxid?: string } | null>("pendingOperation", null);

  const [form, setForm] = useState<CapsuleFormData>(() =>
    normalizeCapsuleForm(state.newCapsule?.get()),
  );
  const [drawerMode, setDrawerMode] = useState<DrawerMode>("settings");
  const now = useNowMs(60_000);

  useEffect(() => {
    const unsubscribe = state.newCapsule?.subscribe(() => {
      const next = normalizeCapsuleForm(state.newCapsule?.get());
      setForm((current) => (formsEqual(current, next) ? current : next));
    });
    return () => unsubscribe?.();
  }, [state]);

  useEffect(() => {
    state.newCapsule?.set(form);
  }, [form, state]);

  const updateForm = <K extends keyof CapsuleFormData>(
    key: K,
    value: CapsuleFormData[K],
  ) => {
    const next = normalizeCapsuleForm({ ...form, [key]: value });
    setForm(next);
    state.newCapsule?.set(next);
  };
  const setDayPreset = (value: string) => updateForm("days", value);
  const setVisibility = (value: string) => updateForm("isPublic", value === "public");
  const setCategory = (value: string) => {
    const next = Number.parseInt(value, 10);
    if (Number.isFinite(next)) updateForm("category", next);
  };
  const setDrawerTab = (value: string) => {
    if (value === "settings" || value === "capsules" || value === "public" || value === "deposit") {
      setDrawerMode(value);
    }
  };

  const writeLocked = isCreating || Boolean(pendingOperation);
  const canCreate = storageHealthy && !pendingOperation && form.title.trim() !== "" && form.content.trim() !== "";
  const contentChars = form.content.trim().length;
  const isSealing = isCreating;
  const sceneState = isSealing
    ? "sealing"
    : canCreate
      ? "ready"
      : contentChars > 0 || form.title.trim() !== ""
        ? "loading"
        : "draft";
  const daysNumber = Number.parseInt(form.days, 10) || 30;
  const selectedCategory = CATEGORY_OPTIONS.find((cat) => cat.value === form.category);
  const SelectedCategoryIcon = selectedCategory?.icon ?? UserRound;
  const drawerModes: Array<{ mode: DrawerMode; label: string; value: string; Icon: LucideIcon }> = [
    { mode: "settings", label: t("drawerSeal"), value: `${daysNumber} ${t("daysShort")}`, Icon: CalendarClock },
    { mode: "capsules", label: t("drawerCapsules"), value: capsulesSource === "chain" ? String(totalCapsules) : t("unavailableShort"), Icon: ScrollText },
    { mode: "public", label: t("drawerPublic"), value: candidatesSource === "chain" ? String(fishCandidates.length) : t("unavailableShort"), Icon: Sparkles },
    { mode: "deposit", label: t("drawerDeposit"), value: creditSource === "failed" ? t("unavailableShort") : hasCredit ? `${reusableCredit} GAS` : t("depositShortNote"), Icon: Gift },
  ];
  // drawerModes is a fixed 4-entry literal — index 0 always exists; the
  // assertion satisfies noUncheckedIndexedAccess.
  const activeDrawerMode = drawerModes.find((item) => item.mode === drawerMode) ?? drawerModes[0]!;
  const ActiveDrawerIcon = activeDrawerMode.Icon;

  const handleCreate = () => {
    if (!canCreate || isBusy) return;
    void dispatch("createCapsule", form);
  };

  const scene = (
    <div className="capsule-scene" data-state={sceneState}>
      <div className="capsule-scene__chamber" aria-label={t("heroStageAlt")}>
        <img
          className="capsule-scene__stage-image"
          src={stageArtUrl}
          alt={t("heroStageAlt")}
          draggable={false}
        />
      </div>
      <div className="capsule-scene__hud" aria-label={t("sealPreview")}>
        <span><CalendarClock size={14} />{daysNumber} {t("daysShort")}</span>
        <span><SelectedCategoryIcon size={14} />{selectedCategory ? t(selectedCategory.key) : t("categoryPersonal")}</span>
        <span>{form.isPublic ? <Eye size={14} /> : <EyeOff size={14} />}{form.isPublic ? t("public") : t("private")}</span>
      </div>
      <p className="capsule-scene__status" aria-live="polite">
        {isSealing
          ? t("creatingCapsule")
          : canCreate
            ? t("capsuleBoardReadySeal")
            : t("capsuleBoardDraft")}
      </p>
    </div>
  );

  const composer = (
    <div className="capsule-console">
      <section className="capsule-message-dock" aria-label={t("letterDockLabel")} data-loaded={contentChars > 0 ? "true" : undefined}>
        <div className="capsule-message-dock__head">
          <span><ScrollText size={16} />{t("messageStage")}</span>
          <small>{t("messageStageCopy")}</small>
        </div>
        <div className="capsule-letter-card" data-state={sceneState}>
          <div className="capsule-letter-card__surface">
            <OpenUiTextField
              className="capsule-letter-field capsule-letter-field--title"
              inputClassName="capsule-input capsule-input--title"
              value={form.title}
              onChange={(event) => updateForm("title", event.target.value)}
              placeholder={t("titlePlaceholder")}
              label={t("titleLabel")}
              disabled={writeLocked}
              maxLength={100}
            />
            <OpenUiTextArea
              className="capsule-letter-field capsule-letter-field--message"
              textareaClassName="capsule-input capsule-input--textarea"
              value={form.content}
              onChange={(event) => updateForm("content", event.target.value)}
              placeholder={t("secretMessagePlaceholder")}
              label={t("secretMessage")}
              disabled={writeLocked}
              rows={3}
            />
          </div>
          <footer className="capsule-letter-card__meta">
            <span>{contentChars > 0 ? t("letterDockCount", { count: contentChars }) : t("letterDockEmpty")}</span>
            <strong>{form.isPublic ? t("public") : t("private")}</strong>
          </footer>
        </div>
      </section>
      <section className="capsule-quick-seal" aria-label={t("sealSettings")}>
        <div className="capsule-quick-seal__head">
          <span><CalendarClock size={16} />{t("timeLockStage")}</span>
          <small>{t("sealSettingsCopy")}</small>
        </div>
        <OpenUiSegmented
          className="capsule-lock-presets"
          label={t("durationPresets")}
          onChange={setDayPreset}
          options={DAY_PRESETS.map((days) => ({
            value: days,
            disabled: writeLocked,
            label: (
              <span className="capsule-lock-option">
                <strong>{days}</strong>
                <span>{t("daysShort")}</span>
              </span>
            ),
          }))}
          segmentedClassName="capsule-lock-presets__group"
          value={form.days}
        />
        <div className="capsule-seal-summary">
          <span><CalendarClock size={13} />{daysNumber} {t("daysShort")}</span>
          <span>{selectedCategory ? t(selectedCategory.key) : t("categoryPersonal")}</span>
          <span>{form.isPublic ? <Eye size={13} /> : <EyeOff size={13} />}{form.isPublic ? t("public") : t("private")}</span>
        </div>
      </section>
    </div>
  );

  const sealSettings = (
    <section className="capsule-tuning" aria-label={t("sealPreview")}>
      <div className="capsule-tuning__panel">
        <div className="capsule-tuning__label">
          <span>{t("timeLockStage")}</span>
          <small>{t("timeLockStageCopy")}</small>
        </div>
        <div className="capsule-stepper">
          <button
            type="button"
            aria-label={t("decreaseLockDuration")}
            onClick={() => updateForm("days", String(Math.max(MIN_DAYS, daysNumber - 1)))}
            disabled={writeLocked || daysNumber <= MIN_DAYS}
          >
            -
          </button>
          <OpenUiTextField
            className="capsule-stepper__field"
            inputClassName="capsule-stepper__input"
            label={t("unlockIn")}
            value={form.days}
            onChange={(event) => updateForm("days", event.target.value)}
            inputMode="numeric"
            disabled={writeLocked}
          />
          <button
            type="button"
            aria-label={t("increaseLockDuration")}
            onClick={() => updateForm("days", String(Math.min(MAX_DAYS, daysNumber + 1)))}
            disabled={writeLocked || daysNumber >= MAX_DAYS}
          >
            +
          </button>
        </div>
        <OpenUiSegmented
          className="capsule-chip-row"
          label={t("durationPresets")}
          onChange={setDayPreset}
          options={DAY_PRESETS.map((days) => ({
            value: days,
            disabled: writeLocked,
            label: (
              <span className="capsule-chip-option">
                {days}
                <span>{t("daysShort")}</span>
              </span>
            ),
          }))}
          segmentedClassName="capsule-chip-row__group"
          value={form.days}
        />
      </div>

      <div className="capsule-tuning__panel">
        <div className="capsule-tuning__label">
          <span>{t("categoryLabel")}</span>
          <small>{t("categoryStageCopy")}</small>
        </div>
        <OpenUiSegmented
          className="capsule-category-grid"
          label={t("categoryLabel")}
          onChange={setCategory}
          options={CATEGORY_OPTIONS.map((cat) => {
            const Icon = cat.icon;
            return {
              value: String(cat.value),
              disabled: writeLocked,
              label: (
                <span className="capsule-category-option">
                  <Icon size={16} />
                  <span>{t(cat.key)}</span>
                  <small>{t(cat.hintKey)}</small>
                </span>
              ),
            };
          })}
          segmentedClassName="capsule-category-grid__group"
          value={String(form.category)}
        />
      </div>

      <div className="capsule-tuning__panel capsule-tuning__panel--visibility">
        <div className="capsule-tuning__label">
          <span>{t("visibility")}</span>
          <small>{t("visibilityStageCopy")}</small>
        </div>
        <OpenUiSegmented
          className="capsule-visibility"
          label={t("visibility")}
          onChange={setVisibility}
          options={[
            { value: "private", label: t("private"), hint: t("privateHint") },
            { value: "public", label: t("public"), hint: t("publicHint") },
          ].map((option) => ({
            value: option.value,
            disabled: writeLocked,
            label: (
              <span className="capsule-visibility-option capsule-visibility-option--stacked">
                <span>{option.label}</span>
                <small>{option.hint}</small>
              </span>
            ),
          }))}
          segmentedClassName="capsule-visibility__group"
          value={form.isPublic ? "public" : "private"}
        />
      </div>
    </section>
  );

  const drawerPanels: Record<DrawerMode, ReactNode> = {
    settings: (
      <div className="capsule-drawer__panel-body" data-mode="settings">
        <div className="capsule-drawer__summary">
          <span>{t("sealSettingsCopy")}</span>
          <strong>{daysNumber} {t("daysShort")}</strong>
        </div>
        {sealSettings}
      </div>
    ),
    capsules: (
      <div className="capsule-drawer__panel-body" data-mode="capsules">
        <div className="capsule-drawer__summary">
          <span>{t("yourCapsules")}</span>
          <strong>{capsules.length}</strong>
        </div>
        {capsulesSource === "failed" ? (
          <div className="capsule-source-error">
            <strong>{t("capsuleDataUnavailable")}</strong>
            <span>{t("capsuleDataUnavailableHint")}</span>
          </div>
        ) : capsules.length > 0 ? (
          <ul className="capsule-list">
            {capsules.slice(0, 10).map((cap) => (
              <li key={cap.id} className="capsule-list__item" data-revealed={cap.revealed ? "true" : undefined}>
                <div>
                  <strong>{capsuleTitle(cap, t("untitledCapsule"))}</strong>
                  <span>
                    {cap.revealed ? t("revealed") : cap.locked ? remainingTime(cap.unlockTime, now, t) : t("readyToOpen")}
                    {cap.unlockTime ? ` · ${shortDate(cap.unlockTime)}` : ""}
                  </span>
                </div>
                {!cap.revealed && (
                  <button
                    type="button"
                    className="mx2-btn mx2-btn--ghost"
                    onClick={() => void dispatch("openCapsule", cap)}
                    disabled={cap.locked || isProcessing || Boolean(pendingOperation) || !storageHealthy}
                  >
                    {cap.locked ? t("sealed") : t("openAndReclaim", { amount: cap.amount })}
                  </button>
                )}
              </li>
            ))}
          </ul>
        ) : (
          <div className="capsule-empty">{t("noLocalCapsules")}</div>
        )}
      </div>
    ),
    public: (
      <div className="capsule-drawer__panel-body" data-mode="public">
        <div className="capsule-drawer__summary capsule-drawer__summary--action">
          <span>{t("fishCandidatesHint")}</span>
          <button
            type="button"
            className="mx2-btn mx2-btn--ghost"
            onClick={() => void dispatch("loadFishCandidates")}
            disabled={isLoadingCandidates}
          >
            {isLoadingCandidates ? t("fishCandidatesLoading") : t("fishCandidatesRefresh")}
          </button>
        </div>
        {candidatesSource === "failed" ? (
          <div className="capsule-source-error">
            <strong>{t("publicDataUnavailable")}</strong>
            <span>{t("publicDataUnavailableHint")}</span>
          </div>
        ) : fishCandidates.length > 0 ? (
          <ul className="capsule-list capsule-list--fish">
            {fishCandidates.slice(0, 6).map((cap) => (
              <li key={cap.id} className="capsule-list__item">
                <div>
                  <strong>{capsuleTitle(cap, t("untitledCapsule"))}</strong>
                  <span>
                    #{cap.id}
                    {cap.unlockTime ? ` · ${shortDate(cap.unlockTime)}` : ""}
                  </span>
                </div>
                <button
                  type="button"
                  className="mx2-btn mx2-btn--ghost"
                  onClick={() => void dispatch("fishCapsule", cap.id)}
                  disabled={isProcessing || Boolean(pendingOperation) || !storageHealthy}
                >
                  {t("fishTipThis")}
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <div className="capsule-empty">{isLoadingCandidates ? t("fishCandidatesLoading") : t("fishCandidatesEmpty")}</div>
        )}
      </div>
    ),
    deposit: (
      <div className="capsule-drawer__panel-body" data-mode="deposit">
        <div className="capsule-deposit-card">
          <span className="capsule-deposit-card__icon"><CoinArt variant="gas" size={24} decorative /></span>
          <span>{t("depositLabel")}</span>
          <strong>{creditSource === "failed" ? t("creditDataUnavailable") : hasCredit ? `${reusableCredit} GAS` : t("depositShortNote")}</strong>
        </div>
        <div className="capsule-drawer__summary">
          <span>{t("depositNote")}</span>
        </div>
        <div className="capsule-money-actions">
          {hasCredit && (
            <button
              type="button"
              className="mx2-btn mx2-btn--ghost"
              onClick={() => void dispatch("withdrawCredit")}
              disabled={isProcessing || Boolean(pendingOperation) || !storageHealthy}
            >
              {t("withdrawCredit")}
            </button>
          )}
        </div>
      </div>
    ),
  };

  return (
    <OpenUiProvider>
      <div className="time-capsule-play-area mx2 mx2-cat-social">
        <PlayStage
          category="social"
          stage={{
            eyebrow: t("vaultEyebrow"),
            title: isSealing ? t("creatingCapsule") : t("createCapsule"),
            subtitle: t("subtitle"),
            badges: (
              <>
                <span className="mx2-badge" data-tone="accent">
                  <span className="mx2-badge__dot" /> {daysNumber} {t("daysShort")}
                </span>
                <span className="mx2-badge">{selectedCategory ? t(selectedCategory.key) : t("categoryPersonal")}</span>
                {isLoading && <span className="mx2-badge">{t("fishCandidatesLoading")}</span>}
              </>
            ),
          }}
          scene={
            <div className="capsule-stage-stack">
              {scene}
              {(pendingOperation || transactionNotice) && (
                <section className="capsule-recovery" aria-live="polite">
                  <div>
                    <strong>{t("recoveryTitle")}</strong>
                    <span>{transactionNotice || t("transactionPending")}</span>
                  </div>
                  {pendingOperation && (
                    <button
                      type="button"
                      className="mx2-btn mx2-btn--ghost"
                      onClick={() => void dispatch("recoverPending")}
                      disabled={isRecovering || isBusy}
                    >
                      {isRecovering ? t("recoveringTransaction") : t("recoverTransaction")}
                    </button>
                  )}
                </section>
              )}
              {!storageHealthy && (
                <section className="capsule-storage-warning" aria-live="polite">
                  <strong>{t("recoveryStorageUnavailableTitle")}</strong>
                  <span>{t("recoveryStorageUnavailable")}</span>
                </section>
              )}
              {composer}
            </div>
          }
          actions={{
            primary: {
              label: isSealing ? t("creatingCapsule") : t("sealCapsuleCta"),
              onClick: handleCreate,
              disabled: !canCreate || isBusy,
              loading: isSealing,
              hint: t("depositShortNote"),
            },
          }}
          drawerToggleLabel={t("sealSettings")}
          drawer={{
            title: t("sealSettings"),
            children: (
              <div className="capsule-drawer">
                <OpenUiSegmented
                  className="capsule-drawer-tabs"
                  label={t("drawerTitle")}
                  onChange={setDrawerTab}
                  options={drawerModes.map((item) => {
                    const Icon = item.Icon;
                    return {
                      value: item.mode,
                      label: (
                        <span className="capsule-drawer-tab">
                          <span className="capsule-drawer-tabs__icon"><Icon size={15} /></span>
                          <span>{item.label}</span>
                          <strong>{item.value}</strong>
                        </span>
                      ),
                    };
                  })}
                  segmentedClassName="capsule-drawer-tabs__group"
                  value={drawerMode}
                />
                <OpenUiPanel
                  className="capsule-drawer__panel"
                  icon={<ActiveDrawerIcon size={18} />}
                  title={activeDrawerMode.label}
                  subtitle={activeDrawerMode.value}
                >
                  {drawerPanels[drawerMode]}
                </OpenUiPanel>
              </div>
            ),
          }}
        />
      </div>
    </OpenUiProvider>
  );
}
