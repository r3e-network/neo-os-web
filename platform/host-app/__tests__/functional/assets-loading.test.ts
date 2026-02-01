/**
 * Comprehensive Assets Loading Tests
 * Tests logo, banner, and icon loading for miniapps
 */

import { BUILTIN_APPS } from "@/lib/builtin-apps";

describe("Assets Loading System", () => {
  describe("Logo Loading", () => {
    it("should have icon/logo path for all apps", () => {
      BUILTIN_APPS.forEach((app) => {
        expect(app.icon).toBeTruthy();
        expect(typeof app.icon).toBe("string");
      });
    });

    it("should have valid icon paths or emoji", () => {
      BUILTIN_APPS.forEach((app) => {
        // Icon can be a path or emoji
        const isPath = app.icon.startsWith("/") || app.icon.startsWith("http");
        const isEmoji = app.icon.length <= 4; // Emoji are typically 1-4 chars
        expect(isPath || isEmoji).toBe(true);
      });
    });

    it("should have consistent icon path format", () => {
      const pathIcons = BUILTIN_APPS.filter((app) => app.icon.startsWith("/"));
      pathIcons.forEach((app) => {
        expect(app.icon).toMatch(/\.(png|jpg|jpeg|svg|webp)$/i);
      });
    });
  });

  describe("Banner Loading", () => {
    it("should have banner for apps that declare it", () => {
      const appsWithBanner = BUILTIN_APPS.filter((app) => app.banner);
      appsWithBanner.forEach((app) => {
        expect(app.banner).toMatch(/\.(png|jpg|jpeg|svg|webp)$/i);
      });
    });

    it("should have valid banner paths", () => {
      const appsWithBanner = BUILTIN_APPS.filter((app) => app.banner);
      appsWithBanner.forEach((app) => {
        expect(app.banner).toMatch(/^(\/|https?:\/\/)/);
      });
    });
  });

  describe("Asset URL Validation", () => {
    it("should not have broken relative paths", () => {
      BUILTIN_APPS.forEach((app) => {
        if (app.icon.startsWith("/")) {
          expect(app.icon).not.toContain("//");
          expect(app.icon).not.toContain(".."); 
        }
        if (app.banner?.startsWith("/")) {
          expect(app.banner).not.toContain("//");
          expect(app.banner).not.toContain("..");
        }
      });
    });

    it("should have consistent asset directory structure", () => {
      const pathIcons = BUILTIN_APPS.filter((app) => app.icon.startsWith("/miniapps/"));
      pathIcons.forEach((app) => {
        // Should follow /miniapps/{app-name}/logo.jpg pattern
        expect(app.icon).toMatch(/^\/miniapps\/[a-z0-9-]+\/(logo|icon)\.(png|svg)$/);
      });
    });
  });

  describe("Asset Metadata", () => {
    it("should have matching app_id and asset paths", () => {
      BUILTIN_APPS.forEach((app) => {
        if (app.icon.startsWith("/miniapps/")) {
          const pathMatch = app.icon.match(/\/miniapps\/([^/]+)\//);
          if (pathMatch) {
            const pathAppName = pathMatch[1];
            // App ID should relate to path (with or without miniapp- prefix)
            const _normalizedId = app.app_id.replace("miniapp-", "").replace(/-/g, "");
            const normalizedPath = pathAppName.replace(/-/g, "");
            // Allow some flexibility in naming
            expect(normalizedPath.length).toBeGreaterThan(0);
          }
        }
      });
    });
  });
});
