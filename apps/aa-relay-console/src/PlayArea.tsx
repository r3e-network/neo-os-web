/**
 * PlayArea.tsx -- AA Relay Console (v2 scene-driven rebuild)
 *
 * Tool identity. The relay pipeline IS the scene: an AA account flows through a
 * paymaster sponsorship gate, then a relayer broadcasts the validated payload on
 * chain (paid by the paymaster). The three pipeline segments light up
 * segment-by-segment as the account is set, sponsorship resolves, and the relay
 * response lands. The AA address is visible in the primary stage; sponsor
 * preflight + the full payload JSON live in the drawer so the stage shows the
 * relay path, not a parameter form. Real state from useAARelayConsole is bound
 * throughout; the generic "Execute/Ready" template is gone.
 */
import { type ReactNode, useState, useEffect, useRef, useMemo } from "react";
import { useStateBindings } from "@shared/react/hooks/useStateBindings";
import type { ObservableState } from "@shared/react/context";
import { CoinArt } from "@shared/art";
import {
  OpenUiNotice,
  OpenUiPanel,
  OpenUiProvider,
  OpenUiSegmented,
  OpenUiTextArea,
  OpenUiTextField,
  PlayStage,
} from "@shared/components-react/v2";
import { AlertTriangle, CheckCircle2, Code2, Fuel, LoaderCircle, RadioTower, SendHorizontal, type LucideIcon } from "lucide-react";
import "./PlayArea.scss";

interface P {
  t: (k: string, p?: Record<string, string | number>) => string;
  state: ObservableState;
  dispatch: (n: string, ...a: unknown[]) => Promise<void>;
}

const RELAY_STATION_ART = "aa-relay-station.webp";
type DrawerMode = "route" | "sponsor" | "payload";

function compactHash(value: string): string {
  const v = String(value || "").trim();
  if (!v || v === "—" ) return "—";
  if (v.length <= 14) return v;
  return `${v.slice(0, 8)}…${v.slice(-6)}`;
}

/** Parse the stringified sponsor/relay result JSON enough to light the gate. */
function parseSponsor(raw: string): { present: boolean; eligible: boolean } {
  const v = String(raw || "").trim();
  if (!v || v === "{}") return { present: false, eligible: false };
  try {
    const obj = JSON.parse(v);
    if (!obj || typeof obj !== "object") return { present: false, eligible: false };
    const present = true;
    // Tolerate the multiple shapes the AA service returns across envs.
    const eligible =
      obj.approved === true ||
      obj.eligible === true ||
      obj.sponsored === true ||
      obj.ok === true ||
      (typeof obj.txid === "string" && obj.txid.length > 0) ||
      (typeof obj.tx === "string" && obj.tx.length > 0);
    return { present, eligible };
  } catch {
    return { present: false, eligible: false };
  }
}

