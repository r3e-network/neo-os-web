import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  HOST_WALLET_BRIDGE_PROTOCOL_VERSION,
  readImmediateNep21Provider,
  resetNep21ProviderCacheForTests,
  type NeoDapiProvider,
  type Nep21Window,
} from "../src/nep21-provider";

const BRIDGE_RESPONSE = "neo-miniapp-wallet-bridge:response";
const BRIDGE_TIMEOUT_MS = 8000;
const HOST_ORIGIN = "https://host.example";

type PostedMessage = {
  message: {
    type: string;
    id: string;
    method: string;
    version: number;
    protocolVersion: number;
  };
  targetOrigin: string;
};

type FakeMessageEvent = {
  source: unknown;
  origin: string;
  data: unknown;
};

function createEmbeddedWindow(options: { referrer?: string } = {}) {
  const listeners = new Set<(event: FakeMessageEvent) => void>();
  const posted: PostedMessage[] = [];
  const parent = {
    postMessage: (message: PostedMessage["message"], targetOrigin: string) => {
      posted.push({ message, targetOrigin });
    },
  };
  const win = {
    location: {
      search: "?source=embed&network=testnet",
      href: `${HOST_ORIGIN}/miniapps/demo/index.html?source=embed&network=testnet`,
    },
    document: { referrer: options.referrer ?? `${HOST_ORIGIN}/app/demo` },
    parent,
    addEventListener: (type: string, listener: (event: FakeMessageEvent) => void) => {
      if (type === "message") listeners.add(listener);
    },
    removeEventListener: (_type: string, listener: (event: FakeMessageEvent) => void) => {
      listeners.delete(listener);
    },
    dispatchEvent: () => true,
    setTimeout: (fn: () => void, ms: number) => setTimeout(fn, ms),
    clearTimeout: (handle: unknown) => clearTimeout(handle as Parameters<typeof clearTimeout>[0]),
  };
  const deliver = (event: FakeMessageEvent) => {
    for (const listener of [...listeners]) listener(event);
  };
  return { win: win as unknown as Nep21Window, parent, posted, deliver };
}

function getBridgeProvider(win: Nep21Window): NeoDapiProvider {
  const provider = readImmediateNep21Provider({ targetWindow: win as unknown as Window });
  if (!provider) throw new Error("expected the host wallet bridge provider");
  return provider;
}

function okReply(
  id: string,
  result: unknown = [],
  options: { protocolVersion?: number | string | null } = {},
) {
  const reply: Record<string, unknown> = {
    type: BRIDGE_RESPONSE,
    id,
    ok: true,
    result,
  };
  if ("protocolVersion" in options) {
    reply.protocolVersion = options.protocolVersion;
  } else {
    reply.protocolVersion = HOST_WALLET_BRIDGE_PROTOCOL_VERSION;
  }
  return reply;
}

