import { describe, expect, expectTypeOf, it } from "vitest";
import * as sdk from "../src/index";
import type {
  AdminSDK,
  HostSDK,
  MiniAppSDK,
  MiniAppSDKConfig,
  NeoDapiAccount,
  NeoDapiProvider,
  NeoDapiPaymentRequest,
  NeoDapiPaymentResult,
  Nep21ProviderPreference,
  Nep21Window,
  SDKError,
  SignedMessage,
  WalletProviderInfo,
  WalletProviderKind,
} from "../src/index";

/**
 * Public type surface guard.
 *
 * The package ships its types as the emitted `dist/index.d.ts` (see the
 * package.json `types` field). External consumers import everything through
 * the package entry point, so a dropped or renamed export — or a public type
 * whose shape silently changed — is a breaking change even when the source
 * still type-checks in isolation.
 *
 * This test pins the public surface from the consumer's vantage point: it
 * imports only from the entry module (`../src/index`, the same module
 * `dist/index.d.ts` is generated from) and asserts both the runtime value
 * exports and the compile-time type exports. The `types:check` npm script
 * complements this by type-checking a fixture against the *emitted*
 * declarations so the build output cannot drift from the source either.
 */

describe("public value exports", () => {
  const expectedValueExports = [
    // client
    "createHostSDK",
    "createMiniAppSDK",
    "SDKError",
    // admin
    "createAdminSDK",
    "AdminSDK",
    // window bootstrap
    "installMiniAppSDK",
    // NEP-21 provider / host wallet bridge surface
    "extractNep21ProviderFromReadyEvent",
    "isNep21Provider",
    "readImmediateNep21Provider",
    "rememberNep21Provider",
    "requestNep21Provider",
    "resetNep21ProviderCacheForTests",
    "waitForNep21Provider",
    "isCompatibleBridgeProtocolVersion",
    "normalizeBridgeProtocolVersion",
  ] as const;

  it.each(expectedValueExports)("exposes %s as a function", (name) => {
    expect(typeof (sdk as Record<string, unknown>)[name]).toBe("function");
  });

  it("exposes the host wallet bridge protocol constants", () => {
    expect(typeof sdk.HOST_WALLET_BRIDGE_PROTOCOL_VERSION).toBe("number");
    expect(Number.isInteger(sdk.HOST_WALLET_BRIDGE_PROTOCOL_VERSION)).toBe(true);
    expect(Array.isArray(sdk.HOST_WALLET_BRIDGE_COMPATIBLE_PROTOCOL_VERSIONS)).toBe(true);
    expect(
      sdk.HOST_WALLET_BRIDGE_COMPATIBLE_PROTOCOL_VERSIONS,
    ).toContain(sdk.HOST_WALLET_BRIDGE_PROTOCOL_VERSION);
  });

  it("does not regress any pinned value export", () => {
    for (const name of expectedValueExports) {
      expect(sdk).toHaveProperty(name);
    }
  });
});

describe("NEP-21 provider type surface", () => {
  it("keeps the dAPI provider shape that the host wallet bridge relies on", () => {
    expectTypeOf<NeoDapiProvider["getAccounts"]>().toEqualTypeOf<
      () => Promise<NeoDapiAccount[]>
    >();
    expectTypeOf<NeoDapiProvider["invoke"]>().not.toBeNever();
    expectTypeOf<NeoDapiProvider["requestPayment"]>().not.toBeNever();
    expectTypeOf<NeoDapiProvider["signMessage"]>().not.toBeNever();
    expectTypeOf<NeoDapiAccount["hash"]>().toEqualTypeOf<string>();
    expectTypeOf<NeoDapiPaymentRequest["timeoutSeconds"]>().toEqualTypeOf<
      number | undefined
    >();
    expectTypeOf<NeoDapiPaymentResult["succeeded"]>().toEqualTypeOf<boolean>();
  });

  it("constrains the provider preference union", () => {
    expectTypeOf<Nep21ProviderPreference>().toEqualTypeOf<
      "any" | "onegate" | "neoline"
    >();
  });

  it("models the dAPI-aware window", () => {
    expectTypeOf<Nep21Window>().toMatchTypeOf<Window>();
    expectTypeOf<Nep21Window["NEP21Provider"]>().toEqualTypeOf<unknown>();
  });

  it("types the provider detection helpers against the public provider type", () => {
    expectTypeOf(sdk.isNep21Provider).guards.toEqualTypeOf<NeoDapiProvider>();
    expectTypeOf(sdk.waitForNep21Provider).returns.resolves.toEqualTypeOf<
      NeoDapiProvider
    >();
    expectTypeOf(sdk.readImmediateNep21Provider).returns.toEqualTypeOf<
      NeoDapiProvider | null
    >();
  });
});

describe("core SDK type surface", () => {
  it("keeps the factory return types and config in lockstep", () => {
    expectTypeOf(sdk.createMiniAppSDK)
      .parameter(0)
      .toEqualTypeOf<MiniAppSDKConfig>();
    expectTypeOf(sdk.createMiniAppSDK).returns.toEqualTypeOf<MiniAppSDK>();
    expectTypeOf(sdk.createHostSDK).returns.toEqualTypeOf<HostSDK>();
    expectTypeOf(sdk.createAdminSDK).returns.toEqualTypeOf<AdminSDK>();
  });

  it("keeps the wallet provider discriminators and signed message shape", () => {
    expectTypeOf<WalletProviderKind>().toEqualTypeOf<
      "nep21" | "neoline" | "evm" | "host"
    >();
    expectTypeOf<WalletProviderInfo["kind"]>().toEqualTypeOf<WalletProviderKind>();
    expectTypeOf<SignedMessage["signature"]>().toEqualTypeOf<string | undefined>();
  });

  it("exposes SDKError with its typed diagnostic fields", () => {
    expectTypeOf<SDKError["status"]>().toEqualTypeOf<number>();
    expectTypeOf<SDKError["code"]>().toEqualTypeOf<string>();
    expectTypeOf<SDKError["path"]>().toEqualTypeOf<string>();
    expect(new sdk.SDKError({
      status: 0,
      code: "API_KEY_REQUIRED",
      message: "missing key",
      path: "/v1/example",
    })).toBeInstanceOf(Error);
  });
});