export default function PlayArea({ t, state, dispatch }: P) {
  const { str, bool } = useStateBindings(state);

  // Live relay runtime state
  const aaAddressDisplay = str("aaAddressDisplay");
  const paymasterDisplay = str("paymasterDisplay");
  const sponsorState = str("sponsorState");
  const relayResponse = str("relayResponse");
  const aaCoreDisplay = str("aaCoreDisplay");
  const relayUrlDisplay = str("relayUrlDisplay");
  const networkDisplay = str("networkDisplay");
  const isCheckingSponsorship = bool("isCheckingSponsorship");
  const isRelaying = bool("isRelaying");

  // Draft relay inputs (local UI state — the real form lives in the composable,
  // populated by dispatch args; this mirrors it for the pipeline preview).
  const [draftAa, setDraftAa] = useState("");
  const [draftDapp, setDraftDapp] = useState("");
  const [draftAmount, setDraftAmount] = useState("0.1");
  const [draftPayload, setDraftPayload] = useState("{}");
  const [drawerMode, setDrawerMode] = useState<DrawerMode>("route");

  // Broadcast pulse: walks the packet down the pipeline on submit, then fires
  // the real submitRelay dispatch.
  const [pulseStep, setPulseStep] = useState(0);
  const pulseTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => { if (pulseTimeout.current) clearTimeout(pulseTimeout.current); }, []);

  const sponsor = useMemo(() => parseSponsor(sponsorState), [sponsorState]);
  const relay = useMemo(() => parseSponsor(relayResponse), [relayResponse]);

  // Payload must be valid JSON before the relay leg is "ready" (the composable
  // parses it; a syntactically-valid default keeps the broadcast from faulting).
  const payloadValid = useMemo(() => {
    try { JSON.parse(draftPayload); return true; } catch { return false; }
  }, [draftPayload]);

  const hasAa = draftAa.trim().length >= 6;
  const sponsorReady = sponsor.present && sponsor.eligible;
  const relayDone = relay.present && (relay.eligible || /\b(txid|tx|hash)\b/i.test(relayResponse));
  const submitReady = hasAa && payloadValid;

  // Pipeline segment readiness — drives lit/unlit.
  const seg = {
    aa: hasAa,
    paymaster: sponsorReady,
    broadcast: relayDone || submitReady,
  };

  const busy = isCheckingSponsorship || isRelaying;

  const handleCheckSponsor = () => {
    void dispatch("checkSponsor", draftAa, draftDapp);
  };
  const handleRequestSponsor = () => {
    void dispatch("requestSponsor", draftAa, draftDapp, draftAmount);
  };
  const handleSubmitRelay = () => {
    if (!submitReady || busy) return;
    if (pulseTimeout.current) clearTimeout(pulseTimeout.current);
    setPulseStep(1);
    const step = (n: number) => {
      setPulseStep(n);
      if (n < 3) {
        pulseTimeout.current = setTimeout(() => step(n + 1), 300);
      } else {
        pulseTimeout.current = setTimeout(() => {
          setPulseStep(0);
          void dispatch("submitRelay", draftAa, draftDapp, draftPayload);
        }, 320);
      }
    };
    step(1);
  };

  const sceneState = isRelaying
    ? "relaying"
    : isCheckingSponsorship
      ? "checking"
      : relayDone
        ? "submitted"
        : sponsorReady
          ? "funded"
          : hasAa
            ? "ready"
            : "idle";

  const statusText = busy
    ? isRelaying ? t("relayBoardRelaying") : t("relayBoardChecking")
    : !hasAa
      ? t("relayBoardDraft")
      : !payloadValid
        ? t("payloadInvalid")
        : relayDone
          ? t("relayBoardSubmitted")
          : sponsorReady
            ? t("relayBoardReady")
            : sponsor.present
              ? t("relayBoardFunding")
              : t("relayBoardSponsor");
  const stateTitle = relayDone
    ? t("relayTxLabel")
    : sponsorReady
      ? t("relayStateTitle")
      : submitReady
        ? t("relaySubmitTitle")
        : hasAa
          ? t("relayNeedsPayload")
          : t("relayNeedsAA");
  const guardCopy = !hasAa
    ? t("relayBlocked")
    : !payloadValid
      ? t("payloadInvalid")
      : t("relaySubmitExplainer");
  const accountCapsuleTitle = hasAa ? t("relayAccountReady") : t("relayAccountWaiting");
  const accountCapsuleDetail = hasAa ? compactHash(draftAa) : t("relayAccountCapsuleHint");
  const drawerModes = [
    { mode: "route" as const, label: t("relayAccountEyebrow"), ready: hasAa },
    { mode: "sponsor" as const, label: t("sponsorCheck"), ready: sponsorReady },
    { mode: "payload" as const, label: t("payloadJson"), ready: payloadValid },
  ];
  const setDrawerModeSafe = (mode: string) => {
    if (drawerModes.some((item) => item.mode === mode)) setDrawerMode(mode as DrawerMode);
  };

  const renderNode = (
    label: string,
    value: string,
    lit: boolean,
    Icon: LucideIcon,
    pulse: boolean,
    tone: "account" | "paymaster" | "payload",
  ) => (
    <div
      className={[
        "relay-scene__node",
        `relay-scene__node--${tone}`,
        lit ? "is-lit" : "",
        pulse ? "is-pulsing" : "",
      ].filter(Boolean).join(" ")}
      data-active={lit ? "true" : undefined}
      data-pulse={pulse ? "true" : undefined}
    >
      <span className="relay-scene__node-icon" aria-hidden="true">
        <Icon size={18} strokeWidth={2.4} />
      </span>
      <span className="relay-scene__node-body">
        <span className="relay-scene__node-label">{label}</span>
        <span className="relay-scene__node-value">{value || "—"}</span>
      </span>
    </div>
  );

  const scene = (
    <div className="relay-scene" data-state={sceneState}>
      <div className="relay-scene__board">
        <div className="relay-scene__account-panel">
          <div className="relay-scene__account-heading">
            <RadioTower size={18} aria-hidden="true" />
            <span>{t("relayAccountEyebrow")}</span>
          </div>
          <div className="relay-scene__account-capsule" data-ready={hasAa ? "true" : undefined}>
            <span className="relay-scene__account-orb" aria-hidden="true">
              <RadioTower size={20} strokeWidth={2.4} />
            </span>
            <span className="relay-scene__account-copy">
              <span>{t("relayAccountCapsule")}</span>
              <strong>{accountCapsuleTitle}</strong>
              <small>{accountCapsuleDetail}</small>
            </span>
          </div>
          <OpenUiSegmented
            className="relay-scene__mode-strip"
            segmentedClassName="relay-scene__mode-strip-group"
            label={t("relayFlowLabel")}
            value={drawerMode}
            onChange={setDrawerModeSafe}
            options={drawerModes.map((item) => ({
              value: item.mode,
              label: (
                <span className="relay-scene__mode-chip" data-ready={item.ready ? "true" : undefined}>
                  <span>{item.label}</span>
                </span>
              ),
            }))}
          />
          <p>{hasAa ? t("aaAddressHint") : t("relayAccountTitle")}</p>
        </div>

        <figure className="relay-scene__station-card" aria-label={t("relayStationLabel")}>
          <img src={RELAY_STATION_ART} alt="" aria-hidden="true" loading="eager" decoding="async" />
          <figcaption>
            <span>{t("relayStationLabel")}</span>
            <strong>{t("relayStationCaption")}</strong>
          </figcaption>
        </figure>

        <div className="relay-scene__line-card">
          <div className="relay-scene__line-heading">
            <CoinArt size={34} variant="gas" decorative />
            <div>
              <span>{t("relayBoardKicker")}</span>
              <strong>{t("relayFlowLabel")}</strong>
            </div>
            <span className="relay-scene__line-status" aria-hidden="true">
              {busy ? <LoaderCircle size={18} /> : <CheckCircle2 size={18} />}
            </span>
          </div>
          <div className="relay-scene__track">
            <div className="relay-scene__rail" aria-hidden="true" />
            {renderNode(t("relayBoardAA"), compactHash(draftAa || aaAddressDisplay), seg.aa, RadioTower, pulseStep === 1, "account")}
            {renderNode(t("relayBoardPaymaster"), paymasterDisplay && paymasterDisplay !== t("unset") ? paymasterDisplay : "", seg.paymaster, Fuel, pulseStep === 2, "paymaster")}
            {renderNode(t("relayBoardPayload"), payloadValid ? t("relayPayloadReady") : t("payloadInvalid"), seg.broadcast, SendHorizontal, pulseStep === 3, "payload")}
          </div>
        </div>

        <div className="relay-scene__state-card">
          <Code2 size={19} aria-hidden="true" />
          <div>
            <span>{t("relayStateLabel")}</span>
            <strong>{stateTitle}</strong>
          </div>
          <p>{statusText}</p>
          <small>
            <AlertTriangle size={14} aria-hidden="true" />
            {guardCopy}
          </small>
        </div>
      </div>
    </div>
  );

  // Payload form + sponsor preflight live in the drawer so the stage stays
  // primary/clean. Fields mirror the composable form; dispatch carries them.
  const drawerPanels: Record<DrawerMode, ReactNode> = {
    route: (
      <OpenUiPanel
        className="relay-drawer__panel relay-drawer__panel--route"
        icon={<RadioTower size={18} strokeWidth={2.4} aria-hidden="true" />}
        title={t("relayAccountEyebrow")}
        subtitle={t("relayStageTitle")}
      >
        <OpenUiTextField
          className="relay-drawer__field"
          label={t("aaAddress")}
          value={draftAa}
          onChange={(e) => setDraftAa(e.target.value)}
          placeholder={t("aaAddressPlaceholder")}
          hint={t("aaAddressHint")}
          mono
          spellCheck={false}
        />
        <OpenUiTextField
          className="relay-drawer__field"
          label={t("dappId")}
          value={draftDapp}
          onChange={(e) => setDraftDapp(e.target.value)}
          placeholder={t("dappIdPlaceholder")}
          hint={t("dappIdHint")}
          mono
          spellCheck={false}
        />
        <dl className="relay-drawer__facts" aria-label={t("relayMetricsLabel")}>
          <div><dt>{t("network")}</dt><dd>{networkDisplay || "—"}</dd></div>
          <div><dt>{t("aaCoreLabel")}</dt><dd>{compactHash(aaCoreDisplay)}</dd></div>
          <div><dt>{t("relayEndpointMetric")}</dt><dd>{relayUrlDisplay || "—"}</dd></div>
          <div><dt>{t("relayBoardAA")}</dt><dd>{(aaAddressDisplay && aaAddressDisplay !== t("notAvailable")) ? compactHash(aaAddressDisplay) : "—"}</dd></div>
        </dl>
      </OpenUiPanel>
    ),

    sponsor: (
      <OpenUiPanel
        className="relay-drawer__panel"
        icon={<Fuel size={18} strokeWidth={2.4} aria-hidden="true" />}
        title={t("sponsorCheck")}
        subtitle={t("sponsorDirectionNote")}
      >
        <OpenUiTextField
          className="relay-drawer__field"
          label={t("sponsorAmount")}
          value={draftAmount}
          onChange={(e) => setDraftAmount(e.target.value)}
          placeholder={t("sponsorAmountPlaceholder")}
          hint={t("sponsorAmountHint")}
          inputMode="decimal"
        />
        <div className="relay-drawer__row">
          <button className="mx2-btn mx2-btn--ghost" type="button" onClick={handleCheckSponsor} disabled={!hasAa}>{t("sponsorCheck")}</button>
          <button className="mx2-btn mx2-btn--ghost" type="button" onClick={handleRequestSponsor} disabled={!hasAa}>{t("sponsorRequest")}</button>
        </div>
      </OpenUiPanel>
    ),

    payload: (
      <OpenUiPanel
        className="relay-drawer__panel relay-drawer__panel--payload"
        icon={<Code2 size={18} strokeWidth={2.4} aria-hidden="true" />}
        title={t("payloadJson")}
        subtitle={payloadValid ? t("relayPayloadReady") : t("payloadInvalid")}
      >
        <OpenUiTextArea
          className="relay-drawer__field relay-drawer__payload mx2-open-field--compact"
          label={t("payloadJson")}
          value={draftPayload}
          onChange={(e) => setDraftPayload(e.target.value)}
          placeholder={t("payloadJsonPlaceholder")}
          hint={payloadValid ? t("relayPayloadReady") : t("payloadInvalid")}
          rows={3}
          spellCheck={false}
        />
        <OpenUiNotice
          className="relay-drawer__notice"
          icon={<SendHorizontal size={18} strokeWidth={2.4} aria-hidden="true" />}
          title={t("relaySubmitTitle")}
          type={payloadValid ? "info" : "warning"}
        >
          {t("relaySubmitExplainer")}
        </OpenUiNotice>
      </OpenUiPanel>
    ),
  };

  const drawer = (
    <div className="relay-drawer">
      <OpenUiSegmented
        className="relay-drawer-tabs"
        segmentedClassName="relay-drawer-tabs__group"
        label={t("relayFlowLabel")}
        value={drawerMode}
        onChange={setDrawerModeSafe}
        options={drawerModes.map((item) => ({
          value: item.mode,
          label: <span className="relay-drawer-tab">{item.label}</span>,
        }))}
      />
      <div className="relay-drawer__panel-shell" data-mode={drawerMode}>
        {drawerPanels[drawerMode]}
      </div>
    </div>
  );

  return (
    <OpenUiProvider>
      <div className="relay-play-area mx2 mx2-cat-tool">
        <PlayStage
          category="tool"
          stage={{
            eyebrow: t("relayStageKicker"),
            title: t("relayHeroTitle"),
            subtitle: t("relayStageTitle"),
          }}
          scene={scene}
          actions={{
            primary: {
              label: t("submitRelay"),
              onClick: handleSubmitRelay,
              loading: busy,
              disabled: !submitReady,
            },
            secondary: [{ label: t("sponsorCheck"), onClick: handleCheckSponsor, disabled: !hasAa || busy }],
          }}
          drawerToggleLabel={t("relayFlowLabel")}
          drawer={{ title: t("relayFlowLabel"), children: drawer }}
        />
      </div>
    </OpenUiProvider>
  );
}
