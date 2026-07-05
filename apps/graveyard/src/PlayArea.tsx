/**
 * PlayArea.tsx - Graveyard
 *
 * NFT/social identity. The primary surface is a bright memory-vault ritual:
 * compose or paste a target, review the fee and hash seal, then bury it
 * on-chain. History, forgetting, and epitaph editing stay in the drawer so the
 * first screen feels like an app instead of a textarea form.
 */
import { useEffect, useMemo, useRef, useState } from "react";
import {
  Archive,
  BadgeCheck,
  FileText,
  Hash,
  History,
  PenLine,
  RefreshCw,
  ShieldAlert,
  Sparkles,
  Trash2,
  X,
} from "lucide-react";
import { useStateBindings } from "@shared/react/hooks/useStateBindings";
import type { ObservableState } from "@shared/react/context";
import { CoinArt, ParticleBurst } from "@shared/art";
import { PlayStage } from "@shared/components-react/v2";
import type { HistoryItem } from "./types";
import "./PlayArea.scss";

interface P {
  t: (k: string, p?: Record<string, string | number>) => string;
  state: ObservableState;
  dispatch: (n: string, ...a: unknown[]) => Promise<void>;
}

interface MemoryTypeOption {
  value: number;
  label: string;
}

const MEMORY_VAULT_IMAGE = "memory-vault-stage.webp";
const DEFAULT_MEMORY_TYPES: MemoryTypeOption[] = [
  { value: 1, label: "Secret" },
  { value: 2, label: "Regret" },
  { value: 3, label: "Wish" },
  { value: 4, label: "Confession" },
  { value: 5, label: "Other" },
];

function compactHash(value: unknown, empty = "-") {
  const text = String(value ?? "").trim();
  if (!text) return empty;
  return text.length > 22 ? `${text.slice(0, 12)}...${text.slice(-7)}` : text;
}

function shortTime(value: unknown) {
  const text = String(value ?? "").trim();
  if (!text) return "-";
  return text.length > 22 ? `${text.slice(0, 19)}...` : text;
}

