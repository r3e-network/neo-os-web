import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { normaliseUrl, ClientConfig } from "./api";
import { useLocalStorage } from "./useLocalStorage";
import { MetricsConfig } from "./metrics";
import { Layout, Notifications } from "./components";
import { useAccountsData, useSystemInfo } from "./hooks";
import { useRouter } from "./Router";
import { UserDashboard, AdminDashboard, SettingsPage } from "./pages";
import type { Notification } from "./components/Notifications";

type WalletSession = { address: string; label?: string; signature?: string };

export function App() {
  const [route, navigate] = useRouter();

  // Configuration state
  const [baseUrl, setBaseUrl] = useLocalStorage("sl-ui.baseUrl", "http://localhost:8080");
  const [token, setToken] = useLocalStorage("sl-ui.token", "dev-token");
  const [tenant, setTenant] = useLocalStorage("sl-ui.tenant", "");
  const [promBase, setPromBase] = useLocalStorage("sl-ui.prometheus", "http://localhost:9090");

  // Wallet state
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

  // Build config objects
  const config = useMemo<ClientConfig>(
    () => ({
      baseUrl: normaliseUrl(baseUrl),
      token: token.trim(),
      tenant: tenant.trim() || undefined,
    }),
    [baseUrl, token, tenant]
  );

  const promConfig: MetricsConfig = useMemo(
    () => ({
      baseUrl: config.baseUrl,
      token: config.token,
      prometheusBaseUrl: normaliseUrl(promBase),
    }),
    [config, promBase]
  );

  const canQuery = config.baseUrl.length > 0 && config.token.length > 0;

  // Parse URL parameters
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const qsBase = params.get("api") || params.get("base") || params.get("baseUrl") || params.get("endpoint");
    const qsTenant = params.get("tenant");
    const qsToken = params.get("token") || params.get("auth") || params.get("bearer");
    const qsProm = params.get("prom") || params.get("prometheus");

    if (qsBase) setBaseUrl(normaliseUrl(qsBase));
    if (qsTenant) setTenant(qsTenant);
    if (qsToken) setToken(qsToken);
    if (qsProm) setPromBase(normaliseUrl(qsProm));
  }, [setBaseUrl, setTenant, setToken, setPromBase]);

  // Extended config with wallet for accounts data
  const accountsConfig = useMemo(
    () => ({ ...config, wallet }),
    [config, wallet]
  );

  // Data hooks
  const accountsData = useAccountsData(accountsConfig);
  const { state: systemState, systemVersion, load } = useSystemInfo(config, promConfig, canQuery);

  // Load data on config change
  useEffect(() => {
    accountsData.resetAccounts();
    void load();
  }, [config.baseUrl, config.token, config.tenant]);

  // Auto-refresh
  useEffect(() => {
    if (!canQuery) return;
    const id = setInterval(() => void load(), 30_000);
    return () => clearInterval(id);
  }, [canQuery, load]);

  // Notifications
  const [notifications, setNotifications] = useState<Notification[]>([]);

  const notify = useCallback((type: "success" | "error", message: string) => {
    const id = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    setNotifications((prev) => [...prev, { id, type, message }]);
    setTimeout(() => {
      setNotifications((prev) => prev.filter((n) => n.id !== id));
    }, 4000);
  }, []);

  const dismissNotification = useCallback((id: string) => {
    setNotifications((prev) => prev.filter((n) => n.id !== id));
  }, []);

  // Module health monitoring
  const unhealthyModules = useMemo(() => {
    if (systemState.status !== "ready" || !systemState.modules) return [];
    return systemState.modules.filter((m) => {
      const status = (m.status || "").toLowerCase();
      const ready = (m.ready_status || "").toLowerCase();
      const lifecycleBad = status.includes("fail") || status.includes("error") || status === "stopped" || status === "stop-error";
      const readyBad = ready === "not-ready";
      return lifecycleBad || readyBad;
    });
  }, [systemState]);

  // Notify on unhealthy modules
  useEffect(() => {
    if (unhealthyModules.length === 0) return;
    const label = unhealthyModules.map((m) => m.name).join(", ");
    notify("error", `Modules degraded: ${label}`);
  }, [unhealthyModules.map((m) => m.name + m.status).join("|")]);

  // Handlers
  const handleClearSession = useCallback(() => {
    setToken("");
    setTenant("");
    setBaseUrl("http://localhost:8080");
    setPromBase("http://localhost:9090");
    accountsData.resetAccounts();
  }, [accountsData.resetAccounts, setBaseUrl, setPromBase, setTenant, setToken]);

  const handleSave = useCallback(() => {
    accountsData.resetAccounts();
    void load();
  }, [accountsData.resetAccounts, load]);

  const handleLogin = useCallback(
    async (username: string, password: string) => {
      const resp = await fetch(`${config.baseUrl}/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      });
      if (!resp.ok) {
        const text = await resp.text();
        throw new Error(text || `Login failed (${resp.status})`);
      }
      const data = await resp.json();
      if (data.token) {
        setToken(data.token);
        notify("success", `Logged in${data.role ? ` (${data.role})` : ""}`);
      }
    },
    [config.baseUrl, setToken, notify]
  );

  const handleSelectAccount = useCallback((accountId: string) => {
    console.log("Selected account:", accountId);
    // Could expand account details or navigate to account view
  }, []);

  const handleServiceClick = useCallback((serviceId: string) => {
    console.log("Clicked service:", serviceId);
    // Could expand service panel or navigate to service view
  }, []);

  // Render current page
  const renderPage = () => {
    switch (route) {
      case "admin":
        return (
          <AdminDashboard
            systemState={systemState}
            config={config}
            onNotify={notify}
            onOpenSettings={() => navigate("settings")}
          />
        );

      case "settings":
        return (
          <SettingsPage
            baseUrl={baseUrl}
            token={token}
            tenant={tenant}
            promBase={promBase}
            onBaseUrlChange={setBaseUrl}
            onTokenChange={setToken}
            onTenantChange={setTenant}
            onPromChange={setPromBase}
            onSave={handleSave}
            onClear={handleClearSession}
            onLogin={handleLogin}
          />
        );

      case "user":
      default:
        return (
          <UserDashboard
            systemState={systemState}
            accounts={systemState.status === "ready" ? systemState.accounts : []}
            onSelectAccount={handleSelectAccount}
            onServiceClick={handleServiceClick}
            onOpenSettings={() => navigate("settings")}
          />
        );
    }
  };

  return (
    <Layout
      route={route}
      onNavigate={navigate}
      version={systemState.status === "ready" ? systemState.version : undefined}
      connected={systemState.status === "ready"}
      tenant={config.tenant}
    >
      {renderPage()}
      <Notifications items={notifications} onDismiss={dismissNotification} />
    </Layout>
  );
}
