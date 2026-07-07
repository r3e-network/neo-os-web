import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  buildDapiAuthenticationPayload,
  createHostSDK,
  createMiniAppSDK,
  SDKError,
} from "../src/client";
import { resetNep21ProviderCacheForTests } from "../src/nep21-provider";
import type { MiniAppSDKConfig } from "../src/types";

const PENDING_INVOCATION_TTL_MS = 10 * 60 * 1000;
const PENDING_INVOCATION_MAX_ENTRIES = 64;
const MAINNET_MAGIC = 860833102;
const TESTNET_MAGIC = 894710606;
const ACCOUNT_HASH = "0x1111111111111111111111111111111111111111";
const GAS_HASH = "0xd2a4cff31913016155e38e474a2c06d08be276cf";

const cfg: MiniAppSDKConfig = {
  edgeBaseUrl: "https://edge.example",
  appId: "miniapp-demo",
};

function createWalletWindow() {
  const invoke = vi.fn(async () => ({ txid: "0xtest" }));
  const requestPayment = vi.fn(async () => ({
    transactionHash: "0xpayment",
    blockTime: 1781764300,
    succeeded: true,
  }));
  const provider = {
    name: "Test NEP-21 connector",
    dapiVersion: "1.0.0",
    compatibility: ["NEP-21"],
    network: MAINNET_MAGIC,
    getAccounts: vi.fn(async () => [
      { hash: ACCOUNT_HASH, address: "NTestAddress", isDefault: true },
    ]),
    invoke,
    requestPayment,
  };
  const win: Record<string, unknown> = {
    location: { search: "", href: "http://localhost/", host: "localhost" },
    document: { referrer: "" },
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => true,
    setTimeout: (fn: () => void, ms: number) => setTimeout(fn, ms),
    clearTimeout: (handle: unknown) =>
      clearTimeout(handle as Parameters<typeof clearTimeout>[0]),
    NEP21Provider: provider,
  };
  win.parent = win;
  return { win, provider, invoke, requestPayment };
}

function jsonResponse(body: unknown, status = 200) {
  return {
    ok: status >= 200 && status < 300,
    status,
    text: async () => (typeof body === "string" ? body : JSON.stringify(body)),
  };
}

function payGasBody(requestId: string) {
  return {
    request_id: requestId,
    user_id: "user-1",
    intent: "payments",
    constraints: { settlement: "GAS_ONLY" },
    invocation: {
      contract_hash: GAS_HASH,
      method: "transfer",
      params: [{ type: "Hash160", value: "SENDER" }],
    },
  };
}

function voteBody(requestId: string) {
  return {
    request_id: requestId,
    user_id: "user-1",
    intent: "governance",
    constraints: { governance: "BNEO_ONLY" },
    invocation: {
      contract_hash: "0x2222222222222222222222222222222222222222",
      method: "vote",
      params: [{ type: "Hash160", value: "SENDER" }],
    },
  };
}

