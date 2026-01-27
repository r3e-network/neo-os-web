/**
 * Search Functionality Tests
 * Tests search API and filtering
 */

import { createMocks } from "node-mocks-http";
import type { NextApiRequest, NextApiResponse } from "next";
import handler from "@/pages/api/miniapps/search";

describe("Search System", () => {
  describe("Search API", () => {
    it("should return results for valid query", async () => {
      const { req, res } = createMocks<NextApiRequest, NextApiResponse>({
        method: "GET",
        query: { q: "game" },
      });

      await handler(req, res);

      expect(res._getStatusCode()).toBe(200);
      const data = JSON.parse(res._getData());
      expect(data.results).toBeDefined();
      expect(Array.isArray(data.results)).toBe(true);
    });

    it("should return empty for empty query", async () => {
      const { req, res } = createMocks<NextApiRequest, NextApiResponse>({
        method: "GET",
        query: { q: "" },
      });

      await handler(req, res);

      expect(res._getStatusCode()).toBe(200);
      const data = JSON.parse(res._getData());
      expect(data.results).toEqual([]);
    });

    it("should filter by category", async () => {
      const { req, res } = createMocks<NextApiRequest, NextApiResponse>({
        method: "GET",
        query: { q: "app", category: "defi" },
      });

      await handler(req, res);

      expect(res._getStatusCode()).toBe(200);
      const data = JSON.parse(res._getData());
      data.results.forEach((r: any) => {
        expect(r.category).toBe("defi");
      });
    });

    it("should respect limit parameter", async () => {
      const { req, res } = createMocks<NextApiRequest, NextApiResponse>({
        method: "GET",
        query: { q: "neo", limit: "3" },
      });

      await handler(req, res);

      expect(res._getStatusCode()).toBe(200);
      const data = JSON.parse(res._getData());
      expect(data.results.length).toBeLessThanOrEqual(3);
    });

    it("should return suggestions", async () => {
      const { req, res } = createMocks<NextApiRequest, NextApiResponse>({
        method: "GET",
        query: { q: "" },
      });

      await handler(req, res);

      const data = JSON.parse(res._getData());
      expect(data.suggestions).toBeDefined();
      expect(Array.isArray(data.suggestions)).toBe(true);
    });
  });
});
