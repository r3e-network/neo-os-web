/**
 * @jest-environment node
 */
import { apiCache, CACHE_TTL } from "@/lib/cache/memory";

describe("Memory Cache", () => {
  beforeEach(() => {
    apiCache.clear();
  });

  it("stores and retrieves values", () => {
    apiCache.set("key1", { data: "test" }, CACHE_TTL.SHORT);
    expect(apiCache.get("key1")).toEqual({ data: "test" });
  });

  it("returns null for missing keys", () => {
    expect(apiCache.get("nonexistent")).toBeNull();
  });

  it("deletes values", () => {
    apiCache.set("key1", "value", CACHE_TTL.SHORT);
    apiCache.delete("key1");
    expect(apiCache.get("key1")).toBeNull();
  });
});
