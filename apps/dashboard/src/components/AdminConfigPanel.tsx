import { useState, useEffect, useCallback } from "react";
import {
  ChainRPC,
  DataProvider,
  SystemSetting,
  FeatureFlag,
  TenantQuota,
  AllowedMethod,
  ClientConfig,
  fetchChainRPCs,
  createChainRPC,
  updateChainRPC,
  deleteChainRPC,
  fetchDataProviders,
  createDataProvider,
  updateDataProvider,
  deleteDataProvider,
  fetchSettings,
  updateSetting,
  fetchFeatureFlags,
  updateFeatureFlag,
  createFeatureFlag,
  fetchTenantQuotas,
  updateTenantQuota,
  createTenantQuota,
  deleteTenantQuota,
  fetchAllowedMethods,
  updateAllowedMethods,
} from "../api";

type Props = {
  baseUrl: string;
  token: string;
  tenant?: string;
};

type Tab = "chains" | "providers" | "settings" | "features" | "quotas" | "methods";

export function AdminConfigPanel({ baseUrl, token, tenant }: Props) {
  const [tab, setTab] = useState<Tab>("chains");
  const config: ClientConfig = { baseUrl, token, tenant };

  return (
    <section className="card inner">
      <div className="row">
        <h3>Configuration Management</h3>
      </div>
      <p className="muted">Manage platform configuration: chain RPCs, data providers, settings, feature flags, and tenant quotas.</p>

      <div className="tabs" style={{ display: "flex", gap: "8px", marginBottom: "16px", flexWrap: "wrap" }}>
        {(["chains", "providers", "settings", "features", "quotas", "methods"] as Tab[]).map((t) => (
          <button
            key={t}
            className={tab === t ? "btn primary" : "btn"}
            onClick={() => setTab(t)}
            style={{ textTransform: "capitalize" }}
          >
            {t === "chains" ? "Chain RPCs" : t === "providers" ? "Data Providers" : t === "methods" ? "RPC Methods" : t}
          </button>
        ))}
      </div>

      {tab === "chains" && <ChainRPCsTab config={config} />}
      {tab === "providers" && <DataProvidersTab config={config} />}
      {tab === "settings" && <SettingsTab config={config} />}
      {tab === "features" && <FeatureFlagsTab config={config} />}
      {tab === "quotas" && <TenantQuotasTab config={config} />}
      {tab === "methods" && <AllowedMethodsTab config={config} />}
    </section>
  );
}

// ============================================================================
// Chain RPCs Tab
// ============================================================================

