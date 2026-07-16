import { type ReactNode, useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowLeftRight,
  ArrowRight,
  Check,
  CheckCircle2,
  CircleAlert,
  Circle,
  CircleDashed,
  Clock3,
  ExternalLink,
  PackageCheck,
  RefreshCw,
  Route,
  SearchCheck,
  ShieldCheck,
  WalletCards,
} from "lucide-react";
import { useNowMs } from "@shared/react/hooks/useNowMs";
import { useStateBindings } from "@shared/react/hooks/useStateBindings";
import type { ObservableState } from "@shared/react/context";
import { CoinArt } from "@shared/art/CoinArt";
import { PlayStage } from "@shared/components-react/v2/PlayStage";
import {
  BRIDGE_RESOURCES,
  bridgeNetworks,
  buildAssetBridgeHandoff,
  compactHash,
  isBridgeTransactionHash,
  isValidTargetAddress,
  normalizeBridgeAmount,
  normalizeDirection,
  sourceExplorerUrl,
  type AssetBridgeHandoff,
  type BridgeDirection,
  type BridgeAsset,
  type BridgeEnvironment,
  type BridgeEvidenceState,
  type BridgeServiceBoundary,
  type BridgeVerificationEvidence,
  type BridgeWalletSnapshot,
  type TimelineState,
  type TimelineStep,
} from "./bridgeConsole";
import "./PlayArea.scss";

interface P {
  t: (k: string, p?: Record<string, string | number>) => string;
  state: ObservableState;
  dispatch: (n: string, ...a: unknown[]) => Promise<void>;
  launchContext?: {
    operation?: string | null;
    params?: Record<string, string>;
  } | null;
}

type WorkspaceMode = "bridge" | "track";
type DrawerMode = "handoff" | "evidence" | "resources";

const ROUTE_ART = new URL("../public/bridge-route.webp", import.meta.url).href;
const NEO_X_MARK = new URL("../public/neo-x-mark.svg", import.meta.url).href;
const ASSET_PRESETS: Record<BridgeAsset, string[]> = {
  GAS: ["0.1", "1", "5"],
  NEO: ["1", "10", "50"],
};

function isValidAmount(asset: BridgeAsset, value: string): boolean {
  try {
    normalizeBridgeAmount(asset, value);
    return true;
  } catch {
    return false;
  }
}

function evidenceTone(value: BridgeEvidenceState): "ready" | "blocked" | "idle" {
  return value === "verified" ? "ready" : value === "unverified" ? "blocked" : "idle";
}

function timelineIcon(state: TimelineState): ReactNode {
  if (state === "done") return <Check size={15} aria-hidden="true" />;
  if (state === "active") return <Clock3 size={15} aria-hidden="true" />;
  if (state === "error") return <CircleAlert size={15} aria-hidden="true" />;
  if (state === "unknown") return <SearchCheck size={15} aria-hidden="true" />;
  return <CircleDashed size={15} aria-hidden="true" />;
}

function short(value: string): string {
  const text = String(value || "").trim();
  return text ? compactHash(text) : "—";
}

