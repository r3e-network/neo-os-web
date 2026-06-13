// =============================================================================
// Tests for Template Studio helper functions (shared by templates/page.tsx)
// =============================================================================

import { describe, it, expect } from "vitest";
import {
  asObject,
  buildMiniAppInstallDraft,
  formatDateTime,
  kindBadgeVariant,
  parseJSONObject,
  parseManifest,
  parseTemplateId,
  requestBadgeVariant,
  sourceBadgeVariant,
  stringifyManifest,
} from "../lib/template-studio-helpers";
import type { TemplateCatalogItem } from "@/lib/hooks/useMiniApps";

describe("template-studio-helpers", () => {
  describe("asObject", () => {
    it("returns the value when it is a plain object", () => {
      expect(asObject({ a: 1 })).toEqual({ a: 1 });
    });

    it("returns an empty object for arrays, null, and primitives", () => {
      expect(asObject([1, 2])).toEqual({});
      expect(asObject(null)).toEqual({});
      expect(asObject("x")).toEqual({});
      expect(asObject(undefined)).toEqual({});
    });
  });

  describe("parseManifest", () => {
    it("parses a JSON manifest object", () => {
      expect(parseManifest('{"template":{"id":"x"}}', "json")).toEqual({
        template: { id: "x" },
      });
    });

    it("parses a YAML manifest object", () => {
      expect(parseManifest("template:\n  id: x\n", "yaml")).toEqual({
        template: { id: "x" },
      });
    });

    it("throws when the manifest is empty", () => {
      expect(() => parseManifest("   ", "json")).toThrow(
        "Template manifest is required",
      );
    });

    it("throws when a JSON manifest is not an object", () => {
      expect(() => parseManifest("[1,2]", "json")).toThrow(
        "Manifest must be an object",
      );
    });

    it("throws when a YAML manifest does not resolve to an object", () => {
      expect(() => parseManifest("- 1\n- 2\n", "yaml")).toThrow(
        "YAML manifest must resolve to an object",
      );
    });
  });

  describe("parseJSONObject", () => {
    it("returns an empty object for empty input", () => {
      expect(parseJSONObject("", "schema")).toEqual({});
    });

    it("parses a JSON object", () => {
      expect(parseJSONObject('{"a":1}', "schema")).toEqual({ a: 1 });
    });

    it("throws a field-scoped error for non-object JSON", () => {
      expect(() => parseJSONObject("[1]", "schema")).toThrow(
        "schema parse error: schema must be a JSON object",
      );
    });

    it("throws a field-scoped error for invalid JSON", () => {
      expect(() => parseJSONObject("{not json", "ui_schema")).toThrow(
        /ui_schema parse error:/,
      );
    });
  });

  describe("parseTemplateId", () => {
    it("lowercases and trims a valid id", () => {
      expect(parseTemplateId("  My-Template.v1 ")).toBe("my-template.v1");
    });

    it("throws on an invalid id", () => {
      expect(() => parseTemplateId("-bad")).toThrow(/invalid template_id/);
      expect(() => parseTemplateId("has space")).toThrow(/invalid template_id/);
    });
  });

  describe("formatDateTime", () => {
    it("formats a valid ISO timestamp", () => {
      const formatted = formatDateTime("2026-06-13T12:00:00.000Z");
      expect(formatted).toContain("2026");
      expect(formatted).not.toBe("-");
    });

    it("returns the original value for an unparseable timestamp", () => {
      expect(formatDateTime("not-a-date")).toBe("not-a-date");
    });

    it("returns a dash for an empty value", () => {
      expect(formatDateTime("")).toBe("-");
    });
  });

  describe("badge variants", () => {
    it("maps source types to badge variants", () => {
      expect(sourceBadgeVariant("verified")).toBe("success");
      expect(sourceBadgeVariant("miniapp")).toBe("info");
      expect(sourceBadgeVariant("community")).toBe("default");
    });

    it("maps template kinds to badge variants", () => {
      expect(kindBadgeVariant("contract")).toBe("warning");
      expect(kindBadgeVariant("frontend")).toBe("info");
    });

    it("maps request statuses to badge variants", () => {
      expect(requestBadgeVariant("pending")).toBe("warning");
      expect(requestBadgeVariant("approved")).toBe("success");
      expect(requestBadgeVariant("rejected")).toBe("danger");
      expect(requestBadgeVariant("cancelled")).toBe("default");
    });
  });

  describe("stringifyManifest", () => {
    it("pretty-prints a manifest with two-space indentation", () => {
      expect(stringifyManifest({ a: 1 })).toBe('{\n  "a": 1\n}');
    });
  });

  describe("buildMiniAppInstallDraft", () => {
    it("builds a frontend draft with params and template metadata", () => {
      const item: TemplateCatalogItem = {
        template_id: "frontend-app",
        template_kind: "frontend",
        version: "2.0.0",
        name: "Frontend App",
        description: "A frontend template",
        category: "utility",
        tags: ["alpha", "beta"],
        manifest: {
          frontend_template: {
            template_id: "frontend-app",
            version: "2.1.0",
            params: { theme: "dark" },
          },
        },
      } as unknown as TemplateCatalogItem;

      const draft = buildMiniAppInstallDraft(item);

      expect(draft.source).toBe("template_studio");
      expect(draft.template_kind).toBe("frontend");
      expect(draft.template_id).toBe("frontend-app");
      expect(draft.version).toBe("2.1.0");
      expect(draft.name).toBe("Frontend App");
      expect(draft.tags).toEqual(["alpha", "beta"]);
      expect(draft.params).toEqual({ theme: "dark" });
      expect(draft.factory_template_ref).toBeUndefined();
      expect(typeof draft.installed_at).toBe("string");
    });

    it("builds a contract draft with factory + schema fields", () => {
      const item: TemplateCatalogItem = {
        template_id: "contract-app",
        template_kind: "contract",
        version: "1.0.0",
        manifest: {
          contract_template: {
            factory_template_ref: "factory.ref",
            init_params: { owner: "addr" },
            init_schema: { type: "object" },
            method_schema: { transfer: {} },
            security_profile: { sandboxed: true },
            requires_host_capability: ["wallet", "", "storage"],
            min_factory_version: "1.0.0",
          },
        },
      } as unknown as TemplateCatalogItem;

      const draft = buildMiniAppInstallDraft(item);

      expect(draft.template_kind).toBe("contract");
      expect(draft.factory_template_ref).toBe("factory.ref");
      expect(draft.init_params).toEqual({ owner: "addr" });
      expect(draft.init_schema).toEqual({ type: "object" });
      expect(draft.method_schema).toEqual({ transfer: {} });
      expect(draft.security_profile).toEqual({ sandboxed: true });
      expect(draft.requires_host_capability).toEqual(["wallet", "storage"]);
      expect(draft.min_factory_version).toBe("1.0.0");
      expect(draft.max_factory_version).toBeUndefined();
      expect(draft.params).toBeUndefined();
    });
  });
});
