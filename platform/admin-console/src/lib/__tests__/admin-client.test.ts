import { beforeEach, describe, expect, it } from "vitest";
import {
  ADMIN_API_KEY_STORAGE_KEY,
  getAdminAuthHeaders,
  getStoredAdminApiKey,
  setStoredAdminApiKey,
} from "@/lib/admin-client";

describe("admin-client", () => {
  beforeEach(() => {
    window.sessionStorage.clear();
  });

  it("keeps the operator key in session storage and returns an admin header", () => {
    setStoredAdminApiKey("  local-admin-key  ");

    expect(getStoredAdminApiKey()).toBe("local-admin-key");
    expect(window.sessionStorage.getItem(ADMIN_API_KEY_STORAGE_KEY)).toBe(
      "local-admin-key",
    );
    expect(getAdminAuthHeaders()).toEqual({
      "X-Admin-Key": "local-admin-key",
    });
  });

  it("omits admin headers when no operator key is present", () => {
    setStoredAdminApiKey("");

    expect(getStoredAdminApiKey()).toBe("");
    expect(getAdminAuthHeaders()).toEqual({});
  });
});
