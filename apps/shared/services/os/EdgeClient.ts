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

  setAuthToken(token: string): void {
    this.authToken = token;
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
    if (this.authToken) {
      headers["Authorization"] = `Bearer ${this.authToken}`;
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

    return res.json() as Promise<T>;
  }
}
