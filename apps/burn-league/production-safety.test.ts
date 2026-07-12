import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import {
  BURN_LEAGUE_TESTNET_CONTRACT,
  BURN_LEAGUE_TESTNET_NEF_CHECKSUM,
  isVerifiedBurnLeagueContract,
} from "./src/composables/useBurnLeague";

function read(path: string): string {
  return readFileSync(resolve(process.cwd(), path), "utf8");
}

describe("Burn League production safety", () => {
  it("publishes only the reviewed TestNet v1.1 deployment", () => {
    const publicManifest = JSON.parse(read("neo-manifest.json")) as {
      version: string;
      contracts: Record<string, string>;
      default_network: string;
      supported_networks: string[];
      stateSource: { chain: string; endpoints: string[] };
      technologies: { vrf: { enabled: boolean } };
    };
    expect(publicManifest.version).toBe("1.1.0");
    expect(publicManifest.contracts).toEqual({
      "neo-n3-testnet": BURN_LEAGUE_TESTNET_CONTRACT,
    });
    expect(publicManifest.default_network).toBe("neo-n3-testnet");
    expect(publicManifest.supported_networks).toEqual(["neo-n3-testnet"]);
    expect(publicManifest.stateSource).toEqual({
      chain: "neo-n3-testnet",
      endpoints: ["https://api.n3index.dev/testnet"],
      type: "n3index",
    });
    expect(publicManifest.technologies.vrf.enabled).toBe(false);
    expect(isVerifiedBurnLeagueContract(BURN_LEAGUE_TESTNET_CONTRACT)).toBe(true);
    expect(
      isVerifiedBurnLeagueContract("0xdd3bf2ff39bc4e39107ace953e2271a43a58e28f"),
    ).toBe(false);

    const nef = readFileSync(
      resolve(process.cwd(), "../../contracts/build/MiniAppBurnLeague.nef"),
    );
    expect(nef.readUInt32LE(nef.length - 4)).toBe(
      BURN_LEAGUE_TESTNET_NEF_CHECKSUM,
    );
  });

  it("keeps local chance play CSPRNG-only and the visible game on real assets", () => {
    const guest = read("src/logic/guest-engine.ts");
    const main = read("src/main.tsx");
    const scene = read("src/scenes/BurnLeagueScene.ts");
    expect(guest).not.toMatch(/Math\.random\s*\(/);
    expect(guest).toContain('throw new Error("secure-random-unavailable")');
    expect(guest).toContain("bank(): boolean");
    expect(main).toContain('app.actions.register("bankGuestRun"');
    expect(scene).toContain('this.load.image(BURN_ASSETS.arena, "./burn-league-arena.webp")');
    expect(scene).toContain('this.load.image(BURN_ASSETS.logo, "./logo.webp")');
    expect(scene).toContain("officialGasTokenPhaserUrl");
    expect(scene).toContain("this.coreMachine = this.add.image");
  });

  it("keeps the reviewed ABI surface aligned with the frontend", () => {
    const artifact = JSON.parse(
      read("../../contracts/build/MiniAppBurnLeague.manifest.json"),
    ) as {
      name: string;
      abi: { methods: Array<{ name: string }>; events: Array<{ name: string }> };
    };
    const methods = artifact.abi.methods.map((entry) => entry.name);
    const events = artifact.abi.events.map((entry) => entry.name);
    expect(artifact.name).toBe("MiniAppBurnLeague");
    expect(methods).toEqual(expect.arrayContaining([
      "burn",
      "settle",
      "withdraw",
      "currentSeason",
      "seasonEnd",
      "rewardPool",
      "userBurned",
      "creditOf",
      "seasonDuration",
    ]));
    expect(events).toEqual(expect.arrayContaining([
      "Credited",
      "Burned",
      "SeasonSettled",
      "CreditWithdrawn",
    ]));
  });
});
