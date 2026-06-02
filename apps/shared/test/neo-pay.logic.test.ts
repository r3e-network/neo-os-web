import { describe, expect, it, vi } from "vitest";

import { useNeoPayApp } from "../../neo-pay/src/composables/useNeoPayApp";
import type { PaymentProxy } from "../services/os/PaymentProxy";
import type { VestingProxy } from "../services/os/VestingProxy";

function t(key: string) {
  const messages: Record<string, string> = {
    streamListUnavailable:
      "The payment stream index is not available in this environment yet.",
    streamActionUnavailable:
      "Payment stream services are not configured in this environment yet.",
  };
  return messages[key] ?? key;
}

describe("useNeoPayApp", () => {
  it("keeps the payment stream workspace usable when listStreams is unavailable", async () => {
    const vesting = {
      listStreams: vi.fn(async () => {
        throw new Error("OS service error (os-vesting-list): Not Found");
      }),
      createStream: vi.fn(),
      claim: vi.fn(),
      cancel: vi.fn(),
    } as unknown as VestingProxy & { listStreams: ReturnType<typeof vi.fn> };
    const payment = {
      deposit: vi.fn(),
    } as unknown as PaymentProxy;

    const app = useNeoPayApp({
      vestingService: vesting,
      paymentService: payment,
      t,
    });

    await expect(app.loadAll()).resolves.toBeUndefined();
    expect(app.createdStreams.get()).toEqual([]);
    expect(app.beneficiaryStreams.get()).toEqual([]);
    expect(app.serviceNotice.get()).toBe(
      "The payment stream index is not available in this environment yet.",
    );
  });

  it("normalizes payment and vesting action boundary errors", async () => {
    const vesting = {
      listStreams: vi.fn(async () => []),
      createStream: vi.fn(),
      claim: vi.fn(),
      cancel: vi.fn(),
    } as unknown as VestingProxy;
    const payment = {
      deposit: vi.fn(async () => {
        throw new Error("OS service error (os-payment-deposit): Not Found");
      }),
    } as unknown as PaymentProxy;

    const app = useNeoPayApp({
      vestingService: vesting,
      paymentService: payment,
      t,
    });

    await expect(
      app.handleCreateVault({
        name: "Payroll stream",
        beneficiary: "NNLi44dJNXtDNSBkofB48aTVYtb1zZrNEs",
        asset: "GAS",
        total: "1",
        rate: "1",
        intervalDays: "1",
        notes: "",
      }),
    ).rejects.toThrow(
      "Payment stream services are not configured in this environment yet.",
    );
  });
});
