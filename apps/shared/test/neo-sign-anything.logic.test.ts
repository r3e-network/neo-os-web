import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { createObservable } from "../react/context";
import { createMiniAppFramework } from "../react";
import { addressToScriptHash } from "../utils/neo";
import { useSignAnything } from "../../neo-sign-anything/src/composables/useSignAnything";
import {
  MAX_FILE_BYTES,
  SIGNATURE_PROOF_SCHEMA,
  SIGNING_ENVELOPE_SCHEMA,
  normalizeWalletSignature,
  sanitizeSignatureHistory,
} from "../../neo-sign-anything/src/signing-artifact";

const ADDRESS = "NNLi44dJNXtDNSBkofB48aTVYtb1zZrNEs";
const SECOND_ADDRESS = "NZeAarn3UMCqNsTymTMF2Pn6X7Yw3GhqDv";
const SIGNATURE = `0x${"11".repeat(64)}`;
const PUBLIC_KEY = `0x02${"22".repeat(32)}`;

function t(key: string) {
  return key;
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

let appSequence = 0;

function setup(options: {
  address?: string | null;
  network?: string;
  signResult?: unknown;
  signImplementation?: () => Promise<unknown>;
} = {}) {
  let activeNetwork = options.network ?? "neo-n3-mainnet";
  const address = createObservable<string | null>(options.address === undefined ? ADDRESS : options.address);
  const signMessage = vi.fn(
    options.signImplementation ??
      (async () => options.signResult ?? { data: SIGNATURE, publicKey: PUBLIC_KEY }),
  );
  const ensureWallet = vi.fn(async () => {
    if (!address.get()) address.set(ADDRESS);
    return address.get() ?? ADDRESS;
  });
  const detectNetwork = vi.fn(async () => activeNetwork);
  const chain = {
    address,
    ensureWallet,
    detectNetwork,
    signMessage,
    invoke: vi.fn(),
  } as never;

  const framework = createMiniAppFramework(
    { services: { chain }, t } as never,
    { appId: `miniapp-neo-sign-anything-test-${++appSequence}` },
  );
  const app = useSignAnything({ app: framework, t });
  return {
    app,
    address,
    signMessage,
    detectNetwork,
    setNetwork(value: string) {
      activeNetwork = value;
    },
  };
}

beforeEach(() => {
  window.localStorage.clear();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("useSignAnything production signing flow", () => {
  it("signs a purpose-bound envelope and exports the exact accepted bytes", async () => {
    const { app, signMessage } = setup();
    app.setMessage("ship it");

    const proof = await app.signMessage();

    expect(proof?.schema).toBe(SIGNATURE_PROOF_SCHEMA);
    expect(signMessage).toHaveBeenCalledTimes(1);
    const exactPayload = String(signMessage.mock.calls[0][0]);
    expect(exactPayload).toContain(`${SIGNING_ENVELOPE_SCHEMA}\ndomain:neo-sign-anything`);
    expect(exactPayload).toContain(`network:neo-n3-mainnet\naccount:${ADDRESS}`);
    expect(exactPayload).toMatch(/content-sha256:[0-9a-f]{64}/);
    expect(exactPayload.endsWith("\n\nship it")).toBe(true);
    expect(proof?.payload.exactText).toBe(exactPayload);
    expect(proof?.payload.sha256).toMatch(/^[0-9a-f]{64}$/);
    expect(proof?.signature.value).toBe(SIGNATURE);
    expect(proof?.signature.publicKey).toBe(PUBLIC_KEY.toLowerCase());
    expect(proof?.assurance).toEqual({
      status: "wallet-returned",
      cryptographicallyVerifiedHere: false,
    });
    expect(JSON.parse(app.proofBundle.get()).payload.exactText).toBe(exactPayload);
  });

  it("supports byte-for-byte exact challenge signing without an envelope", async () => {
    const { app, signMessage } = setup({ network: "testnet" });
    app.setSigningMode("exact");
    app.setMessage("challenge:\n  keep spacing");

    const proof = await app.signMessage();

    expect(signMessage).toHaveBeenCalledWith("challenge:\n  keep spacing");
    expect(proof?.payload.mode).toBe("exact");
    expect(proof?.payload.domain).toBeNull();
    expect(proof?.signer.network).toBe("neo-n3-testnet");
    expect(proof?.signer.binding).toBe("observed-request-context");
  });

  it("previews exact UTF-8 bytes before a wallet is connected", async () => {
    const { app, detectNetwork } = setup({ address: null });
    app.setSigningMode("exact");
    app.setMessage("challenge:\n  review first");

    await vi.waitFor(() => expect(app.payloadStatus.get()).toBe("ready"));

    expect(app.payloadText.get()).toBe("challenge:\n  review first");
    expect(app.payloadHash.get()).toMatch(/^[0-9a-f]{64}$/);
    expect(app.network.get()).toBe("");
    expect(detectNetwork).not.toHaveBeenCalled();
  });

  it("hashes a file locally and binds its metadata into the signed envelope", async () => {
    const { app, signMessage } = setup();
    const file = new File(["report contents"], "Quarterly report.pdf", {
      type: "application/pdf",
    });

    const payload = await app.loadFileDigest(file);
    const proof = await app.signMessage();

    expect(payload).toMatch(/^sha256:[0-9a-f]{64}$/);
    expect(app.fileInfo.get()).toMatchObject({
      name: "Quarterly report.pdf",
      size: file.size,
      type: "application/pdf",
      payload,
    });
    const exactPayload = String(signMessage.mock.calls[0][0]);
    expect(exactPayload).toContain("kind:file-digest");
    expect(exactPayload).toContain("file-name-uri:Quarterly+report.pdf");
    expect(exactPayload).toContain(`file-bytes:${file.size}`);
    expect(proof?.payload.file?.payload).toBe(payload);
  });

  it("clears a proof immediately when any signed input changes", async () => {
    const { app } = setup();
    app.setMessage("first");
    await app.signMessage();
    expect(app.signature.get()).toBe(SIGNATURE);

    app.setMessage("second");

    expect(app.signature.get()).toBe("");
    expect(app.publicKey.get()).toBe("");
    expect(app.artifact.get()).toBeNull();
    expect(app.proofBundle.get()).toBe("");
  });

  it("discards a wallet result when the account changes during approval", async () => {
    const pending = deferred<unknown>();
    const { app, address, signMessage } = setup({
      signImplementation: () => pending.promise,
    });
    app.setMessage("account-bound statement");

    const signing = app.signMessage();
    await vi.waitFor(() => expect(signMessage).toHaveBeenCalledTimes(1));
    address.set(SECOND_ADDRESS);
    pending.resolve({ data: SIGNATURE, publicKey: PUBLIC_KEY });

    await expect(signing).rejects.toThrow("signingContextChanged");
    expect(app.operationStatus.get()).toBe("stale");
    expect(app.signature.get()).toBe("");
    expect(app.signCount.get()).toBe(0);
  });

  it("collapses concurrent signing attempts into one wallet request", async () => {
    const pending = deferred<unknown>();
    const { app, signMessage } = setup({
      signImplementation: () => pending.promise,
    });
    app.setMessage("one approval only");

    const first = app.signMessage();
    await vi.waitFor(() => expect(signMessage).toHaveBeenCalledTimes(1));
    await expect(app.signMessage()).resolves.toBeNull();
    expect(signMessage).toHaveBeenCalledTimes(1);

    pending.resolve({ data: SIGNATURE, publicKey: PUBLIC_KEY });
    await expect(first).resolves.toMatchObject({ schema: SIGNATURE_PROOF_SCHEMA });
  });

  it("rejects a wallet-reported signer that does not match the prepared account", async () => {
    const { app } = setup({
      signResult: {
        data: SIGNATURE,
        publicKey: PUBLIC_KEY,
        account: addressToScriptHash(SECOND_ADDRESS),
      },
    });
    app.setMessage("bind the signer account");

    await expect(app.signMessage()).rejects.toThrow("walletSignerMismatch");
    expect(app.operationStatus.get()).toBe("stale");
    expect(app.signature.get()).toBe("");
    expect(app.artifact.get()).toBeNull();
    expect(app.signCount.get()).toBe(0);
  });

  it("discards a wallet result when the Neo network changes during approval", async () => {
    const pending = deferred<unknown>();
    const { app, setNetwork, signMessage } = setup({
      signImplementation: () => pending.promise,
    });
    app.setMessage("network-bound statement");

    const signing = app.signMessage();
    await vi.waitFor(() => expect(signMessage).toHaveBeenCalledTimes(1));
    setNetwork("neo-n3-testnet");
    pending.resolve({ data: SIGNATURE, publicKey: PUBLIC_KEY });

    await expect(signing).rejects.toThrow("signingContextChanged");
    expect(app.signature.get()).toBe("");
  });

  it("discards a wallet result when the exact content changes during approval", async () => {
    const pending = deferred<unknown>();
    const { app, signMessage } = setup({
      signImplementation: () => pending.promise,
    });
    app.setMessage("original content");

    const signing = app.signMessage();
    await vi.waitFor(() => expect(signMessage).toHaveBeenCalledTimes(1));
    app.setMessage("changed content");
    pending.resolve({ data: SIGNATURE, publicKey: PUBLIC_KEY });

    await expect(signing).rejects.toThrow("signingContextChanged");
    expect(app.signature.get()).toBe("");
    expect(app.signCount.get()).toBe(0);
  });

  it("fails closed on an unconfirmed network before opening the sign prompt", async () => {
    const { app, signMessage } = setup({ network: "neo-n3" });
    app.setMessage("do not sign ambiguously");

    await expect(app.signMessage()).rejects.toThrow("networkRequired");
    expect(signMessage).not.toHaveBeenCalled();
    expect(app.signature.get()).toBe("");
  });

  it("fails closed on an invalid wallet address before opening the sign prompt", async () => {
    const { app, detectNetwork, signMessage } = setup({ address: "Ninvalid" });
    app.setMessage("bind a real account");

    await expect(app.signMessage()).rejects.toThrow("walletAddressInvalid");
    expect(signMessage).not.toHaveBeenCalled();
    await expect(app.connectWallet()).rejects.toThrow("walletAddressInvalid");
    expect(detectNetwork).not.toHaveBeenCalled();
    expect(app.network.get()).toBe("");
  });

  it("refreshes a changed idle network and requires a second review before prompting", async () => {
    const { app, setNetwork, signMessage } = setup();
    app.setMessage("review network changes");
    await app.loadData();
    expect(app.network.get()).toBe("neo-n3-mainnet");

    setNetwork("neo-n3-testnet");
    await expect(app.signMessage()).rejects.toThrow("networkChangedReview");

    expect(signMessage).not.toHaveBeenCalled();
    expect(app.network.get()).toBe("neo-n3-testnet");
    expect(app.payloadText.get()).toContain("network:neo-n3-testnet");
    expect(app.operationStatus.get()).toBe("stale");
  });

  it("rejects malformed wallet output instead of showing fake success", async () => {
    const { app } = setup({ signResult: { data: "not-a-signature", publicKey: PUBLIC_KEY } });
    app.setMessage("must be real");

    await expect(app.signMessage()).rejects.toThrow("signatureFormatInvalid");
    expect(app.signature.get()).toBe("");
    expect(app.artifact.get()).toBeNull();
    expect(app.signCount.get()).toBe(0);
  });

  it("keeps only metadata in local history", async () => {
    const { app } = setup();
    app.setMessage("private working note");
    await app.signMessage();

    const serialized = JSON.stringify(app.history.get());
    expect(app.history.get()).toHaveLength(1);
    expect(serialized).not.toContain("private working note");
    expect(serialized).not.toContain(SIGNATURE);
    expect(serialized).not.toContain(PUBLIC_KEY);
    expect(app.history.get()[0]).toMatchObject({
      address: ADDRESS,
      network: "neo-n3-mainnet",
      mode: "bound",
      kind: "text",
    });

    app.clearHistory();
    expect(app.history.get()).toEqual([]);
  });

  it("rejects files above the local hashing cap before reading them", async () => {
    const { app } = setup();
    const arrayBuffer = vi.fn();
    const oversized = {
      name: "huge.bin",
      size: MAX_FILE_BYTES + 1,
      type: "application/octet-stream",
      arrayBuffer,
    } as unknown as File;

    await expect(app.loadFileDigest(oversized)).rejects.toThrow("fileTooLarge");
    expect(arrayBuffer).not.toHaveBeenCalled();
  });

  it("clears an old file digest when its replacement cannot be loaded", async () => {
    const { app } = setup();
    await app.loadFileDigest(new File(["old"], "old.txt", { type: "text/plain" }));
    expect(app.fileInfo.get()?.name).toBe("old.txt");

    const oversized = {
      name: "replacement.bin",
      size: MAX_FILE_BYTES + 1,
      type: "application/octet-stream",
      arrayBuffer: vi.fn(),
    } as unknown as File;

    await expect(app.loadFileDigest(oversized)).rejects.toThrow("fileTooLarge");
    expect(app.fileInfo.get()).toBeNull();
    expect(app.message.get()).toBe("");
    expect(app.operationStatus.get()).toBe("error");
  });

  it("ignores a slower obsolete file hash when a newer file load wins", async () => {
    const { app } = setup();
    const oldBuffer = deferred<ArrayBuffer>();
    const newBuffer = deferred<ArrayBuffer>();
    const oldFile = {
      name: "old.txt",
      size: 3,
      type: "text/plain",
      arrayBuffer: () => oldBuffer.promise,
    } as unknown as File;
    const newFile = {
      name: "new.txt",
      size: 3,
      type: "text/plain",
      arrayBuffer: () => newBuffer.promise,
    } as unknown as File;

    const oldLoad = app.loadFileDigest(oldFile);
    const newLoad = app.loadFileDigest(newFile);
    newBuffer.resolve(new TextEncoder().encode("new").buffer as ArrayBuffer);
    const newPayload = await newLoad;
    oldBuffer.resolve(new TextEncoder().encode("old").buffer as ArrayBuffer);

    await expect(oldLoad).resolves.toBe("");
    expect(newPayload).toMatch(/^sha256:[0-9a-f]{64}$/);
    expect(app.fileInfo.get()?.name).toBe("new.txt");
    expect(app.message.get()).toBe(newPayload);
  });

  it("clears a previously displayed network when wallet detection becomes ambiguous", async () => {
    const { app, setNetwork } = setup();
    app.setMessage("network must be exact");
    await app.loadData();
    expect(app.network.get()).toBe("neo-n3-mainnet");

    setNetwork("neo-n3");
    await expect(app.signMessage()).rejects.toThrow("networkRequired");

    expect(app.network.get()).toBe("");
    expect(app.payloadStatus.get()).toBe("waiting-wallet");
  });

  it("drops malformed local history rows instead of rendering them as signing facts", async () => {
    const { app } = setup();
    app.setMessage("history row");
    await app.signMessage();
    const valid = app.history.get()[0];

    expect(sanitizeSignatureHistory([
      valid,
      { ...valid, id: "wrong-network", network: "neo-n3" },
      { ...valid, id: "wrong-date", createdAt: "not-a-date" },
      { ...valid, id: "wrong-size", payloadBytes: -1 },
    ])).toEqual([valid]);
  });
});

describe("signature normalization", () => {
  it("normalizes base64url signatures and compressed public keys", () => {
    const base64url = Buffer.from(new Uint8Array(64).fill(7)).toString("base64url");
    expect(normalizeWalletSignature({ signature: base64url, publicKey: PUBLIC_KEY })).toEqual({
      value: `${base64url.replace(/-/g, "+").replace(/_/g, "/")}==`,
      encoding: "base64",
      publicKey: PUBLIC_KEY.toLowerCase(),
    });
  });

  it("rejects malformed public keys when a wallet claims to provide one", () => {
    expect(() => normalizeWalletSignature({ signature: SIGNATURE, publicKey: "0x1234" }))
      .toThrow(/public key format/i);
  });

  it("rejects impossible base64 lengths instead of padding them into a result", () => {
    expect(() => normalizeWalletSignature({ signature: "A".repeat(89) }))
      .toThrow(/signature format/i);
  });
});