describe("host wallet bridge response gating", () => {
  beforeEach(() => {
    resetNep21ProviderCacheForTests();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("prefers the host bridge over directly injected wallet providers inside embeds", () => {
    const { win } = createEmbeddedWindow();
    const directProvider = {
      name: "NeoLine",
      dapiVersion: "1.0.0",
      compatibility: ["NEP-21"],
      getAccounts: vi.fn(async () => [
        { hash: "0xdirect", address: "NDirect", isDefault: true },
      ]),
    };
    win.NEP21Provider = directProvider;

    const provider = readImmediateNep21Provider({
      targetWindow: win as unknown as Window,
    });

    expect(provider?.name).toBe("Yiwu Host Wallet");
    expect(provider).not.toBe(directProvider);
  });

  it("posts requests with a crypto-random id pinned to the host origin", async () => {
    const { win, parent, posted, deliver } = createEmbeddedWindow();
    const provider = getBridgeProvider(win);

    const first = provider.getAccounts();
    const second = provider.getBalance!("GAS");

    expect(posted).toHaveLength(2);
    expect(posted[0].message.type).toBe("neo-miniapp-wallet-bridge:request");
    expect(posted[0].message.method).toBe("getAccounts");
    expect(posted[1].message.method).toBe("getBalance");
    for (const entry of posted) {
      expect(entry.message.id).toMatch(/^host-wallet-[0-9a-f]{32}$/);
      expect(entry.targetOrigin).toBe(HOST_ORIGIN);
      // Every request envelope carries the negotiated protocol version, plus
      // the legacy `version` alias for hosts pinned to the old field.
      expect(entry.message.protocolVersion).toBe(
        HOST_WALLET_BRIDGE_PROTOCOL_VERSION,
      );
      expect(entry.message.version).toBe(HOST_WALLET_BRIDGE_PROTOCOL_VERSION);
    }
    expect(posted[0].message.id).not.toBe(posted[1].message.id);

    deliver({ source: parent, origin: HOST_ORIGIN, data: okReply(posted[0].message.id) });
    deliver({ source: parent, origin: HOST_ORIGIN, data: okReply(posted[1].message.id, "42") });
    await expect(first).resolves.toEqual([]);
    await expect(second).resolves.toBe("42");
  });

  it("falls back to the frame's own origin when no referrer is available", async () => {
    const { win, parent, posted, deliver } = createEmbeddedWindow({ referrer: "" });
    const provider = getBridgeProvider(win);

    const pending = provider.getAccounts();
    expect(posted[0].targetOrigin).toBe(HOST_ORIGIN);

    deliver({ source: parent, origin: HOST_ORIGIN, data: okReply(posted[0].message.id) });
    await expect(pending).resolves.toEqual([]);
  });

  it("ignores responses whose source is not the parent window", async () => {
    vi.useFakeTimers();
    const { win, posted, deliver } = createEmbeddedWindow();
    const provider = getBridgeProvider(win);

    const pending = provider.getAccounts();
    const expectation = expect(pending).rejects.toThrow(/timed out/);

    const forgedSource = { postMessage: () => {} };
    deliver({
      source: forgedSource,
      origin: HOST_ORIGIN,
      data: okReply(posted[0].message.id, [{ hash: "0xattacker" }]),
    });

    await vi.advanceTimersByTimeAsync(BRIDGE_TIMEOUT_MS);
    await expectation;
  });

  it("ignores responses carrying a forged request id", async () => {
    vi.useFakeTimers();
    const { win, parent, deliver } = createEmbeddedWindow();
    const provider = getBridgeProvider(win);

    const pending = provider.getAccounts();
    const expectation = expect(pending).rejects.toThrow(/timed out/);

    deliver({
      source: parent,
      origin: HOST_ORIGIN,
      data: okReply("host-wallet-0000000000000000", [{ hash: "0xattacker" }]),
    });

    await vi.advanceTimersByTimeAsync(BRIDGE_TIMEOUT_MS);
    await expectation;
  });

  it("ignores responses from a foreign real origin even with the right id", async () => {
    vi.useFakeTimers();
    const { win, parent, posted, deliver } = createEmbeddedWindow();
    const provider = getBridgeProvider(win);

    const pending = provider.getAccounts();
    const expectation = expect(pending).rejects.toThrow(/timed out/);

    deliver({
      source: parent,
      origin: "https://evil.example",
      data: okReply(posted[0].message.id, [{ hash: "0xattacker" }]),
    });

    await vi.advanceTimersByTimeAsync(BRIDGE_TIMEOUT_MS);
    await expectation;
  });

  it("accepts host replies that report an opaque (null) origin", async () => {
    const { win, parent, posted, deliver } = createEmbeddedWindow();
    const provider = getBridgeProvider(win);

    const pending = provider.getAccounts();
    deliver({
      source: parent,
      origin: "null",
      data: okReply(posted[0].message.id, [{ hash: "0x1111", address: "NHostWallet" }]),
    });

    await expect(pending).resolves.toEqual([
      { hash: "0x1111", address: "NHostWallet" },
    ]);
  });

  it("accepts synthetic same-document replies without a source (test harnesses)", async () => {
    const { win, posted, deliver } = createEmbeddedWindow();
    const provider = getBridgeProvider(win);

    const pending = provider.getAccounts();
    deliver({
      source: null,
      origin: "",
      data: okReply(posted[0].message.id, []),
    });

    await expect(pending).resolves.toEqual([]);
  });

  it("rejects with the host-provided error message", async () => {
    const { win, parent, posted, deliver } = createEmbeddedWindow();
    const provider = getBridgeProvider(win);

    const pending = provider.getAccounts();
    deliver({
      source: parent,
      origin: HOST_ORIGIN,
      data: {
        type: BRIDGE_RESPONSE,
        id: posted[0].message.id,
        ok: false,
        error: { message: "User rejected the request." },
      },
    });

    await expect(pending).rejects.toThrow("User rejected the request.");
  });
});

describe("host wallet bridge protocol negotiation", () => {
  beforeEach(() => {
    resetNep21ProviderCacheForTests();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("accepts a response that matches the protocol version", async () => {
    const { win, parent, posted, deliver } = createEmbeddedWindow();
    const provider = getBridgeProvider(win);

    const pending = provider.getAccounts();
    deliver({
      source: parent,
      origin: HOST_ORIGIN,
      data: okReply(posted[0].message.id, [], {
        protocolVersion: HOST_WALLET_BRIDGE_PROTOCOL_VERSION,
      }),
    });

    await expect(pending).resolves.toEqual([]);
  });

  it("accepts a response that omits the version (pre-negotiation baseline)", async () => {
    const { win, parent, posted, deliver } = createEmbeddedWindow();
    const provider = getBridgeProvider(win);

    const pending = provider.getAccounts();
    deliver({
      source: parent,
      origin: HOST_ORIGIN,
      // A host that predates negotiation sends no protocolVersion at all.
      data: okReply(posted[0].message.id, [], { protocolVersion: null }),
    });

    await expect(pending).resolves.toEqual([]);
  });

  it("rejects a response that declares an incompatible version", async () => {
    const { win, parent, posted, deliver } = createEmbeddedWindow();
    const provider = getBridgeProvider(win);

    const pending = provider.getAccounts();
    const expectation = expect(pending).rejects.toThrow(
      /Unsupported wallet bridge protocol version/,
    );
    deliver({
      source: parent,
      origin: HOST_ORIGIN,
      data: okReply(posted[0].message.id, [{ hash: "0xfuture" }], {
        protocolVersion: HOST_WALLET_BRIDGE_PROTOCOL_VERSION + 1,
      }),
    });

    await expectation;
  });

  it("rejects a response whose version is present but malformed", async () => {
    const { win, parent, posted, deliver } = createEmbeddedWindow();
    const provider = getBridgeProvider(win);

    const pending = provider.getAccounts();
    const expectation = expect(pending).rejects.toThrow(
      /Unsupported wallet bridge protocol version/,
    );
    deliver({
      source: parent,
      origin: HOST_ORIGIN,
      data: okReply(posted[0].message.id, [], { protocolVersion: "garbage" }),
    });

    await expectation;
  });
});

describe("legacy NeoLine N3 provider compatibility", () => {
  beforeEach(() => {
    resetNep21ProviderCacheForTests();
  });

  it("wraps window.NEOLineN3 as a NEP-21-compatible provider", async () => {
    const legacyApi = {
      getNetworks: vi.fn(async () => ({ defaultNetwork: "TestNet" })),
      getAccount: vi.fn(async () => ({ address: "NLegacy", label: "NeoLine" })),
      AddressToScriptHash: vi.fn(async () => ({
        scriptHash: "3333333333333333333333333333333333333333",
      })),
      getBalance: vi.fn(async () => ({
        balances: [
          {
            contract: "0xd2a4cff31913016155e38e474a2c06d08be276cf",
            amount: "7.5",
          },
        ],
      })),
      invoke: vi.fn(async () => ({ txid: "0xlegacy" })),
    };
    const win = {
      location: { search: "", href: `${HOST_ORIGIN}/app` },
      document: { referrer: "" },
      parent: null as unknown,
      NEOLineN3: { Init: vi.fn(() => legacyApi) },
    } as unknown as Nep21Window;
    (win as { parent: unknown }).parent = win;

    const provider = readImmediateNep21Provider({
      targetWindow: win as unknown as Window,
      preference: "neoline",
    });

    expect(provider?.name).toBe("NeoLine Legacy N3");
    await expect(provider?.getAccounts()).resolves.toEqual([
      {
        hash: "0x3333333333333333333333333333333333333333",
        address: "NLegacy",
        label: "NeoLine",
        isDefault: true,
      },
    ]);
    await expect(
      provider?.getBalance?.("0xd2a4cff31913016155e38e474a2c06d08be276cf", "NLegacy"),
    ).resolves.toBe("7.5");
    await expect(
      provider?.getBalance?.(
        "0xd2a4cff31913016155e38e474a2c06d08be276cf",
        "0x3333333333333333333333333333333333333333",
      ),
    ).resolves.toBe("7.5");
    expect(legacyApi.getBalance).toHaveBeenLastCalledWith({
      params: [
        {
          address: "NLegacy",
          contracts: ["d2a4cff31913016155e38e474a2c06d08be276cf"],
        },
      ],
    });
    await expect(
      provider?.invoke?.(
        [
          {
            hash: "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
            operation: "claimReward",
            args: [
              {
                type: "Hash160",
                value: "3333333333333333333333333333333333333333",
              },
            ],
          },
        ],
        [
          {
            account: "0x3333333333333333333333333333333333333333",
            scopes: "CalledByEntry",
          },
        ],
      ),
    ).resolves.toEqual({ txid: "0xlegacy" });

    expect(legacyApi.invoke).toHaveBeenCalledWith({
      scriptHash: "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
      operation: "claimReward",
      args: [
        {
          type: "Hash160",
          value: "0x3333333333333333333333333333333333333333",
        },
      ],
      signers: [
        {
          account: "3333333333333333333333333333333333333333",
          scopes: 1,
        },
      ],
      suggestedSystemFee: undefined,
    });
  });

  it("uses window.NEOLine common methods for legacy account and network reads", async () => {
    const legacyN3 = {
      invokeMultiple: vi.fn(async () => ({ txid: "0xlegacy-batch" })),
    };
    const legacyCommon = {
      getNetworks: vi.fn(async () => ({ defaultNetwork: "MainNet" })),
      getAccount: vi.fn(async () => ({
        address: "NCommonNeoLine",
        label: "Common",
      })),
      AddressToScriptHash: vi.fn(async () => ({
        scriptHash: "4444444444444444444444444444444444444444",
      })),
    };
    const win = {
      location: { search: "", href: `${HOST_ORIGIN}/app` },
      document: { referrer: "" },
      parent: null as unknown,
      NEOLine: { Init: vi.fn(() => legacyCommon) },
      NEOLineN3: { Init: vi.fn(() => legacyN3) },
    } as unknown as Nep21Window;
    (win as { parent: unknown }).parent = win;

    const provider = readImmediateNep21Provider({
      targetWindow: win as unknown as Window,
      preference: "neoline",
    });

    await expect(provider?.getAccounts()).resolves.toEqual([
      {
        hash: "0x4444444444444444444444444444444444444444",
        address: "NCommonNeoLine",
        label: "Common",
        isDefault: true,
      },
    ]);
    await expect(provider?.getNetwork?.()).resolves.toBe(860833102);
    await expect(
      provider?.invoke?.(
        [
          {
            hash: "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
            operation: "vote",
            args: [],
          },
          {
            hash: "0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
            operation: "auditTrail",
            args: [],
          },
        ],
        [
          {
            account: "0x4444444444444444444444444444444444444444",
            scopes: "CustomContracts, CustomGroups",
          },
        ],
      ),
    ).resolves.toEqual({ txid: "0xlegacy-batch" });

    expect(legacyCommon.getNetworks).toHaveBeenCalled();
    expect(legacyCommon.getAccount).toHaveBeenCalled();
    expect(legacyN3.invokeMultiple).toHaveBeenCalledWith({
      invokeArgs: [
        {
          scriptHash: "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
          operation: "vote",
          args: [],
          abortOnFail: undefined,
        },
        {
          scriptHash: "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
          operation: "auditTrail",
          args: [],
          abortOnFail: undefined,
        },
      ],
      signers: [
        {
          account: "4444444444444444444444444444444444444444",
          scopes: 48,
        },
      ],
      suggestedSystemFee: undefined,
    });
  });
});
