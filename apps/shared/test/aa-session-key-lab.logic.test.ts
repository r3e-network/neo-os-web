import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { createMiniAppFramework } from "../react";
import type { AAService, ChainService } from "../services";
import { useAASessionKeyLab } from "../../aa-session-key-lab/src/composables/useAASessionKeyLab";
import {
  CANONICAL_SESSION_KEY_CONTRACTS,
  normalizeSessionAccount,
  readSessionTransactionState,
} from "../../aa-session-key-lab/src/session-key-chain";
import { getSessionKeyLaunchDefaults } from "../../aa-session-key-lab/src/launch";

const OWNER_ADDRESS = "NR3E4D8NUXh3zhbf5ZkAp3rTxWbQqNih32";
const OWNER_HASH = "0x6d0656f6dd91469db1c90cc1e574380613f43738";
const ACCOUNT_ID = "0xcbc8faecd19d509790e8e32e25791602aa278705";
const PUBLIC_KEY = `03${"11".repeat(32)}`;
const TARGET = "0xaba84da240a55410d284a656fc8dae044e6ec1a5";
const TXID = `0x${"ab".repeat(32)}`;

function hashStack(displayHash: string) {
  const bytes = Buffer.from(displayHash.replace(/^0x/, ""), "hex");
  return { type: "ByteString", value: Buffer.from(bytes).reverse().toString("base64") };
}

function bytesStack(hex: string) {
  return { type: "ByteString", value: Buffer.from(hex.replace(/^0x/, ""), "hex").toString("base64") };
}

function textStack(value: string) {
  return { type: "ByteString", value: Buffer.from(value).toString("base64") };
}

function sessionStack(input: { expiresAt: number; spendingLimitRaw?: string }) {
  const values: unknown[] = [
    bytesStack(PUBLIC_KEY),
    hashStack(TARGET),
    textStack("claimRewards"),
    { type: "Integer", value: String(input.expiresAt * 1000) },
  ];
  if (input.spendingLimitRaw !== undefined) {
    values.push({ type: "Integer", value: input.spendingLimitRaw });
  }
  return { type: "Struct", value: values };
}

function makeApp(chain: ChainService, aa?: AAService, network = "neo-n3-mainnet") {
  return createMiniAppFramework(
    {
      services: { chain, aa },
      t: (key: string) => key,
      launchContext: { network },
    } as never,
    { appId: "miniapp-aa-session-key-lab" },
  );
}

function t(key: string) {
  return key;
}

function setupChain(options: {
  network?: "mainnet" | "testnet";
  initialSession?: boolean;
  confirmWrites?: boolean;
  ownerHash?: string;
  boundVerifier?: string;
} = {}) {
  const network = options.network ?? "mainnet";
  const contracts = CANONICAL_SESSION_KEY_CONTRACTS[network];
  const expiresAt = Math.floor(Date.now() / 1000) + 3_600;
  let hasSession = options.initialSession ?? false;
  const confirmWrites = options.confirmWrites ?? true;
  const read = vi.fn(async (operation: string) => {
    if (operation === "getBackupOwner") return hashStack(options.ownerHash ?? OWNER_HASH);
    if (operation === "getVerifier") return hashStack(options.boundVerifier ?? contracts.verifier);
    if (operation === "authorizedCore") return hashStack(contracts.aaCore);
    if (operation === "getSpentAmount") return "0";
    if (operation === "getSessionKey") {
      return hasSession
        ? sessionStack({
            expiresAt,
            ...(contracts.allowanceSupported ? { spendingLimitRaw: "150000000" } : {}),
          })
        : null;
    }
    return null;
  });
  const invoke = vi.fn(async (_operation: string, args: Array<{ value?: unknown }>) => {
    const verifierOperation = String(args[1]?.value ?? "");
    if (confirmWrites) hasSession = verifierOperation === "setSessionKey";
    return { txid: TXID, success: true };
  });
  const chain = {
    address: { get: () => OWNER_ADDRESS, subscribe: () => () => {} },
    contractAddress: { get: () => contracts.verifier, subscribe: () => () => {} },
    ensureWallet: vi.fn(async () => OWNER_ADDRESS),
    detectNetwork: vi.fn(async () => `neo-n3-${network}`),
    read,
    invoke,
  } as unknown as ChainService;
  return {
    chain,
    invoke,
    read,
    expiresAt,
    setSession(value: boolean) { hasSession = value; },
  };
}

function populateForm(lab: ReturnType<typeof useAASessionKeyLab>, expiresAt: number) {
  lab.form.accountSeed = ACCOUNT_ID;
  lab.form.sessionPublicKey = PUBLIC_KEY;
  lab.form.targetContract = TARGET;
  lab.form.allowedMethod = "claimRewards";
  lab.form.expiresAt = String(expiresAt);
  lab.form.spendingLimit = "1.5";
  lab.form.description = "rewards bot";
}

beforeEach(() => localStorage.clear());
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
  localStorage.clear();
});

