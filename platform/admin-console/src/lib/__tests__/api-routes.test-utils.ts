import { beforeEach, afterEach, vi } from "vitest";

export const API_KEY = "test-admin-key-123";

export function authedRequest(url: string, init?: RequestInit) {
  return new Request(url, {
    ...init,
    headers: {
      "x-admin-key": API_KEY,
      ...(init?.headers as Record<string, string>),
    },
  });
}

/** Minimal mock Response with optional content-range header. */
export function mockJsonResponse(
  body: unknown,
  {
    ok = true,
    status = 200,
    contentRange,
  }: { ok?: boolean; status?: number; contentRange?: string } = {},
) {
  const headersInit: Record<string, string> = {
    "content-type": "application/json",
  };
  if (contentRange) {
    headersInit["content-range"] = contentRange;
  }

  return Promise.resolve({
    ok,
    status,
    statusText: ok ? "OK" : "Error",
    json: () => Promise.resolve(body),
    text: () =>
      Promise.resolve(typeof body === "string" ? body : JSON.stringify(body)),
    headers: new Headers(headersInit),
  } as Response);
}

export let fetchSpy: ReturnType<typeof vi.fn>;

beforeEach(() => {
  vi.stubEnv("ADMIN_CONSOLE_API_KEY", API_KEY);
  vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "srk");
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "http://supabase.test");
  vi.stubEnv("MINIAPP_HOST_APP_BASE_URL", "http://host-app.test");
  vi.stubEnv(
    "CONTRACT_APPREGISTRY_HASH",
    "0x1111111111111111111111111111111111111111",
  );
  vi.stubEnv("MINIAPP_PUBLISH_APPROVAL_REQUIRED", "true");
  fetchSpy = vi.fn();
  vi.stubGlobal("fetch", fetchSpy);
  vi.resetModules();
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

// Dynamic import helper: call after env vars are set so admin auth picks up the key at module evaluation time.
export async function importRoute<T>(path: string): Promise<T> {
  return (await import(path)) as T;
}

export function routeParams(id: string): Promise<{ id: string }> {
  return Promise.resolve({ id });
}
