/** @jest-environment node */

/**
 * Memory Cache Tests
 */

import { apiCache, CACHE_TTL } from "@/lib/cache/memory";

describe("MemoryCache", () => {
  afterEach(() => {
    apiCache.clear();
  });

  afterAll(() => {
    apiCache.destroy();
  });

  describe("get/set", () => {
    it("should store and retrieve a value", () => {
      apiCache.set("key1", { data: "hello" }, CACHE_TTL.SHORT);
      expect(apiCache.get("key1")).toEqual({ data: "hello" });
    });

    it("should return null for missing key", () => {
      expect(apiCache.get("nonexistent")).toBeNull();
    });

    it("should store different types", () => {
      apiCache.set("str", "text", CACHE_TTL.SHORT);
      apiCache.set("num", 42, CACHE_TTL.SHORT);
      apiCache.set("arr", [1, 2, 3], CACHE_TTL.SHORT);
      apiCache.set("bool", true, CACHE_TTL.SHORT);

      expect(apiCache.get("str")).toBe("text");
      expect(apiCache.get("num")).toBe(42);
      expect(apiCache.get("arr")).toEqual([1, 2, 3]);
      expect(apiCache.get("bool")).toBe(true);
    });

    it("should overwrite existing key", () => {
      apiCache.set("key", "first", CACHE_TTL.SHORT);
      apiCache.set("key", "second", CACHE_TTL.SHORT);
      expect(apiCache.get("key")).toBe("second");
    });
  });

  describe("TTL expiration", () => {
    it("should return null for expired entry", () => {
      const now = Date.now();
      jest.spyOn(Date, "now").mockReturnValueOnce(now);

      apiCache.set("expiring", "value", 100);

      // Advance time past TTL
      jest.spyOn(Date, "now").mockReturnValue(now + 200);

      expect(apiCache.get("expiring")).toBeNull();

      jest.restoreAllMocks();
    });

    it("should return value before TTL expires", () => {
      const now = Date.now();
      jest.spyOn(Date, "now").mockReturnValueOnce(now);

      apiCache.set("alive", "value", 1000);

      jest.spyOn(Date, "now").mockReturnValue(now + 500);

      expect(apiCache.get("alive")).toBe("value");

      jest.restoreAllMocks();
    });
  });

  describe("delete", () => {
    it("should remove a specific key", () => {
      apiCache.set("a", 1, CACHE_TTL.SHORT);
      apiCache.set("b", 2, CACHE_TTL.SHORT);

      apiCache.delete("a");

      expect(apiCache.get("a")).toBeNull();
      expect(apiCache.get("b")).toBe(2);
    });

    it("should not throw when deleting nonexistent key", () => {
      expect(() => apiCache.delete("ghost")).not.toThrow();
    });
  });

  describe("clear", () => {
    it("should remove all entries", () => {
      apiCache.set("x", 1, CACHE_TTL.SHORT);
      apiCache.set("y", 2, CACHE_TTL.SHORT);

      apiCache.clear();

      expect(apiCache.get("x")).toBeNull();
      expect(apiCache.get("y")).toBeNull();
    });
  });

  describe("CACHE_TTL constants", () => {
    it("should have correct TTL values", () => {
      expect(CACHE_TTL.SHORT).toBe(30_000);
      expect(CACHE_TTL.MEDIUM).toBe(300_000);
      expect(CACHE_TTL.LONG).toBe(1_800_000);
    });
  });
});
