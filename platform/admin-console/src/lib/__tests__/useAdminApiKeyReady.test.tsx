import { renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  ADMIN_API_KEY_STORAGE_KEY,
  setStoredAdminApiKey,
} from "@/lib/admin-client";
import { useAdminApiKeyReady } from "../hooks/useAdminApiKeyReady";

describe("useAdminApiKeyReady", () => {
  beforeEach(() => {
    window.sessionStorage.clear();
    vi.restoreAllMocks();
  });

  it("tracks whether an admin key is present in this tab", async () => {
    const { result } = renderHook(() => useAdminApiKeyReady());

    expect(result.current).toBe(false);

    setStoredAdminApiKey("local-admin-key");

    await waitFor(() => expect(result.current).toBe(true));
    expect(window.sessionStorage.getItem(ADMIN_API_KEY_STORAGE_KEY)).toBe(
      "local-admin-key",
    );

    setStoredAdminApiKey("");

    await waitFor(() => expect(result.current).toBe(false));
  });
});
