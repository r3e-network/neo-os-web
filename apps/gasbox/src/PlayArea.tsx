/**
 * PlayArea.tsx — GasBox Studio (v2 scene-driven rebuild)
 * Game/tool identity. The slot machine IS the scene: a GasBox machine with
 * pull/reveal animation. Pull is primary; machine list + studio + revenue tucked
 * in drawer. Full state + all 11 dispatch actions preserved.
 */
import { useState, useEffect, useRef } from "react";
import type { CSSProperties } from "react";
import { useStateBindings } from "@shared/react/hooks/useStateBindings";
import type { ObservableState } from "@shared/react/context";
import { ParticleBurst } from "@shared/art";
import { PlayStage } from "@shared/components-react/v2";
import { addressToScriptHash } from "@shared/utils/neo";
import machineArtUrl from "./gasbox-capsule-machine-cutout.webp";
import prizeCapsuleUrl from "./gasbox-prize-capsule-cutout.webp";
import "./PlayArea.scss";

interface P { t: (k: string, p?: Record<string, string|number>) => string; state: ObservableState; dispatch: (n: string, ...a: unknown[]) => Promise<void>; }
interface MachineItem { name?: string; rarity?: string; displayProbability?: number; amountDisplay?: string; available?: boolean; [k: string]: unknown; }
interface Machine { id: string; name?: string; active?: boolean; inventoryReady?: boolean; poolReady?: boolean; price?: string; plays?: number; items?: MachineItem[]; topPrize?: string; poolBalance?: string; maxPrize?: string; creatorHash?: string; revenue?: string; revenueRaw?: number; [k: string]: unknown; }
interface PullResult { id?: string; name?: string; rarity?: string; amountDisplay?: string; [k: string]: unknown; }

function translation(t: P["t"], key: string, fallback: string): string {
  const value = t(key);
  return value && value !== key ? value : fallback;
}

function prizeLabel(item: MachineItem | PullResult | null | undefined, fallback: string): string {
  if (!item) return fallback;
  return String(item.name || item.rarity || item.amountDisplay || fallback);
}

function probabilityLabel(item: MachineItem | null | undefined): string {
  const probability = Number(item?.displayProbability ?? item?.probability);
  return Number.isFinite(probability) && probability > 0
    ? `${probability.toFixed(probability < 1 ? 2 : 1)}%`
    : "";
}

