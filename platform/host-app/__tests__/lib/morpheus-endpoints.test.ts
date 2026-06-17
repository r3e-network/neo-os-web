describe("morpheus endpoint resolvers", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    jest.resetModules();
    process.env = { ...originalEnv };
    delete process.env.MORPHEUS_TESTNET_RUNTIME_URL;
    delete process.env.MORPHEUS_RUNTIME_URL;
    delete process.env.MORPHEUS_TESTNET_RUNTIME_TOKEN;
    delete process.env.MORPHEUS_RUNTIME_TOKEN;
    delete process.env.MORPHEUS_TESTNET_NITRO_API_TOKEN;
    delete process.env.MORPHEUS_TESTNET_PHALA_API_TOKEN;
    delete process.env.NITRO_API_TOKEN;
    delete process.env.PHALA_API_TOKEN;
    delete process.env.NITRO_SHARED_SECRET;
    delete process.env.PHALA_SHARED_SECRET;
    delete process.env.MORPHEUS_TESTNET_PUBLIC_API_URL;
    delete process.env.MORPHEUS_PUBLIC_API_URL;
    delete process.env.NEXT_PUBLIC_MORPHEUS_PUBLIC_API_URL;
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  it("prefers network-scoped runtime URLs over generic and canonical fallbacks", () => {
    process.env.MORPHEUS_TESTNET_RUNTIME_URL = "https://testnet-runtime.example/";
    process.env.MORPHEUS_RUNTIME_URL = "https://generic-runtime.example/";

    const { resolveMorpheusRuntimeCandidates } = require("../../lib/morpheus-endpoints");
    expect(resolveMorpheusRuntimeCandidates("testnet")).toEqual([
      "https://testnet-runtime.example",
      "https://generic-runtime.example",
      "https://oracle.meshmini.app/testnet",
      "https://edge.meshmini.app/testnet",
    ]);
  });

  it("falls back to the Nitro runtime token alias when runtime URL is already resolved", () => {
    process.env.NITRO_SHARED_SECRET = "shared-secret";

    const {
      resolveMorpheusRuntimeCandidates,
      resolveMorpheusRuntimeToken,
    } = require("../../lib/morpheus-endpoints");

    expect(resolveMorpheusRuntimeCandidates("mainnet")[0]).toBe("https://oracle.meshmini.app/mainnet");
    expect(resolveMorpheusRuntimeToken("mainnet")).toBe("shared-secret");
  });

  it("ignores retired PHALA_* credentials (Phala runtime decommissioned)", () => {
    process.env.PHALA_SHARED_SECRET = "legacy-shared-secret";
    process.env.PHALA_API_TOKEN = "legacy-phala-token";

    const { resolveMorpheusRuntimeToken } = require("../../lib/morpheus-endpoints");

    expect(resolveMorpheusRuntimeToken("mainnet")).toBe("");
  });

  it("resolves the NITRO token and never falls back to retired PHALA credentials", () => {
    process.env.NITRO_API_TOKEN = "nitro-token";
    process.env.PHALA_API_TOKEN = "legacy-phala-token";

    const { resolveMorpheusRuntimeToken } = require("../../lib/morpheus-endpoints");

    expect(resolveMorpheusRuntimeToken("mainnet")).toBe("nitro-token");
  });

  it("returns network-scoped public api candidates before shared defaults", () => {
    process.env.MORPHEUS_TESTNET_PUBLIC_API_URL = "https://testnet-public.example/";
    process.env.MORPHEUS_PUBLIC_API_URL = "https://shared-public.example/";

    const { resolveMorpheusPublicApiCandidates } = require("../../lib/morpheus-endpoints");
    expect(resolveMorpheusPublicApiCandidates("testnet")).toEqual([
      "https://testnet-public.example",
      "https://shared-public.example",
      "https://oracle.meshmini.app/testnet",
    ]);
  });
});
