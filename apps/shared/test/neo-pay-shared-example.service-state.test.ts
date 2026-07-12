import { describe, expect, it, vi } from "vitest";
import { useNeoPayApp } from "../composables/neo-pay";
import { createMiniAppFramework } from "../react";
import type { ChainService, ContractArg } from "../services/ChainService";

const OWNER = "NNLi44dJNXtDNSBkofB48aTVYtb1zZrNEs";
const BENEFICIARY = "NXV7ZhHiyM1aHXwpVsRZC6BwNFP2jghXAq";
const CONTRACT = "0x27a81e6d2f01a1d241b9aef5bed74c93f3a5ca5e";

function t(key: string) {
  return key;
}

function makeFramework(options: { listFailure?: boolean } = {}) {
  const readArray = vi.fn(async (operation: string) => {
    if (options.listFailure) throw new Error("rpc unavailable");
    return operation === "getUserStreams" ? ["1", "2"] : [];
  });
  const read = vi.fn(async (operation: string, args?: ContractArg[]) => {
    if (operation !== "getStreamDetails") return {};
    const id = String(args?.[0]?.value ?? "");
    if (id === "2") throw new Error("detail unavailable");
    return {
      creator: OWNER,
      beneficiary: BENEFICIARY,
      assetSymbol: "GAS",
      totalAmount: "200000000",
      releasedAmount: "0",
      remainingAmount: "200000000",
      rateAmount: "100000000",
      intervalSeconds: "86400",
      status: "active",
      claimable: "0",
      title: "Payroll",
      notes: "",
    };
  });
  const chain = {
    contractAddress: { get: () => CONTRACT },
    address: { get: () => OWNER },
    read,
    readArray,
    invoke: vi.fn(),
    invokeMultiple: vi.fn(),
  } as unknown as ChainService;
  return createMiniAppFramework(
    { services: { chain }, t } as never,
    { appId: "miniapp-neo-pay-shared-example" },
  );
}

describe("NeoPay shared service-state exposure", () => {
  it("marks a dropped detail read as partial instead of a complete zero/count success", async () => {
    const pay = useNeoPayApp({ app: makeFramework(), t });
    await pay.loadAll();
    expect(pay.dataState.get()).toBe("partial");
    expect(pay.failedDetailReads.get()).toBe(1);
    expect(pay.serviceNotice.get()).toBe("streamListPartial");
    expect(pay.createdStreams.get()).toHaveLength(1);
  });

  it("marks a failed role-list read unavailable", async () => {
    const pay = useNeoPayApp({ app: makeFramework({ listFailure: true }), t });
    await pay.loadAll();
    expect(pay.dataState.get()).toBe("unavailable");
    expect(pay.serviceNotice.get()).toBe("streamListUnavailable");
    expect(pay.createdStreams.get()).toEqual([]);
    expect(pay.beneficiaryStreams.get()).toEqual([]);
  });
});
