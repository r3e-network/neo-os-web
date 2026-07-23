import { describe, expect, it } from "vitest";

import { sha256 } from "../shims/noble-hashes-sha256.js";
import {
  buildFactoryArtifactCall,
  factoryTemplateArtifactHashes,
} from "../factory/factoryArtifact";
import { FACTORY_TEMPLATE_ARTIFACTS } from "../factory/generated-template-artifacts";
import { buildFactoryPlan } from "../factory/factoryPlan";

const OWNER = "NNLi44dJNXtDNSBkofB48aTVYtb1zZrNEs";
const OWNER_HASH_BASE64 = "pd5SOunZm+eEpTbpQSt6PL4Enho=";

function decodeBase64(value: string): Uint8Array {
  return Uint8Array.from(atob(value), (character) => character.charCodeAt(0));
}

function encodeBase64(value: Uint8Array): string {
  return btoa(String.fromCharCode(...value));
}

function concat(...values: Uint8Array[]): Uint8Array {
  const output = new Uint8Array(values.reduce((sum, value) => sum + value.length, 0));
  let offset = 0;
  for (const value of values) {
    output.set(value, offset);
    offset += value.length;
  }
  return output;
}

describe("factory artifact builder", () => {
  it("builds an exact six-argument call and binds its digest to every byte", () => {
    const call = buildFactoryArtifactCall(
      "nep17",
      "tpl.nep17.asset.v1",
      "tpl-nep17-asset-v1-example",
      {
        name: "Neo Credits",
        symbol: "NEOC",
        decimals: 8,
        initialSupply: "1000000",
        initialSupplyUnits: "100000000000000",
        owner: OWNER,
        treasury: OWNER,
        mintable: true,
        transferPolicy: "standard-nep17",
      },
    );

    expect(call.args.map((argument) => argument.type)).toEqual([
      "String",
      "String",
      "String",
      "String",
      "ByteArray",
      "String",
    ]);
    expect(call.args.map((argument) => argument.value)).toEqual([
      "tpl.nep17.asset.v1",
      "tpl-nep17-asset-v1-example",
      call.artifactDigest,
      call.initParamsJson,
      call.nefBase64,
      call.manifest,
    ]);

    const init = JSON.parse(call.initParamsJson) as Record<string, unknown>;
    expect(init.ownerHashBase64).toBe(OWNER_HASH_BASE64);
    expect(init.treasuryHashBase64).toBe(OWNER_HASH_BASE64);

    const expectedDigest = encodeBase64(
      sha256(
        concat(
          decodeBase64(call.nefBase64),
          new TextEncoder().encode(call.manifest),
          new TextEncoder().encode(call.initParamsJson),
        ),
      ),
    );
    expect(call.artifactDigest).toBe(expectedDigest);
  });

  it("changes only the governed manifest name for each unique package", () => {
    const call = buildFactoryArtifactCall(
      "nep11",
      "tpl.nep11.collection.v1",
      "tpl-nep11-collection-v1-example",
      {
        collectionName: "Builder Pass",
        symbol: "PASS",
        maxSupply: 500,
        royaltyBps: 250,
        baseUri: "https://metadata.example.com/pass/",
        owner: OWNER,
        transferPolicy: "transferable",
      },
    );
    const base = JSON.parse(FACTORY_TEMPLATE_ARTIFACTS.nep11.manifest) as Record<string, unknown>;
    const instance = JSON.parse(call.manifest) as Record<string, unknown>;
    expect(instance.name).toBe("tpl-nep11-collection-v1-example");
    delete base.name;
    delete instance.name;
    expect(instance).toEqual(base);
  });

  it("keeps planner hashes aligned with generated governed artifacts", () => {
    const hashes = factoryTemplateArtifactHashes("nep17");
    const plan = buildFactoryPlan("nep17", {
      name: "Neo Credits",
      symbol: "NEOC",
      decimals: "8",
      initialSupply: "1000000",
      owner: OWNER,
      treasury: OWNER,
      mintable: true,
      network: "testnet",
    });
    expect(plan.templateArtifact).toMatchObject(hashes);
    expect(hashes).toEqual({
      nefHash: FACTORY_TEMPLATE_ARTIFACTS.nep17.nefSha256,
      manifestHash: FACTORY_TEMPLATE_ARTIFACTS.nep17.manifestSha256,
    });
  });
});
