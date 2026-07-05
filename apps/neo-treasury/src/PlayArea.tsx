/**
 * PlayArea.tsx - Neo Treasury (v2 scene-driven rebuild)
 *
 * DeFi/tool identity (deep-blue + gold, clean/trustworthy). The dashboard IS the
 * scene: a focused payout route plus live NEO/GAS balances for the watched
 * foundation wallets. Watchlist details, policy, and payout editing are tucked
 * into a drawer so the primary action stays prominent.
 */
import { useEffect, useState } from "react";
import type { PlayAreaProps } from "@shared/react/defineMiniApp";
import { useStateBindings } from "@shared/react/hooks/useStateBindings";
import { getLaunchParam } from "@shared/utils/launch-params";
import { DA_HONGFEI_ADDRESSES, ERIK_ZHANG_ADDRESSES } from "./utils/treasury";
import {
  buildTreasuryDisbursementPreview,
  type TreasuryAsset,
  type TreasuryDisbursementPreview,
} from "./utils/treasuryOperations";
import { CoinArt } from "@shared/art";
import { OpenUiProvider, OpenUiSegmented, OpenUiTextField, PlayStage } from "@shared/components-react/v2";
import { CircleAlert, FileSignature, Send, ShieldCheck, WalletCards } from "lucide-react";
import "./PlayArea.scss";

interface TreasuryData {
  totalUsd: number | null;
  totalNeo: number;
  totalGas: number;
  lastUpdated: number | string;
  prices: Record<string, unknown> | null;
  failedCount?: number;
  categories: Array<{
    name: string;
    failedCount?: number;
    totalUsd?: number | null;
    wallets?: Array<{ address?: string; label?: string; neo?: number; gas?: number; failed?: boolean }>;
    [key: string]: unknown;
  }>;
}

function formatNumber(value: unknown, maximumFractionDigits = 2) {
  const n = Number(value);
  if (!Number.isFinite(n)) return "0";
  return n.toLocaleString(undefined, { maximumFractionDigits });
}
function formatLastUpdated(value: number | string | undefined) {
  if (!value) return "";
  if (typeof value === "string") return value;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? "" : d.toLocaleString();
}
function compactAddress(address: string) {
  return address.length <= 16 ? address : `${address.slice(0, 7)}…${address.slice(-6)}`;
}
function compactTxid(txid: string) {
  return txid.length > 18 ? `${txid.slice(0, 10)}…${txid.slice(-8)}` : txid;
}
function formatInlineError(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}

const AMOUNT_PRESETS: Record<TreasuryAsset, string[]> = {
  GAS: ["0.1", "1", "5"],
  NEO: ["1", "5", "10"],
};
const TREASURY_VAULT_ART = "treasury-vault-desk.webp";
type DrawerMode = "payout" | "watchlist" | "policy";

function normalizeAmountForAsset(value: string, asset: TreasuryAsset) {
  if (asset === "NEO") {
    const whole = value.split(/[.,]/)[0] ?? "";
    return whole.replace(/[^\d]/g, "").replace(/^0+(?=\d)/, "");
  }
  return value.replace(/[^\d.]/g, "").replace(/(\..*)\./g, "$1");
}

