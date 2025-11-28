import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { normaliseUrl } from "./api";
import { useLocalStorage } from "./useLocalStorage";
import { useSessionStorage } from "./useSessionStorage";
import { MetricsConfig } from "./metrics";
import { AccountsSection, AdminPanel, AuthPanel, BusConsole, JamPanel, NeoPanel, Notifications, SettingsForm, SystemOverview, WalletGate } from "./components";
import { useAccountsData, useSystemInfo } from "./hooks";
import { formatAmount, formatDuration, formatSnippet, formatTimestamp } from "./utils";
import type { Notification } from "./components/Notifications";

type WalletSession = { address: string; label?: string; signature?: string };

export function App() {
  const [baseUrl, setBaseUrl] = useLocalStorage("sl-ui.baseUrl", "http://localhost:8080");
  const [token, setToken] = useLocalStorage("sl-ui.token", "dev-token");
  const [refreshToken, setRefreshToken] = useSessionStorage("sl-ui.refreshToken", "");
  const [tenant, setTenant] = useLocalStorage("sl-ui.tenant", "");
  const [slowMs, setSlowMs] = useLocalStorage("sl-ui.slowMs", "");
  const [surface, setSurface] = useLocalStorage("sl-ui.surface", "");
  const [layer, setLayer] = useLocalStorage("sl-ui.layer", "");
  const [wallet, setWallet] = useState<WalletSession>(() => {
    try {
      const raw = window.localStorage.getItem("sl-ui.wallet");
      return raw ? (JSON.parse(raw) as WalletSession) : { address: "", label: "", signature: "" };
    } catch {
      return { address: "", label: "", signature: "" };
    }
  });
  useEffect(() => {
    window.localStorage.setItem("sl-ui.wallet", JSON.stringify(wallet));
  }, [wallet]);
  const config = useMemo(
    () => ({
      baseUrl: normaliseUrl(baseUrl),
      token: token.trim(),
      tenant: tenant.trim() || undefined,
      wallet,
      refreshToken: refreshToken.trim(),
    }),
    [baseUrl, token, tenant, wallet, refreshToken],
  );

  const [accessToken, setAccessToken] = useState(config.token);
  const canQuery = config.baseUrl.length > 0 && accessToken.length > 0;

  const [promBase, setPromBase] = useLocalStorage("sl-ui.prometheus", "http://localhost:9090");
  const promConfig: MetricsConfig = useMemo(
    () => ({
      baseUrl: config.baseUrl,
      token: accessToken,
      prometheusBaseUrl: normaliseUrl(promBase),
    }),
    [config.baseUrl, accessToken, promBase],
  );
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const qsBase = params.get("api") || params.get("base") || params.get("baseUrl") || params.get("endpoint");
    const qsTenant = params.get("tenant");
    const qsToken = params.get("token") || params.get("auth") || params.get("bearer");
    const qsProm = params.get("prom") || params.get("prometheus");
    const qsRefresh = params.get("refresh_token") || params.get("refresh");
    const qsSlow = params.get("slow_ms");
    const qsSurface = params.get("surface");
    if (qsBase) setBaseUrl(normaliseUrl(qsBase));
    if (qsTenant) setTenant(qsTenant);
    if (qsToken) setToken(qsToken);
    if (qsRefresh) setRefreshToken(qsRefresh);
    if (qsProm) setPromBase(normaliseUrl(qsProm));
    if (qsSlow) setSlowMs(qsSlow);
    if (qsSurface) setSurface(qsSurface);
  }, [setBaseUrl, setTenant, setToken, setPromBase, setSurface, setRefreshToken, setSlowMs]);

  const {
    wallets,
    vrf,
    ccip,
    datafeeds,
    pricefeeds,
    datalink,
    datastreams,
    dta,
    gasbank,
    conf,
    cre,
    automation,
    secrets,
    functionsState,
    oracle,
    random,
    oracleBanner,
    retryingOracle,
    oracleFilters,
    oracleCursors,
    oracleFailedCursor,
    loadingOraclePage,
    loadingOracleFailedPage,
    setOracleFilters,
    resetAccounts,
    loadWallets,
    loadVRF,
    loadCCIP,
    loadDatafeeds,
    loadPricefeeds,
    loadDatalink,
    loadDatastreams,
    loadDTA,
    loadGasbank,
    loadConf,
    loadCRE,
    loadAutomation,
    loadSecrets,
    loadFunctions,
    loadOracle,
    loadRandom,
    loadMoreOracle,
    loadMoreFailedOracle,
    retryOracle,
    copyCursor,
    setAggregation,
    createChannel,
    createDelivery,
  } = useAccountsData(config);
  const { state, systemVersion, load } = useSystemInfo(config, promConfig, canQuery);

  useEffect(() => {
    resetAccounts();
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [config.baseUrl, accessToken, config.tenant]);

  // Auto-refresh system info periodically when credentials are set.
  useEffect(() => {
    if (!canQuery) return;
    const id = setInterval(() => {
      void load();
    }, 30_000);
    return () => clearInterval(id);
  }, [canQuery, load]);

  // Attempt refresh when no token but refresh token is present.
  useEffect(() => {
    if (accessToken || !config.refreshToken) {
      if (config.token && config.token !== accessToken) {
        setAccessToken(config.token);
      }
      return;
    }
    void (async () => {
      try {
        const resp = await fetch(`${config.baseUrl}/auth/refresh`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ refresh_token: config.refreshToken }),
        });
        if (!resp.ok) return;
        const json = await resp.json();
        const newToken = json.access_token || json.token;
        if (newToken) {
          setToken(newToken);
          setAccessToken(newToken);
        }
      } catch {
        // ignore refresh failures
      }
    })();
  }, [accessToken, config.baseUrl, config.refreshToken, config.token, setToken]);

  function onSubmit(event: FormEvent) {
    event.preventDefault();
    resetAccounts();
    void load();
  }

  const handleClearSession = useCallback(() => {
    setToken("");
    setRefreshToken("");
    setTenant("");
    setBaseUrl("http://localhost:8080");
    setPromBase("http://localhost:9090");
    setSlowMs("");
    setSurface("");
    resetAccounts();
  }, [resetAccounts, setBaseUrl, setPromBase, setSlowMs, setSurface, setTenant, setToken]);


  const docsLinks = [
    { label: "Data Feeds Quickstart", href: "https://github.com/R3E-Network/service_layer/blob/master/docs/examples/datafeeds.md" },
    { label: "DataLink Quickstart", href: "https://github.com/R3E-Network/service_layer/blob/master/docs/examples/datalink.md" },
    { label: "Engine Bus Quickstart", href: "https://github.com/R3E-Network/service_layer/blob/master/docs/examples/bus.md" },
    { label: "JAM Quickstart", href: "https://github.com/R3E-Network/service_layer/blob/master/docs/examples/jam.md" },
    { label: "Dashboard Smoke Checklist", href: "https://github.com/R3E-Network/service_layer/blob/master/docs/dashboard-smoke.md" },
    { label: "Tenant Quickstart", href: "https://github.com/R3E-Network/service_layer/blob/master/docs/tenant-quickstart.md" },
  ];

  const [notifications, setNotifications] = useState<Notification[]>([]);
  const notify = useCallback((type: "success" | "error", message: string) => {
    const id = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    setNotifications((prev) => [...prev, { id, type, message }]);
    setTimeout(() => {
      setNotifications((prev) => prev.filter((n) => n.id != id));
    }, 4000);
  }, []);
  const dismissNotification = useCallback((id: string) => {
    setNotifications((prev) => prev.filter((n) => n.id !== id));
  }, []);

  const unhealthyModules = useMemo(() => {
    if (state.status !== "ready" || !state.modules) return [];
    return state.modules.filter((m) => {
      const status = (m.status || "").toLowerCase();
      const ready = (m.ready_status || "").toLowerCase();
      const lifecycleBad = status.includes("fail") || status.includes("error") || status === "stopped" || status === "stop-error";
      const readyBad = ready === "not-ready";
      return lifecycleBad || readyBad;
    });
  }, [state]);

  // Emit a toast when modules transition into an unhealthy state.
  useEffect(() => {
    if (unhealthyModules.length === 0) return;
    const label = unhealthyModules.map((m) => m.name).join(", ");
    notify("error", `Modules degraded: ${label}`);
    // run once per state change
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [unhealthyModules.map((m) => m.name + m.status).join("|")]);

  const handleSetAggregation = useCallback(
    async (accountID: string, feedID: string, aggregation: string) => {
      const state = datafeeds[accountID];
      if (!state || state.status !== "ready") return;
      const feed = state.feeds.find((f) => f.ID === feedID);
      if (!feed) return;
      try {
        await setAggregation(accountID, feed, aggregation);
        notify("success", `Updated aggregation to ${aggregation} for ${feed.Pair}`);
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        notify("error", `Failed to update aggregation: ${msg}`);
      }
    },
    [datafeeds, notify, setAggregation],
  );

  const handleCreateChannel = useCallback(
    async (accountID: string, payload: { name: string; endpoint: string; signers: string[]; status?: string; metadata?: Record<string, string> }) => {
      try {
        await createChannel(accountID, payload);
        notify("success", `Channel ${payload.name} created`);
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        notify("error", `Create channel failed: ${msg}`);
      }
    },
    [createChannel, notify],
  );

  const handleCreateDelivery = useCallback(
    async (accountID: string, payload: { channelId: string; body: Record<string, any>; metadata?: Record<string, string> }) => {
      try {
        await createDelivery(accountID, payload.channelId, { body: payload.body, metadata: payload.metadata });
        notify("success", "Delivery queued");
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        notify("error", `Create delivery failed: ${msg}`);
      }
    },
    [createDelivery, notify],
  );

  return (
    <div className="app">
      <header className="hero">
        <div>
          <p className="eyebrow">Neo N3 Service Layer</p>
          <h1>Dashboard bootstrap</h1>
          <p className="muted">
            Configure the API endpoint and token, then explore system descriptors to toggle feature-aware views. Defaults (local compose):
            API <code>http://localhost:8080</code>, token <code>dev-token</code>, or login via admin/changeme.
            Tip: open <code>http://localhost:8081/?api=http://localhost:8080&token=dev-token</code> (append <code>&tenant=&lt;id&gt;</code>) to
            prefill the UI in one click.
          </p>
          <div className="row" style={{ gap: "8px" }}>
            <span className="tag">Tenant: {config.tenant || "none"}</span>
            <span className="tag subdued">Auth: Bearer token</span>
          </div>
        </div>
      </header>

      <section className="card">
        {!config.tenant && (
          <div className="notice warning">
            <strong>No tenant set.</strong> Tenant-scoped accounts will return 403s until you set a tenant in Settings or open the tenant quickstart.
          </div>
        )}
        <WalletGate
          wallet={wallet}
          onConnect={(w) => setWallet(w)}
          onDisconnect={() => setWallet({ address: "", label: "", signature: "" })}
        />
        <AuthPanel
          baseUrl={config.baseUrl}
          onLoggedIn={(tok, role) => {
            setToken(tok);
            notify("success", `Logged in${role ? ` (${role})` : ""}`);
          }}
        />
        <SettingsForm
          baseUrl={baseUrl}
          token={token}
          refreshToken={refreshToken}
          tenant={tenant}
          promBase={promBase}
          slowMs={slowMs}
          serverSlowMs={state.status === "ready" ? state.modulesSlowThreshold : undefined}
          canQuery={canQuery}
          status={state.status}
          onSubmit={onSubmit}
          onBaseUrlChange={setBaseUrl}
          onTokenChange={setToken}
          onRefreshTokenChange={setRefreshToken}
          onTenantChange={setTenant}
          onPromChange={setPromBase}
          onSlowMsChange={setSlowMs}
          onClear={handleClearSession}
        />
        {state.status === "error" && <p className="error">Failed to load: {state.message}</p>}
        {state.status === "ready" && unhealthyModules.length > 0 && (
          <div className="card warning">
            <h4>Modules need attention</h4>
            <ul className="list">
              {unhealthyModules.map((m) => (
                <li key={m.name}>
                  <div className="row">
                    <strong>{m.name}</strong> {m.status && <span className="tag error">{m.status}</span>}
                  </div>
                  {m.error && <div className="muted mono">{m.error}</div>}
                </li>
              ))}
            </ul>
          </div>
        )}
        {state.status === "ready" && (
          <>
            <SystemOverview
              descriptors={state.descriptors}
              version={state.version}
              buildVersion={systemVersion}
              baseUrl={config.baseUrl}
              promBase={promConfig.prometheusBaseUrl}
              modules={state.modules}
              modulesTimings={state.modulesTimings}
              modulesUptime={state.modulesUptime}
              modulesMeta={state.modulesMeta}
              modulesSlow={state.modulesSlow}
              modulesSlowThreshold={state.modulesSlowThreshold}
              slowOverrideMs={slowMs}
              modulesSummary={state.modulesSummary}
              modulesAPISummary={state.modulesAPISummary}
              modulesAPIMeta={state.modulesAPIMeta}
              activeSurface={surface}
              activeLayer={layer}
              onSurfaceChange={setSurface}
              onLayerChange={setLayer}
              modulesWaitingDeps={state.modulesWaitingDeps}
              modulesWaitingReasons={state.modulesWaitingReasons}
              neo={state.neo}
              jam={state.jam}
              busFanout={state.busFanout}
              busFanoutRecent={state.busFanoutRecent}
              busFanoutRecentWindowSeconds={state.busFanoutRecentWindowSeconds}
              busMaxBytes={state.busMaxBytes}
              metrics={state.metrics}
              formatDuration={formatDuration}
              formatTimestamp={formatTimestamp}
            />
            <BusConsole config={config} onNotify={notify} />
            <NeoPanel baseUrl={config.baseUrl} token={config.token} onNotify={notify} />
            <div className="card inner accounts">
              <h3>Accounts ({state.accounts.length})</h3>
              {state.accounts.some((a) => a.Metadata?.tenant) && !config.tenant && (
                <p className="warning">Tenant-scoped accounts detected. Set Tenant in Settings to avoid 403s.</p>
              )}
              {state.accounts.length === 0 && <p className="muted">No accounts found.</p>}
              <AccountsSection
                accounts={state.accounts}
                activeTenant={config.tenant}
                linkBase={window.location.origin + window.location.pathname}
                wallets={wallets}
                vrf={vrf}
                ccip={ccip}
                datafeeds={datafeeds}
                pricefeeds={pricefeeds}
                datalink={datalink}
                datastreams={datastreams}
                dta={dta}
                gasbank={gasbank}
                conf={conf}
                cre={cre}
                automation={automation}
                secrets={secrets}
                functionsState={functionsState}
                oracle={oracle}
                random={random}
                oracleBanner={oracleBanner}
                oracleCursors={oracleCursors}
                oracleFailedCursor={oracleFailedCursor}
                loadingOraclePage={loadingOraclePage}
                loadingOracleFailedPage={loadingOracleFailedPage}
                oracleFilters={oracleFilters}
                retryingOracle={retryingOracle}
                onLoadWallets={loadWallets}
                onLoadVRF={loadVRF}
                onLoadCCIP={loadCCIP}
                onLoadDatafeeds={loadDatafeeds}
                onLoadPricefeeds={loadPricefeeds}
                onLoadDatalink={loadDatalink}
                onLoadDatastreams={loadDatastreams}
                onLoadDTA={loadDTA}
                onLoadGasbank={loadGasbank}
                onLoadConf={loadConf}
                onLoadCRE={loadCRE}
                onLoadAutomation={loadAutomation}
                onLoadSecrets={loadSecrets}
                onLoadFunctions={loadFunctions}
                onLoadOracle={loadOracle}
                onLoadRandom={loadRandom}
                onLoadMoreOracle={loadMoreOracle}
                onLoadMoreFailedOracle={loadMoreFailedOracle}
                onRetryOracle={retryOracle}
                onCopyCursor={copyCursor}
                onSetAggregation={handleSetAggregation}
                onCreateChannel={(accountID, payload) => handleCreateChannel(accountID, payload)}
                onCreateDelivery={(accountID, payload) => handleCreateDelivery(accountID, payload)}
                onNotify={notify}
                setFilter={(accountID, value) => setOracleFilters((prev) => ({ ...prev, [accountID]: value }))}
                formatSnippet={formatSnippet}
                formatTimestamp={formatTimestamp}
                formatDuration={formatDuration}
                formatAmount={formatAmount}
              />
            </div>
            {canQuery && <JamPanel baseUrl={config.baseUrl} token={config.token} onNotify={notify} />}
          </>
        )}
        {state.status === "idle" && <p className="muted">Enter a base URL and token to connect.</p>}
        <AdminPanel systemState={state} baseUrl={config.baseUrl} token={config.token} tenant={config.tenant} />
      </section>

      <section className="card inner">
        <h3>Docs</h3>
        <p className="muted">Quick references to keep the dashboard in sync with the backend.</p>
        <ul className="wallets">
          {docsLinks.map((link) => (
            <li key={link.href}>
              <a href={link.href} target="_blank" rel="noreferrer">
                {link.label}
              </a>
            </li>
          ))}
        </ul>
      </section>
      <Notifications items={notifications} onDismiss={dismissNotification} />
    </div>
  );
}
