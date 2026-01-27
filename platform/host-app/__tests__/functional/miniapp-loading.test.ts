/**
 * Comprehensive MiniApp Loading Tests
 * Tests app registry, metadata loading, and app resolution
 */

import { BUILTIN_APPS, BUILTIN_APPS_MAP, getBuiltinApp } from "@/lib/builtin-apps";
import { coerceMiniAppInfo, parseFederatedEntryUrl, buildMiniAppEntryUrl } from "@/lib/miniapp";
import type { MiniAppInfo } from "@/components/types";

describe("MiniApp Loading System", () => {
  describe("App Registry", () => {
    it("should load all builtin apps from registry", () => {
      expect(BUILTIN_APPS).toBeDefined();
      expect(Array.isArray(BUILTIN_APPS)).toBe(true);
      expect(BUILTIN_APPS.length).toBeGreaterThan(0);
    });

    it("should have unique app_ids for all apps", () => {
      const ids = BUILTIN_APPS.map((app) => app.app_id);
      const uniqueIds = new Set(ids);
      expect(uniqueIds.size).toBe(ids.length);
    });

    it("should have valid categories for all apps", () => {
      const validCategories = ["gaming", "defi", "social", "nft", "governance", "utility"];
      BUILTIN_APPS.forEach((app) => {
        expect(validCategories).toContain(app.category);
      });
    });

    it("should have apps in each category", () => {
      const categories = new Set(BUILTIN_APPS.map((app) => app.category));
      expect(categories.size).toBeGreaterThanOrEqual(3);
    });
  });

  describe("App Metadata Loading", () => {
    it("should have required fields for all apps", () => {
      BUILTIN_APPS.forEach((app) => {
        expect(app.app_id).toBeTruthy();
        expect(app.name).toBeTruthy();
        expect(app.entry_url).toBeTruthy();
        expect(app.category).toBeTruthy();
      });
    });

    it("should have valid entry URLs", () => {
      BUILTIN_APPS.forEach((app) => {
        expect(app.entry_url).toMatch(/^(\/|mf:\/\/|https?:\/\/)/);
      });
    });

    it("should have description for all apps", () => {
      BUILTIN_APPS.forEach((app) => {
        expect(typeof app.description).toBe("string");
      });
    });

    it("should have icon for all apps", () => {
      BUILTIN_APPS.forEach((app) => {
        expect(app.icon).toBeTruthy();
      });
    });

    it("should have permissions object for all apps", () => {
      BUILTIN_APPS.forEach((app) => {
        expect(app.permissions).toBeDefined();
        expect(typeof app.permissions?.payments).toBe("boolean");
        expect(typeof app.permissions?.governance).toBe("boolean");
      });
    });
  });

  describe("App Lookup", () => {
    it("should find app by full ID", () => {
      const firstApp = BUILTIN_APPS[0];
      const found = getBuiltinApp(firstApp.app_id);
      expect(found).toBeDefined();
      expect(found?.app_id).toBe(firstApp.app_id);
    });

    it("should find app by short ID", () => {
      // Apps with miniapp- prefix should be findable by short ID
      const appWithPrefix = BUILTIN_APPS.find((a) => a.app_id.startsWith("miniapp-"));
      if (appWithPrefix) {
        const shortId = appWithPrefix.app_id.replace("miniapp-", "");
        const found = getBuiltinApp(shortId);
        expect(found).toBeDefined();
      }
    });

    it("should return undefined for non-existent app", () => {
      const found = getBuiltinApp("non-existent-app-id-12345");
      expect(found).toBeUndefined();
    });

    it("should have consistent lookup via map", () => {
      BUILTIN_APPS.forEach((app) => {
        expect(BUILTIN_APPS_MAP[app.app_id]).toBe(app);
      });
    });
  });

  describe("MiniApp Info Coercion", () => {
    it("should coerce valid app data", () => {
      const raw = {
        app_id: "test-app",
        name: "Test App",
        entry_url: "/test/index.html",
        category: "utility",
      };
      const result = coerceMiniAppInfo(raw);
      expect(result).not.toBeNull();
      expect(result?.app_id).toBe("test-app");
      expect(result?.name).toBe("Test App");
    });

    it("should reject app without app_id", () => {
      const raw = { name: "Test", entry_url: "/test.html" };
      const result = coerceMiniAppInfo(raw);
      expect(result).toBeNull();
    });

    it("should reject app without entry_url", () => {
      const raw = { app_id: "test", name: "Test" };
      const result = coerceMiniAppInfo(raw);
      expect(result).toBeNull();
    });

    it("should reject unsafe entry URLs", () => {
      const raw = { app_id: "test", entry_url: "javascript:alert(1)" };
      const result = coerceMiniAppInfo(raw);
      expect(result).toBeNull();
    });

    it("should normalize category to valid value", () => {
      const raw = { app_id: "test", entry_url: "/test.html", category: "invalid" };
      const result = coerceMiniAppInfo(raw);
      expect(result?.category).toBe("utility");
    });

    it("should handle Chinese translations", () => {
      const raw = {
        app_id: "test",
        entry_url: "/test.html",
        name: "Test",
        name_zh: "测试",
        description_zh: "测试描述",
      };
      const result = coerceMiniAppInfo(raw);
      expect(result?.name_zh).toBe("测试");
      expect(result?.description_zh).toBe("测试描述");
    });
  });

  describe("Federated Entry URL Parsing", () => {
    it("should parse mf:// URLs", () => {
      const result = parseFederatedEntryUrl("mf://builtin?app=test", "fallback");
      expect(result).not.toBeNull();
      expect(result?.remote).toBe("builtin");
      expect(result?.appId).toBe("test");
    });

    it("should use fallback appId when not in URL", () => {
      const result = parseFederatedEntryUrl("mf://builtin", "fallback-app");
      expect(result?.appId).toBe("fallback-app");
    });

    it("should return null for non-mf URLs", () => {
      const result = parseFederatedEntryUrl("/local/path.html", "fallback");
      expect(result).toBeNull();
    });

    it("should parse view parameter", () => {
      const result = parseFederatedEntryUrl("mf://remote?app=test&view=main", "fallback");
      expect(result?.view).toBe("main");
    });
  });

  describe("Entry URL Building", () => {
    it("should add query parameters", () => {
      const result = buildMiniAppEntryUrl("/app/index.html", { chain: "neo-n3-mainnet" });
      expect(result).toContain("chain=neo-n3-mainnet");
    });

    it("should preserve existing query parameters", () => {
      const result = buildMiniAppEntryUrl("/app/index.html?existing=value", { new: "param" });
      expect(result).toContain("existing=value");
      expect(result).toContain("new=param");
    });

    it("should preserve hash fragments", () => {
      const result = buildMiniAppEntryUrl("/app/index.html#section", { param: "value" });
      expect(result).toContain("#section");
      expect(result).toContain("param=value");
    });
  });
});
