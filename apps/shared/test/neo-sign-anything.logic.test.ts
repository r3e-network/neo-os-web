import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { createObservable } from "../react/context";
import { createMiniAppFramework } from "../react";
import { BLOCKCHAIN_CONSTANTS } from "../constants";
import { addressToScriptHash } from "../utils/neo";
import { useSignAnything } from "../../neo-sign-anything/src/composables/useSignAnything";

const ADDRESS = "NNLi44dJNXtDNSBkofB48aTVYtb1zZrNEs";
// The transfer Hash160 args are built via app.chain.arg.hash160, which yields
// the 0x little-endian script hash — on-chain-identical to passing the base58
// address (the interaction layer converts either form to the same UInt160).
const ADDRESS_HASH = addressToScriptHash(ADDRESS);

function t(key: string) {
  return key;
}

function setup(options: { signResult?: unknown; txid?: string } = {}) {
  const { signResult = { signature: "0xsig", publicKey: "0xpubkey" }, txid = "0xbroadcasttx" } =
    options;

  const signMessage = vi.fn(async () => signResult);
  const invoke = vi.fn(async () => ({ txid, success: Boolean(txid) }));
  const ensureWallet = vi.fn(async () => ADDRESS);
  const chain = {
    address: createObservable<string | null>(ADDRESS),
    ensureWallet,
    signMessage,
    invoke,
  } as never;

  const store: Record<string, unknown> = {};
  const storage = {
    get: vi.fn(async (key: string) => store[key]),
    set: vi.fn(async (key: string, value: unknown) => {
      store[key] = value;
    }),
  };

  const framework = createMiniAppFramework(
    { services: { chain }, os: { storage }, t } as never,
    { appId: "miniapp-neo-sign-anything" },
  );
  const app = useSignAnything({ app: framework, t });
  return { app, signMessage, invoke, storage, store };
}

beforeEach(() => {
  // crypto.subtle.digest is available in the vitest (jsdom/node) environment.
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("useSignAnything", () => {
  it("keeps the signature and txHash visible together for the same message", async () => {
    const { app } = setup();

    await app.signMessage("ship it");
    expect(app.signature.get()).toBe("0xsig");
    expect(app.txHash.get()).toBe("");

    // Broadcasting the SAME message must NOT wipe the signature — sign-then-anchor
    // is the natural journey and both artifacts describe the same message.
    await app.broadcastMessage("ship it");
    expect(app.signature.get()).toBe("0xsig");
    expect(app.txHash.get()).toBe("0xbroadcasttx");
  });

  it("clears both artifacts when the message changes", async () => {
    const { app } = setup();

    await app.signMessage("first");
    await app.broadcastMessage("first");
    expect(app.signature.get()).toBeTruthy();
    expect(app.txHash.get()).toBeTruthy();

    // A different message invalidates both prior artifacts.
    await app.signMessage("second");
    expect(app.signature.get()).toBe("0xsig");
    expect(app.txHash.get()).toBe("");
  });

  it("captures the signer public key so the signature is verifiable", async () => {
    const { app } = setup();

    await app.signMessage("verify me");
    expect(app.publicKey.get()).toBe("0xpubkey");
  });

  it("never writes prose into the copyable txHash field when no txid returns", async () => {
    const { app } = setup({ txid: "" });

    await app.broadcastMessage("pending tx");
    // txHash stays empty (so Copy copies nothing / stays disabled); the pending
    // state is surfaced separately.
    expect(app.txHash.get()).toBe("");
    expect(app.txPending.get()).toBe(true);
  });

  it("broadcasts a 0-GAS self-transfer on the native GAS contract", async () => {
    const { app, invoke } = setup();

    await app.broadcastMessage("on-chain note");
    expect(invoke).toHaveBeenCalledWith(
      "transfer",
      [
        { type: "Hash160", value: ADDRESS_HASH },
        { type: "Hash160", value: ADDRESS_HASH },
        { type: "Integer", value: "0" },
        { type: "String", value: "on-chain note" },
      ],
      { scriptHash: BLOCKCHAIN_CONSTANTS.GAS_HASH },
    );
  });

  it("hashes a file locally and loads its sha256 digest into the message", async () => {
    const { app } = setup();

    const file = new File(["report contents"], "report.pdf", { type: "application/pdf" });
    const payload = await app.loadFileDigest(file);

    expect(payload).toMatch(/^sha256:[0-9a-f]{64}$/);
    expect(app.message.get()).toBe(payload);
  });
});
