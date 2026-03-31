import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { EventBus } from "@shared/services/EventBus";
import { ClipboardService } from "@shared/services/ClipboardService";

describe("ClipboardService", () => {
  let bus: EventBus;
  let clipboard: ClipboardService;
  let t: ReturnType<typeof vi.fn>;
  let emitted: Array<{ message: string; type: string }>;

  beforeEach(() => {
    bus = new EventBus();
    t = vi.fn((key: string) => `translated:${key}`);
    clipboard = new ClipboardService(bus, t);
    emitted = [];

    bus.on("notification", (payload) => {
      emitted.push(payload as { message: string; type: string });
    });

    // Mock navigator.clipboard
    Object.defineProperty(navigator, "clipboard", {
      value: {
        writeText: vi.fn().mockResolvedValue(undefined),
      },
      writable: true,
      configurable: true,
    });
  });

  afterEach(() => {
    bus.destroy();
    vi.restoreAllMocks();
  });

  it("should call navigator.clipboard.writeText with the provided text", async () => {
    await clipboard.copy("NNLi44dJNXtDNSBkofB48aTVYtb1zZrNEs");

    expect(navigator.clipboard.writeText).toHaveBeenCalledWith(
      "NNLi44dJNXtDNSBkofB48aTVYtb1zZrNEs",
    );
  });

  it("should emit success notification via EventBus", async () => {
    const result = await clipboard.copy("some-text");

    expect(result).toBe(true);
    expect(emitted).toHaveLength(1);
    expect(emitted[0]).toEqual({
      message: "translated:copied",
      type: "success",
    });
  });

  it("should use custom success key", async () => {
    await clipboard.copy("0xabc123", "addressCopied");

    expect(emitted).toHaveLength(1);
    expect(emitted[0].message).toBe("translated:addressCopied");
    expect(t).toHaveBeenCalledWith("addressCopied");
  });

  it("should emit error notification when clipboard write fails", async () => {
    (navigator.clipboard.writeText as ReturnType<typeof vi.fn>).mockRejectedValue(
      new Error("Permission denied"),
    );

    const result = await clipboard.copy("text");

    expect(result).toBe(false);
    expect(emitted).toHaveLength(1);
    expect(emitted[0]).toEqual({
      message: "translated:copyFailed",
      type: "error",
    });
  });

  it("should return true on successful copy", async () => {
    const result = await clipboard.copy("data");
    expect(result).toBe(true);
  });

  it("should return false on failed copy", async () => {
    (navigator.clipboard.writeText as ReturnType<typeof vi.fn>).mockRejectedValue(
      new Error("fail"),
    );

    const result = await clipboard.copy("data");
    expect(result).toBe(false);
  });
});
