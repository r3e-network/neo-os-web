// =============================================================================
// useUsers Hook Tests
// =============================================================================

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { useUsers, useUser, useSearchUsers } from "../hooks/useUsers";
import { ADMIN_API_KEY_STORAGE_KEY } from "../admin-client";
import { createWrapper, mockFetchResponse } from "./test-utils";

describe("useUsers Hooks", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    window.sessionStorage.clear();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("useUsers", () => {
    it("should fetch all users successfully", async () => {
      const mockData = [
        { id: "user1", address: "NAddr1", email: "user1@test.com" },
        { id: "user2", address: "NAddr2", email: "user2@test.com" },
      ];

      vi.spyOn(global, "fetch").mockImplementation(() => mockFetchResponse(mockData));

      const { result } = renderHook(() => useUsers(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));

      expect(result.current.data).toEqual(mockData);
      expect(global.fetch).toHaveBeenCalledWith(
        "/api/users",
        expect.objectContaining({
          credentials: "include",
          headers: {},
        }),
      );
    });

    it("attaches admin auth and same-origin credentials", async () => {
      window.sessionStorage.setItem(ADMIN_API_KEY_STORAGE_KEY, "ui-admin-key");
      const fetchMock = vi
        .spyOn(global, "fetch")
        .mockImplementation(() => mockFetchResponse([]));

      renderHook(() => useUsers(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(fetchMock).toHaveBeenCalled());
      expect(fetchMock).toHaveBeenCalledWith(
        "/api/users",
        expect.objectContaining({
          credentials: "include",
          headers: { "X-Admin-Key": "ui-admin-key" },
        }),
      );
    });

    it("should handle fetch error", async () => {
      vi.spyOn(global, "fetch").mockImplementation(() => mockFetchResponse(null, false, 500));

      const { result } = renderHook(() => useUsers(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isError).toBe(true));
    });
  });

  describe("useUser", () => {
    it("should fetch single user successfully", async () => {
      const mockData = [{ id: "user1", address: "NAddr1", email: "user1@test.com" }];

      vi.spyOn(global, "fetch").mockImplementation(() => mockFetchResponse(mockData));

      const { result } = renderHook(() => useUser("user1"), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));

      expect(result.current.data).toEqual(mockData[0]);
      expect(global.fetch).toHaveBeenCalledWith(
        "/api/users?id=user1",
        expect.objectContaining({
          credentials: "include",
          headers: {},
        }),
      );
    });

    it("attaches admin auth and same-origin credentials for a single user", async () => {
      window.sessionStorage.setItem(ADMIN_API_KEY_STORAGE_KEY, "ui-admin-key");
      const fetchMock = vi
        .spyOn(global, "fetch")
        .mockImplementation(() =>
          mockFetchResponse([
            { id: "user1", address: "NAddr1", email: "user1@test.com" },
          ]),
        );

      renderHook(() => useUser("user1"), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(fetchMock).toHaveBeenCalled());
      expect(fetchMock).toHaveBeenCalledWith(
        "/api/users?id=user1",
        expect.objectContaining({
          credentials: "include",
          headers: { "X-Admin-Key": "ui-admin-key" },
        }),
      );
    });

    it("should handle user not found", async () => {
      vi.spyOn(global, "fetch").mockImplementation(() => mockFetchResponse([]));

      const { result } = renderHook(() => useUser("unknown"), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isError).toBe(true));
    });

    it("should not fetch when userId is empty", () => {
      vi.spyOn(global, "fetch").mockImplementation(() => mockFetchResponse([]));

      const { result } = renderHook(() => useUser(""), {
        wrapper: createWrapper(),
      });

      expect(result.current.fetchStatus).toBe("idle");
      expect(global.fetch).not.toHaveBeenCalled();
    });
  });

  describe("useSearchUsers", () => {
    it("should search users successfully", async () => {
      const mockData = [{ id: "user1", address: "NAddr1", email: "user1@test.com" }];

      vi.spyOn(global, "fetch").mockImplementation(() => mockFetchResponse(mockData));

      const { result } = renderHook(() => useSearchUsers("NAddr"), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));

      expect(result.current.data).toEqual(mockData);
      expect(global.fetch).toHaveBeenCalledWith(
        "/api/users?search=NAddr",
        expect.objectContaining({
          credentials: "include",
          headers: {},
        }),
      );
    });

    it("attaches admin auth and same-origin credentials when searching users", async () => {
      window.sessionStorage.setItem(ADMIN_API_KEY_STORAGE_KEY, "ui-admin-key");
      const fetchMock = vi
        .spyOn(global, "fetch")
        .mockImplementation(() => mockFetchResponse([]));

      renderHook(() => useSearchUsers("NAddr"), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(fetchMock).toHaveBeenCalled());
      expect(fetchMock).toHaveBeenCalledWith(
        "/api/users?search=NAddr",
        expect.objectContaining({
          credentials: "include",
          headers: { "X-Admin-Key": "ui-admin-key" },
        }),
      );
    });

    it("should not search when term is empty", () => {
      vi.spyOn(global, "fetch").mockImplementation(() => mockFetchResponse([]));

      const { result } = renderHook(() => useSearchUsers(""), {
        wrapper: createWrapper(),
      });

      expect(result.current.fetchStatus).toBe("idle");
      expect(global.fetch).not.toHaveBeenCalled();
    });
  });
});
