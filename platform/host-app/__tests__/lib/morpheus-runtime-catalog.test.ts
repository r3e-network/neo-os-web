describe('morpheus runtime catalog', () => {
  it('exposes Morpheus workflow topology through the external integration registry', () => {
    const { MORPHEUS_PUBLIC_RUNTIME_CATALOG } = require('../../../../apps/shared/constants/generated-morpheus-runtime-catalog');
    const { EXTERNAL_INTEGRATIONS } = require('../../../../apps/shared/constants/rpc');

    expect(EXTERNAL_INTEGRATIONS.testnet.morpheusWorkflowIds).toContain('automation.upkeep');
    expect(EXTERNAL_INTEGRATIONS.testnet.morpheusEnvelopeVersion).toBe('2026-04-tee-v1');
    expect(EXTERNAL_INTEGRATIONS.testnet.morpheusRiskPlane).toBe('independent_observer');
    expect(EXTERNAL_INTEGRATIONS.testnet.morpheusAutomationTriggerKinds).toEqual(['interval', 'threshold']);
    expect(MORPHEUS_PUBLIC_RUNTIME_CATALOG.topology).toEqual({
      ingressPlane: 'edge_gateway',
      orchestrationPlane: 'control_plane',
      schedulerPlane: 'control_plane',
      executionPlane: 'tee_runtime',
      riskPlane: 'independent_observer',
    });
    expect(MORPHEUS_PUBLIC_RUNTIME_CATALOG.workflows.find((item) => item.id === 'paymaster.authorize')).toBeTruthy();
    expect(MORPHEUS_PUBLIC_RUNTIME_CATALOG.workflows.find((item) => item.id === 'automation.upkeep')?.execution).toEqual({
      orchestrationPlane: 'control_plane',
      executionPlane: 'tee_runtime',
      riskPlane: 'independent_observer',
      teeRequired: true,
    });
  });
});