describe("createMiniAppSDK", () => {
  let invoke: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    resetNep21ProviderCacheForTests();
    const wallet = createWalletWindow();
    invoke = wallet.invoke;
    vi.stubGlobal("window", wallet.win);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
    vi.useRealTimers();
  });

  it("builds authentication challenges accepted by OneGate native dAPI", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-06-18T06:30:05.000Z"));
    const wallet = createWalletWindow();
    wallet.win.location = {
      search: "",
      href: "https://neomini.app/miniapps/gas-lucky-pool/index.html",
      host: "neomini.app:443",
      hostname: "neomini.app",
    };
    vi.stubGlobal("window", wallet.win);

    const payload = buildDapiAuthenticationPayload([MAINNET_MAGIC]);

    expect(payload).toMatchObject({
      action: "Authentication",
      domain: "neomini.app",
      networks: [MAINNET_MAGIC],
      timestamp: 1781764205000,
      Action: "Authentication",
      Domain: "neomini.app",
      Networks: [MAINNET_MAGIC],
      Timestamp: 1781764205,
    });
    expect(payload.allowed_algorithms).toEqual(["ECDSA-P256"]);
    expect(typeof payload.nonce).toBe("string");
    expect(typeof payload.Nonce).toBe("number");
  });

  describe("resolveInvocationParams via wallet.invokeInvocation", () => {
    it("rejects direct invokes before signing when the wallet network differs from the active app network", async () => {
      const wallet = createWalletWindow();
      wallet.win.location = {
        search: "?network=testnet",
        href: "http://localhost/?network=testnet",
        host: "localhost",
      };
      wallet.provider.network = MAINNET_MAGIC;
      vi.stubGlobal("window", wallet.win);

      const sdk = createMiniAppSDK(cfg);
      await expect(
        sdk.wallet.invokeInvocation!({
          contract_hash: GAS_HASH,
          method: "transfer",
          params: [
            { type: "Hash160", value: "SENDER" },
            { type: "Integer", value: "1" },
          ],
        }),
      ).rejects.toThrow(/targets Neo N3 Testnet/i);
      expect(wallet.invoke).not.toHaveBeenCalled();
    });

    it("substitutes SENDER placeholders, including inside nested arrays", async () => {
      const sdk = createMiniAppSDK(cfg);
      await sdk.wallet.invokeInvocation!({
        contract_hash: GAS_HASH,
        method: "transfer",
        params: [
          { type: "Hash160", value: "SENDER" },
          { type: "Hash160", value: "{{sender}}" },
          {
            type: "array",
            value: [
              { type: "Hash160", value: "sender" },
              {
                type: "Hash160",
                value: "0x0000000000000000000000000000000000000000",
              },
              { type: "String", value: "SENDER" },
              {
                type: "Hash160",
                value: "0x3333333333333333333333333333333333333333",
              },
            ],
          },
          { type: "Integer", value: "1" },
        ],
      });

      expect(invoke).toHaveBeenCalledWith(
        [
          {
            hash: GAS_HASH,
            operation: "transfer",
            args: [
              { type: "Hash160", value: ACCOUNT_HASH },
              { type: "Hash160", value: ACCOUNT_HASH },
              {
                type: "Array",
                value: [
                  { type: "Hash160", value: ACCOUNT_HASH },
                  { type: "Hash160", value: ACCOUNT_HASH },
                  { type: "String", value: "SENDER" },
                  {
                    type: "Hash160",
                    value: "0x3333333333333333333333333333333333333333",
                  },
                ],
              },
              { type: "Integer", value: "1" },
            ],
          },
        ],
        [{ account: ACCOUNT_HASH, scopes: "CalledByEntry" }],
      );
    });

    it("rejects message signing before calling the wallet when the network differs", async () => {
      const wallet = createWalletWindow();
      wallet.win.location = {
        search: "?network=testnet",
        href: "http://localhost/?network=testnet",
        host: "localhost",
      };
      wallet.provider.network = MAINNET_MAGIC;
      const signMessage = vi.fn(async () => ({
        publicKey: "03abc",
        data: "signature",
        message: "hello",
      }));
      wallet.provider.signMessage = signMessage;
      vi.stubGlobal("window", wallet.win);

      const sdk = createMiniAppSDK(cfg);
      await expect(sdk.wallet.signMessage("hello")).rejects.toThrow(
        /targets Neo N3 Testnet/i,
      );
      expect(signMessage).not.toHaveBeenCalled();
    });

    it("uses accountHash-only wallet accounts for signer and SENDER resolution", async () => {
      const wallet = createWalletWindow();
      wallet.win.location = {
        search: "?network=testnet",
        href: "http://localhost/?network=testnet",
        host: "localhost",
      };
      wallet.provider.getAccounts = vi.fn(async () => [
        {
          accountHash: ACCOUNT_HASH,
          address: "NAccountHashOnly",
          isDefault: true,
        },
      ]);
      wallet.provider.network = MAINNET_MAGIC;
      wallet.provider.getNetwork = vi.fn(async () => ({
        defaultNetwork: "TestNet",
      }));
      vi.stubGlobal("window", wallet.win);

      const sdk = createMiniAppSDK(cfg);

      await expect(sdk.wallet.getProviderInfo()).resolves.toMatchObject({
        address: "NAccountHashOnly",
        accountHash: ACCOUNT_HASH,
        network: TESTNET_MAGIC,
      });
      await sdk.wallet.invokeInvocation!({
        contract_hash: GAS_HASH,
        method: "transfer",
        params: [
          { type: "Hash160", value: "SENDER" },
          { type: "Integer", value: "1" },
        ],
      });

      expect(wallet.invoke).toHaveBeenCalledWith(
        [
          {
            hash: GAS_HASH,
            operation: "transfer",
            args: [
              { type: "Hash160", value: ACCOUNT_HASH },
              { type: "Integer", value: "1" },
            ],
          },
        ],
        [{ account: ACCOUNT_HASH, scopes: "CalledByEntry" }],
      );
    });

    it("rejects legacy NeoLine invokes before signing when the wallet network differs", async () => {
      const invoke = vi.fn(async () => ({ txid: "0xneoline" }));
      const legacyApi = {
        getAccount: vi.fn(async () => ({ address: "NNeoLineAddress" })),
        getNetworks: vi.fn(async () => ({ defaultNetwork: "MainNet" })),
        invoke,
      };
      const win = {
        location: {
          search: "?network=testnet",
          href: "http://localhost/?network=testnet",
          host: "localhost",
        },
        document: { referrer: "" },
        addEventListener: () => {},
        removeEventListener: () => {},
        dispatchEvent: () => true,
        setTimeout: (fn: () => void, ms: number) => setTimeout(fn, ms),
        clearTimeout: (handle: unknown) =>
          clearTimeout(handle as Parameters<typeof clearTimeout>[0]),
        NEOLineN3: { Init: vi.fn(() => legacyApi) },
      };
      (win as Record<string, unknown>).parent = win;
      vi.stubGlobal("window", win);

      const sdk = createMiniAppSDK(cfg);
      await expect(
        sdk.wallet.invokeInvocation!({
          contract_hash: GAS_HASH,
          method: "transfer",
          params: [{ type: "Hash160", value: "SENDER" }],
        }),
      ).rejects.toThrow(/targets Neo N3 Testnet/i);
      expect(invoke).not.toHaveBeenCalled();
    });

    it("rejects legacy NeoLine message signing when the wallet network differs", async () => {
      const signMessage = vi.fn(async () => ({
        publicKey: "03abc",
        data: "signature",
      }));
      const legacyApi = {
        getAccount: vi.fn(async () => ({ address: "NNeoLineAddress" })),
        getNetworks: vi.fn(async () => ({ defaultNetwork: "MainNet" })),
        signMessage,
        invoke: vi.fn(async () => ({ txid: "0xneoline" })),
      };
      const win = {
        location: {
          search: "?network=testnet",
          href: "http://localhost/?network=testnet",
          host: "localhost",
        },
        document: { referrer: "" },
        addEventListener: () => {},
        removeEventListener: () => {},
        dispatchEvent: () => true,
        setTimeout: (fn: () => void, ms: number) => setTimeout(fn, ms),
        clearTimeout: (handle: unknown) =>
          clearTimeout(handle as Parameters<typeof clearTimeout>[0]),
        NEOLineN3: { Init: vi.fn(() => legacyApi) },
      };
      (win as Record<string, unknown>).parent = win;
      vi.stubGlobal("window", win);

      const sdk = createMiniAppSDK(cfg);
      await expect(sdk.wallet.signMessage("hello")).rejects.toThrow(
        /targets Neo N3 Testnet/i,
      );
      expect(signMessage).not.toHaveBeenCalled();
    });
  });

  it("requests NEP-21 authentication only for the active app network", async () => {
    const wallet = createWalletWindow();
    wallet.win.location = {
      search: "?network=testnet",
      href: "http://localhost/?network=testnet",
      host: "localhost",
    };
    wallet.provider.supportedNetworks = [MAINNET_MAGIC, TESTNET_MAGIC];
    wallet.provider.getAccounts = vi.fn(async () => []);
    const authenticate = vi.fn(async () => ({
      address: "NAuthenticated",
      hash: ACCOUNT_HASH,
      network: TESTNET_MAGIC,
    }));
    wallet.provider.authenticate = authenticate;
    vi.stubGlobal("window", wallet.win);

    const sdk = createMiniAppSDK(cfg);
    await expect(sdk.wallet.getAddress()).resolves.toBe("NAuthenticated");

    const payload = authenticate.mock.calls[0]?.[0] as Record<string, unknown>;
    expect(payload.networks).toEqual([TESTNET_MAGIC]);
    expect(payload.Networks).toEqual([TESTNET_MAGIC]);
  });

  describe("pending invocation intents", () => {
    it("requests native OneGate payments through the dAPI provider", async () => {
      const wallet = createWalletWindow();
      vi.stubGlobal("window", wallet.win);
      const sdk = createMiniAppSDK(cfg);

      const payment = await sdk.payments.requestPayment({
        asset: GAS_HASH,
        to: "NRecipientAddress111111111111111111111",
        amount: "100000000",
        purpose: "Arcade continue",
        details: "1 GAS credit",
        timeoutSeconds: 30,
      });

      expect(payment).toEqual({
        transactionHash: "0xpayment",
        blockTime: 1781764300,
        succeeded: true,
        confirmed: true,
      });
      expect(wallet.requestPayment).toHaveBeenCalledWith({
        asset: GAS_HASH,
        from: ACCOUNT_HASH,
        to: "NRecipientAddress111111111111111111111",
        amount: "100000000",
        purpose: "Arcade continue",
        details: "1 GAS credit",
        timeoutSeconds: 30,
      });
    });

    it("invokeIntent consumes a payGAS intent exactly once", async () => {
      vi.stubGlobal(
        "fetch",
        vi.fn(async () => jsonResponse(payGasBody("req-1"))),
      );
      const sdk = createMiniAppSDK(cfg);

      const intent = await sdk.payments.payGAS("miniapp-demo", "1");
      expect(intent.request_id).toBe("req-1");

      await expect(sdk.wallet.invokeIntent!("req-1")).resolves.toMatchObject({
        txid: "0xtest",
      });
      expect(invoke).toHaveBeenCalledTimes(1);

      await expect(sdk.wallet.invokeIntent!("req-1")).rejects.toThrow(
        /unknown request_id/,
      );
      expect(invoke).toHaveBeenCalledTimes(1);
    });

    it("payGASAndInvoke leaves no replayable intent behind", async () => {
      vi.stubGlobal(
        "fetch",
        vi.fn(async () => jsonResponse(payGasBody("req-1"))),
      );
      const sdk = createMiniAppSDK(cfg);

      const { intent, tx } = await sdk.payments.payGASAndInvoke!(
        "miniapp-demo",
        "1",
      );
      expect(intent.request_id).toBe("req-1");
      expect(tx).toMatchObject({ txid: "0xtest" });
      expect(invoke).toHaveBeenCalledTimes(1);

      await expect(sdk.wallet.invokeIntent!("req-1")).rejects.toThrow(
        /unknown request_id/,
      );
      expect(invoke).toHaveBeenCalledTimes(1);
    });

    it("voteAndInvoke leaves no replayable intent behind", async () => {
      vi.stubGlobal(
        "fetch",
        vi.fn(async () => jsonResponse(voteBody("req-vote-1"))),
      );
      const sdk = createMiniAppSDK(cfg);

      const { intent } = await sdk.governance.voteAndInvoke!(
        "miniapp-demo",
        "prop-1",
        "5",
        true,
      );
      expect(intent.request_id).toBe("req-vote-1");
      expect(invoke).toHaveBeenCalledTimes(1);

      await expect(sdk.wallet.invokeIntent!("req-vote-1")).rejects.toThrow(
        /unknown request_id/,
      );
      expect(invoke).toHaveBeenCalledTimes(1);
    });

    it("expires stored intents after the TTL", async () => {
      vi.useFakeTimers();
      vi.stubGlobal(
        "fetch",
        vi.fn(async () => jsonResponse(payGasBody("req-1"))),
      );
      const sdk = createMiniAppSDK(cfg);

      await sdk.payments.payGAS("miniapp-demo", "1");
      vi.setSystemTime(Date.now() + PENDING_INVOCATION_TTL_MS + 1);

      await expect(sdk.wallet.invokeIntent!("req-1")).rejects.toThrow(
        /unknown request_id/,
      );
      expect(invoke).not.toHaveBeenCalled();
    });

    it("evicts the oldest intent once the size cap is exceeded", async () => {
      let calls = 0;
      vi.stubGlobal(
        "fetch",
        vi.fn(async () => jsonResponse(payGasBody(`req-${++calls}`))),
      );
      const sdk = createMiniAppSDK(cfg);

      for (let i = 0; i < PENDING_INVOCATION_MAX_ENTRIES + 1; i += 1) {
        await sdk.payments.payGAS("miniapp-demo", "1");
      }

      await expect(sdk.wallet.invokeIntent!("req-1")).rejects.toThrow(
        /unknown request_id/,
      );
      await expect(
        sdk.wallet.invokeIntent!(`req-${PENDING_INVOCATION_MAX_ENTRIES + 1}`),
      ).resolves.toMatchObject({ txid: "0xtest" });
    });
  });

  describe("requestJSON error mapping", () => {
    it("maps non-2xx responses to a status error", async () => {
      vi.stubGlobal(
        "fetch",
        vi.fn(async () => jsonResponse("server error", 500)),
      );
      const sdk = createMiniAppSDK(cfg);

      await expect(sdk.gasSponsor.check()).rejects.toThrow(
        "request failed (500)",
      );
    });

    it("maps unparseable bodies to an invalid-JSON error", async () => {
      vi.stubGlobal(
        "fetch",
        vi.fn(async () => jsonResponse("not-json{")),
      );
      const sdk = createMiniAppSDK(cfg);

      await expect(sdk.gasSponsor.check()).rejects.toThrow(
        /invalid JSON response from \/gas-sponsor-check/,
      );
    });

    it("maps non-object JSON bodies to a non-object error", async () => {
      vi.stubGlobal(
        "fetch",
        vi.fn(async () => jsonResponse("42")),
      );
      const sdk = createMiniAppSDK(cfg);

      await expect(sdk.gasSponsor.check()).rejects.toThrow(
        /unexpected non-object response/,
      );
    });

    it("prefers the auth token over the API key", async () => {
      let capturedHeaders: Headers | null = null;
      vi.stubGlobal(
        "fetch",
        vi.fn(async (_url: string, init: RequestInit) => {
          capturedHeaders = new Headers(init.headers);
          return jsonResponse({ eligible: true });
        }),
      );
      const sdk = createMiniAppSDK({
        ...cfg,
        getAuthToken: async () => "token-1",
        getAPIKey: async () => "key-1",
      });

      await sdk.gasSponsor.check();
      expect(capturedHeaders!.get("Authorization")).toBe("Bearer token-1");
      expect(capturedHeaders!.get("X-API-Key")).toBeNull();
    });
  });

  describe("typed SDKError surface", () => {
    it("exposes status/code/path and preserves the parsed server body", async () => {
      const serverBody = {
        error: { code: "rate_limited", message: "Too many requests" },
      };
      vi.stubGlobal(
        "fetch",
        vi.fn(async () => jsonResponse(serverBody, 429)),
      );
      const sdk = createMiniAppSDK(cfg);

      const err = await sdk.gasSponsor.check().catch((e: unknown) => e);
      expect(err).toBeInstanceOf(SDKError);
      const sdkErr = err as SDKError;
      expect(sdkErr.status).toBe(429);
      expect(sdkErr.code).toBe("rate_limited");
      expect(sdkErr.path).toBe("/gas-sponsor-check");
      expect(sdkErr.message).toBe("request failed (429): Too many requests");
      expect(sdkErr.body).toEqual(serverBody);
    });

    it("supports the flat {error: string} shape", async () => {
      vi.stubGlobal(
        "fetch",
        vi.fn(async () => jsonResponse({ error: "bad input" }, 400)),
      );
      const sdk = createMiniAppSDK(cfg);

      const err = (await sdk.gasSponsor
        .check()
        .catch((e: unknown) => e)) as SDKError;
      expect(err).toBeInstanceOf(SDKError);
      expect(err.code).toBe("HTTP_400");
      expect(err.message).toBe("request failed (400): bad input");
      expect(err.body).toEqual({ error: "bad input" });
    });

    it("falls back to HTTP_<status> and preserves raw text bodies", async () => {
      vi.stubGlobal(
        "fetch",
        vi.fn(async () => jsonResponse("upstream down", 503)),
      );
      const sdk = createMiniAppSDK(cfg);

      const err = (await sdk.gasSponsor
        .check()
        .catch((e: unknown) => e)) as SDKError;
      expect(err).toBeInstanceOf(SDKError);
      expect(err.status).toBe(503);
      expect(err.code).toBe("HTTP_503");
      expect(err.message).toBe("request failed (503)");
      expect(err.body).toBe("upstream down");
    });

    it("types malformed success payloads", async () => {
      vi.stubGlobal(
        "fetch",
        vi.fn(async () => jsonResponse("not-json{")),
      );
      const sdk = createMiniAppSDK(cfg);

      const err = (await sdk.gasSponsor
        .check()
        .catch((e: unknown) => e)) as SDKError;
      expect(err).toBeInstanceOf(SDKError);
      expect(err.status).toBe(200);
      expect(err.code).toBe("INVALID_JSON");
      expect(err.body).toBe("not-json{");
    });
  });

  describe("host-only request handling (merged requestJSON)", () => {
    it("rejects without an API key before any network call", async () => {
      vi.stubEnv("HOST_SDK_ALLOW_BROWSER", "true");
      const fetchMock = vi.fn(async () => jsonResponse({ secrets: [] }));
      vi.stubGlobal("fetch", fetchMock);
      const host = createHostSDK(cfg);

      const err = (await host.secrets
        .list()
        .catch((e: unknown) => e)) as SDKError;
      expect(err).toBeInstanceOf(SDKError);
      expect(err.status).toBe(0);
      expect(err.code).toBe("API_KEY_REQUIRED");
      expect(err.message).toBe("API key required for host-only endpoint");
      expect(err.path).toBe("/secrets-list");
      expect(fetchMock).not.toHaveBeenCalled();
    });

    it("sends only X-API-Key (never the bearer token) and maps errors identically", async () => {
      vi.stubEnv("HOST_SDK_ALLOW_BROWSER", "true");
      let capturedHeaders: Headers | null = null;
      vi.stubGlobal(
        "fetch",
        vi.fn(async (_url: string, init: RequestInit) => {
          capturedHeaders = new Headers(init.headers);
          return jsonResponse(
            { error: { code: "forbidden", message: "scope missing" } },
            403,
          );
        }),
      );
      const host = createHostSDK({
        ...cfg,
        getAuthToken: async () => "token-1",
        getAPIKey: async () => "key-1",
      });

      const err = (await host.secrets
        .list()
        .catch((e: unknown) => e)) as SDKError;
      expect(capturedHeaders!.get("X-API-Key")).toBe("key-1");
      expect(capturedHeaders!.get("Authorization")).toBeNull();
      expect(err).toBeInstanceOf(SDKError);
      expect(err.status).toBe(403);
      expect(err.code).toBe("forbidden");
      expect(err.message).toBe("request failed (403): scope missing");
      expect(err.path).toBe("/secrets-list");
    });
  });

  describe("retired gateway endpoints", () => {
    it("throws ENDPOINT_RETIRED for every retired method without touching the network", async () => {
      vi.stubEnv("HOST_SDK_ALLOW_BROWSER", "true");
      const fetchMock = vi.fn(async () => {
        throw new Error("fetch must not be called for retired endpoints");
      });
      vi.stubGlobal("fetch", fetchMock);
      const sdk = createMiniAppSDK(cfg);
      const host = createHostSDK({ ...cfg, getAPIKey: async () => "key-1" });

      const retiredCalls: Array<Promise<unknown>> = [
        sdk.rng.requestRandom("miniapp-demo"),
        sdk.datafeed.getPrice("NEO"),
        sdk.privacy.getMerklePath("0xabc"),
        sdk.privacy.relay({
          proof: "p",
          nullifierHash: "n",
          root: "r",
          recipient: "NX",
          relayerFee: "1",
          asset: "GAS",
          amount: "1",
        }),
        host.oracle.query({ url: "https://example.com" }),
        host.compute.execute({ script: "function main(){}" }),
        host.compute.listJobs(),
        host.compute.getJob("job-1"),
      ];

      for (const call of retiredCalls) {
        const err = (await call.catch((e: unknown) => e)) as SDKError;
        expect(err).toBeInstanceOf(SDKError);
        expect(err.status).toBe(410);
        expect(err.code).toBe("ENDPOINT_RETIRED");
        expect(err.message).toMatch(/endpoint retired — use /);
      }
      expect(fetchMock).not.toHaveBeenCalled();
    });
  });
});
