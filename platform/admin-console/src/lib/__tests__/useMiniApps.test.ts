// =============================================================================
// useMiniApps Hook Tests
// =============================================================================

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import {
  useMiniApps,
  useMiniApp,
  useCreateMiniApp,
  useUpdateMiniApp,
  useUpdateMiniAppStatus,
  useDeleteMiniApp,
  useMiniAppVersions,
  useRollbackMiniAppVersion,
  useMiniAppPublishRequests,
  useReviewMiniAppPublishRequest,
  useTriggerPublishReminders,
  useVerifyPublishAuditChain,
} from "../hooks/useMiniApps";
import { createWrapper, mockFetchResponse } from "./test-utils";

describe("useMiniApps Hooks", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("useMiniApps", () => {
    it("should fetch all miniapps successfully", async () => {
      const mockData = [
        { app_id: "app1", name: "App 1", status: "active" },
        { app_id: "app2", name: "App 2", status: "disabled" },
      ];

      vi.spyOn(global, "fetch").mockImplementation(() => mockFetchResponse(mockData));

      const { result } = renderHook(() => useMiniApps(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));

      expect(result.current.data).toEqual(mockData);
    });

    it("should handle fetch error", async () => {
      vi.spyOn(global, "fetch").mockImplementation(() => mockFetchResponse(null, false, 500));

      const { result } = renderHook(() => useMiniApps(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isError).toBe(true));
    });
  });

  describe("useMiniApp", () => {
    it("should fetch single miniapp successfully", async () => {
      const mockData = [{ app_id: "app1", name: "App 1", status: "active" }];

      vi.spyOn(global, "fetch").mockImplementation(() => mockFetchResponse(mockData));

      const { result } = renderHook(() => useMiniApp("app1"), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));

      expect(result.current.data).toEqual(mockData[0]);
    });

    it("should handle miniapp not found", async () => {
      vi.spyOn(global, "fetch").mockImplementation(() => mockFetchResponse([]));

      const { result } = renderHook(() => useMiniApp("unknown"), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isError).toBe(true));
    });

    it("should not fetch when appId is empty", () => {
      vi.spyOn(global, "fetch").mockImplementation(() => mockFetchResponse([]));

      const { result } = renderHook(() => useMiniApp(""), {
        wrapper: createWrapper(),
      });

      expect(result.current.fetchStatus).toBe("idle");
      expect(global.fetch).not.toHaveBeenCalled();
    });
  });

  describe("mutation hooks", () => {
    it("useCreateMiniApp adds save_draft action", async () => {
      const fetchMock = vi.spyOn(global, "fetch").mockImplementation(() => mockFetchResponse({ success: true }));

      const { result } = renderHook(() => useCreateMiniApp(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.mutateAsync).toBeDefined();
      });

      await result.current.mutateAsync({
        app_id: "miniapp-create-test",
        name: "Create Test",
        entry_url: "https://example.com/create",
      });

      expect(fetchMock).toHaveBeenCalled();
      const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
      expect(url).toBe("/api/miniapps/create");
      const payload = JSON.parse(String(init.body || "{}"));
      expect(payload.action).toBe("save_draft");
      expect(payload.app_id).toBe("miniapp-create-test");
    });

    it("useCreateMiniApp preserves explicit publish action", async () => {
      const fetchMock = vi.spyOn(global, "fetch").mockImplementation(() => mockFetchResponse({ success: true }));

      const { result } = renderHook(() => useCreateMiniApp(), {
        wrapper: createWrapper(),
      });

      await result.current.mutateAsync({
        app_id: "miniapp-create-test",
        name: "Create Test",
        entry_url: "https://example.com/create",
        action: "publish",
      });

      const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
      const payload = JSON.parse(String(init.body || "{}"));
      expect(payload.action).toBe("publish");
    });

    it("useUpdateMiniApp adds app_id and save_draft action", async () => {
      const fetchMock = vi.spyOn(global, "fetch").mockImplementation(() => mockFetchResponse({ success: true }));

      const { result } = renderHook(() => useUpdateMiniApp(), {
        wrapper: createWrapper(),
      });

      await result.current.mutateAsync({
        appId: "miniapp-update-test",
        config: {
          name: "Update Test",
          entry_url: "https://example.com/update",
        },
      });

      expect(fetchMock).toHaveBeenCalled();
      const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
      expect(url).toBe("/api/miniapps/miniapp-update-test");
      const payload = JSON.parse(String(init.body || "{}"));
      expect(payload.action).toBe("save_draft");
      expect(payload.app_id).toBe("miniapp-update-test");
    });

    it("useUpdateMiniApp preserves explicit publish action", async () => {
      const fetchMock = vi.spyOn(global, "fetch").mockImplementation(() => mockFetchResponse({ success: true }));

      const { result } = renderHook(() => useUpdateMiniApp(), {
        wrapper: createWrapper(),
      });

      await result.current.mutateAsync({
        appId: "miniapp-update-test",
        config: {
          action: "publish",
          name: "Update Test",
          entry_url: "https://example.com/update",
        },
      });

      expect(fetchMock).toHaveBeenCalled();
      const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
      const payload = JSON.parse(String(init.body || "{}"));
      expect(payload.action).toBe("publish");
    });

    it("useUpdateMiniAppStatus calls update-status route", async () => {
      const fetchMock = vi.spyOn(global, "fetch").mockImplementation(() => mockFetchResponse({ success: true }));

      const { result } = renderHook(() => useUpdateMiniAppStatus(), {
        wrapper: createWrapper(),
      });

      await result.current.mutateAsync({ appId: "miniapp-status-test", status: "active" });

      expect(fetchMock).toHaveBeenCalled();
      const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
      expect(url).toBe("/api/miniapps/update-status");
      const payload = JSON.parse(String(init.body || "{}"));
      expect(payload.appId).toBe("miniapp-status-test");
      expect(payload.status).toBe("active");
    });

    it("useDeleteMiniApp uses update-status route with disabled", async () => {
      const fetchMock = vi.spyOn(global, "fetch").mockImplementation(() => mockFetchResponse({ success: true }));

      const { result } = renderHook(() => useDeleteMiniApp(), {
        wrapper: createWrapper(),
      });

      await result.current.mutateAsync("miniapp-soft-delete-test");

      expect(fetchMock).toHaveBeenCalled();
      const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
      expect(url).toBe("/api/miniapps/update-status");
      expect(init.method).toBe("POST");
      const payload = JSON.parse(String(init.body || "{}"));
      expect(payload).toEqual({ appId: "miniapp-soft-delete-test", status: "disabled" });
    });

    it("useMiniAppVersions fetches version history", async () => {
      const fetchMock = vi.spyOn(global, "fetch").mockImplementation(() =>
        mockFetchResponse({
          app_id: "miniapp-versioned",
          release_channel: "all",
          releases: { draft: null, published: null },
          versions: [
            {
              id: "a1b2c3d4-e5f6-4711-8222-aabbccddeeff",
              app_id: "miniapp-versioned",
              version_no: 3,
              release_channel: "published",
              source_action: "publish",
              status: "active",
              manifest_hash: "abc123",
              actor: "api_key",
              created_at: "2026-02-22T00:00:00.000Z",
              manifest: { app_id: "miniapp-versioned", name: "Versioned" },
              row_snapshot: { app_id: "miniapp-versioned", status: "active" },
            },
          ],
        }),
      );

      const { result } = renderHook(() => useMiniAppVersions("miniapp-versioned"), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));

      expect(fetchMock).toHaveBeenCalled();
      const [url] = fetchMock.mock.calls[0] as [string];
      expect(url).toContain("/api/miniapps/versions");
      expect(url).toContain("app_id=miniapp-versioned");
      expect(result.current.data?.versions.length).toBe(1);
    });

    it("useRollbackMiniAppVersion posts rollback request", async () => {
      const fetchMock = vi.spyOn(global, "fetch").mockImplementation(() =>
        mockFetchResponse({
          success: true,
          app: {
            app_id: "miniapp-versioned",
            developer_user_id: "123e4567-e89b-12d3-a456-426614174000",
            manifest_hash: "abc123",
            entry_url: "https://example.com/miniapp-versioned",
            developer_pubkey: "",
            permissions: {},
            limits: {},
            assets_allowed: ["GAS"],
            governance_assets_allowed: ["BNEO"],
            manifest: {},
            status: "active",
            created_at: "2026-02-22T00:00:00.000Z",
            updated_at: "2026-02-22T00:00:00.000Z",
          },
          rollback: {
            target_version_id: "a1b2c3d4-e5f6-4711-8222-aabbccddeeff",
            target_version_no: 2,
            new_version_id: "ffeeddcc-bbaa-2288-1174-6f5e4d3c2b1a",
            new_version_no: 4,
            release_channel: "published",
          },
        }),
      );

      const { result } = renderHook(() => useRollbackMiniAppVersion(), {
        wrapper: createWrapper(),
      });

      await result.current.mutateAsync({
        appId: "miniapp-versioned",
        versionId: "a1b2c3d4-e5f6-4711-8222-aabbccddeeff",
        releaseChannel: "published",
      });

      expect(fetchMock).toHaveBeenCalled();
      const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
      expect(url).toBe("/api/miniapps/rollback");
      expect(init.method).toBe("POST");
      const payload = JSON.parse(String(init.body || "{}"));
      expect(payload.app_id).toBe("miniapp-versioned");
      expect(payload.version_id).toBe("a1b2c3d4-e5f6-4711-8222-aabbccddeeff");
      expect(payload.release_channel).toBe("published");
    });

    it("useMiniAppPublishRequests fetches pending requests", async () => {
      const fetchMock = vi.spyOn(global, "fetch").mockImplementation(() =>
        mockFetchResponse({
          status: "pending",
          requests: [
            {
              id: "11111111-1111-4111-8111-111111111111",
              app_id: "miniapp-versioned",
              requested_version_id: "a1b2c3d4-e5f6-4711-8222-aabbccddeeff",
              requested_version_no: 3,
              requested_manifest_hash: "abc",
              requested_by: "api_key",
              request_note: null,
              status: "pending",
              review_note: null,
              reviewed_by: null,
              reviewed_at: null,
              applied_version_id: null,
              applied_at: null,
              requested_at: "2026-02-22T00:00:00.000Z",
              updated_at: "2026-02-22T00:00:00.000Z",
            },
          ],
        }),
      );

      const { result } = renderHook(() => useMiniAppPublishRequests({ appId: "miniapp-versioned", status: "pending" }), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));

      expect(fetchMock).toHaveBeenCalled();
      const [url] = fetchMock.mock.calls[0] as [string];
      expect(url).toContain("/api/miniapps/publish-requests");
      expect(url).toContain("app_id=miniapp-versioned");
      expect(url).toContain("status=pending");
    });

    it("useReviewMiniAppPublishRequest posts review decision", async () => {
      const fetchMock = vi.spyOn(global, "fetch").mockImplementation(() =>
        mockFetchResponse({ success: true }),
      );

      const { result } = renderHook(() => useReviewMiniAppPublishRequest(), {
        wrapper: createWrapper(),
      });

      await result.current.mutateAsync({
        requestId: "11111111-1111-4111-8111-111111111111",
        decision: "approve",
        appId: "miniapp-versioned",
      });

      expect(fetchMock).toHaveBeenCalled();
      const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
      expect(url).toBe("/api/miniapps/publish-requests");
      expect(init.method).toBe("POST");
      const payload = JSON.parse(String(init.body || "{}"));
      expect(payload.request_id).toBe("11111111-1111-4111-8111-111111111111");
      expect(payload.decision).toBe("approve");
    });

    it("useTriggerPublishReminders sends dry-run reminder trigger", async () => {
      const fetchMock = vi.spyOn(global, "fetch").mockImplementation(() =>
        mockFetchResponse({
          success: true,
          sent: 0,
          dry_run: true,
          channel: "webhook",
          reminders: [],
        }),
      );

      const { result } = renderHook(() => useTriggerPublishReminders(), {
        wrapper: createWrapper(),
      });

      await result.current.mutateAsync({ dryRun: true });

      expect(fetchMock).toHaveBeenCalled();
      const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
      expect(url).toBe("/api/miniapps/publish-requests/remind");
      expect(init.method).toBe("POST");
      const payload = JSON.parse(String(init.body || "{}"));
      expect(payload.dry_run).toBe(true);
    });

    it("useVerifyPublishAuditChain requests verification endpoint", async () => {
      const fetchMock = vi.spyOn(global, "fetch").mockImplementation(() =>
        mockFetchResponse({
          ok: true,
          scanned: 10,
          requests: 2,
          total_events: 10,
          invalid_hash_events: 0,
          chain_break_events: 0,
          table_missing: false,
          generated_at: "2026-02-22T00:00:00.000Z",
          issues: [],
        }),
      );

      const { result } = renderHook(() => useVerifyPublishAuditChain(), {
        wrapper: createWrapper(),
      });

      await result.current.mutateAsync({ appId: "miniapp-versioned", limit: 50 });

      expect(fetchMock).toHaveBeenCalled();
      const [url] = fetchMock.mock.calls[0] as [string];
      expect(url).toContain("/api/miniapps/publish-requests/verify-audit");
      expect(url).toContain("app_id=miniapp-versioned");
      expect(url).toContain("limit=50");
    });
  });
});
