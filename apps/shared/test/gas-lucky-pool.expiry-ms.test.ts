import { afterEach, describe, expect, it, vi } from "vitest";

import {
  OWNER,
  launch,
  makeApp,
  t,
  useGasLuckyPool,
} from "./gas-lucky-pool.logic.test-utils";
import { parsePool } from "../../gas-lucky-pool/src/composables/useGasLuckyPool.shared";

/**
 * Regression coverage for the seconds-vs-milliseconds expiry bug.
 *
 * CreateRangeGasPool stores `ExpiryTime = Runtime.Time + expiryMs` where
 * Runtime.Time is milliseconds on Neo N3, so the create call must send the
 * lifetime in ms (a 24h pool sent in seconds expired in ~86 seconds). The
 * mirror read path (parsePool) must compare the on-chain ms ExpiryTime against
 * Date.now() in ms, not Date.now()/1000.
 */
describe("OneGate Vault range pool expiry uses milliseconds", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("sends the create expiry in milliseconds (24h -> 86_400_000)", async () => {
    const chain = {
      ensureWallet: vi.fn().mockResolvedValue(OWNER),
      invokeWithPayment: vi.fn().mockResolvedValue({
        txid: "0xcreate",
        success: true,
        event: { state: [{ value: "miniapp-gas-lucky-pool" }, { value: "7" }] },
      }),
      readArray: vi.fn().mockResolvedValue([]),
      listEvents: vi.fn().mockResolvedValue([]),
    };
    const pool = useGasLuckyPool({
      app: makeApp(chain as any),
      launchContext: launch(""),
      t,
    });

    await pool.createPool({
      totalAmount: "10",
      minClaim: "1",
      maxClaim: "5",
      maxClaims: "5",
      expiryHours: "24",
    });

    expect(chain.invokeWithPayment).toHaveBeenCalledWith(
      "1000000000",
      "gas-lucky-pool:create:5",
      "createRangeGasPool",
      [
        { type: "String", value: "miniapp-gas-lucky-pool" },
        { type: "Hash160", value: OWNER },
        { type: "Integer", value: "1000000000" },
        { type: "Integer", value: "100000000" },
        { type: "Integer", value: "500000000" },
        { type: "Integer", value: "5" },
        // 24 * 3600 * 1000 — milliseconds, not the old 86_400 seconds.
        { type: "Integer", value: "86400000" },
      ],
      { waitForEvent: "RangeGasPoolCreated", waitTimeoutMs: 30_000 },
    );
  });

  it("rejects over-precision create amounts before wallet submission", async () => {
    const chain = {
      ensureWallet: vi.fn().mockResolvedValue(OWNER),
      invokeWithPayment: vi.fn(),
      readArray: vi.fn().mockResolvedValue([]),
      listEvents: vi.fn().mockResolvedValue([]),
    };
    const pool = useGasLuckyPool({
      app: makeApp(chain as any),
      launchContext: launch(""),
      t,
    });

    await expect(
      pool.createPool({
        totalAmount: "10.000000001",
        minClaim: "1",
        maxClaim: "5",
        maxClaims: "5",
        expiryHours: "24",
      }),
    ).rejects.toThrow("invalidTotal");

    expect(chain.ensureWallet).not.toHaveBeenCalled();
    expect(chain.invokeWithPayment).not.toHaveBeenCalled();
  });

  it("rounds fractional-hour expiry to whole milliseconds", async () => {
    const chain = {
      ensureWallet: vi.fn().mockResolvedValue(OWNER),
      invokeWithPayment: vi.fn().mockResolvedValue({
        txid: "0xcreate",
        success: true,
        event: { state: [{ value: "miniapp-gas-lucky-pool" }, { value: "8" }] },
      }),
      readArray: vi.fn().mockResolvedValue([]),
      listEvents: vi.fn().mockResolvedValue([]),
    };
    const pool = useGasLuckyPool({
      app: makeApp(chain as any),
      launchContext: launch(""),
      t,
    });

    await pool.createPool({
      totalAmount: "10",
      minClaim: "1",
      maxClaim: "5",
      maxClaims: "5",
      expiryHours: "1.5",
    });

    const expiryArg = (chain.invokeWithPayment.mock.calls[0]?.[3] as Array<{
      value: string;
    }>)[6];
    // 1.5h => 5_400_000 ms.
    expect(expiryArg.value).toBe("5400000");
  });

  it("marks a pool expired when the ms ExpiryTime is already in the past", () => {
    const expiredMs = Date.now() - 60_000;
    const raw = [
      OWNER,
      "1000000000",
      "100000000",
      "500000000",
      "5",
      "0",
      "1000000000",
      "",
      "0",
      String(expiredMs),
      true,
    ];
    const parsed = parsePool("42", raw);
    expect(parsed?.status).toBe("expired");
    expect(parsed?.expiryTime).toBe(expiredMs);
  });

  it("keeps a pool active when the ms ExpiryTime is in the future", () => {
    const futureMs = Date.now() + 24 * 3600 * 1000;
    const raw = [
      OWNER,
      "1000000000",
      "100000000",
      "500000000",
      "5",
      "0",
      "1000000000",
      "",
      "0",
      String(futureMs),
      true,
    ];
    const parsed = parsePool("42", raw);
    expect(parsed?.status).toBe("active");
  });

  it("normalizes real RPC Hash160 ByteStrings and rejects malformed snapshots", () => {
    const ownerBase64 = "ODf0EwY4dOXBDMmxnUaR3fZWBm0=";
    const ownerHash = "0x6d0656f6dd91469db1c90cc1e574380613f43738";
    const futureMs = Date.now() + 24 * 3600 * 1000;
    const valid = [
      { type: "ByteString", value: ownerBase64 },
      "1000000000",
      "100000000",
      "500000000",
      "5",
      "1",
      "750000000",
      { type: "ByteString", value: ownerBase64 },
      "250000000",
      String(futureMs),
      true,
    ];

    expect(parsePool("42", valid)).toEqual(
      expect.objectContaining({
        creator: ownerHash,
        bestLuckAddress: ownerHash,
        active: true,
      }),
    );
    expect(parsePool("42", [...valid.slice(0, 10), "not-a-boolean"])).toBeNull();
    expect(parsePool("42", [
      ...valid.slice(0, 6),
      "1000000001",
      ...valid.slice(7),
    ])).toBeNull();
  });
});
