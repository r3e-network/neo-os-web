import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useAbstractAccount } from "../composables/useAbstractAccount";

function httpError(status: number, body: string) {
  return {
    ok: false,
    status,
    text: async () => body,
  };
}

function httpOk(body: unknown) {
  return {
    ok: true,
    status: 200,
    text: async () => JSON.stringify(body),
  };
}

describe("useAbstractAccount — server error bodies are summarized", () => {
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("extracts error.message from a relay JSON error envelope", async () => {
    // The exact shape the AA relay returns (verified in aa-relay-console):
    // the verbatim body used to leak into user-facing toasts.
    fetchMock.mockResolvedValue(
      httpError(
        403,
        '{"error":{"code":"FORBIDDEN","message":"function not allowed"}}',
      ),
    );
    const aa = useAbstractAccount({ network: "testnet" });

    await expect(
      aa.submitRelayTransaction({ rawTransaction: "00" }),
    ).rejects.toThrow(/^function not allowed$/);
    expect(aa.error.get()).toBe("function not allowed");
  });

  it("falls back to error.code, then top-level message, then raw text", async () => {
    const aa = useAbstractAccount({ network: "testnet" });

    // checkGasSponsorship is an idempotent GET → a transient 5xx is retried
    // with bounded backoff, so every attempt must see the same response (the
    // summarized message survives into retryAsync's final wrapped error).
    fetchMock.mockResolvedValue(httpError(500, '{"error":{"code":"INTERNAL_ERROR"}}'));
    await expect(aa.checkGasSponsorship()).rejects.toThrow(/INTERNAL_ERROR/);

    // requestGasSponsorship is a non-idempotent write → never retried, so a
    // single response is consumed and a deterministic 4xx fails fast.
    fetchMock.mockReset();
    fetchMock.mockResolvedValueOnce(httpError(400, '{"message":"amount too large"}'));
    await expect(aa.requestGasSponsorship("5")).rejects.toThrow(/amount too large/);
    expect(fetchMock).toHaveBeenCalledTimes(1);

    fetchMock.mockReset();
    fetchMock.mockResolvedValue(httpError(502, "upstream unavailable"));
    await expect(aa.checkGasSponsorship()).rejects.toThrow(/upstream unavailable/);
  });

  it("uses '<method> <url> failed (<status>)' when the body is empty", async () => {
    fetchMock.mockResolvedValue(httpError(503, ""));
    const aa = useAbstractAccount({ network: "testnet" });

    await expect(aa.submitRelayTransaction({ rawTransaction: "00" })).rejects.toThrow(
      /failed \(503\)/,
    );
  });

  it("supports top-level string error fields", async () => {
    fetchMock.mockResolvedValue(httpError(401, '{"error":"missing token"}'));
    const aa = useAbstractAccount({ network: "testnet" });

    await expect(aa.checkGasSponsorship()).rejects.toThrow(/missing token/);
  });

  it("leaves successful responses untouched", async () => {
    fetchMock.mockResolvedValue(
      httpOk({ txid: "0xabc", networkFee: "1", systemFee: "2" }),
    );
    const aa = useAbstractAccount({ network: "testnet" });

    const response = await aa.submitRelayTransaction({ rawTransaction: "00" });

    expect(response.txid).toBe("0xabc");
    expect(aa.lastRelayResponse.get()).toEqual(response);
    expect(aa.error.get()).toBeNull();
  });
});
