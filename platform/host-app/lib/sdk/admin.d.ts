export interface AdminSDKConfig {
    adminBaseUrl: string;
    supabaseUrl: string;
    serviceRoleKey?: string;
}
export interface ServiceHealthResponse {
    name: string;
    status: "healthy" | "unhealthy" | "unknown";
    url: string;
    lastCheck: string;
    version?: string;
    uptime?: number;
    error?: string;
}
export interface MiniAppListResponse {
    app_id: string;
    developer_user_id: string;
    manifest_hash: string;
    entry_url: string;
    status: "active" | "disabled";
    created_at: string;
    updated_at: string;
}
export interface UserListResponse {
    id: string;
    address: string;
    email?: string;
    created_at: string;
    updated_at: string;
}
export interface AnalyticsResponse {
    totalUsers: number;
    totalMiniApps: number;
    totalTransactions: number;
    gasUsageToday: number;
    usageByApp: Array<{
        app_id: string;
        total_gas: number;
        total_governance: number;
        user_count: number;
    }>;
}
/**
 * Admin SDK for platform management operations
 */
export declare class AdminSDK {
    private config;
    constructor(config: AdminSDKConfig);
    /**
     * Fetch all services health status
     */
    getServicesHealth(): Promise<ServiceHealthResponse[]>;
    /**
     * Fetch analytics overview
     */
    getAnalytics(): Promise<AnalyticsResponse>;
    /**
     * Fetch all registered MiniApps
     */
    getMiniApps(): Promise<MiniAppListResponse[]>;
    /**
     * Fetch all users
     */
    getUsers(): Promise<UserListResponse[]>;
    /**
     * Update MiniApp status
     */
    updateMiniAppStatus(appId: string, status: "active" | "disabled"): Promise<void>;
}
/**
 * Create an Admin SDK instance
 */
export declare function createAdminSDK(config: AdminSDKConfig): AdminSDK;