export default function PlayArea({ t, state, dispatch }: P) {
  const { str, bool, num, val } = useStateBindings(state);
  const machines = (val("machines") ?? []) as Machine[];
  const selectedMachine = val<Machine | null>("selectedMachine", null);
  const isLoading = bool("isLoading"); const isPulling = bool("isPulling");
  const pullResult = val<PullResult | null>("pullResult", null);
  const machineCount = num("machineCount");
  const totalPulls = num("totalPulls");
  const userPulls = num("userPulls");
  const selectedMachineName = str("selectedMachineName", "");
  const showResult = bool("showResult");
  const hasPlayCredit = bool("hasPlayCredit");
  const formattedPlayCredit = str("formattedPlayCredit", "0");
  const betPhase = str("betPhase", "");
  const isAwaitingReveal = bool("isAwaitingReveal");
  const walletAddress = str("walletAddress");

  const [pullPreview, setPullPreview] = useState(false);
  const pullPreviewTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => { if (pullPreviewTimeout.current) clearTimeout(pullPreviewTimeout.current); }, []);
  const startPullPreview = () => { if (pullPreviewTimeout.current) clearTimeout(pullPreviewTimeout.current); setPullPreview(true); pullPreviewTimeout.current = setTimeout(() => { setPullPreview(false); pullPreviewTimeout.current = null; }, 1400); };

  const isConnected = walletAddress.length > 0;
  const pulling = isPulling || pullPreview;
  const connectedScriptHash = addressToScriptHash(walletAddress).toLowerCase();
  const selectedName = selectedMachineName.trim();
  const hasDisplayName =
    selectedName.length > 0 &&
    !["-", "n/a", "none", "null", "undefined", "无"].includes(selectedName.toLowerCase());
  const displayMachineName = selectedMachine && hasDisplayName ? selectedName : "";

  const machineId = selectedMachine?.id || machines[0]?.id || "";
  const selectedItems = Array.isArray(selectedMachine?.items) ? selectedMachine.items : [];
  const availableItems = selectedItems.filter((item) => item.available !== false);
  const focusPrize = availableItems[0] ?? null;
  const selectedReady = Boolean(selectedMachine && selectedMachine.active !== false && selectedMachine.inventoryReady !== false && selectedMachine.poolReady !== false);
  const canPull = Boolean(selectedMachine && selectedReady && (isConnected || hasPlayCredit));
  const selectedMachineId = selectedMachine?.id || "";
  const creatorHash = String(selectedMachine?.creatorHash || "").toLowerCase();
  const isCreator = Boolean(selectedMachine && connectedScriptHash && creatorHash && connectedScriptHash === creatorHash);
  const selectedRevenueRaw = Number(selectedMachine?.revenueRaw ?? 0);
  const hasWithdrawableRevenue = isCreator && Number.isFinite(selectedRevenueRaw) && selectedRevenueRaw > 0;
  const hasMachines = machines.length > 0;
  const sceneState = pulling ? "pulling" : showResult ? "result" : isAwaitingReveal ? "pending" : isLoading && !selectedMachine ? "syncing" : selectedMachine ? "ready" : "empty";

  const machineStatusLabel = (machine: Machine | null | undefined) => {
    if (!machine) return translation(t, "gasboxPending", "Sync pending");
    if (machine.active === false) return translation(t, "inactive", "Inactive");
    if (machine.inventoryReady === false || machine.poolReady === false) {
      return translation(t, "gasboxMachineNeedsFunding", "Needs funding");
    }
    return translation(t, "gasboxMachineLive", "Live");
  };

  const handlePull = () => {
    if (!canPull || !machineId) return;
    startPullPreview();
    void dispatch("pull", machineId);
  };
  const handleReveal = () => void dispatch("reveal");
  const handlePrimaryEmpty = () => void dispatch("refreshMachines");
  const handleWithdrawRevenue = () => {
    if (!hasWithdrawableRevenue || !selectedMachineId) return;
    void dispatch("withdrawRevenue", selectedMachineId);
  };

  const statusText = (() => {
    if (betPhase === "committing") return translation(t, "gasboxCommitting", "Placing bet...");
    if (betPhase === "settling") return translation(t, "gasboxRevealing", "Revealing your prize...");
    if (pulling) return translation(t, "pulling", "Pulling...");
    if (showResult) return translation(t, "pullSuccess", "Reveal complete. Your prize is shown below.");
    if (isAwaitingReveal) return translation(t, "gasboxCommitted", "Bet placed - reveal on the next block.");
    if (isLoading && !selectedMachine) return translation(t, "gasboxSyncingMachines", "Syncing live machines and escrowed capsules...");
    if (!selectedMachine) return translation(t, "gasboxEmptyStageHint", "Live capsules appear here after the market syncs.");
    if (!selectedReady) return translation(t, "gasboxPullBlockedTitle", "Pull unavailable");
    return translation(t, "gasboxPullReadyTitle", "Ready for pull");
  })();

  const prizeName = showResult
    ? prizeLabel(pullResult, translation(t, "unknownPrize", "Unknown prize"))
    : focusPrize
      ? prizeLabel(focusPrize, selectedMachine?.topPrize || translation(t, "unknownPrize", "Unknown prize"))
      : selectedMachine
        ? translation(t, "gasboxPrizeDeckPending", "Prize reel syncing")
        : translation(t, "gasboxMarketSyncTitle", "Market sync in progress");
  const prizeOdds = probabilityLabel(focusPrize);
  const prizeCopy = (() => {
    if (showResult) return translation(t, "gasboxOnChainPrizeNote", "The prize was drawn and paid on-chain.");
    if (focusPrize) return prizeOdds ? `${translation(t, "gasboxPrizeFocusOdds", "Drop chance")} ${prizeOdds}` : translation(t, "gasboxReelHint", "Ready to spin");
    if (selectedMachine) return translation(t, "gasboxPrizeDeckPendingCopy", "This machine needs escrow-ready prizes before players can pull.");
    return translation(t, "gasboxMarketSyncCopy", "Refreshing checks live machines, escrowed inventory, and readable odds.");
  })();
  const scoreItems = (selectedMachine || hasMachines || machineCount > 0 || totalPulls > 0 || userPulls > 0 || hasPlayCredit)
    ? [
        { label: t("totalMachines"), value: String(machineCount), accent: true },
        { label: translation(t, "yourPulls", "Your Pulls"), value: String(userPulls) },
        { label: translation(t, "totalPulls", "Total Pulls"), value: String(totalPulls) },
        { label: t("collect") || "Credit", value: formattedPlayCredit },
      ]
    : undefined;

  const scene = (
    <div className="gasbox-scene" data-state={sceneState} data-ready={selectedReady ? "true" : "false"}>
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
        <div className="gasbox-scene__chute" aria-hidden={!pulling && !showResult}>
          {(pulling || showResult) && (
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
                {showResult ? translation(t, "congratulations", "Prize revealed") : translation(t, "gasboxPrizeFocus", "Prize focus")}
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
            <strong>{prizeName}</strong>
            <p>{prizeCopy}</p>
            <ol className="gasbox-scene__route" aria-label={translation(t, "gasboxPlayerRoute", "Player route")}>
              <li>{translation(t, "gasboxEmptyRouteRefresh", "Refresh market")}</li>
              <li>{translation(t, "gasboxEmptyRoutePick", "Pick a machine")}</li>
              <li>{translation(t, "gasboxEmptyRouteReveal", "Reveal prize")}</li>
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

  const controls = (
    <div className="gasbox-controls">
      {machines.length > 0 && (
        <div className="gasbox-controls__machines">
          {machines.slice(0, 5).map((m) => (
            <button key={m.id} type="button" className={["gasbox-machine-chip", selectedMachine?.id === m.id ? "gasbox-machine-chip--active" : null].filter(Boolean).join(" ")} onClick={() => void dispatch("selectMachine", m.id)} disabled={pulling}>
              <img src={prizeCapsuleUrl} alt="" aria-hidden="true" />
              <span>{m.name || m.id}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );

  return (
    <div className="gasbox-play-area mx2 mx2-cat-game">
      <PlayStage category="game" stage={{ eyebrow: t("title"), title: displayMachineName || translation(t, "gasboxHeroTitle", "Pick a GasBox machine"), subtitle: selectedMachine ? translation(t, "gasboxWalletIntent", "The wallet confirms the GAS bet; the prize reveals on the next block.") : translation(t, "docSubtitle", "On-chain blind boxes with escrowed prizes"), badges: (
        <>
          <span className="mx2-badge" data-tone="accent"><span className="mx2-badge__dot" /> {machineCount} {translation(t, "totalMachines", "Machines").toLowerCase()}</span>
          {hasPlayCredit && <span className="mx2-badge">{formattedPlayCredit} GAS</span>}
          {selectedMachine && <span className="mx2-badge">{selectedReady ? translation(t, "readyToPlay", "Ready") : translation(t, "inactive", "Inactive")}</span>}
        </>
      ) }}
        scene={<div className="gasbox-stage-stack">{scene}{controls}</div>}
        score={scoreItems}
        actions={{
          primary: isAwaitingReveal
            ? { label: translation(t, "gasboxRevealAction", "Reveal result"), onClick: () => void handleReveal(), loading: isPulling, hint: translation(t, "gasboxRevealHint", "Safe to retry - the reveal pays exactly once.") }
            : selectedMachine
              ? { label: pulling ? translation(t, "pulling", "Pulling...") : translation(t, "pull", "Pull"), onClick: () => void handlePull(), disabled: pulling || !canPull, loading: pulling, hint: selectedReady ? translation(t, "gasboxTwoStepNote", "Pulls are two steps: place the bet, then reveal on the next block.") : translation(t, "gasboxInventoryActionRequired", "Inventory needs funding before players can pull.") }
              : { label: isLoading ? translation(t, "loadingMachines", "Loading machines...") : translation(t, "gasboxFindMachines", "Find Machines"), onClick: () => void handlePrimaryEmpty(), disabled: isLoading, loading: isLoading, hint: translation(t, "gasboxMarketEmptyTeaser", "Active capsule machines land here. Refresh to pull one.") },
          secondary: [
            ...(selectedMachine ? [{ label: translation(t, "refreshMachines", "Refresh Machines"), onClick: () => void dispatch("refreshMachines"), hint: translation(t, "gasboxMachineLive", "Live") }] : []),
          ],
        }}
        drawerToggleLabel={t("allMachines")} drawer={{ title: t("allMachines"), children: (
          <div className="gasbox-drawer">
            <section className="gasbox-drawer-card gasbox-drawer-card--machines">
              <div className="gasbox-drawer-card__head">
                <div>
                  <h4>{translation(t, "gasboxDrawerMarketTitle", "Machine counter")}</h4>
                  <p>{translation(t, "gasboxDrawerMarketCopy", "Pick a live machine or refresh the market before pulling.")}</p>
                </div>
                <span>{hasMachines ? `${machines.length}` : "0"}</span>
              </div>
              {hasMachines ? (
                <ul className="gasbox-machine-list">{machines.slice(0, 10).map((m) => (
                  <li key={m.id} className="gasbox-machine-list__item" data-active={selectedMachine?.id === m.id ? "true" : undefined}>
                    <img src={prizeCapsuleUrl} alt="" aria-hidden="true" />
                    <div>
                      <strong>{m.name || m.id}</strong>
                      <small>{machineStatusLabel(m)}</small>
                    </div>
                    <button type="button" className="mx2-btn mx2-btn--ghost" onClick={() => void dispatch("selectMachine", m.id)}>{t("tapToPlay")}</button>
                  </li>
                ))}</ul>
              ) : (
                <div className="gasbox-drawer-empty">
                  <img src={prizeCapsuleUrl} alt="" aria-hidden="true" />
                  <p>{translation(t, "gasboxDrawerMarketEmpty", "No active machines are loaded yet. Refresh the market to fill the counter.")}</p>
                </div>
              )}
            </section>

            <section className="gasbox-drawer-card">
              <div className="gasbox-drawer-card__head">
                <div>
                  <h4>{t("createMachineAction")}</h4>
                  <p>{t("createPanelHint")}</p>
                </div>
              </div>
              <button type="button" className="mx2-btn mx2-btn--ghost" onClick={() => void dispatch("openStudio")}>{t("create")}</button>
            </section>

            {hasPlayCredit && (
              <section className="gasbox-drawer-card">
                <h4>{translation(t, "gasboxPlayCreditLabel", "Prepaid credit")}</h4>
                <p>{formattedPlayCredit} GAS. {translation(t, "gasboxPlayCreditHint", "Your next pull uses it automatically.")}</p>
              </section>
            )}
            {selectedMachine && isCreator && (
              <section className="gasbox-creator-panel" aria-label={translation(t, "gasboxCreatorEarningsTitle", "Creator earnings")}>
                <div>
                  <h4>{translation(t, "gasboxCreatorEarningsTitle", "Creator earnings")}</h4>
                  <p>
                    {hasWithdrawableRevenue
                      ? translation(t, "gasboxRevenueAvailable", "Accrued play revenue is available to withdraw to your wallet.")
                      : translation(t, "gasboxRevenueNone", "No withdrawable revenue yet. Earnings accrue as players pull this machine.")}
                  </p>
                </div>
                <div className="gasbox-creator-panel__row">
                  <strong>{selectedMachine.revenue || "0"} GAS</strong>
                  <button type="button" className="mx2-btn mx2-btn--ghost" onClick={handleWithdrawRevenue} disabled={!hasWithdrawableRevenue}>
                    {translation(t, "withdrawRevenue", "Withdraw Revenue")}
                  </button>
                </div>
              </section>
            )}
          </div>
        ) }}
      />
    </div>
  );
}
