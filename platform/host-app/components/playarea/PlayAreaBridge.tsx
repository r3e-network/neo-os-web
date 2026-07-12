import {
  EmbeddedDappSurface,
  buildEmbeddedDappUrl,
} from "./PlayAreaShared";
import type { PlayAreaRegistryProps } from "./PlayAreaShared";

/**
 * The standalone Bridge workspace is the product and protocol source of truth.
 *
 * The retired host implementation duplicated a static route summary, exposed
 * the incomplete MessageBridge payload form, and could turn launch parameters
 * into a finalized-looking handoff without running the MiniApp's recovery or
 * source-chain checks. The host now owns only the sandboxed frame and bridges.
 */
export function NeoXBridgePlayArea({
  app,
  network,
  launchContext,
}: PlayAreaRegistryProps) {
  const dappUrl = buildEmbeddedDappUrl(app, network, launchContext);

  return (
    <EmbeddedDappSurface
      title="Neo X bridge workspace"
      subtitle="Review a GAS route, continue on the official bridge, then verify source-chain evidence in the complete MiniApp."
      url={dappUrl}
      tone="sky"
      frameTitle={`${app.name} dApp`}
      testId="neo-x-bridge-dapp-frame"
      appId={app.app_id}
      network={network}
      heightClass="min-h-[900px] h-[calc(100vh-120px)]"
    />
  );
}
