/**
 * Tests for unified /app/[id] page
 * Note: Full component tests require mocking miniapp-sdk ESM module
 * These tests focus on getServerSideProps behavior
 */

// Mock the ESM modules that Jest can't handle
jest.mock("../../lib/miniapp-sdk", () => ({
  installMiniAppSDK: jest.fn(() => ({})),
}));

jest.mock("../../components/features/miniapp/MiniAppViewer", () => ({
  MiniAppViewer: () => null,
}));

import { getServerSideProps } from "../../pages/app/[id]";

// Mock fetch for SSR tests
const mockFetch = jest.fn();
global.fetch = mockFetch;

describe("/app/[id] Page", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockFetch.mockReset();
  });

  describe("getServerSideProps", () => {
    it("should return app data for builtin app", async () => {
      // Mock successful API responses
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ stats: [] }),
      });

      const context = {
        params: { id: "miniapp-lottery" },
        req: { headers: { host: "localhost:3000" } },
      } as { params: { id: string }; req: { headers: { host: string } } };

      const result = await getServerSideProps(context);

      expect(result).toHaveProperty("props");
      expect((result as { props: { app: { app_id: string } } }).props.app).toBeTruthy();
      expect((result as { props: { app: { app_id: string } } }).props.app.app_id).toBe("miniapp-lottery");
    });

    it("should return error for unknown app", async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ stats: [] }),
      });

      const context = {
        params: { id: "unknown-app-xyz" },
        req: { headers: { host: "localhost:3000" } },
      } as { params: { id: string }; req: { headers: { host: string } } };

      const result = await getServerSideProps(context);

      expect(result).toHaveProperty("props");
      expect((result as { props: { app: null } }).props.app).toBeNull();
      expect((result as { props: { error: string } }).props.error).toBe("App not found");
    });

    it("should handle API errors gracefully", async () => {
      mockFetch.mockRejectedValue(new Error("Network error"));

      const context = {
        params: { id: "miniapp-coinflip" },
        req: { headers: { host: "localhost:3000" } },
      } as { params: { id: string }; req: { headers: { host: string } } };

      const result = await getServerSideProps(context);

      // Should still return builtin app data even if API fails
      expect(result).toHaveProperty("props");
    });

    it("should include notifications in props", async () => {
      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({ stats: [] }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: () =>
            Promise.resolve({
              notifications: [{ id: "1", title: "Test" }],
            }),
        });

      const context = {
        params: { id: "miniapp-lottery" },
        req: { headers: { host: "localhost:3000" } },
      } as { params: { id: string }; req: { headers: { host: string } } };

      const result = await getServerSideProps(context);

      expect((result as { props: { notifications: unknown[] } }).props.notifications).toBeDefined();
    });

    it("should handle null response from APIs", async () => {
      mockFetch.mockResolvedValue(null);

      const context = {
        params: { id: "miniapp-lottery" },
        req: { headers: { host: "localhost:3000" } },
      } as { params: { id: string }; req: { headers: { host: string } } };

      const result = await getServerSideProps(context);

      expect(result).toHaveProperty("props");
      expect((result as { props: { app: { app_id: string } } }).props.app).toBeTruthy();
    });

    it("should handle non-ok API responses", async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        status: 500,
      });

      const context = {
        params: { id: "miniapp-lottery" },
        req: { headers: { host: "localhost:3000" } },
      } as { params: { id: string }; req: { headers: { host: string } } };

      const result = await getServerSideProps(context);

      expect(result).toHaveProperty("props");
    });

    it("should handle stats as direct array response", async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve([{ app_id: "miniapp-lottery", users: 100 }]),
      });

      const context = {
        params: { id: "miniapp-lottery" },
        req: { headers: { host: "localhost:3000" } },
      } as { params: { id: string }; req: { headers: { host: string } } };

      const result = await getServerSideProps(context);

      expect(result).toHaveProperty("props");
      expect((result as { props: { app: { app_id: string } } }).props.app).toBeTruthy();
    });

    it("should handle stats as object with stats property", async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ stats: [{ app_id: "miniapp-lottery", users: 100 }] }),
      });

      const context = {
        params: { id: "miniapp-lottery" },
        req: { headers: { host: "localhost:3000" } },
      } as { params: { id: string }; req: { headers: { host: string } } };

      const result = await getServerSideProps(context);

      expect(result).toHaveProperty("props");
      expect((result as { props: { stats: { app_id: string } } }).props.stats).toBeTruthy();
    });

    it("should handle missing protocol in host header", async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ stats: [] }),
      });

      const context = {
        params: { id: "miniapp-lottery" },
        req: { headers: { host: "localhost:3000" } },
      } as { params: { id: string }; req: { headers: { host: string } } };

      const result = await getServerSideProps(context);

      expect(result).toHaveProperty("props");
    });

    it("should handle API error with JSON parse failure", async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.reject(new Error("Invalid JSON")),
      });

      const context = {
        params: { id: "miniapp-lottery" },
        req: { headers: { host: "localhost:3000" } },
      } as { params: { id: string }; req: { headers: { host: string } } };

      const result = await getServerSideProps(context);

      expect(result).toHaveProperty("props");
    });

    it("should handle single stat object response", async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ app_id: "miniapp-lottery", users: 100 }),
      });

      const context = {
        params: { id: "miniapp-lottery" },
        req: { headers: { host: "localhost:3000" } },
      } as { params: { id: string }; req: { headers: { host: string } } };

      const result = await getServerSideProps(context);

      expect(result).toHaveProperty("props");
      expect((result as { props: { app: { app_id: string } } }).props.app).toBeTruthy();
    });
  });
});
