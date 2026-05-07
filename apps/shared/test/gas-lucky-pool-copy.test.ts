import { describe, expect, it } from "vitest";

import { manifest } from "../../gas-lucky-pool/src/manifest";
import { messages } from "../../gas-lucky-pool/src/locale/messages";
import gasPoolNeoManifest from "../../gas-lucky-pool/neo-manifest.json";

type LocalizedMessage = {
  en: string;
  zh: string;
};

const gasPoolMessages = messages as Record<string, LocalizedMessage>;

describe("OneGate Vault copy", () => {
  it("uses OneGate Vault as the user-facing product name while keeping the stable app id", () => {
    expect(manifest.name).toBe("OneGate Vault");
    expect(gasPoolMessages.title.en).toBe("OneGate Vault");
    expect(gasPoolMessages.title.zh).toBe("OneGate 金库");
    expect(gasPoolNeoManifest.name).toBe("OneGate Vault");
    expect(gasPoolNeoManifest.name_zh).toBe("OneGate 金库");
    expect(gasPoolNeoManifest.id).toBe("miniapp-gas-lucky-pool");
  });

  it("describes the off-chain claim-key safety model", () => {
    for (const key of ["createPoolDescription", "claimPoolDescription", "docSafetyModel"]) {
      expect(gasPoolMessages[key].en.toLowerCase()).toMatch(/backend|server|key/);
      expect(gasPoolMessages[key].zh).toMatch(/后端|服务器|key/);
    }
  });

  it("exposes the server-backed claim as the first-class OneGate operation", () => {
    const operations = gasPoolNeoManifest.operation_panel.operations.map((operation) => operation.method);

    expect(operations).toEqual(["claimOneGateVault"]);
    expect(gasPoolMessages.claimKey.en).toBe("Claim key");
    expect(gasPoolMessages.claimCongratsTitle.zh).toBe("恭喜，奖励已到账");
  });

  it("states the 1-50 GAS reward range and luck percentile", () => {
    expect(manifest.description).toMatch(/1-50 GAS/);
    expect(gasPoolNeoManifest.description).toMatch(/1-50 GAS/);
    expect(gasPoolMessages.subtitle.en).toMatch(/1-50 GAS/);
    expect(gasPoolMessages.luckPercentLabel.zh).toContain("运气超过");
  });
});
