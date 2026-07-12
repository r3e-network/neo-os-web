import {
  EmbeddedDappSurface,
  PlayShell,
  buildEmbeddedDappUrl,
} from "./PlayAreaShared";
import type { PlayAreaRegistryProps } from "./PlayAreaShared";

/**
 * The standalone MiniApp is the one product and protocol source of truth.
 *
 * The retired host-side implementation duplicated the transfer form, used a
 * regex-only address check, skipped the contract-key binding and recovery
 * journal, and described an unverified TEE settlement as if it were complete.
 * The host now owns framing and bridges only.
 */
export function PrivateTransferPlayArea({
  app,
  network,
  launchContext,
}: PlayAreaRegistryProps) {
  const dappUrl = buildEmbeddedDappUrl(app, network, launchContext);

  return (
    <PlayShell
      app={app}
      title="Confidential transfer workspace"
      subtitle="Create a testnet encrypted transfer intent in the real privacy airlock. The MiniApp verifies its Oracle key source, stores only ciphertext, and keeps failed storage recoverable without claiming a payment."
      tone="emerald"
    >
      <EmbeddedDappSurface
        title="Privacy airlock"
        subtitle="Recipient, amount, runtime status, encrypted storage, and recovery stay together in the complete MiniApp."
        url={dappUrl}
        tone="emerald"
        frameTitle={`${app.name} dApp`}
        testId="private-transfer-dapp-frame"
        appId={app.app_id}
        network={network}
        heightClass="h-[1680px] sm:h-[1420px] lg:h-[1120px]"
      />
    </PlayShell>
  );
}
