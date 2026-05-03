/**
 * EdgeClient — Standardized HTTP client for OS service edge functions.
 * Acts as the "Binder" transport layer between miniapp and OS services.
 */
export class EdgeClient {
  private readonly baseUrl: string;
  private readonly appId: string;
  private readonly hasExplicitBaseUrl: boolean;
  private authToken: string | null = null;

  constructor(appId: string, baseUrl?: string) {
    this.appId = appId;
    this.hasExplicitBaseUrl = typeof baseUrl === "string" && baseUrl.length > 0;
    this.baseUrl =
      baseUrl ??
      ((typeof import.meta !== "undefined" && import.meta.env?.VITE_EDGE_URL) ||
        "/api/edge");
  }

  setAuthToken(token: string | null | undefined): void {
    this.authToken = token?.trim() || null;
  }

  async call<T = unknown>(
    endpoint: string,
    params: Record<string, unknown> = {},
  ): Promise<T> {
    if (this.shouldUseLocalPreview()) {
      return this.localPreviewResponse<T>(endpoint, params);
    }

    const url = `${this.baseUrl}/${endpoint}`;
    const body = { appId: this.appId, ...params };

    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };
    const authToken = this.authToken ?? this.readRuntimeAuthToken();
    if (authToken) {
      headers["Authorization"] = `Bearer ${authToken}`;
    }

    const res = await fetch(url, {
      method: "POST",
      headers,
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const error = await res
        .json()
        .catch(() => ({ message: res.statusText }));
      throw new Error(
        `OS service error (${endpoint}): ${error.message || res.statusText}`,
      );
    }

    const payload = await res.json();
    if (
      payload &&
      typeof payload === "object" &&
      "ok" in payload &&
      (payload as { ok?: unknown }).ok === true &&
      "data" in payload
    ) {
      return (payload as { data: T }).data;
    }
    return payload as T;
  }

  private shouldUseLocalPreview(): boolean {
    const env = typeof import.meta !== "undefined" ? import.meta.env : undefined;
    return Boolean(
      typeof window !== "undefined" &&
        this.baseUrl === "/api/edge" &&
        !this.hasExplicitBaseUrl &&
        !env?.VITE_EDGE_URL &&
        env?.DEV === true &&
        env?.MODE !== "test" &&
        !env?.VITEST,
    );
  }

  private readRuntimeAuthToken(): string | null {
    if (typeof window === "undefined") return null;
    const keys = ["sb-access-token", "neo_miniapp_auth_jwt"];
    const stores: Storage[] = [];
    try {
      if (window.sessionStorage) stores.push(window.sessionStorage);
    } catch (_err) {
      // Ignore unavailable storage.
    }
    try {
      if (window.localStorage) stores.push(window.localStorage);
    } catch (_err) {
      // Ignore unavailable storage.
    }
    for (const store of stores) {
      for (const key of keys) {
        try {
          const value = store.getItem(key)?.trim();
          if (value) return value;
        } catch (_err) {
          // Storage may be unavailable in sandboxed embeds; callers can still set an explicit token.
        }
      }
    }
    return null;
  }

  private localPreviewResponse<T>(
    endpoint: string,
    params: Record<string, unknown>,
  ): T {
    if (endpoint === "os-storage-list") return {} as T;
    if (
      endpoint === "os-storage-get" ||
      endpoint === "os-storage-read-shared"
    ) {
      return null as T;
    }
    if (
      endpoint === "os-badge-list" ||
      endpoint === "os-leaderboard-get" ||
      endpoint === "os-nft-list" ||
      endpoint === "os-vesting-list"
    ) {
      return [] as T;
    }
    if (endpoint === "os-payment-balance") return "0" as T;
    if (endpoint === "os-checkin-streak") {
      return {
        currentStreak: 0,
        highestStreak: 0,
        totalCheckins: 0,
        lastCheckinTime: 0,
        unclaimedRewards: "0",
        totalClaimed: "0",
      } as T;
    }
    if (endpoint === "os-game-status") {
      return {
        poolId: String(params.poolId ?? "local-preview"),
        appId: this.appId,
        status: "open",
        playerCount: 0,
        totalBets: "0",
      } as T;
    }

    throw new Error(`OS edge backend is not configured (${endpoint})`);
  }
}
