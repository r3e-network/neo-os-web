import { FormEvent } from "react";

type Props = {
  baseUrl: string;
  token: string;
  refreshToken?: string;
  tenant: string;
  promBase: string;
  slowMs: string;
  serverSlowMs?: number;
  canQuery: boolean;
  status: "idle" | "loading" | "ready" | "error";
  onSubmit: (event: FormEvent) => void;
  onBaseUrlChange: (value: string) => void;
  onTokenChange: (value: string) => void;
  onRefreshTokenChange?: (value: string) => void;
  onTenantChange: (value: string) => void;
  onPromChange: (value: string) => void;
  onSlowMsChange: (value: string) => void;
  onClear?: () => void;
};

export function SettingsForm({
  baseUrl,
  token,
  refreshToken,
  tenant,
  promBase,
  slowMs,
  serverSlowMs,
  canQuery,
  status,
  onSubmit,
  onBaseUrlChange,
  onTokenChange,
  onRefreshTokenChange,
  onTenantChange,
  onPromChange,
  onSlowMsChange,
  onClear,
}: Props) {
  return (
    <form className="settings" onSubmit={onSubmit}>
      <label>
        API Base URL
        <input value={baseUrl} onChange={(e) => onBaseUrlChange(e.target.value)} placeholder="http://localhost:8080" />
        <span className="hint">Point at the appserver HTTP endpoint.</span>
      </label>
      <label>
        API Token
        <input value={token} onChange={(e) => onTokenChange(e.target.value)} placeholder="Bearer token" />
        <span className="hint">Use the same bearer token you send to the API.</span>
      </label>
      {onRefreshTokenChange && (
        <label>
          Supabase Refresh Token (optional)
          <input value={refreshToken || ""} onChange={(e) => onRefreshTokenChange(e.target.value)} placeholder="Supabase refresh token" />
          <span className="hint">Used to obtain a new access token via /auth/refresh when the API token expires.</span>
          <span className="hint">Stored only in session storage; paste a Supabase refresh token to auto-renew access.</span>
        </label>
      )}
      <label>
        Tenant (required for scoped accounts)
        <input value={tenant} onChange={(e) => onTenantChange(e.target.value)} placeholder="tenant id" />
        <span className="hint warning">Set the tenant for all requests; leaving it blank will cause 403s for tenant-scoped accounts.</span>
      </label>
      <label>
        Prometheus URL
        <input value={promBase} onChange={(e) => onPromChange(e.target.value)} placeholder="http://localhost:9090" />
        <span className="hint">Optional: needed for the metrics cards.</span>
      </label>
      <label>
        Slow Threshold (ms, UI only)
        <input value={slowMs} onChange={(e) => onSlowMsChange(e.target.value)} placeholder="e.g. 1000" />
        <span className="hint">
          Overrides slow badge threshold locally; leave blank to use server threshold from /system/status
          {serverSlowMs ? ` (${serverSlowMs}ms)` : ""}.
        </span>
      </label>
      <button type="submit" disabled={!canQuery || status === "loading"}>
        {status === "loading" ? "Loading..." : "Connect"}
      </button>
      {onClear && (
        <button type="button" className="ghost" onClick={onClear}>
          Clear session (base URL, token, tenant)
        </button>
      )}
    </form>
  );
}
