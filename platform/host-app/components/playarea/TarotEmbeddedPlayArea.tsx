import {
  EmbeddedDappSurface,
  PlayShell,
  buildEmbeddedDappUrl,
} from "./PlayAreaShared";
import type { PlayAreaRegistryProps } from "./PlayAreaShared";

/**
 * The standalone Phaser ritual is the Tarot product source of truth. Keeping a
 * second host-side draw implementation previously produced fake Date.now()
 * cards, stale GAS copy, and a different interaction model from design option
 * 3. The host now embeds the actual app and only owns framing + bridges.
 */
export function TarotEmbeddedPlayArea({
  app,
  network,
  launchContext,
}: PlayAreaRegistryProps) {
  const dappUrl = buildEmbeddedDappUrl(app, network, launchContext);

  return (
    <PlayShell
      app={app}
      title="On-chain Tarot ritual"
      subtitle="Enter the full illustrated three-card ritual, choose an intention, and reveal only the reading produced by the real MiniApp flow."
      tone="violet"
    >
      <EmbeddedDappSurface
        title="Tarot ritual"
        subtitle="The complete Phaser reading table runs inside the MiniApp."
        url={dappUrl}
        tone="violet"
        frameTitle={`${app.name} dApp`}
        testId="tarot-dapp-frame"
        appId={app.app_id}
        network={network}
        heightClass="min-h-[760px] h-[calc(100vh-172px)]"
      />
    </PlayShell>
  );
}
