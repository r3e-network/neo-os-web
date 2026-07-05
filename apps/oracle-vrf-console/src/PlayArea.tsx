import { useEffect, useMemo, useRef, useState } from "react";
import {
  CheckCircle2,
  Copy,
  Dice5,
  Fingerprint,
  KeyRound,
  Minus,
  Plus,
  RefreshCw,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import { useStateBindings } from "@shared/react/hooks/useStateBindings";
import type { ObservableState } from "@shared/react/context";
import type { ConsoleResult } from "@shared/components-react";
import {
  OpenUiNotice,
  OpenUiPanel,
  OpenUiProvider,
  OpenUiSegmented,
  OpenUiTextField,
  PlayStage,
} from "@shared/components-react/v2";
import { consoleConfig, appMeta } from "./appConfig";
import "./PlayArea.scss";

interface PlayAreaProps {
  t: (key: string, p?: Record<string, string | number>) => string;
  state: ObservableState;
  dispatch: (name: string, ...args: unknown[]) => Promise<void>;
  launchContext?: { params?: Record<string, string> };
}

type VrfValues = {
  consumer: string;
  salt: string;
  rounds: string;
  mode: string;
};
type DrawerMode = "seed" | "flow" | "proof" | "payload";

type VrfPreset = VrfValues & {
  key: string;
  label: string;
  hint: string;
};

function defaults(params: Record<string, string> = {}): VrfValues {
  const values = Object.fromEntries(
    consoleConfig.fields.map((field) => [
      field.key,
      params[field.key] ?? field.defaultValue ?? "",
    ]),
  ) as VrfValues;
  return {
    consumer: values.consumer || "miniapp-council",
    salt: values.salt || "vrf:miniapp-round",
    rounds: values.rounds || "1",
    mode: values.mode || "single-proof",
  };
}

function setObservable(state: ObservableState, key: string, value: unknown) {
  state[key]?.set?.(value);
}

function clampRounds(value: string): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return 1;
  return Math.min(10, Math.max(1, Math.floor(parsed)));
}

function shortDigest(value: string, placeholder: string) {
  const text = String(value || "").trim();
  if (!text || text === placeholder) return placeholder;
  if (text.length <= 18) return text;
  return `${text.slice(0, 10)}...${text.slice(-6)}`;
}