export default function PlayArea({ t, state, dispatch, launchContext, setStatus }: PlayAreaProps) {
  const { bool, str, val } = useStateBindings(state);
  const data = val<TreasuryData>("data");
  const loading = bool("loading");
  const stale = bool("stale");
  const error = str("error");
  const address = str("address");
  const disbursementSubmitting = bool("disbursementSubmitting");
  const disbursementError = str("disbursementError");
  const lastTxid = str("lastTxid");
  const totalUsdDisplay = str("totalUsdDisplay");
  const totalNeoDisplay = str("totalNeoDisplay");
  const totalGasDisplay = str("totalGasDisplay");

  const hasLiveData = Boolean(data);
  const isStale = hasLiveData && stale;
  const failedCount = Number(data?.failedCount ?? 0);
  const priceFeedDown = hasLiveData && data?.totalUsd == null;
  const hasUsdValue = !priceFeedDown && Boolean(totalUsdDisplay.trim());
  const watchedAddressCount = DA_HONGFEI_ADDRESSES.length + ERIK_ZHANG_ADDRESSES.length;
  const lastUpdated = formatLastUpdated(data?.lastUpdated);
  const signalLabel = isStale ? t("treasuryStale") : hasLiveData ? t("treasuryLiveSynced") : loading ? t("treasuryLiveLoading") : t("treasuryLivePending");
  const sceneGaugeLabel = hasUsdValue ? t("sidebarTotalUsd") : t("treasuryLiveStatus");
  const sceneGaugeValue = hasUsdValue ? totalUsdDisplay : `${t("tokenNeo")} / ${t("tokenGas")}`;
  const networkLabel = launchContext.network === "testnet" ? t("networkTestnet") : t("networkMainnet");
  const launchParams = launchContext.params;

  const [asset, setAsset] = useState<TreasuryAsset>("GAS");
  const [amount, setAmount] = useState("");
  const [recipient, setRecipient] = useState("");
  const [memo, setMemo] = useState("");
  const [drawerMode, setDrawerMode] = useState<DrawerMode>("payout");
  const [initialLoadTimedOut, setInitialLoadTimedOut] = useState(false);

  useEffect(() => {
    const launchParamContext = { params: launchParams };
    const launchedAsset = getLaunchParam(launchParamContext, ["asset", "token"], "GAS").toUpperCase();
    const nextAsset = launchedAsset === "NEO" ? "NEO" : "GAS";
    setAsset(nextAsset);
    setAmount(normalizeAmountForAsset(getLaunchParam(launchParamContext, ["amount", "value", "total"], ""), nextAsset));
    setRecipient(getLaunchParam(launchParamContext, ["recipient", "to", "address"], ""));
    setMemo(getLaunchParam(launchParamContext, ["memo", "note", "purpose"], ""));
  }, [launchParams]);

  useEffect(() => {
    if (hasLiveData || !loading) {
      setInitialLoadTimedOut(false);
      return undefined;
    }
    const timer = window.setTimeout(() => setInitialLoadTimedOut(true), 1200);
    return () => window.clearTimeout(timer);
  }, [hasLiveData, loading]);

  const selectAsset = (nextAsset: TreasuryAsset) => {
    setAsset(nextAsset);
    setAmount((value) => normalizeAmountForAsset(value, nextAsset));
  };
  const selectAssetSafe = (value: string) => {
    if (value === "GAS" || value === "NEO") {
      selectAsset(value);
    }
  };
  const setDrawerModeSafe = (value: string) => {
    if (value === "payout" || value === "watchlist" || value === "policy") {
      setDrawerMode(value);
    }
  };

  const hasDraftFields = Boolean(amount.trim() && recipient.trim());
  const draftReview: { preview: TreasuryDisbursementPreview | null; error: string } = (() => {
    if (!hasDraftFields) return { preview: null, error: "" };
    try {
      return { preview: buildTreasuryDisbursementPreview({ asset, amount, recipient, memo }, address || undefined), error: "" };
    } catch (e) {
      return { preview: null, error: formatInlineError(e) };
    }
  })();
  const submitDisabled = disbursementSubmitting || !amount.trim() || !recipient.trim();
  const submitBlocked = submitDisabled || Boolean(draftReview.error);
  const submitLabel = address ? t("submitDisbursement") : t("connectAndSignDisbursement");
  const showConnectOnly = !address && !hasDraftFields;
  const draftReady = Boolean(draftReview.preview);
  const hasAmount = Boolean(amount.trim());
  const hasRecipient = Boolean(recipient.trim());
  const ticketState = disbursementSubmitting
    ? "signing"
    : draftReview.error
      ? "error"
      : draftReady
        ? "ready"
        : hasDraftFields
          ? "draft"
          : "idle";
  const activeAssetIcon = asset.toLowerCase() as "gas" | "neo";
  const payoutStatus = draftReview.error
    ? t("treasuryFlowError")
    : disbursementSubmitting
      ? t("treasuryFlowSigning")
      : draftReady
        ? t("treasuryFlowReady")
        : hasDraftFields
          ? t("treasuryFlowDraft")
          : t("walletRequired");
  const draftAmountLabel = hasAmount ? `${amount} ${asset}` : t("amount");
  const draftRecipientLabel = draftReview.preview ? compactTxid(draftReview.preview.recipientHash) : hasRecipient ? compactAddress(recipient) : t("recipient");
  const balanceStatusNotice = error
    ? error
    : initialLoadTimedOut
      ? `${t("treasuryLoadTimeout")} ${t("treasuryLoadTimeoutHint")}`
      : !hasLiveData && loading
        ? t("treasuryLiveLoading")
        : "";
  const drawerModes = [
    { mode: "payout" as const, label: t("disbursementTitle") },
    { mode: "watchlist" as const, label: t("treasuryWatchlist"), count: watchedAddressCount },
    { mode: "policy" as const, label: t("policyTitle") },
  ];

  const handleSubmit = async () => {
    if (showConnectOnly || !address) {
      await dispatch("connectWallet");
      return;
    }
    if (submitBlocked) {
      if (draftReview.error) setStatus?.(draftReview.error, "error");
      return;
    }
    await dispatch("submitDisbursement", { asset, amount: normalizeAmountForAsset(amount, asset).trim(), recipient: recipient.trim(), memo: memo.trim() });
  };

  const scene = (
    <div className="treasury-workspace" data-state={ticketState}>
      <section className="treasury-ticket" data-state={ticketState} aria-label={t("intentTitle")}>
        <header className="treasury-ticket__head">
          <span className="treasury-ticket__icon" aria-hidden="true">
            <FileSignature size={18} strokeWidth={2.25} />
          </span>
          <div>
            <span>{t("intentTitle")}</span>
            <strong>{draftReady ? t("intentReady") : t("intentWaiting")}</strong>
          </div>
          <em>{payoutStatus}</em>
        </header>

        <div className="treasury-ticket__flow" aria-label={t("treasuryFlowChecks")}>
          <div className="treasury-ticket__node" data-ready={address ? "true" : undefined}>
            <WalletCards size={17} strokeWidth={2.25} aria-hidden="true" />
            <span>{t("treasuryFlowSource")}</span>
            <strong>{address ? compactAddress(address) : t("walletRequired")}</strong>
          </div>
          <div className="treasury-ticket__rail" aria-hidden="true">
            <span />
            <CoinArt size={24} variant={activeAssetIcon} className={disbursementSubmitting ? "treasury-ticket__rail-coin is-moving" : "treasury-ticket__rail-coin"} decorative />
            <span />
          </div>
          <div className="treasury-ticket__node" data-ready={draftReview.preview ? "true" : undefined}>
            <Send size={17} strokeWidth={2.25} aria-hidden="true" />
            <span>{t("treasuryFlowRecipient")}</span>
            <strong>{draftReview.preview ? compactTxid(draftReview.preview.recipientHash) : t("treasuryFlowDraft")}</strong>
          </div>
        </div>

        <div className="treasury-ticket__summary-grid" aria-label={t("intentTitle")}>
          <div
            className="treasury-ticket__summary-card"
            data-ready={hasAmount ? "true" : undefined}
          >
            <span><CoinArt size={18} variant={activeAssetIcon} decorative /> {t("amount")}</span>
            <strong>{draftAmountLabel}</strong>
            <small>{asset === "NEO" ? t("assetNeoMeta") : t("assetGasMeta")}</small>
          </div>
          <div
            className="treasury-ticket__summary-card"
            data-ready={hasRecipient && !draftReview.error ? "true" : undefined}
          >
            <span><Send size={15} strokeWidth={2.25} aria-hidden="true" /> {t("recipient")}</span>
            <strong>{draftRecipientLabel}</strong>
            <small>{draftReview.preview ? t("intentRecipientHash") : t("recipientCaption")}</small>
          </div>
        </div>

        <div className="treasury-ticket__route" aria-label={t("treasuryFlowChecks")}>
          <span data-ready={hasAmount ? "true" : undefined}><ShieldCheck size={14} strokeWidth={2.25} /> {asset}</span>
          <span data-ready={draftReview.preview ? "true" : undefined}><Send size={14} strokeWidth={2.25} /> {draftReview.preview ? compactTxid(draftReview.preview.recipientHash) : t("treasuryFlowRecipient")}</span>
          <span data-ready={address ? "true" : undefined}><WalletCards size={14} strokeWidth={2.25} /> {address ? t("walletConnected") : t("walletRequired")}</span>
        </div>

        {(draftReview.error || disbursementError) && (
          <p className="treasury-ticket__error" role="alert">
            <CircleAlert size={15} strokeWidth={2.25} aria-hidden="true" />
            {draftReview.error || disbursementError}
          </p>
        )}
        {lastTxid && <p className="treasury-ticket__tx">{t("lastTx")}: <code>{compactTxid(lastTxid)}</code></p>}
      </section>

      <aside className="treasury-scene" data-state={isStale ? "stale" : hasLiveData ? "live" : "loading"} aria-label={t("treasuryLiveStatus")}>
        <div className="treasury-scene__pulse" data-stale={isStale ? "true" : undefined}>
          <span className="treasury-scene__pulse-dot" />
          <span className="treasury-scene__pulse-label">{signalLabel}</span>
        </div>
        <div className="treasury-scene__art" aria-hidden="true">
          <img src={TREASURY_VAULT_ART} alt="" loading="eager" decoding="async" />
        </div>
        <div className="treasury-scene__gauge">
          <CoinArt size={34} variant="gas" className="mx2-float" decorative />
          <div>
            <span>{sceneGaugeLabel}</span>
            <strong className="treasury-scene__gauge-usd">{sceneGaugeValue}</strong>
          </div>
        </div>
        <div className="treasury-scene__tokens">
          <span className="treasury-scene__token"><CoinArt size={18} variant="neo" decorative /> {t("tokenNeo")} <strong>{totalNeoDisplay}</strong></span>
          <span className="treasury-scene__token"><CoinArt size={18} variant="gas" decorative /> {t("tokenGas")} <strong>{totalGasDisplay}</strong></span>
        </div>
        {(failedCount > 0 || priceFeedDown || balanceStatusNotice) && (
          <p className="treasury-scene__notice" role="status">
            {balanceStatusNotice}
            {balanceStatusNotice && (failedCount > 0 || priceFeedDown) && " · "}
            {failedCount > 0 && `${failedCount} ${t("treasuryWalletsUnreachable").toLowerCase()}`}
            {failedCount > 0 && priceFeedDown && " · "}
            {priceFeedDown && t("treasuryPriceFeedUnavailable")}
          </p>
        )}
      </aside>
    </div>
  );

  const payoutPanel = (
    <div className="treasury-drawer__payout">
      <div className="treasury-ticket__amount" data-ready={hasAmount ? "true" : undefined}>
        <div className="treasury-ticket__amount-head">
          <span>{t("amount")}</span>
          <OpenUiSegmented
            className="treasury-ticket__asset"
            segmentedClassName="treasury-ticket__asset-group"
            label={t("asset")}
            value={asset}
            onChange={selectAssetSafe}
            disabled={disbursementSubmitting}
            options={(["GAS", "NEO"] as const).map((a) => ({
              value: a,
              label: (
                <span className="treasury-asset-option">
                  <CoinArt size={18} variant={a.toLowerCase() as "gas" | "neo"} decorative />
                  {a}
                </span>
              ),
            }))}
          />
        </div>
        <div className="treasury-ticket__amount-input">
          <CoinArt size={34} variant={activeAssetIcon} decorative />
          <OpenUiTextField
            className="treasury-amount-field"
            inputClassName="treasury-input-control treasury-input-control--amount"
            label={t("amount")}
            value={amount}
            onChange={(e) => setAmount(normalizeAmountForAsset(e.target.value, asset))}
            placeholder={asset === "NEO" ? "1" : "0.00"}
            inputMode={asset === "NEO" ? "numeric" : "decimal"}
            disabled={disbursementSubmitting}
          />
        </div>
        <OpenUiSegmented
          className="treasury-ticket__presets"
          segmentedClassName="treasury-ticket__presets-group"
          label={t("amountPresets")}
          value={AMOUNT_PRESETS[asset].includes(amount) ? amount : ""}
          onChange={(value) => setAmount(normalizeAmountForAsset(value, asset))}
          disabled={disbursementSubmitting}
          options={AMOUNT_PRESETS[asset].map((preset) => ({
            value: preset,
            label: <span className="treasury-preset-option">{preset}</span>,
          }))}
        />
      </div>

      <div className="treasury-ticket__recipient" data-ready={hasRecipient && !draftReview.error ? "true" : undefined}>
        <span><Send size={15} strokeWidth={2.25} aria-hidden="true" /> {t("recipient")}</span>
        <OpenUiTextField
          className="treasury-recipient-field"
          inputClassName="treasury-input-control treasury-input-control--recipient"
          label={t("recipient")}
          value={recipient}
          onChange={(e) => setRecipient(e.target.value)}
          placeholder="N..."
          spellCheck={false}
          disabled={disbursementSubmitting}
          mono
        />
        <small>{draftReview.preview ? compactTxid(draftReview.preview.recipientHash) : t("recipientCaption")}</small>
      </div>

      <details className="treasury-ticket__memo">
        <summary>{t("memoDetails")}</summary>
        <OpenUiTextField
          className="treasury-memo-field"
          inputClassName="treasury-input-control treasury-input-control--memo"
          label={t("memo")}
          value={memo}
          onChange={(e) => setMemo(e.target.value)}
          placeholder={t("memo")}
          disabled={disbursementSubmitting}
        />
      </details>
    </div>
  );

  const watchlistPanel = (
    <>
      {!data?.categories?.length && (
        <div className="treasury-drawer__group treasury-drawer__group--empty">
          <h4>{t("treasuryWatchlist")}</h4>
          <p>{t("treasuryLoadTimeoutHint")}</p>
          <div className="treasury-drawer__group-stats">
            <span>{t("treasuryWatchlistNetwork")}: <strong>{networkLabel}</strong></span>
            <span>{t("treasuryFlowSource")}: <strong>{watchedAddressCount}</strong></span>
          </div>
        </div>
      )}
      {data?.categories?.map((cat) => (
        <div key={cat.name} className="treasury-drawer__group">
          <h4>{cat.name}</h4>
          <div className="treasury-drawer__group-stats">
            <span>{t("tokenNeo")}: <strong>{formatNumber(cat.wallets?.reduce((s, w) => s + (w.neo ?? 0), 0))}</strong></span>
            <span>{t("tokenGas")}: <strong>{formatNumber(cat.wallets?.reduce((s, w) => s + (w.gas ?? 0), 0))}</strong></span>
          </div>
          {cat.wallets?.slice(0, 5).map((w, i) => (
            <div key={i} className="treasury-drawer__wallet">
              <code>{compactAddress(w.address ?? "—")}</code>
              <span>{w.neo ?? "—"} / {w.gas ?? "—"}</span>
              {w.failed && <em>— / —</em>}
            </div>
          ))}
        </div>
      ))}
    </>
  );

  const policyPanel = (
    <div className="treasury-drawer__policy">
      <h4>{t("policyTitle")}</h4>
      <p>{t("policyCopy")}</p>
      <p className="treasury-drawer__source">{t("treasuryReadOnlyRoute")} · {t("treasuryWatchlistNetwork")}: {networkLabel}</p>
      {lastUpdated && <p className="treasury-drawer__source">{t("lastUpdated")}: {lastUpdated}</p>}
    </div>
  );

  return (
    <div className="treasury-play-area mx2 mx2-cat-defi">
      <OpenUiProvider>
        <PlayStage
          category="defi"
          stage={{
            eyebrow: address ? t("operationsEyebrow") : t("walletRequired"),
            title: t("treasuryFlowTitle"),
            subtitle: t("treasuryFlowSubtitle"),
            badges: (
              <span className="mx2-badge" data-tone="accent">
                <span className="mx2-badge__dot" /> {networkLabel}
              </span>
            ),
          }}
          scene={scene}
          actions={{
            primary: {
              label: showConnectOnly ? t("connectWallet") : submitLabel,
              onClick: () => void handleSubmit(),
              disabled: submitBlocked && !showConnectOnly,
              loading: disbursementSubmitting,
            },
            secondary: [
              { label: t("refresh"), onClick: () => void dispatch("refresh"), hint: t("refreshData") },
            ],
          }}
          drawerToggleLabel={t("treasuryFlowTitle")}
          drawer={{
            title: t("treasuryFlowTitle"),
            children: (
              <div className="treasury-drawer">
                <OpenUiSegmented
                  className="treasury-drawer-tabs"
                  segmentedClassName="treasury-drawer-tabs__group"
                  label={t("treasuryFlowTitle")}
                  value={drawerMode}
                  onChange={setDrawerModeSafe}
                  options={drawerModes.map((item) => ({
                    value: item.mode,
                    label: (
                      <span className="treasury-drawer-tab">
                        <span>{item.label}</span>
                        {"count" in item && <em>{item.count}</em>}
                      </span>
                    ),
                  }))}
                />
                <div className="treasury-drawer__panel" data-mode={drawerMode}>
                  {drawerMode === "payout" && payoutPanel}
                  {drawerMode === "watchlist" && watchlistPanel}
                  {drawerMode === "policy" && policyPanel}
                </div>
              </div>
            ),
          }}
        />
      </OpenUiProvider>
    </div>
  );
}
