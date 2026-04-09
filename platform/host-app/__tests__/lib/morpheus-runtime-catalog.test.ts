describe('morpheus runtime catalog', () => {
  it('exposes Morpheus workflow metadata through the external integration registry', () => {
    const { MORPHEUS_PUBLIC_RUNTIME_CATALOG } = require('../../../../apps/shared/constants/generated-morpheus-runtime-catalog');
    const { EXTERNAL_INTEGRATIONS } = require('../../../../apps/shared/constants/rpc');

    expect(EXTERNAL_INTEGRATIONS.testnet.morpheusWorkflowIds).toContain('automation.upkeep');
    expect(EXTERNAL_INTEGRATIONS.testnet.morpheusEnvelopeVersion).toBe('2026-04-tee-v1');
    expect(MORPHEUS_PUBLIC_RUNTIME_CATALOG.workflows.some((item) => item.id === 'paymaster.authorize')).toBe(true);
  });
});
