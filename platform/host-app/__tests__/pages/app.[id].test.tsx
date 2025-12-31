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
      } as any;

      const result = await getServerSideProps(context);

      expect(result).toHaveProperty("props");
      expect((result as any).props.app).toBeTruthy();
      expect((result as any).props.app.app_id).toBe("miniapp-lottery");
    });

    it("should return error for unknown app", async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ stats: [] }),
      });

      const context = {
        params: { id: "unknown-app-xyz" },
        req: { headers: { host: "localhost:3000" } },
      } as any;

      const result = await getServerSideProps(context);

      expect(result).toHaveProperty("props");
      expect((result as any).props.app).toBeNull();
      expect((result as any).props.error).toBe("App not found");
    });

    it("should handle API errors gracefully", async () => {
      mockFetch.mockRejectedValue(new Error("Network error"));

      const context = {
        params: { id: "miniapp-coinflip" },
        req: { headers: { host: "localhost:3000" } },
      } as any;

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
      } as any;

      const result = await getServerSideProps(context);

      expect((result as any).props.notifications).toBeDefined();
    });
  });
});
