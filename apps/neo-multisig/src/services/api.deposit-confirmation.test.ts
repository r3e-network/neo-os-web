import { describe, expect, it, vi } from "vitest";

import { createVaultApi } from "./api";
import { createMiniAppFramework } from "@shared/react";
import {
  MAX_SIGNERS,
  MIN_SIGNERS,
  parseVault,
  validateSignerSet,
} from "../utils/vault";
import { addressToScriptHash, ownerMatchesAddress } from "@shared/utils/neo";

const ALICE = "NNLi44dJNXtDNSBkofB48aTVYtb1zZrNEs";
const CONTRACT = "0xa361cdc792e97c4d8ddf42048cf48f3283ea7178";

// 17 distinct, verified-valid Neo N3 addresses (checked against isValidAddress)
// so the up-to-16-signer dynamic-slot tests exercise validateSignerSet for real.
const ADDRESS_POOL = [
  "NaGHNnUiCg9KwmMiuSgtL15DP23LC2q9zT",
  "NaQ2TU4SvUpHg5XHRXVxoCzCSsrQFURY19",
  "NaYLeykiTRJVQizukhq2QuMu3FgMvmGEeA",
  "Nb6V2ZmygXqTobbcJUJFKfNK8U6YqjEJcL",
  "Nb7UjsXESNNt4BYE3FjfuGnkQ5GPvzqfrP",
  "NbkpbWnAJ6YzXZp1t6pa8fZ91mKx5PXBX7",
  "NbMoenNMDgYbSYhdWxKew4DKjfeVU1T9nf",
  "NcHGkZWZLBTHMW2goppyDqBhar11wniBS5",
  "NcHXn5ygdY3AbvBuhtPy3qzEAsCukdx5qR",
  "Ncuf6FUDjJP2iAR7aA1tahv75A3eEMf6Nw",
  "NdcBU7pkQZhLafCyhkQQy1nDA3prR4bHRH",
  "Ndqa8Zn1N9tJv9Z6gbMYtSAtG8kzyE4veT",
  "Nds6RtduGsYk2hh2HTVwvprT6H2MATVo96",
  "NdzYiXrNVv7Yx9Y83RNBcCcoYouuXW44MW",
  "Ne8SNZbt9LeMfZwkZ26rxvxPxnQj9U9vT4",
  "NeozoqRLowoPG5edg7WbSYb1H1BU61YHkp",
  "NeswPZwhDemtAtYyG75MYLL1CXXALiVEDT",
];

function makeAddress(seed: number): string {
  return ADDRESS_POOL[seed % ADDRESS_POOL.length] as string;
}

function makeChain() {
  const invoke = vi.fn(
    async (
      _op: string,
      _args: unknown[],
      _options?: { scriptHash?: string; waitForEvent?: string },
    ) => ({ txid: "0xtx", success: true }),
  );
  const read = vi.fn(async () => null);
  const chain = {
    contractAddress: { get: () => CONTRACT },
    detectNetwork: vi.fn(async () => "mainnet"),
    invoke,
    read,
  };
  return { chain, invoke };
}

/** Wrap the mock chain in the framework and build the vault API on it. */
function makeApi(chain: Record<string, unknown>) {
  const app = createMiniAppFramework(
    { services: { chain }, t: (key: string) => key } as never,
    { appId: "miniapp-neo-multisig" },
  );
  return createVaultApi(app);
}

describe("neo-multisig api — deposit waits for the Deposited event", () => {
  it("passes waitForEvent:'Deposited' on the GAS deposit transfer", async () => {
    const { chain, invoke } = makeChain();
    const api = makeApi(chain);
    await api.deposit({ from: ALICE, vaultId: 1, amount: "2.5", asset: "GAS" });

    const transfer = invoke.mock.calls.find((c) => c[0] === "transfer");
    expect(transfer).toBeTruthy();
    // The success toast + refreshVault must reflect a CONFIRMED, in-block
    // balance change — the deposit transfer settles on the Deposited event.
    expect(transfer![2]).toMatchObject({ waitForEvent: "Deposited" });
  });

  it("passes waitForEvent:'Deposited' on the NEO deposit transfer", async () => {
    const { chain, invoke } = makeChain();
    const api = makeApi(chain);
    await api.deposit({ from: ALICE, vaultId: 1, amount: "3", asset: "NEO" });

    const transfer = invoke.mock.calls.find((c) => c[0] === "transfer");
    expect(transfer![2]).toMatchObject({ waitForEvent: "Deposited" });
  });
});

describe("neo-multisig — dynamic signer slots accept up to 16 signers", () => {
  it("validates a 4-of-5 board (more than the old fixed 3 slots)", () => {
    const signers = Array.from({ length: 5 }, (_, i) => makeAddress(i));
    const set = validateSignerSet(signers, 4);
    expect(set.signers).toHaveLength(5);
    expect(set.threshold).toBe(4);
  });

  it("validates the maximum 16-signer board", () => {
    const signers = Array.from({ length: MAX_SIGNERS }, (_, i) => makeAddress(i));
    const set = validateSignerSet(signers, MAX_SIGNERS);
    expect(set.signers).toHaveLength(MAX_SIGNERS);
  });

  it("rejects more than 16 signers and fewer than 2", () => {
    const tooMany = Array.from({ length: MAX_SIGNERS + 1 }, (_, i) => makeAddress(i));
    expect(() => validateSignerSet(tooMany, 2)).toThrow();
    expect(() => validateSignerSet([makeAddress(0)], 1)).toThrow();
    expect(MIN_SIGNERS).toBe(2);
  });
});

describe("neo-multisig — signer membership comparison", () => {
  it("matches a UInt160 signer hash (chain order) against the connected wallet", () => {
    // getVault returns signers as UInt160 chain values; the parsed signer is the
    // little-endian 0x hash, which is exactly addressToScriptHash(address).
    const aliceHash = addressToScriptHash(ALICE);
    const vault = parseVault({
      id: "1",
      creator: aliceHash,
      threshold: "2",
      signers: [aliceHash, addressToScriptHash(makeAddress(1))],
      createdTime: "0",
      neoBalance: "0",
      gasBalance: "0",
    });
    expect(vault).not.toBeNull();
    // The connected wallet (Alice) is recognized as a signer; a stranger is not.
    expect(
      vault!.signers.some((signer) => ownerMatchesAddress(signer, ALICE)),
    ).toBe(true);
    expect(
      vault!.signers.some((signer) => ownerMatchesAddress(signer, makeAddress(7))),
    ).toBe(false);
  });
});
