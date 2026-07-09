import { useState, type ReactNode } from "react";
import { useStateBindings } from "@shared/react/hooks/useStateBindings";
import type { Observable } from "@shared/react/context";
import type { MiniAppLaunchContext } from "@shared/utils/launch-params";
import { PlayStage } from "@shared/components-react/v2";
import { PhaserGameComponent } from "@framework/phaser";
import { ArchiveRestore, ChevronDown, Gift, History, ShieldCheck, Ticket, WalletCards } from "lucide-react";
import { RedEnvelopeScene } from "./scenes/RedEnvelopeScene";
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

type DrawerMode = "active" | "claims" | "reclaim" | "safety";

const GAME_CONFIG = { scene: [RedEnvelopeScene], width: 420, height: 540 } as const;

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
  if (item.canOpen === true) return true;
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
  const launchedEnvelopeId = getLaunchEnvelopeId(launchContext);
  const isLoading = bool("isLoading");
  const isCreating = bool("isCreating");
  const isOpening = Boolean(openingId) || isLoading;

  const openEnvelopes = uniqueById([...pools, ...envelopes].filter(isEnvelopeOpen));
  const reclaimableEnvelopes = envelopes.filter((env) => env.reclaimable);
  const claimableGas = openEnvelopes.reduce((sum, env) => sum + envelopeGas(env), 0);
  const lastCreatedLabel = lastCreatedEnvelopeId ? `#${shortId(lastCreatedEnvelopeId, 10, 4)}` : "--";
  const activeHintId = asId(openingId) || launchedEnvelopeId || asId(openEnvelopes[0]?.id);

  // Localized copy for every string the Phaser scene renders. Passed as a new
  // bridge key (does not touch the frozen contract keys) so zh users read
  // localized text inside the canvas instead of hardcoded English.
  const sceneCopy = {
    modeSend: t("sceneModeSend"),
    modeClaim: t("sceneModeClaim"),
    sendHeading: t("sceneSendHeading"),
    claimHeading: t("sceneClaimHeading"),
    planLucky: t("scenePlanLucky"),
    planParty: t("scenePlanParty"),
    planFestival: t("scenePlanFestival"),
    packetsTpl: t("scenePacketsTpl"),
    create: t("sceneCreate"),
    working: t("sceneWorking"),
    share: t("sceneShare"),
    open: t("sceneOpen"),
    opening: t("sceneOpening"),
    noEnvelope: t("sceneNoEnvelope"),
    summaryTpl: t("sceneSummaryTpl"),
    resultReceivedTpl: t("sceneResultReceivedTpl"),
    resultShareReadyTpl: t("sceneResultShareReadyTpl"),
    resultClaimReady: t("sceneResultClaimReady"),
    resultClaimIdle: t("sceneResultClaimIdle"),
    resultSendIdle: t("sceneResultSendIdle"),
    ticketEnvelopeTpl: t("sceneTicketEnvelopeTpl"),
    ticketEmpty: t("sceneTicketEmpty"),
    claimReadyMeta: t("sceneClaimReadyMeta"),
    claimEmptyMeta: t("sceneClaimEmptyMeta"),
    packetsLeftTpl: t("scenePacketsLeftTpl"),
    packetStatusReady: t("scenePacketStatusReady"),
    gasLeftTpl: t("sceneGasLeftTpl"),
    randomAmount: t("sceneRandomAmount"),
    statusClaimIdle: t("sceneStatusClaimIdle"),
    statusSendIdle: t("sceneStatusSendIdle"),
    prepaidTpl: t("scenePrepaidTpl"),
    errorFallback: t("sceneErrorFallback"),
  };

  const bridgeState = {
    openingId: openingId ?? null,
    luckyMessage,
    envelopes,
    claims,
    pools,
    isLoading,
    isCreating,
    prepaidCredit,
    lastCreatedEnvelopeId,
    envelopeCount,
    claimCount,
    poolCount,
    totalCreated,
    totalClaimed,
    lastError: lastError,
    serviceNotice: serviceNotice,
    sceneCopy,
  };

  const stageTitle = isOpening
    ? t("opening")
    : isCreating
      ? t("sendingRedEnvelope")
      : luckyMessage
        ? t("congratulations")
        : lastCreatedEnvelopeId
          ? t("envelopeSent")
          : t("appTitle");

  const score = [
    { label: t("availableEnvelopes"), value: String(openEnvelopes.length), accent: openEnvelopes.length > 0 },
    { label: t("claimablePool"), value: formatGas(claimableGas) },
    { label: prepaidCredit > 0 ? t("prepaidCreditLabel") : t("recentClaimsTitle"), value: prepaidCredit > 0 ? formatGas(prepaidCredit) : String(claimCount) },
  ];

  const drawerModes: Array<{
    mode: DrawerMode;
    label: string;
    value: string;
    icon: ReactNode;
  }> = [
    { mode: "active", label: t("availableEnvelopes"), value: String(openEnvelopes.length), icon: <Ticket size={15} /> },
    { mode: "claims", label: t("recentClaimsTitle"), value: String(claims.length), icon: <History size={15} /> },
    { mode: "reclaim", label: t("reclaimEnvelope"), value: String(reclaimableEnvelopes.length), icon: <ArchiveRestore size={15} /> },
    { mode: "safety", label: t("safetyPanelTitle"), value: t("tokenGas"), icon: <ShieldCheck size={15} /> },
  ];
  const activeDrawer = drawerModes.find((item) => item.mode === drawerMode) ?? drawerModes[0]!;

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
          <span>{t("safetyPanelCopy")}</span>
        </div>
        <div className="redenv-route">
          <span>{t("contractRoute")}</span>
          <code>{t("claimContractRoute")}</code>
        </div>
      </div>
    ),
  };

  const drawerContent = (
    <div className="redenv-drawer">
      <div className="redenv-drawer__head">
        <img src="./red-envelope-claim-card.webp" alt="" width={52} height={52} draggable={false} />
        <div>
          <strong>{lastCreatedEnvelopeId ? t("shareReadyTitle") : t("claimPanelTitle")}</strong>
          <span>{lastError || serviceNotice || t("docDescription")}</span>
        </div>
      </div>

      <div className="redenv-drawer__summary-grid" aria-label={t("drawerSummaryLabel")}>
        <div>
          <span>{t("availableEnvelopes")}</span>
          <strong>{String(openEnvelopes.length)}</strong>
        </div>
        <div>
          <span>{t("claimablePool")}</span>
          <strong>{formatGas(claimableGas)}</strong>
        </div>
        <div>
          <span>{t("createdGasLabel")}</span>
          <strong>{formatGas(totalCreated)}</strong>
        </div>
        <div>
          <span>{t("claimedGasLabel")}</span>
          <strong>{formatGas(totalClaimed)}</strong>
        </div>
        <div>
          <span>{t("prepaidCreditLabel")}</span>
          <strong>{formatGas(prepaidCredit)}</strong>
        </div>
        <div>
          <span>{t("sidebarEnvelopes")}</span>
          <strong>{String(envelopeCount + poolCount)}</strong>
        </div>
      </div>

      {lastCreatedEnvelopeId && (
        <div className="redenv-share-card">
          <div>
            <span>{t("shareTitle")}</span>
            <strong>{t("shareHint", { id: lastCreatedEnvelopeId })}</strong>
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

      {prepaidCredit > 0 && (
        <div className="redenv-credit-card">
          <WalletCards size={18} aria-hidden="true" />
          <div>
            <span>{t("prepaidCreditLabel")}</span>
            <strong>{formatGas(prepaidCredit)}</strong>
          </div>
          <button
            type="button"
            className="mx2-btn mx2-btn--ghost"
            onClick={() => void dispatch("withdrawCredit")}
          >
            {t("withdrawCredit")}
          </button>
        </div>
      )}

      <div className="redenv-drawer-tabs" role="tablist" aria-label={t("myEnvelopes")}>
        {drawerModes.map((item) => (
          <button
            key={item.mode}
            type="button"
            role="tab"
            aria-selected={drawerMode === item.mode}
            className={drawerMode === item.mode ? "is-active" : undefined}
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
        {drawerPanels[drawerMode]}
      </section>
    </div>
  );

  return (
    <div className="redenv-play-area mx2 mx2-cat-game">
      <PlayStage
        category="game"
        className="redenv-playstage"
        stage={{
          eyebrow: t("appEyebrow"),
          title: stageTitle,
          subtitle: t("appSubtitle"),
          badges: (
            <>
              <span className="mx2-badge" data-tone="accent">
                <span className="mx2-badge__dot" /> {t("tokenGas")}
              </span>
              {lastCreatedEnvelopeId && (
                <span className="mx2-badge">
                  <Gift size={14} aria-hidden="true" /> {lastCreatedLabel}
                </span>
              )}
            </>
          ),
        }}
        scene={(
          <div className="redenv-stage-shell">
            <PhaserGameComponent
              config={GAME_CONFIG}
              state={bridgeState}
              dispatch={dispatch}
              className="redenv-phaser-canvas"
              ariaLabel="Red Envelope packet game"
              loadingLabel="Opening red envelope game"
            />
            <div className="redenv-stage-hud" aria-label={t("drawerSummaryLabel")}>
              {score.map((item) => (
                <div className="redenv-stage-hud__metric" data-accent={item.accent ? "true" : undefined} key={String(item.label)}>
                  <span>{item.label}</span>
                  <strong>{item.value}</strong>
                </div>
              ))}
              <button
                type="button"
                className="redenv-stage-hud__drawer"
                onClick={() => setDrawerOpen((open) => !open)}
                aria-expanded={drawerOpen}
              >
                <span>{t("myEnvelopes")}</span>
                <ChevronDown size={16} aria-hidden="true" data-open={drawerOpen ? "true" : undefined} />
              </button>
            </div>
            {drawerOpen && (
              <section className="redenv-ingame-drawer" aria-label={t("myEnvelopes")}>
                <h3>{t("myEnvelopes")}</h3>
                {drawerContent}
              </section>
            )}
          </div>
        )}
        actions={{}}
      />
    </div>
  );
}
