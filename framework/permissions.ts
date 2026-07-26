/**
 * framework/permissions — app.permissions surface (extraction plan §2/S11).
 *
 * Standalone factory consumed by `createMiniAppFramework`. Permission
 * declarations come from the miniapp manifest and reach the framework through
 * the launch context, either as a string list or as the manifest's
 * `PlatformPermissions` record of boolean flags.
 *
 * Enforcement model:
 * - No declaration at all (`undefined`/`null` source) → unrestricted. Hosts
 *   that don't deliver manifest permissions (standalone/OneGate embeds) must
 *   not brick every gated call, so `has()` answers true and `require()` is a
 *   no-op while `list()` stays empty.
 * - A present declaration — even an empty one — is enforced verbatim:
 *   `require()` throws {@link FrameworkPermissionError} for anything not
 *   granted. Framework internals call `require()` (chain.invoke / write /
 *   invokeWithPayment / invokeMultiple and the mutating funds.* lanes →
 *   "invoke:primary", oracle request/dispatch AND the app.game.reward TEE
 *   session lanes (openSession / recordOp / replayOps — direct enclave
 *   round-trips on the same oracle host) → "oracle:request") so gating
 *   happens once, centrally. Shared platform contracts use separate
 *   `invoke:platform-*` grants so `invoke:primary` cannot authorize them.
 */

import { MiniAppError } from "./utils/errors";

type Translator = (key: string) => string;

/** Manifest permission declarations: string list or boolean-flag record. */
export type FrameworkPermissionsInput =
  | readonly string[]
  | Record<string, boolean | undefined>
  | null
  | undefined;

/**
 * Narrow write grants for shared platform modules.
 *
 * `invoke:primary` remains the grant for an app's standalone primary
 * contract. Shared modules use distinct grants so permission to call one
 * engine never authorizes writes to every other platform contract.
 */
export const PLATFORM_INVOKE_PERMISSIONS = {
  registry: "invoke:platform-registry",
  game: "invoke:platform-game",
  social: "invoke:platform-social",
  anchor: "invoke:platform-anchor",
  defi: "invoke:platform-defi",
  vesting: "invoke:platform-vesting",
  escrow: "invoke:platform-escrow",
  factory: "invoke:platform-factory",
} as const;

export type FrameworkPlatformInvokePermission =
  (typeof PLATFORM_INVOKE_PERMISSIONS)[keyof typeof PLATFORM_INVOKE_PERMISSIONS];

export interface PermissionsSurfaceDeps {
  /**
   * Manifest permission declarations delivered via the launch context.
   * Accepts a value or a getter so late-hydrating launch contexts stay live.
   */
  permissions?: FrameworkPermissionsInput | (() => FrameworkPermissionsInput);
  /** Optional translator for the localized permission-denied user message. */
  t?: Translator;
  /**
   * DEFAULT-ALLOW permissions (RFC P0-2): granted even under a PRESENT
   * declaration unless the declaration explicitly denies them (a
   * `PlatformPermissions` record entry of `false`). Used for gates
   * introduced AFTER apps pinned their manifests (e.g. "aa") so the gate
   * exists without changing any existing app's behavior. String-list
   * declarations cannot express a denial, so absence there still allows.
   */
  defaultAllow?: readonly string[];
}

export interface FrameworkPermissionsSurface {
  /** Granted permissions in declaration order (empty when undeclared). */
  list(): string[];
  /** True when the permission is granted (or nothing is declared at all). */
  has(permission: string): boolean;
  /** Throw {@link FrameworkPermissionError} unless the permission is granted. */
  require(permission: string): void;
}

export class FrameworkPermissionError extends MiniAppError {
  readonly permission: string;

  constructor(permission: string, translator?: Translator) {
    const userMessageKey = "permissionDenied";
    super(
      `Missing required permission: ${permission}`,
      "PERMISSION_DENIED",
      translator
        ? translator(userMessageKey)
        : "This mini-app does not have permission to perform this action.",
      { permission },
      translator,
      userMessageKey,
    );
    this.name = "FrameworkPermissionError";
    this.permission = permission;
  }
}

interface NormalizedDeclaration {
  granted: string[];
  /** Explicit `false` entries of a PlatformPermissions record declaration. */
  denied: Set<string>;
}

function normalizePermissions(input: FrameworkPermissionsInput): NormalizedDeclaration | null {
  if (input === undefined || input === null) return null;
  const granted: string[] = [];
  const denied = new Set<string>();
  const seen = new Set<string>();
  const push = (value: string) => {
    const permission = value.trim();
    if (!permission || seen.has(permission)) return;
    seen.add(permission);
    granted.push(permission);
  };
  if (Array.isArray(input)) {
    for (const entry of input) push(String(entry ?? ""));
    return { granted, denied };
  }
  for (const [key, enabled] of Object.entries(input as Record<string, boolean | undefined>)) {
    if (enabled === true) push(key);
    else if (enabled === false) {
      const permission = key.trim();
      if (permission) denied.add(permission);
    }
  }
  return { granted, denied };
}

export function createPermissionsSurface(
  deps: PermissionsSurfaceDeps = {},
): FrameworkPermissionsSurface {
  // Re-read on every call: launch contexts can hydrate after boot.
  const declared = (): NormalizedDeclaration | null =>
    normalizePermissions(
      typeof deps.permissions === "function" ? deps.permissions() : deps.permissions,
    );

  const has = (permission: string): boolean => {
    const declaration = declared();
    if (declaration === null) return true;
    const name = String(permission ?? "").trim();
    if (declaration.granted.includes(name)) return true;
    // Default-allow permissions stay granted under a present declaration
    // unless it explicitly denies them (record entry of `false`).
    if (deps.defaultAllow?.includes(name)) return !declaration.denied.has(name);
    return false;
  };

  return {
    list() {
      return declared()?.granted ?? [];
    },

    has,

    require(permission) {
      if (has(permission)) return;
      throw new FrameworkPermissionError(String(permission ?? "").trim(), deps.t);
    },
  };
}
