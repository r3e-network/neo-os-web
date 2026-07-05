/**
 * PlayArea.tsx - Explorer
 *
 * Explorer is a read-only chain scanner: the main surface shows live network
 * telemetry, a search radar, and the current lookup result. Recent activity and
 * raw evidence stay in the drawer so the first screen feels like a tool, not a
 * plain query form.
 */
import {
  Activity,
  Blocks,
  CheckCircle2,
  CircleDot,
  DatabaseZap,
  History,
  RadioTower,
  Search,
  ShieldCheck,
} from "lucide-react";
import { useStateBindings } from "@shared/react/hooks/useStateBindings";
import type { Observable } from "@shared/react/context";
import { OpenUiProvider, OpenUiSegmented, OpenUiTextField, PlayStage } from "@shared/components-react/v2";
import "./PlayArea.scss";

interface PlayAreaProps {
  t: (key: string, p?: Record<string, string | number>) => string;
  state: Record<string, Observable>;
  dispatch: (name: string, ...args: unknown[]) => Promise<void>;
}

interface TxItem {
  hash: string;
  vmState?: string;
  blockIndex?: number;
  blockTime?: string;
  sender?: string;
  [key: string]: unknown;
}

interface SearchResult {
  type?: string;
  hash?: string;
  label?: string;
  address?: string;
  name?: string;
  blockIndex?: number;
  vmState?: string;
  [key: string]: unknown;
}

const SEARCH_TYPES = ["explorerTipTx", "explorerTipAddress", "explorerTipContract", "explorerTipBlock"];

function compactHash(value: unknown, empty = "-") {
  const text = String(value ?? "").trim();
  if (!text) return empty;
  return text.length > 18 ? `${text.slice(0, 10)}...${text.slice(-6)}` : text;
}

function resultTitle(result: SearchResult | null, t: PlayAreaProps["t"]) {
  if (!result) return t("searchResultNone");
  if (result.type === "none") return t("searchUnknownTitle");
  return String(result.label ?? result.name ?? result.hash ?? result.address ?? t("explorerResultReady"));
}

function resultMeta(result: SearchResult | null, t: PlayAreaProps["t"]) {
  if (!result) return t("explorerSearchHint");
  if (result.type === "none") return t("searchUnknownDesc");
  const type = String(result.type ?? t("searchResult"));
  const block = result.blockIndex != null ? ` #${result.blockIndex}` : "";
  return `${type}${block}`;
}

function resultTone(result: SearchResult | null) {
  if (!result) return "idle";
  return result.type === "none" ? "empty" : "ready";
}

