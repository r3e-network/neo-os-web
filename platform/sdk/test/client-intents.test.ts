import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createMiniAppSDK } from "../src/client";
import { resetNep21ProviderCacheForTests } from "../src/nep21-provider";
import type { MiniAppSDKConfig } from "../src/types";

const PENDING_INVOCATION_TTL_MS = 10 * 60 * 1000;
const PENDING_INVOCATION_MAX_ENTRIES = 64;
const ACCOUNT_HASH = "0x1111111111111111111111111111111111111111";
const GAS_HASH = "0xd2a4cff31913016155e38e474a2c06d08be276cf";

const cfg: MiniAppSDKConfig = {
  edgeBaseUrl: "https://edge.example",
  appId: "miniapp-demo",
};

function createWalletWindow() {
  const invoke = vi.fn(async () => ({ txid: "0xtest" }));
  const provider = {
    name: "Test NEP-21 connector",
    dapiVersion: "1.0.0",
    compatibility: ["NEP-21"],
    getAccounts: vi.fn(async () => [
      { hash: ACCOUNT_HASH, address: "NTestAddress", isDefault: true },
    ]),
    invoke,
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
  return { win, provider, invoke };
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
    vi.useRealTimers();
  });

  describe("resolveInvocationParams via wallet.invokeInvocation", () => {
    it("substitutes SENDER placeholders, including inside nested arrays", async () => {
      const sdk = createMiniAppSDK(cfg);
      await sdk.wallet.invokeInvocation!({
        contract_hash: GAS_HASH,
        method: "transfer",
        params: [
          { type: "Hash160", value: "SENDER" },
          {
            type: "Array",
            value: [
              { type: "Hash160", value: "SENDER" },
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
              {
                type: "Array",
                value: [
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
  });

  describe("pending invocation intents", () => {
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

      await expect(sdk.rng.requestRandom("miniapp-demo")).rejects.toThrow(
        "request failed (500)",
      );
    });

    it("maps unparseable bodies to an invalid-JSON error", async () => {
      vi.stubGlobal("fetch", vi.fn(async () => jsonResponse("not-json{")));
      const sdk = createMiniAppSDK(cfg);

      await expect(sdk.rng.requestRandom("miniapp-demo")).rejects.toThrow(
        /invalid JSON response from \/rng-request/,
      );
    });

    it("maps non-object JSON bodies to a non-object error", async () => {
      vi.stubGlobal("fetch", vi.fn(async () => jsonResponse("42")));
      const sdk = createMiniAppSDK(cfg);

      await expect(sdk.rng.requestRandom("miniapp-demo")).rejects.toThrow(
        /unexpected non-object response/,
      );
    });

    it("prefers the auth token over the API key", async () => {
      let capturedHeaders: Headers | null = null;
      vi.stubGlobal(
        "fetch",
        vi.fn(async (_url: string, init: RequestInit) => {
          capturedHeaders = new Headers(init.headers);
          return jsonResponse({ request_id: "req-1", app_id: "a", randomness: "00" });
        }),
      );
      const sdk = createMiniAppSDK({
        ...cfg,
        getAuthToken: async () => "token-1",
        getAPIKey: async () => "key-1",
      });

      await sdk.rng.requestRandom("miniapp-demo");
      expect(capturedHeaders!.get("Authorization")).toBe("Bearer token-1");
      expect(capturedHeaders!.get("X-API-Key")).toBeNull();
    });
  });
});