export default function PlayArea({ t, state, dispatch, launchContext }: PlayAreaProps) {
  const { str } = useStateBindings(state);
  const networkLabel = str("networkLabel");
  const digestPlaceholder = t("digestPlaceholder");
  const lastStatus = str("lastStatus", t("statusReady"));
  const lastDigest = str("lastDigest", digestPlaceholder);
  const [values, setValues] = useState(() => defaults(launchContext?.params));
  const [result, setResult] = useState<ConsoleResult | null>(null);
  const [drawerMode, setDrawerMode] = useState<DrawerMode>("seed");
  const [building, setBuilding] = useState(false);
  const [copied, setCopied] = useState(false);
  const previewTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  const payloadText = useMemo(
    () => (result ? JSON.stringify(result.payload, null, 2) : ""),
    [result],
  );

  useEffect(() => () => {
    if (previewTimeout.current) clearTimeout(previewTimeout.current);
  }, []);
  useEffect(() => {
    if (drawerMode === "payload" && !payloadText) setDrawerMode("proof");
  }, [drawerMode, payloadText]);

  const rounds = clampRounds(values.rounds);
  const modeLabel = values.mode === "batch-proof" ? t("modeBatch") : t("modeSingle");
  const hasDigest = Boolean(lastDigest && lastDigest !== digestPlaceholder);
  const digestDisplay = shortDigest(lastDigest, digestPlaceholder);
  const presets: VrfPreset[] = [
    {
      key: "game",
      label: t("vrfPresetGame"),
      hint: t("vrfPresetGameHint"),
      consumer: "miniapp-game-engine",
      salt: "match:final-round",
      rounds: "3",
      mode: "single-proof",
    },
    {
      key: "raffle",
      label: t("vrfPresetRaffle"),
      hint: t("vrfPresetRaffleHint"),
      consumer: "community-raffle",
      salt: "raffle:weekly-draw",
      rounds: "1",
      mode: "single-proof",
    },
    {
      key: "loot",
      label: t("vrfPresetLoot"),
      hint: t("vrfPresetLootHint"),
      consumer: "loot-drop",
      salt: "drop:season-pack",
      rounds: "6",
      mode: "batch-proof",
    },
  ];
  const activePreset = presets.find((preset) =>
    values.consumer === preset.consumer
      && values.salt === preset.salt
      && values.rounds === preset.rounds
      && values.mode === preset.mode,
  );
  const drawerModes: Array<{ id: DrawerMode; label: string; value: string; disabled?: boolean }> = [
    { id: "seed", label: t("vrfSeedIdentity"), value: values.consumer || t("consumerPlaceholder") },
    { id: "flow", label: t("vrfFlowTitle"), value: modeLabel },
    { id: "proof", label: t("vrfProofPreview"), value: hasDigest ? digestDisplay : t("vrfEmptyTitle") },
    { id: "payload", label: t("requestId"), value: result?.summary ?? t("vrfEmptyTitle"), disabled: !payloadText },
  ];
  const setDrawerModeSafe = (mode: string) => {
    const nextMode = drawerModes.find((item) => item.id === mode && !item.disabled);
    if (nextMode) setDrawerMode(nextMode.id);
  };

  const update = (key: keyof VrfValues, value: string) => {
    setValues((current) => ({ ...current, [key]: value }));
  };

  const applyPreset = (preset: VrfPreset) => {
    setValues({
      consumer: preset.consumer,
      salt: preset.salt,
      rounds: preset.rounds,
      mode: preset.mode,
    });
    setResult(null);
    setCopied(false);
    setObservable(state, "lastStatus", t("statusReady"));
    setObservable(state, "lastDigest", digestPlaceholder);
  };

  const adjustRounds = (delta: number) => {
    update("rounds", String(Math.min(10, Math.max(1, rounds + delta))));
  };

  const applyResult = (next: ConsoleResult, requestValues: VrfValues) => {
    setResult(next);
    setCopied(false);
    void dispatch("buildRequest", requestValues);
  };

  const buildRequest = () => {
    if (previewTimeout.current) clearTimeout(previewTimeout.current);
    setBuilding(true);
    const next = consoleConfig.buildResult(values, t);
    applyResult(next, values);
    previewTimeout.current = setTimeout(() => {
      setBuilding(false);
      previewTimeout.current = null;
    }, 900);
  };

  const resetTicket = () => {
    if (previewTimeout.current) clearTimeout(previewTimeout.current);
    setBuilding(false);
    setCopied(false);
    setValues(defaults(launchContext?.params));
    setResult(null);
    setObservable(state, "lastStatus", t("statusReady"));
    setObservable(state, "lastDigest", digestPlaceholder);
  };

  const copyPayload = () => {
    if (!payloadText || !navigator.clipboard) return;
    void navigator.clipboard.writeText(payloadText);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1000);
  };

  const scene = (
    <div className="oracle-console-scene" data-state={building ? "building" : hasDigest ? "ready" : "idle"}>
      <figure className="oracle-console-scene__image">
        <img src="./oracle-workspace-stage.webp" alt={t("vrfHeroAlt")} decoding="async" />
        <figcaption>
          <span>{t("vrfTicketTitle")}</span>
          <strong>{activePreset?.label ?? t("vrfRequestPlan")}</strong>
        </figcaption>
      </figure>
      <div className="oracle-console-scene__capsule">
        <div className="oracle-console-scene__beam" aria-hidden="true">
          <span />
          <span />
          <span />
        </div>
        <div className="oracle-console-scene__machine">
          <span className="oracle-console-scene__orb oracle-console-scene__orb--one"><Dice5 size={22} /></span>
          <span className="oracle-console-scene__orb oracle-console-scene__orb--two"><Sparkles size={20} /></span>
          <span className="oracle-console-scene__orb oracle-console-scene__orb--three"><KeyRound size={19} /></span>
          <strong>{rounds}</strong>
          <span>{t("rounds")}</span>
        </div>
        <article className="oracle-console-scene__proof">
          <span className="oracle-console-scene__proof-icon"><ShieldCheck size={22} /></span>
          <div>
            <span>{t("vrfStatusLabel")}</span>
            <strong>{building ? t("buildingRequest") : lastStatus}</strong>
          </div>
          <p>{hasDigest ? digestDisplay : t("vrfEmptyCopy")}</p>
        </article>
      </div>
      <div className="oracle-console-scene__ticket-strip" aria-label={t("vrfTicketTitle")}>
        <span>
          <small>{t("consumer")}</small>
          <strong>{values.consumer || t("consumerPlaceholder")}</strong>
        </span>
        <span>
          <small>{t("rounds")}</small>
          <strong>{rounds} x {modeLabel}</strong>
        </span>
        <span>
          <small>{t("salt")}</small>
          <strong>{values.salt || t("saltPlaceholder")}</strong>
        </span>
      </div>
    </div>
  );

  const controls = (
    <div className="vrf-ticket">
      <section className="vrf-ticket__presets">
        <div className="vrf-ticket__header">
          <span>{t("vrfPresetTitle")}</span>
          <strong>{t("vrfRequestPlan")}</strong>
        </div>
        <div className="vrf-preset-grid">
          {presets.map((preset) => {
            const active = values.consumer === preset.consumer
              && values.salt === preset.salt
              && values.rounds === preset.rounds
              && values.mode === preset.mode;
            return (
              <button
                key={preset.key}
                type="button"
                className={active ? "is-active" : undefined}
                onClick={() => applyPreset(preset)}
                disabled={building}
              >
                <span className="vrf-preset-grid__icon">
                  {preset.key === "game" ? <Dice5 size={17} /> : preset.key === "raffle" ? <Sparkles size={17} /> : <ShieldCheck size={17} />}
                </span>
                <span>
                  <strong>{preset.label}</strong>
                  <small>{preset.hint}</small>
                </span>
              </button>
            );
          })}
        </div>
      </section>

      <div className="vrf-ticket__compose">
        <section className="vrf-ticket__draw">
          <div className="vrf-ticket__header">
            <span>{t("vrfRoundsTitle")}</span>
            <strong>{rounds} / 10</strong>
          </div>
          <div className="vrf-round-stepper">
            <button type="button" onClick={() => adjustRounds(-1)} disabled={building || rounds <= 1} aria-label={t("vrfDecreaseRounds")}>
              <Minus size={16} />
            </button>
            <strong>{rounds}</strong>
            <button type="button" onClick={() => adjustRounds(1)} disabled={building || rounds >= 10} aria-label={t("vrfIncreaseRounds")}>
              <Plus size={16} />
            </button>
          </div>
        </section>

        <section className="vrf-ticket__mode">
          <div className="vrf-ticket__header">
            <span>{t("vrfProofModeTitle")}</span>
            <strong>{modeLabel}</strong>
          </div>
          <OpenUiSegmented
            className="vrf-mode-switch"
            segmentedClassName="vrf-mode-switch__group"
            label={t("mode")}
            value={values.mode}
            onChange={(mode) => update("mode", mode)}
            disabled={building}
            options={[
              {
                value: "single-proof",
                label: (
                  <span className="vrf-mode-card">
                    <strong>{t("modeSingle")}</strong>
                    <small>{t("modeSingleHint")}</small>
                  </span>
                ),
              },
              {
                value: "batch-proof",
                label: (
                  <span className="vrf-mode-card">
                    <strong>{t("modeBatch")}</strong>
                    <small>{t("modeBatchHint")}</small>
                  </span>
                ),
              },
            ]}
          />
        </section>
      </div>

      <section className="vrf-ticket__seed-summary">
        <div className="vrf-ticket__header">
          <span>{t("vrfSeedIdentity")}</span>
          <strong>{t("vrfProofPreview")}</strong>
        </div>
        <div className="vrf-seed-summary">
          <span>
            <Fingerprint size={14} />
            <strong>{values.consumer || t("consumerPlaceholder")}</strong>
          </span>
          <span>
            <KeyRound size={14} />
            <strong>{values.salt || t("saltPlaceholder")}</strong>
          </span>
        </div>
      </section>
    </div>
  );

  const drawer = (
    <div className="vrf-drawer">
      <OpenUiSegmented
        className="vrf-drawer__switcher"
        segmentedClassName="vrf-drawer__switcher-group"
        label={t("vrfProofPreview")}
        value={drawerMode}
        onChange={setDrawerModeSafe}
        options={drawerModes.map((mode) => ({
          value: mode.id,
          disabled: mode.disabled,
          label: (
            <span className="vrf-drawer-tab">
              <span>{mode.label}</span>
              <strong>{mode.value}</strong>
            </span>
          ),
        }))}
      />

      {drawerMode === "seed" && (
        <OpenUiPanel
          className="vrf-drawer__panel vrf-drawer__panel--wide"
          icon={<Fingerprint size={18} strokeWidth={2.4} aria-hidden="true" />}
          title={t("vrfSeedIdentity")}
          subtitle={t("vrfSeedIdentityCopy")}
        >
          <div className="vrf-seed-grid">
            <OpenUiTextField
              className="vrf-field"
              label={<><Fingerprint size={14} /> {t("consumer")}</>}
              value={values.consumer}
              onChange={(event) => update("consumer", event.target.value)}
              placeholder={t("consumerPlaceholder")}
              hint={t("vrfConsumerHint")}
              disabled={building}
              mono
              spellCheck={false}
            />
            <OpenUiTextField
              className="vrf-field"
              label={<><KeyRound size={14} /> {t("salt")}</>}
              value={values.salt}
              onChange={(event) => update("salt", event.target.value)}
              placeholder={t("saltPlaceholder")}
              hint={t("vrfSaltHint")}
              disabled={building}
              mono
              spellCheck={false}
            />
          </div>
        </OpenUiPanel>
      )}

      {drawerMode === "flow" && (
        <OpenUiPanel
          className="vrf-drawer__panel"
          icon={<ShieldCheck size={18} strokeWidth={2.4} aria-hidden="true" />}
          title={t("vrfFlowTitle")}
          subtitle={t("vrfFlowVerifyDesc")}
        >
          <ol className="vrf-flow">
            <li><strong>{t("vrfFlowSeed")}</strong><span>{t("vrfFlowSeedDesc")}</span></li>
            <li><strong>{t("vrfFlowDraw")}</strong><span>{t("vrfFlowDrawDesc")}</span></li>
            <li><strong>{t("vrfFlowVerify")}</strong><span>{t("vrfFlowVerifyDesc")}</span></li>
          </ol>
        </OpenUiPanel>
      )}

      {drawerMode === "proof" && (
        <OpenUiPanel
          className="vrf-drawer__panel"
          icon={<Sparkles size={18} strokeWidth={2.4} aria-hidden="true" />}
          title={t("vrfProofPreview")}
          subtitle={result ? t("vrfReady") : t("vrfEmptyTitle")}
        >
          {result ? (
            <dl className="vrf-result">
              {result.rows.map((row) => (
                <div key={row.label}>
                  <dt>{row.label}</dt>
                  <dd>{row.value}</dd>
                </div>
              ))}
            </dl>
          ) : (
            <OpenUiNotice
              className="vrf-empty"
              icon={<Dice5 size={18} strokeWidth={2.4} aria-hidden="true" />}
              title={t("vrfEmptyTitle")}
            >
              {t("vrfEmptyCopy")}
            </OpenUiNotice>
          )}
        </OpenUiPanel>
      )}

      {drawerMode === "payload" && payloadText && (
        <OpenUiPanel
          className="vrf-drawer__panel vrf-drawer__panel--wide"
          icon={<Copy size={18} strokeWidth={2.4} aria-hidden="true" />}
          title={t("requestId")}
          subtitle={t("vrfProofPreview")}
        >
          <pre className="vrf-payload">{payloadText}</pre>
        </OpenUiPanel>
      )}
    </div>
  );

  return (
    <OpenUiProvider>
      <div className="oracle-console-play-area mx2 mx2-cat-tool">
        <PlayStage
          category="tool"
          stage={{
            eyebrow: t(consoleConfig.eyebrowKey),
            title: t(consoleConfig.titleKey),
            subtitle: t("vrfHeroCopy"),
            badges: <span className="mx2-badge" data-tone="accent"><span className="mx2-badge__dot" /> {networkLabel || appMeta.networkLabel}</span>,
          }}
          scene={<>{scene}{controls}</>}
          score={[
            { label: t("rounds"), value: String(rounds), accent: true },
            { label: t("lastStatus"), value: lastStatus },
            { label: t("statDigest"), value: digestDisplay },
          ]}
          actions={{
            primary: {
              label: t("runAction"),
              icon: <Sparkles size={17} />,
              onClick: buildRequest,
              loading: building,
            },
            secondary: [
              {
                label: t("reset"),
                icon: <RefreshCw size={15} />,
                onClick: resetTicket,
                disabled: building,
              },
              {
                label: copied ? t("copied") : t("copy"),
                icon: copied ? <CheckCircle2 size={15} /> : <Copy size={15} />,
                onClick: copyPayload,
                disabled: !payloadText || building,
              },
            ],
          }}
          drawerToggleLabel={t("vrfProofPreview")}
          drawer={{ title: t("vrfProofPreview"), children: drawer }}
        />
      </div>
    </OpenUiProvider>
  );
}
