import { useEffect, useRef, useState, type KeyboardEvent, type ReactNode } from "react";
import { useStateBindings } from "@shared/react/hooks/useStateBindings";
import type { Observable } from "@shared/react/context";
import type { MiniAppLaunchContext } from "@shared/utils/launch-params";
import { PlayStage } from "@shared/components-react/v2";
import { LazyPhaserGameComponent as PhaserGameComponent } from "@framework/phaser/LazyPhaserGameComponent";
import { ArchiveRestore, ChevronDown, History, ShieldCheck, Ticket, WalletCards, X } from "lucide-react";
import "./PlayArea.scss";

interface PlayAreaProps {
  t: (k: string, p?: Record<string, string | number>) => string;
  state: Record<string, Observable>;
  dispatch: (n: string, ...a: unknown[]) => Promise<void>;
  launchContext: MiniAppLaunchContext;
}

interface Envelope {
  id?: string | number;
  totalAmount?: number;
  amount?: number;
  packetCount?: number;
  openedCount?: number;
  remainingAmount?: number;
  remainingPackets?: number;
  active?: boolean;
  canOpen?: boolean;
  ready?: boolean;
  expired?: boolean;
  depleted?: boolean;
  reclaimable?: boolean;
  status?: string;
  from?: string;
  bestLuckAddress?: string;
  bestLuckAmount?: number;
}

interface Claim {
  id?: string;
  poolId?: string;
  envelopeId?: string;
  holder?: string;
  claimer?: string;
  amount?: number;
}

interface Claimability {
  envelopeId: string;
  canClaim: boolean;
}

type DrawerMode = "active" | "claims" | "reclaim" | "safety";

// Match the scene's authored 420×580 logical grid. The surrounding stage may
// grow to 480px on desktop, while Phaser's responsive canvas scaling preserves
// composition and hit targets without changing scene coordinates.
const GAME_CONFIG = { width: 420, height: 580 } as const;
const ACCESSIBLE_PLANS = [
  { key: "lucky", amount: "1", count: "8", expiryHours: "24", labelKey: "scenePlanLucky" },
  { key: "party", amount: "5", count: "20", expiryHours: "72", labelKey: "scenePlanParty" },
  { key: "festival", amount: "10", count: "50", expiryHours: "168", labelKey: "scenePlanFestival" },
] as const;
const loadRedEnvelopeScene = () =>
  import("./scenes/RedEnvelopeScene").then((module) => module.RedEnvelopeScene);

function formatGas(value: unknown, maximumFractionDigits = 4): string {
  const n = Number(value ?? 0);
  if (!Number.isFinite(n) || n <= 0) return "0 GAS";
  return `${n.toLocaleString(undefined, { maximumFractionDigits })} GAS`;
}

function asId(value: unknown): string {
  const id = String(value ?? "").trim();
  return id && id !== "0" ? id : "";
}

function shortId(value: unknown, head = 8, tail = 4): string {
  const id = asId(value);
  if (!id) return "--";
  return id.length > head + tail + 1 ? `${id.slice(0, head)}...${id.slice(-tail)}` : id;
}

function getLaunchEnvelopeId(context: MiniAppLaunchContext): string {
  const params = context.params ?? {};
  return String(params.envelopeId || params.poolId || params.id || params.packet || "").trim();
}

function isEnvelopeOpen(item: Envelope): boolean {
  if (item.active === false || item.ready === false) return false;
  if (item.expired || item.depleted) return false;
  // `canOpen` includes the connected wallet's hasClaimed state. Once the
  // domain layer supplies it, both true and false are authoritative; falling
  // through from false to `active === true` would re-enable an already-claimed
  // or otherwise ineligible envelope.
  if (item.canOpen !== undefined) return item.canOpen;
  return item.status === "active" || item.active === true;
}

function uniqueById(items: Envelope[]): Envelope[] {
  const seen = new Set<string>();
  return items.filter((item) => {
    const id = asId(item.id);
    if (!id || seen.has(id)) return false;
    seen.add(id);
    return true;
  });
}

function envelopeGas(item: Envelope): number {
  return Number(item.remainingAmount ?? item.totalAmount ?? item.amount ?? 0) || 0;
}

