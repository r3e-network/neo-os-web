import { describe, expect, it, vi } from "vitest";

import { addressToScriptHash } from "../utils/neo";
import {
  createVaultApi,
  type VaultChain,
} from "../../neo-multisig/src/services/api";
import {
  buildApproveArgs,
  buildCreateRequestArgs,
  buildCreateVaultArgs,
  buildDepositArgs,
  fromBaseUnits,
  GAS_HASH,
  isValidAddress,
  isValidAmount,
  NEO_HASH,
  parseRequest,
  parseVault,
  statusFromCode,
  toBaseUnits,
  validateSignerSet,
} from "../../neo-multisig/src/utils/vault";

const SIGNER_A = "NgebdUkFxSbzLMruXopuBw4aKsXX8sTyxw";
const SIGNER_B = "NZeAarn3UMCqNsTymTMF2Pn6X7Yw3GhqDv";
const RECIPIENT = "NhMYxG5ATmRjSy6ocnPxrA2DiYba6xhFqu";
const VAULT_CONTRACT = "0xa89f8dd1ebc0e29561c4c3e9ad60ec307b9a473e";

/** Build a mock VaultChain that records invoke/read calls. */
function mockChain(reads: Record<string, unknown> = {}): VaultChain & {
  invoke: ReturnType<typeof vi.fn>;
  read: ReturnType<typeof vi.fn>;
} {
  const invoke = vi.fn().mockResolvedValue({ txid: "0xtx", success: true });
  const read = vi.fn(async (operation: string) => reads[operation] ?? null);
  return {
    invoke,
    read,
    contractAddress: { get: () => VAULT_CONTRACT },
  };
}

describe("neo-multisig vault validation", () => {
  it("accepts valid Neo N3 signer addresses and rejects public keys", () => {
    expect(isValidAddress(SIGNER_A)).toBe(true);
    // A compressed public key is NOT a valid signer in the new model.
    expect(isValidAddress(`02${"11".repeat(32)}`)).toBe(false);
    expect(isValidAddress("not-an-address")).toBe(false);
  });

  it("validates the signer set (2..16 distinct, threshold range)", () => {
    expect(validateSignerSet([SIGNER_A, SIGNER_B], 2)).toEqual({
      signers: [SIGNER_A, SIGNER_B],
      threshold: 2,
    });

    expect(() => validateSignerSet([SIGNER_A], 1)).toThrow(/between 2 and 16/);
    expect(() => validateSignerSet([SIGNER_A, SIGNER_A], 1)).toThrow(/distinct/);
    expect(() => validateSignerSet([SIGNER_A, SIGNER_B], 3)).toThrow(
      /Threshold/,
    );
    expect(() => validateSignerSet([SIGNER_A, "bad"], 1)).toThrow(
      /valid Neo N3 address/,
    );
  });

  it("treats GAS as 1e8 base units and NEO as indivisible integers", () => {
    expect(toBaseUnits("1", "GAS")).toBe("100000000");
    expect(toBaseUnits("0.03", "GAS")).toBe("3000000");
    expect(toBaseUnits("12", "NEO")).toBe("12");
    expect(() => toBaseUnits("1.5", "NEO")).toThrow(/whole token/);

    expect(isValidAmount("0.03", "GAS")).toBe(true);
    expect(isValidAmount("1.5", "NEO")).toBe(false);
    expect(isValidAmount("0", "GAS")).toBe(false);

    expect(fromBaseUnits("3000000", "GAS")).toBe("0.03");
    expect(fromBaseUnits("100000000", "GAS")).toBe("1");
    expect(fromBaseUnits("7", "NEO")).toBe("7");
  });
});

describe("neo-multisig contract-arg builders", () => {
  it("builds createVault args with an Array of Hash160 signers", () => {
    const args = buildCreateVaultArgs(SIGNER_A, {
      signers: [SIGNER_A, SIGNER_B],
      threshold: 2,
    });

    expect(args[0]).toEqual({
      type: "Hash160",
      value: addressToScriptHash(SIGNER_A),
    });
    expect(args[1]).toEqual({
      type: "Array",
      value: [
        { type: "Hash160", value: addressToScriptHash(SIGNER_A) },
        { type: "Hash160", value: addressToScriptHash(SIGNER_B) },
      ],
    });
    expect(args[2]).toEqual({ type: "Integer", value: "2" });
  });

  it("builds a deposit transfer carrying the vaultId as transfer data", () => {
    const args = buildDepositArgs({
      from: SIGNER_A,
      contractHash: VAULT_CONTRACT,
      vaultId: 7,
      amount: "1",
      asset: "GAS",
    });

    expect(args).toEqual([
      { type: "Hash160", value: addressToScriptHash(SIGNER_A) },
      { type: "Hash160", value: VAULT_CONTRACT },
      { type: "Integer", value: "100000000" },
      { type: "Integer", value: "7" },
    ]);
  });

  it("builds createRequest args with the asset hash and base-unit amount", () => {
    const gasArgs = buildCreateRequestArgs({
      vaultId: 7,
      creator: SIGNER_A,
      recipient: RECIPIENT,
      asset: "GAS",
      amount: "0.5",
      memo: "rent",
    });
    expect(gasArgs).toEqual([
      { type: "Integer", value: "7" },
      { type: "Hash160", value: addressToScriptHash(SIGNER_A) },
      { type: "Hash160", value: addressToScriptHash(RECIPIENT) },
      { type: "Hash160", value: GAS_HASH },
      { type: "Integer", value: "50000000" },
      { type: "String", value: "rent" },
    ]);

    const neoArgs = buildCreateRequestArgs({
      vaultId: 7,
      creator: SIGNER_A,
      recipient: RECIPIENT,
      asset: "NEO",
      amount: "3",
      memo: "",
    });
    expect(neoArgs[3]).toEqual({ type: "Hash160", value: NEO_HASH });
    expect(neoArgs[4]).toEqual({ type: "Integer", value: "3" });
  });

  it("builds approve args (reqId + signer)", () => {
    expect(buildApproveArgs(9, SIGNER_B)).toEqual([
      { type: "Integer", value: "9" },
      { type: "Hash160", value: addressToScriptHash(SIGNER_B) },
    ]);
  });
});

