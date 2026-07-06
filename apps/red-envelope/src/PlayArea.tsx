/**
 * PlayArea.tsx -- Red Envelope (v2 scene-driven rebuild)
 *
 * The envelope IS the scene: a festive packet you tap to open (claim), with a
 * burst of lucky coins on a win. Create is a secondary builder. Envelopes,
 * recovery, and transaction safety are tucked into a drawer. Warm festive game
 * identity, high contrast. Chain logic (useRedEnvelope) is untouched.
 */
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useStateBindings } from "@shared/react/hooks/useStateBindings";
import type { Observable } from "@shared/react/context";
import type { MiniAppLaunchContext } from "@shared/utils/launch-params";
import { CoinArt, ParticleBurst } from "@shared/art";
import { OpenUiPanel, OpenUiProvider, PlayStage } from "@shared/components-react/v2";
import { ArchiveRestore, Gift, History, Send, ShieldCheck, Ticket, type LucideIcon } from "lucide-react";
import "./PlayArea.scss";

const claimCardImageUrl = new URL("../public/red-envelope-claim-card.webp", import.meta.url).href;

interface PlayAreaProps {
  t: (key: string, params?: Record<string, string | number>) => string;
  state: Record<string, Observable>;
  dispatch: (name: string, ...args: unknown[]) => Promise<void>;
  launchContext: MiniAppLaunchContext;
}

interface Envelope {
  id: string;
  totalAmount?: number;
  amount?: number;
  packetCount?: number;
  count?: number;
  openedCount?: number;
  remainingAmount?: number;
  remainingPackets?: number;
  remaining?: number;
  active?: boolean;
  canOpen?: boolean;
  ready?: boolean;
  expired?: boolean;
  depleted?: boolean;
  reclaimable?: boolean;
  status?: string;
  creator?: string;
  from?: string;
  memo?: string;
  message?: string;
  bestLuckAddress?: string;
  bestLuckAmount?: number;
}

interface Claim {
  id: string;
  poolId?: string;
  envelopeId?: string;
  holder?: string;
  claimer?: string;
  amount?: number;
}

type DrawerMode = "active" | "claims" | "reclaim" | "safety";

function formatGas(value: unknown): string {
  const n = Number(value ?? 0);
  if (!Number.isFinite(n)) return "0 GAS";
  return `${n.toLocaleString(undefined, { maximumFractionDigits: 4 })} GAS`;
}

function getLaunchEnvelopeId(context: MiniAppLaunchContext): string {
  const params = context.params ?? {};
  return String(params.envelopeId || params.poolId || params.id || params.packet || "").trim();
}

function getLaunchCreateForm(context: MiniAppLaunchContext) {
  const params = context.params ?? {};
  return {
    amount: String(params.amount || "1"),
    count: String(params.count || params.packetCount || "8"),
    expiryHours: String(params.expiryHours || params.expiry || "24"),
  };
}

const AMOUNT_PRESETS = ["0.5", "1", "3"];
const PACKET_PRESETS = ["4", "8", "16"];
const EXPIRY_PRESETS = ["12", "24", "72"];
const CLAIM_CARD_IMAGE = claimCardImageUrl;