export default function PlayArea({ t, state, dispatch }: P) {
  const { str, bool, num, val } = useStateBindings(state);

  const totalDestroyed = num("totalDestroyed");
  const burialFeesPaid = str("burialFeesPaid", "0");
  const gasReclaimedDisplay = str("gasReclaimedDisplay", "0 GAS");
  const burialFeeDisplay = str("burialFeeDisplay", "0.1 GAS");
  const forgetFeeDisplay = str("forgetFeeDisplay", "1 GAS");
  const historyCount = num("historyCount");
  const isDestroying = bool("isDestroying");
  const isLoading = bool("isLoading");
  const historyTruncated = bool("historyTruncated");
  const showAllHistory = bool("showAllHistory");
  const forgetConfirmId = str("forgetConfirmId");
  const forgettingId = str("forgettingId");
  const epitaphDraftId = str("epitaphDraftId");
  const epitaphText = str("epitaphText");
  const epitaphSavingId = str("epitaphSavingId");
  const assetHash = str("assetHash");
  const composeMode = str("composeMode", "write") as "write" | "hash";
  const savedMemoryText = str("memoryText");
  const memoryType = num("memoryType", 1);
  const history = (val("history") ?? []) as HistoryItem[];
  const memoryTypeOptions = (val("memoryTypeOptions") ?? DEFAULT_MEMORY_TYPES) as MemoryTypeOption[];

  const [draftMemory, setDraftMemory] = useState(savedMemoryText);
  const [destroyPreview, setDestroyPreview] = useState(false);
  const destroyPreviewTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    setDraftMemory(savedMemoryText);
  }, [savedMemoryText]);

  useEffect(() => () => {
    if (destroyPreviewTimeout.current) clearTimeout(destroyPreviewTimeout.current);
  }, []);

  const selectedType = useMemo(
    () => memoryTypeOptions.find((option) => Number(option.value) === memoryType) ?? memoryTypeOptions[0] ?? DEFAULT_MEMORY_TYPES[0],
    [memoryType, memoryTypeOptions],
  );

  const hasDraft = draftMemory.trim().length > 0;
  const hasTargetHash = assetHash.trim().length > 0;
  const busy = isDestroying || destroyPreview;
  const sceneState = busy ? "burying" : hasDraft || hasTargetHash ? "ready" : "idle";

  const setComposeMode = (mode: "write" | "hash") => {
    state.composeMode?.set(mode);
    void dispatch("setComposeMode", mode);
  };

  const setMemoryType = (next: number) => {
    state.memoryType?.set(next);
  };

  const handleDraftChange = (next: string) => {
    setDraftMemory(next);
    state.memoryText?.set(next);
  };

  const syncDraft = () => {
    void dispatch("setMemoryText", draftMemory);
  };

  const startDestroyPreview = () => {
    if (destroyPreviewTimeout.current) clearTimeout(destroyPreviewTimeout.current);
    setDestroyPreview(true);
    destroyPreviewTimeout.current = setTimeout(() => {
      setDestroyPreview(false);
      destroyPreviewTimeout.current = null;
    }, 1500);
  };

  const handleDestroy = () => {
    syncDraft();
    startDestroyPreview();
    void dispatch("executeDestroy");
  };

  const handleRefresh = () => {
    void dispatch("refreshRecords");
  };

  const scene = (
    <div className="graveyard-scene" data-state={sceneState} data-mode={composeMode}>
      <section className="graveyard-vault" aria-label={t("memoryVaultStage")}>
        <div className="graveyard-vault__media">
          <img className="graveyard-vault__image" src={MEMORY_VAULT_IMAGE} alt="" aria-hidden="true" />
        </div>
        <span className="graveyard-vault__media-chip">
          <Sparkles size={14} />
          {t("memoryVaultStage")}
        </span>

        <div className="graveyard-vault__seal">
          <span className="graveyard-vault__seal-icon">
            {busy ? <Trash2 size={22} /> : hasDraft || hasTargetHash ? <BadgeCheck size={22} /> : <Archive size={22} />}
          </span>
          <span>
            <em>{selectedType.label}</em>
            <strong>{hasTargetHash ? compactHash(assetHash) : hasDraft ? t("hashReady") : t("sealEmpty")}</strong>
          </span>
        </div>
      </section>

      <section className="graveyard-review" aria-label={t("burialReview")}>
        <div className="graveyard-review__head">
          <span>{t("burialReview")}</span>
          <strong>{busy ? t("destroying") : hasDraft || hasTargetHash ? t("hashReady") : t("hashMissing")}</strong>
        </div>

        <div className="graveyard-review__grid">
          <div className="graveyard-review__item" data-ready={hasDraft || hasTargetHash ? "true" : undefined}>
            <Hash size={16} />
            <span>{t("hashPreview")}</span>
            <strong>{hasTargetHash ? compactHash(assetHash) : hasDraft ? t("hashReadyCopy") : t("hashPending")}</strong>
          </div>
          <div className="graveyard-review__item" data-ready="true">
            <FileText size={16} />
            <span>{t("selectedType")}</span>
            <strong>{selectedType.label}</strong>
          </div>
          <div className="graveyard-review__item" data-ready="true">
            <CoinArt size={20} variant="gas" />
            <span>{t("burialFee")}</span>
            <strong>{burialFeeDisplay}</strong>
          </div>
        </div>

        <p className="graveyard-review__warning">
          <ShieldAlert size={16} />
          {t("sunkFeeNote")}
        </p>
        {busy && <ParticleBurst coins count={8} />}
      </section>
    </div>
  );

  const controls = (
    <section className="graveyard-console" aria-label={t("memoryConsole")}>
      <div className="graveyard-console__mode" role="tablist" aria-label={t("memoryConsole")}>
        {(["write", "hash"] as const).map((mode) => (
          <button
            key={mode}
            type="button"
            role="tab"
            aria-selected={composeMode === mode}
            className={composeMode === mode ? "is-active" : undefined}
            onClick={() => setComposeMode(mode)}
          >
            {mode === "write" ? <PenLine size={16} /> : <Hash size={16} />}
            <span>{mode === "write" ? t("composeModeWrite") : t("composeModeHash")}</span>
          </button>
        ))}
      </div>

      <label className="graveyard-memory-card">
        <span>
          <strong>{composeMode === "write" ? t("memoryTextLabel") : t("assetHash")}</strong>
          <em>{composeMode === "write" ? t("composeModeWriteHint") : t("composeModeHashHint")}</em>
        </span>
        {composeMode === "write" ? (
          <textarea
            className="graveyard-input graveyard-input--textarea"
            value={draftMemory}
            onChange={(event) => handleDraftChange(event.target.value)}
            onBlur={syncDraft}
            placeholder={t("memoryTextPlaceholder")}
            rows={3}
            disabled={busy}
          />
        ) : (
          <input
            className="graveyard-input"
            value={draftMemory}
            onChange={(event) => handleDraftChange(event.target.value)}
            onBlur={syncDraft}
            placeholder={t("assetHashPlaceholder")}
            disabled={busy}
          />
        )}
        <small>{composeMode === "write" ? t("memoryTextHint") : t("assetHashHint")}</small>
      </label>

      <div className="graveyard-type-dock" role="radiogroup" aria-label={t("memoryType")}>
        {memoryTypeOptions.map((option) => (
          <button
            key={option.value}
            type="button"
            role="radio"
            aria-checked={memoryType === Number(option.value)}
            className={memoryType === Number(option.value) ? "is-active" : undefined}
            onClick={() => setMemoryType(Number(option.value))}
            disabled={busy}
          >
            <span>{option.label.slice(0, 1).toUpperCase()}</span>
            {option.label}
          </button>
        ))}
      </div>
    </section>
  );

  const drawer = (
    <div className="graveyard-drawer">
      <section className="graveyard-drawer__section">
        <div className="graveyard-drawer__head">
          <span>{t("recentDestructions")} ({historyCount})</span>
          <button type="button" onClick={handleRefresh} disabled={isLoading}>
            <RefreshCw size={14} />
            {t("refreshRecords")}
          </button>
        </div>
        <p className="graveyard-drawer__note">{t("historyGuidance")}</p>

        {history.length > 0 ? (
          <ul className="graveyard-history">
            {history.slice(0, 12).map((item) => {
              const confirming = forgetConfirmId === item.id;
              const forgetting = forgettingId === item.id;
              const editing = epitaphDraftId === item.id;
              return (
                <li key={item.id} className="graveyard-history__item" data-forgotten={item.forgotten ? "true" : undefined}>
                  <div className="graveyard-history__main">
                    <span className="graveyard-history__icon">
                      {item.forgotten ? <X size={16} /> : <Archive size={16} />}
                    </span>
                    <span>
                      <strong>{compactHash(item.hash || item.id)}</strong>
                      <em>#{item.id} · {shortTime(item.time)}</em>
                    </span>
                  </div>

                  {item.epitaph && <p className="graveyard-history__epitaph">{item.epitaph}</p>}

                  {confirming && (
                    <div className="graveyard-history__confirm">
                      <span>{t("forgetConfirmFee", { fee: forgetFeeDisplay })}</span>
                      <button type="button" onClick={() => void dispatch("forgetMemory", item)} disabled={forgetting}>
                        {forgetting ? t("destroying") : t("forgetConfirmAction")}
                      </button>
                      <button type="button" onClick={() => void dispatch("cancelForget")}>{t("cancel")}</button>
                    </div>
                  )}

                  {editing && (
                    <div className="graveyard-history__editor">
                      <input
                        value={epitaphText}
                        onChange={(event) => void dispatch("setEpitaphText", event.target.value)}
                        placeholder={t("epitaphPlaceholder")}
                      />
                      <button type="button" onClick={() => void dispatch("saveEpitaph", item)} disabled={epitaphSavingId === item.id}>
                        {t("epitaphSave")}
                      </button>
                      <button type="button" onClick={() => void dispatch("cancelEpitaph")}>{t("cancel")}</button>
                    </div>
                  )}

                  <div className="graveyard-history__actions">
                    {!item.forgotten && (
                      <button type="button" onClick={() => void dispatch("requestForget", item)} disabled={forgetting || confirming}>
                        {t("forgetAction")}
                      </button>
                    )}
                    <button type="button" onClick={() => void dispatch("startEpitaph", item)} disabled={editing}>
                      {item.epitaph ? t("editEpitaph") : t("addEpitaph")}
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>
        ) : (
          <div className="graveyard-empty">
            <History size={18} />
            <strong>{t("noDestructions")}</strong>
            <span>{t("noDestructionsHint")}</span>
          </div>
        )}

        {historyTruncated && (
          <button type="button" className="graveyard-drawer__show-all" onClick={() => void dispatch("setShowAllHistory", !showAllHistory)}>
            {showAllHistory ? t("showFewerRecords") : t("showAllRecords")}
          </button>
        )}
      </section>
    </div>
  );

  return (
    <div className="graveyard-play-area mx2 mx2-cat-nft">
      <PlayStage
        category="nft"
        stage={{
          eyebrow: t("destroyAsset"),
          title: t("title"),
          subtitle: t("docSubtitle"),
          badges: (
            <>
              <span className="mx2-badge" data-tone="accent"><span className="mx2-badge__dot" /> {totalDestroyed} {t("records")}</span>
            </>
          ),
        }}
        scene={<>{scene}{controls}</>}
        score={[
          { label: t("totalDestroyed"), value: String(totalDestroyed), accent: true },
          { label: t("destructionStats"), value: `${burialFeesPaid} GAS` },
          { label: t("gasReclaimedEstimate"), value: gasReclaimedDisplay },
        ]}
        actions={{
          primary: {
            label: busy ? t("destroying") : t("destroy"),
            onClick: handleDestroy,
            disabled: busy || !hasDraft,
            loading: busy,
            icon: <Trash2 size={17} />,
          },
          secondary: [
            {
              label: t("refreshRecords"),
              onClick: handleRefresh,
              loading: isLoading,
              icon: <RefreshCw size={16} />,
            },
          ],
        }}
        drawerToggleLabel={t("recentDestructions")}
        drawer={{ title: t("recentDestructions"), children: drawer }}
      />
    </div>
  );
}
