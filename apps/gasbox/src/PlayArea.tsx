/**
 * GasBox production play surface.
 *
 * The capsule machine remains the dominant game object. Exact wallet, credit,
 * pool, reservation and recovery evidence sits in a compact HUD/drawer instead
 * of turning the experience into a transaction form.
 */
import { useEffect, useRef, useState } from "react";
import type { CSSProperties, ReactNode } from "react";
import { useStateBindings } from "@shared/react/hooks/useStateBindings";
import type { ObservableState } from "@shared/react/context";
import { CoinArt, ParticleBurst } from "@shared/art";
import { PhaseValue, resolvePhase } from "@shared/components-react/v2";
import { PlayStage } from "@shared/components-react/v2/PlayStage";
import { addressToScriptHash } from "@shared/utils/neo";
import machineArtUrl from "./gasbox-capsule-machine-cutout.webp";
import prizeCapsuleUrl from "./gasbox-prize-capsule-cutout.webp";
import "./PlayArea.scss";

interface Props {
  t: (key: string, params?: Record<string, string | number>) => string;
  state: ObservableState;
  dispatch: (name: string, ...args: unknown[]) => Promise<void>;
}

interface MachineItem {
  name?: string;
  rarity?: string;
  displayProbability?: number;
  probability?: number;
  amountDisplay?: string;
  available?: boolean;
  [key: string]: unknown;
}

interface Machine {
  id: string;
  name?: string;
  active?: boolean;
  inventoryReady?: boolean;
  poolReady?: boolean;
  price?: string;
  items?: MachineItem[];
  topPrize?: string;
  prizeAsset?: "GAS" | "NEO";
  poolBalance?: string;
  reservedPool?: string;
  freePool?: string;
  maxPrize?: string;
  creatorHash?: string;
  revenue?: string;
  revenueBaseUnits?: string;
  [key: string]: unknown;
}

interface PullResult extends MachineItem {
  id?: string;
}

interface StudioItemDraft {
  name: string;
  weight: string;
  amount: string;
}

function translation(t: Props["t"], key: string, fallback: string): string {
  const value = t(key);
  return value && value !== key ? value : fallback;
}

function prizeLabel(
  item: MachineItem | PullResult | null | undefined,
  fallback: string,
): string {
  if (!item) return fallback;
  return String(item.name || item.rarity || item.amountDisplay || fallback);
}

function probabilityLabel(item: MachineItem | null | undefined): string {
  const probability = Number(item?.displayProbability ?? item?.probability);
  return Number.isFinite(probability) && probability > 0
    ? `${probability.toFixed(probability < 1 ? 2 : 1)}%`
    : "";
}

function shortHash(value: string): string {
  const text = String(value ?? "").trim();
  return text.length > 16 ? `${text.slice(0, 8)}…${text.slice(-6)}` : text || "—";
}

