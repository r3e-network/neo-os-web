import { afterEach, describe, expect, it, vi } from "vitest";

import {
  estimateFactoryFeeGas,
  fetchFactoryDeployments,
  fetchTemplateArtifactPresence,
  readFactoryRecord,
} from "../factory/factoryChain";

const FACTORY_HASH = "0x03a7c8fc724a575ee739c919ed52cb5e2a2bdc49";
// Checksum-valid Neo N3 address (script hash 0x11…11) — addressToScriptHash
// performs full Base58Check validation, so a shape-only fake address would
// silently disable the fee-estimate path under test.
const OWNER = "NMUD7q5tYaFtw4w4hXk3feupGSGnv9jcrQ";

function b64(text: string): string {
  return Buffer.from(text, "utf8").toString("base64");
}

type RpcHandler = (body: { method: string; params: unknown[] }) => unknown;

function mockRpc(handler: RpcHandler): ReturnType<typeof vi.fn> {
  const fetchMock = vi.fn(async (_url: unknown, init?: { body?: string }) => {
    const body = JSON.parse(String(init?.body ?? "{}")) as { method: string; params: unknown[] };
    const result = handler(body);
    return {
      ok: true,
      json: async () => ({ jsonrpc: "2.0", id: 1, result }),
    } as unknown as Response;
  });
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

function templateStack(hasArtifact: boolean) {
  return {
    state: "HALT",
    gasconsumed: "222139",
    stack: [
      {
        type: "Array",
        value: [
          { type: "ByteString", value: b64("tpl.nep17.asset.v1") },
          { type: "ByteString", value: b64("NEP-17") },
          { type: "ByteString", value: b64("1.0.0") },
          { type: "ByteString", value: b64("0xabc") },
          { type: "ByteString", value: b64("0xdef") },
          { type: "ByteString", value: b64("0x123") },
          { type: "Boolean", value: hasArtifact },
          { type: "Integer", value: "1765500000000" },
        ],
      },
    ],
  };
}

function deploymentStack(packageId: string, deployedHashBytes: string) {
  return {
    state: "HALT",
    stack: [
      {
        type: "Array",
        value: [
          { type: "ByteString", value: b64("tpl.nep17.asset.v1") },
          { type: "ByteString", value: b64(packageId) },
          { type: "ByteString", value: b64("0x" + "ab".repeat(32)) },
          { type: "ByteString", value: b64("{}") },
          { type: "ByteString", value: b64("creator-bytes") },
          { type: "ByteString", value: Buffer.from(deployedHashBytes || "00".repeat(20), "hex").toString("base64") },
          { type: "Integer", value: "1765500000000" },
        ],
      },
    ],
  };
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("factoryChain", () => {
  it("maps getTemplate HasArtifact to live presence states", async () => {
    mockRpc(() => templateStack(false));
    expect(
      await fetchTemplateArtifactPresence("neo-n3-testnet", FACTORY_HASH, "tpl.nep17.asset.v1"),
    ).toBe("missing");

    mockRpc(() => templateStack(true));
    expect(
      await fetchTemplateArtifactPresence("neo-n3-testnet", FACTORY_HASH, "tpl.nep17.asset.v1"),
    ).toBe("present");

    mockRpc(() => ({
      state: "FAULT",
      exception: "ABORTMSG is executed. Reason: template not found",
      stack: [],
    }));
    expect(
      await fetchTemplateArtifactPresence("neo-n3-testnet", FACTORY_HASH, "tpl.bogus.v1"),
    ).toBe("not-registered");
  });

  it("reports unknown presence on transport failures instead of guessing", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => {
      throw new Error("offline");
    }));
    expect(
      await fetchTemplateArtifactPresence("neo-n3-testnet", FACTORY_HASH, "tpl.nep17.asset.v1"),
    ).toBe("unknown");
    expect(await fetchTemplateArtifactPresence("neo-n3-testnet", "", "tpl.nep17.asset.v1")).toBe(
      "unknown",
    );
  });

  it("estimates the deployment fee from a signed HALT test-invoke (datoshi → GAS)", async () => {
    const fetchMock = mockRpc((body) => {
      expect(body.method).toBe("invokefunction");
      // The signer entry is what makes the creator witness pass in the
      // test invocation — without it the contract FAULTs at CheckWitness.
      const signers = body.params[3] as Array<{ account: string; scopes: string }>;
      expect(signers).toHaveLength(1);
      expect(signers[0].scopes).toBe("CalledByEntry");
      expect(signers[0].account).toMatch(/^0x[a-f0-9]{40}$/);
      return { state: "HALT", gasconsumed: "704898", stack: [] };
    });

    const estimate = await estimateFactoryFeeGas(
      "neo-n3-testnet",
      {
        scriptHash: FACTORY_HASH,
        operation: "deployFromTemplate",
        args: [{ type: "String", value: "tpl.nep17.asset.v1" }],
      },
      OWNER,
    );
    expect(estimate).toBe("0.007");
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("returns no estimate for FAULTed test-invokes or missing signers", async () => {
    mockRpc(() => ({
      state: "FAULT",
      gasconsumed: "134481",
      exception: "unauthorized creator",
      stack: [],
    }));
    expect(
      await estimateFactoryFeeGas(
        "neo-n3-testnet",
        { scriptHash: FACTORY_HASH, operation: "deployFromTemplate", args: [] },
        OWNER,
      ),
    ).toBe("");

    expect(
      await estimateFactoryFeeGas(
        "neo-n3-testnet",
        { scriptHash: FACTORY_HASH, operation: "deployFromTemplate", args: [] },
        "not-an-address",
      ),
    ).toBe("");
  });

  it("pages the deployment registry newest-first and blanks UInt160.Zero hashes", async () => {
    const ids = ["pkg-a", "pkg-b", "pkg-c"];
    mockRpc((body) => {
      const [, operation, args] = body.params as [string, string, Array<{ value: string }>];
      if (operation === "deploymentCount") {
        return { state: "HALT", stack: [{ type: "Integer", value: "3" }] };
      }
      if (operation === "getDeploymentIdByIndex") {
        const index = Number(args[0].value);
        return { state: "HALT", stack: [{ type: "ByteString", value: b64(ids[index]) }] };
      }
      if (operation === "getDeployment") {
        const packageId = args[0].value;
        // pkg-c carries a real deployed hash; the others are record-only.
        return deploymentStack(packageId, packageId === "pkg-c" ? "11".repeat(20) : "");
      }
      throw new Error(`unexpected operation ${operation}`);
    });

    const { total, items } = await fetchFactoryDeployments(
      "neo-n3-testnet",
      FACTORY_HASH,
      "nep17",
      2,
    );
    expect(total).toBe(3);
    expect(items.map((item) => item.packageId)).toEqual(["pkg-c", "pkg-b"]);
    expect(items[0].deployedHash).toBe(`0x${"11".repeat(20)}`);
    expect(items[1].deployedHash).toBe("");
    expect(items[0].createdAt).toBe(1765500000000);
  });

  it("reads back a single miniapp record after execute", async () => {
    mockRpc((body) => {
      const [, operation] = body.params as [string, string];
      expect(operation).toBe("getMiniApp");
      return {
        state: "HALT",
        stack: [
          {
            type: "Array",
            value: [
              { type: "ByteString", value: b64("tpl.miniapp.ticket-pass.v1") },
              { type: "ByteString", value: b64("pkg-mini") },
              { type: "ByteString", value: b64("0x" + "cd".repeat(32)) },
              { type: "ByteString", value: b64("{}") },
              { type: "ByteString", value: b64("creator") },
              { type: "Integer", value: "1765500000001" },
            ],
          },
        ],
      };
    });

    const record = await readFactoryRecord("neo-n3-testnet", FACTORY_HASH, "miniapp", "pkg-mini");
    expect(record).not.toBeNull();
    expect(record?.templateId).toBe("tpl.miniapp.ticket-pass.v1");
    expect(record?.packageId).toBe("pkg-mini");
    expect(record?.deployedHash).toBe("");
    expect(record?.createdAt).toBe(1765500000001);
  });

  it("returns null for missing records instead of throwing", async () => {
    mockRpc(() => ({ state: "FAULT", exception: "deployment not found", stack: [] }));
    expect(
      await readFactoryRecord("neo-n3-testnet", FACTORY_HASH, "nep17", "pkg-missing"),
    ).toBeNull();
  });
});