function envelopePacketCopy(t: PlayAreaProps["t"], item: Envelope): string {
  const left = Number(item.remainingPackets ?? 0);
  const total = Number(item.packetCount ?? 0);
  if (left > 0 && total > 0) return t("remaining", { remaining: left, total });
  if (left > 0) return `${left} ${t("packetUnit")}`;
  return item.expired ? t("expired") : item.depleted ? t("envelopeEmpty") : t("ready");
}

export default function PhaserPlayArea({ t, state, dispatch, launchContext }: PlayAreaProps) {
  const { bool, str, val } = useStateBindings(state);
  const [drawerMode, setDrawerMode] = useState<DrawerMode>("active");
  const [drawerOpen, setDrawerOpen] = useState(false);
  const drawerRef = useRef<HTMLElement>(null);
  const drawerTriggerRef = useRef<HTMLButtonElement>(null);
  const drawerCloseRef = useRef<HTMLButtonElement>(null);

  const envelopes = (val<Envelope[]>("envelopes", []) ?? []) as Envelope[];
  const claims = (val<Claim[]>("claims", []) ?? []) as Claim[];
  const pools = (val<Envelope[]>("pools", []) ?? []) as Envelope[];
  const openingId = val<string | null>("openingId", null);
  const luckyMessage = val<{ amount?: number; from?: string } | null>("luckyMessage", null);
  const prepaidCredit = val<number>("prepaidCredit", 0) ?? 0;
  const lastCreatedEnvelopeId = str("lastCreatedEnvelopeId", "");
  const envelopeCount = val<number>("envelopeCount", envelopes.length) ?? envelopes.length;
  const claimCount = val<number>("claimCount", claims.length) ?? claims.length;
  const poolCount = val<number>("poolCount", pools.length) ?? pools.length;
  const totalCreated = val<number>("totalCreated", 0) ?? 0;
  const totalClaimed = val<number>("totalClaimed", 0) ?? 0;
  const lastError = str("lastError", "");
  const serviceNotice = str("serviceNotice", "");
  const transactionNotice = str("transactionNotice", "");
  const activeNetwork = str("activeNetwork", "");
  const launchedEnvelopeId = getLaunchEnvelopeId(launchContext);
  const isLoading = bool("isLoading");
  const isCreating = bool("isCreating");
  const isRecovering = bool("isRecovering");
  const isConnectingWallet = bool("isConnectingWallet");
  const walletConnected = bool("walletConnected");
  const paidActionsAvailable = val<boolean>("paidActionsAvailable", true) !== false;
  const createAvailable = bool("createAvailable") && paidActionsAvailable;
  const pendingOperation = val<Record<string, unknown> | null>("pendingOperation", null);
  const isOpening =
    Boolean(openingId) ||
    isLoading ||
    isRecovering ||
    isConnectingWallet ||
    Boolean(pendingOperation);

  // Guest (free / local) play — surfaced from app.mode via main.tsx so the copy
  // drops all GAS-at-stake / pool / credit / on-chain framing in favour of local,
  // practice-run framing. GAMEFI copy is untouched.
  const isGuest = str("appMode", "gamefi") === "guest";
  const guestBest = val<number>("guestBest", 0) ?? 0;
  const guestTotal = val<number>("guestTotal", 0) ?? 0;
  const guestOpened = val<number>("guestOpened", 0) ?? 0;
  const guestBoard = val<Array<{ user: string; score: number }>>("guestBoard", []) ?? [];
  // `loadData` may have populated a GameFi maintenance/read notice before the
  // launcher switches to guest. Never carry that chain-only warning into the
  // local packet game or its screen-reader status.
  const modeServiceNotice = isGuest ? "" : serviceNotice;
  const modeTransactionNotice = isGuest ? "" : transactionNotice;
  const formatGuestPoints = (value: number): string => t("guestPointsValue", {
    amount: Number(value || 0).toLocaleString(undefined, { maximumFractionDigits: 4 }),
  });
  // Mode-aware string: guest uses the local variant, gamefi keeps the original.
  const sx = (guestKey: string, gamefiKey: string): string =>
    isGuest ? t(guestKey) : t(gamefiKey);
  const activeNetworkLabel = activeNetwork === "testnet"
    ? t("networkTestnet")
    : activeNetwork === "mainnet"
      ? t("networkMainnet")
      : "";

  useEffect(() => {
    if (!drawerOpen) return;
    const trigger = drawerTriggerRef.current;
    drawerCloseRef.current?.focus();

    const onKeyDown = (event: globalThis.KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        setDrawerOpen(false);
        return;
      }
      if (event.key !== "Tab") return;
      const focusable = Array.from(
        drawerRef.current?.querySelectorAll<HTMLElement>(
          'button:not([disabled]), a[href], input:not([disabled]), [tabindex]:not([tabindex="-1"])',
        ) ?? [],
      );
      if (focusable.length === 0) return;
      const first = focusable[0]!;
      const last = focusable[focusable.length - 1]!;
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      trigger?.focus();
    };
  }, [drawerOpen]);

  const openEnvelopes = uniqueById([...pools, ...envelopes].filter(isEnvelopeOpen));
  const reclaimableEnvelopes = envelopes.filter((env) => env.reclaimable);
  const claimableGas = openEnvelopes.reduce((sum, env) => sum + envelopeGas(env), 0);
  const pendingEnvelopeId = asId(openingId);
  const requestedEnvelopeId = pendingEnvelopeId || asId(launchedEnvelopeId);
  // A deep link is an explicit recipient choice. If that envelope is no longer
  // claimable, do not silently substitute another packet. Without a deep link,
  // selecting the first item is safe because `openEnvelopes` is already the
  // authoritative claimable subset.
  const claimableEnvelope = requestedEnvelopeId
    ? openEnvelopes.find((item) => asId(item.id) === requestedEnvelopeId)
    : openEnvelopes[0];
  const claimableEnvelopeId = asId(claimableEnvelope?.id);
  const claimability: Claimability = {
    envelopeId: pendingEnvelopeId || claimableEnvelopeId,
    canClaim:
      Boolean(claimableEnvelopeId) &&
      !isOpening &&
      (isGuest || paidActionsAvailable),
  };
  const activeHintId = claimability.envelopeId || asId(launchedEnvelopeId);

  // Localized copy for every string the Phaser scene renders. Passed as a new
  // bridge key (does not touch the frozen contract keys) so zh users read
  // localized text inside the canvas instead of hardcoded English.
  const sceneCopy = {
    modeSend: t("sceneModeSend"),
    modeClaim: t("sceneModeClaim"),
    sendHeading: t("sceneSendHeading"),
    claimHeading: sx("sceneClaimHeadingGuest", "sceneClaimHeading"),
    planLucky: t("scenePlanLucky"),
    planParty: t("scenePlanParty"),
    planFestival: t("scenePlanFestival"),
    packetsTpl: t("scenePacketsTpl"),
    create: t("sceneCreate"),
    createUnavailable: t("sceneCreateUnavailable"),
    working: t("sceneWorking"),
    connectWallet: t("sceneConnectWallet"),
    confirming: t("sceneConfirming"),
    share: t("sceneShare"),
    open: t("sceneOpen"),
    opening: t("sceneOpening"),
    noEnvelope: t("sceneNoEnvelope"),
    summaryTpl: t("sceneSummaryTpl"),
    resultReceivedTpl: sx("sceneResultReceivedTplGuest", "sceneResultReceivedTpl"),
    resultShareReadyTpl: t("sceneResultShareReadyTpl"),
    resultClaimReady: sx("sceneResultClaimReadyGuest", "sceneResultClaimReady"),
    resultClaimIdle: sx("sceneResultClaimIdleGuest", "sceneResultClaimIdle"),
    resultSendIdle: sx("sceneResultSendIdleGuest", "sceneResultSendIdle"),
    ticketEnvelopeTpl: t("sceneTicketEnvelopeTpl"),
    ticketEmpty: t("sceneTicketEmpty"),
    claimReadyMeta: sx("sceneClaimReadyMetaGuest", "sceneClaimReadyMeta"),
    claimEmptyMeta: sx("sceneClaimEmptyMetaGuest", "sceneClaimEmptyMeta"),
    packetsLeftTpl: t("scenePacketsLeftTpl"),
    packetStatusReady: t("scenePacketStatusReady"),
    gasLeftTpl: sx("sceneLuckLeftTplGuest", "sceneGasLeftTpl"),
    unitLabel: isGuest ? t("guestPointsUnit") : "GAS",
    randomAmount: t("sceneRandomAmount"),
    statusClaimIdle: sx("sceneStatusClaimIdleGuest", "sceneStatusClaimIdle"),
    statusSendIdle: sx("sceneStatusSendIdleGuest", "sceneStatusSendIdle"),
    prepaidTpl: t("scenePrepaidTpl"),
    gameFiUnavailable: t("sceneGameFiUnavailable"),
    errorFallback: t("sceneErrorFallback"),
  };

  const bridgeState = {
    openingId: openingId ?? null,
    appMode: str("appMode", "gamefi"),
    walletConnected,
    paidActionsAvailable,
    isConnectingWallet,
    isRecovering,
    pendingOperation,
    luckyMessage,
    envelopes,
    claims,
    pools,
    isLoading,
    isCreating,
    createAvailable,
    prepaidCredit,
    lastCreatedEnvelopeId,
    envelopeCount,
    claimCount,
    poolCount,
    totalCreated,
    totalClaimed,
    lastError: lastError,
    serviceNotice: modeTransactionNotice || modeServiceNotice,
    claimability,
    sceneCopy,
  };

  const stageTitle = isOpening
    ? pendingOperation || isRecovering
      ? t("sceneConfirming")
      : t("opening")
    : isCreating
      ? t("sendingRedEnvelope")
      : luckyMessage
        ? t("congratulations")
        : lastCreatedEnvelopeId
          ? t("envelopeSent")
          : t("appTitle");

  const score = isGuest
    ? [
        { label: t("guestBestLabel"), value: guestBest > 0 ? formatGuestPoints(guestBest) : "--", accent: guestBest > 0 },
        { label: t("guestTotalLabel"), value: formatGuestPoints(guestTotal) },
        { label: t("guestOpenedLabel"), value: String(guestOpened) },
      ]
    : [
        { label: t("availableEnvelopes"), value: String(openEnvelopes.length), accent: openEnvelopes.length > 0 },
        { label: t("claimablePool"), value: formatGas(claimableGas) },
        { label: prepaidCredit > 0 ? t("prepaidCreditLabel") : t("recentClaimsTitle"), value: prepaidCredit > 0 ? formatGas(prepaidCredit) : String(claimCount) },
      ];

  const drawerModes: Array<{
    mode: DrawerMode;
    label: string;
    value: string;
    icon: ReactNode;
  }> = isGuest
    ? [
        { mode: "safety", label: t("guestHowTitle"), value: t("guestBadge"), icon: <ShieldCheck size={15} /> },
      ]
    : [
        { mode: "active", label: t("availableEnvelopes"), value: String(openEnvelopes.length), icon: <Ticket size={15} /> },
        { mode: "claims", label: t("recentClaimsTitle"), value: String(claims.length), icon: <History size={15} /> },
        { mode: "reclaim", label: t("reclaimEnvelope"), value: String(reclaimableEnvelopes.length), icon: <ArchiveRestore size={15} /> },
        { mode: "safety", label: t("safetyPanelTitle"), value: t("tokenGas"), icon: <ShieldCheck size={15} /> },
      ];
  const activeDrawerMode = drawerModes.some((item) => item.mode === drawerMode) ? drawerMode : drawerModes[0]!.mode;
  const activeDrawer = drawerModes.find((item) => item.mode === activeDrawerMode) ?? drawerModes[0]!;

  const drawerPanels: Record<DrawerMode, ReactNode> = {
    active: (
      <div className="redenv-drawer__panel-body" data-mode="active">
        <div className="redenv-drawer__summary">
          <span>{activeHintId ? t("claimTicketPreparedDesc") : t("claimTicketEmptyDesc")}</span>
          <strong>{formatGas(claimableGas)}</strong>
        </div>
        {openEnvelopes.length > 0 ? (
          <ul className="mx2-history redenv-drawer-list">
            {openEnvelopes.slice(0, 8).map((env) => (
              <li key={asId(env.id)} className="mx2-history__item redenv-drawer-list__item">
                <span className="mx2-history__face">#{shortId(env.id)}</span>
                <span className="mx2-history__stake">{formatGas(envelopeGas(env))}</span>
                <span className="mx2-history__result">{envelopePacketCopy(t, env)}</span>
              </li>
            ))}
          </ul>
        ) : (
          <div className="redenv-drawer__empty">{t("noPoolsCopy")}</div>
        )}
      </div>
    ),
    claims: (
      <div className="redenv-drawer__panel-body" data-mode="claims">
        <div className="redenv-drawer__summary">
          <span>{t("noActivityCopy")}</span>
          <strong>{formatGas(totalClaimed)}</strong>
        </div>
        {claims.length > 0 ? (
          <ul className="mx2-history redenv-drawer-list">
            {claims.slice(0, 6).map((claim, index) => (
              <li key={claim.id ?? `${claim.poolId}-${index}`} className="mx2-history__item redenv-drawer-list__item" data-outcome="won">
                <span className="mx2-history__face">#{shortId(claim.poolId ?? claim.envelopeId ?? claim.id)}</span>
                <span className="mx2-history__stake">{shortId(claim.holder ?? claim.claimer, 6, 4)}</span>
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
          <strong>{String(reclaimableEnvelopes.length)}</strong>
        </div>
        {reclaimableEnvelopes.length > 0 ? (
          <ul className="mx2-history redenv-drawer-list">
            {reclaimableEnvelopes.map((env) => (
              <li key={asId(env.id)} className="mx2-history__item redenv-drawer-list__item">
                <span className="mx2-history__face">#{shortId(env.id)}</span>
                <span className="mx2-history__stake">{formatGas(env.remainingAmount)}</span>
                <button
                  type="button"
                  className="mx2-btn mx2-btn--ghost"
                  disabled={isOpening}
                  onClick={() => void dispatch("reclaimEnvelope", { envelopeId: asId(env.id) })}
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
          <div>
            <span>{isGuest ? t("guestHowBody") : t("safetyPanelCopy")}</span>
            {!isGuest ? <small>{t("publicPoolDisclosure")}</small> : null}
          </div>
        </div>
        {isGuest ? (
          <div className="redenv-route" data-mode="guest">
            <span>{t("guestHowTitle")}</span>
            <code>{t("guestBadge")}</code>
          </div>
        ) : (
          <div className="redenv-route">
            <span>{t("contractRoute")}</span>
            <code>{t("claimContractRoute")}</code>
          </div>
        )}
      </div>
    ),
  };

  const drawerContent = (
    <div className="redenv-drawer">
      <div className="redenv-drawer__head">
        <img src="./red-envelope-claim-card.webp" alt="" width={52} height={52} draggable={false} />
        <div>
          <strong>
            {isGuest
              ? t("guestHowTitle")
              : lastCreatedEnvelopeId
                ? t("shareReadyTitle")
                : t("claimPanelTitle")}
          </strong>
          <span>{lastError || modeServiceNotice || (isGuest ? t("guestHowBody") : t("docDescription"))}</span>
        </div>
      </div>

      {modeServiceNotice ? (
        <div className="redenv-recovery-notice" role="alert">
          <span>{modeServiceNotice}</span>
          <button
            type="button"
            className="mx2-btn mx2-btn--ghost"
            disabled={isOpening}
            onClick={() => void dispatch("retryEnvelopeData")}
          >
            {t("retryData")}
          </button>
        </div>
      ) : null}

      <div className="redenv-drawer__summary-grid" aria-label={t("drawerSummaryLabel")}>
        {(isGuest
          ? [
              { label: t("guestBestLabel"), value: guestBest > 0 ? formatGuestPoints(guestBest) : "--" },
              { label: t("guestTotalLabel"), value: formatGuestPoints(guestTotal) },
              { label: t("guestOpenedLabel"), value: String(guestOpened) },
              { label: t("availableEnvelopes"), value: String(openEnvelopes.length) },
            ]
          : [
              { label: t("availableEnvelopes"), value: String(openEnvelopes.length) },
              { label: t("claimablePool"), value: formatGas(claimableGas) },
              { label: t("createdGasLabel"), value: formatGas(totalCreated) },
              { label: t("claimedGasLabel"), value: formatGas(totalClaimed) },
              { label: t("prepaidCreditLabel"), value: formatGas(prepaidCredit) },
              { label: t("sidebarEnvelopes"), value: String(envelopeCount + poolCount) },
            ]
        ).map((cell) => (
          <div key={String(cell.label)}>
            <span>{cell.label}</span>
            <strong>{cell.value}</strong>
          </div>
        ))}
      </div>

      {isGuest && (
        <div className="redenv-guest-board" aria-label={t("guestBoardTitle")}>
          <div className="redenv-guest-board__head">
            <strong>{t("guestBoardTitle")}</strong>
          </div>
          {guestBoard.length > 0 ? (
            <ul className="mx2-history redenv-drawer-list">
              {guestBoard.slice(0, 8).map((row, index) => (
                <li key={`${row.user}-${index}`} className="mx2-history__item redenv-drawer-list__item">
                  <span className="mx2-history__face">#{index + 1}</span>
                  <span className="mx2-history__stake">{shortId(row.user, 6, 4)}</span>
                  <span className="mx2-history__result">{formatGuestPoints(row.score)}</span>
                </li>
              ))}
            </ul>
          ) : (
            <div className="redenv-drawer__empty">{t("guestBoardEmpty")}</div>
          )}
        </div>
      )}

      {!isGuest && lastCreatedEnvelopeId && (
        <div className="redenv-share-card">
          <div>
            <span>{t("shareTitle")}</span>
            <strong>
              {activeNetworkLabel
                ? t("shareHintNetwork", {
                    id: lastCreatedEnvelopeId,
                    network: activeNetworkLabel,
                  })
                : t("shareHint", { id: lastCreatedEnvelopeId })}
            </strong>
          </div>
          <button
            type="button"
            className="mx2-btn mx2-btn--ghost"
            onClick={() => void dispatch("shareEnvelope", { envelopeId: lastCreatedEnvelopeId })}
          >
            {t("copyShareLink")}
          </button>
        </div>
      )}

      {!isGuest && prepaidCredit > 0 && (
        <div className="redenv-credit-card">
          <WalletCards size={18} aria-hidden="true" />
          <div>
            <span>{t("prepaidCreditLabel")}</span>
            <strong>{formatGas(prepaidCredit)}</strong>
          </div>
          <button
            type="button"
            className="mx2-btn mx2-btn--ghost"
            disabled={isOpening}
            onClick={() => void dispatch("withdrawCredit")}
          >
            {t("withdrawCredit")}
          </button>
        </div>
      )}

      <div className="redenv-access-actions" aria-label={t("accessibleActionsTitle")}>
        <strong>{t("accessibleActionsTitle")}</strong>
        <span>{t("accessibleActionsHint")}</span>
        <div>
          {!isGuest && !walletConnected ? (
            <button
              type="button"
              className="mx2-btn mx2-btn--primary"
              disabled={isConnectingWallet}
              onClick={() => void dispatch("connectWallet")}
            >
              {isConnectingWallet ? t("sceneWorking") : t("sceneConnectWallet")}
            </button>
          ) : (
            <>
              <button
                type="button"
                className="mx2-btn mx2-btn--primary"
                disabled={!claimability.canClaim}
                onClick={() => void dispatch("claimEnvelope", { envelopeId: claimability.envelopeId })}
              >
                {isOpening ? t("sceneOpening") : t("sceneOpen")}
              </button>
              {ACCESSIBLE_PLANS.map((plan) => (
                <button
                  key={plan.key}
                  type="button"
                  className="mx2-btn mx2-btn--ghost"
                  disabled={isOpening || (!isGuest && !createAvailable)}
                  onClick={() => void dispatch("createEnvelope", {
                    amount: plan.amount,
                    count: plan.count,
                    expiryHours: plan.expiryHours,
                  })}
                >
                  {t(plan.labelKey)}
                </button>
              ))}
            </>
          )}
        </div>
      </div>

      <div className="redenv-drawer-tabs" role="tablist" aria-label={t("myEnvelopes")}>
        {drawerModes.map((item) => (
          <button
            key={item.mode}
            type="button"
            role="tab"
            aria-selected={activeDrawerMode === item.mode}
            className={activeDrawerMode === item.mode ? "is-active" : undefined}
            onClick={() => setDrawerMode(item.mode)}
          >
            <span className="redenv-drawer-tabs__icon" aria-hidden="true">{item.icon}</span>
            <span>{item.label}</span>
            <strong>{item.value}</strong>
          </button>
        ))}
      </div>

      <section className="redenv-drawer__panel-shell" aria-label={activeDrawer.label}>
        <div className="redenv-drawer__panel-head">
          <span className="redenv-drawer-tabs__icon" aria-hidden="true">{activeDrawer.icon}</span>
          <div>
            <strong>{activeDrawer.label}</strong>
            <span>{activeDrawer.value}</span>
          </div>
        </div>
        {drawerPanels[activeDrawerMode]}
      </section>
    </div>
  );

  const handleCanvasKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key !== "Enter" && event.key !== " ") return;
    if (!claimability.canClaim) return;
    event.preventDefault();
    void dispatch("claimEnvelope", { envelopeId: claimability.envelopeId });
  };

  return (
    <div className="redenv-play-area mx2 mx2-cat-game">
      <p className="redenv-sr-only" role="status" aria-live="polite" aria-atomic="true">
        {stageTitle}. {lastError || modeTransactionNotice || modeServiceNotice || (luckyMessage?.amount
          ? t(isGuest ? "guestGrabbed" : "claimReceivedMessage", {
              amount: Number(luckyMessage.amount).toFixed(4),
            })
          : "")}
      </p>
      <PlayStage
        category="game"
        className="redenv-playstage"
        stage={{}}
        scene={(
          <div className="redenv-stage-shell">
            <div
              className="redenv-canvas-access"
              tabIndex={0}
              role="group"
              aria-label={t("sceneKeyboardHint")}
              aria-disabled={!claimability.canClaim}
              onKeyDown={handleCanvasKeyDown}
            >
              <PhaserGameComponent
                config={GAME_CONFIG}
                loadScene={loadRedEnvelopeScene}
                state={bridgeState}
                dispatch={dispatch}
                className="redenv-phaser-canvas"
                ariaLabel={t("sceneAriaLabel")}
                loadingLabel={t("sceneLoadingLabel")}
                errorLabel={t("sceneLoadError")}
                retryLabel={t("sceneRetry")}
                continueLabel={t("sceneContinue")}
                enableSoundLabel={t("sceneEnableSound")}
                muteSoundLabel={t("sceneMuteSound")}
              />
            </div>
            <div className="redenv-stage-hud" aria-label={t("drawerSummaryLabel")}>
              {score.map((item) => (
                <div className="redenv-stage-hud__metric" data-accent={item.accent ? "true" : undefined} key={String(item.label)}>
                  <span>{item.label}</span>
                  <strong>{item.value}</strong>
                </div>
              ))}
              {luckyMessage?.amount && luckyMessage.amount > 0 ? (
                <button
                  type="button"
                  className="redenv-collect-luck"
                  onClick={() => void dispatch("dismissOverlay")}
                >
                  {t("luckyReceivedClose")}
                </button>
              ) : (
                <button
                  ref={drawerTriggerRef}
                  type="button"
                  className="redenv-stage-hud__drawer"
                  onClick={() => setDrawerOpen((open) => !open)}
                  aria-expanded={drawerOpen}
                >
                  <span>{t("myEnvelopes")}</span>
                  <ChevronDown size={16} aria-hidden="true" data-open={drawerOpen ? "true" : undefined} />
                </button>
              )}
            </div>
            {drawerOpen && (
              <>
                <div
                  className="redenv-drawer-backdrop"
                  aria-hidden="true"
                  onPointerDown={() => setDrawerOpen(false)}
                />
                <section
                  ref={drawerRef}
                  className="redenv-ingame-drawer"
                  role="dialog"
                  aria-modal="true"
                  aria-labelledby="redenv-drawer-title"
                >
                  <div className="redenv-ingame-drawer__titlebar">
                    <h3 id="redenv-drawer-title">{t("myEnvelopes")}</h3>
                    <button
                      ref={drawerCloseRef}
                      type="button"
                      className="redenv-drawer-close"
                      aria-label={t("closeDrawer")}
                      onClick={() => setDrawerOpen(false)}
                    >
                      <X size={18} aria-hidden="true" />
                    </button>
                  </div>
                  {drawerContent}
                </section>
              </>
            )}
          </div>
        )}
        actions={{}}
      />
    </div>
  );
}
