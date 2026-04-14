/**
 * Lightweight helpers for reading on-chain contract state from the host-app.
 * Used by MiniAppPlayfield to display live data without loading the full
 * miniapp bundle.
 */

const NEO_MAINNET_RPC = "https://mainnet1.neo.coz.io:443";

const MINIAPP_CONTRACT_HASHES: Record<string, string> = {
  "miniapp-last-survivor": "0x180a3a35c088eab4feded508c2ccb1556e07a840",
  "miniapp-gasbox": "0xf111a0d02ecae3ace271da8abeb7ee22fa122f1c",
  "miniapp-redenvelope": "0x5f371cc50116bb13d79554d96ccdd6e246cd5d59",
  "miniapp-dailycheckin": "0xbd4f3646e189350b9c11a659655854e6f03f9be4",
  "miniapp-fogplay": "0xa5a4b5b82066d86eae9312f6072d1c3604882c81",
  "miniapp-self-loan": "0x942da575b31f39cbb59e64b5813b128739b44c25",
  "miniapp-neo-pay": "0xfd4dcc346d73c4ac6c3db209323561cf7f1b5e34",
};

export function getMiniAppContractHash(appId: string): string | null {
  return MINIAPP_CONTRACT_HASHES[appId] || null;
}

export function getRpcUrl(): string {
  return NEO_MAINNET_RPC;
}
