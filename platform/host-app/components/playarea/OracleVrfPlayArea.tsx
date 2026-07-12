import {
  EmbeddedDappSurface,
  PlayShell,
  buildEmbeddedDappUrl,
} from "./PlayAreaShared";
import type { PlayAreaRegistryProps } from "./PlayAreaShared";

/**
 * The standalone workbench owns the request schema, live Oracle-key checks,
 * response verification, and local recovery journal. Embedding that surface
 * keeps the host from reviving the retired consumer/salt/rounds form or
 * treating a local preview digest as a submitted randomness request.
 */
export function OracleVrfPlayArea({
  app,
  network,
  launchContext,
}: PlayAreaRegistryProps) {
  const dappUrl = buildEmbeddedDappUrl(app, network, launchContext);

  return (
    <PlayShell
      app={app}
      title="Oracle VRF workbench"
      subtitle="Build the exact protected-service request, inspect live Neo N3 Oracle bindings, and verify the signed randomness response in the complete MiniApp."
      tone="emerald"
    >
      <EmbeddedDappSurface
        title="Randomness verification workbench"
        subtitle="Request drafting, service evidence, response verification, and recovery remain in one source of truth."
        url={dappUrl}
        tone="emerald"
        frameTitle={`${app.name} dApp`}
        testId="oracle-vrf-dapp-frame"
        appId={app.app_id}
        network={network}
        heightClass="min-h-[820px] h-[calc(100vh-172px)]"
      />
    </PlayShell>
  );
}
