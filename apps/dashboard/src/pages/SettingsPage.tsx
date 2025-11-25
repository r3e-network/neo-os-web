import { FormEvent, useState } from "react";
import { normaliseUrl } from "../api";

type Props = {
  baseUrl: string;
  token: string;
  tenant: string;
  promBase: string;
  onBaseUrlChange: (url: string) => void;
  onTokenChange: (token: string) => void;
  onTenantChange: (tenant: string) => void;
  onPromChange: (url: string) => void;
  onSave: () => void;
  onClear: () => void;
  onLogin: (username: string, password: string) => Promise<void>;
};

export function SettingsPage({
  baseUrl,
  token,
  tenant,
  promBase,
  onBaseUrlChange,
  onTokenChange,
  onTenantChange,
  onPromChange,
  onSave,
  onClear,
  onLogin,
}: Props) {
  const [showToken, setShowToken] = useState(false);
  const [loginUsername, setLoginUsername] = useState("admin");
  const [loginPassword, setLoginPassword] = useState("");
  const [loginLoading, setLoginLoading] = useState(false);
  const [loginError, setLoginError] = useState<string>();

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    onSave();
  };

  const handleLogin = async (e: FormEvent) => {
    e.preventDefault();
    setLoginLoading(true);
    setLoginError(undefined);
    try {
      await onLogin(loginUsername, loginPassword);
      setLoginPassword("");
    } catch (err) {
      setLoginError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoginLoading(false);
    }
  };

  return (
    <div className="settings-page">
      <header className="settings-header">
        <h1>Settings</h1>
        <p className="muted">Configure your connection to the Service Layer</p>
      </header>

      <section className="settings-section">
        <h2>API Connection</h2>
        <form onSubmit={handleSubmit} className="settings-form">
          <div className="form-group">
            <label htmlFor="baseUrl">API Endpoint</label>
            <input
              id="baseUrl"
              type="url"
              value={baseUrl}
              onChange={(e) => onBaseUrlChange(e.target.value)}
              placeholder="http://localhost:8080"
            />
            <p className="hint">The base URL of the Service Layer API</p>
          </div>

          <div className="form-group">
            <label htmlFor="token">Bearer Token</label>
            <div className="input-with-action">
              <input
                id="token"
                type={showToken ? "text" : "password"}
                value={token}
                onChange={(e) => onTokenChange(e.target.value)}
                placeholder="dev-token"
              />
              <button type="button" onClick={() => setShowToken(!showToken)} className="btn-icon">
                {showToken ? "Hide" : "Show"}
              </button>
            </div>
            <p className="hint">Authentication token for API access</p>
          </div>

          <div className="form-group">
            <label htmlFor="tenant">Tenant ID (optional)</label>
            <input
              id="tenant"
              type="text"
              value={tenant}
              onChange={(e) => onTenantChange(e.target.value)}
              placeholder="tenant-123"
            />
            <p className="hint">Scope requests to a specific tenant</p>
          </div>

          <div className="form-group">
            <label htmlFor="promBase">Prometheus URL (optional)</label>
            <input
              id="promBase"
              type="url"
              value={promBase}
              onChange={(e) => onPromChange(e.target.value)}
              placeholder="http://localhost:9090"
            />
            <p className="hint">For metrics visualization</p>
          </div>

          <div className="form-actions">
            <button type="submit" className="btn-primary">
              Save & Connect
            </button>
            <button type="button" onClick={onClear} className="btn-secondary">
              Clear Settings
            </button>
          </div>
        </form>
      </section>

      <section className="settings-section">
        <h2>Login with Credentials</h2>
        <p className="muted">
          Use username/password to obtain a JWT token. Default for local compose: <code>admin/changeme</code>
        </p>
        <form onSubmit={handleLogin} className="settings-form">
          <div className="form-group">
            <label htmlFor="username">Username</label>
            <input
              id="username"
              type="text"
              value={loginUsername}
              onChange={(e) => setLoginUsername(e.target.value)}
              placeholder="admin"
            />
          </div>

          <div className="form-group">
            <label htmlFor="password">Password</label>
            <input
              id="password"
              type="password"
              value={loginPassword}
              onChange={(e) => setLoginPassword(e.target.value)}
              placeholder="changeme"
            />
          </div>

          {loginError && <div className="error-banner">{loginError}</div>}

          <div className="form-actions">
            <button type="submit" className="btn-primary" disabled={loginLoading || !baseUrl}>
              {loginLoading ? "Logging in..." : "Login"}
            </button>
          </div>
        </form>
      </section>

      <section className="settings-section">
        <h2>Quick Setup</h2>
        <p className="muted">Common configurations for different environments</p>
        <div className="presets-grid">
          <button
            className="preset-card"
            onClick={() => {
              onBaseUrlChange("http://localhost:8080");
              onTokenChange("dev-token");
              onPromChange("http://localhost:9090");
            }}
          >
            <h3>Local Development</h3>
            <p>localhost:8080 with dev-token</p>
          </button>
          <button
            className="preset-card"
            onClick={() => {
              const apiUrl = prompt("Enter API URL:", "https://api.example.com");
              if (apiUrl) {
                onBaseUrlChange(normaliseUrl(apiUrl));
              }
            }}
          >
            <h3>Custom Endpoint</h3>
            <p>Enter a custom API URL</p>
          </button>
        </div>
      </section>

      <section className="settings-section">
        <h2>URL Parameters</h2>
        <p className="muted">
          You can also configure settings via URL parameters for easy sharing:
        </p>
        <div className="code-block">
          <code>
            ?api=http://localhost:8080&token=dev-token&tenant=my-tenant
          </code>
        </div>
        <p className="hint">
          Supported parameters: <code>api</code>/<code>baseUrl</code>, <code>token</code>, <code>tenant</code>, <code>prom</code>
        </p>
      </section>
    </div>
  );
}