export default function PlayArea({ t, state, dispatch }: Props) {
  const { str, bool, num, val } = useStateBindings(state);
  const machines = (val("machines") ?? []) as Machine[];
  const selectedMachine = val<Machine | null>("selectedMachine", null);
  const pullResult = val<PullResult | null>("pullResult", null);
  const isLoading = bool("isLoading");
  const isPulling = bool("isPulling");
  const isCreating = bool("isCreating");
  const studioOpen = bool("studioOpen");
  const showResult = bool("showResult");
  const isAwaitingReveal = bool("isAwaitingReveal");
  const hasPlayCredit = bool("hasPlayCredit");
  const isWithdrawingCredit = bool("isWithdrawingCredit");
  const isWithdrawingPool = bool("isWithdrawingPool");
  const machineCount = num("machineCount");
  const selectedMachineName = str("selectedMachineName");
  const formattedPlayCredit = str("formattedPlayCredit", "0");
  const formattedWalletGas = str("formattedWalletGas", "0");
  const formattedWalletNeo = str("formattedWalletNeo", "0");
  const betPhase = str("betPhase");
  const pendingBetId = str("pendingBetId");
  const walletAddress = str("walletAddress");
  const walletStatus = str("walletStatus", walletAddress ? "ready" : "disconnected");
  const runtimeStatus = str("runtimeStatus", "ready");
  const runtimeNetwork = str("runtimeNetwork", "Neo N3");
  const runtimeContract = str("runtimeContract");
  const runtimeError = str("runtimeError");
  const catalogStatus = str("catalogStatus", isLoading ? "loading" : "ready");
  const catalogError = str("catalogError");

  const [topUpAmount, setTopUpAmount] = useState("");
  const [withdrawAmount, setWithdrawAmount] = useState("");
  // Immediate local action preview: the machine acknowledges the tap with a
  // short nudge the moment the player commits a pull. The authoritative
  // capsule-reel motion still comes only from the real isPulling state.
  const [pullPreview, setPullPreview] = useState(false);
  const pullPreviewTimeout = useRef<number | null>(null);
  const startPullPreview = () => {
    if (pullPreviewTimeout.current !== null) window.clearTimeout(pullPreviewTimeout.current);
    setPullPreview(true);
    pullPreviewTimeout.current = window.setTimeout(() => {
      setPullPreview(false);
      pullPreviewTimeout.current = null;
    }, 1_400);
  };
  useEffect(
    () => () => {
      if (pullPreviewTimeout.current !== null) window.clearTimeout(pullPreviewTimeout.current);
    },
    [],
  );
  const [studioName, setStudioName] = useState("");
  const [studioPrice, setStudioPrice] = useState("0.1");
  const [studioAsset, setStudioAsset] = useState<"GAS" | "NEO">("GAS");
  const [studioItems, setStudioItems] = useState<StudioItemDraft[]>([
    { name: "", weight: "", amount: "" },
  ]);

  const isConnected = walletAddress.length > 0;
  const runtimeReady = runtimeStatus === "ready";
  const runtimeIncompatible = runtimeStatus === "incompatible";
  const selectedItems = Array.isArray(selectedMachine?.items) ? selectedMachine.items : [];
  const availableItems = selectedItems.filter((item) => item.available !== false);
  const focusPrize = availableItems[0] ?? null;
  const selectedReady = Boolean(
    selectedMachine &&
      selectedMachine.active !== false &&
      selectedMachine.inventoryReady !== false &&
      selectedMachine.poolReady !== false,
  );
  const canPull = Boolean(
    selectedMachine && selectedReady && runtimeReady && isConnected && !isAwaitingReveal,
  );
  const machineId = selectedMachine?.id || machines[0]?.id || "";
  const connectedScriptHash = addressToScriptHash(walletAddress).toLowerCase();
  const creatorHash = String(selectedMachine?.creatorHash || "").toLowerCase();
  const isCreator = Boolean(
    selectedMachine && connectedScriptHash && creatorHash && connectedScriptHash === creatorHash,
  );
  const hasWithdrawableRevenue =
    isCreator && /^\d+$/.test(String(selectedMachine?.revenueBaseUnits ?? "0")) &&
    BigInt(String(selectedMachine?.revenueBaseUnits ?? "0")) > 0n;
  const hasMachines = machines.length > 0;
  const selectedName = selectedMachineName.trim();
  const displayMachineName =
    selectedMachine && selectedName && !["none", "null", "undefined", "-"].includes(selectedName.toLowerCase())
      ? selectedName
      : "";
  const hasLoadError = runtimeStatus === "error" || catalogStatus === "error";
  /**
   * The headline economy tiles across the three honest phases. They used to
   * fall through to `selectedMachine?.x ?? "—"`, so the top of the entry
   * surface opened as a row of three em-dash voids whenever no machine had
   * resolved — which is every first paint, before any read completes.
   *
   * `catalogStatus` already distinguishes "loading" from a finished read, so no
   * new signal is needed: it is the `settled` half of the shared DataPhase
   * vocabulary (apps/shared/components-react/v2/DataPhase.tsx).
   */
  const machinePhase = resolvePhase({
    loading: isLoading || catalogStatus === "loading",
    settled: catalogStatus === "ready" || catalogStatus === "error" || runtimeStatus === "error",
    hasData: Boolean(selectedMachine),
  });
  /**
   * Wraps the whole value INCLUDING its unit: the unit is a property of real
   * data, so "— GAS" (or "No machine yet GAS") must never be rendered.
   */
  const machineValue = (value: ReactNode) => (
    <PhaseValue
      phase={machinePhase}
      placeholder={translation(t, "gasboxTileNoMachine", "No machine yet")}
      skeletonWidth="4em"
    >
      {value}
    </PhaseValue>
  );
  const studioReady =
    studioName.trim().length > 0 &&
    /^\d+(?:\.\d+)?$/.test(studioPrice.trim()) &&
    Number(studioPrice) > 0 &&
    studioItems.length > 0 &&
    studioItems.every((item) =>
      item.name.trim().length > 0 &&
      /^\d+$/.test(item.weight.trim()) && BigInt(item.weight) > 0n &&
      (studioAsset === "NEO" ? /^\d+$/.test(item.amount.trim()) : /^\d+(?:\.\d+)?$/.test(item.amount.trim())) &&
      Number(item.amount) > 0,
    );
  const sceneState = isPulling
    ? "pulling"
    : showResult
      ? "result"
      : isAwaitingReveal
        ? "pending"
        : runtimeIncompatible
          ? "paused"
          : hasLoadError
          ? "error"
          : isLoading && !selectedMachine
            ? "syncing"
            : selectedMachine
              ? "ready"
              : "empty";

  const machineStatusLabel = (machine: Machine | null | undefined): string => {
    if (!machine) return translation(t, "gasboxPending", "Sync pending");
    if (machine.active === false) return translation(t, "inactive", "Inactive");
    if (machine.inventoryReady === false || machine.poolReady === false) {
      return translation(t, "gasboxMachineNeedsFunding", "Needs free pool");
    }
    return translation(t, "gasboxMachineLive", "Live");
  };

  const updateStudioItem = (
    index: number,
    field: keyof StudioItemDraft,
    value: string,
  ): void => {
    setStudioItems((current) =>
      current.map((item, itemIndex) =>
        itemIndex === index ? { ...item, [field]: value } : item,
      ),
    );
  };

  const publishStudioMachine = (): void => {
    if (!studioReady || isCreating) return;
    void dispatch("publishMachine", {
      name: studioName.trim(),
      price: studioPrice.trim(),
      prizeAsset: studioAsset,
      items: studioItems.map((item) => ({
        name: item.name.trim(),
        weight: item.weight.trim(),
        amount: item.amount.trim(),
      })),
    });
  };

  const statusText = (() => {
    if (betPhase === "committing") return translation(t, "gasboxCommitting", "Committing the wager…");
    if (betPhase === "settling") return translation(t, "gasboxRevealing", "Reading the fixed reveal block…");
    if (isPulling) return translation(t, "pulling", "Capsules are moving…");
    if (showResult) return translation(t, "pullSuccess", "Prize paid. The result is final on-chain.");
    if (isAwaitingReveal) return translation(t, "gasboxCommitted", "Wager committed. Reveal is safe to retry.");
    if (runtimeIncompatible) return translation(t, "gasboxDeploymentIncompatible", "Paid pulls are paused until the fixed-beacon contract is deployed.");
    if (hasLoadError) return runtimeError || catalogError || translation(t, "gasboxLoadFailed", "Live contract data is unavailable.");
    if (isLoading && !selectedMachine) return translation(t, "gasboxSyncingMachines", "Syncing the live capsule counter…");
    if (!selectedMachine) return translation(t, "gasboxEmptyStageHint", "No live machines are published on this network yet.");
    if (!selectedReady) return translation(t, "gasboxPullBlockedTitle", "This machine needs an unreserved prize pool.");
    if (!isConnected) return translation(t, "gasboxConnectToPull", "Connect a wallet to commit a pull.");
    return translation(t, "gasboxPullReadyTitle", "Machine ready. One pull, one later-block reveal.");
  })();

  const prizeName = showResult
    ? prizeLabel(pullResult, translation(t, "unknownPrize", "Unknown prize"))
    : focusPrize
      ? prizeLabel(focusPrize, selectedMachine?.topPrize || translation(t, "unknownPrize", "Unknown prize"))
      : selectedMachine
        ? translation(t, "gasboxPrizeDeckPending", "Prize reel unavailable")
        : translation(t, "gasboxMarketSyncTitle", "Capsule counter ready");
  const prizeOdds = probabilityLabel(focusPrize);
  const prizeCopy = showResult
    ? translation(t, "gasboxOnChainPrizeNote", "The contract paid this prize from the reserved pool.")
    : focusPrize
      ? prizeOdds
        ? `${translation(t, "gasboxPrizeFocusOdds", "Drop chance")} ${prizeOdds}`
        : translation(t, "gasboxReelHint", "Ready to spin")
      : selectedMachine
        ? translation(t, "gasboxPrizeDeckPendingCopy", "The creator must fund items before play.")
        : translation(t, "gasboxMarketSyncCopy", "Refresh to read real machines; no sample inventory is fabricated.");

  const primaryAction = (() => {
    if (isAwaitingReveal) {
      return {
        label: translation(t, "gasboxRevealAction", "Reveal result"),
        onClick: () => void dispatch("reveal"),
        loading: isPulling,
        hint: translation(t, "gasboxRevealHint", "Safe to retry — settlement pays exactly once."),
      };
    }
    if (hasLoadError) {
      return {
        label: isLoading
          ? translation(t, "loadingMachines", "Checking contract…")
          : translation(t, "gasboxFindMachines", "Refresh live counter"),
        onClick: () => void dispatch("refreshMachines"),
        disabled: isLoading,
        loading: isLoading,
        hint: translation(t, "gasboxRetryHint", "Retry the network and contract checks."),
      };
    }
    if (!selectedMachine) {
      return {
        label: isLoading
          ? translation(t, "loadingMachines", "Checking contract…")
          : translation(t, "gasboxFindMachines", "Refresh live counter"),
        onClick: () => void dispatch("refreshMachines"),
        disabled: isLoading,
        loading: isLoading,
        hint: runtimeIncompatible
          ? translation(t, "gasboxBrowseOnlyHint", "Browsing and fund recovery remain available; new paid writes are paused.")
          : translation(t, "gasboxMarketEmptyTeaser", "This network currently has no published machines."),
      };
    }
    if (runtimeIncompatible) {
      return {
        label: translation(t, "gasboxPaidPullsPaused", "Paid pulls paused"),
        onClick: () => undefined,
        disabled: true,
        hint: translation(t, "gasboxDeploymentRecoveryCondition", "Resume after a fixed-beacon contract is deployed and the manifest binding is updated."),
      };
    }
    if (!isConnected) {
      return {
        label: translation(t, "gasboxConnectAction", "Connect wallet"),
        onClick: () => void dispatch("connectWallet"),
        hint: translation(t, "gasboxConnectHint", "Balances are read only after you choose to connect."),
      };
    }
    return {
      label: isPulling ? translation(t, "pulling", "Pulling…") : translation(t, "pull", "Pull capsule"),
      onClick: () => {
        if (!canPull || !machineId) return;
        startPullPreview();
        void dispatch("pull", machineId);
      },
      disabled: isPulling || !canPull,
      loading: isPulling,
      hint: selectedReady
        ? translation(t, "gasboxTwoStepNote", "Commit the GAS wager, then reveal from the next fixed block.")
        : translation(t, "gasboxInventoryActionRequired", "Free pool must cover the largest prize."),
    };
  })();

  const scene = (
    <div
      className="gasbox-scene"
      data-state={sceneState}
      data-preview={pullPreview ? "true" : undefined}
      data-ready={selectedReady ? "true" : "false"}
    >
      <div className="gasbox-finance-strip" aria-label={translation(t, "gasboxLiveEconomy", "Live machine economy")}>
        <article>
          <CoinArt size={24} variant="gas" decorative />
          <span>{translation(t, "gasboxPullPrice", "Pull price")}</span>
          <strong>{machineValue(<>{selectedMachine?.price} GAS</>)}</strong>
        </article>
        <article>
          <CoinArt size={24} variant={selectedMachine?.prizeAsset === "NEO" ? "neo" : "gas"} decorative />
          <span>{translation(t, "gasboxFreePool", "Free pool")}</span>
          <strong>{machineValue(<>{selectedMachine?.freePool} {selectedMachine?.prizeAsset}</>)}</strong>
        </article>
        <article>
          <img src={prizeCapsuleUrl} alt="" aria-hidden="true" />
          <span>{translation(t, "gasboxReservedPool", "Reserved")}</span>
          <strong>{machineValue(<>{selectedMachine?.reservedPool} {selectedMachine?.prizeAsset}</>)}</strong>
        </article>
      </div>

      <div className="gasbox-scene__cabinet" aria-label={translation(t, "title", "GasBox")}>
        <img className="gasbox-scene__machine-art" src={machineArtUrl} alt={translation(t, "title", "GasBox")} />
        <div className="gasbox-scene__capsule-track" aria-hidden="true">
          {[0, 1, 2, 3].map((index) => (
            <img
              key={index}
              className="gasbox-scene__capsule gasbox-scene__capsule--rolling"
              src={prizeCapsuleUrl}
              alt=""
              style={{
                "--gasbox-capsule-index": String(index),
                "--gasbox-capsule-left": `${index * 20}%`,
                "--gasbox-capsule-top": `${(index % 2) * 24}px`,
              } as CSSProperties}
            />
          ))}
        </div>
        <div className="gasbox-scene__chute" aria-hidden={!isPulling && !showResult}>
          {(isPulling || showResult) && (
            <img className="gasbox-scene__capsule gasbox-scene__capsule--drop" src={prizeCapsuleUrl} alt="" />
          )}
        </div>
      </div>

      {showResult && <ParticleBurst coins count={10} />}
      <div className="gasbox-scene__panel" aria-live="polite">
        {selectedMachine ? (
          <div className="gasbox-scene__result">
            <img className="gasbox-scene__result-art" src={prizeCapsuleUrl} alt="" aria-hidden="true" />
            <div>
              <span className="gasbox-scene__result-kicker">
                {showResult
                  ? translation(t, "congratulations", "Prize revealed")
                  : translation(t, "gasboxPrizeFocus", "Prize focus")}
              </span>
              <strong>{prizeName}</strong>
              <small>{prizeCopy}</small>
            </div>
          </div>
        ) : (
          <div className="gasbox-scene__sync-card">
            <div className="gasbox-scene__sync-capsules" aria-hidden="true">
              {[0, 1, 2, 3, 4].map((index) => (
                <img key={index} src={prizeCapsuleUrl} alt="" style={{ "--gasbox-sync-index": String(index) } as CSSProperties} />
              ))}
            </div>
            <span className="gasbox-scene__result-kicker">{translation(t, "gasboxCapsuleStation", "Capsule station")}</span>
            <strong>{hasLoadError ? translation(t, "gasboxCounterOffline", "Counter needs attention") : prizeName}</strong>
            <p>{prizeCopy}</p>
            <ol className="gasbox-scene__route" aria-label={translation(t, "gasboxPlayerRoute", "Player route")}>
              <li>{translation(t, "gasboxEmptyRouteRefresh", "Read live machines")}</li>
              <li>{translation(t, "gasboxEmptyRoutePick", "Choose a capsule")}</li>
              <li>{translation(t, "gasboxEmptyRouteReveal", "Reveal on-chain")}</li>
            </ol>
          </div>
        )}
        <div className="gasbox-scene__shelf" aria-hidden="true">
          {[0, 1, 2].map((index) => (
            <img key={index} src={prizeCapsuleUrl} alt="" style={{ "--gasbox-shelf-index": String(index) } as CSSProperties} />
          ))}
        </div>
      </div>
      <p className="gasbox-scene__status" aria-live="polite">{statusText}</p>
    </div>
  );

  const controls = hasMachines ? (
    <div className="gasbox-controls">
      <div className="gasbox-controls__machines">
        {machines.slice(0, 5).map((machine) => (
          <button
            key={machine.id}
            type="button"
            className={["gasbox-machine-chip", selectedMachine?.id === machine.id ? "gasbox-machine-chip--active" : null].filter(Boolean).join(" ")}
            onClick={() => void dispatch("selectMachine", machine.id)}
            disabled={isPulling}
          >
            <img src={prizeCapsuleUrl} alt="" aria-hidden="true" />
            <span>{machine.name || machine.id}</span>
          </button>
        ))}
      </div>
    </div>
  ) : null;

  return (
    <div className="gasbox-play-area mx2 mx2-cat-game" aria-busy={isPulling || pullPreview}>
      <PlayStage
        category="game"
        stage={{
          eyebrow: t("title"),
          title: displayMachineName || translation(t, "gasboxHeroTitle", "GasBox capsule counter"),
          subtitle: runtimeIncompatible
            ? translation(t, "gasboxBrowseOnlyHint", "Browsing and fund recovery remain available; new paid writes are paused.")
            : selectedMachine
            ? translation(t, "gasboxWalletIntent", "Commit once, reveal once, receive the reserved NEO or GAS prize.")
            : translation(t, "docSubtitle", "Live on-chain capsule machines"),
          badges: (
            <>
              <span className="mx2-badge" data-tone={runtimeReady ? "accent" : runtimeIncompatible ? "warning" : undefined}>
                <span className="mx2-badge__dot" /> {runtimeReady ? runtimeNetwork : runtimeIncompatible ? translation(t, "gasboxBrowseOnly", "Browse only") : translation(t, "gasboxRuntimeCheck", "Contract check")}
              </span>
              <span className="mx2-badge">{machineCount} {translation(t, "totalMachines", "machines").toLowerCase()}</span>
              {pendingBetId && <span className="mx2-badge" data-tone="warning">#{pendingBetId} {translation(t, "gasboxPendingShort", "pending")}</span>}
            </>
          ),
        }}
        scene={<div className="gasbox-stage-stack">{scene}{controls}</div>}
        actions={{
          primary: primaryAction,
          secondary: selectedMachine
            ? [{
                label: translation(t, "refreshMachines", "Refresh live data"),
                onClick: () => void dispatch("refreshMachines"),
                hint: translation(t, "gasboxRefreshHint", "Re-read wallet, contract and pool state."),
              }]
            : [],
        }}
        drawerToggleLabel={translation(t, "gasboxDetails", "Wallet & machines")}
        drawer={{
          title: translation(t, "gasboxDetails", "Wallet & machines"),
          children: (
            <div className="gasbox-drawer">
              <section className="gasbox-drawer-card gasbox-wallet-card">
                <div className="gasbox-drawer-card__head">
                  <div>
                    <h4>{translation(t, "gasboxWalletTitle", "Wallet cabinet")}</h4>
                    <p>{isConnected ? shortHash(walletAddress) : translation(t, "gasboxWalletDisconnected", "Connect only when you are ready to pull.")}</p>
                  </div>
                  <span data-state={walletStatus}>{isConnected ? translation(t, "connected", "Connected") : translation(t, "disconnected", "Offline")}</span>
                </div>
                <div className="gasbox-wallet-assets">
                  <article><CoinArt size={34} variant="gas" decorative /><span>GAS</span><strong>{formattedWalletGas}</strong></article>
                  <article><CoinArt size={34} variant="neo" decorative /><span>NEO</span><strong>{formattedWalletNeo}</strong></article>
                  <article><img src={prizeCapsuleUrl} alt="" aria-hidden="true" /><span>{translation(t, "gasboxPlayCreditLabel", "Play credit")}</span><strong>{formattedPlayCredit} GAS</strong></article>
                </div>
                {isConnected ? (
                  <button
                    type="button"
                    className="mx2-btn mx2-btn--ghost"
                    onClick={() => void dispatch("withdrawPlayCredit")}
                    disabled={!hasPlayCredit || isWithdrawingCredit}
                  >
                    {isWithdrawingCredit
                      ? translation(t, "gasboxWithdrawing", "Withdrawing…")
                      : translation(t, "gasboxWithdrawCredit", "Return unused credit")}
                  </button>
                ) : (
                  <button type="button" className="mx2-btn mx2-btn--ghost" onClick={() => void dispatch("connectWallet")}>
                    {translation(t, "gasboxConnectAction", "Connect wallet")}
                  </button>
                )}
              </section>

              {isAwaitingReveal && (
                <section className="gasbox-drawer-card gasbox-recovery-card">
                  <img src={prizeCapsuleUrl} alt="" aria-hidden="true" />
                  <div>
                    <h4>{translation(t, "gasboxRecoveryTitle", "Committed pull ready to recover")}</h4>
                    <p>{translation(t, "gasboxRecoveryCopy", "This wallet-scoped record survives refresh. Reveal never repeats the wager.")}</p>
                  </div>
                  <button type="button" className="mx2-btn mx2-btn--ghost" onClick={() => void dispatch("reveal")} disabled={isPulling}>
                    {translation(t, "gasboxRevealAction", "Reveal result")}
                  </button>
                </section>
              )}

              <section className="gasbox-drawer-card gasbox-drawer-card--machines">
                <div className="gasbox-drawer-card__head">
                  <div>
                    <h4>{translation(t, "gasboxDrawerMarketTitle", "Live capsule counter")}</h4>
                    <p>{translation(t, "gasboxDrawerMarketCopy", "Only machines read from the selected network appear here.")}</p>
                  </div>
                  <span>{machines.length}</span>
                </div>
                {hasMachines ? (
                  <ul className="gasbox-machine-list">
                    {machines.slice(0, 10).map((machine) => (
                      <li key={machine.id} className="gasbox-machine-list__item" data-active={selectedMachine?.id === machine.id ? "true" : undefined}>
                        <img src={prizeCapsuleUrl} alt="" aria-hidden="true" />
                        <div><strong>{machine.name || machine.id}</strong><small>{machineStatusLabel(machine)}</small></div>
                        <button type="button" className="mx2-btn mx2-btn--ghost" onClick={() => void dispatch("selectMachine", machine.id)}>{t("tapToPlay")}</button>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <div className="gasbox-drawer-empty">
                    <img src={prizeCapsuleUrl} alt="" aria-hidden="true" />
                    <p>{translation(t, "gasboxDrawerMarketEmpty", "No live machines on this network. The studio remains available for creators.")}</p>
                  </div>
                )}
              </section>

              {selectedMachine && isCreator && (
                <section className="gasbox-creator-panel" aria-label={translation(t, "gasboxCreatorEarningsTitle", "Creator console")}>
                  <div>
                    <h4>{translation(t, "gasboxCreatorEarningsTitle", "Creator console")}</h4>
                    <p>{translation(t, "gasboxCreatorEconomyCopy", "Revenue is GAS. Bankroll uses the machine prize asset; reserved funds cannot be withdrawn.")}</p>
                  </div>
                  <div className="gasbox-creator-ledger">
                    <article><span>{translation(t, "gasboxRevenue", "Revenue")}</span><strong>{selectedMachine.revenue || "0"} GAS</strong></article>
                    <article><span>{translation(t, "gasboxFreePool", "Free pool")}</span><strong>{selectedMachine.freePool || "0"} {selectedMachine.prizeAsset}</strong></article>
                    <article><span>{translation(t, "gasboxReservedPool", "Reserved")}</span><strong>{selectedMachine.reservedPool || "0"} {selectedMachine.prizeAsset}</strong></article>
                  </div>
                  <div className="gasbox-creator-panel__row">
                    <button type="button" className="mx2-btn mx2-btn--ghost" onClick={() => void dispatch("withdrawRevenue", selectedMachine.id)} disabled={!hasWithdrawableRevenue}>
                      {translation(t, "withdrawRevenue", "Withdraw revenue")}
                    </button>
                    <button
                      type="button"
                      className="mx2-btn mx2-btn--ghost"
                      onClick={() => void dispatch("setMachineActive", selectedMachine.id, selectedMachine.active === false)}
                      disabled={selectedMachine.active === false && !runtimeReady}
                    >
                      {selectedMachine.active === false
                        ? translation(t, "gasboxActivateAction", "Activate machine")
                        : translation(t, "gasboxDeactivateAction", "Pause machine")}
                    </button>
                  </div>
                  <div className="gasbox-creator-money-row">
                    <label>
                      <span>{translation(t, "gasboxPoolAmount", "Pool amount")}</span>
                      <input value={topUpAmount} onChange={(event) => setTopUpAmount(event.target.value)} inputMode="decimal" placeholder={`0 ${selectedMachine.prizeAsset ?? "GAS"}`} />
                    </label>
                    <button type="button" className="mx2-btn mx2-btn--ghost" onClick={() => void dispatch("topUpPool", selectedMachine.id, topUpAmount)} disabled={!topUpAmount || isWithdrawingPool || !runtimeReady}>
                      {translation(t, "gasboxTopUp", "Top up")}
                    </button>
                  </div>
                  <div className="gasbox-creator-money-row">
                    <label>
                      <span>{translation(t, "gasboxFreePoolAmount", "Free pool to return")}</span>
                      <input value={withdrawAmount} onChange={(event) => setWithdrawAmount(event.target.value)} inputMode="decimal" placeholder={`0 ${selectedMachine.prizeAsset ?? "GAS"}`} />
                    </label>
                    <button type="button" className="mx2-btn mx2-btn--ghost" onClick={() => void dispatch("withdrawPool", selectedMachine.id, withdrawAmount)} disabled={!withdrawAmount || isWithdrawingPool}>
                      {isWithdrawingPool ? translation(t, "gasboxWithdrawing", "Withdrawing…") : translation(t, "gasboxWithdrawPool", "Return bankroll")}
                    </button>
                  </div>
                </section>
              )}

              <section className="gasbox-drawer-card gasbox-studio-card" data-open={studioOpen ? "true" : undefined}>
                {!studioOpen || runtimeIncompatible ? (
                  <>
                    <div className="gasbox-drawer-card__head">
                      <div>
                        <h4>{t("createMachineAction")}</h4>
                        <p>{translation(t, "createPanelHint", "Build the prize reel, fund its largest prize, then activate it.")}</p>
                      </div>
                    </div>
                    <button type="button" className="mx2-btn mx2-btn--ghost" onClick={() => void dispatch(isConnected ? "openStudio" : "connectWallet")} disabled={runtimeIncompatible}>
                      {runtimeIncompatible ? translation(t, "gasboxPublishingPaused", "Publishing paused") : isConnected ? t("create") : translation(t, "gasboxConnectAction", "Connect wallet")}
                    </button>
                  </>
                ) : (
                  <div className="gasbox-studio-builder">
                    <header>
                      <div>
                        <span>{translation(t, "gasboxStudioEyebrow", "Creator workshop")}</span>
                        <h4>{translation(t, "gasboxStudioTitle", "Build a capsule machine")}</h4>
                        <p>{translation(t, "gasboxStudioCopy", "Shape one real machine, load its weighted capsules, then fund the largest prize.")}</p>
                      </div>
                      <button type="button" className="mx2-btn mx2-btn--ghost" onClick={() => void dispatch("closeStudio")} disabled={isCreating}>
                        {translation(t, "dismiss", "Close")}
                      </button>
                    </header>

                    <div className="gasbox-studio-blueprint">
                      <img src={machineArtUrl} alt="" aria-hidden="true" />
                      <div>
                        <strong>{studioName.trim() || translation(t, "studioPreviewMachineName", "Unnamed capsule machine")}</strong>
                        <span>{studioPrice || "—"} GAS · {studioAsset} {translation(t, "gasboxPrizePool", "prize pool")}</span>
                        <div className="gasbox-studio-blueprint__capsules" aria-hidden="true">
                          {studioItems.slice(0, 6).map((_, index) => <img key={index} src={prizeCapsuleUrl} alt="" />)}
                        </div>
                      </div>
                    </div>

                    <div className="gasbox-studio-core">
                      <label>
                        <span>{translation(t, "machineNameLabel", "Machine name")}</span>
                        <input value={studioName} onChange={(event) => setStudioName(event.target.value)} maxLength={60} placeholder={translation(t, "machineNamePlaceholder", "Aurora capsule")} />
                      </label>
                      <label>
                        <span>{translation(t, "pricePerPlayLabel", "Price per pull (GAS)")}</span>
                        <input value={studioPrice} onChange={(event) => setStudioPrice(event.target.value)} inputMode="decimal" placeholder="0.1" />
                      </label>
                      <fieldset>
                        <legend>{translation(t, "prizeAssetLabel", "Prize asset")}</legend>
                        <div className="gasbox-studio-asset-switch">
                          {(["GAS", "NEO"] as const).map((asset) => (
                            <button key={asset} type="button" data-active={studioAsset === asset ? "true" : undefined} onClick={() => setStudioAsset(asset)}>
                              <CoinArt size={28} variant={asset === "GAS" ? "gas" : "neo"} decorative />
                              <span>{asset}</span>
                            </button>
                          ))}
                        </div>
                      </fieldset>
                    </div>

                    <div className="gasbox-studio-capsules">
                      <div className="gasbox-studio-capsules__head">
                        <div><h5>{translation(t, "inventoryAndOdds", "Capsules & odds")}</h5><p>{translation(t, "gasboxWeightsHint", "Weights become readable drop chances after publish.")}</p></div>
                        <button type="button" className="mx2-btn mx2-btn--ghost" onClick={() => setStudioItems((current) => [...current, { name: "", weight: "", amount: "" }])} disabled={studioItems.length >= 20 || isCreating}>
                          {translation(t, "addItem", "Add capsule")}
                        </button>
                      </div>
                      <div className="gasbox-studio-capsules__list">
                        {studioItems.map((item, index) => (
                          <article key={index}>
                            <img src={prizeCapsuleUrl} alt="" aria-hidden="true" />
                            <label><span>{translation(t, "prizeLabel", "Prize")}</span><input value={item.name} onChange={(event) => updateStudioItem(index, "name", event.target.value)} maxLength={60} /></label>
                            <label><span>{translation(t, "weightLabel", "Weight")}</span><input value={item.weight} onChange={(event) => updateStudioItem(index, "weight", event.target.value)} inputMode="numeric" /></label>
                            <label><span>{translation(t, "prizePerWinLabel", "Amount")}</span><input value={item.amount} onChange={(event) => updateStudioItem(index, "amount", event.target.value)} inputMode={studioAsset === "NEO" ? "numeric" : "decimal"} /></label>
                            {studioItems.length > 1 && (
                              <button type="button" className="gasbox-studio-capsules__remove" onClick={() => setStudioItems((current) => current.filter((_, itemIndex) => itemIndex !== index))} aria-label={translation(t, "removeItem", `Remove capsule ${index + 1}`)}>{translation(t, "gasboxRemoveCapsule", "Remove")}</button>
                            )}
                          </article>
                        ))}
                      </div>
                    </div>

                    <footer>
                      <p>{translation(t, "gasboxPublishRoute", "Wallet route: create machine → add capsules → fund max prize → activate.")}</p>
                      <button type="button" className="mx2-btn mx2-btn--primary" onClick={publishStudioMachine} disabled={!studioReady || isCreating}>
                        {isCreating ? translation(t, "publishing", "Publishing…") : translation(t, "gasboxPublishMachine", "Publish machine")}
                      </button>
                    </footer>
                  </div>
                )}
              </section>

              {runtimeIncompatible && (
                <section className="gasbox-compatibility-card">
                  <img src={prizeCapsuleUrl} alt="" aria-hidden="true" />
                  <div>
                    <h4>{translation(t, "gasboxDeploymentPausedTitle", "Paid play is temporarily paused")}</h4>
                    <p>{translation(t, "gasboxDeploymentPausedCopy", "The bound deployment uses an older settle-block draw. You can still browse, reveal an existing committed pull, and return wallet or creator funds.")}</p>
                    <small>{translation(t, "gasboxDeploymentRecoveryCondition", "Resume after a fixed-beacon contract is deployed and the manifest binding is updated.")}</small>
                  </div>
                </section>
              )}

              <section className="gasbox-runtime-card" data-state={runtimeStatus}>
                <div><span>{translation(t, "gasboxNetwork", "Network")}</span><strong>{runtimeNetwork || "—"}</strong></div>
                <div><span>{translation(t, "gasboxContract", "Contract")}</span><strong>{shortHash(runtimeContract)}</strong></div>
                <div><span>{translation(t, "gasboxCatalog", "Catalog")}</span><strong>{catalogStatus}</strong></div>
              </section>
            </div>
          ),
        }}
      />
    </div>
  );
}