export default function PlayArea({ t, state, dispatch }: PlayAreaProps) {
  const { str, bool, num, val } = useStateBindings(state);

  const mainnetHeight = str("mainnetHeight");
  const mainnetTxCount = str("mainnetTxCount");
  const testnetHeight = str("testnetHeight");
  const testnetTxCount = str("testnetTxCount");
  const selectedNetwork = str("selectedNetwork", "mainnet") as "mainnet" | "testnet";
  const recentTxCount = num("recentTxCount");
  const isLoading = bool("isLoading");
  const isSearching = bool("isSearching");
  const searchQuery = str("searchQuery");
  const searchResult = val<SearchResult | null>("searchResult", null);
  const recentTxs = (val("recentTxs") ?? []) as TxItem[];

  const height = selectedNetwork === "mainnet" ? mainnetHeight : testnetHeight;
  const txCount = selectedNetwork === "mainnet" ? mainnetTxCount : testnetTxCount;
  const query = searchQuery.trim();
  const sceneState = isSearching ? "searching" : isLoading ? "syncing" : searchResult ? "result" : "live";
  const networkLabel = selectedNetwork === "mainnet" ? t("mainnet") : t("testnet");

  const selectNetwork = (network: "mainnet" | "testnet") => {
    state.selectedNetwork?.set(network);
  };
  const setNetworkSafe = (network: string) => {
    if (network === "mainnet" || network === "testnet") selectNetwork(network);
  };

  const runSearch = () => {
    if (!query || isSearching) return;
    void dispatch("search");
  };

  const scene = (
    <div className="explorer-scene" data-state={sceneState}>
      <div className="explorer-network-orbit" aria-hidden="true">
        <span />
        <span />
        <span />
      </div>

      <section className="explorer-network-card explorer-network-card--mainnet" data-active={selectedNetwork === "mainnet" ? "true" : undefined}>
        <span><RadioTower size={15} />{t("mainnet")}</span>
        <strong>{mainnetHeight || "-"}</strong>
        <em>{t("blockHeight")}</em>
      </section>

      <section className="explorer-network-card explorer-network-card--testnet" data-active={selectedNetwork === "testnet" ? "true" : undefined}>
        <span><Activity size={15} />{t("testnet")}</span>
        <strong>{testnetHeight || "-"}</strong>
        <em>{t("blockHeight")}</em>
      </section>

      <section className="explorer-scanner" aria-label={t("explorerSearchDeck")}>
        <div className="explorer-scanner__lens" aria-hidden="true">
          <Search size={34} />
          <span className="explorer-scanner__sweep" />
        </div>
        <span className="explorer-scanner__eyebrow">{networkLabel} / {t("explorerSignalReady")}</span>
        <strong>{query || t("explorerScannerTargetEmpty")}</strong>
        <p>{resultMeta(searchResult, t)}</p>
      </section>

      <div className="explorer-result-card" data-tone={resultTone(searchResult)}>
        <span className="explorer-result-card__icon">
          {searchResult ? <CheckCircle2 size={17} /> : <CircleDot size={17} />}
        </span>
        <span>
          <em>{t("searchResult")}</em>
          <strong>{resultTitle(searchResult, t)}</strong>
        </span>
      </div>

      <div className="explorer-pulse-strip" aria-label={t("explorerWorkflowTitle")}>
        <span><Blocks size={14} />{height || "-"}</span>
        <span><DatabaseZap size={14} />{txCount || "-"}</span>
        <span><History size={14} />{recentTxCount}</span>
      </div>
    </div>
  );

  const controls = (
    <div className="explorer-controls">
      <div className="explorer-controls__header">
        <span>{t("explorerSearchDeck")}</span>
        <strong>{t("explorerNoSignature")}</strong>
      </div>

      <OpenUiSegmented
        className="explorer-controls__net"
        segmentedClassName="explorer-controls__net-group"
        label={t("sidebarNetwork")}
        value={selectedNetwork}
        onChange={setNetworkSafe}
        options={(["mainnet", "testnet"] as const).map((network) => ({
          value: network,
          label: <span className="explorer-net-btn">{network === "mainnet" ? t("mainnet") : t("testnet")}</span>,
        }))}
      />

      <div className="explorer-search-shell">
        <Search size={18} aria-hidden="true" />
        <OpenUiTextField
          className="explorer-search-box"
          inputClassName="explorer-search-box__control"
          label={t("explorerSearchDeck")}
          value={searchQuery}
          onChange={(e) => state.searchQuery?.set(e.target.value)}
          placeholder={t("searchPlaceholder")}
          onKeyDown={(e) => {
            if (e.key === "Enter") runSearch();
          }}
          disabled={isSearching}
        />
      </div>

      <div className="explorer-type-strip" aria-label={t("explorerSearchableTypes")}>
        {SEARCH_TYPES.map((key) => (
          <span key={key}>{t(key)}</span>
        ))}
      </div>
    </div>
  );

  return (
    <OpenUiProvider>
      <div className="explorer-play-area mx2 mx2-cat-tool">
        <PlayStage
          category="tool"
          stage={{
            eyebrow: t("explorerReadOnly"),
            title: t("explorerLiveScanner"),
            subtitle: t("explorerSearchDeckCopy"),
            badges: (
              <>
                <span className="mx2-badge" data-tone="accent"><span className="mx2-badge__dot" /> {networkLabel}</span>
                <span className="mx2-badge">{recentTxCount} {t("sidebarRecentTxs")}</span>
              </>
            ),
          }}
          scene={<>{scene}{controls}</>}
          score={[
            { label: t("blockHeight"), value: height || "-", accent: true },
            { label: t("transactions"), value: txCount || "-" },
            { label: t("searchResult"), value: searchResult ? t("explorerResultReady") : "-" },
          ]}
          actions={{
            primary: {
              label: isSearching ? t("searching") : t("search"),
              onClick: runSearch,
              loading: isSearching || isLoading,
              disabled: !query || isSearching,
              icon: <Search size={17} />,
            },
          }}
          drawerToggleLabel={t("recentTransactions")}
          drawer={{
            title: t("recentTransactions"),
            children: (
              <>
                <section className="explorer-drawer-section">
                  <h4>{t("explorerSafetyTitle")}</h4>
                  <p className="explorer-safe-note"><ShieldCheck size={15} />{t("explorerSafetyDesc")}</p>
                </section>

                <section className="explorer-drawer-section">
                  <h4>{t("searchResult")}</h4>
                  <div className="explorer-drawer-result" data-tone={resultTone(searchResult)}>
                    <strong>{resultTitle(searchResult, t)}</strong>
                    <span>{resultMeta(searchResult, t)}</span>
                    {searchResult?.hash && <code>{String(searchResult.hash)}</code>}
                  </div>
                </section>

                <section className="explorer-drawer-section">
                  <h4>{t("sidebarRecentTxs")}</h4>
                  {recentTxs.length > 0 ? (
                    <ul className="explorer-tx-list">
                      {recentTxs.slice(0, 10).map((tx) => (
                        <li key={tx.hash} className="explorer-tx-list__item">
                          <span>
                            <strong>{compactHash(tx.hash)}</strong>
                            <em>{tx.vmState || t("vmUnknown")} · #{tx.blockIndex ?? "-"}</em>
                          </span>
                          <button type="button" className="mx2-btn mx2-btn--ghost" onClick={() => void dispatch("viewTx", tx.hash)}>
                            {t("viewFullRecord")}
                          </button>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="explorer-empty">{t("explorerRecentEmptyDesc")}</p>
                  )}
                </section>
              </>
            ),
          }}
        />
      </div>
    </OpenUiProvider>
  );
}
