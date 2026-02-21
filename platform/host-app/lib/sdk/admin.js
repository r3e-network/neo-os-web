// =============================================================================
// Admin SDK - Administrative API client for platform management
// =============================================================================
/**
 * Admin SDK for platform management operations
 */
export class AdminSDK {
    config;
    constructor(config) {
        this.config = config;
    }
    /**
     * Fetch all services health status
     */
    async getServicesHealth() {
        const headers = this.config.adminApiKey ? { "X-Admin-Key": this.config.adminApiKey } : undefined;
        const response = await fetch(`${this.config.adminBaseUrl}/api/services/health`, { headers });
        if (!response.ok) {
            throw new Error(`Failed to fetch services health: ${response.statusText}`);
        }
        return response.json();
    }
    /**
     * Fetch analytics overview
     */
    async getAnalytics() {
        const headers = this.config.adminApiKey ? { "X-Admin-Key": this.config.adminApiKey } : undefined;
        const response = await fetch(`${this.config.adminBaseUrl}/api/analytics`, { headers });
        if (!response.ok) {
            throw new Error(`Failed to fetch analytics: ${response.statusText}`);
        }
        return response.json();
    }
    /**
     * Fetch all registered MiniApps
     */
    async getMiniApps() {
        const headers = this.config.adminApiKey ? { "X-Admin-Key": this.config.adminApiKey } : undefined;
        const response = await fetch(`${this.config.adminBaseUrl}/api/miniapps`, { headers });
        if (!response.ok) {
            throw new Error(`Failed to fetch MiniApps: ${response.statusText}`);
        }
        return response.json();
    }
    /**
     * Fetch all users
     */
    async getUsers() {
        const headers = this.config.adminApiKey ? { "X-Admin-Key": this.config.adminApiKey } : undefined;
        const response = await fetch(`${this.config.adminBaseUrl}/api/users`, { headers });
        if (!response.ok) {
            throw new Error(`Failed to fetch users: ${response.statusText}`);
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
        const response = await fetch(`${this.config.adminBaseUrl}/api/miniapps/update-status`, {
            method: "POST",
            headers,
            body: JSON.stringify({ appId, status }),
        });
        if (!response.ok) {
            throw new Error(`Failed to update MiniApp status: ${response.statusText}`);
        }
        const payload = await response.json().catch(() => null);
        if (payload?.requires_onchain_confirmation) {
            console.warn(`On-chain confirmation required for status change. Submit invocation:\n${JSON.stringify(payload.invocation ?? {}, null, 2)}`);
        }
    }
}
/**
 * Create an Admin SDK instance
 */
export function createAdminSDK(config) {
    return new AdminSDK(config);
}