describe("neo-multisig read parsing", () => {
  it("parses a getVault Map into a VaultView", () => {
    const vault = parseVault({
      id: 7,
      creator: addressToScriptHash(SIGNER_A),
      threshold: 2,
      signers: [addressToScriptHash(SIGNER_A), addressToScriptHash(SIGNER_B)],
      createdTime: 1700000000000,
      neoBalance: 5,
      gasBalance: 100000000,
    });

    expect(vault).toMatchObject({
      id: 7,
      threshold: 2,
      neoBalance: 5,
      gasBalance: 100000000,
    });
    expect(vault?.signers).toHaveLength(2);
    expect(parseVault({ id: 0 })).toBeNull();
    expect(parseVault(null)).toBeNull();
  });

  it("parses a getRequest Map and maps the status code", () => {
    const request = parseRequest({
      id: 4,
      vaultId: 7,
      creator: addressToScriptHash(SIGNER_A),
      recipient: addressToScriptHash(RECIPIENT),
      asset: GAS_HASH,
      amount: 50000000,
      approvalCount: 1,
      status: 0,
      createdTime: 1700000000000,
      memo: "rent",
    });

    expect(request).toMatchObject({
      id: 4,
      vaultId: 7,
      assetSymbol: "GAS",
      amount: 50000000,
      approvalCount: 1,
      status: "pending",
    });

    expect(statusFromCode(1)).toBe("executed");
    expect(statusFromCode(2)).toBe("cancelled");
  });
});

describe("neo-multisig vault service", () => {
  it("dispatches createVault with validated args", async () => {
    const chain = mockChain({ lastVaultId: 7 });
    const api = createVaultApi(chain);

    await api.createVault({
      creator: SIGNER_A,
      signers: [SIGNER_A, SIGNER_B],
      threshold: 2,
    });

    expect(chain.invoke).toHaveBeenCalledWith("createVault", [
      { type: "Hash160", value: addressToScriptHash(SIGNER_A) },
      {
        type: "Array",
        value: [
          { type: "Hash160", value: addressToScriptHash(SIGNER_A) },
          { type: "Hash160", value: addressToScriptHash(SIGNER_B) },
        ],
      },
      { type: "Integer", value: "2" },
    ]);
  });

  it("rejects an invalid signer set before invoking the contract", async () => {
    const chain = mockChain();
    const api = createVaultApi(chain);

    await expect(
      api.createVault({ creator: SIGNER_A, signers: [SIGNER_A], threshold: 1 }),
    ).rejects.toThrow(/between 2 and 16/);
    expect(chain.invoke).not.toHaveBeenCalled();
  });

  it("deposits via a NEP-17 transfer targeting the token contract", async () => {
    const chain = mockChain();
    const api = createVaultApi(chain);

    await api.deposit({ from: SIGNER_A, vaultId: 7, amount: "1", asset: "GAS" });

    expect(chain.invoke).toHaveBeenCalledWith(
      "transfer",
      [
        { type: "Hash160", value: addressToScriptHash(SIGNER_A) },
        { type: "Hash160", value: VAULT_CONTRACT },
        { type: "Integer", value: "100000000" },
        { type: "Integer", value: "7" },
      ],
      { scriptHash: GAS_HASH },
    );
  });

  it("dispatches createRequest and approve against the vault contract", async () => {
    const chain = mockChain({ lastRequestId: 4 });
    const api = createVaultApi(chain);

    await api.createRequest({
      vaultId: 7,
      creator: SIGNER_A,
      recipient: RECIPIENT,
      asset: "GAS",
      amount: "0.5",
      memo: "rent",
    });
    expect(chain.invoke).toHaveBeenCalledWith("createRequest", [
      { type: "Integer", value: "7" },
      { type: "Hash160", value: addressToScriptHash(SIGNER_A) },
      { type: "Hash160", value: addressToScriptHash(RECIPIENT) },
      { type: "Hash160", value: GAS_HASH },
      { type: "Integer", value: "50000000" },
      { type: "String", value: "rent" },
    ]);

    await api.approve(4, SIGNER_B);
    expect(chain.invoke).toHaveBeenCalledWith("approve", [
      { type: "Integer", value: "4" },
      { type: "Hash160", value: addressToScriptHash(SIGNER_B) },
    ]);
  });

  it("reads vault and request state back from the contract", async () => {
    const chain = mockChain({
      getVault: {
        id: 7,
        creator: addressToScriptHash(SIGNER_A),
        threshold: 2,
        signers: [addressToScriptHash(SIGNER_A), addressToScriptHash(SIGNER_B)],
        createdTime: 1700000000000,
        neoBalance: 0,
        gasBalance: 100000000,
      },
      getRequest: {
        id: 4,
        vaultId: 7,
        creator: addressToScriptHash(SIGNER_A),
        recipient: addressToScriptHash(RECIPIENT),
        asset: GAS_HASH,
        amount: 50000000,
        approvalCount: 2,
        status: 1,
        createdTime: 1700000000000,
        memo: "rent",
      },
    });
    const api = createVaultApi(chain);

    const vault = await api.getVault(7);
    expect(vault?.gasBalance).toBe(100000000);

    const request = await api.getRequest(4);
    expect(request?.status).toBe("executed");
    expect(request?.assetSymbol).toBe("GAS");
  });
});
