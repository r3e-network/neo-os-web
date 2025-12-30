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
        const response = await fetch(`${this.config.adminBaseUrl}/api/services/health`);
        if (!response.ok) {
            throw new Error(`Failed to fetch services health: ${response.statusText}`);
        }
        return response.json();
    }
    /**
     * Fetch analytics overview
     */
    async getAnalytics() {
        const response = await fetch(`${this.config.adminBaseUrl}/api/analytics`);
        if (!response.ok) {
            throw new Error(`Failed to fetch analytics: ${response.statusText}`);
        }
        return response.json();
    }
    /**
     * Fetch all registered MiniApps
     */
    async getMiniApps() {
        const response = await fetch(`${this.config.supabaseUrl}/rest/v1/miniapps?select=*&order=created_at.desc`, {
            headers: {
                apikey: this.config.serviceRoleKey || "",
                Authorization: `Bearer ${this.config.serviceRoleKey || ""}`,
            },
        });
        if (!response.ok) {
            throw new Error(`Failed to fetch MiniApps: ${response.statusText}`);
        }
        return response.json();
    }
    /**
     * Fetch all users
     */
    async getUsers() {
        const response = await fetch(`${this.config.supabaseUrl}/rest/v1/users?select=*&order=created_at.desc`, {
            headers: {
                apikey: this.config.serviceRoleKey || "",
                Authorization: `Bearer ${this.config.serviceRoleKey || ""}`,
            },
        });
        if (!response.ok) {
            throw new Error(`Failed to fetch users: ${response.statusText}`);
        }
        return response.json();
    }
    /**
     * Update MiniApp status
     */
    async updateMiniAppStatus(appId, status) {
        const response = await fetch(`${this.config.supabaseUrl}/rest/v1/miniapps?app_id=eq.${appId}`, {
            method: "PATCH",
            headers: {
                apikey: this.config.serviceRoleKey || "",
                Authorization: `Bearer ${this.config.serviceRoleKey || ""}`,
                "Content-Type": "application/json",
            },
            body: JSON.stringify({ status }),
        });
        if (!response.ok) {
            throw new Error(`Failed to update MiniApp status: ${response.statusText}`);
        }
    }
}
/**
 * Create an Admin SDK instance
 */
export function createAdminSDK(config) {
    return new AdminSDK(config);
}
