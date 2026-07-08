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
 *   granted. Framework internals call `require()` (e.g. chain.invoke →
 *   "invoke:primary", oracle.* → "oracle:request") so gating happens once,
 *   centrally.
 */

import { MiniAppError } from "./utils/errors";

type Translator = (key: string) => string;

/** Manifest permission declarations: string list or boolean-flag record. */
export type FrameworkPermissionsInput =
  | readonly string[]
  | Record<string, boolean | undefined>
  | null
  | undefined;

export interface PermissionsSurfaceDeps {
  /**
   * Manifest permission declarations delivered via the launch context.
   * Accepts a value or a getter so late-hydrating launch contexts stay live.
   */
  permissions?: FrameworkPermissionsInput | (() => FrameworkPermissionsInput);
  /** Optional translator for the localized permission-denied user message. */
  t?: Translator;
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

function normalizePermissions(input: FrameworkPermissionsInput): string[] | null {
  if (input === undefined || input === null) return null;
  const granted: string[] = [];
  const seen = new Set<string>();
  const push = (value: string) => {
    const permission = value.trim();
    if (!permission || seen.has(permission)) return;
    seen.add(permission);
    granted.push(permission);
  };
  if (Array.isArray(input)) {
    for (const entry of input) push(String(entry ?? ""));
    return granted;
  }
  for (const [key, enabled] of Object.entries(input as Record<string, boolean | undefined>)) {
    if (enabled === true) push(key);
  }
  return granted;
}

export function createPermissionsSurface(
  deps: PermissionsSurfaceDeps = {},
): FrameworkPermissionsSurface {
  // Re-read on every call: launch contexts can hydrate after boot.
  const declared = (): string[] | null =>
    normalizePermissions(
      typeof deps.permissions === "function" ? deps.permissions() : deps.permissions,
    );

  const has = (permission: string): boolean => {
    const granted = declared();
    if (granted === null) return true;
    return granted.includes(String(permission ?? "").trim());
  };

  return {
    list() {
      return declared() ?? [];
    },

    has,

    require(permission) {
      if (has(permission)) return;
      throw new FrameworkPermissionError(String(permission ?? "").trim(), deps.t);
    },
  };
}