function ChainRPCsTab({ config }: { config: ClientConfig }) {
  const [chains, setChains] = useState<ChainRPC[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>();
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string>();
  const [form, setForm] = useState<Partial<ChainRPC>>({});

  const loadChains = useCallback(async () => {
    setLoading(true);
    try {
      const data = await fetchChainRPCs(config);
      setChains(data);
      setError(undefined);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
    setLoading(false);
  }, [config]);

  useEffect(() => {
    loadChains();
  }, [loadChains]);

  const handleSubmit = async () => {
    try {
      if (editingId) {
        await updateChainRPC(config, editingId, form);
      } else {
        await createChainRPC(config, form);
      }
      setShowForm(false);
      setEditingId(undefined);
      setForm({});
      loadChains();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  };

  const handleEdit = (chain: ChainRPC) => {
    setForm(chain);
    setEditingId(chain.id);
    setShowForm(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this chain RPC?")) return;
    try {
      await deleteChainRPC(config, id);
      loadChains();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  };

  const handleToggle = async (chain: ChainRPC) => {
    try {
      await updateChainRPC(config, chain.id, { ...chain, enabled: !chain.enabled });
      loadChains();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  };

  if (loading) return <p className="muted">Loading...</p>;
  if (error) return <p className="error">Error: {error}</p>;

  return (
    <div>
      <div className="row" style={{ marginBottom: "12px" }}>
        <span className="tag">{chains.length} chains</span>
        <button className="btn primary" onClick={() => { setShowForm(true); setEditingId(undefined); setForm({ chain_type: "evm", enabled: true }); }}>
          + Add Chain RPC
        </button>
      </div>

      {showForm && (
        <div className="card" style={{ marginBottom: "16px", padding: "12px" }}>
          <h4>{editingId ? "Edit" : "Add"} Chain RPC</h4>
          <div className="form-grid" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px" }}>
            <input placeholder="Chain ID (e.g., eth, btc)" value={form.chain_id || ""} onChange={(e) => setForm({ ...form, chain_id: e.target.value })} />
            <input placeholder="Name" value={form.name || ""} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            <input placeholder="RPC URL" value={form.rpc_url || ""} onChange={(e) => setForm({ ...form, rpc_url: e.target.value })} style={{ gridColumn: "1 / -1" }} />
            <input placeholder="WebSocket URL (optional)" value={form.ws_url || ""} onChange={(e) => setForm({ ...form, ws_url: e.target.value })} style={{ gridColumn: "1 / -1" }} />
            <select value={form.chain_type || "evm"} onChange={(e) => setForm({ ...form, chain_type: e.target.value })}>
              <option value="evm">EVM</option>
              <option value="neo">Neo</option>
              <option value="btc">Bitcoin</option>
              <option value="cosmos">Cosmos</option>
            </select>
            <input type="number" placeholder="Network ID" value={form.network_id || ""} onChange={(e) => setForm({ ...form, network_id: Number(e.target.value) })} />
            <input type="number" placeholder="Priority (0=highest)" value={form.priority ?? ""} onChange={(e) => setForm({ ...form, priority: Number(e.target.value) })} />
            <input type="number" placeholder="Max RPS (0=unlimited)" value={form.max_rps ?? ""} onChange={(e) => setForm({ ...form, max_rps: Number(e.target.value) })} />
          </div>
          <div style={{ marginTop: "12px", display: "flex", gap: "8px" }}>
            <button className="btn primary" onClick={handleSubmit}>Save</button>
            <button className="btn" onClick={() => { setShowForm(false); setForm({}); }}>Cancel</button>
          </div>
        </div>
      )}

      <div className="table">
        <div className="table-head">
          <span>Chain</span>
          <span>Name</span>
          <span>Type</span>
          <span>RPC URL</span>
          <span>Status</span>
          <span>Actions</span>
        </div>
        {chains.map((chain) => (
          <div key={chain.id} className="table-row">
            <span className="mono">{chain.chain_id}</span>
            <span>{chain.name}</span>
            <span className="tag subdued">{chain.chain_type}</span>
            <span className="mono" style={{ fontSize: "11px", maxWidth: "200px", overflow: "hidden", textOverflow: "ellipsis" }}>{chain.rpc_url}</span>
            <span>
              <span className={`tag ${chain.enabled ? "success" : "warning"}`}>{chain.enabled ? "Enabled" : "Disabled"}</span>
              {chain.healthy ? <span className="tag success" style={{ marginLeft: 4 }}>Healthy</span> : <span className="tag error" style={{ marginLeft: 4 }}>Unhealthy</span>}
            </span>
            <span style={{ display: "flex", gap: "4px" }}>
              <button className="btn small" onClick={() => handleToggle(chain)}>{chain.enabled ? "Disable" : "Enable"}</button>
              <button className="btn small" onClick={() => handleEdit(chain)}>Edit</button>
              <button className="btn small error" onClick={() => handleDelete(chain.id)}>Delete</button>
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ============================================================================
// Data Providers Tab
// ============================================================================

function DataProvidersTab({ config }: { config: ClientConfig }) {
  const [providers, setProviders] = useState<DataProvider[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>();
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string>();
  const [form, setForm] = useState<Partial<DataProvider>>({});

  const loadProviders = useCallback(async () => {
    setLoading(true);
    try {
      const data = await fetchDataProviders(config);
      setProviders(data);
      setError(undefined);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
    setLoading(false);
  }, [config]);

  useEffect(() => {
    loadProviders();
  }, [loadProviders]);

  const handleSubmit = async () => {
    try {
      if (editingId) {
        await updateDataProvider(config, editingId, form);
      } else {
        await createDataProvider(config, form);
      }
      setShowForm(false);
      setEditingId(undefined);
      setForm({});
      loadProviders();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  };

  const handleEdit = (provider: DataProvider) => {
    setForm(provider);
    setEditingId(provider.id);
    setShowForm(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this provider?")) return;
    try {
      await deleteDataProvider(config, id);
      loadProviders();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  };

  const handleToggle = async (provider: DataProvider) => {
    try {
      await updateDataProvider(config, provider.id, { ...provider, enabled: !provider.enabled });
      loadProviders();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  };

  if (loading) return <p className="muted">Loading...</p>;
  if (error) return <p className="error">Error: {error}</p>;

  return (
    <div>
      <div className="row" style={{ marginBottom: "12px" }}>
        <span className="tag">{providers.length} providers</span>
        <button className="btn primary" onClick={() => { setShowForm(true); setEditingId(undefined); setForm({ type: "oracle", enabled: true }); }}>
          + Add Provider
        </button>
      </div>

      {showForm && (
        <div className="card" style={{ marginBottom: "16px", padding: "12px" }}>
          <h4>{editingId ? "Edit" : "Add"} Data Provider</h4>
          <div className="form-grid" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px" }}>
            <input placeholder="Name (e.g., coingecko)" value={form.name || ""} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            <select value={form.type || "oracle"} onChange={(e) => setForm({ ...form, type: e.target.value })}>
              <option value="oracle">Oracle</option>
              <option value="price_feed">Price Feed</option>
              <option value="api">API</option>
              <option value="webhook">Webhook</option>
            </select>
            <input placeholder="Base URL" value={form.base_url || ""} onChange={(e) => setForm({ ...form, base_url: e.target.value })} style={{ gridColumn: "1 / -1" }} />
            <input placeholder="API Key (optional)" type="password" value={form.api_key || ""} onChange={(e) => setForm({ ...form, api_key: e.target.value })} />
            <input type="number" placeholder="Rate Limit (req/min)" value={form.rate_limit ?? ""} onChange={(e) => setForm({ ...form, rate_limit: Number(e.target.value) })} />
            <input type="number" placeholder="Timeout (ms)" value={form.timeout_ms ?? ""} onChange={(e) => setForm({ ...form, timeout_ms: Number(e.target.value) })} />
            <input type="number" placeholder="Retries" value={form.retries ?? ""} onChange={(e) => setForm({ ...form, retries: Number(e.target.value) })} />
          </div>
          <div style={{ marginTop: "12px", display: "flex", gap: "8px" }}>
            <button className="btn primary" onClick={handleSubmit}>Save</button>
            <button className="btn" onClick={() => { setShowForm(false); setForm({}); }}>Cancel</button>
          </div>
        </div>
      )}

      <div className="table">
        <div className="table-head">
          <span>Name</span>
          <span>Type</span>
          <span>Base URL</span>
          <span>Rate Limit</span>
          <span>Status</span>
          <span>Actions</span>
        </div>
        {providers.map((p) => (
          <div key={p.id} className="table-row">
            <span className="mono">{p.name}</span>
            <span className="tag subdued">{p.type}</span>
            <span className="mono" style={{ fontSize: "11px", maxWidth: "200px", overflow: "hidden", textOverflow: "ellipsis" }}>{p.base_url}</span>
            <span>{p.rate_limit || "unlimited"}/min</span>
            <span>
              <span className={`tag ${p.enabled ? "success" : "warning"}`}>{p.enabled ? "Enabled" : "Disabled"}</span>
            </span>
            <span style={{ display: "flex", gap: "4px" }}>
              <button className="btn small" onClick={() => handleToggle(p)}>{p.enabled ? "Disable" : "Enable"}</button>
              <button className="btn small" onClick={() => handleEdit(p)}>Edit</button>
              <button className="btn small error" onClick={() => handleDelete(p.id)}>Delete</button>
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ============================================================================
// Settings Tab
// ============================================================================

function SettingsTab({ config }: { config: ClientConfig }) {
  const [settings, setSettings] = useState<SystemSetting[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>();
  const [editingKey, setEditingKey] = useState<string>();
  const [editValue, setEditValue] = useState("");

  const loadSettings = useCallback(async () => {
    setLoading(true);
    try {
      const data = await fetchSettings(config);
      setSettings(data);
      setError(undefined);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
    setLoading(false);
  }, [config]);

  useEffect(() => {
    loadSettings();
  }, [loadSettings]);

  const handleSave = async (setting: SystemSetting) => {
    try {
      await updateSetting(config, setting.key, { ...setting, value: editValue });
      setEditingKey(undefined);
      loadSettings();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  };

  const categories = [...new Set(settings.map((s) => s.category))];

  if (loading) return <p className="muted">Loading...</p>;
  if (error) return <p className="error">Error: {error}</p>;

  return (
    <div>
      {categories.map((cat) => (
        <div key={cat} style={{ marginBottom: "16px" }}>
          <h4 style={{ textTransform: "capitalize" }}>{cat}</h4>
          <div className="table">
            <div className="table-head">
              <span>Key</span>
              <span>Value</span>
              <span>Type</span>
              <span>Description</span>
              <span>Actions</span>
            </div>
            {settings.filter((s) => s.category === cat).map((s) => (
              <div key={s.key} className="table-row">
                <span className="mono">{s.key}</span>
                <span>
                  {editingKey === s.key ? (
                    s.type === "bool" ? (
                      <select value={editValue} onChange={(e) => setEditValue(e.target.value)}>
                        <option value="true">true</option>
                        <option value="false">false</option>
                      </select>
                    ) : (
                      <input value={editValue} onChange={(e) => setEditValue(e.target.value)} style={{ width: "100px" }} />
                    )
                  ) : (
                    <span className="mono">{s.value}</span>
                  )}
                </span>
                <span className="tag subdued">{s.type}</span>
                <span className="muted" style={{ fontSize: "11px" }}>{s.description}</span>
                <span>
                  {editingKey === s.key ? (
                    <>
                      <button className="btn small primary" onClick={() => handleSave(s)}>Save</button>
                      <button className="btn small" onClick={() => setEditingKey(undefined)}>Cancel</button>
                    </>
                  ) : (
                    s.editable && <button className="btn small" onClick={() => { setEditingKey(s.key); setEditValue(s.value); }}>Edit</button>
                  )}
                </span>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

// ============================================================================
// Feature Flags Tab
// ============================================================================

function FeatureFlagsTab({ config }: { config: ClientConfig }) {
  const [flags, setFlags] = useState<FeatureFlag[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>();
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<Partial<FeatureFlag>>({});

  const loadFlags = useCallback(async () => {
    setLoading(true);
    try {
      const data = await fetchFeatureFlags(config);
      setFlags(data);
      setError(undefined);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
    setLoading(false);
  }, [config]);

  useEffect(() => {
    loadFlags();
  }, [loadFlags]);

  const handleToggle = async (flag: FeatureFlag) => {
    try {
      await updateFeatureFlag(config, flag.key, { ...flag, enabled: !flag.enabled });
      loadFlags();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  };

  const handleCreate = async () => {
    try {
      await createFeatureFlag(config, form);
      setShowForm(false);
      setForm({});
      loadFlags();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  };

  if (loading) return <p className="muted">Loading...</p>;
  if (error) return <p className="error">Error: {error}</p>;

  return (
    <div>
      <div className="row" style={{ marginBottom: "12px" }}>
        <span className="tag">{flags.length} flags</span>
        <button className="btn primary" onClick={() => setShowForm(true)}>+ Add Flag</button>
      </div>

      {showForm && (
        <div className="card" style={{ marginBottom: "16px", padding: "12px" }}>
          <h4>Add Feature Flag</h4>
          <div className="form-grid" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px" }}>
            <input placeholder="Key (e.g., new_feature)" value={form.key || ""} onChange={(e) => setForm({ ...form, key: e.target.value })} />
            <input placeholder="Description" value={form.description || ""} onChange={(e) => setForm({ ...form, description: e.target.value })} />
            <input type="number" placeholder="Rollout % (0-100)" value={form.rollout ?? 100} onChange={(e) => setForm({ ...form, rollout: Number(e.target.value) })} />
            <label style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <input type="checkbox" checked={form.enabled ?? false} onChange={(e) => setForm({ ...form, enabled: e.target.checked })} />
              Enabled
            </label>
          </div>
          <div style={{ marginTop: "12px", display: "flex", gap: "8px" }}>
            <button className="btn primary" onClick={handleCreate}>Create</button>
            <button className="btn" onClick={() => setShowForm(false)}>Cancel</button>
          </div>
        </div>
      )}

      <div className="table">
        <div className="table-head">
          <span>Key</span>
          <span>Description</span>
          <span>Rollout</span>
          <span>Status</span>
          <span>Updated</span>
          <span>Actions</span>
        </div>
        {flags.map((f) => (
          <div key={f.key} className="table-row">
            <span className="mono">{f.key}</span>
            <span className="muted" style={{ fontSize: "11px" }}>{f.description}</span>
            <span>{f.rollout}%</span>
            <span><span className={`tag ${f.enabled ? "success" : "warning"}`}>{f.enabled ? "ON" : "OFF"}</span></span>
            <span className="muted" style={{ fontSize: "11px" }}>{f.updated_by || "-"}</span>
            <span>
              <button className="btn small" onClick={() => handleToggle(f)}>{f.enabled ? "Disable" : "Enable"}</button>
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ============================================================================
// Tenant Quotas Tab
// ============================================================================

function TenantQuotasTab({ config }: { config: ClientConfig }) {
  const [quotas, setQuotas] = useState<TenantQuota[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>();
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string>();
  const [form, setForm] = useState<Partial<TenantQuota>>({});

  const loadQuotas = useCallback(async () => {
    setLoading(true);
    try {
      const data = await fetchTenantQuotas(config);
      setQuotas(data);
      setError(undefined);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
    setLoading(false);
  }, [config]);

  useEffect(() => {
    loadQuotas();
  }, [loadQuotas]);

  const handleSubmit = async () => {
    try {
      if (editingId) {
        await updateTenantQuota(config, editingId, form);
      } else {
        await createTenantQuota(config, form);
      }
      setShowForm(false);
      setEditingId(undefined);
      setForm({});
      loadQuotas();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  };

  const handleEdit = (q: TenantQuota) => {
    setForm(q);
    setEditingId(q.tenant_id);
    setShowForm(true);
  };

  const handleDelete = async (tenantId: string) => {
    if (!confirm("Delete quota for this tenant?")) return;
    try {
      await deleteTenantQuota(config, tenantId);
      loadQuotas();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  };

  if (loading) return <p className="muted">Loading...</p>;
  if (error) return <p className="error">Error: {error}</p>;

  return (
    <div>
      <div className="row" style={{ marginBottom: "12px" }}>
        <span className="tag">{quotas.length} quotas</span>
        <button className="btn primary" onClick={() => { setShowForm(true); setEditingId(undefined); setForm({ max_accounts: 10, max_functions: 100, max_rpc_per_min: 1000 }); }}>
          + Add Quota
        </button>
      </div>

      {showForm && (
        <div className="card" style={{ marginBottom: "16px", padding: "12px" }}>
          <h4>{editingId ? "Edit" : "Add"} Tenant Quota</h4>
          <div className="form-grid" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px" }}>
            <input placeholder="Tenant ID" value={form.tenant_id || ""} onChange={(e) => setForm({ ...form, tenant_id: e.target.value })} disabled={!!editingId} />
            <input type="number" placeholder="Max Accounts" value={form.max_accounts ?? ""} onChange={(e) => setForm({ ...form, max_accounts: Number(e.target.value) })} />
            <input type="number" placeholder="Max Functions" value={form.max_functions ?? ""} onChange={(e) => setForm({ ...form, max_functions: Number(e.target.value) })} />
            <input type="number" placeholder="Max RPC/min" value={form.max_rpc_per_min ?? ""} onChange={(e) => setForm({ ...form, max_rpc_per_min: Number(e.target.value) })} />
            <input type="number" placeholder="Max Storage (bytes)" value={form.max_storage_bytes ?? ""} onChange={(e) => setForm({ ...form, max_storage_bytes: Number(e.target.value) })} />
            <input type="number" placeholder="Max Gas/day" value={form.max_gas_per_day ?? ""} onChange={(e) => setForm({ ...form, max_gas_per_day: Number(e.target.value) })} />
          </div>
          <div style={{ marginTop: "12px", display: "flex", gap: "8px" }}>
            <button className="btn primary" onClick={handleSubmit}>Save</button>
            <button className="btn" onClick={() => { setShowForm(false); setForm({}); }}>Cancel</button>
          </div>
        </div>
      )}

      <div className="table">
        <div className="table-head">
          <span>Tenant</span>
          <span>Accounts</span>
          <span>Functions</span>
          <span>RPC/min</span>
          <span>Storage</span>
          <span>Actions</span>
        </div>
        {quotas.map((q) => (
          <div key={q.tenant_id} className="table-row">
            <span className="mono">{q.tenant_id}</span>
            <span>{q.max_accounts}</span>
            <span>{q.max_functions}</span>
            <span>{q.max_rpc_per_min}</span>
            <span>{formatBytes(q.max_storage_bytes)}</span>
            <span style={{ display: "flex", gap: "4px" }}>
              <button className="btn small" onClick={() => handleEdit(q)}>Edit</button>
              <button className="btn small error" onClick={() => handleDelete(q.tenant_id)}>Delete</button>
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
  return `${(bytes / 1024 / 1024 / 1024).toFixed(1)} GB`;
}

// ============================================================================
// Allowed Methods Tab
// ============================================================================

function AllowedMethodsTab({ config }: { config: ClientConfig }) {
  const [methods, setMethods] = useState<AllowedMethod[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>();
  const [editingChain, setEditingChain] = useState<string>();
  const [editMethods, setEditMethods] = useState("");

  const loadMethods = useCallback(async () => {
    setLoading(true);
    try {
      const data = await fetchAllowedMethods(config);
      setMethods(data);
      setError(undefined);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
    setLoading(false);
  }, [config]);

  useEffect(() => {
    loadMethods();
  }, [loadMethods]);

  const handleSave = async (chainId: string) => {
    try {
      const methodList = editMethods.split(",").map((m) => m.trim()).filter(Boolean);
      await updateAllowedMethods(config, chainId, methodList);
      setEditingChain(undefined);
      loadMethods();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  };

  if (loading) return <p className="muted">Loading...</p>;
  if (error) return <p className="error">Error: {error}</p>;

  return (
    <div>
      <p className="muted">Configure which RPC methods are allowed per chain. Empty = all methods allowed.</p>
      <div className="table">
        <div className="table-head">
          <span>Chain</span>
          <span>Allowed Methods</span>
          <span>Actions</span>
        </div>
        {methods.map((m) => (
          <div key={m.chain_id} className="table-row">
            <span className="mono">{m.chain_id}</span>
            <span style={{ maxWidth: "400px" }}>
              {editingChain === m.chain_id ? (
                <input
                  value={editMethods}
                  onChange={(e) => setEditMethods(e.target.value)}
                  style={{ width: "100%" }}
                  placeholder="method1, method2, ..."
                />
              ) : (
                <span className="mono" style={{ fontSize: "11px" }}>
                  {m.methods.length > 0 ? m.methods.join(", ") : <em className="muted">all allowed</em>}
                </span>
              )}
            </span>
            <span>
              {editingChain === m.chain_id ? (
                <>
                  <button className="btn small primary" onClick={() => handleSave(m.chain_id)}>Save</button>
                  <button className="btn small" onClick={() => setEditingChain(undefined)}>Cancel</button>
                </>
              ) : (
                <button className="btn small" onClick={() => { setEditingChain(m.chain_id); setEditMethods(m.methods.join(", ")); }}>Edit</button>
              )}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
