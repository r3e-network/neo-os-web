describe("morpheus endpoint resolvers", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    jest.resetModules();
    process.env = { ...originalEnv };
    delete process.env.MORPHEUS_TESTNET_RUNTIME_URL;
    delete process.env.MORPHEUS_RUNTIME_URL;
    delete process.env.MORPHEUS_TESTNET_PHALA_API_URL;
    delete process.env.PHALA_API_URL;
    delete process.env.MORPHEUS_TESTNET_RUNTIME_TOKEN;
    delete process.env.MORPHEUS_RUNTIME_TOKEN;
    delete process.env.MORPHEUS_TESTNET_PHALA_API_TOKEN;
    delete process.env.PHALA_API_TOKEN;
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
      "https://morpheus-testnet.meshmini.app",
      "https://edge.meshmini.app/testnet",
    ]);
  });

  it("falls back to PHALA env keys and token aliases", () => {
    process.env.PHALA_API_URL = "https://legacy-runtime.example/";
    process.env.PHALA_SHARED_SECRET = "shared-secret";

    const {
      resolveMorpheusRuntimeCandidates,
      resolveMorpheusRuntimeToken,
    } = require("../../lib/morpheus-endpoints");

    expect(resolveMorpheusRuntimeCandidates("mainnet")[0]).toBe("https://legacy-runtime.example");
    expect(resolveMorpheusRuntimeToken("mainnet")).toBe("shared-secret");
  });

  it("returns network-scoped public api candidates before shared defaults", () => {
    process.env.MORPHEUS_TESTNET_PUBLIC_API_URL = "https://testnet-public.example/";
    process.env.MORPHEUS_PUBLIC_API_URL = "https://shared-public.example/";

    const { resolveMorpheusPublicApiCandidates } = require("../../lib/morpheus-endpoints");
    expect(resolveMorpheusPublicApiCandidates("testnet")).toEqual([
      "https://testnet-public.example",
      "https://shared-public.example",
      "https://neo-morpheus-oracle-web.vercel.app",
    ]);
  });
});
