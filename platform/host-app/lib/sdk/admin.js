// =============================================================================
// Admin SDK - Administrative API client for platform management
// =============================================================================
const DEFAULT_ADMIN_REQUEST_TIMEOUT_MS = 10000;
function assertServerOnly() {
  if (typeof window !== "undefined") {
    throw new Error(
      "AdminSDK is server-only. Do not bundle it into client-side code.",
    );
  }
}
/**
 * Admin SDK for platform management operations
 */
export class AdminSDK {
  config;
  constructor(config) {
    assertServerOnly();
    this.config = config;
  }
  /**
   * Fetch all services health status
   */
  async getServicesHealth() {
    const headers = this.config.adminApiKey
      ? { "X-Admin-Key": this.config.adminApiKey }
      : undefined;
    const response = await fetch(
      `${this.config.adminBaseUrl}/api/services/health`,
      {
        headers,
        signal: AbortSignal.timeout(DEFAULT_ADMIN_REQUEST_TIMEOUT_MS),
      },
    );
    if (!response.ok) {
      throw new Error(`Failed to fetch services health (${response.status})`);
    }
    return response.json();
  }
  /**
   * Fetch analytics overview
   */
  async getAnalytics() {
    const headers = this.config.adminApiKey
      ? { "X-Admin-Key": this.config.adminApiKey }
      : undefined;
    const response = await fetch(`${this.config.adminBaseUrl}/api/analytics`, {
      headers,
      signal: AbortSignal.timeout(DEFAULT_ADMIN_REQUEST_TIMEOUT_MS),
    });
    if (!response.ok) {
      throw new Error(`Failed to fetch analytics (${response.status})`);
    }
    return response.json();
  }
  /**
   * Fetch all registered MiniApps
   */
  async getMiniApps() {
    if (!this.config.serviceRoleKey) {
      throw new Error(
        "getMiniApps: serviceRoleKey is required for admin operations",
      );
    }
    const response = await fetch(
      `${this.config.supabaseUrl}/rest/v1/miniapps?select=*&order=created_at.desc`,
      {
        headers: {
          apikey: this.config.serviceRoleKey,
          Authorization: `Bearer ${this.config.serviceRoleKey}`,
        },
        signal: AbortSignal.timeout(DEFAULT_ADMIN_REQUEST_TIMEOUT_MS),
      },
    );
    if (!response.ok) {
      throw new Error(`Failed to fetch MiniApps (${response.status})`);
    }
    return response.json();
  }
  /**
   * Fetch all users
   */
  async getUsers() {
    if (!this.config.serviceRoleKey) {
      throw new Error(
        "getUsers: serviceRoleKey is required for admin operations",
      );
    }
    const response = await fetch(
      `${this.config.supabaseUrl}/rest/v1/users?select=*&order=created_at.desc`,
      {
        headers: {
          apikey: this.config.serviceRoleKey,
          Authorization: `Bearer ${this.config.serviceRoleKey}`,
        },
        signal: AbortSignal.timeout(DEFAULT_ADMIN_REQUEST_TIMEOUT_MS),
      },
    );
    if (!response.ok) {
      throw new Error(`Failed to fetch users (${response.status})`);
    }
    return response.json();
  }
  /**
   * Update MiniApp status
   */
  async updateMiniAppStatus(appId, status) {
    const headers = { "Content-Type": "application/json" };
    if (this.config.adminApiKey) {
      headers["X-Admin-Key"] = this.config.adminApiKey;
    }
    const response = await fetch(
      `${this.config.adminBaseUrl}/api/miniapps/update-status`,
      {
        method: "POST",
        headers,
        body: JSON.stringify({ appId, status }),
        signal: AbortSignal.timeout(DEFAULT_ADMIN_REQUEST_TIMEOUT_MS),
      },
    );
    if (!response.ok) {
      throw new Error(`Failed to update MiniApp status (${response.status})`);
    }
    const payload = await response.json().catch((e) => {
      console.warn(
        "[admin-sdk] failed to parse status update response JSON:",
        e instanceof Error ? e.message : String(e),
      );
      return null;
    });
    if (payload?.requires_onchain_confirmation) {
      const serialized = JSON.stringify(payload.invocation ?? {}, null, 2);
      console.warn(
        `On-chain confirmation required for status change. Submit invocation:\n${serialized}`,
      );
    }
  }
}
/**
 * Create an Admin SDK instance
 */
export function createAdminSDK(config) {
  assertServerOnly();
  return new AdminSDK(config);
}
