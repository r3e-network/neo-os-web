import fs from "node:fs";
import path from "node:path";

/**
 * The host side of two guards that used to live beside the app sources they
 * compared against. Those apps are in neo-miniapps now, which keeps the app half
 * of each guard; this half pins what the host must keep providing for them.
 */
function read(relativePath: string): string {
  return fs.readFileSync(path.join(process.cwd(), relativePath), "utf8");
}

describe("embedded app host contract", () => {
  it("keeps the treasury fallback honest about watched wallets and confirmation proof", () => {
    const hostProfile = read("components/playarea/PlayAreaProfilesBusiness.tsx");
    const treasuryProfile = hostProfile.slice(
      hostProfile.indexOf('"miniapp-neo-treasury"'),
      hostProfile.indexOf('"miniapp-neodid-passport"'),
    );

    expect(treasuryProfile).toContain('title: "Public treasury watchlist"');
    expect(treasuryProfile).toContain('{ label: "Transfer source", value: "connected wallet" }');
    expect(treasuryProfile).toContain('{ label: "Proof", value: "event + balances" }');
  });

  it("gives the album embed an opaque sandbox and a scoped storage allowlist", () => {
    const host = read("components/playarea/PlayAreaMedia.tsx");

    expect(host).toContain('title="Forever Album local photo workspace"');
    // The album persists through the bridge precisely because the sandbox is
    // opaque; a sandbox line granting allow-same-origin would remove the reason
    // the bridge exists and hand the iframe direct Web Storage.
    for (const line of host.split("\n")) {
      if (line.trim().startsWith('sandbox="')) {
        expect(line).not.toContain("allow-same-origin");
      }
    }
    expect(host).toContain(
      "wallet address separates local albums; it does not sign a transaction",
    );

    const bridge = read("components/playarea/bridge/use-embedded-storage-bridge.ts");
    expect(bridge).toContain('"miniapp-forever-album"');
    expect(bridge).toContain('appKeyPrefix: "forever-album:"');
  });
});
