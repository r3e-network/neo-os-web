/**
 * EdgeClient — Standardized HTTP client for OS service edge functions.
 * Acts as the "Binder" transport layer between miniapp and OS services.
 */
export class EdgeClient {
  private readonly baseUrl: string;
  private readonly appId: string;
  private authToken: string | null = null;

  constructor(appId: string, baseUrl?: string) {
    this.appId = appId;
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
}
