describe("external integration registry", () => {
  it("derives Morpheus runtime defaults from the generated public registry", () => {
    const { MORPHEUS_PUBLIC_REGISTRY } = require("../../../../apps/shared/constants/generated-morpheus-registry");
    const { getExternalIntegrationConfig } = require("../../../../apps/shared/constants/rpc");

    const mainnet = getExternalIntegrationConfig("mainnet");
    const testnet = getExternalIntegrationConfig("testnet");

    expect(mainnet.rpcUrl).toBe(MORPHEUS_PUBLIC_REGISTRY.mainnet.rpcUrl);
    expect(mainnet.networkMagic).toBe(MORPHEUS_PUBLIC_REGISTRY.mainnet.networkMagic);
    expect(mainnet.morpheusPublicApiUrl).toBe(MORPHEUS_PUBLIC_REGISTRY.mainnet.morpheus.publicApiUrl);
    expect(mainnet.morpheusRuntimeUrls).toEqual(MORPHEUS_PUBLIC_REGISTRY.mainnet.morpheus.runtimeUrls);
    expect(mainnet.morpheusControlPlaneUrl).toBe(MORPHEUS_PUBLIC_REGISTRY.mainnet.morpheus.controlPlaneUrl);
    expect(mainnet.morpheusDatafeedCvmId).toBe(MORPHEUS_PUBLIC_REGISTRY.mainnet.morpheus.datafeedCvmId);
    expect(mainnet.contracts.aaCore).toBe(MORPHEUS_PUBLIC_REGISTRY.mainnet.contracts.aaCore);
    expect(mainnet.contracts.morpheusOracle).toBe(MORPHEUS_PUBLIC_REGISTRY.mainnet.contracts.morpheusOracle);
    expect(mainnet.domains.neodid).toBe(MORPHEUS_PUBLIC_REGISTRY.mainnet.domains.neodid);

    expect(testnet.rpcUrl).toBe(MORPHEUS_PUBLIC_REGISTRY.testnet.rpcUrl);
    expect(testnet.networkMagic).toBe(MORPHEUS_PUBLIC_REGISTRY.testnet.networkMagic);
    expect(testnet.morpheusPublicApiUrl).toBe(MORPHEUS_PUBLIC_REGISTRY.testnet.morpheus.publicApiUrl);
    expect(testnet.morpheusRuntimeUrls).toEqual(MORPHEUS_PUBLIC_REGISTRY.testnet.morpheus.runtimeUrls);
    expect(testnet.morpheusControlPlaneUrl).toBe(MORPHEUS_PUBLIC_REGISTRY.testnet.morpheus.controlPlaneUrl);
    expect(testnet.morpheusDatafeedCvmId).toBe(MORPHEUS_PUBLIC_REGISTRY.testnet.morpheus.datafeedCvmId);
    expect(testnet.contracts.aaCore).toBe(MORPHEUS_PUBLIC_REGISTRY.testnet.contracts.aaCore);
    expect(testnet.contracts.morpheusOracle).toBe(MORPHEUS_PUBLIC_REGISTRY.testnet.contracts.morpheusOracle);
  });
});