describe("AA Session Key Lab production logic", () => {
  it("keeps a user-entered display-order AccountId byte-exact", () => {
    expect(normalizeSessionAccount(ACCOUNT_ID)).toBe(ACCOUNT_ID);
    expect(normalizeSessionAccount(OWNER_ADDRESS)).toBe(OWNER_HASH);
  });

  it("requires an existing exact AccountId instead of deriving a demo account from a seed", async () => {
    const mock = setupChain();
    const lab = useAASessionKeyLab({ app: makeApp(mock.chain), t });
    lab.form.accountSeed = "neo-aa-001";

    await expect(lab.inspectSessionKey()).resolves.toBeNull();
    expect(lab.lastError.get()).toBe("invalidSessionAccountId");
    expect(mock.read).not.toHaveBeenCalled();
  });

  it("passes exact paymaster scope and amount", async () => {
    const aa = {
      checkSponsorship: vi.fn().mockResolvedValue({ eligible: true }),
      requestSponsorship: vi.fn().mockResolvedValue({ approved: true }),
    } as unknown as AAService;
    const lab = useAASessionKeyLab({ app: makeApp({} as ChainService, aa), t });
    lab.form.dappId = "miniapp-aa-session-key-lab";
    lab.form.sponsorAmount = "0.2";

    await lab.checkSponsor();
    await lab.requestSponsor();

    expect(aa.checkSponsorship).toHaveBeenCalledWith({ dappId: "miniapp-aa-session-key-lab" });
    expect(aa.requestSponsorship).toHaveBeenCalledWith("0.2", { dappId: "miniapp-aa-session-key-lab" });
  });

  it("normalizes launch aliases and never places the private key in detail rows", () => {
    expect(getSessionKeyLaunchDefaults({
      params: {
        accountId: ACCOUNT_ID,
        publicKey: "02abcdef",
        contract: TARGET,
        method: "claimRewards",
        expiry: "1893456000",
        paymaster: "miniapp-aa-session-key-lab",
        gas: "0.2",
      },
    })).toEqual({
      accountSeed: ACCOUNT_ID,
      sessionPublicKey: "02abcdef",
      targetContract: TARGET,
      allowedMethod: "claimRewards",
      expiresAt: "1893456000",
      dappId: "miniapp-aa-session-key-lab",
      sponsorAmount: "0.2",
    });

    const lab = useAASessionKeyLab({ app: makeApp({} as ChainService), t });
    lab.generateSessionKey();
    expect(lab.generatedPrivateKey.get()).toMatch(/^[0-9a-f]{64}$/i);
    expect(lab.detailItems.get().map((item) => item.value)).not.toContain(lab.generatedPrivateKey.get());
  });

  it("submits the mainnet 7-field object in milliseconds and confirms exact readback", async () => {
    vi.useFakeTimers();
    const mock = setupChain();
    const lab = useAASessionKeyLab({ app: makeApp(mock.chain), t });
    populateForm(lab, mock.expiresAt);

    const submission = lab.configureSessionKey();
    await vi.runAllTimersAsync();
    await expect(submission).resolves.toEqual({ status: "confirmed", txid: TXID });

    const [, args] = mock.invoke.mock.calls[0];
    const inner = args[2] as { type: string; value: Array<{ type: string; value: string }> };
    expect(inner.type).toBe("Array");
    expect(inner.value).toHaveLength(7);
    expect(inner.value[4]).toEqual({ type: "Integer", value: String(mock.expiresAt * 1000) });
    expect(inner.value[5]).toEqual({ type: "Integer", value: "150000000" });
    expect(lab.sessionReadStatus.get()).toBe("active");
    expect(lab.pendingWrite.get()).toBeNull();
  });

  it("uses the frozen testnet 5-field ABI and does not invent an allowance", async () => {
    vi.useFakeTimers();
    const mock = setupChain({ network: "testnet" });
    const lab = useAASessionKeyLab({ app: makeApp(mock.chain, undefined, "neo-n3-testnet"), t });
    populateForm(lab, mock.expiresAt);

    const submission = lab.configureSessionKey();
    await vi.runAllTimersAsync();
    await submission;

    const [, args] = mock.invoke.mock.calls[0];
    const inner = args[2] as { value: unknown[] };
    expect(inner.value).toHaveLength(5);
    expect(lab.allowanceSupported.get()).toBe(false);
    expect(lab.onChainSessionView.get()?.decoded.spendingLimitSupported).toBe(false);
    expect(lab.onChainSessionView.get()?.spentGas).toBe("");
  });

  it("blocks stale network, wrong owner, and wrong verifier before invoking", async () => {
    const wrongNetwork = setupChain();
    wrongNetwork.chain.detectNetwork = vi.fn(async () => "neo-n3-testnet") as never;
    const networkLab = useAASessionKeyLab({ app: makeApp(wrongNetwork.chain), t });
    populateForm(networkLab, wrongNetwork.expiresAt);
    await expect(networkLab.configureSessionKey()).rejects.toThrow("sessionWalletNetworkMismatch");
    expect(wrongNetwork.invoke).not.toHaveBeenCalled();

    const wrongOwner = setupChain({ ownerHash: `0x${"44".repeat(20)}` });
    const ownerLab = useAASessionKeyLab({ app: makeApp(wrongOwner.chain), t });
    populateForm(ownerLab, wrongOwner.expiresAt);
    await expect(ownerLab.configureSessionKey()).rejects.toThrow("sessionOwnerWalletRequired");
    expect(wrongOwner.invoke).not.toHaveBeenCalled();

    const wrongVerifier = setupChain({ boundVerifier: `0x${"55".repeat(20)}` });
    const verifierLab = useAASessionKeyLab({ app: makeApp(wrongVerifier.chain), t });
    populateForm(verifierLab, wrongVerifier.expiresAt);
    await expect(verifierLab.configureSessionKey()).rejects.toThrow("sessionVerifierBindingMismatch");
    expect(wrongVerifier.invoke).not.toHaveBeenCalled();
  });

  it("keeps a broadcast write recoverable until exact readback and never fakes active state", async () => {
    vi.useFakeTimers();
    const mock = setupChain({ confirmWrites: false });
    const lab = useAASessionKeyLab({ app: makeApp(mock.chain), t });
    populateForm(lab, mock.expiresAt);

    const submission = lab.configureSessionKey().then(
      () => null,
      (error: unknown) => error,
    );
    await vi.runAllTimersAsync();
    expect(await submission).toEqual(expect.objectContaining({ message: "sessionConfirmationPending" }));
    expect(lab.hasOnChainSession.get()).toBe(false);
    expect(lab.writePhase.get()).toBe("recoverable");
    expect(lab.pendingWrite.get()?.txid).toBe(TXID);

    mock.setSession(true);
    await expect(lab.recoverPendingWrite()).resolves.toEqual({ status: "confirmed", txid: TXID });
    expect(lab.hasOnChainSession.get()).toBe(true);
    expect(lab.pendingWrite.get()).toBeNull();
  });

  it("clears a saved transaction only after getapplicationlog proves VM FAULT", async () => {
    vi.useFakeTimers();
    const mock = setupChain({ confirmWrites: false });
    const lab = useAASessionKeyLab({
      app: makeApp(mock.chain),
      t,
      transactionStateReader: async () => "fault",
    });
    populateForm(lab, mock.expiresAt);

    const submission = lab.configureSessionKey().catch((error: unknown) => error);
    await vi.runAllTimersAsync();
    await submission;

    await expect(lab.recoverPendingWrite()).resolves.toEqual({ status: "fault", txid: TXID });
    expect(lab.pendingWrite.get()).toBeNull();
    expect(lab.writePhase.get()).toBe("failed");
    expect(lab.lastError.get()).toBe("sessionTransactionFaulted");
  });

  it("parses HALT, FAULT, and unavailable transaction logs without guessing", async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ result: { executions: [{ vmstate: "HALT" }] } }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ result: { executions: [{ vmstate: "FAULT, BREAK" }] } }), { status: 200 }))
      .mockRejectedValueOnce(new TypeError("offline"));
    vi.stubGlobal("fetch", fetchMock);

    await expect(readSessionTransactionState("mainnet", TXID)).resolves.toBe("halt");
    await expect(readSessionTransactionState("mainnet", TXID)).resolves.toBe("fault");
    await expect(readSessionTransactionState("mainnet", TXID)).resolves.toBe("unknown");
  });

  it("replaces a prior live snapshot with unavailable state when reads fail", async () => {
    const mock = setupChain({ initialSession: true });
    const lab = useAASessionKeyLab({ app: makeApp(mock.chain), t });
    lab.form.accountSeed = ACCOUNT_ID;

    await lab.inspectSessionKey();
    expect(lab.sessionReadStatus.get()).toBe("active");
    expect(lab.hasOnChainSession.get()).toBe(true);

    mock.read.mockRejectedValue(new Error("rpc unavailable"));
    await lab.inspectSessionKey();
    expect(lab.accountReadStatus.get()).toBe("unavailable");
    expect(lab.sessionReadStatus.get()).toBe("unavailable");
    expect(lab.hasOnChainSession.get()).toBe(false);
    expect(lab.onChainSessionView.get()).toBeNull();
  });

  it("revokes only a live record and waits for on-chain absence", async () => {
    vi.useFakeTimers();
    const mock = setupChain({ initialSession: true });
    const lab = useAASessionKeyLab({ app: makeApp(mock.chain), t });
    populateForm(lab, mock.expiresAt);

    const revocation = lab.revokeSessionKey();
    await vi.runAllTimersAsync();
    await expect(revocation).resolves.toEqual({ status: "confirmed", txid: TXID });

    expect(mock.invoke.mock.calls[0][1][1]).toEqual({ type: "String", value: "clearSessionKey" });
    expect(lab.sessionReadStatus.get()).toBe("absent");
    expect(lab.hasOnChainSession.get()).toBe(false);
  });
});
