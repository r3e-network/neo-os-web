/**
 * S11 permissions spec (framework-extraction plan §2/S11).
 *
 * Covers: manifest-sourced grants (string list + PlatformPermissions-style
 * boolean records) delivered via the launch context dep, the
 * undeclared-→-unrestricted degradation lane, and require() throwing a
 * FrameworkPermissionError that stays on the consolidated MiniAppError
 * hierarchy (S0) with a localizable user message.
 */

import { describe, expect, it } from "vitest";
import {
  FrameworkPermissionError,
  PLATFORM_INVOKE_PERMISSIONS,
  createPermissionsSurface,
} from "../permissions";
import { MiniAppError, isMiniAppError } from "../utils/errors";

describe("S11 app.permissions", () => {
  it("publishes distinct grants for every shared platform module", () => {
    expect(PLATFORM_INVOKE_PERMISSIONS).toEqual({
      registry: "invoke:platform-registry",
      game: "invoke:platform-game",
      social: "invoke:platform-social",
      anchor: "invoke:platform-anchor",
      defi: "invoke:platform-defi",
      vesting: "invoke:platform-vesting",
      escrow: "invoke:platform-escrow",
      factory: "invoke:platform-factory",
    });
    expect(new Set(Object.values(PLATFORM_INVOKE_PERMISSIONS)).size).toBe(8);
    expect(Object.values(PLATFORM_INVOKE_PERMISSIONS)).not.toContain("invoke:primary");
  });

  it("lists string-array declarations trimmed and de-duplicated, in order", () => {
    const permissions = createPermissionsSurface({
      permissions: [" invoke:primary ", "oracle:request", "invoke:primary", "", "  "],
    });

    expect(permissions.list()).toEqual(["invoke:primary", "oracle:request"]);
  });

  it("lists only the truthy flags of a manifest PlatformPermissions record", () => {
    const permissions = createPermissionsSurface({
      permissions: { payments: true, oracle: true, aa: false, storage: undefined },
    });

    expect(permissions.list()).toEqual(["payments", "oracle"]);
    expect(permissions.has("payments")).toBe(true);
    expect(permissions.has("aa")).toBe(false);
    expect(permissions.has("storage")).toBe(false);
  });

  it("answers has() for granted and missing permissions", () => {
    const permissions = createPermissionsSurface({ permissions: ["invoke:primary"] });

    expect(permissions.has("invoke:primary")).toBe(true);
    expect(permissions.has(" invoke:primary ")).toBe(true);
    expect(permissions.has("oracle:request")).toBe(false);
  });

  it("require() passes silently for granted permissions", () => {
    const permissions = createPermissionsSurface({ permissions: ["oracle:request"] });

    expect(() => permissions.require("oracle:request")).not.toThrow();
  });

  it("require() throws FrameworkPermissionError on the MiniAppError hierarchy", () => {
    const permissions = createPermissionsSurface({ permissions: ["payments"] });

    let thrown: unknown;
    try {
      permissions.require("oracle:request");
    } catch (error) {
      thrown = error;
    }

    expect(thrown).toBeInstanceOf(FrameworkPermissionError);
    expect(thrown).toBeInstanceOf(MiniAppError);
    expect(isMiniAppError(thrown)).toBe(true);

    const error = thrown as FrameworkPermissionError;
    expect(error.code).toBe("PERMISSION_DENIED");
    expect(error.permission).toBe("oracle:request");
    expect(error.message).toContain("oracle:request");
    expect(error.details).toEqual({ permission: "oracle:request" });
  });

  it("localizes the denied user message through the injected translator", () => {
    const permissions = createPermissionsSurface({
      permissions: [],
      t: (key) => `translated:${key}`,
    });

    try {
      permissions.require("payments");
      expect.unreachable("require should have thrown");
    } catch (error) {
      expect((error as MiniAppError).translatedUserMessage).toBe("translated:permissionDenied");
    }
  });

  it("treats a missing declaration as unrestricted (standalone/OneGate degradation)", () => {
    for (const permissions of [
      createPermissionsSurface(),
      createPermissionsSurface({ permissions: null }),
      createPermissionsSurface({ permissions: undefined }),
    ]) {
      expect(permissions.list()).toEqual([]);
      expect(permissions.has("invoke:primary")).toBe(true);
      expect(() => permissions.require("invoke:primary")).not.toThrow();
    }
  });

  it("enforces a declared-but-empty permission set verbatim", () => {
    const fromArray = createPermissionsSurface({ permissions: [] });
    const fromRecord = createPermissionsSurface({ permissions: {} });

    for (const permissions of [fromArray, fromRecord]) {
      expect(permissions.list()).toEqual([]);
      expect(permissions.has("payments")).toBe(false);
      expect(() => permissions.require("payments")).toThrow(FrameworkPermissionError);
    }
  });

  it("re-reads a getter source so late-hydrating launch contexts stay live", () => {
    let manifestPermissions: string[] | null = null;
    const permissions = createPermissionsSurface({ permissions: () => manifestPermissions });

    // Before hydration: undeclared → unrestricted.
    expect(permissions.has("payments")).toBe(true);

    manifestPermissions = ["payments"];
    expect(permissions.list()).toEqual(["payments"]);
    expect(permissions.has("payments")).toBe(true);
    expect(() => permissions.require("oracle:request")).toThrow(FrameworkPermissionError);
  });
});