export default function PlayArea({ t, state, dispatch, launchContext }: PlayAreaProps) {
  const { bool, val } = useStateBindings(state);
  const isLoading = bool("isLoading");
  const luckyMessage = val<{ amount?: number; from?: string } | null>("luckyMessage", null);
  const openingId = val<string | null>("openingId", null);
  const envelopes = (val("envelopes") ?? []) as Envelope[];
  const claims = (val("claims") ?? []) as Claim[];
  const prepaidCredit = val<number>("prepaidCredit", 0) ?? 0;
  const lastCreatedEnvelopeId = val<string>("lastCreatedEnvelopeId", "") ?? "";

  const launchedEnvelopeId = getLaunchEnvelopeId(launchContext);
  const launchedCreateForm = useMemo(() => getLaunchCreateForm(launchContext), [launchContext]);

  const [mode, setMode] = useState<"claim" | "create">("claim");
  const [drawerMode, setDrawerMode] = useState<DrawerMode>("active");
  const [selectedEnvelopeId, setSelectedEnvelopeId] = useState(launchedEnvelopeId);
  const [claimIdInput, setClaimIdInput] = useState(launchedEnvelopeId);
  const [createForm, setCreateForm] = useState(launchedCreateForm);
  const [openPreview, setOpenPreview] = useState(false);
  const [sendPreview, setSendPreview] = useState(false);
  const openPreviewTimeout = useRef<number | null>(null);
  const sendPreviewTimeout = useRef<number | null>(null);
  const didHydrateDefaultClaim = useRef(Boolean(launchedEnvelopeId));

  const activeEnvelopes = envelopes.filter((env) => {
    if (env.active === false) return false;
    return env.status === "active" || env.status === undefined || env.active === true;
  });
  const activeEnvelopeIds = activeEnvelopes.map((env) => env.id).join("|");
  const firstActiveEnvelopeId = activeEnvelopes[0]?.id ?? "";
  const reclaimableEnvelopes = envelopes.filter((env) => env.reclaimable);

  useEffect(() => {
    if (launchedEnvelopeId) {
      setSelectedEnvelopeId(launchedEnvelopeId);
      setClaimIdInput(launchedEnvelopeId);
    }
  }, [launchedEnvelopeId]);
  useEffect(() => {
    if (!launchedEnvelopeId && !didHydrateDefaultClaim.current && !claimIdInput.trim() && firstActiveEnvelopeId) {
      didHydrateDefaultClaim.current = true;
      setSelectedEnvelopeId(firstActiveEnvelopeId);
      setClaimIdInput(firstActiveEnvelopeId);
    }
  }, [activeEnvelopeIds, claimIdInput, firstActiveEnvelopeId, launchedEnvelopeId]);
  useEffect(() => setCreateForm(launchedCreateForm), [launchedCreateForm]);
  useEffect(
    () => () => {
      if (openPreviewTimeout.current !== null) window.clearTimeout(openPreviewTimeout.current);
      if (sendPreviewTimeout.current !== null) window.clearTimeout(sendPreviewTimeout.current);
    },
    [],
  );

  const startOpenPreview = () => {
    if (openPreviewTimeout.current !== null) window.clearTimeout(openPreviewTimeout.current);
    setOpenPreview(true);
    openPreviewTimeout.current = window.setTimeout(() => {
      setOpenPreview(false);
      openPreviewTimeout.current = null;
    }, 1200);
  };
  const startSendPreview = () => {
    if (sendPreviewTimeout.current !== null) window.clearTimeout(sendPreviewTimeout.current);
    setSendPreview(true);
    sendPreviewTimeout.current = window.setTimeout(() => {
      setSendPreview(false);
      sendPreviewTimeout.current = null;
    }, 1100);
  };

  const activeClaimId = (claimIdInput || selectedEnvelopeId || "").trim();
  const targetEnvelope =
    activeEnvelopes.find((env) => String(env.id) === activeClaimId) ??
    envelopes.find((env) => String(env.id) === activeClaimId);
  const claimableGas = activeEnvelopes.reduce(
    (sum, env) => sum + Number(env.remainingAmount ?? env.totalAmount ?? env.amount ?? 0),
    0,
  );

  const createAmount = Number(createForm.amount);
  const createCount = Number(createForm.count);
  const createExpiryHours = Number(createForm.expiryHours);
  const perPacketGas =
    Number.isFinite(createAmount) && Number.isFinite(createCount) && createCount > 0
      ? createAmount / createCount
      : 0;
  const canCreate =
    Number.isFinite(createAmount) &&
    Number.isFinite(createCount) &&
    Number.isFinite(createExpiryHours) &&
    createAmount >= 0.1 &&
    createCount >= 1 &&
    createCount <= 100 &&
    perPacketGas >= 0.01 &&
    createExpiryHours > 0;
  const createError =
    !Number.isFinite(createAmount) || createAmount < 0.1
      ? t("invalidAmount")
      : !Number.isFinite(createCount) || createCount < 1
        ? t("invalidPackets")
        : createCount > 100
          ? t("countExceeded")
          : perPacketGas < 0.01
            ? t("invalidPerPacket")
            : !Number.isFinite(createExpiryHours) || createExpiryHours <= 0
              ? t("invalidExpiry")
              : "";

  const isClaimBusy = isLoading || openingId != null;
  const isOpening = isClaimBusy || openPreview;
  const isPacketRolling = openPreview;
  const isSending = isLoading || sendPreview;
  const canClaim = activeClaimId.length > 0 && !isOpening;
  const drawerModes: Array<{ mode: DrawerMode; label: string; title?: string; value: string; Icon: LucideIcon }> = [
    { mode: "active", label: t("availableEnvelopes"), value: String(activeEnvelopes.length), Icon: Ticket },
    { mode: "claims", label: t("recentClaimsTitle"), value: String(claims.length), Icon: History },
    { mode: "reclaim", label: t("reclaimEnvelope"), title: t("reclaimableTitle"), value: String(reclaimableEnvelopes.length), Icon: ArchiveRestore },
    { mode: "safety", label: t("safetyPanelTitle"), value: t("tokenGas"), Icon: ShieldCheck },
  ];
  const activeDrawerMode = drawerModes.find((item) => item.mode === drawerMode) ?? drawerModes[0];
  const ActiveDrawerIcon = activeDrawerMode.Icon;

  const handleClaim = async () => {
    const id = activeClaimId;
    if (!id || isOpening) return;
    setSelectedEnvelopeId(id);
    setClaimIdInput(id);
    startOpenPreview();
    await dispatch("claimEnvelope", { envelopeId: id });
  };
  const handleCreate = async () => {
    if (!canCreate || isSending) return;
    startSendPreview();
    await dispatch("createEnvelope", {
      amount: createForm.amount,
      count: createForm.count,
      expiryHours: createForm.expiryHours,
    });
  };

  // ----- The scene: a festive red envelope you open -----
  const scene = (
    <div
      className="redenv-scene"
      data-state={mode === "claim" ? (isOpening ? "opening" : luckyMessage ? "lucky" : "ready") : isSending ? "sending" : "ready"}
    >
      {mode === "claim" ? (
        <>
          <button
            type="button"
            key={`env-${selectedEnvelopeId}-${openPreview}-${openingId}`}
            className={["redenv-scene__packet", isPacketRolling ? "redenv-scene__packet--opening mx2-roll" : null]
              .filter(Boolean)
              .join(" ")}
            onClick={() => void handleClaim()}
            disabled={!canClaim}
            aria-label={targetEnvelope ? t("claimTicketReady") : t("claimRedEnvelope")}
          >
            <img className="redenv-scene__packet-art" src={CLAIM_CARD_IMAGE} alt="" aria-hidden="true" />
            <span className="redenv-scene__packet-scrim" aria-hidden="true" />
            <div className="redenv-scene__seal">
              <CoinArt size={36} variant="gas" />
            </div>
            <div className="redenv-scene__packet-label">
              <span>{t("claimTicketTitle")}</span>
              <strong>
                {targetEnvelope
                  ? formatGas(targetEnvelope.remainingAmount ?? targetEnvelope.totalAmount)
                  : activeClaimId
                    ? t("claimTicketPrepared")
                    : t("claimTicketEmpty")}
              </strong>
            </div>
          </button>
          <div className="redenv-scene__ticket">
            <span>{activeClaimId ? activeClaimId.slice(0, 14) : t("scanOrPasteEnvelope")}</span>
            <strong>{targetEnvelope ? t("claimTicketReady") : activeClaimId ? t("claimTicketPrepared") : t("claimTicketEmpty")}</strong>
          </div>
          {luckyMessage && <ParticleBurst coins count={12} />}
          <p className="redenv-scene__status" aria-live="polite">
            {isOpening
              ? t("opening")
              : luckyMessage
                ? t("congratulations")
                : targetEnvelope
                  ? t("claimTicketReadyDesc")
                  : activeClaimId
                    ? t("claimTicketPreparedDesc")
                    : t("claimTicketEmptyDesc")}
          </p>
        </>
      ) : (
        <>
          <button
            type="button"
            className={["redenv-scene__gift", isSending ? "redenv-scene__gift--sending mx2-float" : "mx2-float"].join(" ")}
            onClick={() => void handleCreate()}
            disabled={!canCreate || isSending}
            aria-label={t("sendRedEnvelope")}
          >
            <img className="redenv-scene__gift-art" src={CLAIM_CARD_IMAGE} alt="" aria-hidden="true" />
            <span className="redenv-scene__packet-scrim" aria-hidden="true" />
            <div className="redenv-scene__gift-copy">
              <span>{t("giftMachineTitle")}</span>
              <strong>{formatGas(createAmount)}</strong>
              <em>{createCount || "?"} {t("packetUnit")} / {createExpiryHours || "?"}{t("hoursSuffix")}</em>
            </div>
            <div className="redenv-scene__gift-stack" aria-hidden="true">
              <CoinArt size={34} variant="gas" />
              <CoinArt size={34} variant="gas" />
              <CoinArt size={34} variant="gas" />
            </div>
          </button>
          {isSending && <ParticleBurst coins count={10} />}
          <p className="redenv-scene__status" aria-live="polite">
            {isSending ? t("sendingRedEnvelope") : canCreate ? t("createReadyDesc") : t("adjustEnvelopeSetup")}
          </p>
        </>
      )}

      {/* mode switch */}
      <div className="redenv-scene__tabs" role="tablist" aria-label={t("title")}>
        <button
          type="button"
          role="tab"
          id="redenv-tab-claim"
          aria-selected={mode === "claim"}
          tabIndex={mode === "claim" ? 0 : -1}
          className={["redenv-tab", mode === "claim" ? "redenv-tab--active" : null].filter(Boolean).join(" ")}
          onClick={() => setMode("claim")}
        >
          {t("claimTab")}
        </button>
        <button
          type="button"
          role="tab"
          id="redenv-tab-create"
          aria-selected={mode === "create"}
          tabIndex={mode === "create" ? 0 : -1}
          className={["redenv-tab", mode === "create" ? "redenv-tab--active" : null].filter(Boolean).join(" ")}
          onClick={() => setMode("create")}
        >
          {t("createTab")}
        </button>
      </div>
    </div>
  );

  // ----- Primary interaction controls (under the scene) -----
  const controls =
    mode === "claim" ? (
      <div className="redenv-claim-controls">
        <label className="redenv-ticket-dock">
          <span>{t("claimTicketTitle")}</span>
          <input
            className="redenv-id-input"
            value={claimIdInput}
            onChange={(e) => {
              setClaimIdInput(e.target.value);
              setSelectedEnvelopeId(e.target.value);
            }}
            placeholder={t("enterPoolId")}
            disabled={isOpening}
          />
        </label>
        <div className="redenv-pool-chips">
          {activeEnvelopes.slice(0, 4).map((env) => (
            <button
              key={env.id}
              type="button"
              className={["redenv-pool-chip", selectedEnvelopeId === env.id ? "redenv-pool-chip--active" : null]
                .filter(Boolean).join(" ")}
              onClick={() => {
                setSelectedEnvelopeId(env.id);
                setClaimIdInput(env.id);
              }}
              disabled={isOpening}
            >
              <span>{env.id.slice(0, 8)}…</span>
              <strong>{formatGas(env.remainingAmount ?? env.totalAmount)}</strong>
            </button>
          ))}
        </div>
      </div>
    ) : (
      <div className="redenv-create-controls">
        <div className="redenv-presets" aria-label={t("giftMachineTitle")}>
          <div className="redenv-presets__group">
            <span className="redenv-presets__label">{t("totalGas")}</span>
            <div className="redenv-presets__chips">
              {AMOUNT_PRESETS.map((p) => (
                <button
                  key={p}
                  type="button"
                  className={["redenv-preset", createForm.amount === p ? "redenv-preset--active" : null].filter(Boolean).join(" ")}
                  aria-label={`${t("totalGas")} ${p} GAS`}
                  onClick={() => setCreateForm((f) => ({ ...f, amount: p }))}
                >
                  {p}
                </button>
              ))}
            </div>
          </div>
          <div className="redenv-presets__group">
            <span className="redenv-presets__label">{t("packetCount")}</span>
            <div className="redenv-presets__chips">
              {PACKET_PRESETS.map((p) => (
                <button
                  key={p}
                  type="button"
                  className={["redenv-preset", createForm.count === p ? "redenv-preset--active" : null].filter(Boolean).join(" ")}
                  aria-label={t("packetPreset", { count: p })}
                  onClick={() => setCreateForm((f) => ({ ...f, count: p }))}
                >
                  {p}
                </button>
              ))}
            </div>
          </div>
          <div className="redenv-presets__group">
            <span className="redenv-presets__label">{t("expiryHours")}</span>
            <div className="redenv-presets__chips">
              {EXPIRY_PRESETS.map((p) => (
                <button
                  key={p}
                  type="button"
                  className={["redenv-preset", createForm.expiryHours === p ? "redenv-preset--active" : null].filter(Boolean).join(" ")}
                  aria-label={t("hourPreset", { hours: p })}
                  onClick={() => setCreateForm((f) => ({ ...f, expiryHours: p }))}
                >
                  {p}{t("hoursSuffix")}
                </button>
              ))}
            </div>
          </div>
        </div>
        {createError && <p className="redenv-create-error" role="alert">{createError}</p>}
        <p className="redenv-create-summary">
          {t("perPacketLabel")}: <strong>{perPacketGas > 0 ? formatGas(perPacketGas) : "—"}</strong>
        </p>
      </div>
    );

  const stageTitle =
    mode === "claim"
      ? isOpening
        ? t("opening")
        : luckyMessage
          ? t("congratulations")
          : t("claimRedEnvelope")
	      : isSending
	        ? t("sendingRedEnvelope")
	        : t("sendRedEnvelope");

  const drawerPanels: Record<DrawerMode, ReactNode> = {
    active: (
      <div className="redenv-drawer__panel-body" data-mode="active">
        <div className="redenv-drawer__summary">
          <span>{t("claimTicketEmptyDesc")}</span>
          <strong>{formatGas(claimableGas)}</strong>
        </div>
        {activeEnvelopes.length > 0 ? (
          <ul className="mx2-history redenv-drawer-list">
            {activeEnvelopes.slice(0, 8).map((env) => (
              <li key={env.id} className="mx2-history__item redenv-drawer-list__item">
                <span className="mx2-history__face">{env.id.slice(0, 10)}…</span>
                <span className="mx2-history__stake">{formatGas(env.remainingAmount ?? env.totalAmount)}</span>
                <span className="mx2-history__result">{env.remainingPackets ?? env.packetCount ?? "?"} {t("packetCount").toLowerCase()}</span>
              </li>
            ))}
          </ul>
        ) : (
          <div className="redenv-drawer__empty">{t("noEnvelopes")}</div>
        )}
      </div>
    ),
    claims: (
      <div className="redenv-drawer__panel-body" data-mode="claims">
        <div className="redenv-drawer__summary">
          <span>{t("noActivityCopy")}</span>
          <strong>{claims.length}</strong>
        </div>
        {claims.length > 0 ? (
          <ul className="mx2-history redenv-drawer-list">
            {claims.slice(0, 5).map((claim) => (
              <li key={claim.id} className="mx2-history__item redenv-drawer-list__item" data-outcome="won">
                <span className="mx2-history__face">{(claim.envelopeId ?? claim.id).slice(0, 10)}…</span>
                <span className="mx2-history__result">{formatGas(claim.amount)}</span>
              </li>
            ))}
          </ul>
        ) : (
          <div className="redenv-drawer__empty">{t("noActivity")}</div>
        )}
      </div>
    ),
    reclaim: (
      <div className="redenv-drawer__panel-body" data-mode="reclaim">
        <div className="redenv-drawer__summary">
          <span>{t("reclaimableTitle")}</span>
          <strong>{reclaimableEnvelopes.length}</strong>
        </div>
        {reclaimableEnvelopes.length > 0 ? (
          <ul className="mx2-history redenv-drawer-list">
            {reclaimableEnvelopes.map((env) => (
              <li key={env.id} className="mx2-history__item redenv-drawer-list__item">
                <span className="mx2-history__face">{env.id.slice(0, 10)}…</span>
                <button
                  type="button"
                  className="mx2-btn mx2-btn--ghost"
                  onClick={() => void dispatch("reclaimEnvelope", { envelopeId: env.id })}
                >
                  {t("reclaimEnvelope")}
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <div className="redenv-drawer__empty">{t("noActivity")}</div>
        )}
      </div>
    ),
    safety: (
      <div className="redenv-drawer__panel-body" data-mode="safety">
        <div className="redenv-safety-card">
          <ShieldCheck size={18} aria-hidden="true" />
          <span>{t("safetyPanelCopy")}</span>
        </div>
        <div className="redenv-route">
          <span>{t("contractRoute")}</span>
          <code>{t("claimContractRoute")}</code>
        </div>
      </div>
    ),
  };

  return (
    <OpenUiProvider>
    <div className="redenv-play-area mx2 mx2-cat-game">
      <PlayStage
        category="game"
        stage={{
          eyebrow: t("title"),
          title: stageTitle,
          subtitle: t("subtitle"),
          badges: (
            <>
              <span className="mx2-badge" data-tone="accent">
                <span className="mx2-badge__dot" /> {t("tokenGas")}
              </span>
              {claimableGas > 0 && (
                <span className="mx2-badge">
                  <CoinArt size={14} variant="gas" /> {formatGas(claimableGas)}
                </span>
              )}
            </>
          ),
        }}
        scene={
          <>
            {scene}
            {controls}
          </>
        }
        score={
          mode === "claim"
            ? [
                { label: t("availableEnvelopes"), value: String(activeEnvelopes.length), accent: activeEnvelopes.length > 0 },
                { label: t("claimablePool"), value: formatGas(claimableGas) },
                { label: t("recentClaimsTitle"), value: String(claims.length) },
              ]
            : [
                { label: t("totalGas"), value: formatGas(createAmount), accent: true },
                { label: t("packetCount"), value: String(createCount) },
                { label: t("perPacketLabel"), value: formatGas(perPacketGas) },
              ]
        }
        actions={{
          primary: {
            label: mode === "claim" ? (isOpening ? t("opening") : t("claimNow")) : isSending ? t("sendingRedEnvelope") : t("sendRedEnvelope"),
            onClick: () => void (mode === "claim" ? handleClaim() : handleCreate()),
            disabled: mode === "claim" ? !canClaim : !canCreate || isSending,
            loading: mode === "claim" ? isOpening : isSending,
            icon: mode === "claim" ? <Gift size={18} aria-hidden="true" /> : <Send size={18} aria-hidden="true" />,
          },
          secondary: [
            ...(lastCreatedEnvelopeId
              ? [{ label: t("copyShareLink"), onClick: () => void dispatch("shareEnvelope", {}), hint: t("shareHint") }]
              : []),
            ...(prepaidCredit > 0
              ? [{ label: t("withdrawCredit"), onClick: () => void dispatch("withdrawCredit", {}), hint: t("prepaidCreditLabel") }]
              : []),
          ],
        }}
        drawerToggleLabel={t("myEnvelopes")}
        drawer={{
          title: t("myEnvelopes"),
          children: (
            <div className="redenv-drawer">
              <div className="redenv-drawer-tabs" role="tablist" aria-label={t("myEnvelopes")}>
                {drawerModes.map((item) => {
                  const Icon = item.Icon;
                  return (
                    <button
                      key={item.mode}
                      type="button"
                      role="tab"
                      aria-selected={drawerMode === item.mode}
                      className={drawerMode === item.mode ? "is-active" : undefined}
                      onClick={() => setDrawerMode(item.mode)}
                    >
                      <span className="redenv-drawer-tabs__icon"><Icon size={15} /></span>
                      <span>{item.label}</span>
                      <strong>{item.value}</strong>
                    </button>
                  );
                })}
              </div>
              <OpenUiPanel
                className="redenv-drawer__panel"
                icon={<ActiveDrawerIcon size={18} />}
                title={activeDrawerMode.title ?? activeDrawerMode.label}
                subtitle={activeDrawerMode.value}
              >
                {drawerPanels[drawerMode]}
              </OpenUiPanel>
            </div>
          ),
        }}
      />

      {/* Lucky modal overlay */}
      {luckyMessage && (
        <div className="redenv-lucky-modal" role="dialog" aria-modal="true" aria-label={t("congratulations")}>
          <div className="redenv-lucky-modal__card mx2-rise-in">
            <ParticleBurst coins count={14} />
            <CoinArt size={56} variant="gas" className="mx2-float" />
            <h3>{t("congratulations")}</h3>
            <p className="redenv-lucky-modal__amount">{formatGas(luckyMessage.amount)}</p>
            {luckyMessage.from && (
              <p className="redenv-lucky-modal__from">{t("fromLabel")}: {luckyMessage.from.slice(0, 12)}…</p>
            )}
            <button type="button" className="mx2-btn mx2-btn--primary" onClick={() => void dispatch("dismissOverlay")}>
              {t("luckyReceivedClose")}
            </button>
          </div>
        </div>
      )}
    </div>
    </OpenUiProvider>
  );
}