export default function PlayArea({ t, state, dispatch, launchContext }: P) {
  const { str, bool, val } = useStateBindings(state);
  const launchParams = launchContext?.params ?? {};
  const launchSourceTx = String(launchParams.sourceTx ?? launchParams.txHash ?? "").trim();
  const recoveredSourceTx = str("recoverySourceTx", "");
  const recoveredDirection = str("recoveryDirection", "n3-to-neox");
  const [mode, setMode] = useState<WorkspaceMode>(() =>
    /track|verify/i.test(String(launchContext?.operation ?? "")) || isBridgeTransactionHash(launchSourceTx)
      ? "track"
      : "bridge"
  );
  const [drawerMode, setDrawerMode] = useState<DrawerMode>("handoff");
  const [direction, setDirection] = useState<BridgeDirection>(() =>
    normalizeDirection(launchParams.direction ?? launchParams.route ?? recoveredDirection)
  );
  const [asset, setAsset] = useState<BridgeAsset>(() =>
    String(launchParams.asset ?? "GAS").trim().toUpperCase() === "NEO" ? "NEO" : "GAS"
  );
  const [amount, setAmount] = useState(() => String(launchParams.amount ?? "").trim());
  const [recipient, setRecipient] = useState(() =>
    String(launchParams.recipient ?? launchParams.to ?? launchParams.address ?? "").trim()
  );
  const [sourceTx, setSourceTx] = useState(() => launchSourceTx || recoveredSourceTx);
  const [amountTouched, setAmountTouched] = useState(false);
  const [recipientTouched, setRecipientTouched] = useState(false);
  const [sourceTxTouched, setSourceTxTouched] = useState(false);
  const now = useNowMs(30_000);
  const hydratedHandoffRef = useRef("");
  const discardingHandoffRef = useRef(false);

  const bridgeEnvironment = str("bridgeEnvironment", "mainnet") as BridgeEnvironment;
  const officialBridgeUrl = str("bridgeAppUrl", BRIDGE_RESOURCES.bridgeAppMainnet);
  const lastStatus = str("lastStatus", t("statusReady"));
  const actionBusy = bool("actionBusy");
  const verificationState = str("verificationState", "idle");
  const walletBusy = str("walletBusy", "");
  const walletError = str("walletError", "");
  const activeHandoff = val<AssetBridgeHandoff>("activeHandoff");
  const n3Wallet = val<BridgeWalletSnapshot>("n3Wallet");
  const neoXWallet = val<BridgeWalletSnapshot>("neoXWallet");
  const verification = val<BridgeVerificationEvidence>("verification");
  const timeline = val<TimelineStep[]>("timeline", []) ?? [];
  const boundary = val<BridgeServiceBoundary>("serviceBoundary");
  const networks = bridgeNetworks(direction, bridgeEnvironment);
  const expectedNetworkId = (chain: "neo-n3" | "neo-x") => chain === "neo-n3"
    ? bridgeEnvironment === "mainnet" ? "neo-n3-mainnet" : "neo-n3-testnet"
    : bridgeEnvironment === "mainnet" ? "neo-x-mainnet" : "neo-x-testnet";
  const sourceWallet = networks.source.key === "neo-n3" ? n3Wallet : neoXWallet;
  const destinationWallet = networks.destination.key === "neo-n3" ? n3Wallet : neoXWallet;
  const sourceWalletReady = Boolean(
    sourceWallet &&
    sourceWallet.environment === bridgeEnvironment &&
    sourceWallet.chain === networks.source.key &&
    sourceWallet.network === expectedNetworkId(networks.source.key),
  );
  const destinationWalletReady = Boolean(
    destinationWallet &&
    destinationWallet.environment === bridgeEnvironment &&
    destinationWallet.chain === networks.destination.key &&
    destinationWallet.network === expectedNetworkId(networks.destination.key),
  );
  const sourceBalance = sourceWalletReady ? sourceWallet?.balances[asset] : null;
  const visibleVerification = verification &&
    verification.environment === bridgeEnvironment &&
    verification.direction === direction &&
    verification.sourceTx.toLowerCase() === sourceTx.trim().toLowerCase()
    ? verification
    : null;

  const amountReady = isValidAmount(asset, amount);
  const recipientFormatReady = isValidTargetAddress(direction, recipient);
  const recipientMatchesDestinationWallet = !destinationWalletReady || !destinationWallet
    ? true
    : networks.destination.key === "neo-x"
      ? destinationWallet.address.toLowerCase() === recipient.toLowerCase()
      : destinationWallet.address === recipient;
  const recipientReady = recipientFormatReady && recipientMatchesDestinationWallet;
  const txReady = isBridgeTransactionHash(sourceTx);
  const amountError = amountTouched && amount.length > 0 && !amountReady;
  const recipientError = recipient.length > 0 && !recipientReady && (
    recipientTouched || Boolean(destinationWalletReady)
  );
  const sourceTxError = sourceTxTouched && sourceTx.length > 0 && !txReady;

  const draftDigest = useMemo(() => {
    if (!amountReady || !recipientReady || !sourceWalletReady || !sourceWallet) return "";
    try {
      return buildAssetBridgeHandoff(
        { direction, asset, amount, recipient, sourceAccount: sourceWallet.address },
        "2026-01-01T00:00:00.000Z",
        bridgeEnvironment,
      ).digest;
    } catch {
      return "";
    }
  }, [amount, amountReady, asset, bridgeEnvironment, direction, recipient, recipientReady, sourceWallet, sourceWalletReady]);

  const handoffMatchesDraft = Boolean(activeHandoff && draftDigest && activeHandoff.digest === draftDigest);
  const handoffExpired = Boolean(activeHandoff && Date.parse(activeHandoff.snapshotExpiresAt) <= now);
  const prepared = handoffMatchesDraft && !handoffExpired;
  const expiredCurrentHandoff = handoffMatchesDraft && handoffExpired;
  const preparedRequestId = prepared ? activeHandoff?.requestId ?? "" : "";

  useEffect(() => {
    if (!activeHandoff) return;
    if (
      hydratedHandoffRef.current !== activeHandoff.digest &&
      !amount.trim() &&
      !recipient.trim()
    ) {
      hydratedHandoffRef.current = activeHandoff.digest;
      setDirection(activeHandoff.direction);
      setAsset(activeHandoff.token.symbol);
      setAmount(activeHandoff.amount);
      setRecipient(activeHandoff.recipient);
      return;
    }
    if (sourceWalletReady && !handoffMatchesDraft && !discardingHandoffRef.current) {
      discardingHandoffRef.current = true;
      void dispatch("discardBridgeIntent").finally(() => {
        discardingHandoffRef.current = false;
      });
    }
  }, [activeHandoff, amount, dispatch, handoffMatchesDraft, recipient, sourceWalletReady]);

  useEffect(() => {
    if (
      destinationWalletReady &&
      destinationWallet?.address &&
      !recipient.trim() &&
      !recipientTouched
    ) {
      setRecipient(destinationWallet.address);
    }
  }, [destinationWallet, destinationWalletReady, recipient, recipientTouched]);

  const swapDirection = async () => {
    if (actionBusy || verificationState === "checking") return;
    const next = direction === "n3-to-neox" ? "neox-to-n3" : "n3-to-neox";
    setDirection(next);
    setSourceTx("");
    setRecipient("");
    setSourceTxTouched(false);
    setRecipientTouched(false);
    if (activeHandoff) await dispatch("discardBridgeIntent");
    await dispatch("resetBridgeVerification", { direction: next });
  };

  const selectAsset = async (next: BridgeAsset) => {
    if (next === asset || actionBusy || verificationState === "checking") return;
    setAsset(next);
    setAmount("");
    setAmountTouched(false);
    if (activeHandoff) await dispatch("discardBridgeIntent");
  };

  const connectChain = async (chain: "neo-n3" | "neo-x") => {
    if (actionBusy || walletBusy) return;
    await dispatch("connectBridgeWallet", { chain });
  };

  const prepareOrContinue = async () => {
    setAmountTouched(true);
    setRecipientTouched(true);
    if (!sourceWalletReady) {
      await connectChain(networks.source.key);
      return;
    }
    if (!amountReady || !recipientReady || actionBusy || walletBusy) return;
    if (prepared) {
      window.open(activeHandoff?.officialBridgeUrl ?? officialBridgeUrl, "_blank", "noopener,noreferrer");
      return;
    }
    await dispatch("prepareAssetBridge", {
      direction,
      asset,
      amount,
      recipient,
    });
  };

  const verifySource = async () => {
    setSourceTxTouched(true);
    if (!txReady || actionBusy) return;
    const boundHandoff = activeHandoff?.direction === direction ? activeHandoff : null;
    await dispatch("trackBridgeOperation", {
      bridgeKind: "asset",
      direction,
      operationId: boundHandoff?.requestId ?? "",
      intentDigest: boundHandoff?.digest ?? "",
      sourceTx,
    });
  };

  const sourceService = networks.source.key === "neo-n3" ? boundary?.n3Rpc : boundary?.neoXRpc;
  const destinationService = networks.destination.key === "neo-n3" ? boundary?.n3Rpc : boundary?.neoXRpc;
  const serviceTone = (value: string | undefined) => value === "ready" ? "ready" : value === "checking" ? "checking" : "blocked";
  const sourceStateLabel = visibleVerification?.sourceTransaction === "confirmed"
    ? t("sourceConfirmed")
    : visibleVerification?.sourceTransaction === "faulted"
      ? t("sourceFaulted")
      : visibleVerification?.sourceTransaction === "pending"
        ? t("sourcePending")
        : visibleVerification?.sourceTransaction === "unknown"
          ? t("sourceUnknown")
          : t("sourceNotChecked");
  const expiryMinutes = activeHandoff
    ? Math.max(0, Math.ceil((Date.parse(activeHandoff.snapshotExpiresAt) - now) / 60_000))
    : 0;

  const routeVisual = (
    <section className="nxb-route-stage" aria-label={t("bridgeStageAria")}>
      <img className="nxb-route-stage__art" src={ROUTE_ART} alt="" aria-hidden="true" loading="eager" decoding="async" />
      <div className="nxb-route-stage__veil" aria-hidden="true" />
      <div className="nxb-route-stage__content">
        <div className="nxb-route-stage__heading">
          <span>{t("liveRoute")}</span>
          <strong>{networks.source.label} <span aria-hidden="true">→</span> {networks.destination.label}</strong>
          <small>{bridgeEnvironment === "testnet" ? t("testnetRoute") : t("mainnetRoute")}</small>
        </div>
        <div className="nxb-route-stage__route">
          <div className="nxb-chain-node" data-chain={networks.source.key}>
            {networks.source.key === "neo-n3" ? <CoinArt size={48} variant="neo" decorative /> : <img className="nxb-x-mark" src={NEO_X_MARK} alt="" aria-hidden="true" />}
            <span>{t("sourceChain")}</span>
            <strong>{networks.source.label}</strong>
            <small>{networks.source.network}</small>
            <button
              type="button"
              className="nxb-wallet-link"
              data-ready={sourceWalletReady ? "true" : undefined}
              disabled={Boolean(walletBusy) || actionBusy}
              onClick={() => void connectChain(networks.source.key)}
            >
              <WalletCards size={13} aria-hidden="true" />
              {walletBusy === networks.source.key
                ? t("connectingWallet")
                : sourceWalletReady
                  ? short(sourceWallet?.address ?? "")
                  : t("connectWallet")}
            </button>
          </div>
          <div className="nxb-route-rail" data-active={prepared ? "true" : undefined} aria-hidden="true">
            <ArrowRight className="nxb-route-direction" strokeWidth={1.7} />
            <span className="nxb-route-rail__packet"><CoinArt size={34} variant={asset === "NEO" ? "neo" : "gas"} decorative /></span>
          </div>
          <div className="nxb-chain-node" data-chain={networks.destination.key}>
            {networks.destination.key === "neo-n3" ? <CoinArt size={48} variant="neo" decorative /> : <img className="nxb-x-mark" src={NEO_X_MARK} alt="" aria-hidden="true" />}
            <span>{t("destinationChain")}</span>
            <strong>{networks.destination.label}</strong>
            <small>{networks.destination.network}</small>
            <button
              type="button"
              className="nxb-wallet-link"
              data-ready={destinationWalletReady ? "true" : undefined}
              disabled={Boolean(walletBusy) || actionBusy}
              onClick={() => void connectChain(networks.destination.key)}
            >
              <WalletCards size={13} aria-hidden="true" />
              {walletBusy === networks.destination.key
                ? t("connectingWallet")
                : destinationWalletReady
                  ? short(destinationWallet?.address ?? "")
                  : t("connectWallet")}
            </button>
          </div>
        </div>
        <button
          type="button"
          className="nxb-swap-route"
          onClick={() => void swapDirection()}
          disabled={actionBusy || verificationState === "checking"}
          aria-label={t("swapRoute")}
        >
          <ArrowLeftRight size={16} aria-hidden="true" /> {t("swapRoute")}
        </button>
        <div className="nxb-service-strip" aria-label={t("serviceBoundaryTitle")} aria-live="polite">
          <span data-tone={serviceTone(sourceService)}><Circle className="nxb-service-dot" size={8} fill="currentColor" aria-hidden="true" />{t("sourceRpc")}</span>
          <span data-tone={serviceTone(destinationService)}><Circle className="nxb-service-dot" size={8} fill="currentColor" aria-hidden="true" />{t("destinationRpc")}</span>
          <span data-tone="external"><Circle className="nxb-service-dot" size={8} fill="currentColor" aria-hidden="true" />{t("officialQuoteOnly")}</span>
        </div>
      </div>
    </section>
  );

  const bridgeComposer = (
    <section className="nxb-composer" aria-labelledby="nxb-composer-title">
      <div className="nxb-composer__head">
        <div>
          <span>{t("assetTicketEyebrow", { asset })}</span>
          <h3 id="nxb-composer-title">{t("bridgeAssetTitle", { asset })}</h3>
        </div>
        <div className="nxb-asset-switch" role="radiogroup" aria-label={t("assetSelectorAria")}>
          {(["GAS", "NEO"] as const).map((option) => (
            <button
              key={option}
              type="button"
              role="radio"
              aria-checked={asset === option}
              className={asset === option ? "is-active" : undefined}
              onClick={() => void selectAsset(option)}
              disabled={actionBusy || verificationState === "checking"}
            >
              <CoinArt size={23} variant={option === "NEO" ? "neo" : "gas"} decorative />
              {option}
            </button>
          ))}
        </div>
      </div>

      <div className="nxb-amount-deck">
        <label htmlFor="nxb-amount">{t("amount")}</label>
        <div className="nxb-amount-deck__entry" data-invalid={amountError ? "true" : undefined}>
          <CoinArt size={42} variant={asset === "NEO" ? "neo" : "gas"} decorative />
          <input
            id="nxb-amount"
            inputMode={asset === "NEO" ? "numeric" : "decimal"}
            autoComplete="off"
            placeholder="0.0"
            value={amount}
            aria-invalid={amountError || undefined}
            aria-describedby={amountError ? "nxb-amount-error" : undefined}
            onChange={(event) => setAmount(event.target.value.replace(/[\u0000-\u001f\u007f]/g, "").slice(0, 32))}
            onBlur={() => setAmountTouched(true)}
          />
          <strong>{asset}</strong>
        </div>
        <div className="nxb-presets" aria-label={t("amountPresetsAria", { asset })}>
          {ASSET_PRESETS[asset].map((preset) => (
            <button key={preset} type="button" className={amount === preset ? "is-active" : undefined} onClick={() => { setAmount(preset); setAmountTouched(true); }}>
              {preset}
            </button>
          ))}
        </div>
        <div className="nxb-balance-read" data-ready={sourceBalance?.display != null ? "true" : undefined}>
          <span>{t("sourceBalance")}</span>
          <strong>{sourceBalance?.display != null
            ? asset === "NEO"
              ? t("neoBalanceWithGasReserve", {
                  neo: sourceBalance.display,
                  gas: sourceWallet?.balances.GAS.display ?? "—",
                })
              : `${sourceBalance.display} ${asset}`
            : sourceWalletReady
              ? t(asset === "NEO" && networks.source.key === "neo-x" ? "balanceAtOfficialBridge" : "balanceUnavailable")
              : t("connectSourceForBalance")}</strong>
        </div>
        {amountError ? <small id="nxb-amount-error" className="nxb-field-error">{t(asset === "NEO" ? "errAmountNeoWhole" : "errAmountFixed8")}</small> : null}
      </div>

      <div className="nxb-recipient">
        <label htmlFor="nxb-recipient">
          <span>{t("destinationAddress")}</span>
          <small>{networks.destination.key === "neo-x" ? t("recipientNeoX") : t("recipientNeoN3")}</small>
        </label>
        <input
          id="nxb-recipient"
          autoComplete="off"
          spellCheck={false}
          placeholder={networks.destination.key === "neo-x" ? "0x…" : "N…"}
          value={recipient}
          aria-invalid={recipientError || undefined}
          aria-describedby={recipientError ? "nxb-recipient-error" : undefined}
          onChange={(event) => setRecipient(event.target.value.trim().slice(0, 64))}
          onBlur={() => setRecipientTouched(true)}
        />
        {recipientError ? <small id="nxb-recipient-error" className="nxb-field-error">{t(
          recipientFormatReady
            ? "errDestinationWalletMismatch"
            : networks.destination.key === "neo-x" ? "errAddressNeoX" : "errAddressNeoN3",
        )}</small> : null}
        <small className="nxb-field-note">{destinationWalletReady && recipientMatchesDestinationWallet
          ? t("recipientMatchesConnectedWallet")
          : t("recipientMatchBoundary")}</small>
      </div>

      <dl className="nxb-bound-summary" aria-label={t("handoffFactsTitle")}>
        <div><dt>{t("quoteOutput")}</dt><dd>{t("officialBridgeRequired")}</dd></div>
        <div><dt>{t("costsBridgeFee")}</dt><dd>{t("feeAtOfficialBridge")}</dd></div>
        <div><dt>{t("estimatedTime")}</dt><dd>{t("oneToTwoMinutes")}</dd></div>
        <div><dt>{t("snapshotExpiry")}</dt><dd>{prepared ? t("expiresInMinutes", { minutes: expiryMinutes }) : expiredCurrentHandoff ? t("handoffExpired") : t("tenMinuteSnapshot")}</dd></div>
      </dl>

      {walletError ? (
        <div className="nxb-wallet-error" role="alert">
          <CircleAlert size={17} aria-hidden="true" />
          <span>{walletError}</span>
        </div>
      ) : null}

      {prepared ? (
        <div className="nxb-ready-ticket" role="status">
          <span><CheckCircle2 size={20} aria-hidden="true" /></span>
          <div><strong>{t("handoffBound")}</strong><small>{preparedRequestId}</small></div>
          <ExternalLink size={16} aria-hidden="true" />
        </div>
      ) : expiredCurrentHandoff ? (
        <div className="nxb-expired-ticket" role="status">
          <span><Clock3 size={20} aria-hidden="true" /></span>
          <div><strong>{t("handoffExpiredTitle")}</strong><small>{t("handoffExpiredBody")}</small></div>
          <RefreshCw size={16} aria-hidden="true" />
        </div>
      ) : null}
    </section>
  );

  const trackingPanel = (
    <section className="nxb-tracker" aria-labelledby="nxb-tracker-title">
      <div className="nxb-tracker__head">
        <div>
          <span>{t("sourceVerificationEyebrow")}</span>
          <h3 id="nxb-tracker-title">{t("verifySourceTitle")}</h3>
        </div>
        <ShieldCheck size={28} aria-hidden="true" />
      </div>
      <p>{t("verifySourceBody")}</p>
      <div className="nxb-tx-entry">
        <label htmlFor="nxb-source-tx">{t("sourceTx")}</label>
        <input
          id="nxb-source-tx"
          autoComplete="off"
          spellCheck={false}
          placeholder="0x…"
          value={sourceTx}
          disabled={actionBusy || verificationState === "checking"}
          aria-invalid={sourceTxError || undefined}
          aria-describedby={sourceTxError ? "nxb-source-tx-error" : undefined}
          onChange={(event) => {
            const next = event.target.value.trim().slice(0, 66);
            setSourceTx(next);
            if (
              (verification && verification.sourceTx.toLowerCase() !== next.toLowerCase()) ||
              (recoveredSourceTx && recoveredSourceTx.toLowerCase() !== next.toLowerCase())
            ) {
              void dispatch("resetBridgeVerification", { direction });
            }
          }}
          onBlur={() => setSourceTxTouched(true)}
        />
        {sourceTxError ? <small id="nxb-source-tx-error" className="nxb-field-error">{t("errSourceTx")}</small> : null}
      </div>

      <div className="nxb-evidence-board" aria-live="polite">
        <div data-tone={visibleVerification?.sourceTransaction === "confirmed" ? "ready" : visibleVerification?.sourceTransaction === "faulted" ? "blocked" : "idle"}>
          <span><SearchCheck size={18} aria-hidden="true" /></span>
          <small>{t("sourceTransaction")}</small>
          <strong>{verificationState === "checking" ? t("checking") : sourceStateLabel}</strong>
        </div>
        <div data-tone={evidenceTone(visibleVerification?.sourceEvent ?? "unverified")}>
          <span><Route size={18} aria-hidden="true" /></span>
          <small>{t("sourceBridgeEvent")}</small>
          <strong>{visibleVerification?.sourceEvent === "verified" ? t("verified") : t("notVerified")}</strong>
        </div>
        <div data-tone="blocked">
          <span><ShieldCheck size={18} aria-hidden="true" /></span>
          <small>{t("destinationDelivery")}</small>
          <strong>{t("notVerified")}</strong>
        </div>
      </div>

      {visibleVerification?.sourceTx ? (
        <div className="nxb-source-result" data-state={visibleVerification.sourceTransaction}>
          <CircleAlert size={18} aria-hidden="true" />
          <div>
            <strong>{visibleVerification.sourceTransaction === "confirmed"
              ? t("sourceOnlyConfirmed")
              : visibleVerification.sourceTransaction === "faulted"
                ? t("sourceFaultedFinal")
                : visibleVerification.sourceTransaction === "pending"
                  ? t("sourcePendingRetry")
                  : t("verificationRetryable")}</strong>
            <small>{t("destinationNeverInferred")}</small>
          </div>
          <a href={sourceExplorerUrl(visibleVerification.direction, visibleVerification.environment, visibleVerification.sourceTx)} target="_blank" rel="noreferrer" aria-label={t("viewSourceTxExplorer")}>
            <ExternalLink size={16} aria-hidden="true" />
          </a>
        </div>
      ) : null}
    </section>
  );

  const drawerPanels: Record<DrawerMode, ReactNode> = {
    handoff: (
      <dl className="nxb-detail-list">
        <div><dt>{t("requestId")}</dt><dd><code>{short(activeHandoff?.requestId ?? "")}</code></dd></div>
        <div><dt>{t("sourceChain")}</dt><dd>{networks.source.network} · {networks.source.chainId}</dd></div>
        <div><dt>{t("destinationChain")}</dt><dd>{networks.destination.network} · {networks.destination.chainId}</dd></div>
        <div><dt>{t("asset")}</dt><dd>{activeHandoff?.token.symbol ?? asset}</dd></div>
        <div><dt>{t("sourceWallet")}</dt><dd><code>{short(activeHandoff?.sourceAccount ?? sourceWallet?.address ?? "")}</code></dd></div>
        <div><dt>{t("amount")}</dt><dd>{activeHandoff?.amount ?? (amountReady ? amount : "—")}</dd></div>
        <div><dt>{t("recipient")}</dt><dd><code>{short(activeHandoff?.recipient ?? recipient)}</code></dd></div>
        <div><dt>{t("quoteOutput")}</dt><dd>{t("officialBridgeRequired")}</dd></div>
        <div><dt>{t("costsBridgeFee")}</dt><dd>{t("feeAtOfficialBridge")}</dd></div>
        <div><dt>{t("estimatedTime")}</dt><dd>{t("oneToTwoMinutes")}</dd></div>
        <div><dt>{t("approval")}</dt><dd>{t(asset === "NEO" ? "approvalIfRequired" : "walletReviewAtOfficialBridge")}</dd></div>
        <div><dt>{t("snapshotExpiry")}</dt><dd>{activeHandoff ? new Date(activeHandoff.snapshotExpiresAt).toLocaleString() : "—"}</dd></div>
      </dl>
    ),
    evidence: (
      <ol className="nxb-evidence-timeline">
        {timeline.map((step) => (
          <li key={step.key} data-state={step.state}>
            <span>{timelineIcon(step.state)}</span>
            <div><strong>{t(step.labelKey)}</strong><small>{t(step.detailKey, step.detailParams)}</small></div>
          </li>
        ))}
      </ol>
    ),
    resources: (
      <div className="nxb-resources">
        <a href={officialBridgeUrl} target="_blank" rel="noreferrer"><span>{t("resOfficialBridge")}</span><ExternalLink size={15} aria-hidden="true" /></a>
        <a href={BRIDGE_RESOURCES.assetBridgeDocs} target="_blank" rel="noreferrer"><span>{t("resAssetBridgeDocs")}</span><ExternalLink size={15} aria-hidden="true" /></a>
        <a href={BRIDGE_RESOURCES.bridgeIndexer} target="_blank" rel="noreferrer"><span>{t("resBridgeIndexer")}</span><ExternalLink size={15} aria-hidden="true" /></a>
        <a href={BRIDGE_RESOURCES.messageBridgeDocs} target="_blank" rel="noreferrer"><span>{t("resMessageBridgeDocs")}</span><ExternalLink size={15} aria-hidden="true" /></a>
        <p>{t("messageBridgeAdvancedNote")}</p>
      </div>
    ),
  };

  const primaryLabel = mode === "track"
    ? verificationState === "checking" ? t("checkingSource") : visibleVerification ? t("checkAgain") : t("verifySourceAction")
    : !sourceWalletReady
      ? t("connectSourceWallet")
      : prepared ? t("continueOfficialBridge") : expiredCurrentHandoff ? t("renewHandoffAction") : t("prepareHandoffAction");

  return (
    <div className="neo-x-bridge-play-area mx2 mx2-cat-defi">
      <PlayStage
        category="defi"
        stage={{
          eyebrow: t("heroEyebrow"),
          title: t("heroTitleShort"),
          subtitle: t("heroNoFundsShort"),
          badges: <span className="mx2-badge" data-tone="accent"><span className="mx2-badge__dot" />{t("reviewWorkspace")}</span>,
        }}
        scene={(
          <div className="nxb-console" data-mode={mode}>
            <div className="nxb-mode-switch" role="tablist" aria-label={t("workspaceModeAria")}>
              <button type="button" role="tab" aria-selected={mode === "bridge"} className={mode === "bridge" ? "is-active" : undefined} onClick={() => setMode("bridge")}>
                <PackageCheck size={16} aria-hidden="true" />{t("bridgeAssets")}
              </button>
              <button type="button" role="tab" aria-selected={mode === "track"} className={mode === "track" ? "is-active" : undefined} onClick={() => setMode("track")}>
                <SearchCheck size={16} aria-hidden="true" />{t("verifyTransfer")}
              </button>
            </div>
            {routeVisual}
            {mode === "bridge" ? bridgeComposer : trackingPanel}
            <p className="nxb-live-status" role="status">{lastStatus}</p>
          </div>
        )}
        actions={{
          primary: {
            label: primaryLabel,
            onClick: mode === "track" ? () => void verifySource() : () => void prepareOrContinue(),
            loading: actionBusy || verificationState === "checking" || Boolean(walletBusy),
            disabled: mode === "track"
              ? !txReady
              : sourceWalletReady ? !amountReady || !recipientReady : false,
            icon: prepared && mode === "bridge"
              ? <ExternalLink size={17} aria-hidden="true" />
              : mode === "track"
                ? <SearchCheck size={17} aria-hidden="true" />
                : sourceWalletReady
                  ? <PackageCheck size={17} aria-hidden="true" />
                  : <WalletCards size={17} aria-hidden="true" />,
          },
          secondary: [{
            label: t("refreshServices"),
            onClick: () => void dispatch("refreshBridgeServices"),
            disabled: actionBusy,
            icon: <RefreshCw size={16} aria-hidden="true" />,
          }],
        }}
        drawerToggleLabel={t("details")}
        drawer={{
          title: t("bridgeDetails"),
          children: (
            <div className="nxb-drawer">
              <div className="nxb-drawer-tabs" role="tablist" aria-label={t("bridgeDetails")}>
                {[
                  { mode: "handoff" as const, label: t("handoffFactsTitle") },
                  { mode: "evidence" as const, label: t("evidenceTitle") },
                  { mode: "resources" as const, label: t("resourcesAria") },
                ].map((item) => (
                  <button key={item.mode} type="button" role="tab" aria-selected={drawerMode === item.mode} className={drawerMode === item.mode ? "is-active" : undefined} onClick={() => setDrawerMode(item.mode)}>
                    {item.label}
                  </button>
                ))}
              </div>
              <div className="nxb-drawer-panel" data-mode={drawerMode}>{drawerPanels[drawerMode]}</div>
            </div>
          ),
        }}
      />
    </div>
  );
}
